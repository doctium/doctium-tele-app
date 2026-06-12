// Seeds RBAC roles, departments, and the super-admin Employee (the admin-panel login).
// Run: node -r ./apps/api/load-env.cjs scripts/seed-hr.cjs
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcrypt");
const prisma = new PrismaClient();

const ROLES = [
  {
    name: "Super Admin",
    description: "Full, unrestricted access.",
    isSystem: true,
    permissions: [],
  },
  {
    name: "HR Manager",
    description: "Manage staff, payroll, leave and roles.",
    permissions: [
      "dashboard.view",
      "hr.view",
      "hr.manage",
      "hr.payroll",
      "hr.roles",
      "audit.view",
    ],
  },
  {
    name: "Finance",
    description: "Transactions, withdrawals, subscriptions, coupons.",
    permissions: [
      "dashboard.view",
      "finance.view",
      "finance.manage",
      "subscriptions.view",
      "subscriptions.manage",
      "coupons.manage",
    ],
  },
  {
    name: "Doctor Relations",
    description: "Doctor management and KYC verification.",
    permissions: [
      "dashboard.view",
      "doctors.view",
      "doctors.manage",
      "doctors.verify",
      "content.view",
    ],
  },
  {
    name: "Support",
    description: "Customers, appointments, feedback and support chat.",
    permissions: [
      "dashboard.view",
      "users.view",
      "users.manage",
      "appointments.view",
      "content.view",
      "content.moderate",
      "comms.support_view",
      "comms.support_reply",
    ],
  },
];

const DEPARTMENTS = [
  "Management",
  "Engineering",
  "Operations",
  "Medical",
  "Finance",
  "Support",
  "Human Resources",
];

const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL || "admin@doctium.com";
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD || "admin123";

(async () => {
  let superRoleId = null;
  for (const r of ROLES) {
    const row = await prisma.role.upsert({
      where: { name: r.name },
      update: {
        description: r.description,
        permissions: r.permissions,
        isSystem: !!r.isSystem,
      },
      create: {
        name: r.name,
        description: r.description,
        permissions: r.permissions,
        isSystem: !!r.isSystem,
      },
    });
    if (r.name === "Super Admin") superRoleId = row.id;
  }

  for (const name of DEPARTMENTS) {
    await prisma.department.upsert({
      where: { name },
      update: {},
      create: { name },
    });
  }

  const password = await bcrypt.hash(ADMIN_PASSWORD, 12);
  await prisma.employee.upsert({
    where: { email: ADMIN_EMAIL },
    update: {
      password,
      isSuperAdmin: true,
      canLogin: true,
      isActive: true,
      status: "ACTIVE",
      roleId: superRoleId,
    },
    create: {
      name: "Doctium Admin",
      email: ADMIN_EMAIL,
      password,
      position: "Administrator",
      isSuperAdmin: true,
      canLogin: true,
      isActive: true,
      status: "ACTIVE",
      roleId: superRoleId,
    },
  });

  console.log(
    `Seeded ${ROLES.length} roles, ${DEPARTMENTS.length} departments, and super-admin ${ADMIN_EMAIL}.`,
  );
  console.log(`Admin login -> ${ADMIN_EMAIL} / ${ADMIN_PASSWORD}`);
  await prisma.$disconnect();
})().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
