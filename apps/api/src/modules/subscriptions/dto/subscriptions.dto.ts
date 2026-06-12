import { BillingInterval, PaymentSource, SubscriberType } from '@doctium/types';

export interface SubscribeDto {
  planId: string;
  paymentSource?: PaymentSource; // CARD (default) | WALLET
}

export interface CreatePlanDto {
  code: string;
  name: string;
  description?: string;
  audience: SubscriberType;
  interval?: BillingInterval;
  price: number;
  currency?: string;
  trialDays?: number;
  isActive?: boolean;
  sortOrder?: number;
  benefits?: Record<string, unknown>;
}

export type UpdatePlanDto = Partial<CreatePlanDto>;
