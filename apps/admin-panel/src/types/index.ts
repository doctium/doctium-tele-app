export interface AdminStats {
  users: number;
  doctors: number;
  appointments: number;
  revenue: number;
  adminEarning: number;
}

export interface TopDoctor {
  doctorId: string;
  name: string;
  doctorImage?: string;
  appointment: number;
  amount: number;
  adminEarning: number;
  doctorEarning: number;
}

export interface User {
  id: string;
  name: string;
  email: string;
  mobile: string;
  image?: string;
  isBlock: boolean;
  createdAt: string;
}

export interface Doctor {
  id: string;
  name: string;
  email: string;
  mobile: string;
  image?: string;
  designation: string;
  rating: number;
  reviewCount: number;
  isBlock: boolean;
  createdAt: string;
  verificationStatus?:
    | "NEW"
    | "PENDING_KYC"
    | "UNDER_REVIEW"
    | "VERIFIED"
    | "REJECTED"
    | "EXPIRED";
  isVerified?: boolean;
  licenseExpiry?: string | null;
  kycSubmittedAt?: string | null;
}

export interface KycDocument {
  id: string;
  type: string;
  fileUrl: string;
  fileName: string;
  mimeType: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  rejectionReason: string;
  expiresAt?: string | null;
  reviewedAt?: string | null;
  createdAt: string;
}

export interface DoctorKyc {
  id: string;
  name: string;
  email: string;
  mobile: string;
  image?: string;
  designation: string;
  verificationStatus: Doctor["verificationStatus"];
  isVerified: boolean;
  mdcnFolioNumber: string;
  licenseNumber: string;
  licenseExpiry?: string | null;
  verifiedAt?: string | null;
  verificationNotes: string;
  rejectionReason: string;
  kycSubmittedAt?: string | null;
  kycDocuments: KycDocument[];
}

export interface Appointment {
  id: string;
  appointmentId: string;
  /** Sequential human-friendly booking reference (starts at 100001). */
  bookingNumber?: number;
  userId?: string;
  date: string;
  time: string;
  status: string;
  type: string;
  amount: number;
  adminEarning: number;
  doctorEarning: number;
  couponCode?: string;
  user?: { name: string; image?: string };
  doctor?: { name: string; image?: string };
  service?: { name: string };
}

// ── HR / RBAC ──
export interface Role {
  id: string;
  name: string;
  description: string;
  permissions: string[];
  isSystem: boolean;
  _count?: { employees: number };
}
export interface Department {
  id: string;
  name: string;
  description: string;
  _count?: { employees: number };
}
export interface Employee {
  id: string;
  name: string;
  email: string;
  phone?: string;
  image?: string;
  position?: string;
  employmentType?: string;
  status?: string;
  hireDate?: string | null;
  departmentId?: string | null;
  managerId?: string | null;
  salary?: number;
  currency?: string;
  payCycle?: string;
  leaveBalance?: number;
  canLogin?: boolean;
  roleId?: string | null;
  isSuperAdmin?: boolean;
  isActive?: boolean;
  createdAt: string;
  department?: { id?: string; name: string } | null;
  role?: { id?: string; name: string } | null;
  manager?: { id: string; name: string } | null;
  documents?: EmployeeDocument[];
  payslips?: Payslip[];
  leaveRequests?: LeaveRequest[];
}
export interface EmployeeDocument {
  id: string;
  type: string;
  fileUrl: string;
  fileName: string;
  mimeType: string;
  expiresAt?: string | null;
  createdAt: string;
}
export interface Payslip {
  id: string;
  periodLabel: string;
  periodStart: string;
  periodEnd: string;
  gross: number;
  deductions: number;
  net: number;
  currency: string;
  status: "DRAFT" | "PAID";
  paidAt?: string | null;
  notes: string;
  createdAt: string;
}
export interface LeaveRequest {
  id: string;
  type: string;
  startDate: string;
  endDate: string;
  days: number;
  reason: string;
  status: "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";
  decisionNote: string;
  createdAt: string;
  employee?: {
    id: string;
    name: string;
    image?: string;
    leaveBalance?: number;
  };
}
export interface AuditEntry {
  id: string;
  actorName: string;
  action: string;
  entityType: string;
  entityId: string;
  createdAt: string;
}
export interface PermissionGroup {
  group: string;
  permissions: { key: string; label: string }[];
}

export interface Banner {
  id: string;
  title: string;
  image: string;
  type: "EXTERNAL" | "APP";
  target: string;
  isActive: boolean;
  sortOrder: number;
  startsAt?: string | null;
  endsAt?: string | null;
  clickCount: number;
}

export interface Coupon {
  id: string;
  code: string;
  title: string;
  description: string;
  expiryDate: string;
  discountPercent?: number;
  maxDiscount?: number;
  minAmountToApply: number;
  type: string;
  discountType: string;
  isActive: boolean;
}

export interface Service {
  id: string;
  name: string;
  image?: string;
  status: boolean;
  isDelete: boolean;
}

// ── DoctiumPlus subscriptions ──
export interface SubscriptionPlan {
  id: string;
  code: string;
  name: string;
  description: string;
  audience: "USER" | "DOCTOR";
  interval: "MONTHLY" | "QUARTERLY" | "YEARLY";
  price: number;
  currency: string;
  trialDays: number;
  isActive: boolean;
  sortOrder: number;
  benefits: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface AdminSubscription {
  id: string;
  subscriberType: "USER" | "DOCTOR";
  status: "PENDING" | "ACTIVE" | "PAST_DUE" | "CANCELLED" | "EXPIRED";
  planName: string;
  priceAtSignup: number;
  currency: string;
  paymentSource: string;
  lastFour?: string | null;
  currentPeriodStart?: string | null;
  currentPeriodEnd?: string | null;
  cancelAtPeriodEnd: boolean;
  createdAt: string;
  subscriberName?: string | null;
  subscriberEmail?: string | null;
  plan?: { name: string; code: string; audience: string };
}

export interface SubscriptionRevenue {
  mrr: number;
  arr: number;
  activeCount: number;
  pastDueCount: number;
  cancelledCount: number;
  totalCollected: number;
  byPlan: { planName: string; audience: string; count: number; mrr: number }[];
}

export interface WithdrawRequest {
  id: string;
  amount: number;
  status: string;
  createdAt: string;
  payDate?: string;
  declineReason?: string;
  paymentDetails?: {
    accountNumber?: string;
    bankCode?: string;
    bankName?: string;
    accountName?: string;
  } | null;
  doctor?: { id: string; name: string; image?: string };
}

export interface Review {
  id: string;
  review: string;
  rating: number;
  createdAt: string;
  userId?: string;
  user?: { name: string; image?: string };
  doctor?: { name: string; image?: string };
}

export interface Complain {
  id: string;
  message: string;
  role: string;
  status: string;
  image?: string;
  createdAt: string;
  user?: { name: string; image?: string };
  doctor?: { name: string; image?: string };
}
