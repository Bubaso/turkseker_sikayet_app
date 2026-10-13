import crypto from "node:crypto";

/* src/lib/password.ts ile aynı biçim: scrypt$N$r$p$tuz$özet */
export function hashPassword(plain) {
  const N = 16384, R = 8, P = 1;
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(plain.normalize("NFKC"), salt, 32, { N, r: R, p: P });
  return `scrypt$${N}$${R}$${P}$${salt.toString("hex")}$${hash.toString("hex")}`;
}

export function randomToken(bytes = 24) {
  return crypto.randomBytes(bytes).toString("base64url");
}
