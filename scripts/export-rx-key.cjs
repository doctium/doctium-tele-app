/**
 * Export the current prescription signing key from the Setting table into the
 * single-line, \n-escaped form expected by RX_PRIVATE_KEY.
 *
 * Run once during production cutover so the env key is the SAME key already used
 * to sign existing prescriptions — every historical signature then verifies under
 * the current key with no re-signing.
 *
 *   node --env-file=.env scripts/export-rx-key.cjs
 *
 * Copy the printed RX_PRIVATE_KEY=... line into your production environment, then
 * delete the rx_private_key row from the Setting table:
 *   DELETE FROM "settings" WHERE key = 'rx_private_key';
 */
const { PrismaClient } = require("@prisma/client");

async function main() {
  const prisma = new PrismaClient();
  try {
    const row = await prisma.setting.findUnique({
      where: { key: "rx_private_key" },
    });
    if (!row?.value) {
      console.error(
        "No rx_private_key found in the Setting table. Nothing to export.",
      );
      process.exit(1);
    }
    if (row.value.startsWith("enc:v1:")) {
      console.error(
        "The stored key is encrypted at rest. Set RX_KEY_ENCRYPTION_SECRET and run the API once " +
          "to decrypt, or export from a plaintext snapshot. Aborting to avoid emitting ciphertext.",
      );
      process.exit(1);
    }
    const escaped = row.value.replace(/\r?\n/g, "\\n");
    console.log("\nAdd this to your production environment:\n");
    console.log(`RX_PRIVATE_KEY="${escaped}"`);
    console.log(
      "\nThen remove the DB copy:\n  DELETE FROM \"settings\" WHERE key = 'rx_private_key';\n",
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
