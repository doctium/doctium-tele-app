import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { prisma } from '@doctium/database';
import { BillingInterval, SubscriberType } from '@doctium/types';
import { PaystackProvider } from '../payments/paystack.provider';
import { EntitlementsService } from './entitlements.service';
import { SubscribeDto } from './dto/subscriptions.dto';

@Injectable()
export class SubscriptionsService {
  constructor(
    private readonly paystack: PaystackProvider,
    private readonly entitlements: EntitlementsService,
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

  private whereFor(type: SubscriberType, id: string) {
    return type === 'USER' ? { userId: id } : { doctorId: id };
  }

  private async subscriberEmail(type: SubscriberType, id: string): Promise<string> {
    const row =
      type === 'USER'
        ? await prisma.user.findUnique({ where: { id }, select: { email: true } })
        : await prisma.doctor.findUnique({ where: { id }, select: { email: true } });
    if (!row?.email) throw new BadRequestException('Add an email to your profile to subscribe');
    return row.email;
  }

  // ── Read ───────────────────────────────────────────────────
  async getMySubscription(type: SubscriberType, id: string) {
    const sub = await prisma.subscription.findUnique({
      where: this.whereFor(type, id),
      include: {
        plan: true,
        usage: { orderBy: { periodStart: 'desc' }, take: 1 },
        invoices: { orderBy: { createdAt: 'desc' }, take: 10 },
      },
    });
    const entitlements =
      type === 'USER'
        ? await this.entitlements.resolveUserEntitlements(id)
        : await this.entitlements.resolveDoctorEntitlements(id);
    return { subscription: sub, usage: sub?.usage[0] ?? null, entitlements };
  }

  // ── Subscribe / change plan ────────────────────────────────
  async subscribe(type: SubscriberType, id: string, dto: SubscribeDto) {
    return this.createAndCharge(type, id, dto, /* replace */ false);
  }

  /** Switch tiers. Forfeits remaining time on the current plan (no proration in v1). */
  async changePlan(type: SubscriberType, id: string, dto: SubscribeDto) {
    const current = await prisma.subscription.findUnique({ where: this.whereFor(type, id) });
    if (!current || !['ACTIVE', 'PAST_DUE'].includes(current.status)) {
      throw new BadRequestException('You have no active membership to change. Subscribe instead.');
    }
    return this.createAndCharge(type, id, dto, /* replace */ true);
  }

  private async createAndCharge(type: SubscriberType, id: string, dto: SubscribeDto, replace: boolean) {
    const plan = await prisma.subscriptionPlan.findUnique({ where: { id: dto.planId } });
    if (!plan || !plan.isActive) throw new NotFoundException('Plan not found');
    if (plan.audience !== type) throw new BadRequestException('That plan is not available for your account type');

    const existing = await prisma.subscription.findUnique({ where: this.whereFor(type, id) });
    if (existing) {
      const live = ['ACTIVE', 'PAST_DUE'].includes(existing.status);
      if (live && !replace) {
        throw new BadRequestException('You already have an active membership. Use change plan to switch tiers.');
      }
      // Replace, or clean up a stale PENDING/CANCELLED/EXPIRED row (one-per-account unique constraint).
      await prisma.subscription.delete({ where: { id: existing.id } });
    }

    const paymentSource = dto.paymentSource === 'WALLET' ? 'WALLET' : 'CARD';
    if (paymentSource === 'WALLET' && type === 'DOCTOR') {
      throw new BadRequestException('Doctor memberships are billed to a card');
    }

    const sub = await prisma.subscription.create({
      data: {
        planId: plan.id,
        subscriberType: type,
        ...(type === 'USER' ? { userId: id } : { doctorId: id }),
        status: 'PENDING',
        paymentSource,
        priceAtSignup: plan.price,
        currency: plan.currency,
      },
    });

    // Free tier (e.g. doctor Standard) → activate immediately, no charge.
    if (plan.price <= 0) {
      await this.activateSubscription(sub.id, new Date());
      return { activated: true, subscriptionId: sub.id };
    }

    if (paymentSource === 'WALLET') {
      return this.chargeWalletAndActivate(sub.id, id, plan);
    }
    return this.initCardCheckout(sub.id, type, id, plan);
  }

  private async initCardCheckout(
    subId: string,
    type: SubscriberType,
    subscriberId: string,
    plan: { price: number; currency: string; interval: BillingInterval; name: string },
  ) {
    const email = await this.subscriberEmail(type, subscriberId);
    const now = new Date();
    const periodEnd = this.addInterval(now, plan.interval);
    const reference = `sub_${subId}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    await prisma.subscriptionInvoice.create({
      data: {
        reference, subscriptionId: subId, amount: plan.price, currency: plan.currency,
        status: 'PENDING', source: 'CARD', periodStart: now, periodEnd, attempt: 1,
      },
    });
    await prisma.paymentTransaction.create({
      data: {
        reference, type: 'SUBSCRIPTION_PAYMENT', provider: 'PAYSTACK', status: 'PENDING',
        ...(type === 'USER' ? { userId: subscriberId } : { doctorId: subscriberId }),
        amount: plan.price, currency: plan.currency, channel: 'card',
      },
    });

    const callbackUrl = `${process.env.PUBLIC_WEB_URL ?? 'http://localhost:3000'}/paystack/callback`;
    const init = await this.paystack.initializeTransaction({
      email, amount: plan.price, reference,
      metadata: { subscriptionId: subId, purpose: 'subscription' },
      callbackUrl,
    });
    return { authorizationUrl: init.authorization_url, reference, publicKey: process.env.PAYSTACK_PUBLIC_KEY ?? '' };
  }

  private async chargeWalletAndActivate(
    subId: string,
    userId: string,
    plan: { price: number; currency: string; interval: BillingInterval; name: string },
  ) {
    const now = new Date();
    const periodEnd = this.addInterval(now, plan.interval);
    const reference = `sub_${subId}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    await prisma.$transaction(async (tx) => {
      const wallet = await tx.userWallet.findUnique({ where: { userId } });
      if (!wallet || wallet.balance < plan.price) {
        throw new BadRequestException('Insufficient wallet balance. Please top up to subscribe.');
      }
      await tx.userWallet.update({ where: { userId }, data: { balance: { decrement: plan.price } } });
      await tx.userWalletHistory.create({
        data: { walletId: wallet.id, amount: plan.price, type: 'SUBSCRIPTION_PAYMENT', description: `DoctiumPlus — ${plan.name}` },
      });
      await tx.subscriptionInvoice.create({
        data: {
          reference, subscriptionId: subId, amount: plan.price, currency: plan.currency,
          status: 'PAID', source: 'WALLET', periodStart: now, periodEnd, attempt: 1,
        },
      });
      await tx.paymentTransaction.create({
        data: {
          reference, type: 'SUBSCRIPTION_PAYMENT', provider: 'WALLET', status: 'SUCCESS',
          userId, amount: plan.price, currency: plan.currency, channel: 'wallet',
        },
      });
    });

    await this.activateSubscription(subId, now);
    return { activated: true, subscriptionId: subId };
  }

  // ── Activation (shared: first charge, wallet, free, renewal) ─
  /** Sets the subscription ACTIVE for [periodStart, periodStart+interval), grants the period's
   *  consult credits, and (for doctor plans) flips the featured flag. Idempotent per periodStart. */
  async activateSubscription(subId: string, periodStart: Date) {
    const sub = await prisma.subscription.findUnique({ where: { id: subId }, include: { plan: true } });
    if (!sub) throw new NotFoundException('Subscription not found');
    const periodEnd = this.addInterval(periodStart, sub.plan.interval);

    await prisma.$transaction(async (tx) => {
      await tx.subscription.update({
        where: { id: subId },
        data: {
          status: 'ACTIVE', currentPeriodStart: periodStart, currentPeriodEnd: periodEnd,
          failedAttempts: 0, graceUntil: null,
        },
      });

      if (sub.subscriberType === 'USER') {
        const benefits = (sub.plan.benefits ?? {}) as { consultsPerCycle?: number };
        const creditsTotal = Number(benefits.consultsPerCycle) || 0;
        await tx.subscriptionUsage.upsert({
          where: { subscriptionId_periodStart: { subscriptionId: subId, periodStart } },
          update: { periodEnd, creditsTotal },
          create: { subscriptionId: subId, periodStart, periodEnd, creditsTotal },
        });
      }

      if (sub.subscriberType === 'DOCTOR' && sub.doctorId) {
        const benefits = (sub.plan.benefits ?? {}) as { featured?: boolean };
        await tx.doctor.update({
          where: { id: sub.doctorId },
          data: { isFeatured: !!benefits.featured, featuredUntil: periodEnd },
        });
      }
    });
    return { activated: true };
  }

  // ── Webhook entry (called by PaymentsService for SUBSCRIPTION_PAYMENT charges) ──
  /** Idempotent: PaymentsService already short-circuits when the txn is already SUCCESS. */
  async handleSubscriptionCharge(reference: string, data: Record<string, unknown>) {
    const invoice = await prisma.subscriptionInvoice.findUnique({ where: { reference } });
    const subId =
      invoice?.subscriptionId ??
      ((data.metadata as { subscriptionId?: string })?.subscriptionId);
    if (!subId) return { handled: false, reason: 'no_subscription' };

    const auth = data.authorization as { authorization_code?: string; last4?: string; card_type?: string } | undefined;
    const customerCode = (data.customer as { customer_code?: string })?.customer_code;

    // Persist the reusable card token (first charge) for future renewals.
    await prisma.subscription.update({
      where: { id: subId },
      data: {
        ...(auth?.authorization_code && { authorizationCode: auth.authorization_code }),
        ...(customerCode && { customerCode }),
        ...(auth?.last4 && { lastFour: auth.last4 }),
        ...(auth?.card_type && { cardBrand: auth.card_type }),
      },
    });

    await prisma.subscriptionInvoice.update({ where: { reference }, data: { status: 'PAID', raw: data as never } });
    await prisma.paymentTransaction.update({ where: { reference }, data: { status: 'SUCCESS', raw: data as never } });

    // First charge → activate from the invoice's period start; renewal references carry the new period start too.
    const periodStart = invoice?.periodStart ?? new Date();
    await this.activateSubscription(subId, periodStart);
    return { handled: true, kind: 'subscription' };
  }

  // ── Cancel ─────────────────────────────────────────────────
  async cancel(type: SubscriberType, id: string) {
    const sub = await prisma.subscription.findUnique({ where: this.whereFor(type, id) });
    if (!sub) throw new NotFoundException('No subscription found');
    if (['CANCELLED', 'EXPIRED'].includes(sub.status)) return sub;
    return prisma.subscription.update({
      where: { id: sub.id },
      data: { cancelAtPeriodEnd: true, cancelledAt: new Date() },
    });
  }
}
