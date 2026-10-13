/* src/lib/env.ts dosyasının betikler için düz JS karşılığı — ikisi birlikte güncellenmelidir.
   Boş dizge değerleri de tanımsız sayar; bkz. src/lib/env.ts açıklaması.

   Ayrıca .env dosyalarını yükler: Next.js bunu kendiliğinden yapar, düz "node"
   ile çalışan betikler yapmaz. Yüklenmezse uygulama ile betikler farklı
   DATABASE_PATH / UPLOAD_DIR değerlerini görür; kurulum "tamamlandı" der ama
   uygulamanın açtığı veritabanı boş kalırdı. */

import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

// Next.js ile aynı öncelik: .env.local önce yüklenir, loadEnvFile var olan
// değişkenleri ezmediği için sonraki dosyalar yalnızca eksikleri tamamlar.
for (const ad of [".env.local", ".env"]) {
  try {
    process.loadEnvFile(path.join(ROOT, ad));
  } catch {
    // Dosya yoksa ya da Node sürümü desteklemiyorsa varsayılanlarla devam edilir.
  }
}

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
