// ── DoctiumPlus subscriptions ──

export type SubscriberType = "USER" | "DOCTOR";
export type BillingInterval = "MONTHLY" | "QUARTERLY" | "YEARLY";
export type SubscriptionStatus =
  | "PENDING"
  | "ACTIVE"
  | "PAST_DUE"
  | "CANCELLED"
  | "EXPIRED";
export type SubscriptionInvoiceStatus = "PENDING" | "PAID" | "FAILED";
export type PaymentSource = "CARD" | "WALLET";

/** Benefit config stored on a patient (audience=USER) SubscriptionPlan.benefits JSON. */
export interface PatientPlanBenefits {
  /** Included consult credits per billing cycle. */
  consultsPerCycle: number;
  /** % off consults beyond the included credits (and other paid items). */
  memberDiscountPercent: number;
  /** Max dependents (SubPatient) the account may add. */
  familyCap: number;
  unlimitedChat?: boolean;
  priorityBooking?: boolean;
  freeRxDelivery?: boolean;
  waivedBookingFee?: boolean;
  /** Unlocks secure replay of consented recorded consultations. */
  recordingPlayback?: boolean;
  /** Lifts Leenah's daily symptom-check / health-question session caps. */
  unlimitedTriage?: boolean;
}

/** Benefit config stored on a doctor (audience=DOCTOR) SubscriptionPlan.benefits JSON. */
export interface DoctorPlanBenefits {
  /** Override commission %. null = platform default applies. Only ever LOWERS commission. */
  commissionPercent: number | null;
  /** Boosted ranking + badge in patient discovery. */
  featured: boolean;
  /** Unlocks the advanced earnings/patient analytics view. */
  advancedAnalytics: boolean;
  /** Unlocks secure review/playback of consented recorded consultations. */
  recordingPlayback?: boolean;
  /** Unlocks the AI clinical scribe (draft SOAP notes from chat/dictation). */
  aiScribe?: boolean;
}

export type PlanBenefits = PatientPlanBenefits | DoctorPlanBenefits;

export interface SubscriptionPlan {
  id: string;
  code: string;
  name: string;
  description: string;
  audience: SubscriberType;
  interval: BillingInterval;
  price: number;
  currency: string;
  trialDays: number;
  isActive: boolean;
  sortOrder: number;
  benefits: PlanBenefits;
  createdAt: Date;
  updatedAt: Date;
}

export interface Subscription {
  id: string;
  planId: string;
  subscriberType: SubscriberType;
  userId?: string | null;
  doctorId?: string | null;
  status: SubscriptionStatus;
  authorizationCode?: string | null;
  customerCode?: string | null;
  lastFour?: string | null;
  cardBrand?: string | null;
  paymentSource: PaymentSource;
  currentPeriodStart?: Date | null;
  currentPeriodEnd?: Date | null;
  cancelAtPeriodEnd: boolean;
  cancelledAt?: Date | null;
  failedAttempts: number;
  graceUntil?: Date | null;
  priceAtSignup: number;
  currency: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface SubscriptionUsage {
  id: string;
  subscriptionId: string;
  periodStart: Date;
  periodEnd: Date;
  creditsTotal: number;
  creditsUsed: number;
}

/** Normalized entitlement snapshot a patient gets from EntitlementsService. */
export interface PatientEntitlements {
  active: boolean;
  planCode: string | null;
  subscriptionId: string | null;
  usageId: string | null;
  consultsRemaining: number;
  memberDiscountPercent: number;
  familyCap: number;
  unlimitedChat: boolean;
  priorityBooking: boolean;
  freeRxDelivery: boolean;
  waivedBookingFee: boolean;
  recordingPlayback: boolean;
  unlimitedTriage: boolean;
}

/** Normalized entitlement snapshot a doctor gets from EntitlementsService. */
export interface DoctorEntitlements {
  active: boolean;
  planCode: string | null;
  subscriptionId: string | null;
  commissionPercent: number | null;
  isFeatured: boolean;
  advancedAnalytics: boolean;
  recordingPlayback: boolean;
  aiScribe: boolean;
}
