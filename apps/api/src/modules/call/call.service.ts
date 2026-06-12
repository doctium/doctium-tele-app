import { Injectable, InternalServerErrorException } from '@nestjs/common';
import * as crypto from 'crypto';

/**
 * Generates ZegoCloud "Token04" tokens server-side, signed with the app's
 * server secret. The mobile apps exchange this token to join a video room.
 * Reference: ZegoCloud Token04 spec.
 */
@Injectable()
export class CallService {
  private get appId(): number {
    const raw = process.env.ZEGO_APP_ID;
    const id = raw ? parseInt(raw, 10) : NaN;
    if (!id || Number.isNaN(id)) {
      throw new InternalServerErrorException('ZEGO_APP_ID is not configured');
    }
    return id;
  }

  private get serverSecret(): string {
    const secret = process.env.ZEGO_SERVER_SECRET;
    if (!secret || secret.length !== 32) {
      throw new InternalServerErrorException('ZEGO_SERVER_SECRET must be a 32-character string');
    }
    return secret;
  }

  /** Returns a token + the appId + the resolved userId for the caller. */
  generateToken(userId: string, effectiveSeconds = 3600) {
    const token = this.generateToken04(this.appId, userId, this.serverSecret, effectiveSeconds, '');
    return { token, appId: this.appId, userId };
  }

  private generateToken04(appId: number, userId: string, secret: string, effectiveTimeInSeconds: number, payload: string): string {
    const createTime = Math.floor(Date.now() / 1000);
    const tokenInfo = {
      app_id: appId,
      user_id: userId,
      nonce: Math.floor(Math.random() * 2147483647),
      ctime: createTime,
      expire: createTime + effectiveTimeInSeconds,
      payload: payload || '',
    };

    const plaintext = Buffer.from(JSON.stringify(tokenInfo), 'utf8');
    const key = Buffer.from(secret); // 32 bytes → AES-256-CBC
    const iv = crypto.randomBytes(16);

    const cipher = crypto.createCipheriv(`aes-${key.length * 8}-cbc`, key, iv);
    cipher.setAutoPadding(true);
    const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);

    const expireBuf = Buffer.alloc(8);
    expireBuf.writeBigInt64BE(BigInt(tokenInfo.expire));
    const ivLenBuf = Buffer.alloc(2);
    ivLenBuf.writeUInt16BE(iv.length);
    const ctLenBuf = Buffer.alloc(2);
    ctLenBuf.writeUInt16BE(encrypted.length);

    const packed = Buffer.concat([expireBuf, ivLenBuf, iv, ctLenBuf, encrypted]);
    return '04' + packed.toString('base64');
  }
}
