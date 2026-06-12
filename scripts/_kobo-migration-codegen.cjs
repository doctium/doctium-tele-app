/**
 * Kobo migration codegen — Stage 2.
 * (1) Rewrites the 28 true-money `Float` columns to `Int` in schema.prisma (leaving
 *     the 5 percent/rate fields as Float — they are NOT in the list below).
 * (2) Emits the data+type migration SQL (ALTER ... USING ROUND(col*100)) so existing
 *     naira values become kobo exactly once.
 * Idempotent on the schema (re-running finds Int already and skips). Run once.
 */
const fs = require("fs");
const path = require("path");

const SCHEMA = path.join(
  __dirname,
  "../packages/database/prisma/schema.prisma",
);

// [model, table, field, opts]  — opts: def (has @default(0)) | req (NOT NULL, no default) | nullable
const FIELDS = [
  ["Doctor", "doctors", "charge", "def"],
  ["Doctor", "doctors", "scheduledFee", "def"],
  ["Doctor", "doctors", "instantDayFee", "def"],
  ["Doctor", "doctors", "instantNightFee", "def"],
  ["Appointment", "appointments", "amount", "def"],
  ["Appointment", "appointments", "tax", "def"],
  ["Appointment", "appointments", "withoutTax", "def"],
  ["Appointment", "appointments", "discount", "def"],
  ["Appointment", "appointments", "adminEarning", "def"],
  ["Appointment", "appointments", "doctorEarning", "def"],
  ["Appointment", "appointments", "memberDiscount", "def"],
  ["Referral", "referrals", "commissionAmount", "def"],
  ["UserWallet", "user_wallets", "balance", "def"],
  ["UserWalletHistory", "user_wallet_history", "amount", "req"],
  ["DoctorWallet", "doctor_wallets", "balance", "def"],
  ["DoctorWallet", "doctor_wallets", "total", "def"],
  ["DoctorWalletHistory", "doctor_wallet_history", "amount", "req"],
  ["WithdrawRequest", "withdraw_requests", "amount", "def"],
  ["Coupon", "coupons", "maxDiscount", "nullable"],
  ["Coupon", "coupons", "minAmountToApply", "def"],
  ["PaymentTransaction", "payment_transactions", "amount", "req"],
  ["SubscriptionPlan", "subscription_plans", "price", "req"],
  ["Subscription", "subscriptions", "priceAtSignup", "req"],
  ["SubscriptionInvoice", "subscription_invoices", "amount", "req"],
  ["Employee", "employees", "salary", "def"],
  ["Payslip", "payslips", "gross", "req"],
  ["Payslip", "payslips", "deductions", "def"],
  ["Payslip", "payslips", "net", "req"],
];

// ── 1. Rewrite schema (scope each change to its model block) ──
let lines = fs.readFileSync(SCHEMA, "utf8").split("\n");
const blockOf = (model) => {
  const start = lines.findIndex((l) =>
    new RegExp(`^model ${model} \\{`).test(l),
  );
  if (start < 0) throw new Error(`model ${model} not found`);
  let end = start + 1;
  while (end < lines.length && lines[end] !== "}") end++;
  return [start, end];
};

let changed = 0;
for (const [model, , field] of FIELDS) {
  const [s, e] = blockOf(model);
  for (let i = s; i <= e; i++) {
    const re = new RegExp(`^(\\s*${field}\\s+)Float(\\b)`);
    if (re.test(lines[i])) {
      lines[i] = lines[i].replace(re, `$1Int$2`);
      changed++;
      break;
    }
  }
}
fs.writeFileSync(SCHEMA, lines.join("\n"));
console.log(`schema: ${changed}/${FIELDS.length} money fields → Int`);

// ── 2. Emit migration SQL ──
const stmts = [];
stmts.push(
  "-- Kobo migration: true-money Float → Int (kobo), ×100 existing values.",
);
for (const [, table, field, kind] of FIELDS) {
  const cast = `ALTER COLUMN "${field}" TYPE INTEGER USING ROUND("${field}" * 100)::integer`;
  if (kind === "def") {
    stmts.push(
      `ALTER TABLE "${table}" ALTER COLUMN "${field}" DROP DEFAULT, ${cast}, ALTER COLUMN "${field}" SET DEFAULT 0;`,
    );
  } else {
    stmts.push(`ALTER TABLE "${table}" ${cast};`);
  }
}
stmts.push("");
stmts.push(
  "-- Coupon.discountPercent is dual-purpose (% for PERCENT, flat naira for FLAT).",
);
stmts.push("-- It STAYS Float; only the FLAT rows hold money and get ×100.");
stmts.push(
  `UPDATE "coupons" SET "discountPercent" = ROUND("discountPercent" * 100) WHERE "discountType" = 'FLAT';`,
);
stmts.push("");

const outDir = path.join(
  __dirname,
  "../packages/database/prisma/migrations/20260609000000_money_to_kobo",
);
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, "migration.sql"), stmts.join("\n") + "\n");
console.log(
  `migration SQL: ${FIELDS.length} ALTERs + coupon flat update → ${outDir}\\migration.sql`,
);
