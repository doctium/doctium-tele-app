// Husky install guard. Skip in CI and production builds — git hooks aren't needed
// there, and husky isn't installed when devDependencies are omitted
// (NODE_ENV=production), which would otherwise make `npm ci` fail on `prepare`.
if (process.env.NODE_ENV === "production" || process.env.CI) {
  process.exit(0);
}
const husky = (await import("husky")).default;
console.log(husky());
