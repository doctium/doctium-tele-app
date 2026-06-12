import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { prisma } from "@doctium/database";
import { NotificationsService } from "../notifications/notifications.service";

/**
 * Fires 30-minute and 5-minute "appointment starting soon" reminders to the patient and the doctor.
 * Runs every minute; each reminder is sent once (tracked by `reminded30`/`reminded5`). Delivered as a
 * push (sound + persists in the shade) + an in-app notification row — no email (reminders shouldn't spam).
 */
@Injectable()
export class AppointmentRemindersService {
  private readonly logger = new Logger("AppointmentReminders");

  constructor(private readonly notifications: NotificationsService) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async runCron() {
    try {
      await this.sendDueReminders();
    } catch (e) {
      this.logger.warn(`reminder pass failed: ${(e as Error).message}`);
    }
  }

  /** Business timezone offset in minutes (Africa/Lagos +60 by default; override with APP_TIMEZONE_OFFSET="+01:00"). */
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

  /** One reminder pass. Returns counts; also used by the admin manual trigger. */
  async sendDueReminders(): Promise<{
    scanned: number;
    remind30: number;
    remind5: number;
  }> {
    const off = this.offsetMinutes();
    const sign = off < 0 ? "-" : "+";
    const offStr = `${sign}${String(Math.floor(Math.abs(off) / 60)).padStart(2, "0")}:${String(Math.abs(off) % 60).padStart(2, "0")}`;
    const now = Date.now();
    const localNow = new Date(now + off * 60000);
    const todayStr = localNow.toISOString().slice(0, 10);
    const tomorrowStr = new Date(localNow.getTime() + 86400000)
      .toISOString()
      .slice(0, 10);

    const candidates = await prisma.appointment.findMany({
      where: {
        status: "CONFIRMED",
        mode: "SCHEDULED",
        date: { in: [todayStr, tomorrowStr] },
        OR: [{ reminded30: false }, { reminded5: false }],
      },
      select: {
        id: true,
        date: true,
        time: true,
        userId: true,
        doctorId: true,
        reminded30: true,
        reminded5: true,
        user: { select: { name: true } },
        doctor: { select: { name: true } },
        subPatient: { select: { name: true } },
      },
    });

    let remind30 = 0;
    let remind5 = 0;
    for (const a of candidates) {
      const start = new Date(`${a.date}T${a.time}:00${offStr}`).getTime();
      if (Number.isNaN(start)) continue;
      const mins = (start - now) / 60000;

      if (!a.reminded30 && mins <= 33 && mins >= 24) {
        await this.fire(a, 30);
        remind30++;
      } else if (!a.reminded5 && mins <= 6 && mins >= 0.5) {
        await this.fire(a, 5);
        remind5++;
      }
    }
    if (remind30 || remind5)
      this.logger.log(`reminders — 30min: ${remind30}, 5min: ${remind5}`);
    return { scanned: candidates.length, remind30, remind5 };
  }

  private async fire(
    a: {
      id: string;
      userId: string;
      doctorId: string;
      user: { name: string } | null;
      doctor: { name: string } | null;
      subPatient: { name: string } | null;
    },
    minutes: 30 | 5,
  ) {
    // Mark first so an overlapping pass can't double-send.
    await prisma.appointment.update({
      where: { id: a.id },
      data: minutes === 30 ? { reminded30: true } : { reminded5: true },
    });

    const doctorName = a.doctor?.name ? `Dr. ${a.doctor.name}` : "your doctor";
    const patientName = a.subPatient?.name || a.user?.name || "your patient";
    const title = `Appointment in ${minutes} minutes`;

    await this.notifications
      .notifyUser(
        a.userId,
        {
          key: "appointment.reminder",
          params: { minutes, doctor: doctorName },
          type: "appointment_reminder",
        },
        { email: false },
      )
      .catch(() => {});
    await this.notifications
      .notifyDoctor(
        a.doctorId,
        {
          title,
          message: `Your appointment with ${patientName} starts in ${minutes} minutes.`,
          type: "appointment_reminder",
        },
        { email: false },
      )
      .catch(() => {});
  }
}
