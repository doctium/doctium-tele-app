// @ts-check
import js from "@eslint/js";
import tseslint from "typescript-eslint";

/**
 * Linting is currently scoped to the API (the audited, tested core). The admin
 * panel and mobile apps are intentionally out of scope until they get a dedicated
 * pass — add `files` blocks for them when ready.
 *
 * Type-aware rules are off for speed/simplicity (no `project` parserOptions); the
 * separate `tsc --noEmit` typecheck already covers type correctness.
 */
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
);
