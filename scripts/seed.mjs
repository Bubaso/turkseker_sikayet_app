#!/usr/bin/env node
/* ===========================================================================
   Referans verisi yükleyici.
   Fabrikalar, iller, daire başkanlıkları, ürünler, şikâyet kategorileri,
   laboratuvar parametreleri, resmî tatiller, ayarlar ve personel hesapları.

   Çalıştırma:  npm run db:seed
   Tekrar çalıştırmak güvenlidir (upsert mantığı).

   Örnek şikâyet verisi bu script ile DEĞİL, uygulama içindeki
   "Tanımlar > Demo Verisi" ekranından üretilir; böylece demo kayıtlar da
   gerçek iş kuralları motorundan geçer.
   =========================================================================== */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { FABRIKALAR, ILLER, DAIRELER } from "./data/kurulus.mjs";
import { URUNLER, KATEGORILER, TATILLER } from "./data/tanimlar.mjs";
import { FABRIKA_KADROSU, GM_KADROSU, uret } from "./data/personel.mjs";
import { hashPassword } from "./lib/hash.mjs";
import { Db, assertDriverAvailable, silenceSqliteWarning } from "./lib/db.mjs";
import { env } from "./lib/env.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DB_PATH = path.resolve(ROOT, env("DATABASE_PATH", path.join(ROOT, "data", "sikayet.db")));
const DEMO_PASSWORD = env("SEED_PASSWORD", "Demo2026!");

assertDriverAvailable();
silenceSqliteWarning();

fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
const db = new Db(DB_PATH);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");
db.exec(fs.readFileSync(path.join(ROOT, "src/lib/db/schema.sql"), "utf8"));

const log = (...a) => console.log("  ", ...a);

/* --- Mesafe (en yakın fabrika hesabı) ------------------------------------- */
function haversine(aLat, aLon, bLat, bLon) {
  const R = 6371;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLon = ((bLon - aLon) * Math.PI) / 180;
  const la1 = (aLat * Math.PI) / 180;
  const la2 = (bLat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

db.transaction(() => {
  /* --- Fabrikalar -------------------------------------------------------- */
  const upFactory = db.prepare(`
    INSERT INTO factories (code, name, short_name, province, lat, lon, email, phone, is_active)
    VALUES (@code, @name, @short, @province, @lat, @lon, @email, @phone, 1)
    ON CONFLICT(code) DO UPDATE SET
      name = excluded.name, short_name = excluded.short_name, province = excluded.province,
      lat = excluded.lat, lon = excluded.lon
  `);
  for (const f of FABRIKALAR) {
    upFactory.run({
      ...f,
      email: `${f.code.toLowerCase()}.sikayet@turkseker.gov.tr`,
      phone: null,
    });
  }
  const factoryByCode = Object.fromEntries(
    db.prepare("SELECT id, code, lat, lon FROM factories").all().map((r) => [r.code, r]),
  );
  log(`Fabrika: ${FABRIKALAR.length}`);

  /* --- İller + en yakın fabrika ----------------------------------------- */
  const upProvince = db.prepare(`
    INSERT INTO provinces (code, name, nearest_factory_id) VALUES (?, ?, ?)
    ON CONFLICT(code) DO UPDATE SET name = excluded.name,
                                    nearest_factory_id = excluded.nearest_factory_id
  `);
  for (const il of ILLER) {
    let best = null;
    let bestKm = Infinity;
    for (const f of Object.values(factoryByCode)) {
      const km = haversine(il.lat, il.lon, f.lat, f.lon);
      if (km < bestKm) { bestKm = km; best = f; }
    }
    upProvince.run(il.code, il.name, best.id);
  }
  log(`İl: ${ILLER.length} (en yakın fabrika eşlemesi hesaplandı)`);

  /* --- Daire başkanlıkları ---------------------------------------------- */
  const upDept = db.prepare(`
    INSERT INTO departments (code, name, can_decide, is_active) VALUES (?, ?, ?, 1)
    ON CONFLICT(code) DO UPDATE SET name = excluded.name, can_decide = excluded.can_decide
  `);
  for (const d of DAIRELER) upDept.run(d.code, d.name, d.canDecide);
  const deptByCode = Object.fromEntries(
    db.prepare("SELECT id, code FROM departments").all().map((r) => [r.code, r.id]),
  );
  log(`Daire Başkanlığı: ${DAIRELER.length}`);

  /* --- Ürünler ----------------------------------------------------------- */
  const hasProduct = db.prepare(
    "SELECT id FROM products WHERE name = ? AND IFNULL(packaging,'') = IFNULL(?,'')",
  );
  const insProduct = db.prepare(
    "INSERT INTO products (name, product_group, packaging, sort_order, is_active) VALUES (?, ?, ?, ?, 1)",
  );
  for (const p of URUNLER) {
    if (!hasProduct.get(p.name, p.packaging)) insProduct.run(p.name, p.group, p.packaging, p.sort);
  }
  log(`Ürün: ${db.prepare("SELECT COUNT(*) c FROM products").get().c}`);

  /* --- Şikâyet kategorileri --------------------------------------------- */
  const hasCat = db.prepare("SELECT id FROM complaint_categories WHERE name = ?");
  const insCat = db.prepare(`
    INSERT INTO complaint_categories (name, family, is_critical, needs_lab, sort_order, is_active)
    VALUES (?, ?, ?, ?, ?, 1)
  `);
  for (const k of KATEGORILER) {
    if (!hasCat.get(k.name)) insCat.run(k.name, k.family, k.critical, k.lab, k.sort);
  }
  log(`Şikâyet kategorisi: ${db.prepare("SELECT COUNT(*) c FROM complaint_categories").get().c}`);


  /* --- Resmî tatiller ---------------------------------------------------- */
  const upHoliday = db.prepare(
    "INSERT INTO holidays (date, name) VALUES (?, ?) ON CONFLICT(date) DO UPDATE SET name = excluded.name",
  );
  for (const h of TATILLER) upHoliday.run(h.date, h.name);
  log(`Resmî tatil: ${TATILLER.length} (2025-2027)`);

  /* --- Ayarlar ----------------------------------------------------------- */
  const upSetting = db.prepare(`
    INSERT INTO settings (key, value, label) VALUES (?, ?, ?)
    ON CONFLICT(key) DO UPDATE SET label = excluded.label
  `);
  const settings = [
    ["kurum_adi", "Türkiye Şeker Fabrikaları A.Ş.", "Kurum adı"],
    ["uygulama_adi", "Müşteri Şikâyet Takip Sistemi", "Uygulama adı"],
    ["halka_acik_form_aktif", "1", "Halka açık şikâyet formu açık mı"],
    ["otp_zorunlu", "1", "Şikâyet kaydında SMS doğrulaması zorunlu"],
    ["otp_gecerlilik_dk", "10", "SMS doğrulama kodunun geçerlilik süresi (dakika)"],
    ["form_saatlik_ip_limiti", "5", "Aynı IP'den saatte açılabilecek en fazla kayıt"],
    ["sms_gonderen_basligi", "TURKSEKER", "SMS gönderen başlığı"],
    ["ek_dosya_max_mb", "10", "Tek dosya için en büyük boyut (MB)"],
    ["ek_dosya_max_adet", "8", "Şikâyet başına en fazla kanıt dosyası"],
    [
      "kvkk_metni",
      "6698 sayılı Kişisel Verilerin Korunması Kanunu uyarınca; şikâyet başvurunuzda " +
      "verdiğiniz kimlik, iletişim ve ticari bilgileriniz yalnızca şikâyetinizin " +
      "incelenmesi, sonuçlandırılması ve tarafınıza geri bildirim yapılması amacıyla " +
      "Türkiye Şeker Fabrikaları A.Ş. tarafından işlenir; ilgili fabrika birimleri ve " +
      "Genel Müdürlük daire başkanlıkları ile paylaşılır. Mevzuatta öngörülen saklama " +
      "süresi sonunda imha edilir. Kanunun 11. maddesindeki haklarınızı " +
      "kvkk@turkseker.gov.tr adresine başvurarak kullanabilirsiniz.",
      "KVKK aydınlatma metni",
    ],
  ];
  for (const [k, v, l] of settings) upSetting.run(k, v, l);
  log(`Ayar: ${settings.length}`);

  /* --- Personel hesapları ------------------------------------------------ */
  const pwd = hashPassword(DEMO_PASSWORD);
  const upUser = db.prepare(`
    INSERT INTO users (username, password_hash, full_name, title, role, factory_id, department_id, email, phone, is_active, is_demo)
    VALUES (@username, @pwd, @full_name, @title, @role, @factory_id, @department_id, @email, @phone, 1, 1)
    ON CONFLICT(username) DO UPDATE SET
      full_name = excluded.full_name, title = excluded.title, role = excluded.role,
      factory_id = excluded.factory_id, department_id = excluded.department_id,
      email = excluded.email, is_active = 1
  `);

  FABRIKALAR.forEach((f, fi) => {
    const factoryId = factoryByCode[f.code].id;
    FABRIKA_KADROSU.forEach((k, ki) => {
      const username = `${f.code.toLowerCase()}.${k.key}`;
      upUser.run({
        username,
        pwd,
        full_name: uret(fi, ki),
        title: k.title,
        role: k.role,
        factory_id: factoryId,
        department_id: null,
        email: `${username}@turkseker.gov.tr`,
        phone: null,
      });
    });
  });

  GM_KADROSU.forEach((k, ki) => {
    upUser.run({
      username: k.key,
      pwd,
      full_name: uret(20 + ki, ki + 2),
      title: k.title,
      role: k.role,
      factory_id: null,
      department_id: k.dept ? deptByCode[k.dept] : null,
      email: `${k.key.replace(".", "-")}@turkseker.gov.tr`,
      phone: null,
    });
  });

  const userCount = db.prepare("SELECT COUNT(*) c FROM users").get().c;
  log(`Kullanıcı: ${userCount} (şifre: ${DEMO_PASSWORD})`);
});

db.close();
console.log("\n✓ Referans verisi yüklendi:", DB_PATH);
console.log("  Örnek şikâyet kayıtları için: uygulamayı açıp Tanımlar > Demo Verisi ekranını kullanın.\n");
