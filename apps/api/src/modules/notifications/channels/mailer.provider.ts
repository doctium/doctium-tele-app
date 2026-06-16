import { Injectable, Logger } from "@nestjs/common";
import * as Sentry from "@sentry/nestjs";
import * as nodemailer from "nodemailer";

/**
 * Email sender. Prefers Resend's HTTP API (HTTPS/443 — never blocked) over SMTP,
 * because cloud hosts (e.g. Railway) often block/throttle outbound SMTP ports
 * (587/465), which makes nodemailer hang until the caller times out. Falls back
 * to SMTP (with fail-fast timeouts) when no Resend key is present. No-ops
 * gracefully until either is configured.
 */
@Injectable()
export class MailerProvider {
  private readonly logger = new Logger(MailerProvider.name);
  private transporter: nodemailer.Transporter | null = null;
  private tried = false;

  /** Resend API key: RESEND_API_KEY, or SMTP_PASS when it's a Resend key (re_…). */
  private resendKey(): string | null {
    if (process.env.RESEND_API_KEY) return process.env.RESEND_API_KEY;
    const pass = process.env.SMTP_PASS;
    return pass && pass.startsWith("re_") ? pass : null;
  }

  private from(): string {
    return (
      process.env.SMTP_FROM ||
      process.env.SMTP_USER ||
      "Doctium <no-reply@doctiumhealth.com>"
    );
  }

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
      // Fail fast instead of hanging if the SMTP port is blocked.
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 15000,
    });
    return this.transporter;
  }

  isConfigured(): boolean {
    return !!this.resendKey() || !!this.get();
  }

  async sendEmail(to: string, subject: string, html: string): Promise<boolean> {
    if (!to) return false;
    const key = this.resendKey();
    if (key) return this.sendViaResend(key, to, subject, html);
    return this.sendViaSmtp(to, subject, html);
  }

  private async sendViaResend(
    key: string,
    to: string,
    subject: string,
    html: string,
  ): Promise<boolean> {
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ from: this.from(), to: [to], subject, html }),
      });
      const body = (await res.json().catch(() => null)) as {
        id?: string;
        message?: string;
      } | null;
      if (!res.ok) {
        const detail = body ? JSON.stringify(body) : `HTTP ${res.status}`;
        this.logger.warn(`Resend email to ${to} failed: ${detail}`);
        Sentry.captureMessage(
          `Resend email failed (${to}): ${detail}`,
          "warning",
        );
        return false;
      }
      this.logger.log(
        `Email sent to ${to} via Resend (id=${body?.id ?? "n/a"})`,
      );
      return true;
    } catch (e) {
      this.logger.warn(
        `Resend email send failed to ${to}: ${(e as Error).message}`,
      );
      Sentry.captureException(e);
      return false;
    }
  }

  private async sendViaSmtp(
    to: string,
    subject: string,
    html: string,
  ): Promise<boolean> {
    const t = this.get();
    if (!t) {
      this.logger.warn(
        `Email NOT sent to ${to}: no Resend key and SMTP not configured`,
      );
      return false;
    }
    try {
      const info = await t.sendMail({ from: this.from(), to, subject, html });
      this.logger.log(
        `Email sent to ${to} via SMTP (id=${info?.messageId ?? "n/a"})`,
      );
      return true;
    } catch (e) {
      this.logger.warn(
        `SMTP email send failed to ${to}: ${(e as Error).message}`,
      );
      Sentry.captureException(e);
      return false;
    }
  }
}
