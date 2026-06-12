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
  "@typescript-eslint/no-unused-vars": [
    "warn",
    { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
  ],
  // TypeScript already resolves identifiers; no-undef double-reports RN/DOM globals.
  "no-undef": "off",
  "prefer-const": "warn",
  "no-empty": "warn",
  // require() is idiomatic in React Native (static asset imports) — surface, don't block.
  "@typescript-eslint/no-require-imports": "warn",
  "@typescript-eslint/no-unused-expressions": "warn",
  // Hooks correctness — the highest-value React check. Warn for now (pre-existing backlog).
  "react-hooks/rules-of-hooks": "warn",
  "react-hooks/exhaustive-deps": "warn",
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
    // Admin panel + mobile apps — surface tier (warnings only).
    files: [
      "apps/admin-panel/**/*.{ts,tsx}",
      "apps/user-app/**/*.{ts,tsx}",
      "apps/doctor-app/**/*.{ts,tsx}",
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
      "@next/next/no-img-element": "warn",
      "@next/next/no-html-link-for-pages": "off",
    },
  },
);
