// Live verification of Leenah voice replies (TTS out) + care-program suggestions:
//  - speak endpoint returns real mp3 audio for Leenah's messages, with gates
//  - verdicts suggest a care program when the patient's own words match the
//    program's data-driven keywords; never on EMERGENCY; never when already
//    enrolled; rehydrated on session refetch
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

const BP_OPENER =
  "My blood pressure readings at home have been high for two weeks, around 150 over 95";
const BP_ANSWERS = [
  "No headache, no chest pain, and I feel fine otherwise",
  "I check it with a home monitor, morning and evening",
  "No other symptoms at all. Please give me your assessment now.",
  "That's everything — your verdict please.",
];

async function runBpConversation(pTok) {
  const session = data(await call("POST", "/triage/sessions", {}, pTok));
  let result = data(
    await call(
      "POST",
      `/triage/sessions/${session.id}/messages`,
      { text: BP_OPENER },
      pTok,
    ),
  );
  for (const text of BP_ANSWERS) {
    if (result?.verdict) break;
    result = data(
      await call(
        "POST",
        `/triage/sessions/${session.id}/messages`,
        { text },
        pTok,
      ),
    );
  }
  return { sessionId: session.id, verdict: result?.verdict ?? null };
}

(async () => {
  const usr = await prisma.user.findFirst({
    where: { mobile: "08000000002" },
    select: { id: true },
  });
  const doc = await prisma.doctor.findFirst({
    where: { email: "rxdoc@doctium.com" },
    select: { id: true },
  });
  const hypertension = await prisma.careProgram.findUnique({
    where: { code: "hypertension" },
    select: { id: true },
  });
  if (!usr || !doc || !hypertension)
    throw new Error("seed data missing — run seed-care-programs.cjs");
  await prisma.triageSession.deleteMany({ where: { userId: usr.id } });
  // clean any leftover enrollments so the suggestion isn't suppressed
  const old = await prisma.programEnrollment.findMany({
    where: { userId: usr.id },
    select: { id: true },
  });
  for (const e of old) {
    await prisma.programGoal.deleteMany({ where: { enrollmentId: e.id } });
    await prisma.vitalAlert.deleteMany({ where: { enrollmentId: e.id } });
    await prisma.vitalReading.deleteMany({ where: { enrollmentId: e.id } });
    await prisma.programEnrollment.delete({ where: { id: e.id } });
  }

  const pl = await call("POST", "/auth/user/login", {
    mobile: "08000000002",
    password: "test1234",
  });
  const dl = await call("POST", "/auth/doctor/login", {
    email: "rxdoc@doctium.com",
    password: "test1234",
  });
  const pTok = data(pl)?.accessToken;
  const dTok = data(dl)?.accessToken;
  console.log("logins:", pl.status, dl.status);
  if (!pTok || !dTok) throw new Error("login failed");

  // ── 1) voice replies (TTS out) ──
  console.log("\n1) Leenah talks back");
  const s1 = data(await call("POST", "/triage/sessions", {}, pTok));
  const spoke = await call(
    "POST",
    `/triage/sessions/${s1.id}/speak`,
    { messageIndex: 0 },
    pTok,
  );
  const audio = data(spoke)?.audio ?? "";
  assert(spoke.status < 300, `speak endpoint → ${spoke.status}`);
  assert(
    audio.startsWith("data:audio/mpeg;base64,"),
    "returns an mp3 data-URL",
  );
  const bytes = Buffer.from(
    audio.slice(audio.indexOf(",") + 1),
    "base64",
  ).length;
  assert(bytes > 5_000, `real audio generated (${Math.round(bytes / 1024)}KB)`);
  assert(
    (
      await call(
        "POST",
        `/triage/sessions/${s1.id}/speak`,
        { messageIndex: 99 },
        pTok,
      )
    ).status === 400,
    "out-of-range message → 400",
  );
  assert(
    (
      await call(
        "POST",
        `/triage/sessions/${s1.id}/speak`,
        { messageIndex: 0 },
        dTok,
      )
    ).status === 403,
    "doctor role blocked → 403",
  );
  // a user message can't be spoken (index 1 after sending one)
  await call(
    "POST",
    `/triage/sessions/${s1.id}/messages`,
    { text: "I have crushing chest pain and my left arm hurts" },
    pTok,
  );
  assert(
    (
      await call(
        "POST",
        `/triage/sessions/${s1.id}/speak`,
        { messageIndex: 1 },
        pTok,
      )
    ).status === 400,
    "user messages aren't read aloud → 400",
  );

  // ── 2) program suggestion on the verdict (live LLM) ──
  console.log("\n2) Care-program suggestion");
  // the red-flag EMERGENCY session above must NOT carry a suggestion
  const s1State = data(
    await call("GET", `/triage/sessions/${s1.id}`, null, pTok),
  );
  assert(
    s1State?.verdict?.urgency === "EMERGENCY" &&
      s1State?.verdict?.programSuggestion == null,
    "EMERGENCY verdicts never cross-sell",
  );

  const bp1 = await runBpConversation(pTok);
  assert(!!bp1.verdict, "BP conversation reached a verdict");
  assert(
    bp1.verdict?.urgency !== "EMERGENCY",
    `BP verdict not over-escalated (${bp1.verdict?.urgency})`,
  );
  assert(
    bp1.verdict?.programSuggestion?.name?.includes("Hypertension"),
    `patient's own words ("blood pressure") → Hypertension Care suggested`,
  );
  const row = await prisma.triageSession.findUnique({
    where: { id: bp1.sessionId },
    select: { suggestedProgramId: true },
  });
  assert(
    row?.suggestedProgramId === hypertension.id,
    "suggestion persisted for conversion analytics",
  );
  const refetched = data(
    await call("GET", `/triage/sessions/${bp1.sessionId}`, null, pTok),
  );
  assert(
    refetched?.verdict?.programSuggestion?.name?.includes("Hypertension"),
    "suggestion rehydrates on session refetch",
  );

  // ── 3) already enrolled → no suggestion ──
  console.log("\n3) Enrolled patients aren't re-sold");
  const enrolled = await call(
    "POST",
    `/care-programs/${hypertension.id}/enroll`,
    { doctorId: doc.id },
    pTok,
  );
  assert(enrolled.status < 300, "patient enrolls in Hypertension Care");
  const bp2 = await runBpConversation(pTok);
  assert(!!bp2.verdict, "second BP conversation reached a verdict");
  assert(
    bp2.verdict?.programSuggestion == null,
    "no suggestion for a program the patient is already in",
  );

  // ── cleanup ──
  const myEnrollments = await prisma.programEnrollment.findMany({
    where: { userId: usr.id },
    select: { id: true },
  });
  for (const e of myEnrollments) {
    await prisma.programGoal.deleteMany({ where: { enrollmentId: e.id } });
    await prisma.vitalAlert.deleteMany({ where: { enrollmentId: e.id } });
    await prisma.vitalReading.deleteMany({ where: { enrollmentId: e.id } });
    await prisma.programEnrollment.delete({ where: { id: e.id } });
  }
  await prisma.triageSession.deleteMany({ where: { userId: usr.id } });
  console.log(`\n${pass} passed, ${fail} failed`);
  await prisma.$disconnect();
  process.exit(fail ? 1 : 0);
})().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
