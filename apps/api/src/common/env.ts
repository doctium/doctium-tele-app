/**
 * Fail-closed environment access for secrets that must never silently fall back
 * to a default. A missing secret is a configuration error we want to surface at
 * boot, not a value we want to paper over with a hardcoded string.
 */
export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value || value.trim() === "") {
    throw new Error(
      `Missing required environment variable ${name}. Refusing to start — ` +
        `set it in your environment or .env file.`,
    );
  }
  return value;
}

/**
 * Validate every secret the API cannot run safely without. Called early in
 * bootstrap so a misconfigured deploy fails fast with a clear message instead
 * of booting with forgeable tokens.
 */
export function assertRequiredSecrets(): void {
  ["JWT_SECRET", "JWT_REFRESH_SECRET"].forEach(requireEnv);
}
