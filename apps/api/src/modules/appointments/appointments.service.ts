import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import * as crypto from "crypto";
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

type ConsentMeta = { ip?: string; userAgent?: string };
type RecordingSessionRequester = { sub: string; role: string };
type RecordingAssetInput = {
  files?: Record<string, unknown>[];
  taskId?: string;
  provider?: string;
  storageVendor?: string;
};
type RecordingRetention = {
  retentionPolicy: string;
  retentionDays: number;
  retainUntil: Date;
};
type RecordingRequestInput = {
  type?: unknown;
  assetId?: unknown;
  reason?: unknown;
};

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

  async getRecordingConsent(
    appointmentId: string,
    requester: { sub: string; role: string },
  ) {
    const appt = await this.getParticipantAppointment(appointmentId, requester);
    const consent = await prisma.appointmentRecordingConsent.findUnique({
      where: { appointmentId: appt.id },
    });
    return this.serializeRecordingConsent(appt.id, consent);
  }

  async requestRecordingConsent(
    appointmentId: string,
    requester: { sub: string; role: string },
    meta: ConsentMeta,
  ) {
    const appt = await this.getParticipantAppointment(appointmentId, requester);
    this.assertOnlineAppointment(appt.type);
    const role = this.recordingActorRole(requester.role);
    if (role === "ADMIN") {
      throw new ForbiddenException(
        "Only the patient or doctor can request recording consent",
      );
    }

    const existing = await prisma.appointmentRecordingConsent.findUnique({
      where: { appointmentId: appt.id },
    });
    if (existing?.status === "DECLINED") {
      throw new BadRequestException(
        "Recording was declined for this consultation",
      );
    }
    if (existing?.status === "REVOKED") {
      throw new BadRequestException(
        "Recording consent was revoked for this consultation",
      );
    }

    const partyData = this.recordingPartyData(role, true, meta);
    const consent = existing
      ? await prisma.appointmentRecordingConsent.update({
          where: { appointmentId: appt.id },
          data: {
            ...partyData,
            status: this.nextRecordingStatus({
              patientConsentedAt:
                partyData.patientConsentedAt ?? existing.patientConsentedAt,
              doctorConsentedAt:
                partyData.doctorConsentedAt ?? existing.doctorConsentedAt,
              declined: false,
            }),
          },
        })
      : await prisma.appointmentRecordingConsent.create({
          data: {
            appointmentId: appt.id,
            requestedByRole: role,
            requestedById: requester.sub,
            ...partyData,
            status: this.nextRecordingStatus({
              patientConsentedAt: partyData.patientConsentedAt,
              doctorConsentedAt: partyData.doctorConsentedAt,
              declined: false,
            }),
          },
        });

    return this.serializeRecordingConsent(appt.id, consent);
  }

  async respondRecordingConsent(
    appointmentId: string,
    requester: { sub: string; role: string },
    consented: boolean,
    meta: ConsentMeta,
  ) {
    const appt = await this.getParticipantAppointment(appointmentId, requester);
    this.assertOnlineAppointment(appt.type);
    const role = this.recordingActorRole(requester.role);
    if (role === "ADMIN") {
      throw new ForbiddenException(
        "Only the patient or doctor can consent to recording",
      );
    }

    const existing = await prisma.appointmentRecordingConsent.findUnique({
      where: { appointmentId: appt.id },
    });
    if (!existing) {
      throw new BadRequestException("Recording consent has not been requested");
    }
    if (existing.status === "DECLINED") {
      throw new BadRequestException(
        "Recording was declined for this consultation",
      );
    }
    if (existing.status === "REVOKED") {
      throw new BadRequestException(
        "Recording consent was revoked for this consultation",
      );
    }

    const partyData = this.recordingPartyData(role, consented, meta);
    const updated = await prisma.appointmentRecordingConsent.update({
      where: { appointmentId: appt.id },
      data: {
        ...partyData,
        status: this.nextRecordingStatus({
          patientConsentedAt:
            partyData.patientConsentedAt ?? existing.patientConsentedAt,
          doctorConsentedAt:
            partyData.doctorConsentedAt ?? existing.doctorConsentedAt,
          declined: !consented,
        }),
      },
    });
    return this.serializeRecordingConsent(appt.id, updated);
  }

  async getRecordingSession(
    appointmentId: string,
    requester: RecordingSessionRequester,
  ) {
    const appt = await this.getParticipantAppointment(appointmentId, requester);
    const session = await prisma.appointmentRecordingSession.findUnique({
      where: { appointmentId: appt.id },
    });
    return this.serializeRecordingSession(appt.id, session);
  }

  async startRecordingSession(
    appointmentId: string,
    requester: RecordingSessionRequester,
  ) {
    const appt = await this.getParticipantAppointment(appointmentId, requester);
    this.assertOnlineAppointment(appt.type);
    const role = this.recordingActorRole(requester.role);
    if (role === "ADMIN") {
      throw new ForbiddenException(
        "Only the patient or doctor can start recording",
      );
    }

    await this.assertRecordingConsentReady(appt.id);

    const existing = await prisma.appointmentRecordingSession.findUnique({
      where: { appointmentId: appt.id },
    });
    if (
      existing &&
      ["STARTING", "ACTIVE", "STOPPING", "STOPPED"].includes(existing.status)
    ) {
      return this.serializeRecordingSession(appt.id, existing);
    }

    const roomId = this.recordingRoomId(appt.id);
    const clientTaskId = `rec_${appt.id}_${Date.now()}`;
    const outputPrefix = `consultations/${appt.id}`;
    const storage = this.zegoStorageConfig();
    const created = await prisma.appointmentRecordingSession.upsert({
      where: { appointmentId: appt.id },
      update: {
        status: "STARTING",
        roomId,
        clientTaskId,
        outputPrefix,
        storageVendor: storage.vendor,
        startedByRole: role,
        startedById: requester.sub,
        startedAt: null,
        stoppedByRole: null,
        stoppedById: null,
        stoppedAt: null,
        lastError: null,
      },
      create: {
        appointmentId: appt.id,
        roomId,
        clientTaskId,
        outputPrefix,
        storageVendor: storage.vendor,
        startedByRole: role,
        startedById: requester.sub,
      },
    });

    try {
      const zego = await this.zegoStartRecording({
        roomId,
        outputPrefix,
        storageParams: storage.params,
      });
      const updated = await prisma.appointmentRecordingSession.update({
        where: { id: created.id },
        data: {
          status: "ACTIVE",
          taskId: zego.taskId,
          startedAt: new Date(),
          lastError: null,
        },
      });
      return this.serializeRecordingSession(appt.id, updated);
    } catch (error) {
      const updated = await prisma.appointmentRecordingSession.update({
        where: { id: created.id },
        data: {
          status: "FAILED",
          lastError:
            error instanceof Error ? error.message : "Recording start failed",
        },
      });
      return this.serializeRecordingSession(appt.id, updated);
    }
  }

  async stopRecordingSession(
    appointmentId: string,
    requester: RecordingSessionRequester,
  ) {
    const appt = await this.getParticipantAppointment(appointmentId, requester);
    const role = this.recordingActorRole(requester.role);
    if (role === "ADMIN") {
      throw new ForbiddenException(
        "Only the patient or doctor can stop recording",
      );
    }

    const existing = await prisma.appointmentRecordingSession.findUnique({
      where: { appointmentId: appt.id },
    });
    if (!existing) return this.serializeRecordingSession(appt.id, null);
    if (existing.status === "STOPPED" || existing.status === "FAILED") {
      return this.serializeRecordingSession(appt.id, existing);
    }
    if (!existing.taskId) {
      const updated = await prisma.appointmentRecordingSession.update({
        where: { id: existing.id },
        data: {
          status: "FAILED",
          lastError:
            "Cannot stop recording because provider task id is missing",
        },
      });
      return this.serializeRecordingSession(appt.id, updated);
    }

    await prisma.appointmentRecordingSession.update({
      where: { id: existing.id },
      data: { status: "STOPPING" },
    });

    try {
      await this.zegoStopRecording(existing.taskId);
      const updated = await prisma.appointmentRecordingSession.update({
        where: { id: existing.id },
        data: {
          status: "STOPPED",
          stoppedByRole: role,
          stoppedById: requester.sub,
          stoppedAt: new Date(),
          lastError: null,
        },
      });
      return this.serializeRecordingSession(appt.id, updated);
    } catch (error) {
      const updated = await prisma.appointmentRecordingSession.update({
        where: { id: existing.id },
        data: {
          status: "FAILED",
          lastError:
            error instanceof Error ? error.message : "Recording stop failed",
        },
      });
      return this.serializeRecordingSession(appt.id, updated);
    }
  }

  async listRecordingAssets(
    appointmentId: string,
    requester: RecordingSessionRequester,
  ) {
    const appt = await this.getParticipantAppointment(appointmentId, requester);
    const assets = await prisma.appointmentRecordingAsset.findMany({
      where: { appointmentId: appt.id, status: "AVAILABLE" },
      orderBy: { createdAt: "desc" },
    });
    return assets.map((asset) => this.serializeRecordingAsset(asset));
  }

  async registerRecordingAssets(
    appointmentId: string,
    input: RecordingAssetInput,
    actor?: RecordingSessionRequester,
  ) {
    if (actor) {
      const role = this.recordingActorRole(actor.role);
      if (role !== "ADMIN")
        throw new ForbiddenException(
          "Only admins can register recording assets",
        );
    }
    const appt = await prisma.appointment.findUnique({
      where: { id: appointmentId },
    });
    if (!appt) throw new NotFoundException("Appointment not found");

    const session = await prisma.appointmentRecordingSession.findUnique({
      where: { appointmentId: appt.id },
    });
    const files = Array.isArray(input.files) ? input.files : [];
    if (files.length === 0)
      throw new BadRequestException("No recording files provided");

    const saved = [];
    for (const file of files) {
      const objectKey = String(
        file.objectKey ??
          file.ObjectKey ??
          file.key ??
          file.Key ??
          file.url ??
          file.FileUrl ??
          "",
      );
      if (!objectKey) continue;
      const bucket = this.optionalString(file.bucket ?? file.Bucket);
      const region = this.optionalString(file.region ?? file.Region);
      const vendor = this.optionalString(
        file.storageVendor ?? input.storageVendor ?? session?.storageVendor,
      );
      const retention = await this.recordingRetentionForAppointment(
        appt.id,
        file,
      );
      const asset = await prisma.appointmentRecordingAsset.upsert({
        where: {
          appointmentId_objectKey: { appointmentId: appt.id, objectKey },
        },
        update: {
          sessionId: session?.id ?? null,
          provider:
            this.optionalString(file.provider ?? input.provider) || "ZEGO",
          storageVendor: vendor,
          bucket,
          region,
          fileName: this.optionalString(file.fileName ?? file.FileName),
          mimeType:
            this.optionalString(file.mimeType ?? file.MimeType) || "video/mp4",
          sizeBytes: this.optionalBigInt(file.sizeBytes ?? file.Size),
          durationSeconds: this.optionalNumber(
            file.durationSeconds ?? file.Duration,
          ),
          checksum: this.optionalString(file.checksum ?? file.Checksum),
          encrypted: file.encrypted === false ? false : true,
          encryptionMethod:
            this.optionalString(file.encryptionMethod) || "provider-managed",
          providerTaskId: this.optionalString(
            file.providerTaskId ?? input.taskId ?? session?.taskId,
          ),
          providerFileId: this.optionalString(
            file.providerFileId ?? file.FileId,
          ),
          providerUrl: this.optionalString(
            file.providerUrl ?? file.FileUrl ?? file.url,
          ),
          retentionPolicy: retention.retentionPolicy,
          retentionDays: retention.retentionDays,
          retainUntil: retention.retainUntil,
          archivedAt: null,
          deletedAt: null,
          status: "AVAILABLE",
        },
        create: {
          appointmentId: appt.id,
          sessionId: session?.id ?? null,
          provider:
            this.optionalString(file.provider ?? input.provider) || "ZEGO",
          storageVendor: vendor,
          bucket,
          region,
          objectKey,
          fileName: this.optionalString(file.fileName ?? file.FileName),
          mimeType:
            this.optionalString(file.mimeType ?? file.MimeType) || "video/mp4",
          sizeBytes: this.optionalBigInt(file.sizeBytes ?? file.Size),
          durationSeconds: this.optionalNumber(
            file.durationSeconds ?? file.Duration,
          ),
          checksum: this.optionalString(file.checksum ?? file.Checksum),
          encrypted: file.encrypted === false ? false : true,
          encryptionMethod:
            this.optionalString(file.encryptionMethod) || "provider-managed",
          providerTaskId: this.optionalString(
            file.providerTaskId ?? input.taskId ?? session?.taskId,
          ),
          providerFileId: this.optionalString(
            file.providerFileId ?? file.FileId,
          ),
          providerUrl: this.optionalString(
            file.providerUrl ?? file.FileUrl ?? file.url,
          ),
          retentionPolicy: retention.retentionPolicy,
          retentionDays: retention.retentionDays,
          retainUntil: retention.retainUntil,
        },
      });
      saved.push(this.serializeRecordingAsset(asset));
    }
    return { appointmentId: appt.id, assets: saved };
  }

  async getRecordingAssetAccess(
    appointmentId: string,
    assetId: string,
    requester: RecordingSessionRequester,
    meta: ConsentMeta,
  ) {
    const appt = await this.getParticipantAppointment(appointmentId, requester);
    const asset = await prisma.appointmentRecordingAsset.findFirst({
      where: { id: assetId, appointmentId: appt.id, status: "AVAILABLE" },
    });
    if (!asset) throw new NotFoundException("Recording asset not found");
    await this.assertRecordingPlaybackEntitlement(requester);

    await prisma.appointmentRecordingAccessLog.create({
      data: {
        appointmentId: appt.id,
        assetId: asset.id,
        actorRole: this.recordingActorRole(requester.role),
        actorId: requester.sub,
        ip: meta.ip,
        userAgent: meta.userAgent,
      },
    });

    const expiresInSeconds = Number(
      process.env.RECORDING_ACCESS_URL_TTL_SECONDS ?? 300,
    );
    const expiresAt = new Date(Date.now() + expiresInSeconds * 1000);
    return {
      asset: this.serializeRecordingAsset(asset),
      accessUrl: this.signedRecordingUrl(asset, expiresInSeconds),
      expiresAt,
    };
  }

  async listRecordingRequests(
    appointmentId: string,
    requester: RecordingSessionRequester,
  ) {
    const appt = await this.getParticipantAppointment(appointmentId, requester);
    const rows = await prisma.appointmentRecordingRequest.findMany({
      where: { appointmentId: appt.id },
      orderBy: { createdAt: "desc" },
    });
    return rows.map((row) => this.serializeRecordingRequest(row));
  }

  async createRecordingRequest(
    appointmentId: string,
    requester: RecordingSessionRequester,
    input: RecordingRequestInput,
  ) {
    const appt = await this.getParticipantAppointment(appointmentId, requester);
    const type = this.optionalString(input.type)?.toUpperCase();
    if (type !== "EXPORT" && type !== "DELETE") {
      throw new BadRequestException("Request type must be EXPORT or DELETE");
    }
    const role = this.recordingActorRole(requester.role);
    if (type === "DELETE" && role !== "USER" && role !== "ADMIN") {
      throw new ForbiddenException(
        "Only the patient or an admin can request recording deletion",
      );
    }
    const assetId = this.optionalString(input.assetId);
    if (assetId) {
      const asset = await prisma.appointmentRecordingAsset.findFirst({
        where: { id: assetId, appointmentId: appt.id },
        select: { id: true },
      });
      if (!asset) throw new NotFoundException("Recording asset not found");
    }
    const request = await prisma.appointmentRecordingRequest.create({
      data: {
        appointmentId: appt.id,
        assetId,
        type: type as never,
        requestedByRole: role,
        requestedById: requester.sub,
        reason: this.optionalString(input.reason) ?? "",
      },
    });
    await prisma.appointmentRecordingAccessLog.create({
      data: {
        appointmentId: appt.id,
        assetId,
        actorRole: role,
        actorId: requester.sub,
        action: `${type}_REQUEST_CREATED`,
      },
    });
    return this.serializeRecordingRequest(request);
  }

  async adminListRecordings(query: {
    status?: string;
    search?: string;
    page?: number;
    limit?: number;
    retention?: string;
  }) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
    const status =
      query.status && query.status !== "ALL" ? query.status : undefined;
    const now = new Date();
    const assetWhere = {
      ...(status ? { status: status as never } : {}),
      ...(query.retention === "EXPIRED" ? { retainUntil: { lte: now } } : {}),
      ...(query.retention === "ACTIVE"
        ? { OR: [{ retainUntil: null }, { retainUntil: { gt: now } }] }
        : {}),
    };
    const search = query.search?.trim();
    const where = {
      recordingAssets: { some: assetWhere },
      ...(search
        ? {
            OR: [
              {
                appointmentId: {
                  contains: search,
                  mode: "insensitive" as const,
                },
              },
              {
                user: {
                  name: { contains: search, mode: "insensitive" as const },
                },
              },
              {
                doctor: {
                  name: { contains: search, mode: "insensitive" as const },
                },
              },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      prisma.appointment.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              image: true,
              mobile: true,
              country: true,
            },
          },
          doctor: { select: { name: true, image: true } },
          recordingConsent: true,
          recordingSession: true,
          recordingAssets: {
            where: assetWhere,
            orderBy: { createdAt: "desc" },
          },
          _count: { select: { recordingAccessLogs: true } },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.appointment.count({ where }),
    ]);

    return {
      items: items.map((appt) => ({
        id: appt.id,
        appointmentId: appt.appointmentId,
        date: appt.date,
        time: appt.time,
        type: appt.type,
        status: appt.status,
        user: appt.user,
        doctor: appt.doctor,
        consentStatus: appt.recordingConsent?.status ?? "NOT_REQUESTED",
        sessionStatus: appt.recordingSession?.status ?? "NOT_STARTED",
        accessLogCount: appt._count.recordingAccessLogs,
        assets: appt.recordingAssets.map((asset) =>
          this.serializeRecordingAsset(asset),
        ),
      })),
      total,
      page,
      limit,
    };
  }

  async adminGetRecording(appointmentId: string) {
    const appt = await prisma.appointment.findUnique({
      where: { id: appointmentId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            image: true,
            mobile: true,
            country: true,
          },
        },
        doctor: { select: { id: true, name: true, image: true } },
        recordingConsent: true,
        recordingSession: true,
        recordingAssets: { orderBy: { createdAt: "desc" } },
        recordingAccessLogs: { orderBy: { createdAt: "desc" }, take: 100 },
        recordingRequests: { orderBy: { createdAt: "desc" }, take: 100 },
      },
    });
    if (!appt) throw new NotFoundException("Appointment not found");
    return {
      id: appt.id,
      appointmentId: appt.appointmentId,
      date: appt.date,
      time: appt.time,
      type: appt.type,
      status: appt.status,
      user: appt.user,
      doctor: appt.doctor,
      consent: appt.recordingConsent,
      session: this.serializeRecordingSession(appt.id, appt.recordingSession),
      assets: appt.recordingAssets.map((asset) =>
        this.serializeRecordingAsset(asset),
      ),
      accessLogs: appt.recordingAccessLogs,
      requests: appt.recordingRequests.map((request) =>
        this.serializeRecordingRequest(request),
      ),
    };
  }

  async adminListRecordingRequests(query: {
    status?: string;
    type?: string;
    page?: number;
    limit?: number;
  }) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
    const where = {
      ...(query.status && query.status !== "ALL"
        ? { status: query.status as never }
        : {}),
      ...(query.type && query.type !== "ALL"
        ? { type: query.type as never }
        : {}),
    };
    const [items, total] = await Promise.all([
      prisma.appointmentRecordingRequest.findMany({
        where,
        include: {
          appointment: {
            select: {
              id: true,
              appointmentId: true,
              date: true,
              time: true,
              user: { select: { name: true, image: true } },
              doctor: { select: { name: true, image: true } },
            },
          },
          asset: {
            select: {
              id: true,
              fileName: true,
              status: true,
              retainUntil: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.appointmentRecordingRequest.count({ where }),
    ]);
    return {
      items: items.map((item) => ({
        ...this.serializeRecordingRequest(item),
        appointment: item.appointment,
        asset: item.asset,
      })),
      total,
      page,
      limit,
    };
  }

  async adminDecideRecordingRequest(
    requestId: string,
    admin: RecordingSessionRequester,
    input: {
      status?: unknown;
      decisionReason?: unknown;
      disputeHold?: unknown;
      disputeHoldUntil?: unknown;
      disputeHoldReason?: unknown;
    },
  ) {
    const status = this.optionalString(input.status)?.toUpperCase();
    if (
      status !== "APPROVED" &&
      status !== "REJECTED" &&
      status !== "COMPLETED"
    ) {
      throw new BadRequestException(
        "Decision status must be APPROVED, REJECTED, or COMPLETED",
      );
    }
    const existing = await prisma.appointmentRecordingRequest.findUnique({
      where: { id: requestId },
      include: { appointment: true },
    });
    if (!existing) throw new NotFoundException("Recording request not found");

    const now = new Date();
    const update: Record<string, unknown> = {
      status,
      decisionById: admin.sub,
      decisionReason: this.optionalString(input.decisionReason),
      decidedAt: now,
      disputeHold: input.disputeHold === true,
      disputeHoldUntil: this.optionalDate(input.disputeHoldUntil),
      disputeHoldReason: this.optionalString(input.disputeHoldReason),
    };

    if (status === "APPROVED" && existing.type === "EXPORT") {
      const asset = await this.recordingRequestAsset(
        existing.appointmentId,
        existing.assetId,
      );
      const expiresInSeconds = Number(
        process.env.RECORDING_EXPORT_URL_TTL_SECONDS ?? 86400,
      );
      update.exportUrl = this.signedRecordingUrl(asset, expiresInSeconds);
      update.exportExpiresAt = new Date(Date.now() + expiresInSeconds * 1000);
    }

    if (
      (status === "APPROVED" || status === "COMPLETED") &&
      existing.type === "DELETE"
    ) {
      const holdUntil = this.optionalDate(input.disputeHoldUntil);
      if (
        input.disputeHold === true &&
        (!holdUntil || holdUntil.getTime() > Date.now())
      ) {
        update.status = "APPROVED";
      } else {
        await this.deleteRecordingRequestAssets(
          existing.appointmentId,
          existing.assetId,
          now,
        );
        update.status = "COMPLETED";
        update.completedAt = now;
      }
    }

    const request = await prisma.appointmentRecordingRequest.update({
      where: { id: requestId },
      data: update as never,
    });
    await prisma.appointmentRecordingAccessLog.create({
      data: {
        appointmentId: existing.appointmentId,
        assetId: existing.assetId,
        actorRole: "ADMIN",
        actorId: admin.sub,
        action: `${existing.type}_REQUEST_${String(update.status)}`,
      },
    });
    return this.serializeRecordingRequest(request);
  }

  async setRecordingRequestDisputeHold(
    appointmentId: string,
    requestId: string,
    requester: RecordingSessionRequester,
    input: { disputeHoldUntil?: unknown; disputeHoldReason?: unknown },
  ) {
    const appt = await this.getParticipantAppointment(appointmentId, requester);
    const role = this.recordingActorRole(requester.role);
    if (role !== "DOCTOR" && role !== "ADMIN") {
      throw new ForbiddenException(
        "Only the doctor or an admin can place a dispute hold",
      );
    }
    const request = await prisma.appointmentRecordingRequest.findFirst({
      where: { id: requestId, appointmentId: appt.id },
    });
    if (!request) throw new NotFoundException("Recording request not found");
    const updated = await prisma.appointmentRecordingRequest.update({
      where: { id: request.id },
      data: {
        disputeHold: true,
        disputeHoldUntil: this.optionalDate(input.disputeHoldUntil),
        disputeHoldReason:
          this.optionalString(input.disputeHoldReason) ?? "Dispute/legal hold",
      },
    });
    await prisma.appointmentRecordingAccessLog.create({
      data: {
        appointmentId: appt.id,
        assetId: request.assetId,
        actorRole: role,
        actorId: requester.sub,
        action: "DISPUTE_HOLD_PLACED",
      },
    });
    return this.serializeRecordingRequest(updated);
  }

  async adminUpdateRecordingAssetRetention(
    assetId: string,
    input: {
      retentionDays?: unknown;
      retainUntil?: unknown;
      retentionPolicy?: unknown;
      status?: unknown;
    },
  ) {
    const asset = await prisma.appointmentRecordingAsset.findUnique({
      where: { id: assetId },
    });
    if (!asset) throw new NotFoundException("Recording asset not found");
    const retentionDays = this.positiveInt(input.retentionDays);
    const retainUntil = this.optionalDate(input.retainUntil);
    const status = this.optionalString(input.status);
    return this.serializeRecordingAsset(
      await prisma.appointmentRecordingAsset.update({
        where: { id: assetId },
        data: {
          ...(retentionDays !== undefined && { retentionDays }),
          ...(retainUntil && { retainUntil }),
          ...(this.optionalString(input.retentionPolicy) && {
            retentionPolicy: this.optionalString(input.retentionPolicy),
          }),
          ...(status &&
          ["AVAILABLE", "ARCHIVED", "QUARANTINED", "DELETED"].includes(status)
            ? {
                status: status as never,
                ...(status === "ARCHIVED" ? { archivedAt: new Date() } : {}),
                ...(status === "DELETED" ? { deletedAt: new Date() } : {}),
              }
            : {}),
        },
      }),
    );
  }

  async runRecordingRetention() {
    const action = (
      await this.setting(
        "recording_retention_action",
        process.env.RECORDING_RETENTION_ACTION ?? "ARCHIVE",
      )
    ).toUpperCase();
    const now = new Date();
    const expired = await prisma.appointmentRecordingAsset.findMany({
      where: {
        retainUntil: { lte: now },
        status: { in: ["AVAILABLE", "QUARANTINED"] as never },
      },
      select: { id: true, appointmentId: true },
    });
    if (expired.length === 0) return { processed: 0, action };

    const status = action === "DELETE" ? "DELETED" : "ARCHIVED";
    await prisma.appointmentRecordingAsset.updateMany({
      where: { id: { in: expired.map((a) => a.id) } },
      data:
        status === "DELETED"
          ? { status, deletedAt: now }
          : { status, archivedAt: now },
    });
    await prisma.appointmentRecordingAccessLog.createMany({
      data: expired.map((asset) => ({
        appointmentId: asset.appointmentId,
        assetId: asset.id,
        actorRole: "ADMIN",
        actorId: "system",
        action: `RETENTION_${status}`,
      })),
    });
    return { processed: expired.length, action: status };
  }

  @Cron("0 3 * * *")
  async runRecordingRetentionCron() {
    await this.runRecordingRetention();
  }

  private async assertRecordingPlaybackEntitlement(
    requester: RecordingSessionRequester,
  ) {
    const role = this.recordingActorRole(requester.role);
    if (role === "ADMIN") return;

    if (role === "USER") {
      const ent = await this.entitlements.resolveUserEntitlements(
        requester.sub,
      );
      if (ent.active && ent.recordingPlayback) return;
    }

    if (role === "DOCTOR") {
      const ent = await this.entitlements.resolveDoctorEntitlements(
        requester.sub,
      );
      if (ent.active && ent.recordingPlayback) return;
    }

    throw new ForbiddenException(
      "Consultation playback is available on plans that include recording playback",
    );
  }

  private async recordingRetentionForAppointment(
    appointmentId: string,
    file: Record<string, unknown>,
  ): Promise<RecordingRetention> {
    const explicitDays = this.positiveInt(file.retentionDays);
    const explicitUntil = this.optionalDate(file.retainUntil);
    const appt = await prisma.appointment.findUnique({
      where: { id: appointmentId },
      include: {
        user: { select: { country: true } },
        subscription: { include: { plan: true } },
      },
    });

    const benefits = (appt?.subscription?.plan.benefits ?? {}) as {
      recordingRetentionDays?: unknown;
    };
    const planDays = this.positiveInt(benefits.recordingRetentionDays);
    const country = (appt?.user?.country ?? "").trim().toUpperCase();
    const jurisdictionRaw = country
      ? await this.setting(`recording_retention_days_${country}`, "")
      : "";
    const jurisdictionDays = this.positiveInt(
      jurisdictionRaw ||
        (country
          ? process.env[`RECORDING_RETENTION_DAYS_${country}`]
          : undefined),
    );
    const defaultDays = this.positiveInt(
      await this.setting(
        "recording_retention_days_default",
        process.env.RECORDING_RETENTION_DEFAULT_DAYS ?? "90",
      ),
    );
    const retentionDays =
      explicitDays ?? planDays ?? jurisdictionDays ?? defaultDays ?? 90;
    const retainUntil =
      explicitUntil ??
      new Date(Date.now() + retentionDays * 24 * 60 * 60 * 1000);
    const policy =
      this.optionalString(file.retentionPolicy) ??
      (appt?.subscription?.plan.code
        ? `${appt.subscription.plan.code.toUpperCase()}_${retentionDays}_DAYS`
        : country
          ? `${country}_${retentionDays}_DAYS`
          : `STANDARD_${retentionDays}_DAYS`);

    return { retentionPolicy: policy, retentionDays, retainUntil };
  }

  private async assertRecordingConsentReady(appointmentId: string) {
    const consent = await prisma.appointmentRecordingConsent.findUnique({
      where: { appointmentId },
    });
    if (!consent || consent.status !== "CONSENTED") {
      throw new BadRequestException(
        "Recording requires consent from both parties",
      );
    }
  }

  private serializeRecordingAsset(asset: {
    id: string;
    appointmentId: string;
    provider: string;
    storageVendor: string;
    status: string;
    fileName: string;
    mimeType: string;
    sizeBytes: bigint | null;
    durationSeconds: number | null;
    encrypted: boolean;
    encryptionMethod: string;
    retentionPolicy: string;
    retentionDays: number;
    retainUntil: Date | null;
    archivedAt: Date | null;
    deletedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }) {
    return {
      id: asset.id,
      appointmentId: asset.appointmentId,
      provider: asset.provider,
      storageVendor: asset.storageVendor,
      status: asset.status,
      fileName: asset.fileName,
      mimeType: asset.mimeType,
      sizeBytes: asset.sizeBytes == null ? null : asset.sizeBytes.toString(),
      durationSeconds: asset.durationSeconds,
      encrypted: asset.encrypted,
      encryptionMethod: asset.encryptionMethod,
      retentionPolicy: asset.retentionPolicy,
      retentionDays: asset.retentionDays,
      retainUntil: asset.retainUntil,
      archivedAt: asset.archivedAt,
      deletedAt: asset.deletedAt,
      createdAt: asset.createdAt,
      updatedAt: asset.updatedAt,
    };
  }

  private serializeRecordingRequest(request: {
    id: string;
    appointmentId: string;
    assetId: string | null;
    type: string;
    status: string;
    requestedByRole: string;
    requestedById: string;
    reason: string;
    decisionById: string | null;
    decisionReason: string | null;
    decidedAt: Date | null;
    completedAt: Date | null;
    disputeHold: boolean;
    disputeHoldUntil: Date | null;
    disputeHoldReason: string | null;
    exportUrl: string | null;
    exportExpiresAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }) {
    return {
      id: request.id,
      appointmentId: request.appointmentId,
      assetId: request.assetId,
      type: request.type,
      status: request.status,
      requestedByRole: request.requestedByRole,
      requestedById: request.requestedById,
      reason: request.reason,
      decisionById: request.decisionById,
      decisionReason: request.decisionReason,
      decidedAt: request.decidedAt,
      completedAt: request.completedAt,
      disputeHold: request.disputeHold,
      disputeHoldUntil: request.disputeHoldUntil,
      disputeHoldReason: request.disputeHoldReason,
      exportUrl: request.exportUrl,
      exportExpiresAt: request.exportExpiresAt,
      createdAt: request.createdAt,
      updatedAt: request.updatedAt,
    };
  }

  private async recordingRequestAsset(
    appointmentId: string,
    assetId: string | null,
  ) {
    const asset = await prisma.appointmentRecordingAsset.findFirst({
      where: {
        appointmentId,
        status: { in: ["AVAILABLE", "ARCHIVED"] as never },
        ...(assetId ? { id: assetId } : {}),
      },
      orderBy: { createdAt: "desc" },
    });
    if (!asset)
      throw new NotFoundException("No exportable recording asset found");
    return asset;
  }

  private async deleteRecordingRequestAssets(
    appointmentId: string,
    assetId: string | null,
    deletedAt: Date,
  ) {
    const where = {
      appointmentId,
      status: { not: "DELETED" as never },
      ...(assetId ? { id: assetId } : {}),
    };
    const assets = await prisma.appointmentRecordingAsset.findMany({
      where,
      select: { id: true },
    });
    if (assets.length === 0)
      throw new NotFoundException("No recording assets found to delete");
    await prisma.appointmentRecordingAsset.updateMany({
      where: { id: { in: assets.map((asset) => asset.id) } },
      data: { status: "DELETED", deletedAt },
    });
  }

  private signedRecordingUrl(
    asset: {
      storageVendor: string;
      bucket: string | null;
      region: string | null;
      objectKey: string;
      providerUrl: string | null;
    },
    expiresInSeconds: number,
  ) {
    const vendor = asset.storageVendor.toLowerCase();
    if (vendor.includes("s3") || vendor.includes("aws")) {
      return this.signS3GetUrl(asset, expiresInSeconds);
    }
    if (
      process.env.RECORDING_ALLOW_PROVIDER_URL_ACCESS === "true" &&
      asset.providerUrl
    ) {
      return asset.providerUrl;
    }
    throw new InternalServerErrorException(
      "No private URL signer is configured for this recording storage provider",
    );
  }

  private signS3GetUrl(
    asset: { bucket: string | null; region: string | null; objectKey: string },
    expiresInSeconds: number,
  ) {
    const accessKey =
      process.env.RECORDING_S3_ACCESS_KEY_ID ?? process.env.AWS_ACCESS_KEY_ID;
    const secretKey =
      process.env.RECORDING_S3_SECRET_ACCESS_KEY ??
      process.env.AWS_SECRET_ACCESS_KEY;
    const bucket = asset.bucket ?? process.env.RECORDING_S3_BUCKET;
    const region =
      asset.region ??
      process.env.RECORDING_S3_REGION ??
      process.env.AWS_REGION ??
      "us-east-1";
    if (!accessKey || !secretKey || !bucket) {
      throw new InternalServerErrorException(
        "S3 recording URL signing is not configured",
      );
    }

    const now = new Date();
    const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
    const dateStamp = amzDate.slice(0, 8);
    const service = "s3";
    const host = `${bucket}.s3.${region}.amazonaws.com`;
    const encodedKey = asset.objectKey
      .split("/")
      .map(encodeURIComponent)
      .join("/");
    const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
    const query = new URLSearchParams({
      "X-Amz-Algorithm": "AWS4-HMAC-SHA256",
      "X-Amz-Credential": `${accessKey}/${credentialScope}`,
      "X-Amz-Date": amzDate,
      "X-Amz-Expires": String(Math.max(1, Math.min(expiresInSeconds, 3600))),
      "X-Amz-SignedHeaders": "host",
    });
    const canonicalRequest = [
      "GET",
      `/${encodedKey}`,
      query.toString(),
      `host:${host}`,
      "",
      "host",
      "UNSIGNED-PAYLOAD",
    ].join("\n");
    const stringToSign = [
      "AWS4-HMAC-SHA256",
      amzDate,
      credentialScope,
      crypto.createHash("sha256").update(canonicalRequest).digest("hex"),
    ].join("\n");
    const signature = crypto
      .createHmac(
        "sha256",
        this.awsSigningKey(secretKey, dateStamp, region, service),
      )
      .update(stringToSign)
      .digest("hex");
    query.set("X-Amz-Signature", signature);
    return `https://${host}/${encodedKey}?${query.toString()}`;
  }

  private awsSigningKey(
    secret: string,
    date: string,
    region: string,
    service: string,
  ) {
    const kDate = crypto
      .createHmac("sha256", `AWS4${secret}`)
      .update(date)
      .digest();
    const kRegion = crypto.createHmac("sha256", kDate).update(region).digest();
    const kService = crypto
      .createHmac("sha256", kRegion)
      .update(service)
      .digest();
    return crypto
      .createHmac("sha256", kService)
      .update("aws4_request")
      .digest();
  }

  private optionalString(value: unknown) {
    return typeof value === "string" && value.trim() ? value.trim() : undefined;
  }

  private optionalNumber(value: unknown) {
    const n =
      typeof value === "number"
        ? value
        : typeof value === "string"
          ? Number(value)
          : NaN;
    return Number.isFinite(n) ? n : undefined;
  }

  private positiveInt(value: unknown) {
    const n = this.optionalNumber(value);
    if (n == null) return undefined;
    const int = Math.floor(n);
    return int > 0 ? int : undefined;
  }

  private optionalDate(value: unknown) {
    if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
    if (typeof value !== "string" || !value.trim()) return undefined;
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? undefined : d;
  }

  private optionalBigInt(value: unknown) {
    const n = this.optionalNumber(value);
    return n == null ? undefined : BigInt(Math.max(0, Math.floor(n)));
  }

  private recordingRoomId(appointmentId: string) {
    return (
      appointmentId.replace(/[^A-Za-z0-9_]/g, "").slice(0, 100) ||
      "doctium-room"
    );
  }

  private serializeRecordingSession(
    appointmentId: string,
    session: Awaited<
      ReturnType<typeof prisma.appointmentRecordingSession.findUnique>
    >,
  ) {
    return {
      appointmentId,
      status: session?.status ?? "NOT_STARTED",
      provider: session?.provider ?? "ZEGO",
      roomId: session?.roomId ?? this.recordingRoomId(appointmentId),
      taskId: session?.taskId ?? null,
      startedAt: session?.startedAt ?? null,
      stoppedAt: session?.stoppedAt ?? null,
      outputPrefix: session?.outputPrefix ?? null,
      storageVendor: session?.storageVendor ?? null,
      lastError: session?.lastError ?? null,
    };
  }

  private zegoStorageConfig(): {
    vendor: string;
    params: Record<string, unknown>;
  } {
    if (process.env.ZEGO_CLOUD_RECORDING_ENABLED !== "true") {
      throw new InternalServerErrorException("Cloud recording is not enabled");
    }
    const raw = process.env.ZEGO_CLOUD_RECORDING_STORAGE_PARAMS;
    if (!raw) {
      throw new InternalServerErrorException(
        "ZEGO_CLOUD_RECORDING_STORAGE_PARAMS is not configured",
      );
    }
    try {
      const params = JSON.parse(raw) as Record<string, unknown>;
      const vendor = String(params.Vendor ?? params.vendor ?? "");
      return { vendor, params };
    } catch {
      throw new InternalServerErrorException(
        "ZEGO_CLOUD_RECORDING_STORAGE_PARAMS must be valid JSON",
      );
    }
  }

  private async zegoStartRecording(input: {
    roomId: string;
    outputPrefix: string;
    storageParams: Record<string, unknown>;
  }): Promise<{ taskId: string }> {
    const body = {
      RoomId: input.roomId,
      RecordInputParams: {
        RecordMode: Number(process.env.ZEGO_CLOUD_RECORDING_MODE ?? 1),
        StreamType: Number(process.env.ZEGO_CLOUD_RECORDING_STREAM_TYPE ?? 3),
        MaxIdleTime: Number(
          process.env.ZEGO_CLOUD_RECORDING_MAX_IDLE_SECONDS ?? 300,
        ),
      },
      RecordOutputParams: {
        OutputFileFormat: process.env.ZEGO_CLOUD_RECORDING_FORMAT ?? "mp4",
        OutputFolder: input.outputPrefix,
      },
      StorageParams: input.storageParams,
      ...this.optionalJsonEnv("ZEGO_CLOUD_RECORDING_START_PARAMS"),
    };
    const res = await this.zegoRecordingRequest("StartRecord", body);
    const taskId = String(
      (res.Data as Record<string, unknown> | undefined)?.TaskId ??
        (res.Data as Record<string, unknown> | undefined)?.task_id ??
        "",
    );
    if (!taskId) throw new Error("Zego StartRecord did not return a task id");
    return { taskId };
  }

  private async zegoStopRecording(taskId: string) {
    await this.zegoRecordingRequest("StopRecord", {
      TaskId: taskId,
      ...this.optionalJsonEnv("ZEGO_CLOUD_RECORDING_STOP_PARAMS"),
    });
  }

  private async zegoRecordingRequest(
    action: string,
    body: Record<string, unknown>,
  ) {
    const appId = process.env.ZEGO_APP_ID;
    const secret = process.env.ZEGO_SERVER_SECRET;
    if (!appId || !secret) {
      throw new InternalServerErrorException(
        "ZEGO_APP_ID and ZEGO_SERVER_SECRET are required",
      );
    }
    const baseUrl =
      process.env.ZEGO_CLOUD_RECORDING_BASE_URL ??
      "https://cloudrecord-api.zego.im";
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const nonce = crypto.randomBytes(8).toString("hex");
    const signature = crypto
      .createHash("md5")
      .update(appId + nonce + secret + timestamp)
      .digest("hex");
    const url = new URL(baseUrl);
    url.searchParams.set("Action", action);
    url.searchParams.set("AppId", appId);
    url.searchParams.set("SignatureNonce", nonce);
    url.searchParams.set("Timestamp", timestamp);
    url.searchParams.set("Signature", signature);
    url.searchParams.set("SignatureVersion", "2.0");
    url.searchParams.set(
      "IsTest",
      process.env.ZEGO_CLOUD_RECORDING_IS_TEST ?? "false",
    );

    const response = await fetch(url.toString(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = (await response.json().catch(() => ({}))) as {
      Code?: number;
      Message?: string;
      Data?: unknown;
    };
    if (!response.ok || (typeof json.Code === "number" && json.Code !== 0)) {
      throw new Error(
        json.Message || `Zego ${action} failed with HTTP ${response.status}`,
      );
    }
    return json;
  }

  private optionalJsonEnv(key: string): Record<string, unknown> {
    const raw = process.env[key];
    if (!raw) return {};
    try {
      return JSON.parse(raw) as Record<string, unknown>;
    } catch {
      throw new InternalServerErrorException(`${key} must be valid JSON`);
    }
  }

  private async getParticipantAppointment(
    appointmentId: string,
    requester: { sub: string; role: string },
  ) {
    const appt = await prisma.appointment.findUnique({
      where: { id: appointmentId },
    });
    if (!appt) throw new NotFoundException("Appointment not found");
    if (
      (requester.role === "user" && appt.userId !== requester.sub) ||
      (requester.role === "doctor" && appt.doctorId !== requester.sub)
    ) {
      throw new ForbiddenException("Not your appointment");
    }
    return appt;
  }

  private assertOnlineAppointment(type: string) {
    if (type !== "ONLINE") {
      throw new BadRequestException("Only video consultations can be recorded");
    }
  }

  private recordingActorRole(role: string): "USER" | "DOCTOR" | "ADMIN" {
    if (role === "user") return "USER";
    if (role === "doctor") return "DOCTOR";
    return "ADMIN";
  }

  private recordingPartyData(
    role: "USER" | "DOCTOR" | "ADMIN",
    consented: boolean,
    meta: ConsentMeta,
  ) {
    const now = new Date();
    if (role === "USER") {
      return consented
        ? {
            patientConsentedAt: now,
            patientDeclinedAt: null,
            patientConsentIp: meta.ip,
            patientUserAgent: meta.userAgent,
          }
        : { patientDeclinedAt: now };
    }
    return consented
      ? {
          doctorConsentedAt: now,
          doctorDeclinedAt: null,
          doctorConsentIp: meta.ip,
          doctorUserAgent: meta.userAgent,
        }
      : { doctorDeclinedAt: now };
  }

  private nextRecordingStatus(input: {
    patientConsentedAt?: Date | null;
    doctorConsentedAt?: Date | null;
    declined: boolean;
  }) {
    if (input.declined) return "DECLINED" as const;
    return input.patientConsentedAt && input.doctorConsentedAt
      ? ("CONSENTED" as const)
      : ("PENDING" as const);
  }

  private serializeRecordingConsent(
    appointmentId: string,
    consent: Awaited<
      ReturnType<typeof prisma.appointmentRecordingConsent.findUnique>
    >,
  ) {
    const patientConsented = !!consent?.patientConsentedAt;
    const doctorConsented = !!consent?.doctorConsentedAt;
    return {
      appointmentId,
      status: consent?.status ?? "NOT_REQUESTED",
      requestedByRole: consent?.requestedByRole ?? null,
      requestedById: consent?.requestedById ?? null,
      requestedAt: consent?.requestedAt ?? null,
      patientConsented,
      doctorConsented,
      bothConsented: patientConsented && doctorConsented,
      patientConsentedAt: consent?.patientConsentedAt ?? null,
      doctorConsentedAt: consent?.doctorConsentedAt ?? null,
      patientDeclinedAt: consent?.patientDeclinedAt ?? null,
      doctorDeclinedAt: consent?.doctorDeclinedAt ?? null,
      revokedAt: consent?.revokedAt ?? null,
    };
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
