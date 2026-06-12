import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { prisma } from "@doctium/database";
import { NotificationsService } from "../notifications/notifications.service";

const MAX_COMMISSION_PCT = 50;
const clampPct = (n: unknown) =>
  Math.min(MAX_COMMISSION_PCT, Math.max(0, Number(n) || 0));

const PARTY = {
  referringDoctor: {
    select: { id: true, name: true, image: true, designation: true },
  },
  specialist: {
    select: {
      id: true,
      name: true,
      image: true,
      designation: true,
      clinicName: true,
    },
  },
  user: { select: { id: true, name: true, image: true } },
} as const;

@Injectable()
export class ReferralsService {
  private readonly logger = new Logger("Referrals");
  constructor(private readonly notifications: NotificationsService) {}

  /** Expire stale referrals that were never actioned. Runs hourly. */
  @Cron(CronExpression.EVERY_HOUR)
  async expireOverdue(): Promise<number> {
    const res = await prisma.referral.updateMany({
      where: {
        status: { in: ["PENDING", "ACCEPTED"] },
        expiresAt: { lt: new Date() },
      },
      data: { status: "EXPIRED" },
    });
    if (res.count) this.logger.log(`expired ${res.count} stale referral(s)`);
    return res.count;
  }

  // ─── Specialist directory (referral target picker) ───────
  listSpecialists(excludeDoctorId: string, specialty?: string) {
    return prisma.doctor.findMany({
      where: {
        id: { not: excludeDoctorId },
        isDelete: false,
        isBlock: false,
        verificationStatus: "VERIFIED",
        ...(specialty
          ? {
              designation: {
                contains: specialty,
                mode: "insensitive" as const,
              },
            }
          : {}),
      },
      select: {
        id: true,
        name: true,
        image: true,
        designation: true,
        clinicName: true,
      },
      orderBy: { name: "asc" },
      take: 50,
    });
  }

  /** Pull the patient's live EMR + the source consult's SOAP into a hand-off summary. */
  private async buildClinicalSummary(
    userId: string,
    subPatientId: string | null,
    sourceAppointmentId?: string | null,
  ): Promise<string> {
    const [allergies, conditions, note] = await Promise.all([
      prisma.allergy.findMany({
        where: { userId, subPatientId },
        select: { substance: true, severity: true },
      }),
      prisma.medicalCondition.findMany({
        where: { userId, subPatientId, status: "ACTIVE" },
        select: { name: true },
      }),
      sourceAppointmentId
        ? prisma.clinicalNote.findUnique({
            where: { appointmentId: sourceAppointmentId },
            select: {
              assessment: true,
              plan: true,
              bloodPressure: true,
              heartRate: true,
              temperature: true,
            },
          })
        : null,
    ]);
    const parts: string[] = [];
    if (allergies.length)
      parts.push(
        `Allergies: ${allergies.map((a) => `${a.substance} (${a.severity.toLowerCase()})`).join(", ")}.`,
      );
    if (conditions.length)
      parts.push(
        `Active conditions: ${conditions.map((c) => c.name).join(", ")}.`,
      );
    if (note?.assessment) parts.push(`Assessment: ${note.assessment}.`);
    if (note?.plan) parts.push(`Plan so far: ${note.plan}.`);
    const vitals = [
      note?.bloodPressure && `BP ${note.bloodPressure}`,
      note?.heartRate && `HR ${note.heartRate}`,
      note?.temperature && `Temp ${note.temperature}°C`,
    ].filter(Boolean);
    if (vitals.length) parts.push(`Recent vitals: ${vitals.join(", ")}.`);
    return parts.join(" ");
  }

  // ─── Create ──────────────────────────────────────────────
  async create(referringDoctorId: string, dto: Record<string, unknown>) {
    const sourceAppointmentId = String(dto.sourceAppointmentId ?? "");
    const specialistId = String(dto.specialistId ?? "");
    if (!sourceAppointmentId || !specialistId) {
      throw new BadRequestException(
        "A source consultation and a specialist are required.",
      );
    }
    if (specialistId === referringDoctorId) {
      throw new BadRequestException("You can't refer a patient to yourself.");
    }

    const appt = await prisma.appointment.findUnique({
      where: { id: sourceAppointmentId },
      select: { id: true, doctorId: true, userId: true, subPatientId: true },
    });
    if (!appt) throw new NotFoundException("Source appointment not found");
    if (appt.doctorId !== referringDoctorId) {
      throw new ForbiddenException(
        "You can only refer from your own consultations.",
      );
    }

    const specialist = await prisma.doctor.findUnique({
      where: { id: specialistId },
      select: {
        id: true,
        name: true,
        designation: true,
        verificationStatus: true,
        isBlock: true,
      },
    });
    if (
      !specialist ||
      specialist.isBlock ||
      specialist.verificationStatus !== "VERIFIED"
    ) {
      throw new BadRequestException(
        "That specialist isn't available for referrals.",
      );
    }

    const clinicalSummary = await this.buildClinicalSummary(
      appt.userId,
      appt.subPatientId,
      sourceAppointmentId,
    );
    const referring = await prisma.doctor.findUnique({
      where: { id: referringDoctorId },
      select: { name: true },
    });

    const referral = await prisma.referral.create({
      data: {
        referringDoctorId,
        specialistId,
        userId: appt.userId,
        subPatientId: appt.subPatientId,
        sourceAppointmentId,
        specialty: specialist.designation || "",
        reason: String(dto.reason ?? "").trim(),
        diagnosis: String(dto.diagnosis ?? "").trim(),
        clinicalSummary,
        urgency: dto.urgency === "URGENT" ? "URGENT" : "ROUTINE",
        expiresAt: new Date(Date.now() + 30 * 24 * 3600_000),
      },
      include: PARTY,
    });

    const drRef = referring?.name ? `Dr. ${referring.name}` : "Your doctor";
    const spec = `Dr. ${specialist.name}${specialist.designation ? ` (${specialist.designation})` : ""}`;
    // Notify the patient — this is the "book directly" prompt.
    this.notifications
      .notifyUser(appt.userId, {
        key: "referral.received",
        params: { doctor: drRef, specialty: spec },
        type: "referral_received",
      })
      .catch(() => {});
    // Notify the specialist — incoming referral inbox.
    this.notifications
      .notifyDoctor(specialistId, {
        title:
          referral.urgency === "URGENT"
            ? "Urgent referral received"
            : "New referral received",
        message: `${drRef} referred a patient to you${referral.reason ? `: ${referral.reason}` : "."}`,
        type: "referral_incoming",
      })
      .catch(() => {});

    return referral;
  }

  // ─── Lists ───────────────────────────────────────────────
  getSent(doctorId: string) {
    return prisma.referral.findMany({
      where: { referringDoctorId: doctorId },
      include: PARTY,
      orderBy: { createdAt: "desc" },
    });
  }

  getReceived(specialistId: string) {
    return prisma.referral.findMany({
      where: { specialistId },
      include: PARTY,
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    });
  }

  getMine(userId: string) {
    return prisma.referral.findMany({
      where: { userId },
      include: PARTY,
      orderBy: { createdAt: "desc" },
    });
  }

  async getOne(id: string, requester: { sub: string; role: string }) {
    const referral = await prisma.referral.findUnique({
      where: { id },
      include: PARTY,
    });
    if (!referral) throw new NotFoundException("Referral not found");
    const allowed =
      requester.role === "admin" ||
      requester.sub === referral.referringDoctorId ||
      requester.sub === referral.specialistId ||
      requester.sub === referral.userId;
    if (!allowed)
      throw new ForbiddenException("Not allowed to view this referral");
    return referral;
  }

  // ─── Specialist response ─────────────────────────────────
  async respond(
    specialistId: string,
    id: string,
    accept: boolean,
    reason?: string,
    commissionPct?: number,
  ) {
    const referral = await prisma.referral.findUnique({ where: { id } });
    if (!referral) throw new NotFoundException("Referral not found");
    if (referral.specialistId !== specialistId)
      throw new ForbiddenException("Not your referral");
    if (referral.status !== "PENDING") {
      throw new BadRequestException("This referral has already been actioned.");
    }
    const updated = await prisma.referral.update({
      where: { id },
      data: accept
        ? {
            status: "ACCEPTED",
            acceptedAt: new Date(),
            ...(commissionPct !== undefined
              ? { commissionPct: clampPct(commissionPct) }
              : {}),
          }
        : { status: "DECLINED", declineReason: reason?.slice(0, 300) ?? "" },
      include: PARTY,
    });
    const specName = `Dr. ${updated.specialist.name}`;
    this.notifications
      .notifyDoctor(referral.referringDoctorId, {
        title: accept ? "Referral accepted" : "Referral declined",
        message: accept
          ? `${specName} accepted your referral for ${updated.user.name}.`
          : `${specName} declined your referral${reason ? `: ${reason}` : "."}`,
        type: accept ? "referral_accepted" : "referral_declined",
      })
      .catch(() => {});
    if (accept) {
      this.notifications
        .notifyUser(referral.userId, {
          key: "referral.accepted",
          params: { doctor: specName },
          type: "referral_accepted",
        })
        .catch(() => {});
    }
    return updated;
  }

  async cancel(doctorId: string, id: string) {
    const referral = await prisma.referral.findUnique({ where: { id } });
    if (!referral) throw new NotFoundException("Referral not found");
    if (referral.referringDoctorId !== doctorId)
      throw new ForbiddenException("Not your referral");
    if (!["PENDING", "ACCEPTED"].includes(referral.status)) {
      throw new BadRequestException(
        "Can't cancel a referral that's already been booked.",
      );
    }
    return prisma.referral.update({
      where: { id },
      data: { status: "CANCELLED" },
    });
  }

  /** Specialist offers/updates a referral commission (% of their own earning) before the consult completes. */
  async setCommission(specialistId: string, id: string, pct: number) {
    const referral = await prisma.referral.findUnique({ where: { id } });
    if (!referral) throw new NotFoundException("Referral not found");
    if (referral.specialistId !== specialistId)
      throw new ForbiddenException(
        "Only the specialist can set the commission.",
      );
    if (referral.commissionPaidAt || referral.status === "COMPLETED") {
      throw new BadRequestException(
        "This referral has already been settled — the commission can't change.",
      );
    }
    return prisma.referral.update({
      where: { id },
      data: { commissionPct: clampPct(pct) },
      include: PARTY,
    });
  }

  // ─── Analytics ───────────────────────────────────────────
  async sentStats(doctorId: string) {
    const grouped = await prisma.referral.groupBy({
      by: ["status"],
      where: { referringDoctorId: doctorId },
      _count: true,
    });
    const by: Record<string, number> = {};
    let total = 0;
    for (const g of grouped) {
      by[g.status] = g._count;
      total += g._count;
    }
    const converted = (by.BOOKED ?? 0) + (by.COMPLETED ?? 0);
    return {
      total,
      pending: by.PENDING ?? 0,
      accepted: by.ACCEPTED ?? 0,
      declined: by.DECLINED ?? 0,
      booked: by.BOOKED ?? 0,
      completed: by.COMPLETED ?? 0,
      conversionRate: total ? Math.round((converted / total) * 100) : 0,
    };
  }

  // ─── Admin oversight ─────────────────────────────────────
  async adminList(status?: string, page = 1, limit = 20) {
    const where = status && status !== "ALL" ? { status: status as never } : {};
    const [items, total] = await Promise.all([
      prisma.referral.findMany({
        where,
        include: PARTY,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.referral.count({ where }),
    ]);
    return { items, total, page, limit };
  }

  async adminFunnel() {
    const grouped = await prisma.referral.groupBy({
      by: ["status"],
      _count: true,
    });
    const by: Record<string, number> = {};
    let total = 0;
    for (const g of grouped) {
      by[g.status] = g._count;
      total += g._count;
    }
    const converted = (by.BOOKED ?? 0) + (by.COMPLETED ?? 0);
    return {
      total,
      ...by,
      conversionRate: total ? Math.round((converted / total) * 100) : 0,
    };
  }
}
