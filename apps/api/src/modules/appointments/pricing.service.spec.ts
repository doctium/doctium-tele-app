// Mock the shared Prisma singleton so these stay pure unit tests (no DB).
jest.mock("@doctium/database", () => ({
  prisma: { setting: { findUnique: jest.fn() } },
}));

import { prisma } from "@doctium/database";
import { PricingService } from "./pricing.service";

const settingMock = (
  prisma as unknown as {
    setting: { findUnique: jest.Mock };
  }
).setting.findUnique;

const doctor = (
  over: Partial<Parameters<PricingService["computeFee"]>[0]> = {},
) => ({
  scheduledFee: 5000,
  instantDayFee: 8000,
  instantNightFee: 12000,
  charge: 3000,
  commission: 0,
  currency: "NGN",
  ...over,
});

describe("PricingService", () => {
  const svc = new PricingService();

  describe("isNight", () => {
    const win = { start: "20:00", end: "06:00" }; // wraps past midnight
    it("treats late-evening time as night", () => {
      expect(svc.isNight("22:30", win)).toBe(true);
    });
    it("treats early-morning time as night", () => {
      expect(svc.isNight("05:00", win)).toBe(true);
    });
    it("treats midday as day", () => {
      expect(svc.isNight("13:00", win)).toBe(false);
    });
    it("treats the end boundary as day (exclusive)", () => {
      expect(svc.isNight("06:00", win)).toBe(false);
    });
    it("handles a non-wrapping window (membership inside [start,end))", () => {
      const w = { start: "08:00", end: "17:00" };
      expect(svc.isNight("12:00", w)).toBe(true); // inside the window
      expect(svc.isNight("19:00", w)).toBe(false); // outside the window
    });
  });

  describe("activeDiscountPercent", () => {
    it("returns 0 when the promotion is off", () => {
      expect(svc.activeDiscountPercent(doctor({ discountActive: false }))).toBe(
        0,
      );
    });
    it("returns the percent when active and unexpired", () => {
      expect(
        svc.activeDiscountPercent(
          doctor({ discountActive: true, discountPercent: 20 }),
        ),
      ).toBe(20);
    });
    it("returns 0 when expired", () => {
      expect(
        svc.activeDiscountPercent(
          doctor({
            discountActive: true,
            discountPercent: 20,
            discountEndsAt: new Date("2000-01-01"),
          }),
        ),
      ).toBe(0);
    });
    it("clamps above 100", () => {
      expect(
        svc.activeDiscountPercent(
          doctor({ discountActive: true, discountPercent: 250 }),
        ),
      ).toBe(100);
    });
  });

  describe("computeFee (scheduled — no DB)", () => {
    it("uses the scheduled fee with no promotion", async () => {
      const r = await svc.computeFee(doctor(), "SCHEDULED", "10:00");
      expect(r).toMatchObject({
        amount: 5000,
        originalAmount: 5000,
        currency: "NGN",
      });
      expect(settingMock).not.toHaveBeenCalled();
    });
    it("applies a promotion and rounds to whole kobo", async () => {
      const r = await svc.computeFee(
        doctor({
          scheduledFee: 4999,
          discountActive: true,
          discountPercent: 33,
        }),
        "SCHEDULED",
        "10:00",
      );
      // 4999 * (1 - 0.33) = 3349.33 → rounds to 3349
      expect(r.amount).toBe(3349);
      expect(r.originalAmount).toBe(4999);
      expect(r.doctorDiscountPercent).toBe(33);
    });
    it("falls back to legacy charge when no scheduled fee is set", async () => {
      const r = await svc.computeFee(
        doctor({ scheduledFee: 0, charge: 3000 }),
        "SCHEDULED",
        "10:00",
      );
      expect(r.amount).toBe(3000);
    });
  });

  describe("commissionPercent", () => {
    it("uses the doctor's Business Agreement rate when set (no DB)", async () => {
      expect(await svc.commissionPercent(15)).toBe(15);
      expect(settingMock).not.toHaveBeenCalled();
    });
    it("clamps a doctor rate above 100", async () => {
      expect(await svc.commissionPercent(150)).toBe(100);
    });
    it("falls back to the app-wide setting when the doctor rate is 0", async () => {
      settingMock.mockResolvedValueOnce({ value: "12" });
      expect(await svc.commissionPercent(0)).toBe(12);
    });
    it("returns 0 when no rate is configured anywhere", async () => {
      settingMock.mockResolvedValueOnce(null);
      expect(await svc.commissionPercent(0)).toBe(0);
    });
  });
});
