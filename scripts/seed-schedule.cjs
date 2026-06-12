// Gives the test doctor a weekday schedule so scheduled-slot validation can be exercised.
// Run: node -r ./apps/api/load-env.cjs scripts/seed-schedule.cjs
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

(async () => {
  const doctor = await prisma.doctor.findUnique({ where: { email: 'rxdoc@doctium.com' }, select: { id: true } });
  await prisma.doctorSchedule.deleteMany({ where: { doctorId: doctor.id } });
  await prisma.doctorSchedule.createMany({
    data: DAYS.map((day) => ({ doctorId: doctor.id, day, startTime: '09:00', endTime: '17:00', timeSlot: 30, isBreak: false })),
  });
  console.log(`Seeded ${DAYS.length} weekday schedules for rxdoc (09:00–17:00, 30-min slots).`);
  await prisma.$disconnect();
})().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
