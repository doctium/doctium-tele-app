import { Injectable, Logger } from "@nestjs/common";

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
    try {
      const res = await fetch("https://api.ng.termii.com/api/sms/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to,
          // N-Alert is Termii's pre-approved shared sender ID — works without
          // brand-name verification (override once a custom sender ID is approved).
          from: process.env.TERMII_SENDER_ID || "N-Alert",
          sms: message,
          type: "plain",
          channel: "generic",
          api_key: apiKey,
        }),
      });
      if (!res.ok) this.logger.warn(`Termii SMS failed (${res.status})`);
    } catch (e) {
      this.logger.warn(`SMS send failed: ${(e as Error).message}`);
    }
  }
}
