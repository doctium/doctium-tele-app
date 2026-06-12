// Seeds a doctor, a patient, and a CONFIRMED appointment for testing the
// prescription flow end-to-end. Idempotent. Prints credentials + ids.
// Run: node -r ./apps/api/load-env.cjs scripts/seed-rx-test.cjs
const bcrypt = require('bcrypt');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

(async () => {
  const pw = await bcrypt.hash('test1234', 12);

  const doctor = await prisma.doctor.upsert({
    where: { email: 'rxdoc@doctium.com' },
    update: { password: pw },
    create: { email: 'rxdoc@doctium.com', password: pw, name: 'Ada Obi', designation: 'General Physician', clinicName: 'Doctium Clinic', mobile: '08000000001', charge: 5000 },
    select: { id: true },
  });

  const user = await prisma.user.upsert({
    where: { email: 'rxpatient@doctium.com' },
    update: { password: pw },
    create: { email: 'rxpatient@doctium.com', password: pw, name: 'John Patient', mobile: '08000000002' },
    select: { id: true },
  });

  const today = new Date().toISOString().slice(0, 10);
  const appt = await prisma.appointment.upsert({
    where: { appointmentId: 'seed-rx-appt-1' },
    update: { status: 'CONFIRMED' },
    create: {
      appointmentId: 'seed-rx-appt-1', userId: user.id, doctorId: doctor.id,
      date: today, time: '10:00', status: 'CONFIRMED', type: 'ONLINE',
      amount: 5000, doctorEarning: 4000, adminEarning: 1000,
    },
    select: { id: true },
  });

  // Ensure a pharmacy API key exists for the partner-endpoint test.
  await prisma.setting.upsert({ where: { key: 'pharmacy_api_key' }, update: { value: 'test-pharmacy-key' }, create: { key: 'pharmacy_api_key', value: 'test-pharmacy-key' } });

  console.log(JSON.stringify({ doctorId: doctor.id, userId: user.id, appointmentId: appt.id }, null, 2));
  console.log('Doctor login: rxdoc@doctium.com / test1234');
  console.log('Patient login: rxpatient@doctium.com / test1234');
  console.log('Pharmacy x-api-key: test-pharmacy-key');
  await prisma.$disconnect();
})().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
