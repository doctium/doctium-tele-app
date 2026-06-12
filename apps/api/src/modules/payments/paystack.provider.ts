import { BadRequestException, Injectable } from "@nestjs/common";
import * as crypto from "crypto";

const BASE = "https://api.paystack.co";

interface InitResult {
  authorization_url: string;
  access_code: string;
  reference: string;
}
interface VerifyResult {
  status: string;
  amount: number;
  reference: string;
  currency: string;
  metadata?: Record<string, unknown>;
  customer?: { email: string; customer_code: string };
}
interface CustomerResult {
  customer_code: string;
  id: number;
  email: string;
}
interface DvaResult {
  account_number: string;
  account_name: string;
  bank: { name: string };
  id: number;
}
interface ChargeAuthResult {
  status: string;
  reference: string;
  amount: number;
  authorization?: {
    authorization_code: string;
    last4: string;
    card_type: string;
  };
}

/** Thin Paystack REST client (uses global fetch; no SDK). */
@Injectable()
export class PaystackProvider {
  private secret(): string {
    const k = process.env.PAYSTACK_SECRET_KEY;
    if (!k) throw new BadRequestException("Paystack is not configured");
    return k;
  }

  private async call<T>(
    path: string,
    method: "GET" | "POST",
    body?: unknown,
  ): Promise<T> {
    const res = await fetch(`${BASE}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${this.secret()}`,
        "Content-Type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const json = (await res.json().catch(() => ({}))) as {
      status?: boolean;
      message?: string;
      data?: T;
    };
    if (!res.ok || json.status === false) {
      throw new BadRequestException(
        json.message || `Paystack request failed (${res.status})`,
      );
    }
    return json.data as T;
  }

  /** amount is in kobo (minor unit) — the platform's storage unit and what Paystack expects. */
  initializeTransaction(p: {
    email: string;
    amount: number;
    reference: string;
    metadata?: Record<string, unknown>;
    callbackUrl?: string;
  }) {
    return this.call<InitResult>("/transaction/initialize", "POST", {
      email: p.email,
      amount: Math.round(p.amount),
      reference: p.reference,
      currency: "NGN",
      metadata: p.metadata,
      callback_url: p.callbackUrl,
    });
  }

  verifyTransaction(reference: string) {
    return this.call<VerifyResult>(
      `/transaction/verify/${encodeURIComponent(reference)}`,
      "GET",
    );
  }

  /** Re-charge a saved card token (recurring subscription renewal). amount is in kobo (minor unit). */
  chargeAuthorization(p: {
    email: string;
    amount: number;
    authorization_code: string;
    reference: string;
    metadata?: Record<string, unknown>;
  }) {
    return this.call<ChargeAuthResult>(
      "/transaction/charge_authorization",
      "POST",
      {
        email: p.email,
        amount: Math.round(p.amount),
        authorization_code: p.authorization_code,
        reference: p.reference,
        currency: "NGN",
        metadata: p.metadata,
      },
    );
  }

  createCustomer(p: {
    email: string;
    first_name?: string;
    last_name?: string;
    phone?: string;
  }) {
    return this.call<CustomerResult>("/customer", "POST", p);
  }

  /** Assign a Dedicated Virtual Account to a customer (test mode → preferred_bank 'test-bank'). */
  createDedicatedAccount(customerCode: string) {
    const preferred =
      process.env.NODE_ENV === "production" ? "wema-bank" : "test-bank";
    return this.call<DvaResult>("/dedicated_account", "POST", {
      customer: customerCode,
      preferred_bank: preferred,
    });
  }

  // ── Payouts (transfers) ────────────────────────────────────
  listBanks() {
    return this.call<{ name: string; code: string }[]>(
      "/bank?currency=NGN",
      "GET",
    );
  }

  resolveAccount(accountNumber: string, bankCode: string) {
    return this.call<{ account_number: string; account_name: string }>(
      `/bank/resolve?account_number=${encodeURIComponent(accountNumber)}&bank_code=${encodeURIComponent(bankCode)}`,
      "GET",
    );
  }

  createTransferRecipient(p: {
    name: string;
    account_number: string;
    bank_code: string;
  }) {
    return this.call<{ recipient_code: string }>("/transferrecipient", "POST", {
      type: "nuban",
      name: p.name,
      account_number: p.account_number,
      bank_code: p.bank_code,
      currency: "NGN",
    });
  }

  /** amount is in kobo (minor unit). */
  initiateTransfer(p: {
    amount: number;
    recipient: string;
    reason?: string;
    reference?: string;
  }) {
    return this.call<{
      status: string;
      reference: string;
      transfer_code: string;
    }>("/transfer", "POST", {
      source: "balance",
      amount: Math.round(p.amount),
      recipient: p.recipient,
      reason: p.reason,
      reference: p.reference,
    });
  }

  /** Verify the x-paystack-signature header (HMAC-SHA512 of the raw body with the secret key). */
  verifyWebhookSignature(
    rawBody: Buffer | string,
    signature?: string,
  ): boolean {
    if (!signature) return false;
    const hash = crypto
      .createHmac("sha512", this.secret())
      .update(rawBody)
      .digest("hex");
    try {
      return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(signature));
    } catch {
      return false;
    }
  }
}
