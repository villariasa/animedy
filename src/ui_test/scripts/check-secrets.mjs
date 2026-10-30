#!/usr/bin/env node
// Fails the build if anything secret-shaped ended up in the shipped bundle.
// Heuristic, not exhaustive — this catches obvious leaks (cloud keys, JWTs,
// private key blocks, Stripe-style tokens), it does not replace a real
// secret scanner or code review. Anything that reaches the browser is
// public no matter how it's minified/obfuscated, so this is the one check
// that actually matters for "can this be inspected" — not the minifier.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const DIST_DIR = join(import.meta.dirname, "..", "dist");

const PATTERNS = [
  { name: "AWS access key", re: /AKIA[0-9A-Z]{16}/g },
  { name: "Private key block", re: /-----BEGIN (RSA |EC |OPENSSH |)PRIVATE KEY-----/g },
  { name: "Stripe secret key", re: /\bsk_live_[0-9a-zA-Z]{20,}/g },
  { name: "Generic Bearer token", re: /Bearer [A-Za-z0-9\-_.]{30,}/g },
  { name: "JWT-looking literal", re: /eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g },
  // Our own env var names — if any of these leak into the client bundle
  // verbatim with a value attached, something that should stay server-side
  // got imported into frontend code.
  { name: "DB credential reference", re: /DB_(HOST|USER|PASSWORD|NAME)\s*[:=]\s*["'][^"']{3,}["']/g },
  { name: "JWT secret reference", re: /JWT_SECRET\s*[:=]\s*["'][^"']{3,}["']/g }
];

function listJsFiles(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) out.push(...listJsFiles(full));
    else if (entry.endsWith(".js") || entry.endsWith(".html")) out.push(full);
  }
  return out;
}

let files;
try {
  files = listJsFiles(DIST_DIR);
} catch {
  console.error(`[check-secrets] Could not read ${DIST_DIR} — did the build run first?`);
  process.exit(1);
}

const findings = [];
for (const file of files) {
  const content = readFileSync(file, "utf8");
  for (const { name, re } of PATTERNS) {
    const matches = content.match(re);
    if (matches) {
      findings.push({ file, name, count: matches.length });
    }
  }
}

if (findings.length > 0) {
  console.error("\n[check-secrets] Possible secret(s) found in the shipped bundle:\n");
  for (const f of findings) {
    console.error(`  ${f.name} — ${f.count}x in ${f.file.replace(DIST_DIR, "dist")}`);
  }
  console.error("\nFix: remove the secret from frontend code, or proxy the call through the backend.\n");
  process.exit(1);
}

console.log(`[check-secrets] OK — scanned ${files.length} file(s) in dist/, nothing secret-shaped found.`);
