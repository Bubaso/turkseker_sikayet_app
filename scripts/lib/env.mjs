/* src/lib/env.ts dosyasının betikler için düz JS karşılığı — ikisi birlikte güncellenmelidir.
   Boş dizge değerleri de tanımsız sayar; bkz. src/lib/env.ts açıklaması. */

export function env(name, fallback) {
  const raw = process.env[name];
  if (raw === undefined || raw === null) return fallback;
  const trimmed = raw.trim();
  return trimmed === "" ? fallback : trimmed;
}

export function envBool(name, fallback = false) {
  const v = env(name, fallback ? "true" : "false").toLowerCase();
  return v === "true" || v === "1" || v === "evet";
}
