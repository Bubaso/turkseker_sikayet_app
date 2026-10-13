#!/usr/bin/env node
/* ===========================================================================
   Veritabanını ve yüklenen dosyaları siler, ardından referans verisini yükler.

   DİKKAT: Tüm şikâyet kayıtları kaybolur. Yalnızca geliştirme ortamında
   kullanın.

   GÜVENLİK: Bu betik özyinelemeli silme yapar. Yanlış bir ortam değişkeni
   yüzünden proje dışına ya da proje kökünün tamamına dokunmaması için
   silinecek yollar sıkı biçimde doğrulanır:
     - yol proje kökünün ALTINDA olmalı,
     - yüklenen dosyalar dizininin adı "uploads" olmalı,
     - veritabanı dosyasının uzantısı ".db" olmalı.
   Boş değerli ortam değişkenleri (UPLOAD_DIR= gibi) tanımsız sayılır; aksi
   halde path.resolve("") çalışma dizinini döndürür ve proje kökü silinirdi.
   =========================================================================== */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { env } from "./lib/env.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dbPath = path.resolve(ROOT, env("DATABASE_PATH", path.join(ROOT, "data", "sikayet.db")));
const uploadDir = path.resolve(ROOT, env("UPLOAD_DIR", path.join(ROOT, "data", "uploads")));

const dur = (mesaj) => { console.error(`\n  HATA: ${mesaj}\n`); process.exit(1); };

/** Verilen yolun proje kökünün altında kaldığını doğrular. */
function projeIcinde(hedef) {
  const rel = path.relative(ROOT, hedef);
  return rel !== "" && !rel.startsWith("..") && !path.isAbsolute(rel);
}

if (!projeIcinde(dbPath)) {
  dur(`DATABASE_PATH proje dizini dışında: ${dbPath}\n         Proje kökü: ${ROOT}`);
}
if (path.extname(dbPath) !== ".db") {
  dur(`DATABASE_PATH ".db" uzantılı olmalı: ${dbPath}`);
}
if (!projeIcinde(uploadDir)) {
  dur(`UPLOAD_DIR proje dizini dışında: ${uploadDir}\n         Proje kökü: ${ROOT}`);
}
if (path.basename(uploadDir) !== "uploads") {
  dur(
    `UPLOAD_DIR adı "uploads" olmalı: ${uploadDir}\n` +
    "         Bu kontrol, yanlış ayar yüzünden başka bir dizinin silinmesini önler.",
  );
}

/* --- Veritabanı dosyaları ------------------------------------------------- */

for (const ek of ["", "-wal", "-shm", "-journal"]) {
  const dosya = dbPath + ek;
  if (!fs.existsSync(dosya)) continue;
  try {
    fs.rmSync(dosya);
    console.log("silindi:", path.basename(dosya));
  } catch (e) {
    if (e.code === "EPERM" || e.code === "EBUSY") {
      // Windows açık dosyaları silmeye izin vermez.
      dur(
        `${path.basename(dosya)} dosyası kullanımda olduğu için silinemedi.\n` +
        "         Çalışan geliştirme sunucusunu (npm run dev) kapatıp tekrar deneyin.",
      );
    }
    throw e;
  }
}

/* --- Yüklenen dosyalar ---------------------------------------------------- */

if (fs.existsSync(uploadDir)) {
  let sayi = 0;
  for (const ad of fs.readdirSync(uploadDir)) {
    if (ad === ".gitkeep") continue;
    fs.rmSync(path.join(uploadDir, ad), { recursive: true, force: true });
    sayi++;
  }
  console.log(`yüklenen dosyalar temizlendi (${sayi} öğe)`);
}

/* --- Referans verisi ------------------------------------------------------ */

const r = spawnSync(
  process.execPath,
  ["--disable-warning=ExperimentalWarning", path.join(ROOT, "scripts", "seed.mjs")],
  { stdio: "inherit", cwd: ROOT },
);
process.exit(r.status ?? 0);
