import { BadRequestException, Injectable } from "@nestjs/common";
import { prisma } from "@doctium/database";

@Injectable()
export class CouponsService {
  async validateCoupon(code: string, userId: string, amount: number) {
    const coupon = await prisma.coupon.findUnique({
      where: { code, isActive: true },
    });
    if (!coupon) throw new BadRequestException("Invalid coupon code");
    if (coupon.expiryDate && new Date(coupon.expiryDate) < new Date()) {
      throw new BadRequestException("Coupon has expired");
    }
    if (coupon.minAmountToApply > amount) {
      throw new BadRequestException(
        `Minimum order amount is ₦${(coupon.minAmountToApply / 100).toLocaleString()}`,
      );
    }

    const alreadyUsed = await prisma.couponUser.findUnique({
      where: { couponId_userId: { couponId: coupon.id, userId } },
    });
    if (alreadyUsed) throw new BadRequestException("Coupon already used");

    // FLAT stores kobo in discountPercent; PERCENT stores a %. Money is whole kobo.
    const discount =
      coupon.discountType === "FLAT"
        ? (coupon.discountPercent ?? 0)
        : Math.min(
            Math.round((amount * (coupon.discountPercent ?? 0)) / 100),
            coupon.maxDiscount ?? Infinity,
          );

    return { valid: true, discount, finalAmount: amount - discount };
  }
}
