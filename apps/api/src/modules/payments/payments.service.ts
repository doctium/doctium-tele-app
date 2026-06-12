import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { prisma } from "@doctium/database";
import { PaystackProvider } from "./paystack.provider";
import { SubscriptionsService } from "../subscriptions/subscriptions.service";
import { ReferralBonusService } from "../referral-bonus/referral-bonus.service";
import { MailerProvider } from "../notifications/channels/mailer.provider";

@Injectable()
export class PaymentsService {
  constructor(
    private readonly paystack: PaystackProvider,
    private readonly subscriptions: SubscriptionsService,
    private readonly referralBonus: ReferralBonusService,
    private readonly mailer: MailerProvider,
  ) {}

  private async setting(key: string, fallback: string): Promise<string> {
    const row = await prisma.setting.findUnique({ where: { key } });
    return row?.value || fallback;
  }

  async getUserWallet(userId: string) {
    const wallet = await prisma.userWallet.findUnique({
      where: { userId },
      include: { history: { orderBy: { createdAt: "desc" }, take: 20 } },
    });
    return (
      wallet ??
      prisma.userWallet.create({ data: { userId }, include: { history: true } })
    );
  }

  // ── Paystack card top-up ────────────────────────────────────
  async initTopup(userId: string, amount: number) {
    // Setting is in major naira; amounts are kobo — convert before comparing.
    const minNaira = parseFloat(await this.setting("min_topup", "100"));
    const min = minNaira * 100;
    if (!amount || amount < min)
      throw new BadRequestException(
        `Minimum top-up is ₦${minNaira.toLocaleString()}`,
      );
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true },
    });
    if (!user?.email)
      throw new BadRequestException(
        "Add an email to your profile to top up by card",
      );

    const reference = `topup_${userId}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    await prisma.paymentTransaction.create({
      data: {
        reference,
        type: "WALLET_TOPUP",
        provider: "PAYSTACK",
        status: "PENDING",
        userId,
        amount,
        currency: "NGN",
        channel: "card",
      },
    });
    const callbackUrl = `${process.env.PUBLIC_WEB_URL ?? "http://localhost:3000"}/paystack/callback`;
    const init = await this.paystack.initializeTransaction({
      email: user.email,
      amount,
      reference,
      metadata: { userId, purpose: "wallet_topup" },
      callbackUrl,
    });
    return {
      authorizationUrl: init.authorization_url,
      reference,
      publicKey: process.env.PAYSTACK_PUBLIC_KEY ?? "",
    };
  }

  // ── Dedicated Virtual Account (created on first use) ────────
  async getOrCreateDVA(userId: string) {
    const existing = await prisma.dedicatedAccount.findUnique({
      where: { userId },
    });
    if (existing) return existing;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, name: true, mobile: true },
    });
    if (!user?.email)
      throw new BadRequestException(
        "Add an email to your profile to get a wallet account number",
      );

    const [first, ...rest] = (user.name || "Doctium User").trim().split(" ");
    const customer = await this.paystack.createCustomer({
      email: user.email,
      first_name: first || "Doctium",
      last_name: rest.join(" ") || "User",
      phone: user.mobile || undefined,
    });
    const dva = await this.paystack.createDedicatedAccount(
      customer.customer_code,
    );
    return prisma.dedicatedAccount.create({
      data: {
        userId,
        accountNumber: dva.account_number,
        accountName: dva.account_name,
        bankName: dva.bank?.name ?? "",
        provider: "PAYSTACK",
        paystackId: String(dva.id),
        customerCode: customer.customer_code,
      },
    });
  }

  // ── Pay for an appointment by card (escrow held on the platform) ──
  async initAppointmentPayment(userId: string, appointmentId: string) {
    const appt = await prisma.appointment.findUnique({
      where: { id: appointmentId },
    });
    if (!appt) throw new NotFoundException("Appointment not found");
    if (appt.userId !== userId)
      throw new ForbiddenException("Not your appointment");
    if (appt.paymentStatus === "PAID")
      throw new BadRequestException("This appointment is already paid");

    // Fully-discounted appointment — confirm directly, no gateway needed.
    if (appt.amount <= 0) {
      await prisma.appointment.update({
        where: { id: appointmentId },
        data: { status: "CONFIRMED", paymentStatus: "PAID" },
      });
      return { free: true as const };
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true },
    });
    if (!user?.email)
      throw new BadRequestException(
        "Add an email to your profile to pay by card",
      );

    const reference = `apptpay_${appointmentId}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    await prisma.paymentTransaction.create({
      data: {
        reference,
        type: "APPOINTMENT_PAYMENT",
        provider: "PAYSTACK",
        status: "PENDING",
        userId,
        doctorId: appt.doctorId,
        appointmentId,
        amount: appt.amount,
        currency: appt.currency,
        channel: "card",
      },
    });
    const callbackUrl = `${process.env.PUBLIC_WEB_URL ?? "http://localhost:3000"}/paystack/callback`;
    const init = await this.paystack.initializeTransaction({
      email: user.email,
      amount: appt.amount,
      reference,
      metadata: { userId, appointmentId, purpose: "appointment_payment" },
      callbackUrl,
    });
    return { authorizationUrl: init.authorization_url, reference };
  }

  // ── Webhook (idempotent) ───────────────────────────────────
  async handlePaystackWebhook(event: {
    event: string;
    data: Record<string, unknown>;
  }) {
    // Payout (transfer) outcome → finalise the PAYOUT ledger row; on failure, refund the doctor.
    if (
      event.event === "transfer.success" ||
      event.event === "transfer.failed" ||
      event.event === "transfer.reversed"
    ) {
      const reference = String(event.data.reference ?? "");
      if (!reference) return { handled: false };
      const txn = await prisma.paymentTransaction.findUnique({
        where: { reference },
      });
      if (!txn || txn.type !== "PAYOUT") return { handled: false };
      const ok = event.event === "transfer.success";
      await prisma.paymentTransaction.update({
        where: { reference },
        data: { status: ok ? "SUCCESS" : "FAILED", raw: event.data as never },
      });
      if (!ok && txn.doctorId) {
        const reqId = reference.replace("payout_", "");
        await prisma.$transaction(async (tx) => {
          await tx.doctorWallet.update({
            where: { doctorId: txn.doctorId! },
            data: { balance: { increment: txn.amount } },
          });
          await tx.withdrawRequest.updateMany({
            where: { id: reqId, status: "ACCEPTED" },
            data: {
              status: "PENDING",
              declineReason: "Transfer failed — please retry",
            },
          });
        });
      }
      return { handled: true, kind: "transfer" };
    }

    if (event.event !== "charge.success") return { handled: false };
    const data = event.data;
    const reference = String(data.reference ?? "");
    // Paystack reports the amount in kobo, which is now our storage unit too — no conversion.
    const amount = Number(data.amount) || 0;
    if (!reference || amount <= 0) return { handled: false };

    const existing = await prisma.paymentTransaction.findUnique({
      where: { reference },
    });
    if (existing?.status === "SUCCESS")
      return { handled: true, duplicate: true }; // idempotent

    // DoctiumPlus subscription charge (first payment or renewal) → store the card token + activate.
    if (existing?.type === "SUBSCRIPTION_PAYMENT") {
      return this.subscriptions.handleSubscriptionCharge(reference, data);
    }

    // Appointment payment → only NOW does the booking become real: reserve the slot,
    // consume the coupon and confirm (funds held on the platform; doctor paid on completion).
    if (existing?.type === "APPOINTMENT_PAYMENT" && existing.appointmentId) {
      const appt = await prisma.appointment.findUnique({
        where: { id: existing.appointmentId },
      });
      if (!appt) return { handled: false };
      if (appt.paymentStatus === "PAID") {
        await prisma.paymentTransaction.update({
          where: { reference },
          data: { status: "SUCCESS", raw: data as never },
        });
        return { handled: true, duplicate: true };
      }

      // Slot was taken by someone who paid first during the payment window → refund to wallet, cancel.
      if (appt.mode === "SCHEDULED") {
        const taken = await prisma.doctorBusy.findFirst({
          where: { doctorId: appt.doctorId, date: appt.date, time: appt.time },
        });
        if (taken) {
          await prisma.$transaction(async (tx) => {
            const wallet = await tx.userWallet.upsert({
              where: { userId: appt.userId },
              update: { balance: { increment: appt.amount } },
              create: { userId: appt.userId, balance: appt.amount },
            });
            await tx.userWalletHistory.create({
              data: {
                walletId: wallet.id,
                amount: appt.amount,
                type: "APPOINTMENT_REFUND",
                description:
                  "Time slot no longer available — refunded to wallet",
              },
            });
            await tx.appointment.update({
              where: { id: appt.id },
              data: {
                status: "CANCELLED",
                paymentStatus: "REFUNDED",
                cancelledBy: "ADMIN",
                cancelReason: "Time slot was taken before payment completed",
                isSettled: true,
                paymentRef: reference,
              },
            });
            await tx.paymentTransaction.update({
              where: { reference },
              data: { status: "SUCCESS", raw: data as never },
            });
            await tx.paymentTransaction.create({
              data: {
                reference: `refund_${appt.id}`,
                type: "REFUND",
                provider: "WALLET",
                status: "SUCCESS",
                userId: appt.userId,
                appointmentId: appt.id,
                amount: appt.amount,
                currency: appt.currency,
                channel: "wallet",
              },
            });
          });
          return { handled: true, kind: "appointment_conflict_refunded" };
        }
      }

      await prisma.$transaction(async (tx) => {
        if (appt.mode === "SCHEDULED")
          await tx.doctorBusy.create({
            data: { doctorId: appt.doctorId, date: appt.date, time: appt.time },
          });
        if (appt.couponCode) {
          const coupon = await tx.coupon.findUnique({
            where: { code: appt.couponCode },
          });
          if (coupon) {
            const used = await tx.couponUser.findUnique({
              where: {
                couponId_userId: { couponId: coupon.id, userId: appt.userId },
              },
            });
            if (!used)
              await tx.couponUser.create({
                data: { couponId: coupon.id, userId: appt.userId },
              });
          }
        }
        await tx.appointment.update({
          where: { id: appt.id },
          data: {
            status: "CONFIRMED",
            paymentStatus: "PAID",
            paymentRef: reference,
          },
        });
        await tx.paymentTransaction.update({
          where: { reference },
          data: { status: "SUCCESS", raw: data as never },
        });
      });
      // Referral program: a card payment just turned PAID — possibly the
      // referred patient's qualifying first payment. Idempotent + async.
      this.referralBonus.maybeReward(appt.userId).catch(() => {});
      return { handled: true, kind: "appointment" };
    }

    // Resolve the user: our pending top-up txn, the charge metadata, or a matching DVA customer.
    let userId: string | undefined =
      existing?.userId ??
      (data.metadata as { userId?: string } | undefined)?.userId;
    let channel = existing?.channel ?? "card";
    if (!userId) {
      const customerCode = (
        data.customer as { customer_code?: string } | undefined
      )?.customer_code;
      if (customerCode) {
        const dva = await prisma.dedicatedAccount.findFirst({
          where: { customerCode },
        });
        if (dva) {
          userId = dva.userId;
          channel = "dva";
        }
      }
    }
    if (!userId) return { handled: false, reason: "no_user" };

    await prisma.$transaction(async (tx) => {
      const wallet = await tx.userWallet.upsert({
        where: { userId: userId! },
        update: { balance: { increment: amount } },
        create: { userId: userId!, balance: amount },
      });
      await tx.userWalletHistory.create({
        data: {
          walletId: wallet.id,
          amount,
          type: "DEPOSIT",
          description:
            channel === "dva"
              ? "Wallet funding (bank transfer)"
              : "Wallet top-up (card)",
        },
      });
      if (existing) {
        await tx.paymentTransaction.update({
          where: { reference },
          data: { status: "SUCCESS", raw: data as never },
        });
      } else {
        await tx.paymentTransaction.create({
          data: {
            reference,
            type: "WALLET_TOPUP",
            provider: "PAYSTACK",
            status: "SUCCESS",
            userId: userId!,
            amount,
            currency: "NGN",
            channel,
            raw: data as never,
          },
        });
      }
    });
    return { handled: true };
  }

  // ── Doctor wallet + withdrawals (unchanged) ────────────────
  async getDoctorWallet(doctorId: string) {
    return prisma.doctorWallet.findUnique({
      where: { doctorId },
      include: { history: { orderBy: { createdAt: "desc" }, take: 20 } },
    });
  }

  /** Earnings analytics for the doctor's earnings screen. */
  async getDoctorEarningsStats(doctorId: string) {
    const wallet = await prisma.doctorWallet.findUnique({
      where: { doctorId },
    });
    const walletId = wallet?.id;

    // Time windows (server-local; Nigeria-first). Week starts Monday.
    const now = new Date();
    const startOfToday = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
    );
    const mondayOffset = (startOfToday.getDay() + 6) % 7;
    const startOfWeek = new Date(startOfToday);
    startOfWeek.setDate(startOfToday.getDate() - mondayOffset);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // Earnings = wallet credits from settled appointments, summed per window.
    const earningsSince = async (since: Date) => {
      if (!walletId) return 0;
      const r = await prisma.doctorWalletHistory.aggregate({
        _sum: { amount: true },
        where: {
          walletId,
          type: "APPOINTMENT_PAYMENT",
          createdAt: { gte: since },
        },
      });
      return r._sum.amount ?? 0;
    };

    const [today, week, month, withdrawn, pending, completed] =
      await Promise.all([
        earningsSince(startOfToday),
        earningsSince(startOfWeek),
        earningsSince(startOfMonth),
        prisma.withdrawRequest.aggregate({
          _sum: { amount: true },
          where: { doctorId, status: "ACCEPTED" },
        }),
        prisma.withdrawRequest.aggregate({
          _sum: { amount: true },
          where: { doctorId, status: "PENDING" },
        }),
        prisma.appointment.count({
          where: { doctorId, status: "COMPLETED", isSettled: true },
        }),
      ]);

    // Per-day earnings for the last 7 days (oldest → today), for the sparkline.
    const start7 = new Date(startOfToday);
    start7.setDate(startOfToday.getDate() - 6);
    const rows = walletId
      ? await prisma.doctorWalletHistory.findMany({
          where: {
            walletId,
            type: "APPOINTMENT_PAYMENT",
            createdAt: { gte: start7 },
          },
          select: { amount: true, createdAt: true },
        })
      : [];
    const bucket = new Map<string, number>();
    for (const r of rows) {
      const c = new Date(r.createdAt);
      const key = `${c.getFullYear()}-${c.getMonth()}-${c.getDate()}`;
      bucket.set(key, (bucket.get(key) ?? 0) + r.amount);
    }
    const WD = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const pad = (n: number) => String(n).padStart(2, "0");
    const last7Days = Array.from({ length: 7 }, (_, idx) => {
      const d = new Date(startOfToday);
      d.setDate(startOfToday.getDate() - (6 - idx));
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      // Local date string (not toISOString — that would UTC-shift midnight to the prior day).
      const date = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
      return { date, label: WD[d.getDay()], amount: bucket.get(key) ?? 0 };
    });

    return {
      currency: wallet?.currency ?? "NGN",
      availableBalance: wallet?.balance ?? 0,
      totalEarnings: wallet?.total ?? 0,
      totalWithdrawn: withdrawn._sum.amount ?? 0,
      pendingWithdrawals: pending._sum.amount ?? 0,
      completedConsultations: completed,
      earnings: { today, week, month },
      last7Days,
    };
  }

  getDoctorWithdrawMethods(doctorId: string) {
    return prisma.doctorWithdrawMethod.findMany({ where: { doctorId } });
  }

  saveDoctorWithdrawMethod(doctorId: string, dto: Record<string, unknown>) {
    return prisma.doctorWithdrawMethod.create({
      data: { doctorId, ...dto } as never,
    });
  }

  async requestWithdrawal(
    doctorId: string,
    dto: {
      amount: number;
      withdrawMethodId?: string;
      bankDetails?: BankDetails;
    },
  ) {
    if (!dto.amount || dto.amount <= 0)
      throw new BadRequestException("Enter a valid amount");
    const wallet = await prisma.doctorWallet.findUnique({
      where: { doctorId },
    });
    if (!wallet) throw new NotFoundException("Wallet not found");
    if (wallet.balance < dto.amount)
      throw new BadRequestException("Insufficient balance");

    // Reserve the amount immediately (restored if declined / transfer fails).
    await prisma.doctorWallet.update({
      where: { doctorId },
      data: { balance: { decrement: dto.amount } },
    });
    const request = await prisma.withdrawRequest.create({
      data: {
        doctorId,
        amount: dto.amount,
        withdrawMethodId: dto.withdrawMethodId,
        paymentDetails: (dto.bankDetails as never) ?? {},
        status: "PENDING",
      },
    });
    // Alert super admins by email (fire-and-forget; no-op without SMTP creds).
    this.notifySuperAdminsOfWithdrawal(doctorId, dto).catch(() => {});
    return request;
  }

  /** Email every active super admin when a doctor places a withdrawal request. */
  private async notifySuperAdminsOfWithdrawal(
    doctorId: string,
    dto: { amount: number; bankDetails?: BankDetails },
  ) {
    if (!this.mailer.isConfigured()) return;
    const [doctor, superAdmins] = await Promise.all([
      prisma.doctor.findUnique({
        where: { id: doctorId },
        select: { name: true, email: true },
      }),
      prisma.employee.findMany({
        where: { isSuperAdmin: true, isActive: true, email: { not: "" } },
        select: { email: true },
      }),
    ]);
    if (!superAdmins.length) return;
    const naira = `₦${(dto.amount / 100).toLocaleString("en-NG", { maximumFractionDigits: 2 })}`;
    const bank = dto.bankDetails?.accountNumber
      ? `${dto.bankDetails.accountName ?? ""} · ${dto.bankDetails.accountNumber}${dto.bankDetails.bankName ? ` · ${dto.bankDetails.bankName}` : ""}`
      : "Saved withdrawal method";
    const adminUrl = process.env.ADMIN_PANEL_URL || "http://localhost:3000";
    const html = `
      <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;padding:24px;border:1px solid #E6ECF3;border-radius:14px">
        <h2 style="color:#133157;margin:0 0 6px">New withdrawal request</h2>
        <p style="color:#5A6B82;margin:0 0 18px">A doctor has requested a payout and it's awaiting review.</p>
        <table style="width:100%;font-size:14px;color:#0F1B2D">
          <tr><td style="padding:6px 0;color:#93A1B5">Doctor</td><td style="text-align:right;font-weight:bold">${doctor?.name ?? "—"}</td></tr>
          <tr><td style="padding:6px 0;color:#93A1B5">Amount</td><td style="text-align:right;font-weight:bold">${naira}</td></tr>
          <tr><td style="padding:6px 0;color:#93A1B5">Destination</td><td style="text-align:right">${bank}</td></tr>
        </table>
        <a href="${adminUrl}/withdrawals" style="display:block;text-align:center;background:#133157;color:#fff;text-decoration:none;padding:12px;border-radius:10px;margin-top:18px;font-weight:bold">Review withdrawal</a>
      </div>`;
    await Promise.all(
      superAdmins.map((a) =>
        this.mailer.sendEmail(
          a.email,
          `Withdrawal request · ${doctor?.name ?? "Doctor"} · ${naira}`,
          html,
        ),
      ),
    );
  }

  getWithdrawRequests(doctorId: string) {
    return prisma.withdrawRequest.findMany({
      where: { doctorId },
      orderBy: { createdAt: "desc" },
    });
  }

  // ── Admin decides a withdrawal (restore on decline; auto/manual payout on approve) ──
  async decideWithdrawal(
    id: string,
    data: { status: string; declineReason?: string; payDate?: string },
  ) {
    const req = await prisma.withdrawRequest.findUnique({
      where: { id },
      include: { doctor: { select: { name: true } } },
    });
    if (!req) throw new NotFoundException("Withdrawal request not found");
    if (req.status !== "PENDING")
      throw new BadRequestException("This request has already been decided");

    if (data.status === "DECLINED") {
      // Restore the reserved balance (this was the bug — declines never gave the money back).
      return prisma.$transaction(async (tx) => {
        await tx.doctorWallet.update({
          where: { doctorId: req.doctorId },
          data: { balance: { increment: req.amount } },
        });
        return tx.withdrawRequest.update({
          where: { id },
          data: { status: "DECLINED", declineReason: data.declineReason ?? "" },
        });
      });
    }

    const today = new Date().toISOString().split("T")[0];
    const bank = (req.paymentDetails ?? {}) as BankDetails;
    const reference = `payout_${id}`;

    if (
      process.env.PAYSTACK_AUTO_PAYOUT === "true" &&
      bank.accountNumber &&
      bank.bankCode
    ) {
      // Automated Paystack transfer to the doctor's bank.
      const recipient = await this.paystack.createTransferRecipient({
        name: bank.accountName || req.doctor.name,
        account_number: bank.accountNumber,
        bank_code: bank.bankCode,
      });
      const transfer = await this.paystack.initiateTransfer({
        amount: req.amount,
        recipient: recipient.recipient_code,
        reason: "Doctium doctor payout",
        reference,
      });
      await prisma.paymentTransaction.create({
        data: {
          reference,
          type: "PAYOUT",
          provider: "PAYSTACK",
          status: transfer.status === "success" ? "SUCCESS" : "PENDING",
          doctorId: req.doctorId,
          amount: req.amount,
          currency: "NGN",
          channel: "transfer",
          raw: transfer as never,
        },
      });
    } else {
      // Manual payout (auto-payout off or no bank details) — recorded for the ledger.
      await prisma.paymentTransaction.create({
        data: {
          reference,
          type: "PAYOUT",
          provider: "MANUAL",
          status: "SUCCESS",
          doctorId: req.doctorId,
          amount: req.amount,
          currency: "NGN",
          channel: "manual",
        },
      });
    }
    return prisma.withdrawRequest.update({
      where: { id },
      data: { status: "ACCEPTED", payDate: data.payDate ?? today },
    });
  }

  // ── Bank list / account resolution (for the doctor payout form) ──
  getBanks() {
    return this.paystack.listBanks();
  }

  resolveAccount(accountNumber: string, bankCode: string) {
    return this.paystack.resolveAccount(accountNumber, bankCode);
  }
}

interface BankDetails {
  accountNumber?: string;
  bankCode?: string;
  bankName?: string;
  accountName?: string;
}
