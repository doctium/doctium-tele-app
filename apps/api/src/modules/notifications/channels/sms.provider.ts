import { Injectable, Logger } from "@nestjs/common";
import * as Sentry from "@sentry/nestjs";
import { toE164Nigeria } from "../../../common/phone.util";

type SmsProviderName = "africastalking" | "termii";

/**
 * SMS sender (Nigeria-first). Supports Africa's Talking (preferred) and Termii
 * (legacy fallback). Pick explicitly with SMS_PROVIDER=africastalking|termii;
 * if unset, auto-detects from whichever credentials are present. No-ops
 * gracefully until a gateway is configured, so the app runs without SMS creds.
 */
@Injectable()
export class SmsProvider {
  private readonly logger = new Logger(SmsProvider.name);

  private atConfigured(): boolean {
    return !!process.env.AT_API_KEY && !!process.env.AT_USERNAME;
  }

  /** Resolve the active gateway: honor SMS_PROVIDER if set + configured, else
   *  prefer Africa's Talking, else Termii, else none (no-op). */
  private provider(): SmsProviderName | null {
    const explicit = (process.env.SMS_PROVIDER || "").trim().toLowerCase();
    if (explicit === "africastalking" && this.atConfigured())
      return "africastalking";
    if (explicit === "termii" && !!process.env.TERMII_API_KEY) return "termii";
    if (this.atConfigured()) return "africastalking";
    if (process.env.TERMII_API_KEY) return "termii";
    return null;
  }

  isConfigured(): boolean {
    return this.provider() !== null;
  }

  async sendSms(to: string, message: string): Promise<void> {
    if (!to) return;
    const provider = this.provider();
    if (!provider) return; // no gateway configured → graceful no-op
    try {
      if (provider === "africastalking") {
        await this.sendViaAfricasTalking(to, message);
      } else {
        await this.sendViaTermii(to, message);
      }
    } catch (e) {
      this.logger.warn(`SMS send failed: ${(e as Error).message}`);
      Sentry.captureException(e);
    }
  }

  /**
   * Africa's Talking — form-urlencoded POST, E.164 WITH a leading "+".
   * Sandbox (AT_SANDBOX=true, username "sandbox") simulates delivery with no
   * sender ID, so the integration can be verified before the live NG sender ID
   * is approved and the account is funded.
   */
  private async sendViaAfricasTalking(
    to: string,
    message: string,
  ): Promise<void> {
    const apiKey = process.env.AT_API_KEY as string;
    const username = process.env.AT_USERNAME as string;
    const sandbox = (process.env.AT_SANDBOX || "").toLowerCase() === "true";
    const recipient = "+" + toE164Nigeria(to); // AT requires the leading "+"
    const endpoint = sandbox
      ? "https://api.sandbox.africastalking.com/version1/messaging"
      : "https://api.africastalking.com/version1/messaging";

    const form = new URLSearchParams();
    form.set("username", username);
    form.set("to", recipient);
    form.set("message", message);
    // Registered alphanumeric sender ID or short code. Omit until approved —
    // AT then routes via a default sender (required for live NG delivery).
    if (process.env.AT_SENDER_ID) form.set("from", process.env.AT_SENDER_ID);

    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        apiKey,
        Accept: "application/json",
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: form.toString(),
    });
    const body = (await res.json().catch(() => null)) as {
      SMSMessageData?: {
        Message?: string;
        Recipients?: {
          status?: string;
          statusCode?: number;
          number?: string;
          messageId?: string;
          cost?: string;
        }[];
      };
    } | null;
    const rcpt = body?.SMSMessageData?.Recipients?.[0];
    // statusCode 100/101/102 = Processed/Sent/Queued (success). A missing
    // recipient with a "Sent to 0/1" Message means it was rejected upstream.
    const ok =
      res.ok &&
      !!rcpt &&
      (rcpt.status === "Success" ||
        [100, 101, 102].includes(rcpt.statusCode ?? 0));
    if (!ok) {
      const detail = rcpt
        ? `${rcpt.status ?? "?"} (code ${rcpt.statusCode ?? "?"})`
        : body?.SMSMessageData?.Message || `HTTP ${res.status}`;
      this.logger.warn(
        `Africa's Talking SMS to ${recipient} failed: ${detail}`,
      );
      Sentry.captureMessage(
        `Africa's Talking SMS failed (${recipient}): ${detail}`,
        "warning",
      );
    } else {
      this.logger.log(
        `Africa's Talking SMS sent to ${recipient} (id=${rcpt?.messageId ?? "n/a"})`,
      );
    }
  }

  /** Termii (legacy fallback) — JSON POST, E.164 without "+". */
  private async sendViaTermii(to: string, message: string): Promise<void> {
    const apiKey = process.env.TERMII_API_KEY as string;
    // Termii requires the country code (E.164); it rejects the local "0801..." form.
    const recipient = toE164Nigeria(to);
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
        // N-Alert is only valid on Termii's "dnd" route (it 404s on "generic").
        channel: process.env.TERMII_CHANNEL || "dnd",
        api_key: apiKey,
      }),
    });
    // Termii reports the real reason in the JSON body even on some non-error
    // statuses — HTTP status alone hides failures.
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
  }
}
