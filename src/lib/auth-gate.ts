/** Shared site-gate helpers (Edge + Node safe). */

export const GATE_COOKIE = "kodo_gate";
export const GATE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

const PEPPER = "kodo-v1:";

/** SHA-256 hex of peppered password — used as cookie token. */
export async function gateToken(password: string): Promise<string> {
  const data = new TextEncoder().encode(PEPPER + password);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function gateTokenMatches(
  password: string,
  token: string | undefined | null
): Promise<boolean> {
  if (!token || !password) return false;
  const expected = await gateToken(password);
  if (expected.length !== token.length) return false;
  // constant-time-ish compare
  let ok = 0;
  for (let i = 0; i < expected.length; i++) {
    ok |= expected.charCodeAt(i) ^ token.charCodeAt(i);
  }
  return ok === 0;
}

export function isGateEnabled(password: string | undefined | null): boolean {
  return Boolean(password && password.length > 0);
}
