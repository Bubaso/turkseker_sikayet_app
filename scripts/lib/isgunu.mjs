/* Seed script'leri için iş günü hesabı — src/lib/dates.ts ile aynı mantık. */

export function addDays(ymd, days) {
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

export function isWeekend(ymd) {
  const [y, m, d] = ymd.split("-").map(Number);
  const w = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return w === 0 || w === 6;
}

export function isBusinessDay(ymd, holidays) {
  return !isWeekend(ymd) && !holidays.has(ymd);
}

export function nextBusinessDay(ymd, holidays) {
  let d = ymd, g = 0;
  while (!isBusinessDay(d, holidays) && g++ < 400) d = addDays(d, 1);
  return d;
}

/** Başlangıç günü sayılmaz: +1 iş günü = ertesi iş günü. */
export function addBusinessDays(ymd, count, holidays) {
  if (count <= 0) return nextBusinessDay(ymd, holidays);
  let d = ymd, left = count, g = 0;
  while (left > 0 && g++ < 2000) {
    d = addDays(d, 1);
    if (isBusinessDay(d, holidays)) left--;
  }
  return d;
}
