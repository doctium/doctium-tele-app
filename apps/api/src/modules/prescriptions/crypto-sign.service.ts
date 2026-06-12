import { Injectable } from '@nestjs/common';
import { prisma } from '@doctium/database';
import * as crypto from 'crypto';

interface CanonicalInput {
  code: string;
  doctorId: string;
  userId: string;
  items: { drugName: string; dosage: string; frequency: string; duration: string; refills: number }[];
}

/**
 * Issues and verifies Ed25519 digital signatures over prescription data.
 * The keypair is generated once and persisted in the Setting table (zero-config),
 * mirroring how other settings are stored.
 */
@Injectable()
export class CryptoSignService {
  private keys?: { privateKey: string; publicKey: string };

  private async getKeys() {
    if (this.keys) return this.keys;

    const rows = await prisma.setting.findMany({ where: { key: { in: ['rx_private_key', 'rx_public_key'] } } });
    let priv = rows.find((r) => r.key === 'rx_private_key')?.value;
    let pub = rows.find((r) => r.key === 'rx_public_key')?.value;

    if (!priv || !pub) {
      const { privateKey, publicKey } = crypto.generateKeyPairSync('ed25519', {
        privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
        publicKeyEncoding: { type: 'spki', format: 'pem' },
      });
      priv = privateKey as string;
      pub = publicKey as string;
      await prisma.setting.upsert({ where: { key: 'rx_private_key' }, update: { value: priv }, create: { key: 'rx_private_key', value: priv } });
      await prisma.setting.upsert({ where: { key: 'rx_public_key' }, update: { value: pub }, create: { key: 'rx_public_key', value: pub } });
    }

    this.keys = { privateKey: priv, publicKey: pub };
    return this.keys;
  }

  async getPublicKey() {
    return (await this.getKeys()).publicKey;
  }

  /** Deterministic string representation of a prescription used as the signed payload. */
  canonical(input: CanonicalInput): string {
    const items = input.items
      .map((i) => `${i.drugName}${i.dosage}${i.frequency}${i.duration}${i.refills}`)
      .sort()
      .join('');
    return `${input.code}${input.doctorId}${input.userId}${items}`;
  }

  async sign(payload: string): Promise<string> {
    const { privateKey } = await this.getKeys();
    // Ed25519 requires the algorithm argument to be null.
    return crypto.sign(null, Buffer.from(payload, 'utf8'), privateKey).toString('base64');
  }

  async verify(payload: string, signatureB64: string): Promise<boolean> {
    try {
      const { publicKey } = await this.getKeys();
      return crypto.verify(null, Buffer.from(payload, 'utf8'), publicKey, Buffer.from(signatureB64, 'base64'));
    } catch {
      return false;
    }
  }
}
