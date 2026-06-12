// Seeds the chronic-disease care-program catalog (idempotent upserts by code).
// Thresholds are population defaults — care leads tune them per patient.
// Run: node --env-file=.env scripts/seed-care-programs.cjs
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const PROGRAMS = [
  {
    code: "hypertension",
    name: "Hypertension Care",
    condition: "High blood pressure",
    description:
      "Track your blood pressure and weight, stay within your target range, and keep your care lead in the loop between visits.",
    icon: "heart",
    sortOrder: 1,
    suggestKeywords: [
      "blood pressure",
      "hypertension",
      "high bp",
      "bp is high",
      "bp high",
    ],
    vitals: [
      {
        type: "BLOOD_PRESSURE",
        cadencePerWeek: 7,
        min: 90,
        max: 140,
        min2: 60,
        max2: 90,
        criticalMin: 80,
        criticalMax: 180,
        criticalMax2: 120,
      },
      { type: "WEIGHT", cadencePerWeek: 1 },
    ],
  },
  {
    code: "diabetes_t2",
    name: "Diabetes Care (Type 2)",
    condition: "Type 2 Diabetes",
    description:
      "Log your blood glucose daily, watch your trends, and get help fast when readings go out of range.",
    icon: "water",
    sortOrder: 2,
    suggestKeywords: [
      "diabetes",
      "diabetic",
      "blood sugar",
      "glucose",
      "always thirsty",
    ],
    vitals: [
      {
        type: "BLOOD_GLUCOSE",
        cadencePerWeek: 7,
        min: 70,
        max: 180,
        criticalMin: 54,
        criticalMax: 300,
      },
      { type: "WEIGHT", cadencePerWeek: 1 },
    ],
  },
  {
    code: "asthma",
    name: "Asthma Control",
    condition: "Asthma",
    description:
      "Monitor your peak flow and oxygen levels so flare-ups are caught early — before they become emergencies.",
    icon: "cloud",
    sortOrder: 3,
    suggestKeywords: [
      "asthma",
      "wheez",
      "inhaler",
      "tight chest when breathing",
    ],
    vitals: [
      { type: "PEAK_FLOW", cadencePerWeek: 7, min: 300, criticalMin: 200 },
      { type: "SPO2", cadencePerWeek: 3, min: 94, criticalMin: 90 },
    ],
  },
  {
    code: "mental_health",
    name: "Mental Wellbeing",
    condition: "Mental health",
    description:
      "A simple daily mood check-in. Low stretches are flagged to your care lead so support reaches you sooner.",
    icon: "happy",
    sortOrder: 4,
    suggestKeywords: [
      "anxiety",
      "anxious",
      "depress",
      "panic",
      "stress",
      "low mood",
      "can't sleep",
      "cannot sleep",
      "insomnia",
    ],
    vitals: [{ type: "MOOD", cadencePerWeek: 7, min: 4, criticalMin: 2 }],
  },
  {
    code: "sickle_cell",
    name: "Sickle Cell Support",
    condition: "Sickle cell disease",
    description:
      "Track pain, hydration and oxygen levels with a crisis diary. Genotype-tuned alerts help your care lead act before a crisis.",
    icon: "medical",
    sortOrder: 5,
    suggestKeywords: [
      "sickle cell",
      "sickle",
      "genotype ss",
      "genotype sc",
      "scd",
      "bone pain crisis",
      "hydroxyurea",
    ],
    vitals: [
      { type: "PAIN", cadencePerWeek: 7, max: 5, criticalMax: 8 },
      { type: "HYDRATION", cadencePerWeek: 7, min: 6 },
      { type: "SPO2", cadencePerWeek: 3, min: 92, criticalMin: 88 },
    ],
    // SCD Phase 3: genotype-stratified protocol layer. HbSS runs hotter —
    // tighter pain/SpO2 bands, more hydration, closer check-ins. HbSC is
    // milder; AS (trait) keeps light-touch monitoring only.
    genotypeConfig: {
      SS: {
        checkInDays: 3,
        vitals: [
          { type: "PAIN", cadencePerWeek: 7, max: 4, criticalMax: 7 },
          { type: "HYDRATION", cadencePerWeek: 7, min: 8 },
          { type: "SPO2", cadencePerWeek: 7, min: 93, criticalMin: 89 },
        ],
      },
      SC: {
        checkInDays: 5,
        vitals: [{ type: "PAIN", cadencePerWeek: 7, max: 5, criticalMax: 8 }],
      },
      AS: {
        checkInDays: 14,
      },
    },
  },
];

(async () => {
  for (const p of PROGRAMS) {
    const { code, ...rest } = p;
    const row = await prisma.careProgram.upsert({
      where: { code },
      create: { code, ...rest },
      update: rest,
    });
    console.log(`✓ ${row.code} — ${row.name} (${row.vitals.length} vitals)`);
  }
  console.log(`\nSeeded ${PROGRAMS.length} care programs.`);
  await prisma.$disconnect();
})().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
