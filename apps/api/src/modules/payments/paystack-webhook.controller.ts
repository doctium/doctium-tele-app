import { BadRequestException, Controller, Post, Req } from "@nestjs/common";
import { ApiExcludeEndpoint } from "@nestjs/swagger";
import { SkipThrottle } from "@nestjs/throttler";
import { Request } from "express";
import { PaymentsService } from "./payments.service";
import { PaystackProvider } from "./paystack.provider";

/** Public Paystack webhook (no JWT) — verified by HMAC signature over the raw body. */
// Exempt from rate limiting: Paystack retries failed deliveries and bursts on
// settlement, and the HMAC signature already authenticates every call.
@SkipThrottle()
@Controller("payments/paystack")
export class PaystackWebhookController {
  constructor(
    private readonly payments: PaymentsService,
    private readonly paystack: PaystackProvider,
  ) {}

  @ApiExcludeEndpoint()
  @Post("webhook")
  async webhook(
    @Req()
    req: Request & {
      rawBody?: Buffer;
      body: { event: string; data: Record<string, unknown> };
    },
  ) {
    const signature = req.headers["x-paystack-signature"] as string | undefined;
    const raw = req.rawBody ?? Buffer.from(JSON.stringify(req.body ?? {}));
    if (!this.paystack.verifyWebhookSignature(raw, signature)) {
      throw new BadRequestException("Invalid signature");
    }
    return this.payments.handlePaystackWebhook(req.body);
  }
}
