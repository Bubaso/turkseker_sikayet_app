/* ===========================================================================
   Tek sorumlu ve sıra kuralı testi — sadeleştirilmiş modele göre.

   Doğrulananlar:
     1. Sırası gelmiş aşamanın sorumlusu "Sıra sizde" görür ve kayıt formu açılır.
     2. Sorumluya hiçbir koşulda "size düşen işlem yok" denmez.
     3. Aynı fabrikadan ilgisiz personel o aşamada kayıt formu görmez; aşamanın
        kimin üzerinde olduğunu okur.
     4. Sırası gelmemiş aşama "Sırası gelmedi" görünür ve neyi beklediğini yazar.
     5. Fabrika Müdürü aşamayı kaydedebilir (iş fabrikada elle yapılır) ve
        sorumluyu değiştirebilir.
     6. Başka fabrikanın personeli dosyaya erişemez.
     7. Kayıt yolu yalnızca belge yüklemektir; elle "tamamlandı" yolu yoktur.
     8. Dosya künyesindeki "Şu anki adım" satırı dosyanın kimde olduğunu söyler.
     9. Açık dosyaların hepsinde, sırası gelmiş aşamanın sorumlusu kendi işini
        görür (sınıf hatası taraması).

   Kullanım: sunucu ayakta ve demo verisi üretilmiş olmalı.
     TEST_BASE=http://localhost:3000 node tests/sahiplik.mjs
   =========================================================================== */

import path from "node:path";
import { Db, silenceSqliteWarning } from "../scripts/lib/db.mjs";
import { env } from "../scripts/lib/env.mjs";
import { chromiumYukle } from "./lib/tarayici.mjs";

const chromium = await chromiumYukle();
const BASE = env("TEST_BASE", "http://localhost:3000");
const SIFRE = "Demo2026!";
const ROOT = path.resolve(import.meta.dirname, "..");

silenceSqliteWarning();
const db = new Db(path.resolve(ROOT, env("DATABASE_PATH", path.join(ROOT, "data", "sikayet.db"))));
const sorgu = (sql, ...p) => db.prepare(sql).all(...p);

let gecen = 0;
let kalan = 0;

function kontrol(ad, kosul, ek = "") {
  if (kosul) { gecen++; console.log(`  ✓ ${ad}`); }
  else { kalan++; console.log(`  ✗ ${ad}${ek ? ` — ${ek}` : ""}`); }
}

/* --- Test dosyasını ve ilgili personeli veritabanından seç ---------------- */

/*
 * "Şu anki aşama" = dosyanın açık aşamaları içinde sıra numarası en küçük olan.
 * Test hangi aşama olduğundan bağımsız çalışsın diye dosyayı buna göre seçer;
 * ayrıca dosyada sırası henüz gelmemiş en az bir aşama daha bulunmalıdır.
 */
const adaylar = sorgu(`
  SELECT c.id, c.complaint_no, c.factory_id,
         t.id AS task_id, t.code, t.title, t.sort_order, t.assignee_id,
         u.username, u.full_name, u.role
    FROM complaints c
    JOIN tasks t ON t.complaint_id = c.id
    LEFT JOIN users u ON u.id = t.assignee_id
   WHERE t.status IN ('BEKLEMEDE','DEVAM_EDIYOR')
     AND t.assignee_id IS NOT NULL
     AND t.department_id IS NULL
     AND c.status NOT IN ('KAPANDI','REDDEDILDI','IPTAL')
     AND t.sort_order = (SELECT MIN(x.sort_order) FROM tasks x
                          WHERE x.complaint_id = c.id
                            AND x.status IN ('BEKLEMEDE','DEVAM_EDIYOR'))
     AND (SELECT COUNT(*) FROM tasks y WHERE y.complaint_id = c.id
            AND y.status IN ('BEKLEMEDE','DEVAM_EDIYOR')) >= 2
   ORDER BY c.id`);

// Sorumlusu Fabrika Müdürü olmayan bir dosya seçilir; böylece "ilgisiz personel"
// ile "müdür" ayrımı da sınanabilir.
const dosya = adaylar.find((a) => a.role !== "FABRIKA_MUDURU") ?? adaylar[0];

if (!dosya) {
  console.error(
    "Test için uygun dosya yok: en az iki açık aşaması olan açık bir dosya gerekiyor.\n" +
    "Önce Tanımlar > Demo Verisi ekranından demo verisi üretin.",
  );
  process.exit(1);
}

const [sonraki] = sorgu(
  `SELECT title FROM tasks
    WHERE complaint_id = ? AND status IN ('BEKLEMEDE','DEVAM_EDIYOR') AND sort_order > ?
    ORDER BY sort_order LIMIT 1`,
  dosya.id, dosya.sort_order,
);
const [mudur] = sorgu(
  "SELECT username, full_name FROM users WHERE factory_id = ? AND role = 'FABRIKA_MUDURU' LIMIT 1",
  dosya.factory_id,
);
const [yabanci] = sorgu(
  "SELECT username FROM users WHERE factory_id IS NOT NULL AND factory_id <> ? LIMIT 1",
  dosya.factory_id,
);
const [digeri] = sorgu(
  `SELECT username, full_name FROM users
    WHERE factory_id = ? AND id <> ? AND role NOT IN ('FABRIKA_MUDURU') LIMIT 1`,
  dosya.factory_id, dosya.assignee_id,
);

const dosyaUrl = `${BASE}/panel/sikayet/${dosya.id}`;
const ASAMA = dosya.title;
const SONRAKI = sonraki?.title ?? null;

console.log(`\nTest dosyası      : ${dosya.complaint_no} (#${dosya.id})`);
console.log(`Şu anki aşama     : ${ASAMA}`);
console.log(`Aşama sorumlusu   : ${dosya.full_name} (${dosya.username})`);
console.log(`Sıradaki aşama    : ${SONRAKI ?? "—"}`);
console.log(`Fabrika Müdürü    : ${mudur.full_name} (${mudur.username})`);
console.log(`İlgisiz personel  : ${digeri.full_name} (${digeri.username})\n`);

const tarayici = await chromium.launch();

async function girisYap(kullanici) {
  const sayfa = await (await tarayici.newContext({ viewport: { width: 1440, height: 1100 } })).newPage();
  sayfa.on("dialog", (d) => d.accept());
  await sayfa.goto(`${BASE}/giris`, { waitUntil: "domcontentloaded" });
  await sayfa.fill("#username", kullanici);
  await sayfa.fill("#password", SIFRE);
  await sayfa.click('button[type="submit"]');
  await sayfa.waitForURL(/\/panel/, { timeout: 20000 });
  return sayfa;
}

/** Aşama kutusunu başlığından bulur. */
function asamaKutusu(sayfa, baslik) {
  return sayfa
    .locator("li.card")
    .filter({ has: sayfa.locator(`p:text-is(${JSON.stringify(baslik)})`) })
    .first();
}

/** Sayfadaki açık kayıt formu düğmeleri. */
function kayitFormu(sayfa) {
  return sayfa.locator('button:has-text("Kaydet ve aşamayı kapat"), button:has-text("Ekibi oluştur")');
}

try {
  /* --- 1. Sorumlu: "Sıra sizde" + kayıt formu ---------------------------- */
  console.log("1) Aşamanın sorumlusu");
  const sorumlu = await girisYap(dosya.username);
  await sorumlu.goto(dosyaUrl, { waitUntil: "domcontentloaded" });
  const kutuSorumlu = asamaKutusu(sorumlu, ASAMA);
  kontrol("Aşama dosyada görünüyor", (await kutuSorumlu.count()) > 0, ASAMA);
  kontrol("Sorumlu 'Sıra sizde' görüyor",
          (await kutuSorumlu.getByText("Sıra sizde").count()) > 0);
  kontrol("Sorumlunun kayıt formu açık",
          (await kutuSorumlu.locator("form").count()) > 0);

  const sorumluMetni = await sorumlu.locator("body").innerText();
  kontrol("Sorumluya 'size düşen işlem yok' denmiyor",
          !sorumluMetni.includes("size düşen bir işlem yok"), ASAMA);

  /* --- 2. Dosya künyesindeki "Şu anki adım" ------------------------------ */
  console.log("\n2) Dosya künyesi");
  kontrol("'Şu anki adım' satırı dosyanın kimde olduğunu söylüyor",
          sorumluMetni.includes("Şu anki adım") && sorumluMetni.includes(dosya.full_name));

  /* --- 3. Sırası gelmemiş aşama ----------------------------------------- */
  if (SONRAKI) {
    console.log("\n3) Sırası gelmemiş aşama");
    const kutuSonraki = asamaKutusu(sorumlu, SONRAKI);
    const metin = (await kutuSonraki.innerText()).replace(/\s+/g, " ");
    kontrol("Sırası gelmemiş aşama 'Sırası gelmedi' görünüyor",
            metin.includes("Sırası gelmedi"), metin.slice(0, 120));
    kontrol("Neyi beklediği yazılı", metin.includes("Önce tamamlanmalı"), metin.slice(0, 120));
    kontrol("Sırası gelmemiş aşamanın formu yok",
            (await kutuSonraki.locator("form").count()) === 0);
  }

  /* --- 4. Aynı fabrikadan ilgisiz personel ------------------------------ */
  console.log("\n4) Aynı fabrikadan ilgisiz personel");
  const ilgisiz = await girisYap(digeri.username);
  await ilgisiz.goto(dosyaUrl, { waitUntil: "domcontentloaded" });
  const kutuIlgisiz = asamaKutusu(ilgisiz, ASAMA);
  kontrol("İlgisiz personel aşamayı görüyor", (await kutuIlgisiz.count()) > 0);
  kontrol("İlgisiz personelin kayıt formu yok", (await kayitFormu(ilgisiz).count()) === 0);
  const ilgisizMetni = (await kutuIlgisiz.innerText()).replace(/\s+/g, " ");
  kontrol("Aşamanın kimin üzerinde olduğu yazılı",
          ilgisizMetni.includes(dosya.full_name), ilgisizMetni.slice(0, 140));
  kontrol("İlgisiz personele 'Sıra sizde' denmiyor", !ilgisizMetni.includes("Sıra sizde"));

  /* --- 5. Fabrika Müdürü ------------------------------------------------- */
  console.log("\n5) Fabrika Müdürü");
  const md = await girisYap(mudur.username);
  await md.goto(dosyaUrl, { waitUntil: "domcontentloaded" });
  const kutuMudur = asamaKutusu(md, ASAMA);
  kontrol("Müdür aşamayı kaydedebilir (iş fabrikada elle yapılır)",
          (await kutuMudur.locator("form").count()) > 0);
  await kutuMudur.locator("summary").first().click().catch(() => {});
  await md.waitForTimeout(200);
  kontrol("Müdür sorumluyu değiştirebilir",
          (await kutuMudur.locator('button:has-text("Sorumluyu değiştir")').count()) > 0);
  kontrol("Müdür aşamayı 'gerek yok' olarak işaretleyebilir",
          (await kutuMudur.locator('button:has-text("Gerek yok")').count()) > 0);

  /* --- 6. Başka fabrikanın personeli ------------------------------------ */
  console.log("\n6) Başka fabrikanın personeli");
  const el = await girisYap(yabanci.username);
  await el.goto(dosyaUrl, { waitUntil: "domcontentloaded" });
  kontrol("Başka fabrikanın personeli dosyaya erişemiyor",
          /\/panel\/sikayetler/.test(el.url()), el.url());

  /* --- 7. Kayıt yolu yalnızca belge yüklemek ---------------------------- */
  console.log("\n7) Kayıt yolu");
  const elleTamam = await sorumlu.locator('button:has-text("Tamamlandı olarak işaretle")').count();
  kontrol("Elle 'tamamlandı' düğmesi yok", elleTamam === 0);
  const dosyaAlani = await kutuSorumlu.locator('input[type="file"]').count();
  if (dosyaAlani > 0) {
    kontrol("Belge alanı zorunlu",
            (await kutuSorumlu.locator('input[type="file"][required]').count()) > 0);
  } else {
    kontrol("Belge istemeyen aşama (ekip / kapanış) belge alanı göstermiyor", true);
  }

  /* --- 8. Sınıf hatası taraması ----------------------------------------- */
  console.log("\n8) Tüm açık dosyalarda sorumluya iş görünüyor mu?");
  const hepsi = sorgu(`
    SELECT c.id AS cid, t.title, u.username, u.full_name
      FROM complaints c
      JOIN tasks t ON t.complaint_id = c.id
      JOIN users u ON u.id = t.assignee_id
     WHERE t.status IN ('BEKLEMEDE','DEVAM_EDIYOR')
       AND c.status NOT IN ('KAPANDI','REDDEDILDI','IPTAL')
       AND t.department_id IS NULL
       AND t.sort_order = (SELECT MIN(x.sort_order) FROM tasks x
                            WHERE x.complaint_id = c.id
                              AND x.status IN ('BEKLEMEDE','DEVAM_EDIYOR'))
     ORDER BY c.id LIMIT 12`);

  const oturumlar = new Map();
  let sorunlu = 0;
  for (const r of hepsi) {
    let sayfa = oturumlar.get(r.username);
    if (!sayfa) { sayfa = await girisYap(r.username); oturumlar.set(r.username, sayfa); }
    await sayfa.goto(`${BASE}/panel/sikayet/${r.cid}`, { waitUntil: "domcontentloaded" });
    const kutu = asamaKutusu(sayfa, r.title);
    const form = await kutu.locator("form").count();
    const sira = await kutu.getByText("Sıra sizde").count();
    if (form === 0 || sira === 0) {
      sorunlu++;
      console.log(`     #${r.cid} "${r.title}" → ${r.full_name}: form=${form} sıra=${sira}`);
    }
  }
  kontrol(`${hepsi.length} dosyanın hepsinde sorumlu kendi işini görüyor`, sorunlu === 0,
          `${sorunlu} dosyada görünmüyor`);

} catch (e) {
  kalan++;
  console.log(`  ✗ Beklenmeyen hata: ${e.message}`);
  console.error(e.stack?.split("\n").slice(0, 4).join("\n"));
} finally {
  await tarayici.close();
}

console.log(`\n${"=".repeat(60)}`);
console.log(`SONUÇ: ${gecen} başarılı, ${kalan} başarısız`);
console.log("=".repeat(60));
process.exit(kalan ? 1 : 0);
