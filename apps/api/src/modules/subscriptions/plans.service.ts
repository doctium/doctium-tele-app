import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { prisma } from '@doctium/database';
import { SubscriberType } from '@doctium/types';
import { CreatePlanDto, UpdatePlanDto } from './dto/subscriptions.dto';

@Injectable()
export class PlansService {
  /** Public catalog — active tiers for one audience, in display order. */
  listActivePlans(audience: SubscriberType) {
    return prisma.subscriptionPlan.findMany({
      where: { audience, isActive: true },
      orderBy: { sortOrder: 'asc' },
    });
  }

  async getPlan(id: string) {
    const plan = await prisma.subscriptionPlan.findUnique({ where: { id } });
    if (!plan) throw new NotFoundException('Plan not found');
    return plan;
  }

  // ── Admin ──────────────────────────────────────────────────
  listAllPlans() {
    return prisma.subscriptionPlan.findMany({ orderBy: [{ audience: 'asc' }, { sortOrder: 'asc' }] });
  }

  createPlan(dto: CreatePlanDto) {
    return prisma.subscriptionPlan.create({
      data: {
        code: dto.code,
        name: dto.name,
        description: dto.description ?? '',
        audience: dto.audience as never,
        interval: (dto.interval ?? 'MONTHLY') as never,
        price: Number(dto.price) || 0,
        currency: dto.currency ?? 'NGN',
        trialDays: Number(dto.trialDays) || 0,
        isActive: dto.isActive ?? true,
        sortOrder: Number(dto.sortOrder) || 0,
        benefits: (dto.benefits ?? {}) as never,
      },
    });
  }

  updatePlan(id: string, dto: UpdatePlanDto) {
    return prisma.subscriptionPlan.update({
      where: { id },
      data: {
        ...(dto.code !== undefined && { code: dto.code }),
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.audience !== undefined && { audience: dto.audience as never }),
        ...(dto.interval !== undefined && { interval: dto.interval as never }),
        ...(dto.price !== undefined && { price: Number(dto.price) || 0 }),
        ...(dto.currency !== undefined && { currency: dto.currency }),
        ...(dto.trialDays !== undefined && { trialDays: Number(dto.trialDays) || 0 }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
        ...(dto.sortOrder !== undefined && { sortOrder: Number(dto.sortOrder) || 0 }),
        ...(dto.benefits !== undefined && { benefits: dto.benefits as never }),
      },
    });
  }

  togglePlan(id: string, isActive: boolean) {
    return prisma.subscriptionPlan.update({ where: { id }, data: { isActive } });
  }

  /** Only deletable when nothing references it; otherwise deactivate to preserve history. */
  async deletePlan(id: string) {
    const count = await prisma.subscription.count({ where: { planId: id } });
    if (count > 0) {
      throw new BadRequestException('This plan has subscribers — deactivate it instead of deleting.');
    }
    await prisma.subscriptionPlan.delete({ where: { id } });
    return { deleted: true };
  }
}
