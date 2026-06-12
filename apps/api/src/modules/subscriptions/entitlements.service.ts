import { Injectable } from "@nestjs/common";
import { prisma } from "@doctium/database";
import {
  DoctorEntitlements,
  DoctorPlanBenefits,
  PatientEntitlements,
  PatientPlanBenefits,
} from "@doctium/types";

const NO_PATIENT: PatientEntitlements = {
  active: false,
  planCode: null,
  subscriptionId: null,
  usageId: null,
  consultsRemaining: 0,
  memberDiscountPercent: 0,
  familyCap: 0,
  unlimitedChat: false,
  priorityBooking: false,
  freeRxDelivery: false,
  waivedBookingFee: false,
  recordingPlayback: false,
  unlimitedTriage: false,
};

const NO_DOCTOR: DoctorEntitlements = {
  active: false,
  planCode: null,
  subscriptionId: null,
  commissionPercent: null,
  isFeatured: false,
  advancedAnalytics: false,
  recordingPlayback: false,
  aiScribe: false,
};

/**
 * Resolves "what can this subscriber do right now" from their active membership.
 * The single source of truth for every gating decision (booking, family cap,
 * commission, discovery). Consumed by appointments / users / doctors modules.
 */
@Injectable()
export class EntitlementsService {
  /** Membership is "live" while ACTIVE, or PAST_DUE within the grace window. */
  isActive(sub: { status: string; graceUntil: Date | null }): boolean {
    if (sub.status === "ACTIVE") return true;
    if (sub.status === "PAST_DUE")
      return !!sub.graceUntil && sub.graceUntil.getTime() > Date.now();
    return false;
  }

  /** Usage row for the current billing period (latest by periodStart). */
  currentUsage(subscriptionId: string) {
    return prisma.subscriptionUsage.findFirst({
      where: { subscriptionId },
      orderBy: { periodStart: "desc" },
    });
  }

  async resolveUserEntitlements(userId: string): Promise<PatientEntitlements> {
    const sub = await prisma.subscription.findUnique({
      where: { userId },
      include: { plan: true },
    });
    if (!sub || !this.isActive(sub)) return { ...NO_PATIENT };

    const b = (sub.plan.benefits ?? {}) as Partial<PatientPlanBenefits>;
    const usage = await this.currentUsage(sub.id);
    const consultsRemaining = Math.max(
      0,
      (usage?.creditsTotal ?? 0) - (usage?.creditsUsed ?? 0),
    );

    return {
      active: true,
      planCode: sub.plan.code,
      subscriptionId: sub.id,
      usageId: usage?.id ?? null,
      consultsRemaining,
      memberDiscountPercent: Number(b.memberDiscountPercent) || 0,
      familyCap: Number(b.familyCap) || 0,
      unlimitedChat: !!b.unlimitedChat,
      priorityBooking: !!b.priorityBooking,
      freeRxDelivery: !!b.freeRxDelivery,
      waivedBookingFee: !!b.waivedBookingFee,
      recordingPlayback: !!b.recordingPlayback,
      unlimitedTriage: !!b.unlimitedTriage,
    };
  }

  async resolveDoctorEntitlements(
    doctorId: string,
  ): Promise<DoctorEntitlements> {
    const sub = await prisma.subscription.findUnique({
      where: { doctorId },
      include: { plan: true },
    });
    if (!sub || !this.isActive(sub)) return { ...NO_DOCTOR };

    const b = (sub.plan.benefits ?? {}) as Partial<DoctorPlanBenefits>;
    return {
      active: true,
      planCode: sub.plan.code,
      subscriptionId: sub.id,
      commissionPercent: b.commissionPercent ?? null,
      isFeatured: !!b.featured,
      advancedAnalytics: !!b.advancedAnalytics,
      recordingPlayback: !!b.recordingPlayback,
      aiScribe: !!b.aiScribe,
    };
  }
}
