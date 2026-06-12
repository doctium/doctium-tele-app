// Live verification of the AI Symptom Checker & Triage (Phase 1):
//  - deterministic red-flag engine: EMERGENCY without consulting the LLM,
//    crisis variant for self-harm, completed sessions locked
//  - REAL LLM conversation (uses OPENAI_API_KEY): structural assertions only —
//    urgency from the enum, specialty grounded in live designations, summary present
//  - daily session cap, role gates, disposition + doctor handoff summary
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

const URGENCIES = [
  "EMERGENCY",
  "URGENT_CONSULT",
  "CONSULT_24H",
  "ROUTINE",
  "SELF_CARE",
];
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
  const pTok = data(pl)?.accessToken;
  const dTok = data(dl)?.accessToken;
  console.log("logins:", pl.status, dl.status);
  if (!pTok || !dTok) throw new Error("login failed");

  // ── 1) availability + gates ──
  console.log("\n1) Availability & gates");
  assert(
    (await call("GET", "/triage/status")).status === 401,
    "no token → 401",
  );
  const st = await call("GET", "/triage/status", null, pTok);
  assert(
    data(st)?.enabled === true,
    "symptom checker enabled (OPENAI_API_KEY live)",
  );
  assert(
    (await call("POST", "/triage/sessions", {}, dTok)).status === 403,
    "doctor cannot start patient triage → 403",
  );

  // ── 2) red-flag engine (deterministic — no LLM involved) ──
  console.log("\n2) Red-flag safety engine");
  const s1 = data(await call("POST", "/triage/sessions", {}, pTok));
  assert(
    s1?.status === "ACTIVE" && (s1?.messages ?? []).length === 1,
    "session starts with the greeting",
  );
  const flagRes = await call(
    "POST",
    `/triage/sessions/${s1.id}/messages`,
    {
      text: "I have crushing chest pain spreading to my left arm and I'm sweating a lot",
    },
    pTok,
  );
  const flagB = data(flagRes);
  assert(
    flagB?.verdict?.urgency === "EMERGENCY" &&
      flagB?.verdict?.redFlag === "cardiac",
    "cardiac red flag → instant EMERGENCY verdict",
  );
  assert(
    JSON.stringify(flagB?.messages ?? []).includes("112"),
    "emergency reply directs to 112 / ER",
  );
  const s1row = await prisma.triageSession.findUnique({ where: { id: s1.id } });
  assert(
    s1row?.model === "",
    "LLM was NEVER consulted (rules outrank the model)",
  );
  assert(
    (
      await call(
        "POST",
        `/triage/sessions/${s1.id}/messages`,
        { text: "more" },
        pTok,
      )
    ).status === 400,
    "completed session locked → 400",
  );

  const s2 = data(await call("POST", "/triage/sessions", {}, pTok));
  const crisis = data(
    await call(
      "POST",
      `/triage/sessions/${s2.id}/messages`,
      { text: "Honestly I just don't want to live anymore" },
      pTok,
    ),
  );
  assert(
    crisis?.verdict?.redFlag === "self_harm" &&
      crisis?.verdict?.crisis === true,
    "self-harm message → crisis verdict (helpline copy, no booking push)",
  );
  assert(
    JSON.stringify(crisis?.messages ?? []).includes("not"),
    "crisis reply is the compassionate variant",
  );

  // ── 3) real LLM conversation (structural assertions) ──
  console.log("\n3) Live LLM triage conversation");
  const designations = (
    await prisma.doctor.findMany({
      where: { isVerified: true, isBlock: false, isDelete: false },
      select: { designation: true },
      distinct: ["designation"],
    })
  )
    .map((d) => d.designation.trim())
    .filter(Boolean);
  const allowedSpecialties = [...designations, "General practice"];

  const s3 = data(await call("POST", "/triage/sessions", {}, pTok));
  const answers = [
    "I've had a dry cough and a mild fever for the past two days",
    "No chest pain at all, and I can breathe normally",
    "My temperature was about 38 degrees this morning",
    "No, nobody around me has been sick",
    "I feel a bit tired but otherwise okay",
    "No other symptoms. Please give me your assessment now.",
    "That's everything — what's your verdict?",
  ];
  let verdict = null;
  let llmTurns = 0;
  for (const text of answers) {
    const r = data(
      await call("POST", `/triage/sessions/${s3.id}/messages`, { text }, pTok),
    );
    llmTurns++;
    if (r?.verdict) {
      verdict = r.verdict;
      break;
    }
  }
  assert(!!verdict, `model reached a verdict within ${llmTurns} turns`);
  assert(
    URGENCIES.includes(verdict?.urgency),
    `urgency is a valid enum (${verdict?.urgency})`,
  );
  assert(
    verdict?.urgency !== "EMERGENCY",
    `benign cough/mild fever NOT over-escalated (${verdict?.urgency})`,
  );
  assert(
    llmTurns >= 3,
    `model asked real questions before the verdict (${llmTurns} turns)`,
  );
  assert(
    allowedSpecialties.includes(verdict?.specialty),
    `specialty grounded in live platform list (${verdict?.specialty})`,
  );
  assert(
    typeof verdict?.summary === "string" && verdict.summary.length > 20,
    "clinical handoff summary written",
  );
  assert(Array.isArray(verdict?.reasons), "reasons array present");
  console.log(`     → ${verdict?.urgency} / ${verdict?.specialty}`);

  // ── 4) disposition + doctor handoff ──
  console.log("\n4) Disposition & doctor handoff");
  assert(
    (
      await call(
        "POST",
        `/triage/sessions/${s3.id}/disposition`,
        { action: "NONSENSE" },
        pTok,
      )
    ).status === 400,
    "invalid disposition → 400",
  );
  const appt = await prisma.appointment.create({
    data: {
      userId: usr.id,
      doctorId: doc.id,
      date: new Date().toISOString().slice(0, 10),
      time: "16:00",
      status: "CONFIRMED",
      paymentStatus: "PENDING",
    },
  });
  cleanupApptIds.push(appt.id);
  const disp = await call(
    "POST",
    `/triage/sessions/${s3.id}/disposition`,
    { action: "BOOKED", appointmentId: appt.id },
    pTok,
  );
  assert(
    disp.status < 300 && data(disp)?.appointmentId === appt.id,
    "disposition recorded + session linked to the booking",
  );

  const handoff = await call(
    "GET",
    `/triage/appointments/${appt.id}`,
    null,
    dTok,
  );
  const hB = data(handoff);
  assert(
    handoff.status === 200 && hB?.summary === verdict.summary,
    "doctor sees the AI intake summary on the booking",
  );
  assert(
    (await call("GET", `/triage/appointments/${appt.id}`, null, pTok))
      .status === 200,
    "patient can see their own handoff too",
  );
  const appt2 = await prisma.appointment.create({
    data: {
      userId: usr.id,
      doctorId: doc.id,
      date: new Date().toISOString().slice(0, 10),
      time: "17:00",
      status: "CONFIRMED",
      paymentStatus: "PENDING",
    },
  });
  cleanupApptIds.push(appt2.id);
  assert(
    (await call("GET", `/triage/appointments/${appt2.id}`, null, dTok))
      .status === 404,
    "booking without a triage session → 404",
  );

  // ── 5) daily cap ──
  console.log("\n5) Daily session cap");
  // 3 sessions used so far; default limit is 5
  const s4 = await call("POST", "/triage/sessions", {}, pTok);
  const s5 = await call("POST", "/triage/sessions", {}, pTok);
  assert(s4.status < 300 && s5.status < 300, "sessions 4 and 5 allowed");
  const s6 = await call("POST", "/triage/sessions", {}, pTok);
  assert(
    s6.status === 400 && JSON.stringify(s6.body).includes("limit"),
    "6th session today blocked → 400 (cost/abuse cap)",
  );

  // history
  const mine = await call("GET", "/triage/mine", null, pTok);
  assert((data(mine) ?? []).length === 5, "history lists today's sessions");

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
