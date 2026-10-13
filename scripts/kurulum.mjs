#!/usr/bin/env node
/* ===========================================================================
   Tek komutluk kurulum: ortam dosyasını hazırlar, Node sürümünü doğrular ve
   referans verisini yükler.

   Windows, macOS ve Linux'ta aynı şekilde çalışır; kabuk komutu (cp, export vb.)
   kullanmaz.

   Çalıştırma:  npm run kurulum
   =========================================================================== */

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const yesil = (s) => `\x1b[32m${s}\x1b[0m`;
const sari = (s) => `\x1b[33m${s}\x1b[0m`;
const kirmizi = (s) => `\x1b[31m${s}\x1b[0m`;

let uyari = 0;
const adim = (s) => console.log(`\n${s}`);
const ok = (s) => console.log(`  ${yesil("✓")} ${s}`);
const uyar = (s) => { uyari++; console.log(`  ${sari("!")} ${s}`); };
const dur = (s) => { console.error(`\n  ${kirmizi("✗")} ${s}\n`); process.exit(1); };

console.log("Türkşeker Müşteri Şikâyet Takip Sistemi — kurulum");

/* --- 1. Node sürümü ------------------------------------------------------- */
adim("1. Node.js sürümü");
const [major, minor] = process.versions.node.split(".").map(Number);
const yeterli = major > 22 || (major === 22 && minor >= 13);
if (!yeterli) {
  dur(
    `Node.js ${process.versions.node} kullanıyorsunuz. Bu uygulama Node'un yerleşik\n` +
    "    SQLite desteğini kullanır; en az 22.13 (ya da 24 LTS) gerekir.\n" +
    "    https://nodejs.org adresinden LTS sürümü kurup tekrar deneyin.",
  );
}
try {
  const { DatabaseSync } = await import("node:sqlite");
  if (typeof DatabaseSync !== "function") throw new Error("DatabaseSync yok");
  ok(`Node.js ${process.versions.node} — yerleşik SQLite kullanılabilir`);
} catch {
  dur(
    `Node.js ${process.versions.node} yerleşik SQLite (node:sqlite) modülünü sunmuyor.\n` +
    "    Node.js 22.13+ veya 24 LTS sürümüne yükseltin: https://nodejs.org",
  );
}

/* --- 2. Dizin kontrolü ---------------------------------------------------- */
adim("2. Çalışma dizini");
const dizin = ROOT;
const korumali = [
  /^[A-Za-z]:\\Windows(\\|$)/i,
  /^[A-Za-z]:\\Program Files/i,
  /^\/usr\/(bin|lib|local\/bin)(\/|$)/,
  /^\/System(\/|$)/,
];
if (korumali.some((r) => r.test(dizin))) {
  dur(
    `Proje korumalı bir sistem dizininde: ${dizin}\n\n` +
    "    Buraya yazma izni olmadığı için kurulum tamamlanamaz (EPERM hataları).\n" +
    "    Projeyi kullanıcı klasörünüze taşıyın, örneğin:\n\n" +
    "      cd %USERPROFILE%\n" +
    "      git clone https://github.com/Bubaso/turkseker_sikayet_app\n" +
    "      cd turkseker_sikayet_app\n",
  );
}
try {
  const deneme = path.join(dizin, ".yazma-denemesi.tmp");
  fs.writeFileSync(deneme, "x");
  fs.rmSync(deneme);
  ok(`${dizin} — yazma izni var`);
} catch {
  dur(`${dizin} dizinine yazılamıyor. Projeyi kullanıcı klasörünüze taşıyın.`);
}

/* --- 3. Bağımlılıklar ----------------------------------------------------- */
adim("3. Bağımlılıklar");
if (!fs.existsSync(path.join(ROOT, "node_modules", "next"))) {
  dur("Bağımlılıklar kurulu değil. Önce şu komutu çalıştırın:\n\n      npm install\n");
}
ok("node_modules hazır (derleme gerektiren yerel bağımlılık yok)");

/* --- 4. Ortam dosyası ----------------------------------------------------- */
adim("4. Ortam dosyası (.env.local)");
const envLocal = path.join(ROOT, ".env.local");
const envOrnek = path.join(ROOT, ".env.example");

if (fs.existsSync(envLocal)) {
  const icerik = fs.readFileSync(envLocal, "utf8");
  if (/^SESSION_SECRET=degistirilmesi-gereken/m.test(icerik)) {
    uyar(".env.local var ama SESSION_SECRET hâlâ varsayılan değerde (canlıda değiştirin)");
  } else {
    ok(".env.local zaten var, dokunulmadı");
  }
} else {
  if (!fs.existsSync(envOrnek)) dur(".env.example bulunamadı; depo eksik klonlanmış olabilir.");
  const gizli = crypto.randomBytes(48).toString("hex");
  const icerik = fs
    .readFileSync(envOrnek, "utf8")
    .replace(/^SESSION_SECRET=.*$/m, `SESSION_SECRET=${gizli}`);
  fs.writeFileSync(envLocal, icerik);
  ok(".env.local oluşturuldu (SESSION_SECRET rastgele üretildi, DEMO_MODE=true)");
}

/* --- 5. Veri dizinleri ---------------------------------------------------- */
adim("5. Veri dizinleri");
for (const d of ["data", path.join("data", "uploads")]) {
  fs.mkdirSync(path.join(ROOT, d), { recursive: true });
}
ok("data/ ve data/uploads/ hazır");

/* --- 6. Referans verisi --------------------------------------------------- */
adim("6. Referans verisi");
const seed = spawnSync(
  process.execPath,
  ["--disable-warning=ExperimentalWarning", path.join(ROOT, "scripts", "seed.mjs")],
  { stdio: "inherit", cwd: ROOT },
);
if (seed.status !== 0) dur("Referans verisi yüklenemedi (yukarıdaki hataya bakın).");

/* --- Bitti ---------------------------------------------------------------- */
console.log(`\n${"─".repeat(62)}`);
console.log(`${yesil("Kurulum tamamlandı.")}${uyari ? sari(` (${uyari} uyarı)`) : ""}`);
console.log(`
Başlatmak için:

    npm run dev

Sonra tarayıcıda:

    http://localhost:3000          müşteri karşılama sayfası
    http://localhost:3000/giris    personel girişi

Giriş bilgisi:  kullanıcı ${yesil("sistem")}   şifre ${yesil("Demo2026!")}

İlk iş olarak ${yesil("Tanımlar → Demo Verisi")} ekranından örnek şikâyet üretin;
panolar ve raporlar o anda anlamlı veriyle dolar.
${"─".repeat(62)}`);
