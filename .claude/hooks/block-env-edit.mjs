#!/usr/bin/env node
// PreToolUse hook (Edit|Write|MultiEdit): block edits to real .env files.
// .env holds live secrets (Paystack, DATABASE_URL, Firebase, Termii, SMTP, Zego).
// Template files (.env.example/.sample/.template) are allowed.
import { readFileSync } from 'node:fs';

let raw = '';
try {
  raw = readFileSync(0, 'utf8'); // read the hook payload piped on stdin
} catch {
  /* no stdin -> nothing to check */
}

let payload = {};
try {
  payload = JSON.parse(raw || '{}');
} catch {
  /* malformed payload -> fail open */
}

const ti = payload.tool_input || {};
const filePath = ti.file_path || ti.path || ti.notebook_path || '';
const base =
  String(filePath).replace(/\\/g, '/').split('/').pop()?.toLowerCase() || '';

const allowed = new Set(['.env.example', '.env.sample', '.env.template']);
const isSecretEnv = /^\.env(\..+)?$/.test(base) && !allowed.has(base);

if (isSecretEnv) {
  console.error(
    `Blocked edit to "${filePath}".\n` +
      `This file holds live secrets (Paystack keys, DATABASE_URL, Firebase, Termii, SMTP, Zego).\n` +
      `Add new variables to .env.example instead, and set the real value manually.`,
  );
  process.exit(2); // exit code 2 => block the tool call, return stderr to Claude
}

process.exit(0);
