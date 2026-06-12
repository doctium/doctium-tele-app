import { Injectable } from "@nestjs/common";
import { prisma } from "@doctium/database";

export type AppointmentMode = "SCHEDULED" | "INSTANT";

interface DoctorPricing {
  scheduledFee: number;
  instantDayFee: number;
  instantNightFee: number;
  charge: number;
  commission: number;
  currency: string;
  discountActive?: boolean;
  discountPercent?: number;
  discountEndsAt?: Date | null;
}

@Injectable()
export class PricingService {
  private async setting(key: string, fallback: string): Promise<string> {
    const row = await prisma.setting.findUnique({ where: { key } });
    return row?.value || fallback;
  }

  async nightWindow(): Promise<{ start: string; end: string }> {
    return {
      start: await this.setting("night_window_start", "20:00"),
      end: await this.setting("night_window_end", "06:00"),
    };
  }

  /** Is a "HH:MM" time inside the night window (which may wrap past midnight)? */
  isNight(time: string, win: { start: string; end: string }): boolean {
    const toMin = (t: string) => {
      const [h, m] = t.split(":").map(Number);
      return (h || 0) * 60 + (m || 0);
    };
    const t = toMin(time),
      s = toMin(win.start),
      e = toMin(win.end);
    return s <= e ? t >= s && t < e : t >= s || t < e;
  }

  /** A doctor's live promotion %, or 0 when off / expired / out of range. */
  activeDiscountPercent(doctor: DoctorPricing): number {
    if (!doctor.discountActive) return 0;
    const pct = doctor.discountPercent || 0;
    if (pct <= 0) return 0;
    if (
      doctor.discountEndsAt &&
      new Date(doctor.discountEndsAt).getTime() < Date.now()
    )
      return 0;
    return Math.min(pct, 100);
  }

  /**
   * Charged fee + currency for a doctor / mode / local "HH:MM" time. Falls back to legacy `charge`.
   * `amount` is the price the patient is charged (after any live doctor promotion); `originalAmount`
   * is the pre-promotion fee so the UI can show a strikethrough + "% off" badge.
   */
  async computeFee(
    doctor: DoctorPricing,
    mode: AppointmentMode,
    time: string,
  ): Promise<{
    amount: number;
    currency: string;
    originalAmount: number;
    doctorDiscountPercent: number;
  }> {
    let fee: number;
    if (mode === "INSTANT") {
      const night = this.isNight(time, await this.nightWindow());
      // Use the relevant tier; if the doctor set only one instant fee, use it. NO base-charge
      // fallback — a doctor who hasn't set any instant fee does not offer instant consultations.
      fee = night
        ? doctor.instantNightFee || doctor.instantDayFee
        : doctor.instantDayFee || doctor.instantNightFee;
    } else {
      fee = doctor.scheduledFee || doctor.charge; // scheduled keeps the legacy fallback
    }
    const originalAmount = fee || 0;
    const pct = this.activeDiscountPercent(doctor);
    const amount =
      pct > 0 ? Math.round(originalAmount * (1 - pct / 100)) : originalAmount;
    return {
      amount,
      currency: doctor.currency || "NGN",
      originalAmount,
      doctorDiscountPercent: pct,
    };
  }

  /**
   * Commission % for a booking. A doctor-specific Business Agreement rate
   * (doctor.commission > 0) always wins; otherwise the app-wide default
   * (`admin_commission_percent` setting) prevails. 0 everywhere = no commission.
   */
  async commissionPercent(doctorCommission: number): Promise<number> {
    if (doctorCommission > 0) return Math.min(doctorCommission, 100);
    const v = await this.setting("admin_commission_percent", "");
    const global = v ? parseFloat(v) : NaN;
    return Number.isFinite(global) ? Math.min(Math.max(global, 0), 100) : 0;
  }
}
