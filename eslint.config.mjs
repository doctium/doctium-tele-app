// @ts-check
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import nextPlugin from "@next/eslint-plugin-next";

/**
 * The API (apps/api/src) is the gating tier: lint errors fail CI.
 *
 * The admin panel and mobile apps are linted in a "surface, don't block" tier —
 * everything is a warning so we get the audit signal without a wall of blocking
 * errors on a previously-unlinted codebase. Promote rules to error per-app as the
 * backlog is cleared. Type-aware rules are off (tsc --noEmit covers types).
 */
const appRules = {
  "@typescript-eslint/no-explicit-any": "warn",
  // Promoted to error after the backlog was cleared — these now gate CI.
  "@typescript-eslint/no-unused-vars": [
    "error",
    { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
  ],
  "@typescript-eslint/no-unused-expressions": "error",
  "prefer-const": "error",
  // Empty blocks gate CI, but an intentional empty catch is an allowed pattern
  // (admin surfaces errors via a global toast; mobile uses best-effort no-ops).
  "no-empty": ["error", { allowEmptyCatch: true }],
  // TypeScript already resolves identifiers; no-undef double-reports RN/DOM globals.
  "no-undef": "off",
  // require() is forbidden by default (admin/packages); turned off for the mobile
  // apps below, where require('./asset') is the idiomatic Metro static-asset loader.
  "@typescript-eslint/no-require-imports": "error",
  "react-hooks/rules-of-hooks": "error",
  "react-hooks/exhaustive-deps": "error",
};

export default tseslint.config(
  {
    ignores: [
      "**/dist/**",
      "**/.next/**",
      "**/.expo/**",
      "**/node_modules/**",
      "**/coverage/**",
      "**/migrations/**",
      "**/*.config.{js,mjs,cjs,ts}",
      "**/next-env.d.ts",
    ],
  },
  {
    files: ["apps/api/src/**/*.ts"],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    rules: {
      // Surface, don't block, on style/escape-hatch smells the codebase already uses.
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      // Real-bug rules stay as errors (CI-gating).
      "no-console": ["error", { allow: ["warn", "error"] }],
    },
  },
  {
    // Test files: relax the rules that fight common test patterns.
    files: ["apps/api/src/**/*.spec.ts"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "no-console": "off",
    },
  },
  {
    // Admin panel + mobile apps — shared rule tier (see appRules above).
    files: [
      "apps/admin-panel/**/*.{ts,tsx}",
      "apps/user-app/**/*.{ts,tsx}",
      "apps/doctor-app/**/*.{ts,tsx}",
      "packages/mobile-ui/**/*.{ts,tsx}",
    ],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    plugins: { "react-hooks": reactHooks },
    rules: appRules,
  },
  {
    // Next.js-specific checks for the admin panel (registers @next/next/* rules so
    // existing eslint-disable comments resolve; surfaced as warnings).
    files: ["apps/admin-panel/**/*.{ts,tsx}"],
    plugins: { "@next/next": nextPlugin },
    rules: {
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs["core-web-vitals"].rules,
      // Internal admin panel with remote/dynamic images (Cloudinary, data-URLs);
      // next/image's sizing constraints aren't worth it here. Plain <img> is fine.
      "@next/next/no-img-element": "off",
      "@next/next/no-html-link-for-pages": "off",
    },
  },
  {
    // React Native: require('./asset') is the idiomatic Metro static-asset loader.
    files: ["apps/user-app/**/*.{ts,tsx}", "apps/doctor-app/**/*.{ts,tsx}"],
    rules: { "@typescript-eslint/no-require-imports": "off" },
  },
);
