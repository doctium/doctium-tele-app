/**
 * Seeds (or updates) the "Content Editor" role — the principal for the Website &
 * Media module. Holds only media.* permissions, so content editors can publish
 * blog / news / careers content without any clinical, finance or HR access.
 *
 * Run from the doctium-app root:
 *   node --env-file=.env scripts/seed-content-role.cjs
 */
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

const MEDIA_PERMISSIONS = [
  "media.blog.view",
  "media.blog.manage",
  "media.news.view",
  "media.news.manage",
  "media.careers.view",
  "media.careers.manage",
  "media.applications.view",
  "media.applications.manage",
  "media.landing.manage",
  "media.team.view",
  "media.team.manage",
];

async function main() {
  const role = await prisma.role.upsert({
    where: { name: "Content Editor" },
    update: { permissions: MEDIA_PERMISSIONS },
    create: {
      name: "Content Editor",
      description:
        "Manages website content — blog, news & press, and careers. No clinical, finance or HR access.",
      permissions: MEDIA_PERMISSIONS,
      isSystem: false,
    },
  });
  console.log(
    `✓ Role "${role.name}" (${role.id}) — ${role.permissions.length} permissions`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
