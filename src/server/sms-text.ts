/* SMS metin yardımcıları: Türkçe karakter dönüşümü ve kredi (segment) hesabı. */

const TR_MAP: Record<string, string> = {
  ş: "s", Ş: "S", ğ: "g", Ğ: "G", ı: "i", İ: "I",
  ö: "o", Ö: "O", ü: "u", Ü: "U", ç: "c", Ç: "C", â: "a", Â: "A", î: "i", û: "u",
};

/**
 * Türkçe özel karakterleri ASCII karşılıklarına çevirir.
 * GSM-7 alfabesi ş/ğ/ı/İ içermediği için bu karakterler mesajı UCS-2'ye
 * düşürür ve segment başına 160 yerine 70 karaktere iner. Varsayılan olarak
 * dönüşüm uygulanır; "sms_turkce_karakter" ayarı ile kapatılabilir.
 */
export function asciify(text: string): string {
  return text.replace(/[şŞğĞıİöÖüÜçÇâÂîû]/g, (c) => TR_MAP[c] ?? c);
}

/* GSM-7 temel alfabesi + uzatma tablosu (uzatma karakterleri 2 birim sayar). */
const GSM7 =
  "@£$¥èéùìòÇ\nØø\rÅå_ÆæßÉ !\"#¤%&'()*+,-./0123456789:;<=>?" +
  "¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà" +
  "ΔΦΓΛΩΠΨΣΘΞ";
const GSM7_EXT = "^{}\\[~]|€";

function isGsm7(text: string): boolean {
  for (const ch of text) {
    if (!GSM7.includes(ch) && !GSM7_EXT.includes(ch)) return false;
  }
  return true;
}

function gsm7Length(text: string): number {
  let n = 0;
  for (const ch of text) n += GSM7_EXT.includes(ch) ? 2 : 1;
  return n;
}

export interface SmsMetrics {
  /** Operatörün ücretlendireceği mesaj adedi. */
  segments: number;
  /** Kullanılan karakter birimi. */
  length: number;
  /** Tek mesaja sığan en fazla karakter. */
  limit: number;
  encoding: "GSM-7" | "UCS-2";
}

/** Bir SMS metninin kaç kredi tutacağını hesaplar. */
export function smsMetrics(text: string): SmsMetrics {
  if (isGsm7(text)) {
    const len = gsm7Length(text);
    const segments = len <= 160 ? 1 : Math.ceil(len / 153);
    return { segments: Math.max(1, segments), length: len, limit: 160, encoding: "GSM-7" };
  }
  const len = [...text].length;
  const segments = len <= 70 ? 1 : Math.ceil(len / 67);
  return { segments: Math.max(1, segments), length: len, limit: 70, encoding: "UCS-2" };
}
