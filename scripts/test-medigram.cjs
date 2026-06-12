/**
 * MediGram end-to-end verification — feed, like, comment, share, and the
 * moderation + reporting + YouTube-source additions.
 *
 * Run: node scripts/test-medigram.cjs   (API must be up on :3001)
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

const TEST_TAG = "[TEST] ";
const cleanup = async () => {
  await prisma.video.deleteMany({ where: { title: { startsWith: TEST_TAG } } });
  await prisma.user.deleteMany({
    where: { email: { startsWith: "medigram-bot-" } },
  });
};

(async () => {
  await cleanup();

  const doc = await prisma.doctor.findFirst({
    where: { email: "rxdoc@doctium.com" },
    select: { id: true, name: true },
  });
  if (!doc) throw new Error("Doctor seed missing (rxdoc@doctium.com).");

  // Logins
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
    throw new Error("A login failed — check seeds.");

  console.log("\n1) Doctor upload enters moderation as PENDING");
  const up = await call(
    "POST",
    "/videos",
    {
      title: TEST_TAG + "Hydration tips",
      description: "Stay hydrated.",
      videoUrl: "https://example.com/clip.mp4",
      source: "UPLOAD",
    },
    doctorToken,
  );
  const clip = data(up);
  assert(up.status === 201 || up.status === 200, "upload accepted");
  assert(clip?.status === "PENDING", "new clip status PENDING");
  assert(clip?.source === "UPLOAD", "source UPLOAD");

  console.log("\n2) YouTube upload normalizes URL + derives thumbnail");
  const yt = await call(
    "POST",
    "/videos",
    {
      title: TEST_TAG + "Heart health (YT)",
      videoUrl: "https://youtu.be/dQw4w9WgXcQ",
      source: "YOUTUBE",
    },
    doctorToken,
  );
  const ytClip = data(yt);
  assert(ytClip?.source === "YOUTUBE", "source YOUTUBE");
  assert(
    ytClip?.videoUrl === "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    "canonical YouTube URL stored",
  );
  assert(
    /img\.youtube\.com\/vi\/dQw4w9WgXcQ/.test(ytClip?.videoImage || ""),
    "thumbnail derived",
  );
  const ytBad = await call(
    "POST",
    "/videos",
    { title: TEST_TAG + "bad", videoUrl: "not-a-link", source: "YOUTUBE" },
    doctorToken,
  );
  assert(ytBad.status === 400, "invalid YouTube link -> 400");

  console.log("\n3) Patient feed hides PENDING clips; doctor sees own");
  const feed1 = await call("GET", "/videos", null, patientToken);
  assert(
    !data(feed1).some((v) => v.id === clip.id),
    "PENDING clip absent from patient feed",
  );
  const mine = await call("GET", "/videos?mine=true", null, doctorToken);
  assert(
    data(mine).some((v) => v.id === clip.id),
    "doctor sees own PENDING clip (mine=true)",
  );

  console.log("\n4) Admin moderation queue + approve");
  const queue = await call("GET", "/admin/videos", null, adminToken);
  assert(queue.status === 200, "admin queue 200 (content.moderate)");
  assert(
    data(queue).items.some((v) => v.id === clip.id),
    "PENDING clip in admin queue",
  );
  const appr = await call(
    "PATCH",
    `/admin/videos/${clip.id}/approve`,
    {},
    adminToken,
  );
  assert(data(appr)?.status === "APPROVED", "approve -> status APPROVED");
  const feed2 = await call("GET", "/videos", null, patientToken);
  assert(
    data(feed2).some((v) => v.id === clip.id),
    "approved clip now in patient feed",
  );

  console.log("\n5) Admin reject notifies + hides");
  const rej = await call(
    "PATCH",
    `/admin/videos/${ytClip.id}/reject`,
    { reason: "Unverified claims." },
    adminToken,
  );
  assert(data(rej)?.status === "REJECTED", "reject -> status REJECTED");
  assert(
    data(rej)?.rejectionReason === "Unverified claims.",
    "rejection reason stored",
  );

  console.log("\n6) Like / comment / share on the live clip");
  const like1 = await call("POST", `/videos/${clip.id}/like`, {}, patientToken);
  assert(data(like1)?.liked === true, "like -> liked:true");
  const cm = await call(
    "POST",
    `/videos/${clip.id}/comment`,
    { comment: "Helpful!" },
    patientToken,
  );
  assert(data(cm)?.user?.name, "comment returns user");
  const sh = await call("POST", `/videos/${clip.id}/share`);
  assert(data(sh)?.shareCount >= 1, "share increments");

  console.log("\n7) Reporting + auto-flag at threshold (3 distinct users)");
  const bad = await call(
    "POST",
    `/videos/${clip.id}/report`,
    { reason: "NONSENSE" },
    patientToken,
  );
  assert(bad.status === 400, "invalid reason -> 400");
  // Pre-seed 2 reports from throwaway users, then the patient's API report is the 3rd.
  const bots = await Promise.all(
    [1, 2].map((n) =>
      prisma.user.create({
        data: {
          email: `medigram-bot-${n}@test.local`,
          mobile: `0700000000${n}`,
          name: `Bot ${n}`,
        },
        select: { id: true },
      }),
    ),
  );
  for (const b of bots) {
    await prisma.videoReport.create({
      data: { videoId: clip.id, userId: b.id, reason: "SPAM" },
    });
  }
  await prisma.video.update({
    where: { id: clip.id },
    data: { reportCount: 2 },
  });
  const rep = await call(
    "POST",
    `/videos/${clip.id}/report`,
    { reason: "MISINFORMATION" },
    patientToken,
  );
  assert(data(rep)?.reported === true, "patient report accepted");
  assert(data(rep)?.autoFlagged === true, "3rd report auto-flags the clip");
  const after = await prisma.video.findUnique({
    where: { id: clip.id },
    select: { status: true },
  });
  assert(after?.status === "FLAGGED", "clip status FLAGGED in DB");
  const feed3 = await call("GET", "/videos", null, patientToken);
  assert(
    !data(feed3).some((v) => v.id === clip.id),
    "flagged clip pulled from patient feed",
  );

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
