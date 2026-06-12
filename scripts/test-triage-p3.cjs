// Live verification of Leenah Phase 3 (analytics + feedback loop) + branding:
//  - Leenah identity in greetings
//  - doctor routing-accuracy feedback (thumbs) with party gates
//  - admin /admin/triage/overview: volumes, urgency mix, funnel, accuracy, languages
// Deterministic only — no LLM calls (red-flag path + prisma fixtures).
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const BASE = "http://localhost:3001/api/v1";

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

let pass = 0,
  fail = 0;
const assert = (c, l) => {
  if (c) {
    pass++;
    console.log("  ✓", l);
  } else {
    fail++;
    console.log("  ✗ FAIL:", l);
  }
};

const cleanupApptIds = [];

(async () => {
  const usr = await prisma.user.findFirst({
    where: { mobile: "08000000002" },
    select: { id: true },
  });
  const doc = await prisma.doctor.findFirst({
    where: { email: "rxdoc@doctium.com" },
    select: { id: true },
  });
  if (!usr || !doc) throw new Error("seed patient/doctor missing");
  await prisma.triageSession.deleteMany({ where: { userId: usr.id } });

  const pl = await call("POST", "/auth/user/login", {
    mobile: "08000000002",
    password: "test1234",
  });
  const dl = await call("POST", "/auth/doctor/login", {
    email: "rxdoc@doctium.com",
    password: "test1234",
  });
  const al = await call("POST", "/auth/admin/login", {
    email: "admin@doctium.com",
    password: "admin123",
  });
  const pTok = data(pl)?.accessToken;
  const dTok = data(dl)?.accessToken;
  const aTok = data(al)?.accessToken;
  console.log("logins:", pl.status, dl.status, al.status);
  if (!pTok || !dTok || !aTok) throw new Error("login failed");

  // ── 1) Leenah identity ──
  console.log("\n1) Leenah branding");
  const s1 = data(await call("POST", "/triage/sessions", {}, pTok));
  assert(
    JSON.stringify(s1?.messages?.[0] ?? {}).includes("Leenah"),
    "greeting introduces Leenah by name",
  );
  const sPcm = data(
    await call("POST", "/triage/sessions", { language: "pcm" }, pTok),
  );
  assert(
    JSON.stringify(sPcm?.messages?.[0] ?? {}).includes("Leenah"),
    "Pidgin greeting carries the name too",
  );

  // ── 2) feedback loop ──
  console.log("\n2) Doctor routing feedback");
  // deterministic verdict via red flag, then link to a booking
  const flagged = data(
    await call(
      "POST",
      `/triage/sessions/${s1.id}/messages`,
      { text: "I have crushing chest pain and my left arm hurts badly" },
      pTok,
    ),
  );
  assert(flagged?.verdict?.urgency === "EMERGENCY", "fixture verdict in place");
  const appt = await prisma.appointment.create({
    data: {
      userId: usr.id,
      doctorId: doc.id,
      date: new Date().toISOString().slice(0, 10),
      time: "10:00",
      status: "CONFIRMED",
      paymentStatus: "PENDING",
    },
  });
  cleanupApptIds.push(appt.id);
  await call(
    "POST",
    `/triage/sessions/${s1.id}/disposition`,
    { action: "BOOKED", appointmentId: appt.id },
    pTok,
  );

  assert(
    (
      await call(
        "POST",
        `/triage/appointments/${appt.id}/feedback`,
        { accurate: true },
        pTok,
      )
    ).status === 403,
    "patient cannot send routing feedback → 403",
  );
  const fb = await call(
    "POST",
    `/triage/appointments/${appt.id}/feedback`,
    { accurate: true },
    dTok,
  );
  assert(
    fb.status < 300 && data(fb)?.doctorFeedback === true,
    "care lead thumbs-up recorded",
  );
  const handoff = data(
    await call("GET", `/triage/appointments/${appt.id}`, null, dTok),
  );
  assert(
    handoff?.doctorFeedback === true,
    "handoff now carries the feedback state",
  );

  const appt2 = await prisma.appointment.create({
    data: {
      userId: usr.id,
      doctorId: doc.id,
      date: new Date().toISOString().slice(0, 10),
      time: "11:00",
      status: "CONFIRMED",
      paymentStatus: "PENDING",
    },
  });
  cleanupApptIds.push(appt2.id);
  assert(
    (
      await call(
        "POST",
        `/triage/appointments/${appt2.id}/feedback`,
        { accurate: false },
        dTok,
      )
    ).status === 404,
    "feedback on a booking without a Leenah session → 404",
  );

  // ── 3) analytics fixtures + overview ──
  console.log("\n3) Admin overview");
  // synthetic completed sessions for distribution metrics
  const mk = (urgency, language, mode, disposition) =>
    prisma.triageSession.create({
      data: {
        userId: usr.id,
        status: "COMPLETED",
        mode,
        language,
        urgency,
        specialty: "General practice",
        summary: "fixture",
        disposition,
        messages: [],
      },
    });
  await mk("ROUTINE", "en", "TRIAGE", "BOOKED");
  await mk("SELF_CARE", "yo", "TRIAGE", "DISMISSED");
  await mk("CONSULT_24H", "pcm", "TRIAGE", null);
  await prisma.triageSession.create({
    data: {
      userId: usr.id,
      status: "COMPLETED",
      mode: "QA",
      language: "en",
      messages: [],
    },
  });

  assert(
    (await call("GET", "/admin/triage/overview", null, dTok)).status === 403,
    "doctor blocked from Leenah analytics → 403",
  );
  const ov = await call("GET", "/admin/triage/overview", null, aTok);
  const o = data(ov);
  assert(
    ov.status === 200 && o?.assistant === "Leenah",
    "overview → 200, branded",
  );
  assert(o.sessions30d >= 6, `sessions counted (${o.sessions30d})`);
  assert(o.byMode.QA >= 1 && o.byMode.TRIAGE >= 5, "mode split present");
  assert(
    o.urgency.EMERGENCY >= 1 &&
      o.urgency.ROUTINE >= 1 &&
      o.urgency.SELF_CARE >= 1 &&
      o.urgency.CONSULT_24H >= 1,
    "urgency distribution covers the fixtures",
  );
  assert(o.redFlags30d >= 1, "red-flag count present");
  assert(
    o.languages.pcm >= 2 && o.languages.yo >= 1,
    "language distribution present",
  );
  assert(
    o.funnel.linkedAppointments >= 1 &&
      o.funnel.booked >= 2 &&
      o.funnel.dismissed >= 1,
    "conversion funnel populated",
  );
  assert(
    o.funnel.bookable === o.funnel.verdicts - (o.urgency.EMERGENCY ?? 0),
    "bookable excludes emergencies",
  );
  assert(
    o.accuracy.agree >= 1 && o.accuracy.percent === 100,
    `routing accuracy from doctor feedback (${o.accuracy.percent}%)`,
  );
  assert(o.daily?.length === 14, "14-day daily series");
  const today = o.daily[o.daily.length - 1];
  assert(today.triage + today.qa >= 6, "today's sessions appear in the series");

  // ── cleanup ──
  await prisma.triageSession.deleteMany({ where: { userId: usr.id } });
  await prisma.appointment.deleteMany({
    where: { id: { in: cleanupApptIds } },
  });
  console.log(`\n${pass} passed, ${fail} failed`);
  await prisma.$disconnect();
  process.exit(fail ? 1 : 0);
})().catch(async (e) => {
  console.error(e);
  try {
    await prisma.appointment.deleteMany({
      where: { id: { in: cleanupApptIds } },
    });
  } catch {}
  await prisma.$disconnect();
  process.exit(1);
});
