import { Injectable, Logger } from "@nestjs/common";
import * as Sentry from "@sentry/nestjs";
import * as nodemailer from "nodemailer";

/** SMTP email sender. No-ops gracefully until SMTP_HOST is configured. */
@Injectable()
export class MailerProvider {
  private readonly logger = new Logger(MailerProvider.name);
  private transporter: nodemailer.Transporter | null = null;
  private tried = false;

  private get(): nodemailer.Transporter | null {
    if (this.tried) return this.transporter;
    this.tried = true;
    const host = process.env.SMTP_HOST;
    if (!host) return null;
    const port = parseInt(process.env.SMTP_PORT || "587", 10);
    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: process.env.SMTP_USER
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
        : undefined,
    });
    return this.transporter;
  }

  isConfigured(): boolean {
    return !!this.get();
  }

  async sendEmail(to: string, subject: string, html: string): Promise<boolean> {
    const t = this.get();
    if (!t) {
      this.logger.warn(
        `Email NOT sent to ${to || "(empty)"}: SMTP not configured (SMTP_HOST missing)`,
      );
      return false;
    }
    if (!to) return false;
    try {
      const info = await t.sendMail({
        from:
          process.env.SMTP_FROM ||
          process.env.SMTP_USER ||
          "no-reply@doctiumhealth.com",
        to,
        subject,
        html,
      });
      this.logger.log(
        `Email sent to ${to} (subject="${subject}", id=${info?.messageId ?? "n/a"})`,
      );
      return true;
    } catch (e) {
      // Resend/SMTP rejects (e.g. unverified sender domain) surface here — make
      // them loud instead of swallowing, so prod failures are diagnosable.
      this.logger.warn(`Email send failed to ${to}: ${(e as Error).message}`);
      Sentry.captureException(e);
      return false;
    }
  }
}
