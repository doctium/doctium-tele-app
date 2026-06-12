import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { prisma } from '@doctium/database';
import { BillingInterval } from '@doctium/types';
import { PaystackProvider } from '../payments/paystack.provider';
import { SubscriptionsService } from './subscriptions.service';

type DueSub = {
  id: string;
  userId: string | null;
  doctorId: string | null;
  status: string;
  authorizationCode: string | null;
  currentPeriodEnd: Date | null;
  failedAttempts: number;
  graceUntil: Date | null;
  priceAtSignup: number;
  currency: string;
  plan: { interval: BillingInterval };
};

/** Recurring billing: daily renewal sweep + dunning + featured-flag expiry. */
@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);

  constructor(
    private readonly subscriptions: SubscriptionsService,
    private readonly paystack: PaystackProvider,
  ) {}

  private async setting(key: string, fallback: string): Promise<string> {
    const row = await prisma.setting.findUnique({ where: { key } });
    return row?.value || fallback;
  }

  private addInterval(from: Date, interval: BillingInterval): Date {
    const d = new Date(from);
    if (interval === 'QUARTERLY') d.setMonth(d.getMonth() + 3);
    else if (interval === 'YEARLY') d.setFullYear(d.getFullYear() + 1);
    else d.setMonth(d.getMonth() + 1);
    return d;
  }

  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async runRenewals() {
    const now = new Date();
    const due = (await prisma.subscription.findMany({
      where: {
        status: { in: ['ACTIVE', 'PAST_DUE'] },
        currentPeriodEnd: { lte: now },
        cancelAtPeriodEnd: false,
        paymentSource: 'CARD',
      },
      include: { plan: { select: { interval: true } } },
    })) as unknown as DueSub[];

    for (const sub of due) {
      try {
        await this.attemptRenewal(sub);
      } catch (e) {
        this.logger.error(`Renewal failed for ${sub.id}: ${(e as Error).message}`);
      }
    }

    await this.expireCancelled(now);
    await this.expireFeatured(now);
    return { processed: due.length };
  }

  private async attemptRenewal(sub: DueSub) {
    const now = new Date();
    const graceDays = parseInt(await this.setting('subscription_grace_days', '3'), 10) || 3;

    // Grace window exhausted → expire.
    if (sub.status === 'PAST_DUE' && sub.graceUntil && sub.graceUntil < now) {
      return this.expireSub(sub);
    }
    // No saved card → cannot charge; move to PAST_DUE/grace.
    if (!sub.authorizationCode) {
      return this.markPastDue(sub, graceDays);
    }

    const periodStart = sub.currentPeriodEnd ?? now;
    const periodEnd = this.addInterval(periodStart, sub.plan.interval);
    const reference = `subrenew_${sub.id}_${periodStart.getTime()}`;

    const existing = await prisma.subscriptionInvoice.findUnique({ where: { reference } });
    if (existing?.status === 'PAID') return; // already settled this period

    const email = await this.subscriberEmail(sub);
    if (!email) return this.markPastDue(sub, graceDays);

    await prisma.subscriptionInvoice.upsert({
      where: { reference },
      update: { status: 'PENDING', attempt: sub.failedAttempts + 1 },
      create: {
        reference, subscriptionId: sub.id, amount: sub.priceAtSignup, currency: sub.currency,
        status: 'PENDING', source: 'CARD', periodStart, periodEnd, attempt: sub.failedAttempts + 1,
      },
    });
    await prisma.paymentTransaction.upsert({
      where: { reference },
      update: { status: 'PENDING' },
      create: {
        reference, type: 'SUBSCRIPTION_PAYMENT', provider: 'PAYSTACK', status: 'PENDING',
        ...(sub.userId ? { userId: sub.userId } : { doctorId: sub.doctorId }),
        amount: sub.priceAtSignup, currency: sub.currency, channel: 'card',
      },
    });

    try {
      const res = await this.paystack.chargeAuthorization({
        email, amount: sub.priceAtSignup, authorization_code: sub.authorizationCode, reference,
        metadata: { subscriptionId: sub.id, purpose: 'subscription_renewal' },
      });
      if (res?.status === 'success') {
        // Settle now; the webhook will also arrive and is idempotent.
        await prisma.subscriptionInvoice.update({ where: { reference }, data: { status: 'PAID', raw: res as never } });
        await prisma.paymentTransaction.update({ where: { reference }, data: { status: 'SUCCESS', raw: res as never } });
        await this.subscriptions.activateSubscription(sub.id, periodStart);
      } else {
        await this.onFailure(sub, reference, graceDays);
      }
    } catch (e) {
      this.logger.warn(`charge_authorization failed for ${sub.id}: ${(e as Error).message}`);
      await this.onFailure(sub, reference, graceDays);
    }
  }

  private async subscriberEmail(sub: DueSub): Promise<string | null> {
    if (sub.userId) {
      const u = await prisma.user.findUnique({ where: { id: sub.userId }, select: { email: true } });
      return u?.email || null;
    }
    if (sub.doctorId) {
      const d = await prisma.doctor.findUnique({ where: { id: sub.doctorId }, select: { email: true } });
      return d?.email || null;
    }
    return null;
  }

  private async onFailure(sub: DueSub, reference: string, graceDays: number) {
    const now = new Date();
    const graceUntil = sub.graceUntil ?? new Date(now.getTime() + graceDays * 86_400_000);
    await prisma.subscription.update({
      where: { id: sub.id },
      data: { status: 'PAST_DUE', failedAttempts: sub.failedAttempts + 1, graceUntil },
    });
    await prisma.subscriptionInvoice.update({ where: { reference }, data: { status: 'FAILED' } }).catch(() => undefined);
    await prisma.paymentTransaction.update({ where: { reference }, data: { status: 'FAILED' } }).catch(() => undefined);
  }

  private async markPastDue(sub: DueSub, graceDays: number) {
    const now = new Date();
    if (sub.status === 'PAST_DUE' && sub.graceUntil && sub.graceUntil < now) {
      return this.expireSub(sub);
    }
    const graceUntil = sub.graceUntil ?? new Date(now.getTime() + graceDays * 86_400_000);
    await prisma.subscription.update({ where: { id: sub.id }, data: { status: 'PAST_DUE', graceUntil } });
  }

  private async expireSub(sub: { id: string; doctorId: string | null }) {
    await prisma.$transaction(async (tx) => {
      await tx.subscription.update({ where: { id: sub.id }, data: { status: 'EXPIRED' } });
      if (sub.doctorId) {
        await tx.doctor.update({ where: { id: sub.doctorId }, data: { isFeatured: false, featuredUntil: null } });
      }
    });
  }

  private async expireCancelled(now: Date) {
    const rows = await prisma.subscription.findMany({
      where: { cancelAtPeriodEnd: true, currentPeriodEnd: { lte: now }, status: { in: ['ACTIVE', 'PAST_DUE'] } },
      select: { id: true, doctorId: true },
    });
    for (const s of rows) {
      await prisma.$transaction(async (tx) => {
        await tx.subscription.update({ where: { id: s.id }, data: { status: 'CANCELLED' } });
        if (s.doctorId) {
          await tx.doctor.update({ where: { id: s.doctorId }, data: { isFeatured: false, featuredUntil: null } });
        }
      });
    }
  }

  /** Defence in depth: clear featured flags whose window has passed. */
  private async expireFeatured(now: Date) {
    await prisma.doctor.updateMany({
      where: { isFeatured: true, featuredUntil: { lt: now } },
      data: { isFeatured: false },
    });
  }
}
