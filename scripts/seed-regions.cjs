// Seeds supported regions and sets the test doctor's practice region.
// Run: node -r ./apps/api/load-env.cjs scripts/seed-regions.cjs
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const REGIONS = [
  { code: 'NG', name: 'Nigeria', currencyCode: 'NGN', currencySymbol: '₦' },
  { code: 'GH', name: 'Ghana', currencyCode: 'GHS', currencySymbol: 'GH₵' },
  { code: 'KE', name: 'Kenya', currencyCode: 'KES', currencySymbol: 'KSh' },
  { code: 'EG', name: 'Egypt', currencyCode: 'EGP', currencySymbol: 'E£' },
  { code: 'ZA', name: 'South Africa', currencyCode: 'ZAR', currencySymbol: 'R' },
];

(async () => {
  for (const r of REGIONS) {
    await prisma.region.upsert({
      where: { code: r.code },
      update: { name: r.name, currencyCode: r.currencyCode, currencySymbol: r.currencySymbol, gateway: 'PAYSTACK', isActive: true },
      create: { ...r, gateway: 'PAYSTACK', isActive: true },
    });
  }
  await prisma.doctor.update({
    where: { email: 'rxdoc@doctium.com' },
    data: { nationality: 'NG', practiceCountry: 'NG', currency: 'NGN' },
  });
  console.log('Seeded', REGIONS.length, 'regions; rxdoc set to NG.');
  await prisma.$disconnect();
})().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
