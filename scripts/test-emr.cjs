/**
 * EMR/EHR end-to-end verification — health profile, conditions/allergies/
 * surgeries/immunizations, file vault, appointment-gated doctor access, SOAP
 * notes, FHIR export, and access isolation.
 *
 * Run: node scripts/test-emr.cjs   (API must be up on :3001)
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

let ghostId = null;
let apptId = null;
const cleanup = async () => {
  if (apptId) await prisma.appointment.deleteMany({ where: { id: apptId } });
  if (ghostId) {
    await prisma.user.deleteMany({ where: { id: ghostId } });
  }
  // Real patient's test rows
  const p = await prisma.user.findFirst({
    where: { mobile: "08000000002" },
    select: { id: true },
  });
  if (p) {
    await prisma.medicalCondition.deleteMany({
      where: { userId: p.id, name: { startsWith: "[TEST]" } },
    });
    await prisma.allergy.deleteMany({
      where: { userId: p.id, substance: { startsWith: "[TEST]" } },
    });
    await prisma.surgery.deleteMany({
      where: { userId: p.id, name: { startsWith: "[TEST]" } },
    });
    await prisma.immunization.deleteMany({
      where: { userId: p.id, vaccine: { startsWith: "[TEST]" } },
    });
    await prisma.medicalFile.deleteMany({
      where: { userId: p.id, fileName: { startsWith: "[TEST]" } },
    });
  }
  // Test family members (cascade-deletes their EMR rows + appointments)
  await prisma.appointment.deleteMany({
    where: { subPatient: { name: { startsWith: "[TEST]" } } },
  });
  await prisma.subPatient.deleteMany({
    where: { name: { startsWith: "[TEST]" } },
  });
  await prisma.user.deleteMany({
    where: { email: { startsWith: "emr-other-" } },
  });
};

(async () => {
  await cleanup();

  const doc = await prisma.doctor.findFirst({
    where: { email: "rxdoc@doctium.com" },
    select: { id: true },
  });
  const patient = await prisma.user.findFirst({
    where: { mobile: "08000000002" },
    select: { id: true },
  });
  if (!doc || !patient) throw new Error("Seeds missing.");

  const pl = await call("POST", "/auth/user/login", {
    mobile: "08000000002",
    password: "test1234",
  });
  const patientToken = data(pl)?.accessToken;
  const dl = await call("POST", "/auth/doctor/login", {
    email: "rxdoc@doctium.com",
    password: "test1234",
  });
  const doctorToken = data(dl)?.accessToken;
  const al = await call("POST", "/auth/admin/login", {
    email: "admin@doctium.com",
    password: "admin123",
  });
  const adminToken = data(al)?.accessToken;
  console.log(
    "Logins — patient:",
    pl.status,
    "doctor:",
    dl.status,
    "admin:",
    al.status,
  );
  if (!patientToken || !doctorToken || !adminToken)
    throw new Error("Login failed.");

  console.log("\n1) Patient manages own health profile + entries");
  const prof = await call(
    "PUT",
    "/emr/me/profile",
    { bloodType: "O+", genotype: "AA", heightCm: 178, weightKg: 74 },
    patientToken,
  );
  assert(
    data(prof)?.bloodType === "O+",
    "health profile upserted (blood type O+)",
  );
  const cond = await call(
    "POST",
    "/emr/me/conditions",
    { name: "[TEST] Hypertension", status: "ACTIVE" },
    patientToken,
  );
  assert(data(cond)?.id, "condition added");
  const alg = await call(
    "POST",
    "/emr/me/allergies",
    { substance: "[TEST] Penicillin", reaction: "Rash", severity: "SEVERE" },
    patientToken,
  );
  assert(data(alg)?.severity === "SEVERE", "allergy added (severe)");
  await call(
    "POST",
    "/emr/me/surgeries",
    { name: "[TEST] Appendectomy", performedDate: "2019" },
    patientToken,
  );
  await call(
    "POST",
    "/emr/me/immunizations",
    { vaccine: "[TEST] Hepatitis B", doseLabel: "Dose 2" },
    patientToken,
  );
  const file = await call(
    "POST",
    "/emr/me/files",
    {
      fileName: "[TEST] CBC.pdf",
      dataUrl: "data:application/pdf;base64,JVBERi0xLjQK",
      category: "LAB_REPORT",
      mimeType: "application/pdf",
    },
    patientToken,
  );
  assert(
    data(file)?.fileUrl,
    "lab file stored (data-URL fallback works w/o Cloudinary)",
  );

  console.log("\n2) Patient reads own record");
  const me = await call("GET", "/emr/me", null, patientToken);
  const rec = data(me);
  assert(
    rec?.patient?.healthProfile?.bloodType === "O+",
    "record returns profile",
  );
  assert(
    rec?.patient?.medicalConditions?.some(
      (c) => c.name === "[TEST] Hypertension",
    ),
    "record returns conditions",
  );
  assert(rec?.patient?.allergies?.length >= 1, "record returns allergies");
  assert(rec?.patient?.medicalFiles?.length >= 1, "record returns files");

  console.log("\n3) Entry delete is owner-scoped");
  const del = await call(
    "DELETE",
    `/emr/me/condition/${data(cond).id}`,
    null,
    patientToken,
  );
  assert(data(del)?.deleted === true, "condition deleted by owner");

  console.log("\n4) Doctor access is appointment-gated");
  const ghost = await prisma.user.create({
    data: {
      email: "emr-ghost@test.local",
      mobile: "07099999999",
      name: "Ghost Patient",
      dob: "1990-05-01",
      gender: "male",
    },
    select: { id: true },
  });
  ghostId = ghost.id;
  const blocked = await call(
    "GET",
    `/emr/patient/${ghost.id}`,
    null,
    doctorToken,
  );
  assert(
    blocked.status === 403,
    "doctor blocked from non-patient record (403)",
  );

  // Create a consultation link.
  const appt = await prisma.appointment.create({
    data: {
      userId: ghost.id,
      doctorId: doc.id,
      date: "2026-06-10",
      time: "10:00",
      status: "CONFIRMED",
    },
    select: { id: true },
  });
  apptId = appt.id;
  const allowed = await call(
    "GET",
    `/emr/patient/${ghost.id}`,
    null,
    doctorToken,
  );
  assert(
    allowed.status === 200,
    "doctor allowed after appointment exists (200)",
  );

  console.log("\n5) Doctor records SOAP note + clinical findings");
  const note = await call(
    "POST",
    "/emr/notes",
    {
      appointmentId: appt.id,
      subjective: "Headache for 3 days",
      objective: "Alert, no distress",
      assessment: "Tension headache",
      plan: "Hydration, analgesia",
      bloodPressure: "120/80",
      heartRate: 72,
      temperature: 36.8,
    },
    doctorToken,
  );
  assert(data(note)?.assessment === "Tension headache", "SOAP note saved");
  const noteUpd = await call(
    "POST",
    "/emr/notes",
    { appointmentId: appt.id, assessment: "Migraine" },
    doctorToken,
  );
  assert(
    data(noteUpd)?.assessment === "Migraine",
    "SOAP note is upserted (one per appointment)",
  );
  const docAlg = await call(
    "POST",
    `/emr/patient/${ghost.id}/allergies`,
    { substance: "Aspirin", severity: "MODERATE" },
    doctorToken,
  );
  assert(
    data(docAlg)?.recordedByDoctorId === doc.id,
    "doctor-added allergy tagged with recordedByDoctorId",
  );
  const fetchNote = await call(
    "GET",
    `/emr/notes/appointment/${appt.id}`,
    null,
    doctorToken,
  );
  assert(
    data(fetchNote)?.bloodPressure === "120/80",
    "note readable with vitals",
  );

  console.log("\n6) FHIR R4 export");
  const fhir = await call("GET", "/emr/me/fhir", null, patientToken);
  const bundle = data(fhir);
  assert(bundle?.resourceType === "Bundle", "FHIR Bundle returned");
  const types = (bundle?.entry ?? []).map((e) => e.resource.resourceType);
  assert(types.includes("Patient"), "bundle has Patient resource");
  assert(types.includes("AllergyIntolerance"), "bundle has AllergyIntolerance");
  assert(types.includes("Procedure"), "bundle maps surgery → Procedure");
  assert(types.includes("Immunization"), "bundle has Immunization");
  const docFhir = await call(
    "GET",
    `/emr/patient/${ghost.id}/fhir`,
    null,
    doctorToken,
  );
  const gtypes = (data(docFhir)?.entry ?? []).map(
    (e) => e.resource.resourceType,
  );
  assert(
    gtypes.includes("ClinicalImpression"),
    "gated patient FHIR maps SOAP → ClinicalImpression",
  );
  assert(gtypes.includes("Observation"), "SOAP vitals → Observation");

  console.log("\n7) Admin oversight + export");
  const list = await call("GET", "/admin/emr/patients", null, adminToken);
  assert(
    list.status === 200,
    "admin patient list 200 (emr.view / super-admin)",
  );
  assert(
    data(list)?.items?.length >= 1,
    "admin list returns patients with counts",
  );
  const arec = await call(
    "GET",
    `/admin/emr/patient/${patient.id}`,
    null,
    adminToken,
  );
  assert(
    arec.status === 200 && data(arec)?.patient?.id === patient.id,
    "admin reads any record",
  );
  const afhir = await call(
    "GET",
    `/admin/emr/patient/${patient.id}/fhir`,
    null,
    adminToken,
  );
  assert(
    data(afhir)?.resourceType === "Bundle",
    "admin FHIR export works (emr.export)",
  );

  console.log("\n8) Family members (sub-patient records)");
  const child = await prisma.subPatient.create({
    data: {
      userId: patient.id,
      name: "[TEST] Baby Ada",
      relation: "Child",
      gender: "female",
      age: 3,
    },
    select: { id: true },
  });
  // Foreign member under a different account (for ownership isolation).
  const other = await prisma.user.create({
    data: {
      email: "emr-other-acc@test.local",
      mobile: "07088888888",
      name: "Other Acc",
    },
    select: { id: true },
  });
  const foreignChild = await prisma.subPatient.create({
    data: { userId: other.id, name: "[TEST] Foreign Kid", relation: "Child" },
    select: { id: true },
  });

  const childCond = await call(
    "POST",
    "/emr/me/conditions",
    { name: "[TEST] Asthma", subPatientId: child.id },
    patientToken,
  );
  assert(
    data(childCond)?.subPatientId === child.id,
    "condition added for family member",
  );
  await call(
    "PUT",
    "/emr/me/profile",
    { bloodType: "A+", subPatientId: child.id },
    patientToken,
  );

  const childRec = await call(
    "GET",
    `/emr/me?subPatientId=${child.id}`,
    null,
    patientToken,
  );
  assert(
    data(childRec)?.patient?.name === "[TEST] Baby Ada",
    "member record shows member identity",
  );
  assert(
    data(childRec)?.patient?.healthProfile?.bloodType === "A+",
    "member has own health profile (A+)",
  );
  assert(
    data(childRec)?.patient?.medicalConditions?.some(
      (c) => c.name === "[TEST] Asthma",
    ),
    "member record has member condition",
  );

  const selfRec = await call("GET", "/emr/me", null, patientToken);
  assert(
    !data(selfRec)?.patient?.medicalConditions?.some(
      (c) => c.name === "[TEST] Asthma",
    ),
    "ISOLATION: member condition absent from self record",
  );
  assert(
    data(selfRec)?.patient?.healthProfile?.bloodType === "O+",
    "self profile unchanged (O+)",
  );

  const patientsList = await call(
    "GET",
    "/emr/me/patients",
    null,
    patientToken,
  );
  assert(
    data(patientsList)?.some((s) => s.id === child.id),
    "me/patients lists family member",
  );

  const foreign = await call(
    "POST",
    "/emr/me/conditions",
    { name: "x", subPatientId: foreignChild.id },
    patientToken,
  );
  assert(
    foreign.status === 403,
    "OWNERSHIP: cannot add to someone else's family member (403)",
  );

  // Doctor: appointment for the family member unlocks the member record.
  const childAppt = await prisma.appointment.create({
    data: {
      userId: patient.id,
      doctorId: doc.id,
      subPatientId: child.id,
      date: "2026-06-12",
      time: "09:00",
      status: "CONFIRMED",
    },
    select: { id: true },
  });
  const docNoAccess = await call(
    "GET",
    `/emr/patient/${patient.id}?subPatientId=${foreignChild.id}`,
    null,
    doctorToken,
  );
  assert(
    docNoAccess.status === 403,
    "doctor blocked from a member they have no appointment for (403)",
  );
  const docMember = await call(
    "GET",
    `/emr/patient/${patient.id}?subPatientId=${child.id}`,
    null,
    doctorToken,
  );
  assert(
    docMember.status === 200 &&
      data(docMember)?.patient?.medicalConditions?.some(
        (c) => c.name === "[TEST] Asthma",
      ),
    "doctor reads family member via member appointment",
  );
  const childFhir = await call(
    "GET",
    `/emr/me/fhir?subPatientId=${child.id}`,
    null,
    patientToken,
  );
  assert(
    data(childFhir)?.entry?.some(
      (e) =>
        e.resource.resourceType === "Patient" &&
        e.resource.name?.[0]?.text === "[TEST] Baby Ada",
    ),
    "member FHIR Patient = member identity",
  );

  await prisma.appointment.deleteMany({ where: { id: childAppt.id } });

  await cleanup();
  console.log(`\n${pass} passed, ${fail} failed`);
  await prisma.$disconnect();
  process.exit(fail ? 1 : 0);
})().catch(async (e) => {
  console.error("ERROR:", e.message);
  await cleanup().catch(() => {});
  await prisma.$disconnect();
  process.exit(1);
});
