// Toggles a tamper on the latest prescription's first item to prove signature
// verification catches alteration. Usage: node ... rx-tamper.cjs on|off
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const mode = process.argv[2];
(async () => {
  const rx = await prisma.prescription.findFirst({ orderBy: { createdAt: 'desc' }, include: { items: true } });
  const item = rx.items[0];
  const tampered = item.drugName.endsWith(' X');
  if (mode === 'on' && !tampered) await prisma.prescriptionItem.update({ where: { id: item.id }, data: { drugName: item.drugName + ' X' } });
  if (mode === 'off' && tampered) await prisma.prescriptionItem.update({ where: { id: item.id }, data: { drugName: item.drugName.slice(0, -2) } });
  console.log(rx.code);
  await prisma.$disconnect();
})().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
