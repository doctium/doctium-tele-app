// Seeds the default DoctiumPlus subscription tiers + related settings.
// Run: node -r ./apps/api/load-env.cjs scripts/seed-plans.cjs
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const PLANS = [
  // ── Patient tiers ──
  {
    code: "patient_basic",
    name: "Basic",
    audience: "USER",
    interval: "MONTHLY",
    price: 250000,
    sortOrder: 1, // ₦2,500 in kobo
    description: "1 consult/month + 10% off everything else.",
    benefits: {
      consultsPerCycle: 1,
      memberDiscountPercent: 10,
      familyCap: 1,
      waivedBookingFee: true,
    },
  },
  {
    code: "patient_family",
    name: "Family",
    audience: "USER",
    interval: "MONTHLY",
    price: 600000,
    sortOrder: 2, // ₦6,000 in kobo
    description: "Cover up to 5 loved ones, 3 consults/month + 15% off.",
    benefits: {
      consultsPerCycle: 3,
      memberDiscountPercent: 15,
      familyCap: 5,
      unlimitedChat: true,
      priorityBooking: true,
      freeRxDelivery: true,
      waivedBookingFee: true,
      unlimitedTriage: true,
    },
  },
  {
    code: "patient_pro",
    name: "Pro",
    audience: "USER",
    interval: "MONTHLY",
    price: 1200000,
    sortOrder: 3, // ₦12,000 in kobo
    description:
      "8 consults/month, 25% off, priority booking & free Rx delivery.",
    benefits: {
      consultsPerCycle: 8,
      memberDiscountPercent: 25,
      familyCap: 8,
      unlimitedChat: true,
      priorityBooking: true,
      freeRxDelivery: true,
      waivedBookingFee: true,
      unlimitedTriage: true,
    },
  },
  // ── Doctor tiers ──
  {
    code: "doctor_standard",
    name: "Standard",
    audience: "DOCTOR",
    interval: "MONTHLY",
    price: 0,
    sortOrder: 1,
    description: "The default — standard commission, standard listing.",
    benefits: {
      commissionPercent: null,
      featured: false,
      advancedAnalytics: false,
    },
  },
  {
    code: "doctor_featured",
    name: "Featured",
    audience: "DOCTOR",
    interval: "MONTHLY",
    price: 1000000,
    sortOrder: 2, // ₦10,000 in kobo
    description:
      "Lower 12% commission + a Featured badge that ranks you first.",
    benefits: {
      commissionPercent: 12,
      featured: true,
      advancedAnalytics: false,
    },
  },
  {
    code: "doctor_premium",
    name: "Premium",
    audience: "DOCTOR",
    interval: "MONTHLY",
    price: 2500000,
    sortOrder: 3, // ₦25,000 in kobo
    description: "Lowest 8% commission, top placement & advanced analytics.",
    benefits: { commissionPercent: 8, featured: true, advancedAnalytics: true },
  },
];

const SETTINGS = [
  { key: "free_family_cap", value: "1" },
  { key: "subscription_grace_days", value: "3" },
  { key: "subscription_max_retries", value: "3" },
  { key: "member_discount_stacks_with_coupon", value: "false" },
];

(async () => {
  for (const p of PLANS) {
    await prisma.subscriptionPlan.upsert({
      where: { code: p.code },
      update: {
        name: p.name,
        description: p.description,
        audience: p.audience,
        interval: p.interval,
        price: p.price,
        currency: "NGN",
        sortOrder: p.sortOrder,
        isActive: true,
        benefits: p.benefits,
      },
      create: {
        code: p.code,
        name: p.name,
        description: p.description,
        audience: p.audience,
        interval: p.interval,
        price: p.price,
        currency: "NGN",
        sortOrder: p.sortOrder,
        isActive: true,
        benefits: p.benefits,
      },
    });
  }
  for (const s of SETTINGS) {
    await prisma.setting.upsert({
      where: { key: s.key },
      update: { value: s.value },
      create: s,
    });
  }
  console.log(
    `Seeded ${PLANS.length} DoctiumPlus plans and ${SETTINGS.length} settings.`,
  );
  await prisma.$disconnect();
})().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
