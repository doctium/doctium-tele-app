/**
 * Doctium Scribe (Phase 1) verification — AI-drafted SOAP notes.
 *
 * Covers: access control (role + ownership), entitlement/beta gate, chat-source
 * drafting (real LLM call), server-side provenance, empty-draft hidden from
 * record timelines until saved, dictation input validation, and that saving the
 * reviewed draft through the normal upsert preserves provenance.
 *
 * Run: node --env-file=.env scripts/test-scribe.cjs   (API up on :3001, OPENAI_API_KEY set)
 */
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
const assert = (cond, label) => {
  if (cond) {
    pass++;
    console.log("  ✓", label);
  } else {
    fail++;
    console.log("  ✗ FAIL:", label);
  }
};

const apptIds = [];
const cleanup = async () => {
  if (apptIds.length) {
    await prisma.clinicalNote.deleteMany({
      where: { appointmentId: { in: apptIds } },
    });
    await prisma.chat.deleteMany({
      where: { chatTopic: { appointmentId: { in: apptIds } } },
    });
    await prisma.chatTopic.deleteMany({
      where: { appointmentId: { in: apptIds } },
    });
    await prisma.appointment.deleteMany({ where: { id: { in: apptIds } } });
  }
  await prisma.setting.upsert({
    where: { key: "ai_scribe_beta_for_all" },
    create: { key: "ai_scribe_beta_for_all", value: "true" },
    update: { value: "true" },
  });
  // Phase 2 fixtures: test care program + the suggestion notifications it sent
  await prisma.programEnrollment.deleteMany({
    where: { program: { code: "test_scribe_headache" } },
  });
  await prisma.careProgram.deleteMany({
    where: { code: "test_scribe_headache" },
  });
  await prisma.notification.deleteMany({
    where: { type: "care_program_suggested" },
  });
};

(async () => {
  const doc = await prisma.doctor.findFirst({
    where: { email: "rxdoc@doctium.com" },
    select: { id: true },
  });
  const patient = await prisma.user.findFirst({
    where: { mobile: "08000000002" },
    select: { id: true },
  });
  if (!doc || !patient) throw new Error("Seeds missing (rxdoc / 08000000002).");

  const dl = await call("POST", "/auth/doctor/login", {
    email: "rxdoc@doctium.com",
    password: "test1234",
  });
  const doctorToken = data(dl)?.accessToken;
  const pl = await call("POST", "/auth/user/login", {
    mobile: "08000000002",
    password: "test1234",
  });
  const patientToken = data(pl)?.accessToken;
  console.log("Logins — doctor:", dl.status, "patient:", pl.status);
  if (!doctorToken || !patientToken) throw new Error("Login failed");

  // ── Fixtures: a consult with a realistic chat thread ──────
  const appt = await prisma.appointment.create({
    data: {
      userId: patient.id,
      doctorId: doc.id,
      date: "2026-06-11",
      time: "11:00",
      status: "COMPLETED",
    },
    select: { id: true },
  });
  apptIds.push(appt.id);

  const topic = await prisma.chatTopic.create({
    data: { appointmentId: appt.id },
  });
  const lines = [
    [
      "user",
      "Good morning doctor, I've been having a throbbing headache for about five days now.",
    ],
    [
      "doctor",
      "Sorry to hear that. Where exactly is the pain, and is it worse at any time of day?",
    ],
    [
      "user",
      "Mostly at the front of my head and behind my eyes. It's worse in the mornings.",
    ],
    ["doctor", "Any fever, vomiting, blurred vision or neck stiffness?"],
    [
      "user",
      "No fever or vomiting. No vision problems. I took paracetamol but it barely helps.",
    ],
    [
      "doctor",
      "Have you been sleeping well? Any unusual stress at work recently?",
    ],
    [
      "user",
      "Work has been very stressful and I sleep maybe four hours a night.",
    ],
    [
      "doctor",
      "This sounds most like a tension-type headache driven by stress and poor sleep. I'll prescribe ibuprofen 400mg to take with food twice daily for five days, and I want you to aim for at least seven hours of sleep. Let's review you again in two weeks — and message me sooner if it worsens or you notice any visual changes.",
    ],
    ["user", "Thank you doctor, I'll do that."],
  ];
  for (const [role, message] of lines) {
    await prisma.chat.create({
      data: {
        chatTopicId: topic.id,
        doctorId: doc.id,
        userId: patient.id,
        role,
        messageType: "TEXT",
        message,
      },
    });
  }

  // Phase 2: a care program whose keywords hit the consult's words, so the
  // deterministic matcher (not the LLM) should surface it with the draft.
  const testProgram = await prisma.careProgram.create({
    data: {
      code: "test_scribe_headache",
      name: "[TEST] Headache Care",
      condition: "chronic headaches",
      suggestKeywords: ["headache"],
      sortOrder: -10,
    },
    select: { id: true, name: true },
  });

  // ── 1. Access control ─────────────────────────────────────
  console.log("\n1) Access control");
  const asPatient = await call(
    "POST",
    `/emr/notes/${appt.id}/draft`,
    { source: "chat" },
    patientToken,
  );
  assert(asPatient.status === 403, "patient role cannot draft (403)");
  const ghostAppt = await call(
    "POST",
    `/emr/notes/nope-not-real/draft`,
    { source: "chat" },
    doctorToken,
  );
  assert(ghostAppt.status === 404, "unknown appointment → 404");

  // ── 2. Entitlement / beta gate ────────────────────────────
  console.log("\n2) Entitlement gate");
  await prisma.setting.upsert({
    where: { key: "ai_scribe_beta_for_all" },
    create: { key: "ai_scribe_beta_for_all", value: "false" },
    update: { value: "false" },
  });
  const gated = await call(
    "POST",
    `/emr/notes/${appt.id}/draft`,
    { source: "chat" },
    doctorToken,
  );
  assert(
    gated.status === 403,
    "beta off + no aiScribe plan benefit → 403 premium gate",
  );
  await prisma.setting.update({
    where: { key: "ai_scribe_beta_for_all" },
    data: { value: "true" },
  });

  // ── 3. Draft from chat (real LLM call) ────────────────────
  console.log("\n3) Draft from the consult chat");
  const drafted = await call(
    "POST",
    `/emr/notes/${appt.id}/draft`,
    { source: "chat" },
    doctorToken,
  );
  const d = data(drafted);
  assert(
    drafted.status === 200 || drafted.status === 201,
    `draft endpoint ok (${drafted.status})`,
  );
  assert(d?.source === "CHAT", "source reported as CHAT");
  assert(
    typeof d?.draft?.subjective === "string" && d.draft.subjective.length > 20,
    "subjective drafted",
  );
  const blob = `${d?.draft?.subjective} ${d?.draft?.assessment}`.toLowerCase();
  assert(blob.includes("headache"), "draft reflects the actual complaint");
  assert(
    (d?.draft?.plan ?? "").toLowerCase().includes("ibuprofen"),
    "plan reflects the discussed treatment",
  );
  assert(
    typeof d?.transcript === "string" && d.transcript.includes("Patient:"),
    "transcript returned for review",
  );
  assert(d?.patient?.userId === patient.id, "patient ref returned for chips");

  // ── 3b. Action-hub suggestions ────────────────────────────
  console.log("\n3b) Suggested actions");
  const sug = d?.suggestions ?? {};
  assert(
    Array.isArray(sug.prescriptionItems) &&
      sug.prescriptionItems.some((it) =>
        (it.drugName ?? "").toLowerCase().includes("ibuprofen"),
      ),
    "Rx suggestion extracted (ibuprofen)",
  );
  assert(
    sug.recallDays === 14,
    `recall extracted as 14 days (got ${sug.recallDays})`,
  );
  assert(
    Array.isArray(sug.conditions) &&
      sug.conditions.some((c) => c.toLowerCase().includes("headache")),
    "condition suggestion extracted (tension-type headache)",
  );
  assert(sug.referral === null, "no referral invented (null)");
  assert(
    Array.isArray(sug.allergies) && sug.allergies.length === 0,
    "no allergies invented (empty)",
  );
  assert(
    sug.program?.id === testProgram.id,
    "care program matched deterministically from consult words",
  );

  // ── 4. Server-side provenance ─────────────────────────────
  console.log("\n4) Provenance");
  const note = await prisma.clinicalNote.findUnique({
    where: { appointmentId: appt.id },
  });
  assert(!!note?.aiDrafted, "clinical note row flagged aiDrafted");
  assert(note?.aiDraftSource === "CHAT", "aiDraftSource = CHAT");
  assert(
    (note?.aiTranscript ?? "").includes("throbbing headache"),
    "audit transcript persisted server-side",
  );
  assert(note?.subjective === "", "SOAP text NOT auto-saved (draft only)");
  const persistedSug = note?.aiSuggestions ?? {};
  assert(
    Array.isArray(persistedSug.prescriptionItems) &&
      persistedSug.prescriptionItems.length > 0,
    "aiSuggestions persisted for editor re-hydration",
  );

  // ── 5. Draft-only note hidden from record timelines ───────
  console.log("\n5) Record timeline");
  const recBefore = await call("GET", "/emr/me", null, patientToken);
  const notesBefore = data(recBefore)?.clinicalNotes ?? [];
  assert(
    !notesBefore.some((n) => n.appointmentId === appt.id),
    "provenance-only note hidden from patient record",
  );

  // ── 6. Doctor reviews & saves → visible, provenance kept ──
  console.log("\n6) Review-then-save");
  const saved = await call(
    "POST",
    "/emr/notes",
    { appointmentId: appt.id, ...d.draft },
    doctorToken,
  );
  assert(saved.status === 200 || saved.status === 201, "reviewed draft saved");
  const recAfter = await call("GET", "/emr/me", null, patientToken);
  const notesAfter = data(recAfter)?.clinicalNotes ?? [];
  assert(
    notesAfter.some((n) => n.appointmentId === appt.id),
    "saved note now visible in patient record",
  );
  const noteAfter = await prisma.clinicalNote.findUnique({
    where: { appointmentId: appt.id },
  });
  assert(
    !!noteAfter?.aiDrafted && noteAfter?.aiDraftSource === "CHAT",
    "provenance preserved through the normal save",
  );
  const fetched = await call(
    "GET",
    `/emr/notes/appointment/${appt.id}`,
    null,
    doctorToken,
  );
  assert(data(fetched)?.aiDrafted === true, "getNote exposes aiDrafted flag");

  // ── 6b. Action hub: recommend care program ───────────────
  console.log("\n6b) Suggest care program");
  const sp = await call(
    "POST",
    `/emr/notes/${appt.id}/suggest-program`,
    { programId: testProgram.id },
    doctorToken,
  );
  assert(
    sp.status === 200 || sp.status === 201,
    `suggest-program ok (${sp.status})`,
  );
  const notif = await prisma.notification.findFirst({
    where: { userId: patient.id, type: "care_program_suggested" },
    orderBy: { createdAt: "desc" },
  });
  assert(!!notif, "patient notified of the recommendation");
  assert(
    (notif?.message ?? "").includes(testProgram.name),
    "notification names the program",
  );
  const badProg = await call(
    "POST",
    `/emr/notes/${appt.id}/suggest-program`,
    { programId: "nope" },
    doctorToken,
  );
  assert(badProg.status === 404, "unknown program → 404");
  const enr = await prisma.programEnrollment.create({
    data: { programId: testProgram.id, userId: patient.id },
    select: { id: true },
  });
  const dup = await call(
    "POST",
    `/emr/notes/${appt.id}/suggest-program`,
    { programId: testProgram.id },
    doctorToken,
  );
  assert(dup.status === 400, "already enrolled → 400");
  await prisma.programEnrollment.delete({ where: { id: enr.id } });

  // ── 7. Guard rails: empty chat & bad dictation ────────────
  console.log("\n7) Guard rails");
  const bareAppt = await prisma.appointment.create({
    data: {
      userId: patient.id,
      doctorId: doc.id,
      date: "2026-06-11",
      time: "12:00",
      status: "COMPLETED",
    },
    select: { id: true },
  });
  apptIds.push(bareAppt.id);
  const noChat = await call(
    "POST",
    `/emr/notes/${bareAppt.id}/draft`,
    { source: "chat" },
    doctorToken,
  );
  assert(noChat.status === 400, "no conversation → 400");
  const tinyAudio = await call(
    "POST",
    `/emr/notes/${bareAppt.id}/draft`,
    { source: "dictation", audio: Buffer.from("hi").toString("base64") },
    doctorToken,
  );
  assert(tinyAudio.status === 400, "too-short dictation → 400");
  const noAudio = await call(
    "POST",
    `/emr/notes/${bareAppt.id}/draft`,
    { source: "dictation" },
    doctorToken,
  );
  assert(noAudio.status === 400, "dictation without audio → 400");

  console.log(`\nDone. pass=${pass} fail=${fail}`);
  await cleanup();
  await prisma.$disconnect();
  process.exit(fail ? 1 : 0);
})().catch(async (e) => {
  console.error("FATAL:", e.message);
  await cleanup().catch(() => {});
  await prisma.$disconnect();
  process.exit(1);
});
