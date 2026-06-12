jest.mock("@doctium/database", () => ({
  prisma: {
    setting: {
      findMany: jest.fn().mockResolvedValue([]),
      upsert: jest.fn().mockResolvedValue({}),
      update: jest.fn().mockResolvedValue({}),
    },
  },
}));

import * as crypto from "crypto";
import { prisma } from "@doctium/database";
import { CryptoSignService } from "./crypto-sign.service";

const findMany = (
  prisma as unknown as {
    setting: { findMany: jest.Mock };
  }
).setting.findMany;

const makeKeypair = () => {
  const { privateKey, publicKey } = crypto.generateKeyPairSync("ed25519", {
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
    publicKeyEncoding: { type: "spki", format: "pem" },
  });
  return { privateKey: privateKey as string, publicKey: publicKey as string };
};

describe("CryptoSignService", () => {
  const ORIGINAL_ENV = { ...process.env };

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it("signs and verifies a payload with the env key", async () => {
    process.env.RX_PRIVATE_KEY = makeKeypair().privateKey;
    findMany.mockResolvedValue([]);
    const svc = new CryptoSignService();

    const payload = "RX1|doctorA|userB|drug";
    const sig = await svc.sign(payload);
    expect(await svc.verify(payload, sig)).toBe(true);
  });

  it("rejects a tampered payload", async () => {
    process.env.RX_PRIVATE_KEY = makeKeypair().privateKey;
    findMany.mockResolvedValue([]);
    const svc = new CryptoSignService();

    const sig = await svc.sign("RX1|doctorA|userB|amoxicillin");
    expect(await svc.verify("RX1|doctorA|userB|TAMPERED", sig)).toBe(false);
  });

  it("grandfathers signatures made with the legacy DB key", async () => {
    const legacy = makeKeypair();
    const current = makeKeypair();
    process.env.RX_PRIVATE_KEY = current.privateKey;
    // The DB still holds the OLD public key used to sign historical prescriptions.
    findMany.mockResolvedValue([
      { key: "rx_public_key", value: legacy.publicKey },
    ]);
    const svc = new CryptoSignService();

    const payload = "RX-OLD|doctorA|userB|drug";
    const legacySig = crypto
      .sign(
        null,
        Buffer.from(payload),
        crypto.createPrivateKey(legacy.privateKey),
      )
      .toString("base64");

    expect(await svc.verify(payload, legacySig)).toBe(true); // verifies via legacy key
  });

  it("produces a deterministic canonical string regardless of item order", () => {
    process.env.RX_PRIVATE_KEY = makeKeypair().privateKey;
    const svc = new CryptoSignService();
    const base = {
      code: "RX1",
      doctorId: "d1",
      userId: "u1",
      items: [
        {
          drugName: "B",
          dosage: "1",
          frequency: "2",
          duration: "3",
          refills: 0,
        },
        {
          drugName: "A",
          dosage: "1",
          frequency: "2",
          duration: "3",
          refills: 1,
        },
      ],
    };
    const reordered = { ...base, items: [...base.items].reverse() };
    expect(svc.canonical(base)).toBe(svc.canonical(reordered));
  });

  it("fails closed in production when no env key is configured", async () => {
    delete process.env.RX_PRIVATE_KEY;
    process.env.NODE_ENV = "production";
    findMany.mockResolvedValue([]);
    const svc = new CryptoSignService();

    await expect(svc.sign("RX1")).rejects.toThrow(/RX_PRIVATE_KEY is required/);
  });
});
