#!/usr/bin/env node
// PostToolUse hook (Edit|Write|MultiEdit): format the edited file with Prettier.
// --ignore-unknown makes Prettier silently skip files it can't format.
// Formatting failures never fail the edit.
import { readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

let raw = '';
try {
  raw = readFileSync(0, 'utf8');
} catch {
  /* no stdin */
}

let payload = {};
try {
  payload = JSON.parse(raw || '{}');
} catch {
  /* malformed payload */
}

const ti = payload.tool_input || {};
const filePath = ti.file_path || ti.path || '';
if (!filePath) process.exit(0);

try {
  execSync(`npx prettier --write --ignore-unknown "${filePath}"`, {
    stdio: 'ignore',
  });
} catch {
  /* swallow: never block an edit because formatting failed */
}

process.exit(0);
