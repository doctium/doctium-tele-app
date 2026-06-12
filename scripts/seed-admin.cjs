// Idempotent admin seed — the admin-panel login is now an Employee (super-admin).
// For full RBAC seeding (roles + departments) run scripts/seed-hr.cjs instead.
// Run: node -r ./apps/api/load-env.cjs scripts/seed-admin.cjs
const bcrypt = require("bcrypt");
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const EMAIL = process.env.SEED_ADMIN_EMAIL || "admin@doctium.com";
const PASSWORD = process.env.SEED_ADMIN_PASSWORD || "admin123";

(async () => {
  const password = await bcrypt.hash(PASSWORD, 12);
  const superRole = await prisma.role.findUnique({
    where: { name: "Super Admin" },
  });
  const admin = await prisma.employee.upsert({
    where: { email: EMAIL },
    update: {
      password,
      isSuperAdmin: true,
      canLogin: true,
      isActive: true,
      status: "ACTIVE",
    },
    create: {
      email: EMAIL,
      password,
      name: "Doctium Admin",
      position: "Administrator",
      isSuperAdmin: true,
      canLogin: true,
      isActive: true,
      status: "ACTIVE",
      roleId: superRole ? superRole.id : undefined,
    },
    select: { id: true, email: true, name: true },
  });
  console.log("Admin ready:", admin);
  console.log(`Login -> email: ${EMAIL}  password: ${PASSWORD}`);
  await prisma.$disconnect();
})().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
