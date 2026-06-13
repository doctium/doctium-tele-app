/**
 * Verifies Cloudinary credentials by doing a real upload + cleanup.
 * Run AFTER adding CLOUDINARY_* to .env:
 *   node --env-file=.env scripts/test-cloudinary.cjs
 */
const { v2: cloudinary } = require("cloudinary");

const name = process.env.CLOUDINARY_CLOUD_NAME;
const key = process.env.CLOUDINARY_API_KEY;
const secret = process.env.CLOUDINARY_API_SECRET;

if (!name || !key || !secret) {
  console.error(
    "❌ Missing CLOUDINARY_CLOUD_NAME / API_KEY / API_SECRET in .env",
  );
  process.exit(1);
}
cloudinary.config({
  cloud_name: name,
  api_key: key,
  api_secret: secret,
  secure: true,
});

// 1x1 transparent PNG as a data-URL (same shape the app uploads).
const PNG =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";
const publicId = "doctium/_healthcheck/upload-test";

(async () => {
  try {
    const res = await cloudinary.uploader.upload(PNG, {
      resource_type: "auto",
      public_id: publicId,
      overwrite: true,
      invalidate: true,
    });
    console.log("✅ Upload OK");
    console.log("   cloud:", name);
    console.log("   url:  ", res.secure_url);
    await cloudinary.uploader.destroy(publicId, { resource_type: "image" });
    console.log("✅ Cleanup OK — credentials are valid and uploads work.");
  } catch (e) {
    console.error("❌ Cloudinary upload failed:", e.message || e);
    console.error("   Double-check the cloud name / key / secret.");
    process.exit(1);
  }
})();
