/**
 * SCD live-weather upgrade verification — the risk engine swaps its harmattan
 * calendar heuristic for real conditions at the patient's location when coords
 * are set, and degrades safely to the calendar rule otherwise.
 *
 * Live assertions hit the free Open-Meteo API. If it's unreachable they SKIP
 * (not fail), so the suite stays green offline.
 *
 * Run: node --env-file=.env scripts/test-weather-risk.cjs   (API up on :3001, programs seeded)
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
  fail = 0,
  skip = 0;
const assert = (cond, label) => {
  if (cond) {
    pass++;
    console.log("  ✓", label);
  } else {
    fail++;
    console.log("  ✗ FAIL:", label);
  }
};
const skipped = (label) => {
  skip++;
  console.log("  ~ SKIP:", label);
};

// Reliably-cold coordinates (Antarctic interior) force the cold-weather factor.
const COLD = { lat: "-75.0", lon: "0.0" };
// Lagos — warm + humid year-round, no cold/dry trigger.
const WARM = { lat: "6.45", lon: "3.4" };

const probeOpenMeteo = async () => {
  try {
    const url =
      `https://api.open-meteo.com/v1/forecast?latitude=${COLD.lat}&longitude=${COLD.lon}` +
      `&current=temperature_2m,relative_humidity_2m,wind_speed_10m&wind_speed_unit=kmh`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) return null;
    const j = await res.json();
    return j?.current ?? null;
  } catch {
    return null;
  }
};

let patientId = null;
let original = null;

const setCoords = (lat, lon) =>
  prisma.user.update({
    where: { id: patientId },
    data: { latitude: lat, longitude: lon },
  });

const cleanup = async () => {
  if (!patientId) return;
  const enr = await prisma.programEnrollment.findMany({
    where: { userId: patientId, program: { code: "sickle_cell" } },
    select: { id: true },
  });
  const ids = enr.map((e) => e.id);
  if (ids.length) {
    await prisma.riskAssessment.deleteMany({
      where: { enrollmentId: { in: ids } },
    });
    await prisma.vitalReading.deleteMany({
      where: { enrollmentId: { in: ids } },
    });
    await prisma.programEnrollment.deleteMany({ where: { id: { in: ids } } });
  }
  if (original) {
    await prisma.user.update({
      where: { id: patientId },
      data: { latitude: original.latitude, longitude: original.longitude },
    });
  }
};

const factorsFor = async (enrollmentId, token) => {
  const d = data(
    await call(
      "GET",
      `/care-programs/enrollments/${enrollmentId}`,
      null,
      token,
    ),
  );
  return (d?.risk?.factors ?? []).map((f) => f.key);
};

(async () => {
  const doc = await prisma.doctor.findFirst({
    where: { email: "rxdoc@doctium.com" },
    select: { id: true },
  });
  const patient = await prisma.user.findFirst({
    where: { mobile: "08000000002" },
    select: { id: true, latitude: true, longitude: true },
  });
  if (!doc || !patient) throw new Error("Seeds missing (rxdoc / 08000000002).");
  patientId = patient.id;
  original = { latitude: patient.latitude, longitude: patient.longitude };

  await cleanup();

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

  const scd = await prisma.careProgram.findUnique({
    where: { code: "sickle_cell" },
    select: { id: true },
  });
  const enrollment = data(
    await call(
      "POST",
      `/care-programs/${scd.id}/enroll`,
      { genotype: "SS", doctorId: doc.id },
      patientToken,
    ),
  );
  if (!enrollment?.id) throw new Error("Enrollment failed");

  // ── 1. Open-Meteo contract ────────────────────────────────
  console.log("\n1) Open-Meteo provider contract");
  const probe = await probeOpenMeteo();
  const live = !!probe;
  if (live) {
    assert(
      typeof probe.temperature_2m === "number" &&
        Number.isFinite(probe.temperature_2m),
      `temperature is a finite number (${probe.temperature_2m}°C)`,
    );
    assert(
      probe.temperature_2m < 18,
      "Antarctic probe is cold (<18°C) — forces the cold factor",
    );
  } else {
    skipped("Open-Meteo unreachable — live weather assertions skipped");
  }

  // ── 2. Cold location → live weather factor ────────────────
  console.log("\n2) Cold location");
  await setCoords(COLD.lat, COLD.lon);
  if (live) {
    const keys = await factorsFor(enrollment.id, patientToken);
    assert(keys.includes("weather"), "cold conditions emit a 'weather' factor");
    assert(
      !keys.includes("season"),
      "calendar 'season' factor is bypassed when live weather is available",
    );
  } else {
    skipped("cold-location assertions (offline)");
  }

  // ── 3. Warm location → no cold/dry trigger ────────────────
  console.log("\n3) Warm location");
  await setCoords(WARM.lat, WARM.lon);
  if (live) {
    const keys = await factorsFor(enrollment.id, patientToken);
    assert(
      !keys.includes("season"),
      "warm Lagos: calendar 'season' still bypassed (weather available)",
    );
    assert(
      !keys.includes("weather"),
      "warm, humid Lagos emits no cold/dry weather factor",
    );
  } else {
    skipped("warm-location assertions (offline)");
  }

  // ── 4. No coords → safe fallback (no crash, no env factor in June) ──
  console.log("\n4) No coordinates (fallback)");
  await setCoords("", "");
  const keys = await factorsFor(enrollment.id, patientToken);
  assert(
    !keys.includes("weather"),
    "no coords → no live-weather factor (degrades to calendar rule)",
  );
  // June (month 5) is outside Nov–Mar, so the calendar rule is silent too.
  assert(
    !keys.includes("season") || new Date().getMonth() >= 10,
    "fallback path is consistent with the calendar heuristic",
  );

  console.log(`\nDone. pass=${pass} fail=${fail} skip=${skip}`);
  await cleanup();
  await prisma.$disconnect();
  process.exit(fail ? 1 : 0);
})().catch(async (e) => {
  console.error("FATAL:", e.message);
  await cleanup().catch(() => {});
  await prisma.$disconnect();
  process.exit(1);
});
