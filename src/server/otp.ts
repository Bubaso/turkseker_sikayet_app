/* ===========================================================================
   Telefon doğrulama (SMS OTP) ve halka açık form hız sınırı.
   Kod ham hâliyle saklanmaz; telefonla birlikte SHA-256 özeti tutulur.
   =========================================================================== */

import { all, one, run, scalar } from "@/lib/db";
import { isValidPhone, normalizePhone } from "@/lib/format";
import { hashOtp, randomOtp } from "@/lib/password";
import { TEMPLATE, notifyCustomer } from "./notify";
import { getSettingNum, isDemoMode } from "./settings";

const MAX_ATTEMPTS = 5;
const RESEND_SECONDS = 60;

export interface OtpRequestResult {
  ok: boolean;
  error?: string;
  /** Yalnızca demo modunda ekranda gösterilmek üzere döner. */
  demoCode?: string;
  expiresInMinutes: number;
}

export async function requestOtp(rawPhone: string, ip: string | null): Promise<OtpRequestResult> {
  const minutes = getSettingNum("otp_gecerlilik_dk", 10);
  const phone = normalizePhone(rawPhone);

  if (!isValidPhone(phone)) {
    return { ok: false, error: "Geçerli bir cep telefonu numarası giriniz (örnek: 0532 123 45 67).", expiresInMinutes: minutes };
  }

  // Aynı numaraya çok sık kod gönderilmesini engelle.
  const recent = one<{ created_at: string }>(
    `SELECT created_at FROM otp_codes
      WHERE phone = ? AND created_at > datetime('now', ?)
      ORDER BY id DESC LIMIT 1`,
    phone, `-${RESEND_SECONDS} seconds`,
  );
  if (recent) {
    return {
      ok: false,
      error: `Az önce bir kod gönderildi. Yeni kod için ${RESEND_SECONDS} saniye bekleyiniz.`,
      expiresInMinutes: minutes,
    };
  }
  const hourly = scalar<number>(
    "SELECT COUNT(*) FROM otp_codes WHERE phone = ? AND created_at > datetime('now','-1 hour')",
    phone,
  ) ?? 0;
  if (hourly >= 6) {
    return {
      ok: false,
      error: "Bu numara için saatlik kod gönderim sınırına ulaşıldı. Lütfen daha sonra deneyiniz.",
      expiresInMinutes: minutes,
    };
  }

  const code = randomOtp();
  run(
    `INSERT INTO otp_codes (phone, code_hash, purpose, expires_at, ip)
     VALUES (?, ?, 'SIKAYET', datetime('now', ?), ?)`,
    phone, hashOtp(code, phone), `+${minutes} minutes`, ip,
  );

  await notifyCustomer({
    complaintId: null,
    code: TEMPLATE.OTP,
    phone,
    channels: ["SMS"],
    ctx: {
      complaintNo: "-",
      trackingToken: "-",
      otpCode: code,
      otpMinutes: minutes,
    },
  });

  return {
    ok: true,
    // Demo modunda SMS gerçekten gitmediği için kod ekranda gösterilir.
    demoCode: isDemoMode() ? code : undefined,
    expiresInMinutes: minutes,
  };
}

export interface OtpVerifyResult {
  ok: boolean;
  error?: string;
}

export function verifyOtp(rawPhone: string, code: string): OtpVerifyResult {
  const phone = normalizePhone(rawPhone);
  const row = one<{ id: number; code_hash: string; attempts: number }>(
    `SELECT id, code_hash, attempts FROM otp_codes
      WHERE phone = ? AND consumed_at IS NULL AND expires_at > datetime('now')
      ORDER BY id DESC LIMIT 1`,
    phone,
  );
  if (!row) {
    return { ok: false, error: "Doğrulama kodu bulunamadı veya süresi geçti. Yeni kod isteyiniz." };
  }
  if (row.attempts >= MAX_ATTEMPTS) {
    return { ok: false, error: "Çok fazla hatalı deneme yapıldı. Yeni kod isteyiniz." };
  }

  const given = (code ?? "").replace(/\D/g, "");
  if (hashOtp(given, phone) !== row.code_hash) {
    run("UPDATE otp_codes SET attempts = attempts + 1 WHERE id = ?", row.id);
    const left = MAX_ATTEMPTS - (row.attempts + 1);
    return {
      ok: false,
      error: left > 0
        ? `Kod hatalı. ${left} deneme hakkınız kaldı.`
        : "Kod hatalı ve deneme hakkınız doldu. Yeni kod isteyiniz.",
    };
  }

  run("UPDATE otp_codes SET consumed_at = datetime('now') WHERE id = ?", row.id);
  return { ok: true };
}

/** Numaranın son 30 dakikada doğrulanmış olup olmadığı. */
export function isPhoneVerified(rawPhone: string): boolean {
  const phone = normalizePhone(rawPhone);
  return !!one(
    `SELECT 1 FROM otp_codes
      WHERE phone = ? AND consumed_at IS NOT NULL AND consumed_at > datetime('now','-30 minutes')
      LIMIT 1`,
    phone,
  );
}

/* --- Hız sınırı ---------------------------------------------------------- */

export interface RateCheck {
  ok: boolean;
  error?: string;
}

/** Aynı IP'den saatte açılabilecek kayıt sayısını sınırlar. */
export function checkRateLimit(bucket: string, ip: string | null): RateCheck {
  if (!ip) return { ok: true };
  const limit = getSettingNum("form_saatlik_ip_limiti", 5);
  const used = scalar<number>(
    "SELECT COUNT(*) FROM rate_limits WHERE bucket = ? AND ip = ? AND created_at > datetime('now','-1 hour')",
    bucket, ip,
  ) ?? 0;
  if (used >= limit) {
    return {
      ok: false,
      error:
        "Kısa sürede çok fazla başvuru yapıldı. Lütfen bir süre sonra tekrar deneyiniz. " +
        "Acil durumlarda ilgili fabrikamızı telefonla arayabilirsiniz.",
    };
  }
  return { ok: true };
}

export function recordRateUse(bucket: string, ip: string | null): void {
  if (!ip) return;
  run("INSERT INTO rate_limits (bucket, ip) VALUES (?, ?)", bucket, ip);
  run("DELETE FROM rate_limits WHERE created_at < datetime('now','-1 day')");
}

/** Süresi geçmiş kodları temizler. */
export function pruneOtp(): void {
  run("DELETE FROM otp_codes WHERE created_at < datetime('now','-1 day')");
}

export function activeOtpCount(): number {
  return all<{ id: number }>(
    "SELECT id FROM otp_codes WHERE consumed_at IS NULL AND expires_at > datetime('now')",
  ).length;
}
