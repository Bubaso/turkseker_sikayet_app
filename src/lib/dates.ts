/* ===========================================================================
   Tarih, iş günü ve SLA hesapları
   TL PASAT 004'teki tüm süreler İŞ GÜNÜ cinsindendir. Hafta sonu ve
   resmî tatiller (holidays tablosu) sayılmaz.
   =========================================================================== */

export const TZ = "Europe/Istanbul";

/* --- ISO yardımcıları ----------------------------------------------------- */

/** "YYYY-MM-DD" biçiminde bugünün tarihi (Türkiye saatine göre). */
export function today(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date());
}

/** "YYYY-MM-DD HH:MM:SS" biçiminde şimdiki zaman (SQLite datetime uyumlu). */
export function now(): string {
  const p = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
  }).formatToParts(new Date());
  const g = (t: string) => p.find((x) => x.type === t)!.value;
  return `${g("year")}-${g("month")}-${g("day")} ${g("hour")}:${g("minute")}:${g("second")}`;
}

/** Bir tarih-saat metninden yalnızca gün kısmını alır. */
export function dayOf(value: string | null | undefined): string | null {
  if (!value) return null;
  return value.slice(0, 10);
}

function toUtcDate(ymd: string): Date {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}
function toYmd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Gün ekler/çıkarır (takvim günü). */
export function addDays(ymd: string, days: number): string {
  const d = toUtcDate(ymd);
  d.setUTCDate(d.getUTCDate() + days);
  return toYmd(d);
}

/** 0 = Pazar ... 6 = Cumartesi */
export function weekday(ymd: string): number {
  return toUtcDate(ymd).getUTCDay();
}

export function isWeekend(ymd: string): boolean {
  const w = weekday(ymd);
  return w === 0 || w === 6;
}

/** İki gün arasındaki takvim günü farkı. */
export function diffDays(from: string, to: string): number {
  return Math.round((toUtcDate(to).getTime() - toUtcDate(from).getTime()) / 86_400_000);
}

/* --- İş günü hesapları ---------------------------------------------------- */

export type HolidaySet = Set<string>;

export function isBusinessDay(ymd: string, holidays: HolidaySet): boolean {
  return !isWeekend(ymd) && !holidays.has(ymd);
}

/** Verilen günden sonraki ilk iş günü (gün kendisi iş günüyse kendisi döner). */
export function nextBusinessDay(ymd: string, holidays: HolidaySet): string {
  let d = ymd;
  let guard = 0;
  while (!isBusinessDay(d, holidays) && guard++ < 400) d = addDays(d, 1);
  return d;
}

/**
 * Başlangıç gününe N iş günü ekler.
 * Başlangıç günü sayılmaz: 0. gün şikâyet tarihi, "+1 iş günü" ertesi iş günüdür.
 */
export function addBusinessDays(ymd: string, count: number, holidays: HolidaySet): string {
  if (count <= 0) return nextBusinessDay(ymd, holidays);
  let d = ymd;
  let left = count;
  let guard = 0;
  while (left > 0 && guard++ < 2000) {
    d = addDays(d, 1);
    if (isBusinessDay(d, holidays)) left--;
  }
  return d;
}

/** İki gün arasındaki iş günü sayısı (başlangıç hariç, bitiş dahil). */
export function businessDaysBetween(from: string, to: string, holidays: HolidaySet): number {
  if (!from || !to) return 0;
  const sign = diffDays(from, to) < 0 ? -1 : 1;
  const [a, b] = sign > 0 ? [from, to] : [to, from];
  let n = 0;
  let d = a;
  let guard = 0;
  while (d !== b && guard++ < 4000) {
    d = addDays(d, 1);
    if (isBusinessDay(d, holidays)) n++;
  }
  return n * sign;
}

/* --- SLA durumu ----------------------------------------------------------- */

export type SlaState = "YOK" | "TAMAMLANDI" | "ZAMANINDA" | "YAKLASIYOR" | "GECIKTI";

export interface SlaInfo {
  state: SlaState;
  /** Son güne kalan iş günü. Negatifse gecikme. */
  daysLeft: number;
  dueAt: string | null;
  label: string;
}

/**
 * Bir kilometre taşının SLA durumunu hesaplar.
 * @param dueAt       son tarih (YYYY-MM-DD)
 * @param completedAt tamamlandıysa tamamlanma tarihi
 * @param holidays    resmî tatil kümesi
 * @param ref         kıyas günü (varsayılan: bugün)
 */
export function slaInfo(
  dueAt: string | null | undefined,
  completedAt: string | null | undefined,
  holidays: HolidaySet,
  ref: string = today(),
): SlaInfo {
  const due = dayOf(dueAt);
  if (!due) return { state: "YOK", daysLeft: 0, dueAt: null, label: "—" };

  const done = dayOf(completedAt);
  if (done) {
    const over = businessDaysBetween(due, done, holidays);
    return over > 0
      ? { state: "TAMAMLANDI", daysLeft: -over, dueAt: due, label: `${over} iş günü gecikmeli tamamlandı` }
      : { state: "TAMAMLANDI", daysLeft: 0, dueAt: due, label: "Süresinde tamamlandı" };
  }

  const left = businessDaysBetween(ref, due, holidays);
  if (diffDays(ref, due) < 0) {
    const over = Math.max(1, Math.abs(left));
    return { state: "GECIKTI", daysLeft: -over, dueAt: due, label: `${over} iş günü gecikmede` };
  }
  if (left <= 1) {
    return {
      state: "YAKLASIYOR",
      daysLeft: left,
      dueAt: due,
      label: left === 0 ? "Son gün bugün" : "Son gün yarın",
    };
  }
  return { state: "ZAMANINDA", daysLeft: left, dueAt: due, label: `${left} iş günü kaldı` };
}

export const SLA_TONE: Record<SlaState, "ink" | "ok" | "warn" | "danger" | "brand"> = {
  YOK: "ink",
  TAMAMLANDI: "ok",
  ZAMANINDA: "brand",
  YAKLASIYOR: "warn",
  GECIKTI: "danger",
};

/* --- Biçimlendirme -------------------------------------------------------- */

const MONTHS_TR = [
  "Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
  "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık",
];
export const MONTH_NAMES_TR = MONTHS_TR;

const DAYS_TR = ["Pazar", "Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi"];
export const DAY_NAMES_TR = DAYS_TR;

export function monthName(m: number): string {
  return MONTHS_TR[m - 1] ?? "";
}

/** 2026-03-09 -> 09.03.2026 */
export function fmtDate(value: string | null | undefined): string {
  const d = dayOf(value);
  if (!d) return "—";
  const [y, m, dd] = d.split("-");
  return `${dd}.${m}.${y}`;
}

/** 2026-03-09 -> 9 Mart 2026 */
export function fmtDateLong(value: string | null | undefined): string {
  const d = dayOf(value);
  if (!d) return "—";
  const [y, m, dd] = d.split("-");
  return `${Number(dd)} ${monthName(Number(m))} ${y}`;
}

/** 2026-03-09 14:05:00 -> 09.03.2026 14:05 */
export function fmtDateTime(value: string | null | undefined): string {
  if (!value) return "—";
  const d = fmtDate(value);
  const time = value.length > 10 ? value.slice(11, 16) : "";
  return time ? `${d} ${time}` : d;
}

export function dayNameOf(ymd: string): string {
  return DAYS_TR[weekday(ymd)] ?? "";
}

/** Ay içindeki tüm günleri döndürür. */
export function daysInMonth(year: number, month: number): string[] {
  const out: string[] = [];
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  for (let i = 1; i <= last; i++) {
    out.push(`${year}-${String(month).padStart(2, "0")}-${String(i).padStart(2, "0")}`);
  }
  return out;
}
