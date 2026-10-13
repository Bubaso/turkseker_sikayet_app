import crypto from "node:crypto";

/* Şifreler scrypt ile saklanır. Biçim: scrypt$N$r$p$tuz$özet (hepsi hex). */

const N = 16384;
const R = 8;
const P = 1;
const KEYLEN = 32;

export function hashPassword(plain: string): string {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(plain.normalize("NFKC"), salt, KEYLEN, { N, r: R, p: P });
  return `scrypt$${N}$${R}$${P}$${salt.toString("hex")}$${hash.toString("hex")}`;
}

export function verifyPassword(plain: string, stored: string): boolean {
  try {
    const parts = stored.split("$");
    if (parts.length !== 6 || parts[0] !== "scrypt") return false;
    const [, n, r, p, saltHex, hashHex] = parts;
    const salt = Buffer.from(saltHex, "hex");
    const expected = Buffer.from(hashHex, "hex");
    const actual = crypto.scryptSync(plain.normalize("NFKC"), salt, expected.length, {
      N: Number(n), r: Number(r), p: Number(p),
    });
    return crypto.timingSafeEqual(expected, actual);
  } catch {
    return false;
  }
}

/** Rastgele, URL'de güvenle taşınabilen anahtar (takip jetonu vb.). */
export function randomToken(bytes = 24): string {
  return crypto.randomBytes(bytes).toString("base64url");
}

/** 6 haneli SMS doğrulama kodu. */
export function randomOtp(): string {
  return String(crypto.randomInt(100_000, 1_000_000));
}

export function hashOtp(code: string, phone: string): string {
  return crypto.createHash("sha256").update(`${phone}:${code}`).digest("hex");
}
