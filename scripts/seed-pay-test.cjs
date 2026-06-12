// Sets up Phase-1 payments test data on the existing rxdoc/rxpatient seed.
// Run: node -r ./apps/api/load-env.cjs scripts/seed-pay-test.cjs
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

(async () => {
  const doctor = await prisma.doctor.update({
    where: { email: "rxdoc@doctium.com" },
    // Money is stored in kobo (minor units): ₦5,000 / ₦8,000 / ₦12,000. commission is a %.
    data: {
      scheduledFee: 500000,
      instantDayFee: 800000,
      instantNightFee: 1200000,
      commission: 0,
      isOnline: true,
      currency: "NGN",
    },
    select: { id: true },
  });
  const user = await prisma.user.findUnique({
    where: { email: "rxpatient@doctium.com" },
    select: { id: true },
  });

  await prisma.userWallet.upsert({
    where: { userId: user.id },
    update: { balance: 10000000 },
    create: { userId: user.id, balance: 10000000 }, // ₦100,000 in kobo
  });

  const settings = [
    ["admin_commission_percent", "20"],
    ["night_window_start", "20:00"],
    ["night_window_end", "06:00"],
    ["cancellation_cutoff_hours", "2"],
  ];
  for (const [key, value] of settings) {
    await prisma.setting.upsert({
      where: { key },
      update: { value },
      create: { key, value },
    });
  }

  await prisma.coupon.upsert({
    where: { code: "SAVE500" },
    update: {
      isActive: true,
      discountType: "FLAT",
      discountPercent: 50000,
      minAmountToApply: 0,
    },
    create: {
      code: "SAVE500",
      title: "Flat ₦500 off",
      discountType: "FLAT",
      discountPercent: 50000,
      minAmountToApply: 0,
      isActive: true,
    },
  });

  console.log(JSON.stringify({ doctorId: doctor.id, userId: user.id }));
  await prisma.$disconnect();
})().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
