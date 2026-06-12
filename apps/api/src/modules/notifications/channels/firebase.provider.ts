import { Injectable, Logger } from "@nestjs/common";
import * as admin from "firebase-admin";

/** Thin FCM push sender. No-ops gracefully until FIREBASE_* env credentials are set. */
@Injectable()
export class FirebaseProvider {
  private readonly logger = new Logger(FirebaseProvider.name);
  private app: admin.app.App | null = null;
  private tried = false;

  private getApp(): admin.app.App | null {
    if (this.tried) return this.app;
    this.tried = true;
    const projectId = process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    let privateKey = process.env.FIREBASE_PRIVATE_KEY;
    if (!projectId || !clientEmail || !privateKey) return null;
    privateKey = privateKey.replace(/\\n/g, "\n"); // .env stores the key with escaped newlines
    try {
      this.app = admin.apps.length
        ? admin.app()
        : admin.initializeApp({
            credential: admin.credential.cert({
              projectId,
              clientEmail,
              privateKey,
            }),
          });
    } catch (e) {
      this.logger.warn(`Firebase init failed: ${(e as Error).message}`);
      this.app = null;
    }
    return this.app;
  }

  async sendPush(
    tokens: (string | null | undefined)[],
    title: string,
    body: string,
    data?: Record<string, string>,
    imageUrl?: string,
  ): Promise<{ sent: number }> {
    const app = this.getApp();
    const valid = [...new Set(tokens.filter(Boolean) as string[])];
    if (!app || valid.length === 0) return { sent: 0 };

    let sent = 0;
    // FCM multicast accepts at most 500 tokens per request — chunk to stay under the cap.
    for (let i = 0; i < valid.length; i += 500) {
      const batch = valid.slice(i, i + 500);
      try {
        const res = await app.messaging().sendEachForMulticast({
          tokens: batch,
          notification: { title, body, ...(imageUrl ? { imageUrl } : {}) },
          data,
          // High-priority alert that plays a sound and persists in the notification shade.
          android: {
            priority: "high",
            notification: {
              sound: "default",
              channelId: "default",
              ...(imageUrl ? { imageUrl } : {}),
            },
          },
          apns: {
            payload: {
              aps: {
                sound: "default",
                ...(imageUrl ? { "mutable-content": 1 } : {}),
              },
            },
            ...(imageUrl ? { fcmOptions: { imageUrl } } : {}),
          },
        });
        sent += res.successCount;
      } catch (e) {
        this.logger.warn(`Push send failed: ${(e as Error).message}`);
      }
    }
    return { sent };
  }
}
