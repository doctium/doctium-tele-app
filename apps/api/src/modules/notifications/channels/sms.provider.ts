import { Injectable, Logger } from "@nestjs/common";
import * as Sentry from "@sentry/nestjs";
import { toE164Nigeria } from "../../../common/phone.util";

/** Termii SMS sender (Nigeria-first). No-ops gracefully until TERMII_API_KEY is set. */
@Injectable()
export class SmsProvider {
  private readonly logger = new Logger(SmsProvider.name);

  isConfigured(): boolean {
    return !!process.env.TERMII_API_KEY;
  }

  async sendSms(to: string, message: string): Promise<void> {
    const apiKey = process.env.TERMII_API_KEY;
    if (!apiKey || !to) return;
    // Termii requires the country code (E.164); it rejects the local "0801..." form.
    const recipient = toE164Nigeria(to);
    try {
      const res = await fetch("https://api.ng.termii.com/api/sms/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: recipient,
          // N-Alert is Termii's pre-approved shared sender ID — works without
          // brand-name verification (override once a custom sender ID is approved).
          from: process.env.TERMII_SENDER_ID || "N-Alert",
          sms: message,
          type: "plain",
          channel: "generic",
          api_key: apiKey,
        }),
      });
      // Termii reports the real reason in the JSON body (e.g. {code, message})
      // even on some non-error statuses — HTTP status alone hides failures.
      const body = (await res.json().catch(() => null)) as {
        code?: string;
        message?: string;
        message_id?: string;
      } | null;
      const ok = res.ok && (!body?.code || body.code === "ok");
      if (!ok) {
        const detail = body ? JSON.stringify(body) : `HTTP ${res.status}`;
        this.logger.warn(`Termii SMS to ${recipient} failed: ${detail}`);
        Sentry.captureMessage(
          `Termii SMS failed (${recipient}): ${detail}`,
          "warning",
        );
      } else {
        this.logger.log(
          `Termii SMS sent to ${recipient} (id=${body?.message_id ?? "n/a"})`,
        );
      }
    } catch (e) {
      this.logger.warn(`SMS send failed: ${(e as Error).message}`);
      Sentry.captureException(e);
    }
  }
}
