/**
 * Parse a port number from an env var with strict validation.
 * Falls back to `fallback` when unset; exits the process on invalid input.
 */
export function parsePort(raw: string | undefined, fallback: number, name: string): number {
  if (raw === undefined || raw === '') return fallback;
  const n = Number.parseInt(raw, 10);
  if (!Number.isInteger(n) || n <= 0 || n > 65535) {
    console.error(`[${name}] invalid port "${raw}" — must be integer in 1-65535`);
    process.exit(1);
  }
  return n;
}
