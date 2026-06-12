import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { prisma, AppointmentStatus } from "@doctium/database";
import { PricingService } from "./pricing.service";
import { EntitlementsService } from "../subscriptions/entitlements.service";
import { BookAppointmentDto } from "./dto/book-appointment.dto";
import { FollowUpsService } from "./follow-ups.service";
import { SupportGateway } from "../support/support.gateway";
import { ReferralBonusService } from "../referral-bonus/referral-bonus.service";
import { SatisfactionService } from "../satisfaction/satisfaction.service";

const apptInclude = {
  doctor: { select: { name: true, image: true } },
  service: { select: { name: true } },
} as const;

@Injectable()
export class AppointmentsService {
  constructor(
    private readonly pricing: PricingService,
    private readonly entitlements: EntitlementsService,
    private readonly followUps: FollowUpsService,
    private readonly satisfaction: SatisfactionService,
    private readonly adminAlerts: SupportGateway,
    private readonly referralBonus: ReferralBonusService,
  ) {}

  private async setting(key: string, fallback: string): Promise<string> {
    const row = await prisma.setting.findUnique({ where: { key } });
    return row?.value || fallback;
  }

  async bookAppointment(userId: string, dto: BookAppointmentDto) {
    const {
      doctorId,
      date = "",
      time = "",
      serviceId,
      subPatientId,
      type,
      mode = "SCHEDULED",
      paymentMethod = "WALLET",
      couponCode,
      details,
      referralId,
    } = dto;

    const doctor = await prisma.doctor.findUnique({ where: { id: doctorId } });
    if (!doctor) throw new NotFoundException("Doctor not found");
    if (!doctor.isVerified)
      throw new BadRequestException(
        "This doctor is not available for booking right now",
      );

    const isInstant = mode === "INSTANT";
    if (isInstant && !doctor.isOnline) {
      throw new BadRequestException(
        "This doctor is not available for an instant consultation right now",
      );
    }

    const slotDate = isInstant ? new Date().toISOString().slice(0, 10) : date;
    const slotTime = isInstant ? new Date().toTimeString().slice(0, 5) : time;

    if (!isInstant) {
      await this.assertValidScheduledSlot(
        doctorId,
        slotDate,
        slotTime,
        doctor.timeSlot,
      );
      const busy = await prisma.doctorBusy.findFirst({
        where: { doctorId, date: slotDate, time: slotTime },
      });
      if (busy)
        throw new BadRequestException("This time slot is no longer available");
    }

    // Pricing
    const { amount: gross, currency } = await this.pricing.computeFee(
      doctor,
      mode,
      slotTime,
    );
    if (isInstant && gross <= 0) {
      throw new BadRequestException(
        "This doctor has not enabled instant consultations.",
      );
    }

    // DoctiumPlus membership — resolve once, then layer benefits onto the patient's price.
    // Key rule: member benefits (credit / member-discount) reduce only what the PATIENT pays;
    // the doctor is still paid on the post-coupon amount and the platform absorbs the gap from
    // subscription revenue. So a member-covered consult never shortchanges the doctor.
    const ent = await this.entitlements.resolveUserEntitlements(userId);
    const canCredit = ent.active && ent.consultsRemaining > 0 && !isInstant;

    // Coupon (re-validated server-side; never trust a client-supplied discount).
    // A credit consult is free and ignores any coupon (kept for the member to use later).
    let couponDiscount = 0;
    let couponId: string | null = null;
    if (couponCode && !canCredit) {
      const c = await this.validateCoupon(couponCode, userId, gross);
      couponDiscount = c.discount;
      couponId = c.couponId;
    }
    const afterCoupon = Math.max(0, gross - couponDiscount);

    // Member discount applies to non-credit consults. Default: does NOT stack with a coupon
    // (coupon takes precedence); flip Setting 'member_discount_stacks_with_coupon' to stack both.
    let memberDiscount = 0;
    let creditApplied = false;
    if (canCredit) {
      creditApplied = true;
    } else if (ent.active && ent.memberDiscountPercent > 0) {
      const stacks =
        (await this.setting("member_discount_stacks_with_coupon", "false")) ===
        "true";
      if (!couponCode || stacks) {
        // Round to whole kobo — money is stored as integer minor units.
        memberDiscount = Math.round(
          (afterCoupon * ent.memberDiscountPercent) / 100,
        );
      }
    }

    const patientPays = creditApplied
      ? 0
      : Math.max(0, afterCoupon - memberDiscount);
    // Doctor earns on the post-coupon value (full fee for credit consults) regardless of member perks.
    const earningsBase = creditApplied ? gross : afterCoupon;

    // Doctor commission — a doctor membership can only ever LOWER the platform's cut.
    const docEnt = await this.entitlements.resolveDoctorEntitlements(doctorId);
    const baseCommission = await this.pricing.commissionPercent(
      doctor.commission,
    );
    const commissionPct =
      docEnt.active && docEnt.commissionPercent != null
        ? Math.min(baseCommission, docEnt.commissionPercent)
        : baseCommission;
    const adminEarning = Math.round((earningsBase * commissionPct) / 100);
    const doctorEarning = earningsBase - adminEarning;

    const usesWallet = paymentMethod !== "PAYSTACK";
    // Confirm immediately when paying from wallet OR when nothing is left to charge the patient
    // (a credit consult or a fully-discounted booking). Card path waits for the webhook.
    const instantConfirm = usesWallet || patientPays <= 0;

    const created = await prisma.$transaction(async (tx) => {
      // Consume a plan credit atomically — the post-increment check is the concurrency guard
      // that prevents two simultaneous bookings from both spending the last credit.
      if (creditApplied && ent.usageId) {
        const usage = await tx.subscriptionUsage.update({
          where: { id: ent.usageId },
          data: { creditsUsed: { increment: 1 } },
        });
        if (usage.creditsUsed > usage.creditsTotal) {
          throw new BadRequestException(
            "No consult credits remaining on your plan",
          );
        }
      }

      if (instantConfirm && usesWallet && patientPays > 0) {
        const wallet = await tx.userWallet.findUnique({ where: { userId } });
        if (!wallet || wallet.balance < patientPays) {
          throw new BadRequestException(
            "Insufficient wallet balance. Please top up your wallet.",
          );
        }
      }

      const appt = await tx.appointment.create({
        data: {
          userId,
          doctorId,
          serviceId,
          subPatientId,
          referralId: referralId ?? null,
          details,
          couponCode: creditApplied ? null : couponCode,
          date: slotDate,
          time: slotTime,
          type: type as never,
          mode: mode as never,
          amount: patientPays,
          currency,
          discount: couponDiscount,
          adminCommissionPercent: commissionPct,
          adminEarning,
          doctorEarning,
          subscriptionId: ent.active ? ent.subscriptionId : null,
          creditApplied,
          memberDiscount,
          paymentGateway: (instantConfirm ? "WALLET" : "PAYSTACK") as never,
          status: "PENDING",
          paymentStatus: "PENDING",
        },
      });

      // Closed-loop referral tracking: a booking off a referral advances it to BOOKED.
      if (referralId) {
        await tx.referral.updateMany({
          where: { id: referralId, status: { in: ["PENDING", "ACCEPTED"] } },
          data: { status: "BOOKED", bookedAppointmentId: appt.id },
        });
      }

      if (instantConfirm) {
        // Settled now → reserve the slot, consume the coupon, charge the wallet (if any) and confirm.
        if (couponId)
          await tx.couponUser.create({ data: { couponId, userId } });
        if (!isInstant)
          await tx.doctorBusy.create({
            data: { doctorId, date: slotDate, time: slotTime },
          });
        if (usesWallet && patientPays > 0) {
          const wallet = await tx.userWallet.update({
            where: { userId },
            data: { balance: { decrement: patientPays } },
          });
          await tx.userWalletHistory.create({
            data: {
              walletId: wallet.id,
              amount: patientPays,
              type: "APPOINTMENT_PAYMENT",
              description: `Consultation with Dr. ${doctor.name}`,
            },
          });
        }
        if (patientPays > 0) {
          await tx.paymentTransaction.create({
            data: {
              reference: `appt_${appt.id}`,
              type: "APPOINTMENT_PAYMENT",
              provider: "WALLET",
              status: "SUCCESS",
              userId,
              doctorId,
              appointmentId: appt.id,
              amount: patientPays,
              currency,
              channel: "wallet",
            },
          });
        }
        return tx.appointment.update({
          where: { id: appt.id },
          data: { status: "CONFIRMED", paymentStatus: "PAID" },
          include: apptInclude,
        });
      }

      // Card: appointment stays PENDING and reserves NOTHING (no slot hold, no coupon used)
      // until the Paystack webhook confirms payment — see handlePaystackWebhook.
      return tx.appointment.findUnique({
        where: { id: appt.id },
        include: apptInclude,
      });
    });

    // Live admin alert: "There's a New Patient Booking" pops on every
    // logged-in admin panel (alarm + Check-it-out). Never blocks the booking.
    if (created) {
      (async () => {
        const patient = await prisma.user.findUnique({
          where: { id: userId },
          select: { name: true },
        });
        this.adminAlerts.broadcastNewBooking({
          id: created.id,
          patientName: patient?.name || "A patient",
          doctorName: created.doctor?.name ?? "",
          date: created.date,
          time: created.time,
          amount: created.amount,
          status: created.status,
        });
      })().catch(() => {
        /* socket delivery is best-effort */
      });
    }

    // Referral program: an instant wallet booking is already PAID — this may
    // be the referred patient's qualifying first payment. Idempotent + async.
    if (created?.paymentStatus === "PAID") {
      this.referralBonus.maybeReward(userId).catch(() => {});
    }

    // AI triage handoff: link the patient's most recent completed symptom-check
    // session (last 24h, not yet linked) so the doctor opens the consult with
    // the AI intake summary. Fire-and-forget — never blocks the booking.
    if (created) {
      (async () => {
        const triage = await prisma.triageSession.findFirst({
          where: {
            userId,
            status: "COMPLETED",
            urgency: { not: null }, // only real triage verdicts — not capped Q&A chats
            appointmentId: null,
            createdAt: { gte: new Date(Date.now() - 24 * 3600_000) },
          },
          orderBy: { createdAt: "desc" },
          select: { id: true, disposition: true },
        });
        if (triage) {
          await prisma.triageSession.update({
            where: { id: triage.id },
            data: {
              appointmentId: created.id,
              disposition: triage.disposition ?? "BOOKED",
            },
          });
        }
      })().catch(() => {});
    }

    return created;
  }

  /**
   * Server-side guarantee that a scheduled time is a real, bookable slot in the doctor's
   * own schedule — so a direct API call can't book outside the doctor's stated availability.
   * Mirrors the slot maths in doctors.service.getAvailableSlots.
   */
  private async assertValidScheduledSlot(
    doctorId: string,
    date: string,
    time: string,
    timeSlot: number,
  ) {
    const day = new Date(`${date}T00:00:00`).toLocaleDateString("en-US", {
      weekday: "long",
    });
    const sched = await prisma.doctorSchedule.findFirst({
      where: { doctorId, day },
    });
    if (!sched || !sched.startTime || !sched.endTime) {
      throw new BadRequestException(`The doctor is not available on ${day}s`);
    }
    const toMin = (t: string) => {
      const [h, m] = t.split(":").map(Number);
      return (h || 0) * 60 + (m || 0);
    };
    const start = toMin(sched.startTime);
    const end = toMin(sched.endTime);
    const t = toMin(time);
    const step = timeSlot || 30;

    if (t < start || t >= end) {
      throw new BadRequestException(
        `Selected time is outside the doctor's hours (${sched.startTime}–${sched.endTime})`,
      );
    }
    if ((t - start) % step !== 0) {
      throw new BadRequestException(
        "That is not a valid appointment slot for this doctor",
      );
    }
  }

  /** Mirrors coupons.service.validateCoupon; returns the coupon id so booking can record CouponUser atomically. */
  private async validateCoupon(
    code: string,
    userId: string,
    amount: number,
  ): Promise<{ couponId: string; discount: number }> {
    const coupon = await prisma.coupon.findUnique({
      where: { code, isActive: true },
    });
    if (!coupon) throw new BadRequestException("Invalid coupon code");
    if (coupon.expiryDate && new Date(coupon.expiryDate) < new Date())
      throw new BadRequestException("Coupon has expired");
    if (coupon.minAmountToApply > amount)
      throw new BadRequestException(
        `Minimum amount for this coupon is ₦${(coupon.minAmountToApply / 100).toLocaleString()}`,
      );
    const used = await prisma.couponUser.findUnique({
      where: { couponId_userId: { couponId: coupon.id, userId } },
    });
    if (used)
      throw new BadRequestException("You have already used this coupon");
    // FLAT coupons store a kobo amount in discountPercent; PERCENT coupons store a %.
    // Percent discounts round to whole kobo and respect the (kobo) max cap.
    const discount =
      coupon.discountType === "FLAT"
        ? (coupon.discountPercent ?? 0)
        : Math.min(
            Math.round((amount * (coupon.discountPercent ?? 0)) / 100),
            coupon.maxDiscount ?? Infinity,
          );
    return { couponId: coupon.id, discount };
  }

  getUserAppointments(userId: string, status?: AppointmentStatus) {
    return prisma.appointment.findMany({
      where: { userId, ...(status && { status }) },
      include: {
        doctor: { select: { name: true, image: true, designation: true } },
        service: { select: { name: true, image: true } },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  getDoctorAppointments(doctorId: string, status?: AppointmentStatus) {
    return prisma.appointment.findMany({
      // Doctors only ever see appointments that were actually paid — anything still PENDING/unpaid
      // is between the patient and admin until payment lands.
      where: {
        doctorId,
        paymentStatus: { in: ["PAID", "REFUNDED"] },
        ...(status && { status }),
      },
      include: {
        user: { select: { name: true, image: true } },
        subPatient: true,
        service: { select: { name: true } },
      },
      orderBy: { date: "asc" },
    });
  }

  async getAppointmentById(id: string) {
    const appointment = await prisma.appointment.findUnique({
      where: { id },
      include: {
        doctor: { select: { name: true, image: true, mobile: true } },
        user: { select: { name: true, image: true, mobile: true } },
        service: true,
        subPatient: true,
        prescription: { select: { id: true } },
      },
    });
    if (!appointment) throw new NotFoundException("Appointment not found");
    return appointment;
  }

  // ── Escrow release ──────────────────────────────────────────
  async updateStatus(id: string, status: AppointmentStatus) {
    const appt = await prisma.appointment.findUnique({ where: { id } });
    if (!appt) throw new NotFoundException("Appointment not found");
    const updated = await prisma.appointment.update({
      where: { id },
      data: { status },
    });
    if (status === "COMPLETED" && appt.status !== "COMPLETED") {
      if (appt.paymentStatus === "PAID" && !appt.isSettled) {
        await this.settleToDoctor(
          appt.id,
          appt.doctorId,
          appt.doctorEarning,
          appt.referralId,
        );
      }
      // Queue the 48h + 7d wellbeing check-ins (never block completion on a notify error).
      this.followUps
        .scheduleConsultFollowUps({
          id: appt.id,
          userId: appt.userId,
          doctorId: appt.doctorId,
          subPatientId: appt.subPatientId,
          followUpsScheduled: appt.followUpsScheduled,
        })
        .catch(() => {});
      // Queue the 24h NPS / satisfaction survey (one per appointment, same fire-and-forget rule).
      this.satisfaction
        .scheduleSurvey({
          id: appt.id,
          userId: appt.userId,
          doctorId: appt.doctorId,
          subPatientId: appt.subPatientId,
        })
        .catch(() => {});
      // Close the referral loop: the specialist consult that fulfilled a referral is done.
      if (appt.referralId) {
        await prisma.referral.updateMany({
          where: { id: appt.referralId, status: "BOOKED" },
          data: { status: "COMPLETED" },
        });
      }
    }
    return updated;
  }

  private async settleToDoctor(
    appointmentId: string,
    doctorId: string,
    doctorEarning: number,
    referralId?: string | null,
  ) {
    // Optional, specialist-funded referral commission: a slice of the SPECIALIST'S earning
    // (never the patient's fee, never the platform's cut) is paid to the referring doctor.
    const earning = Math.max(0, doctorEarning); // never settle a negative
    let commission = 0;
    let referrerId: string | null = null;
    if (referralId) {
      const ref = await prisma.referral.findUnique({
        where: { id: referralId },
        select: {
          commissionPct: true,
          referringDoctorId: true,
          commissionPaidAt: true,
        },
      });
      // Clamp to [0,50] %, never pay yourself, and never pay twice.
      if (
        ref &&
        !ref.commissionPaidAt &&
        ref.referringDoctorId !== doctorId &&
        ref.commissionPct > 0
      ) {
        const pct = Math.min(50, Math.max(0, ref.commissionPct));
        commission = Math.round((earning * pct) / 100);
        if (commission > 0) referrerId = ref.referringDoctorId;
      }
    }
    const specialistShare = earning - commission;

    await prisma.$transaction(async (tx) => {
      // ATOMIC CLAIM — flipping isSettled is the concurrency gate: only the first
      // COMPLETED transition settles. A concurrent/retried call claims 0 rows and
      // aborts before any wallet is credited (no double-payment of escrow).
      const claim = await tx.appointment.updateMany({
        where: { id: appointmentId, isSettled: false },
        data: { isSettled: true },
      });
      if (claim.count === 0) return;

      const wallet = await tx.doctorWallet.upsert({
        where: { doctorId },
        update: {
          balance: { increment: specialistShare },
          total: { increment: specialistShare },
        },
        create: { doctorId, balance: specialistShare, total: specialistShare },
      });
      await tx.doctorWalletHistory.create({
        data: {
          walletId: wallet.id,
          amount: specialistShare,
          type: "APPOINTMENT_PAYMENT",
          description:
            commission > 0
              ? "Appointment settlement (net of referral commission)"
              : "Appointment settlement",
        },
      });

      if (commission > 0 && referrerId && referralId) {
        // Belt-and-suspenders: claim the commission too (only pay once per referral).
        const refClaim = await tx.referral.updateMany({
          where: { id: referralId, commissionPaidAt: null },
          data: { commissionAmount: commission, commissionPaidAt: new Date() },
        });
        if (refClaim.count === 1) {
          const refWallet = await tx.doctorWallet.upsert({
            where: { doctorId: referrerId },
            update: {
              balance: { increment: commission },
              total: { increment: commission },
            },
            create: {
              doctorId: referrerId,
              balance: commission,
              total: commission,
            },
          });
          await tx.doctorWalletHistory.create({
            data: {
              walletId: refWallet.id,
              amount: commission,
              type: "REFERRAL_COMMISSION",
              description: "Referral commission",
            },
          });
        }
      }
    });
  }

  // ── Cancellation + refund ───────────────────────────────────
  async cancelAppointment(
    id: string,
    cancelledBy: "ADMIN" | "PATIENT" | "DOCTOR",
    reason: string,
  ) {
    const appt = await prisma.appointment.findUnique({ where: { id } });
    if (!appt) throw new NotFoundException("Appointment not found");
    if (appt.status === "COMPLETED")
      throw new BadRequestException("Cannot cancel a completed appointment");

    const refund =
      appt.paymentStatus === "PAID" && !appt.isSettled
        ? await this.computeRefund(appt, cancelledBy)
        : 0;

    return prisma.$transaction(async (tx) => {
      const updated = await tx.appointment.update({
        where: { id },
        data: {
          status: "CANCELLED",
          cancelledBy: cancelledBy as never,
          cancelReason: reason,
          cancelDate: new Date().toISOString().split("T")[0],
          ...(appt.paymentStatus === "PAID"
            ? {
                isSettled: true,
                paymentStatus: refund > 0 ? "REFUNDED" : "PAID",
              }
            : {}),
        },
      });

      if (appt.mode === "SCHEDULED") {
        await tx.doctorBusy.deleteMany({
          where: { doctorId: appt.doctorId, date: appt.date, time: appt.time },
        });
      }

      if (refund > 0) {
        const wallet = await tx.userWallet.upsert({
          where: { userId: appt.userId },
          update: { balance: { increment: refund } },
          create: { userId: appt.userId, balance: refund },
        });
        await tx.userWalletHistory.create({
          data: {
            walletId: wallet.id,
            amount: refund,
            type: "APPOINTMENT_REFUND",
            description: "Appointment cancellation refund",
          },
        });
        await tx.paymentTransaction.create({
          data: {
            reference: `refund_${appt.id}`,
            type: "REFUND",
            provider: "WALLET",
            status: "SUCCESS",
            userId: appt.userId,
            appointmentId: appt.id,
            amount: refund,
            currency: appt.currency,
            channel: "wallet",
          },
        });
      }
      return updated;
    });
  }

  /** Refund policy: doctor/admin cancel → full; patient cancel ≥ cutoff before slot → full; otherwise none. */
  private async computeRefund(
    appt: { amount: number; mode: string; date: string; time: string },
    cancelledBy: string,
  ): Promise<number> {
    if (cancelledBy === "DOCTOR" || cancelledBy === "ADMIN") return appt.amount;
    if (appt.mode === "INSTANT") return 0; // a doctor no-show is cancelled as DOCTOR → handled above
    const row = await prisma.setting.findUnique({
      where: { key: "cancellation_cutoff_hours" },
    });
    const cutoff = row?.value ? parseFloat(row.value) : 2;
    const slot = new Date(`${appt.date}T${appt.time || "00:00"}:00`);
    const hoursUntil = (slot.getTime() - Date.now()) / 3_600_000;
    return hoursUntil >= cutoff ? appt.amount : 0;
  }
}
