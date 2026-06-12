import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { prisma } from "@doctium/database";
import { NotificationsService } from "../notifications/notifications.service";

/** FollowUp.type → notification catalog key (rendered in the patient's language at send time). */
const FOLLOWUP_KEY: Record<string, string> = {
  CHECK_IN_48H: "followup.checkin48h",
  CHECK_IN_7D: "followup.checkin7d",
  DOCTOR_SCHEDULED: "followup.doctorScheduled",
  MISSED_RECOVERY: "followup.missedRecovery",
};

/**
 * Post-consultation follow-up automation — the no-show / re-engagement engine.
 *  • Auto check-ins ("how are you feeling?") at 48h and 7d after a completed consult.
 *  • Doctor-initiated recall ("come back in 2 weeks").
 *  • Missed-appointment recovery: detect no-shows and nudge a rebooking.
 * A single per-minute cron fires anything that's due and detects fresh no-shows.
 */
@Injectable()
export class FollowUpsService {
  private readonly logger = new Logger("FollowUps");

  constructor(private readonly notifications: NotificationsService) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async runCron() {
    try {
      await this.detectNoShows();
      await this.processDue();
    } catch (e) {
      this.logger.warn(`follow-up pass failed: ${(e as Error).message}`);
    }
  }

  /** Business timezone offset in minutes (mirror of the reminders service). */
  private offsetMinutes(): number {
    const m = /^([+-])(\d{2}):(\d{2})$/.exec(
      (process.env.APP_TIMEZONE_OFFSET || "+01:00").trim(),
    );
    if (!m) return 60;
    return (
      (m[1] === "-" ? -1 : 1) *
      (parseInt(m[2] ?? "0", 10) * 60 + parseInt(m[3] ?? "0", 10))
    );
  }

  // ─── Scheduling ──────────────────────────────────────────
  /** Queue the 48h + 7d wellbeing check-ins when a consult is completed (once per appointment). */
  async scheduleConsultFollowUps(appt: {
    id: string;
    userId: string;
    doctorId: string;
    subPatientId: string | null;
    followUpsScheduled: boolean;
  }) {
    if (appt.followUpsScheduled) return;
    const doctor = await prisma.doctor.findUnique({
      where: { id: appt.doctorId },
      select: { name: true },
    });
    const dr = doctor?.name ? `Dr. ${doctor.name}` : "your doctor";
    const now = Date.now();
    await prisma.followUp.createMany({
      data: [
        {
          appointmentId: appt.id,
          userId: appt.userId,
          doctorId: appt.doctorId,
          subPatientId: appt.subPatientId,
          type: "CHECK_IN_48H",
          scheduledFor: new Date(now + 48 * 3600_000),
          title: "How are you feeling?",
          message: `It's been a couple of days since your consult with ${dr}. How are you feeling? Tap to book a follow-up if you need one.`,
        },
        {
          appointmentId: appt.id,
          userId: appt.userId,
          doctorId: appt.doctorId,
          subPatientId: appt.subPatientId,
          type: "CHECK_IN_7D",
          scheduledFor: new Date(now + 7 * 24 * 3600_000),
          title: "Checking in on your recovery",
          message: `A week on from your consult with ${dr} — we hope you're better. Still have symptoms? Book a follow-up any time.`,
        },
      ],
    });
    await prisma.appointment.update({
      where: { id: appt.id },
      data: { followUpsScheduled: true },
    });
    this.logger.log(`queued 48h + 7d check-ins for appointment ${appt.id}`);
  }

  /** Doctor recall: "come back in N days". */
  async scheduleDoctorFollowUp(
    doctorId: string,
    appointmentId: string,
    inDays: number,
    note: string,
  ) {
    const appt = await prisma.appointment.findUnique({
      where: { id: appointmentId },
      select: { id: true, doctorId: true, userId: true, subPatientId: true },
    });
    if (!appt) throw new NotFoundException("Appointment not found");
    if (appt.doctorId !== doctorId)
      throw new ForbiddenException("Not your appointment");

    const days = Math.max(1, Math.min(365, Math.round(inDays)));
    const doctor = await prisma.doctor.findUnique({
      where: { id: doctorId },
      select: { name: true },
    });
    const dr = doctor?.name ? `Dr. ${doctor.name}` : "Your doctor";
    return prisma.followUp.create({
      data: {
        appointmentId: appt.id,
        userId: appt.userId,
        doctorId,
        subPatientId: appt.subPatientId,
        type: "DOCTOR_SCHEDULED",
        scheduledFor: new Date(Date.now() + days * 24 * 3600_000),
        title: "Time for your follow-up",
        message: `${dr} asked you to come back in for a follow-up${note ? `: ${note}` : "."}. Tap to book your appointment.`,
        doctorNote: note?.slice(0, 300) ?? "",
        sms: true,
      },
    });
  }

  // ─── No-show detection ───────────────────────────────────
  /** Flag scheduled consults whose start has well passed without check-in/completion, and queue recovery. */
  async detectNoShows(): Promise<number> {
    const off = this.offsetMinutes();
    const sign = off < 0 ? "-" : "+";
    const offStr = `${sign}${String(Math.floor(Math.abs(off) / 60)).padStart(2, "0")}:${String(Math.abs(off) % 60).padStart(2, "0")}`;
    const now = Date.now();
    const localNow = new Date(now + off * 60000);
    const todayStr = localNow.toISOString().slice(0, 10);
    const yesterdayStr = new Date(localNow.getTime() - 86400000)
      .toISOString()
      .slice(0, 10);

    const candidates = await prisma.appointment.findMany({
      where: {
        status: "CONFIRMED",
        mode: "SCHEDULED",
        noShowAt: null,
        checkInTime: null,
        date: { in: [todayStr, yesterdayStr] },
      },
      select: {
        id: true,
        date: true,
        time: true,
        duration: true,
        userId: true,
        doctorId: true,
        subPatientId: true,
        doctor: { select: { name: true } },
      },
    });

    let recovered = 0;
    for (const a of candidates) {
      const start = new Date(`${a.date}T${a.time}:00${offStr}`).getTime();
      if (Number.isNaN(start)) continue;
      const graceEnd = start + (a.duration || 30) * 60000 + 30 * 60000; // +30min grace
      if (now < graceEnd) continue;

      await prisma.appointment.update({
        where: { id: a.id },
        data: { noShowAt: new Date() },
      });
      const dr = a.doctor?.name ? `Dr. ${a.doctor.name}` : "your doctor";
      await prisma.followUp.create({
        data: {
          appointmentId: a.id,
          userId: a.userId,
          doctorId: a.doctorId,
          subPatientId: a.subPatientId,
          type: "MISSED_RECOVERY",
          scheduledFor: new Date(), // fire on the next processDue tick
          title: "We missed you",
          message: `Looks like you missed your appointment with ${dr}. No worries — tap to rebook at a time that works for you.`,
          sms: true,
        },
      });
      recovered++;
    }
    if (recovered)
      this.logger.log(`no-shows detected + recovery queued: ${recovered}`);
    return recovered;
  }

  // ─── Delivery ────────────────────────────────────────────
  /** Send every PENDING follow-up whose time has come (mark-first so an overlapping pass can't double-send). */
  async processDue(): Promise<{ sent: number }> {
    const due = await prisma.followUp.findMany({
      where: { status: "PENDING", scheduledFor: { lte: new Date() } },
      include: { doctor: { select: { name: true } } },
      take: 200,
    });
    let sent = 0;
    for (const f of due) {
      const claimed = await prisma.followUp.updateMany({
        where: { id: f.id, status: "PENDING" },
        data: { status: "SENT", sentAt: new Date() },
      });
      if (claimed.count === 0) continue; // already taken by another pass

      const type = `followup_${f.type.toLowerCase()}`;
      const key = FOLLOWUP_KEY[f.type];
      const dr = f.doctor?.name ? `Dr. ${f.doctor.name}` : "your doctor";
      await this.notifications
        .notifyUser(
          f.userId,
          // Render in the patient's language when the type is known; otherwise
          // fall back to the strings stored on the row.
          key
            ? {
                key,
                params: {
                  doctor: dr,
                  note: f.doctorNote ? `: ${f.doctorNote}` : "",
                },
                type,
              }
            : { title: f.title, message: f.message, type },
          { sms: f.sms },
        )
        .catch(() => {});
      sent++;
    }
    if (sent) this.logger.log(`follow-ups delivered: ${sent}`);
    return { sent };
  }

  /** Manual trigger for the admin panel (mirrors run-appointment-reminders). */
  async runAllManual() {
    const recovered = await this.detectNoShows();
    const { sent } = await this.processDue();
    return { noShowsDetected: recovered, delivered: sent };
  }

  // ─── Queries / mutations ─────────────────────────────────
  getMine(userId: string) {
    return prisma.followUp.findMany({
      where: { userId },
      include: {
        doctor: { select: { name: true, image: true, designation: true } },
      },
      orderBy: { scheduledFor: "desc" },
      take: 50,
    });
  }

  async cancel(id: string, requester: { sub: string; role: string }) {
    const f = await prisma.followUp.findUnique({ where: { id } });
    if (!f) throw new NotFoundException("Follow-up not found");
    const allowed =
      requester.role === "admin" ||
      requester.sub === f.userId ||
      requester.sub === f.doctorId;
    if (!allowed) throw new ForbiddenException("Not allowed");
    if (f.status !== "PENDING") return f;
    return prisma.followUp.update({
      where: { id },
      data: { status: "CANCELLED" },
    });
  }
}
