import { Injectable, Logger } from "@nestjs/common";
import { prisma } from "@doctium/database";
import { NotificationsService } from "../notifications/notifications.service";

/**
 * User referral bonus program: when someone signs up with a user's referral
 * code AND pays for their first real appointment, the referrer's wallet is
 * credited with the admin-configured bonus (`referral_bonus_amount` setting,
 * stored in naira like `min_topup`). One bonus per referred user, ever —
 * the claim on `referralRewardedAt` happens inside the credit transaction,
 * so a failed credit rolls the claim back and a double-credit is impossible.
 */
@Injectable()
export class ReferralBonusService {
  private readonly logger = new Logger("ReferralBonus");

  constructor(private readonly notifications: NotificationsService) {}

  /** Configured bonus in kobo (admin enters naira in Settings). */
  async bonusKobo(): Promise<number> {
    const row = await prisma.setting.findUnique({
      where: { key: "referral_bonus_amount" },
    });
    const naira = parseFloat(row?.value || "0") || 0;
    return Math.max(0, Math.round(naira * 100));
  }

  /** Fire-and-forget from every paymentStatus→PAID transition. Idempotent. */
  async maybeReward(referredUserId: string) {
    const user = await prisma.user.findUnique({
      where: { id: referredUserId },
      select: {
        id: true,
        name: true,
        referredById: true,
        referralRewardedAt: true,
      },
    });
    if (!user?.referredById || user.referralRewardedAt) return;

    // Program off (or not configured) → leave unclaimed, so turning the
    // setting on later still rewards this referral on their next payment.
    const bonus = await this.bonusKobo();
    if (bonus <= 0) return;

    // "Books and pays for at least one appointment" — free/credit consults
    // (amount 0) don't count, so the program can't be gamed with freebies.
    const paid = await prisma.appointment.count({
      where: {
        userId: referredUserId,
        paymentStatus: "PAID",
        amount: { gt: 0 },
      },
    });
    if (!paid) return;

    const referrer = await prisma.user.findFirst({
      where: { id: user.referredById, isDelete: false },
      select: { id: true, name: true },
    });
    if (!referrer) return;

    const reference = `refbonus_${referredUserId}`;
    const wallet = await prisma.$transaction(async (tx) => {
      // Atomic claim INSIDE the transaction — failure rolls it back.
      const claimed = await tx.user.updateMany({
        where: { id: referredUserId, referralRewardedAt: null },
        data: { referralRewardedAt: new Date() },
      });
      if (claimed.count === 0) return null;

      await tx.userWallet.upsert({
        where: { userId: referrer.id },
        create: { userId: referrer.id, balance: bonus },
        update: { balance: { increment: bonus } },
      });
      const w = await tx.userWallet.findUnique({
        where: { userId: referrer.id },
      });
      await tx.userWalletHistory.create({
        data: {
          walletId: w!.id,
          amount: bonus,
          type: "REFERRAL_COMMISSION",
          description: `Referral bonus — ${user.name || "your friend"} booked their first consultation`,
        },
      });
      await tx.paymentTransaction.create({
        data: {
          reference, // unique per referred user — DB-level double-pay guard
          type: "WALLET_TOPUP",
          provider: "WALLET",
          status: "SUCCESS",
          userId: referrer.id,
          amount: bonus,
          channel: "referral_bonus",
        },
      });
      return w;
    });
    if (!wallet) return;

    const naira = (k: number) => `₦${(k / 100).toLocaleString("en-NG")}`;
    this.notifications
      .notifyUser(referrer.id, {
        key: "referral.bonus",
        params: {
          amount: naira(bonus),
          friend: user.name || "your friend",
          balance: naira(wallet.balance),
        },
        type: "referral_bonus",
      })
      .catch(() => {});
    this.logger.log(
      `referral bonus ${bonus} kobo → ${referrer.id} (referred ${referredUserId})`,
    );
  }
}
