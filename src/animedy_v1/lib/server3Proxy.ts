// Signed relay for Server 3 streams. Hianime's CDN locks segments to its own
// Referer/Origin, so the browser can't fetch them directly — we relay
// through our own backend instead. The relay only ever fetches URLs *we*
// produced from the trusted resolver response (never a client-supplied
// URL): every target is HMAC-signed with JWT_SECRET so a client can't turn
// this into an open proxy by forging or editing the target URL.
import crypto from "node:crypto";

export interface ProxyTarget {
  url: string;
  headers: Record<string, string>;
}

function getSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET is not configured");
  }
  return secret;
}

function base64url(input: Buffer | string): string {
  return Buffer.from(input).toString("base64url");
}

export function signProxyTarget(target: ProxyTarget): string {
  const payload = base64url(JSON.stringify(target));
  const signature = base64url(crypto.createHmac("sha256", getSecret()).update(payload).digest());
  return `${payload}.${signature}`;
}

export function verifyProxyToken(token: string): ProxyTarget | null {
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;

  const expected = base64url(crypto.createHmac("sha256", getSecret()).update(payload).digest());
  const sigBuf = Buffer.from(signature);
  const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return null;
  }

  try {
    const target = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as ProxyTarget;
    if (typeof target.url !== "string" || typeof target.headers !== "object") return null;
    return target;
  } catch {
    return null;
  }
}
