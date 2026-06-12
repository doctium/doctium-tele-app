// One-off: give every existing user a unique 10-char referral code.
// New signups get one automatically; getProfile also lazy-generates.
// Run: node --env-file=.env scripts/backfill-referral-codes.cjs
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const CHARS = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const gen = () =>
  Array.from({ length: 10 }, () => CHARS[Math.floor(Math.random() * CHARS.length)]).join("");

(async () => {
  const users = await prisma.user.findMany({
    where: { referralCode: null },
    select: { id: true },
  });
  let done = 0;
  for (const u of users) {
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        await prisma.user.update({
          where: { id: u.id },
          data: { referralCode: gen() },
        });
        done++;
        break;
      } catch {
        /* unique collision — retry */
      }
    }
  }
  console.log(`Backfilled referral codes for ${done}/${users.length} users.`);
  await prisma.$disconnect();
})().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
