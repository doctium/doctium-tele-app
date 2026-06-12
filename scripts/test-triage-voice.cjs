// Live verification of Leenah voice input:
//  - full round trip with ZERO manual recording: OpenAI TTS speaks a symptom,
//    the voice endpoint transcribes it via Whisper, transcript must carry it
//  - gates: ownership/role, completed sessions, too-short and too-long audio
//  - the 5.5MB rejection also proves the raised 10mb JSON body limit works
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
require("node:fs")
  .readFileSync(".env", "utf8")
  .split(/\r?\n/)
  .forEach((l) => {
    const m = /^([A-Z0-9_]+)=(.*)$/.exec(l);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  });
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

(async () => {
  const usr = await prisma.user.findFirst({
    where: { mobile: "08000000002" },
    select: { id: true },
  });
  if (!usr) throw new Error("seed patient missing");
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

  // ── 1) synthesize a spoken symptom with OpenAI TTS ──
  console.log("\n1) TTS → Whisper round trip");
  const ttsRes = await fetch("https://api.openai.com/v1/audio/speech", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: "tts-1",
      voice: "alloy",
      input:
        "I have had a pounding headache since yesterday evening. The pain is behind my eyes and bright light makes it worse. I also feel a little dizzy when I stand up quickly.",
    }),
  });
  assert(ttsRes.ok, `TTS audio generated (${ttsRes.status})`);
  const mp3 = Buffer.from(await ttsRes.arrayBuffer());
  console.log(`     → ${Math.round(mp3.length / 1024)}KB of speech`);
  const audioB64 = mp3.toString("base64");

  const session = data(await call("POST", "/triage/sessions", {}, pTok));
  const voice = await call(
    "POST",
    `/triage/sessions/${session.id}/voice`,
    { audio: audioB64, mimeType: "audio/mpeg" },
    pTok,
  );
  const transcript = data(voice)?.transcript ?? "";
  assert(
    voice.status < 300,
    `voice endpoint accepted the note (${voice.status})`,
  );
  assert(
    transcript.toLowerCase().includes("headache"),
    "Whisper transcript carries the symptom",
  );
  console.log(`     → "${transcript.slice(0, 80)}…"`);

  // transcript flows through the normal (red-flag screened) message path
  const sent = await call(
    "POST",
    `/triage/sessions/${session.id}/messages`,
    { text: transcript },
    pTok,
  );
  assert(sent.status < 300, "confirmed transcript sends as a normal message");

  // ── 2) gates & caps ──
  console.log("\n2) Gates & caps");
  assert(
    (
      await call(
        "POST",
        `/triage/sessions/${session.id}/voice`,
        { audio: audioB64 },
        dTok,
      )
    ).status === 403,
    "doctor role blocked → 403",
  );
  assert(
    (
      await call(
        "POST",
        `/triage/sessions/nonexistent/voice`,
        { audio: audioB64 },
        pTok,
      )
    ).status === 404,
    "unknown session → 404",
  );
  const tiny = await call(
    "POST",
    `/triage/sessions/${session.id}/voice`,
    { audio: Buffer.from("hi").toString("base64") },
    pTok,
  );
  assert(tiny.status === 400, "too-short recording → 400");

  // 5.5MB of junk: passes the raised 10mb body limit, hits OUR size cap
  const big = Buffer.alloc(5_500_000, 7).toString("base64");
  const huge = await call(
    "POST",
    `/triage/sessions/${session.id}/voice`,
    { audio: big },
    pTok,
  );
  assert(
    huge.status === 400 &&
      JSON.stringify(huge.body).toLowerCase().includes("too long"),
    "oversized note → 400 (and the 10mb body limit let it through to our cap)",
  );

  // completed sessions don't accept voice
  const s2 = data(await call("POST", "/triage/sessions", {}, pTok));
  await call(
    "POST",
    `/triage/sessions/${s2.id}/messages`,
    { text: "I am having crushing chest pain and my left arm hurts" },
    pTok,
  );
  assert(
    (
      await call(
        "POST",
        `/triage/sessions/${s2.id}/voice`,
        { audio: audioB64 },
        pTok,
      )
    ).status === 400,
    "completed session rejects voice → 400",
  );

  await prisma.triageSession.deleteMany({ where: { userId: usr.id } });
  console.log(`\n${pass} passed, ${fail} failed`);
  await prisma.$disconnect();
  process.exit(fail ? 1 : 0);
})().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
