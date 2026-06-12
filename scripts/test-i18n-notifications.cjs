/**
 * Phase 2 — notifications in the patient's preferred language.
 *
 *   node --env-file=.env scripts/test-i18n-notifications.cjs
 *
 * Drives the real notifier path end-to-end: queue a due CHECK_IN_48H follow-up for
 * patients set to different `preferredLanguage`s, fire the admin follow-up sweep
 * (processDue → notifyUser with a catalog key), then assert each in-app Notification
 * row was rendered in that patient's language with the doctor name interpolated.
 * Also checks the English fallback for an untranslated language ('fr').
 */
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const BASE = "http://localhost:3001/api/v1";

let pass = 0;
let fail = 0;
const ok = (label, cond) => {
  console.log(`${cond ? "✅" : "❌"} ${label}`);
  cond ? pass++ : fail++;
};

const call = async (method, path, body, token) => {
  const r = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  let j;
  try {
    j = await r.json();
  } catch {
    j = {};
  }
  return { status: r.status, body: j };
};
const data = (r) => r.body.data ?? r.body;

// Expected output for followup.checkin48h — must mirror notification-i18n.ts.
// `fr` is not in the notification catalog, so it must fall back to English.
const EXPECT = {
  yo: { title: "Báwo ni ara rẹ?", token: "ìjíròrò" },
  ha: { title: "Yaya kake ji?", token: "Kwana biyu" },
  en: { title: "How are you feeling?", token: "couple of days" },
  fr: { title: "How are you feeling?", token: "couple of days" },
};

(async () => {
  const al = await call("POST", "/auth/admin/login", {
    email: "admin@doctium.com",
    password: "admin123",
  });
  const adminToken = data(al)?.accessToken;
  ok("admin login", !!adminToken);

  const doc = await prisma.doctor.findFirst({
    where: { isDelete: false },
    select: { id: true, name: true },
  });
  ok("found a doctor for the {{doctor}} param", !!doc);
  if (!doc || !adminToken) {
    console.log(
      `\n${pass}/${pass + fail} passed — aborting (missing prerequisites)`,
    );
    return;
  }
  const drName = `Dr. ${doc.name}`;

  const stamp = Date.now();
  const langs = ["yo", "ha", "en", "fr"];
  const patients = {};

  // One throwaway patient + one due follow-up per language.
  for (const lng of langs) {
    const u = await prisma.user.create({
      data: {
        name: `i18n-${lng}`,
        mobile: `0911${String(stamp).slice(-6)}${langs.indexOf(lng)}`,
        preferredLanguage: lng,
      },
    });
    patients[lng] = u.id;
    await prisma.followUp.create({
      data: {
        userId: u.id,
        doctorId: doc.id,
        type: "CHECK_IN_48H",
        scheduledFor: new Date(Date.now() - 60_000), // already due
        title: "How are you feeling?",
        message: "stored-english-placeholder",
        sms: false,
      },
    });
  }

  const run = await call("POST", "/admin/run-follow-ups", {}, adminToken);
  ok("run-follow-ups dispatched", run.status === 200 || run.status === 201);

  for (const lng of langs) {
    const row = await prisma.notification.findFirst({
      where: { userId: patients[lng], recipient: "USER" },
      orderBy: { createdAt: "desc" },
      select: { title: true, message: true },
    });
    const e = EXPECT[lng];
    const label = lng === "fr" ? "fr→en fallback" : lng;
    ok(`[${label}] title localized`, row?.title === e.title);
    ok(`[${label}] doctor name interpolated`, !!row?.message?.includes(drName));
    ok(
      `[${label}] message body in language`,
      !!row?.message?.includes(e.token),
    );
  }

  // Cleanup throwaway data.
  for (const lng of langs) {
    const id = patients[lng];
    await prisma.notification
      .deleteMany({ where: { userId: id } })
      .catch(() => {});
    await prisma.followUp.deleteMany({ where: { userId: id } }).catch(() => {});
    await prisma.user.delete({ where: { id } }).catch(() => {});
  }

  console.log(
    `\n${pass}/${pass + fail} passed${fail ? ` — ${fail} FAILED` : ""}`,
  );
})()
  .catch((e) => {
    console.error("ERR", e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
