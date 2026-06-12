import * as crypto from "crypto";
import { PaystackProvider } from "./paystack.provider";

const SECRET = "sk_test_unit_secret";

const sign = (body: string) =>
  crypto.createHmac("sha512", SECRET).update(body).digest("hex");

describe("PaystackProvider.verifyWebhookSignature", () => {
  let provider: PaystackProvider;

  beforeEach(() => {
    process.env.PAYSTACK_SECRET_KEY = SECRET;
    provider = new PaystackProvider();
  });

  it("accepts a correctly-signed body", () => {
    const body = JSON.stringify({
      event: "charge.success",
      data: { amount: 5000 },
    });
    expect(provider.verifyWebhookSignature(body, sign(body))).toBe(true);
  });

  it("rejects a tampered body under the same signature", () => {
    const body = JSON.stringify({
      event: "charge.success",
      data: { amount: 5000 },
    });
    const signature = sign(body);
    const tampered = JSON.stringify({
      event: "charge.success",
      data: { amount: 999999 },
    });
    expect(provider.verifyWebhookSignature(tampered, signature)).toBe(false);
  });

  it("rejects a missing signature", () => {
    expect(provider.verifyWebhookSignature("{}", undefined)).toBe(false);
  });

  it("rejects a signature made with the wrong secret", () => {
    const body = JSON.stringify({ event: "charge.success" });
    const wrong = crypto
      .createHmac("sha512", "sk_test_other")
      .update(body)
      .digest("hex");
    expect(provider.verifyWebhookSignature(body, wrong)).toBe(false);
  });

  it("does not throw on a malformed (wrong-length) signature", () => {
    const body = JSON.stringify({ event: "charge.success" });
    expect(provider.verifyWebhookSignature(body, "abc")).toBe(false);
  });
});
