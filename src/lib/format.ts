/* Sayı, para ve metin biçimlendirme yardımcıları (tr-TR). */

const nfKg = new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 2 });
const nfTl = new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const nfInt = new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 0 });

export function fmtKg(v: number | null | undefined): string {
  if (v == null) return "—";
  return `${nfKg.format(v)} kg`;
}

/** Kilogramı okunabilir ton/kg biçiminde gösterir. */
export function fmtQuantity(kg: number | null | undefined): string {
  if (kg == null) return "—";
  if (kg >= 1000) return `${nfKg.format(kg / 1000)} ton`;
  return `${nfKg.format(kg)} kg`;
}

export function fmtTl(v: number | null | undefined): string {
  if (v == null) return "—";
  return `${nfTl.format(v)} ₺`;
}

export function fmtNum(v: number | null | undefined): string {
  if (v == null) return "—";
  return nfInt.format(v);
}

export function fmtPct(v: number | null | undefined, digits = 0): string {
  if (v == null || Number.isNaN(v)) return "—";
  return `%${v.toFixed(digits).replace(".", ",")}`;
}

/** Telefonu 0555 123 45 67 biçiminde gösterir. */
export function fmtPhone(raw: string | null | undefined): string {
  if (!raw) return "—";
  const d = raw.replace(/\D/g, "");
  const n = d.startsWith("90") ? d.slice(2) : d;
  const t = n.startsWith("0") ? n.slice(1) : n;
  if (t.length !== 10) return raw;
  return `0${t.slice(0, 3)} ${t.slice(3, 6)} ${t.slice(6, 8)} ${t.slice(8)}`;
}

/** Telefonu 5551234567 (10 hane) biçimine indirger. */
export function normalizePhone(raw: string): string {
  const d = (raw ?? "").replace(/\D/g, "");
  let n = d;
  if (n.startsWith("90") && n.length > 10) n = n.slice(2);
  if (n.startsWith("0")) n = n.slice(1);
  return n;
}

export function isValidPhone(raw: string): boolean {
  const n = normalizePhone(raw);
  return /^5\d{9}$/.test(n);
}

export function maskPhone(raw: string | null | undefined): string {
  const n = normalizePhone(raw ?? "");
  if (n.length !== 10) return "—";
  return `0${n.slice(0, 3)} *** ** ${n.slice(8)}`;
}

export function isValidEmail(raw: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/.test((raw ?? "").trim());
}

export function fmtBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export function initials(fullName: string): string {
  return fullName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toLocaleUpperCase("tr-TR"))
    .join("");
}

export function truncate(s: string | null | undefined, n: number): string {
  if (!s) return "";
  return s.length <= n ? s : `${s.slice(0, n - 1)}…`;
}
