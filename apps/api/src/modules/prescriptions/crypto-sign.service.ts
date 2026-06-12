import { Injectable, Logger } from "@nestjs/common";
import { prisma } from "@doctium/database";
import * as crypto from "crypto";

interface CanonicalInput {
  code: string;
  doctorId: string;
  userId: string;
  items: {
    drugName: string;
    dosage: string;
    frequency: string;
    duration: string;
    refills: number;
  }[];
}

const ENC_PREFIX = "enc:v1:";

/**
 * Issues and verifies Ed25519 digital signatures over prescription data.
 *
 * Key custody, in order of preference:
 *  1. RX_PRIVATE_KEY in the environment — the signing key never touches the app DB.
 *  2. Dev zero-config fallback: a keypair persisted in the Setting table, encrypted
 *     at rest when RX_KEY_ENCRYPTION_SECRET is set. Refused in production.
 *
 * Verification always tries the current key AND the legacy DB public key, so
 * prescriptions signed before a key move keep validating (grandfathering).
 */
@Injectable()
export class CryptoSignService {
  private readonly logger = new Logger(CryptoSignService.name);
  private signingKey?: crypto.KeyObject;
  private currentPublicKey?: crypto.KeyObject;
  private legacyPublicKey?: crypto.KeyObject | null;

  /** Read a PEM from env, accepting single-line values with escaped newlines (as Firebase keys are stored). */
  private static pemFromEnv(name: string): string | undefined {
    const raw = process.env[name];
    if (!raw) return undefined;
    return raw.includes("\\n") ? raw.replace(/\\n/g, "\n") : raw;
  }

  private encryptionKey(): Buffer | null {
    const secret = process.env.RX_KEY_ENCRYPTION_SECRET;
    if (!secret) return null;
    return crypto.scryptSync(secret, "doctium-rx-key", 32);
  }

  private encrypt(plain: string): string {
    const key = this.encryptionKey();
    if (!key) return plain; // dev without a secret → plaintext (warned in init)
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
    const ct = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
    const tag = cipher.getAuthTag();
    return `${ENC_PREFIX}${iv.toString("base64")}:${tag.toString("base64")}:${ct.toString("base64")}`;
  }

  private decrypt(stored: string): string {
    if (!stored.startsWith(ENC_PREFIX)) return stored; // legacy plaintext PEM
    const key = this.encryptionKey();
    if (!key)
      throw new Error(
        "RX_KEY_ENCRYPTION_SECRET is required to decrypt the stored prescription key",
      );
    // Format is `enc:v1:<iv>:<tag>:<ct>` — strip the prefix before splitting on ':'.
    const [ivB64, tagB64, ctB64] = stored.slice(ENC_PREFIX.length).split(":");
    if (!ivB64 || !tagB64 || !ctB64)
      throw new Error("Malformed encrypted prescription key");
    const decipher = crypto.createDecipheriv(
      "aes-256-gcm",
      key,
      Buffer.from(ivB64, "base64"),
    );
    decipher.setAuthTag(Buffer.from(tagB64, "base64"));
    return Buffer.concat([
      decipher.update(Buffer.from(ctB64, "base64")),
      decipher.final(),
    ]).toString("utf8");
  }

  private async init() {
    if (this.signingKey) return;

    // 1) Preferred: signing key from the environment.
    const envPriv = CryptoSignService.pemFromEnv("RX_PRIVATE_KEY");
    if (envPriv) {
      this.signingKey = crypto.createPrivateKey(envPriv);
      this.currentPublicKey = crypto.createPublicKey(this.signingKey);
    }

    // 2) Legacy DB public key — kept only to verify pre-migration signatures.
    const rows = await prisma.setting.findMany({
      where: { key: { in: ["rx_private_key", "rx_public_key"] } },
    });
    const dbPubRaw = rows.find((r) => r.key === "rx_public_key")?.value;
    if (dbPubRaw) {
      try {
        this.legacyPublicKey = crypto.createPublicKey(dbPubRaw);
      } catch {
        this.legacyPublicKey = null;
      }
    }

    if (this.signingKey) return; // env key present → done

    // 3) No env key. In production this is a misconfiguration; fail closed.
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "RX_PRIVATE_KEY is required in production to sign prescriptions",
      );
    }

    // 4) Dev zero-config: reuse the DB keypair, generating one on first run.
    const dbPrivRaw = rows.find((r) => r.key === "rx_private_key")?.value;
    let privPem: string;
    let pubPem: string;
    if (dbPrivRaw && dbPubRaw) {
      privPem = this.decrypt(dbPrivRaw);
      pubPem = dbPubRaw;
      // Lazy-migrate a legacy plaintext key to encrypted-at-rest once a secret exists.
      if (!dbPrivRaw.startsWith(ENC_PREFIX) && this.encryptionKey()) {
        await prisma.setting.update({
          where: { key: "rx_private_key" },
          data: { value: this.encrypt(privPem) },
        });
      }
    } else {
      const { privateKey, publicKey } = crypto.generateKeyPairSync("ed25519", {
        privateKeyEncoding: { type: "pkcs8", format: "pem" },
        publicKeyEncoding: { type: "spki", format: "pem" },
      });
      privPem = privateKey as string;
      pubPem = publicKey as string;
      const stored = this.encrypt(privPem);
      await prisma.setting.upsert({
        where: { key: "rx_private_key" },
        update: { value: stored },
        create: { key: "rx_private_key", value: stored },
      });
      await prisma.setting.upsert({
        where: { key: "rx_public_key" },
        update: { value: pubPem },
        create: { key: "rx_public_key", value: pubPem },
      });
    }

    if (!this.encryptionKey()) {
      this.logger.warn(
        "Prescription signing key is stored UNENCRYPTED in the DB. Set RX_PRIVATE_KEY (preferred) " +
          "or RX_KEY_ENCRYPTION_SECRET to secure it before going to production.",
      );
    }

    this.signingKey = crypto.createPrivateKey(privPem);
    this.currentPublicKey = crypto.createPublicKey(pubPem);
    if (!this.legacyPublicKey) this.legacyPublicKey = this.currentPublicKey;
  }

  async getPublicKey(): Promise<string> {
    await this.init();
    return this.currentPublicKey!.export({
      type: "spki",
      format: "pem",
    }).toString();
  }

  /** Deterministic string representation of a prescription used as the signed payload. */
  canonical(input: CanonicalInput): string {
    const items = input.items
      .map(
        (i) =>
          `${i.drugName}${i.dosage}${i.frequency}${i.duration}${i.refills}`,
      )
      .sort()
      .join("");
    return `${input.code}${input.doctorId}${input.userId}${items}`;
  }

  async sign(payload: string): Promise<string> {
    await this.init();
    // Ed25519 requires the algorithm argument to be null.
    return crypto
      .sign(null, Buffer.from(payload, "utf8"), this.signingKey!)
      .toString("base64");
  }

  async verify(payload: string, signatureB64: string): Promise<boolean> {
    try {
      await this.init();
      const sig = Buffer.from(signatureB64, "base64");
      const data = Buffer.from(payload, "utf8");
      const keys = [this.currentPublicKey, this.legacyPublicKey].filter(
        Boolean,
      ) as crypto.KeyObject[];
      // A signature is valid if it verifies under the current OR the legacy key.
      return keys.some((k) => crypto.verify(null, data, k, sig));
    } catch {
      return false;
    }
  }
}
