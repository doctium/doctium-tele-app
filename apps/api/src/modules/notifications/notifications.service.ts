import { Injectable } from "@nestjs/common";
import { prisma } from "@doctium/database";
import { FirebaseProvider } from "./channels/firebase.provider";
import {
  MailerProvider,
  type EmailAttachment,
} from "./channels/mailer.provider";
import { SmsProvider } from "./channels/sms.provider";
import { translateNotification } from "./notification-i18n";

interface Channels {
  push?: boolean;
  email?: boolean;
  sms?: boolean;
}

/**
 * Notification payload. Pass a localised `key` (+ optional `params`) and the
 * recipient's `preferredLanguage` is resolved and the title/message rendered from
 * the catalog; or pass an explicit English `title`/`message` (legacy / doctor).
 */
export interface NotifyInput {
  title?: string;
  message?: string;
  key?: string;
  params?: Record<string, string | number>;
  type: string;
  stateType?: number;
}

@Injectable()
export class NotificationsService {
  constructor(
    private readonly firebase: FirebaseProvider,
    private readonly mailer: MailerProvider,
    private readonly sms: SmsProvider,
  ) {}

  getForUser(userId: string) {
    return prisma.notification.findMany({
      where: { userId, recipient: "USER" },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
  }

  getForDoctor(doctorId: string) {
    return prisma.notification.findMany({
      where: { doctorId, recipient: "DOCTOR" },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
  }

  /**
   * Resolve a payload to a concrete title/message. When a catalog `key` is given,
   * the strings are rendered in `locale` (falling back to English); otherwise the
   * explicit title/message are used verbatim.
   */
  private resolveStrings(
    data: NotifyInput,
    locale?: string | null,
  ): { title: string; message: string } {
    if (data.key) return translateNotification(locale, data.key, data.params);
    return { title: data.title ?? "", message: data.message ?? "" };
  }

  async sendToUser(userId: string, data: NotifyInput) {
    let locale: string | null | undefined;
    if (data.key) {
      const u = await prisma.user.findUnique({
        where: { id: userId },
        select: { preferredLanguage: true },
      });
      locale = u?.preferredLanguage;
    }
    const { title, message } = this.resolveStrings(data, locale);
    return prisma.notification.create({
      data: {
        userId,
        recipient: "USER",
        date: new Date().toISOString().split("T")[0],
        title,
        message,
        type: data.type,
        stateType: data.stateType,
      },
    });
  }

  async sendToDoctor(
    doctorId: string,
    data: { title: string; message: string; type: string; stateType?: number },
  ) {
    return prisma.notification.create({
      data: {
        doctorId,
        recipient: "DOCTOR",
        date: new Date().toISOString().split("T")[0],
        ...data,
      },
    });
  }

  /**
   * Multi-channel doctor notification: always records an in-app row, then fans out to push / email /
   * SMS. Each channel no-ops if its credentials aren't configured. Push + email default on; SMS is
   * opt-in per call (it has a per-message cost).
   */
  async notifyDoctor(
    doctorId: string,
    data: { title: string; message: string; type: string; stateType?: number },
    channels: Channels = {},
  ) {
    const row = await this.sendToDoctor(doctorId, data);
    const doctor = await prisma.doctor.findUnique({
      where: { id: doctorId },
      select: {
        name: true,
        email: true,
        mobile: true,
        fcmToken: true,
        webFcmToken: true,
      },
    });
    if (!doctor) return row;

    if (channels.push !== false) {
      await this.firebase.sendPush(
        [doctor.fcmToken, doctor.webFcmToken],
        data.title,
        data.message,
        { type: data.type },
      );
    }
    if (channels.email !== false && doctor.email) {
      await this.mailer.sendEmail(
        doctor.email,
        data.title,
        this.emailHtml(doctor.name || "Doctor", data.title, data.message),
      );
    }
    if (channels.sms === true && doctor.mobile) {
      await this.sms.sendSms(doctor.mobile, `${data.title} — ${data.message}`);
    }
    return row;
  }

  /**
   * Multi-channel patient notification: in-app row + push + email (SMS opt-in).
   * Renders the title/message in the patient's `preferredLanguage` when the payload
   * carries a catalog `key`. One user lookup serves both translation and fan-out.
   */
  async notifyUser(userId: string, data: NotifyInput, channels: Channels = {}) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        name: true,
        email: true,
        mobile: true,
        fcmToken: true,
        webFcmToken: true,
        preferredLanguage: true,
      },
    });
    const { title, message } = this.resolveStrings(
      data,
      user?.preferredLanguage,
    );
    const row = await prisma.notification.create({
      data: {
        userId,
        recipient: "USER",
        date: new Date().toISOString().split("T")[0],
        title,
        message,
        type: data.type,
        stateType: data.stateType,
      },
    });
    if (!user) return row;

    if (channels.push !== false) {
      await this.firebase.sendPush(
        [user.fcmToken, user.webFcmToken],
        title,
        message,
        { type: data.type },
      );
    }
    if (channels.email !== false && user.email) {
      await this.mailer.sendEmail(
        user.email,
        title,
        this.broadcastEmailHtml(title, message),
      );
    }
    if (channels.sms === true && user.mobile) {
      await this.sms.sendSms(user.mobile, `${title} — ${message}`);
    }
    return row;
  }

  /**
   * Broadcast an in-app notification (+ FCM push) to a whole audience. Records a Notification row
   * per recipient (so it appears in their in-app list immediately, no FCM needed) and fans out a
   * push to everyone with a token (no-op without FIREBASE_* creds). Returns the dispatch counts.
   */
  async broadcast(opts: {
    audience: "PATIENTS" | "DOCTORS" | "ALL";
    title: string;
    message: string;
    type?: string;
    image?: string | null;
  }): Promise<{ userCount: number; doctorCount: number; sent: number }> {
    const date = new Date().toISOString().split("T")[0];
    const type = opts.type || "broadcast";
    const image = opts.image ?? null;
    let userCount = 0;
    let doctorCount = 0;
    let sent = 0;

    if (opts.audience === "PATIENTS" || opts.audience === "ALL") {
      const users = await prisma.user.findMany({
        where: { isBlock: false, isDelete: false },
        select: { id: true, fcmToken: true },
      });
      userCount = users.length;
      if (users.length) {
        await prisma.notification.createMany({
          data: users.map((u) => ({
            userId: u.id,
            recipient: "USER" as const,
            title: opts.title,
            message: opts.message,
            type,
            image,
            date,
          })),
        });
        const r = await this.firebase.sendPush(
          users.map((u) => u.fcmToken),
          opts.title,
          opts.message,
          { type },
          image ?? undefined,
        );
        sent += r.sent;
      }
    }

    if (opts.audience === "DOCTORS" || opts.audience === "ALL") {
      const docs = await prisma.doctor.findMany({
        where: { isBlock: false, isDelete: false },
        select: { id: true, fcmToken: true },
      });
      doctorCount = docs.length;
      if (docs.length) {
        await prisma.notification.createMany({
          data: docs.map((d) => ({
            doctorId: d.id,
            recipient: "DOCTOR" as const,
            title: opts.title,
            message: opts.message,
            type,
            image,
            date,
          })),
        });
        const r = await this.firebase.sendPush(
          docs.map((d) => d.fcmToken),
          opts.title,
          opts.message,
          { type },
          image ?? undefined,
        );
        sent += r.sent;
      }
    }

    return { userCount, doctorCount, sent };
  }

  /** Counts for the admin compose UI (audience sizes + how many have a push token). */
  async audienceCounts() {
    const [users, usersPush, doctors, doctorsPush] = await Promise.all([
      prisma.user.count({ where: { isBlock: false, isDelete: false } }),
      prisma.user.count({
        where: { isBlock: false, isDelete: false, NOT: { fcmToken: null } },
      }),
      prisma.doctor.count({ where: { isBlock: false, isDelete: false } }),
      prisma.doctor.count({
        where: { isBlock: false, isDelete: false, NOT: { fcmToken: null } },
      }),
    ]);
    return { users, usersPush, doctors, doctorsPush };
  }

  /** Bulk email to a resolved recipient list (no-op without SMTP creds). Returns attempted/sent counts. */
  async broadcastEmail(
    recipients: { email?: string | null }[],
    subject: string,
    body: string,
    attachments?: EmailAttachment[],
  ): Promise<{ recipientCount: number; sent: number }> {
    const valid = recipients.filter((r) => r.email);
    const recipientCount = valid.length;
    if (!this.mailer.isConfigured() || recipientCount === 0)
      return { recipientCount, sent: 0 };
    const html = this.broadcastEmailHtml(subject, body);
    let sent = 0;
    for (let i = 0; i < valid.length; i += 20) {
      const batch = valid.slice(i, i + 20);
      await Promise.all(
        batch.map((r) =>
          this.mailer
            .sendEmail(r.email as string, subject, html, attachments)
            .then(() => {
              sent += 1;
            })
            .catch(() => {}),
        ),
      );
    }
    return { recipientCount, sent };
  }

  /** Bulk SMS to a resolved recipient list (no-op without Termii creds). Returns attempted/sent counts. */
  async broadcastSms(
    recipients: { mobile?: string | null }[],
    message: string,
  ): Promise<{ recipientCount: number; sent: number }> {
    const valid = recipients.filter((r) => r.mobile);
    const recipientCount = valid.length;
    if (!this.sms.isConfigured() || recipientCount === 0)
      return { recipientCount, sent: 0 };
    let sent = 0;
    for (let i = 0; i < valid.length; i += 20) {
      const batch = valid.slice(i, i + 20);
      await Promise.all(
        batch.map((r) =>
          this.sms
            .sendSms(r.mobile as string, message)
            .then(() => {
              sent += 1;
            })
            .catch(() => {}),
        ),
      );
    }
    return { recipientCount, sent };
  }

  private broadcastEmailHtml(subject: string, body: string): string {
    // The admin composer sends rich HTML; legacy/plain bodies still get
    // newline → <br/> so they don't collapse to one line.
    const isHtml = /<[a-z][\s\S]*>/i.test(body);
    const content = isHtml ? body : body.replace(/\n/g, "<br/>");
    return `<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#0F1B2D">
      <h2 style="color:#133157;margin:0 0 12px">${subject}</h2>
      <div style="color:#5A6B82;line-height:1.6;font-size:15px">${content}</div>
      <p style="color:#93A1B5;font-size:12px;margin-top:28px;border-top:1px solid #E7EDF4;padding-top:14px">Sent by Doctium · You're receiving this because you have a Doctium account.</p>
    </div>`;
  }

  private emailHtml(name: string, title: string, message: string): string {
    return `<div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#0F1B2D">
      <h2 style="color:#133157;margin:0 0 8px">${title}</h2>
      <p style="color:#5A6B82;line-height:1.5">Hi Dr. ${name},</p>
      <p style="color:#5A6B82;line-height:1.5">${message}</p>
      <p style="color:#93A1B5;font-size:12px;margin-top:24px">— Doctium</p>
    </div>`;
  }
}
