import { all, one, run } from "@/lib/db";

export interface SettingRow {
  key: string;
  value: string;
  label: string | null;
}

export function getSetting(key: string, fallback = ""): string {
  const row = one<{ value: string }>("SELECT value FROM settings WHERE key = ?", key);
  return row?.value ?? fallback;
}

export function getSettingNum(key: string, fallback: number): number {
  const v = Number(getSetting(key, String(fallback)));
  return Number.isFinite(v) ? v : fallback;
}

export function getSettingBool(key: string, fallback = false): boolean {
  const v = getSetting(key, fallback ? "1" : "0");
  return v === "1" || v.toLowerCase() === "true";
}

export function setSetting(key: string, value: string, label?: string): void {
  run(
    `INSERT INTO settings (key, value, label, updated_at) VALUES (?, ?, ?, datetime('now'))
     ON CONFLICT(key) DO UPDATE SET value = excluded.value,
                                    label = COALESCE(excluded.label, settings.label),
                                    updated_at = datetime('now')`,
    key, value, label ?? null,
  );
}

export function listSettings(): SettingRow[] {
  return all<SettingRow>("SELECT key, value, label FROM settings ORDER BY key");
}

/** Resmî tatil kümesi — tüm iş günü hesaplarının kaynağı. */
export function holidaySet(): Set<string> {
  return new Set(all<{ date: string }>("SELECT date FROM holidays").map((r) => r.date));
}

/** Demo rol değiştirici açık mı. */
export function isDemoMode(): boolean {
  return (process.env.DEMO_MODE ?? "false").toLowerCase() === "true";
}
