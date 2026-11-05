// Input validation shared by auth endpoints. Mirrors the client-side rules
// in src/lib/api/account.ts — keep the two in sync.

export const USERNAME_RE = /^[a-zA-Z0-9_]{3,20}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validEmail(value: unknown): value is string {
  return typeof value === "string" && value.length <= 255 && EMAIL_RE.test(value);
}

export function validUsername(value: unknown): value is string {
  return typeof value === "string" && USERNAME_RE.test(value);
}

/** Strong password: 10–128 chars with upper, lower, digit, and symbol. */
export function passwordProblems(value: unknown): string | null {
  if (typeof value !== "string") return "Password is required";
  if (value.length < 10) return "Password must be at least 10 characters";
  if (value.length > 128) return "Password must be at most 128 characters";
  if (!/[a-z]/.test(value)) return "Password must contain a lowercase letter";
  if (!/[A-Z]/.test(value)) return "Password must contain an uppercase letter";
  if (!/[0-9]/.test(value)) return "Password must contain a digit";
  if (!/[^a-zA-Z0-9]/.test(value)) return "Password must contain a symbol";
  return null;
}

export function asInt(value: unknown): number | null {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
}

export function asOptionalString(value: unknown, maxLen = 1024): string | null {
  return typeof value === "string" && value.length > 0 ? value.slice(0, maxLen) : null;
}
