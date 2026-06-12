// Backfills existing doctors as VERIFIED (so the verified-only discovery gate doesn't hide them)
// and seeds the KYC configuration settings.
// Run: node -r ./apps/api/load-env.cjs scripts/seed-kyc.cjs
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const SETTINGS = [
  { key: 'kyc_required_docs', value: JSON.stringify(['CV', 'MEDICAL_LICENSE', 'DEGREE_CERTIFICATE', 'GOVERNMENT_ID']) },
  { key: 'kyc_license_reminder_days', value: '30,7,1' },
  { key: 'license_verifier', value: 'MANUAL' },
];

(async () => {
  // Backfill: any doctor still on the NEW default becomes VERIFIED (pre-existing accounts stay live).
  const res = await prisma.doctor.updateMany({
    where: { verificationStatus: 'NEW' },
    data: { verificationStatus: 'VERIFIED', isVerified: true },
  });
  for (const s of SETTINGS) {
    await prisma.setting.upsert({ where: { key: s.key }, update: { value: s.value }, create: s });
  }
  console.log(`Backfilled ${res.count} existing doctor(s) to VERIFIED; seeded ${SETTINGS.length} KYC settings.`);
  await prisma.$disconnect();
})().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
