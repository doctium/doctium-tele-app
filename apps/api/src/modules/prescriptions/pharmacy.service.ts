import { Injectable, Logger } from '@nestjs/common';
import { prisma } from '@doctium/database';

export interface PharmacyPayload {
  code: string;
  signature: string;
  doctorName: string;
  patientName: string;
  issuedAt: string;
  verifyUrl: string;
  items: { drugName: string; dosage: string; frequency: string; duration: string; refills: number; instructions: string }[];
}

/**
 * Integration hook point for pharmacy partners.
 * On issue, a signed prescription payload is POSTed to the configured partner
 * webhook. Partners can then pull/dispense via the API-key-guarded PharmacyController.
 */
@Injectable()
export class PharmacyService {
  private readonly logger = new Logger('PharmacyDispatcher');

  /** Fired (fire-and-forget) when a prescription is issued — never blocks issuance. */
  async onPrescriptionIssued(payload: PharmacyPayload): Promise<void> {
    const url = process.env.PHARMACY_WEBHOOK_URL ?? (await this.setting('pharmacy_webhook_url'));
    if (!url) {
      this.logger.log(`No pharmacy webhook configured — skipping dispatch for Rx ${payload.code}`);
      return;
    }
    try {
      await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      this.logger.log(`Dispatched Rx ${payload.code} to pharmacy partner`);
    } catch (e) {
      this.logger.warn(`Pharmacy dispatch failed for Rx ${payload.code}: ${(e as Error).message}`);
    }
  }

  /** The shared secret partners present as `x-api-key`. */
  async apiKey(): Promise<string | undefined> {
    return process.env.PHARMACY_API_KEY ?? (await this.setting('pharmacy_api_key'));
  }

  private async setting(key: string): Promise<string | undefined> {
    const row = await prisma.setting.findUnique({ where: { key } });
    return row?.value || undefined;
  }
}
