-- Kobo migration: true-money Float → Int (kobo), ×100 existing values.
ALTER TABLE "doctors" ALTER COLUMN "charge" DROP DEFAULT, ALTER COLUMN "charge" TYPE INTEGER USING ROUND("charge" * 100)::integer, ALTER COLUMN "charge" SET DEFAULT 0;
ALTER TABLE "doctors" ALTER COLUMN "scheduledFee" DROP DEFAULT, ALTER COLUMN "scheduledFee" TYPE INTEGER USING ROUND("scheduledFee" * 100)::integer, ALTER COLUMN "scheduledFee" SET DEFAULT 0;
ALTER TABLE "doctors" ALTER COLUMN "instantDayFee" DROP DEFAULT, ALTER COLUMN "instantDayFee" TYPE INTEGER USING ROUND("instantDayFee" * 100)::integer, ALTER COLUMN "instantDayFee" SET DEFAULT 0;
ALTER TABLE "doctors" ALTER COLUMN "instantNightFee" DROP DEFAULT, ALTER COLUMN "instantNightFee" TYPE INTEGER USING ROUND("instantNightFee" * 100)::integer, ALTER COLUMN "instantNightFee" SET DEFAULT 0;
ALTER TABLE "appointments" ALTER COLUMN "amount" DROP DEFAULT, ALTER COLUMN "amount" TYPE INTEGER USING ROUND("amount" * 100)::integer, ALTER COLUMN "amount" SET DEFAULT 0;
ALTER TABLE "appointments" ALTER COLUMN "tax" DROP DEFAULT, ALTER COLUMN "tax" TYPE INTEGER USING ROUND("tax" * 100)::integer, ALTER COLUMN "tax" SET DEFAULT 0;
ALTER TABLE "appointments" ALTER COLUMN "withoutTax" DROP DEFAULT, ALTER COLUMN "withoutTax" TYPE INTEGER USING ROUND("withoutTax" * 100)::integer, ALTER COLUMN "withoutTax" SET DEFAULT 0;
ALTER TABLE "appointments" ALTER COLUMN "discount" DROP DEFAULT, ALTER COLUMN "discount" TYPE INTEGER USING ROUND("discount" * 100)::integer, ALTER COLUMN "discount" SET DEFAULT 0;
ALTER TABLE "appointments" ALTER COLUMN "adminEarning" DROP DEFAULT, ALTER COLUMN "adminEarning" TYPE INTEGER USING ROUND("adminEarning" * 100)::integer, ALTER COLUMN "adminEarning" SET DEFAULT 0;
ALTER TABLE "appointments" ALTER COLUMN "doctorEarning" DROP DEFAULT, ALTER COLUMN "doctorEarning" TYPE INTEGER USING ROUND("doctorEarning" * 100)::integer, ALTER COLUMN "doctorEarning" SET DEFAULT 0;
ALTER TABLE "appointments" ALTER COLUMN "memberDiscount" DROP DEFAULT, ALTER COLUMN "memberDiscount" TYPE INTEGER USING ROUND("memberDiscount" * 100)::integer, ALTER COLUMN "memberDiscount" SET DEFAULT 0;
ALTER TABLE "referrals" ALTER COLUMN "commissionAmount" DROP DEFAULT, ALTER COLUMN "commissionAmount" TYPE INTEGER USING ROUND("commissionAmount" * 100)::integer, ALTER COLUMN "commissionAmount" SET DEFAULT 0;
ALTER TABLE "user_wallets" ALTER COLUMN "balance" DROP DEFAULT, ALTER COLUMN "balance" TYPE INTEGER USING ROUND("balance" * 100)::integer, ALTER COLUMN "balance" SET DEFAULT 0;
ALTER TABLE "user_wallet_history" ALTER COLUMN "amount" TYPE INTEGER USING ROUND("amount" * 100)::integer;
ALTER TABLE "doctor_wallets" ALTER COLUMN "balance" DROP DEFAULT, ALTER COLUMN "balance" TYPE INTEGER USING ROUND("balance" * 100)::integer, ALTER COLUMN "balance" SET DEFAULT 0;
ALTER TABLE "doctor_wallets" ALTER COLUMN "total" DROP DEFAULT, ALTER COLUMN "total" TYPE INTEGER USING ROUND("total" * 100)::integer, ALTER COLUMN "total" SET DEFAULT 0;
ALTER TABLE "doctor_wallet_history" ALTER COLUMN "amount" TYPE INTEGER USING ROUND("amount" * 100)::integer;
ALTER TABLE "withdraw_requests" ALTER COLUMN "amount" DROP DEFAULT, ALTER COLUMN "amount" TYPE INTEGER USING ROUND("amount" * 100)::integer, ALTER COLUMN "amount" SET DEFAULT 0;
ALTER TABLE "coupons" ALTER COLUMN "maxDiscount" TYPE INTEGER USING ROUND("maxDiscount" * 100)::integer;
ALTER TABLE "coupons" ALTER COLUMN "minAmountToApply" DROP DEFAULT, ALTER COLUMN "minAmountToApply" TYPE INTEGER USING ROUND("minAmountToApply" * 100)::integer, ALTER COLUMN "minAmountToApply" SET DEFAULT 0;
ALTER TABLE "payment_transactions" ALTER COLUMN "amount" TYPE INTEGER USING ROUND("amount" * 100)::integer;
ALTER TABLE "subscription_plans" ALTER COLUMN "price" TYPE INTEGER USING ROUND("price" * 100)::integer;
ALTER TABLE "subscriptions" ALTER COLUMN "priceAtSignup" TYPE INTEGER USING ROUND("priceAtSignup" * 100)::integer;
ALTER TABLE "subscription_invoices" ALTER COLUMN "amount" TYPE INTEGER USING ROUND("amount" * 100)::integer;
ALTER TABLE "employees" ALTER COLUMN "salary" DROP DEFAULT, ALTER COLUMN "salary" TYPE INTEGER USING ROUND("salary" * 100)::integer, ALTER COLUMN "salary" SET DEFAULT 0;
ALTER TABLE "payslips" ALTER COLUMN "gross" TYPE INTEGER USING ROUND("gross" * 100)::integer;
ALTER TABLE "payslips" ALTER COLUMN "deductions" DROP DEFAULT, ALTER COLUMN "deductions" TYPE INTEGER USING ROUND("deductions" * 100)::integer, ALTER COLUMN "deductions" SET DEFAULT 0;
ALTER TABLE "payslips" ALTER COLUMN "net" TYPE INTEGER USING ROUND("net" * 100)::integer;

-- Coupon.discountPercent is dual-purpose (% for PERCENT, flat naira for FLAT).
-- It STAYS Float; only the FLAT rows hold money and get ×100.
UPDATE "coupons" SET "discountPercent" = ROUND("discountPercent" * 100) WHERE "discountType" = 'FLAT';

