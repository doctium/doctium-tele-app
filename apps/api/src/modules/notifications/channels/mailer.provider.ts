import { Injectable, Logger } from "@nestjs/common";
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

  async sendEmail(to: string, subject: string, html: string): Promise<void> {
    const t = this.get();
    if (!t || !to) return;
    try {
      await t.sendMail({
        from:
          process.env.SMTP_FROM ||
          process.env.SMTP_USER ||
          "no-reply@doctium.com",
        to,
        subject,
        html,
      });
    } catch (e) {
      this.logger.warn(`Email send failed: ${(e as Error).message}`);
    }
  }
}
