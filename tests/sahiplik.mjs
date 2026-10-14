/* ===========================================================================
   Tek sorumlu ve sıra kuralı testi.

   Doğrulananlar:
     1. Sırası gelmiş adımın sorumlusu "Sıra sizde" görür ve düğmesi vardır.
     2. Aynı fabrikadaki başka personel o adımda düğme görmez, kimde olduğunu görür.
     3. Sırası gelmemiş adım "Sırada bekliyor" olarak görünür, düğmesi yoktur.
     4. Sırası/sorumlusu olmayan kişiye adımın formu hiç gösterilmez.
     5. Fabrika Müdürü adımı kendi işlemez, sorumluyu değiştirebilir.
     6. Başka fabrikanın personeli dosyaya erişemez.
     7. Şeritte elle "tamamlandı" yapma yolu yoktur.
     8. Dosya başlığında "Şu anki adım" şeridi dosyanın kimde olduğunu söyler.

   Kullanım: sunucu ayakta ve demo verisi üretilmiş olmalı.
     TEST_BASE=http://localhost:3100 node tests/sahiplik.mjs
   =========================================================================== */

import path from "node:path";
import { Db, silenceSqliteWarning } from "../scripts/lib/db.mjs";
import { env } from "../scripts/lib/env.mjs";
import { chromiumYukle } from "./lib/tarayici.mjs";

const chromium = await chromiumYukle();
const BASE = env("TEST_BASE", "http://localhost:3100");
const SIFRE = "Demo2026!";
const ROOT = path.resolve(import.meta.dirname, "..");

silenceSqliteWarning();
const db = new Db(path.resolve(ROOT, env("DATABASE_PATH", path.join(ROOT, "data", "sikayet.db"))));
const sorgu = (sql, ...p) => db.prepare(sql).all(...p);

let gecen = 0;
let kalan = 0;

function kontrol(ad, kosul, ek = "") {
  if (kosul) {
    gecen++;
    console.log(`  ✓ ${ad}`);
  } else {
    kalan++;
    console.log(`  ✗ ${ad}${ek ? ` — ${ek}` : ""}`);
  }
}

/* --- Test dosyasını ve ilgili personeli veritabanından seç ---------------- */

/*
 * "Şu anki adım" = dosyanın açık görevleri içinde sıra numarası en küçük olan.
 * Süreç doğrusal olduğu için bu, sırası gelmiş adımdır; bir sonraki açık adım
 * ise henüz sırası gelmemiş olandır. Test, hangi adım olduğundan bağımsız
 * çalışsın diye dosyayı buna göre seçer.
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
     AND t.sort_order = (SELECT MIN(x.sort_order) FROM tasks x
                          WHERE x.complaint_id = c.id
                            AND x.status IN ('BEKLEMEDE','DEVAM_EDIYOR'))
     AND (SELECT COUNT(*) FROM tasks y WHERE y.complaint_id = c.id
            AND y.status IN ('BEKLEMEDE','DEVAM_EDIYOR')) >= 2
   ORDER BY c.id`);

// Sorumlusu Fabrika Müdürü olmayan bir dosya seçilir; böylece müdürün adımı
// kendi işleyemediği de sınanabilir.
const dosya = adaylar.find((a) => a.role !== "FABRIKA_MUDURU") ?? adaylar[0];

if (!dosya) {
  console.error(
    "Test için uygun dosya yok: en az iki açık adımı olan bir dosya gerekiyor.\n" +
    "Önce Tanımlar > Demo Verisi ekranından demo verisi üretin.",
  );
  process.exit(1);
}

// Sırası henüz gelmemiş bir sonraki açık adım
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
// Aynı fabrikadan, bu adımın sorumlusu olmayan bir personel
const [digeri] = sorgu(
  `SELECT username, full_name FROM users
    WHERE factory_id = ? AND id <> ? AND role NOT IN ('FABRIKA_MUDURU') LIMIT 1`,
  dosya.factory_id, dosya.assignee_id,
);

const dosyaUrl = `${BASE}/panel/sikayet/${dosya.id}`;
const ADIM = dosya.title;
const SONRAKI = sonraki?.title ?? null;

console.log(`\nTest dosyası    : ${dosya.complaint_no} (#${dosya.id})`);
console.log(`Şu anki adım    : ${ADIM}`);
console.log(`Adım sorumlusu  : ${dosya.full_name} (${dosya.username})`);
console.log(`Sıradaki adım   : ${SONRAKI ?? "—"}`);
console.log(`Fabrika Müdürü  : ${mudur.full_name} (${mudur.username})`);
console.log(`İlgisiz personel: ${digeri.full_name} (${digeri.username})\n`);

const tarayici = await chromium.launch();

async function girisYap(kullanici) {
  const sayfa = await (await tarayici.newContext()).newPage();
  sayfa.on("dialog", (d) => d.accept());
  await sayfa.goto(`${BASE}/giris`, { waitUntil: "domcontentloaded" });
  await sayfa.fill("#username", kullanici);
  await sayfa.fill("#password", SIFRE);
  await sayfa.click('button[type="submit"]');
  await sayfa.waitForURL(/\/panel/, { timeout: 20000 });
  return sayfa;
}

/**
 * Sayfadaki süreç adımı formlarının düğme metinleri. Başlıktaki "Çıkış" ve
 * yönetsel "Dosyayı iptal et" kartı bir süreç adımı olmadığı için sayılmaz.
 */
async function adimFormlari(sayfa) {
  const metinler = await sayfa.locator("form button[type=submit]").allInnerTexts();
  return metinler
    .map((t) => t.trim())
    .filter((t) => t && t !== "Çıkış" && t !== "Dosyayı iptal et");
}

/** Adım şeridinde bir adımın satırını başlığından bulur. */
function adimSatiri(sayfa, baslik) {
  return sayfa
    .locator("li")
    .filter({ has: sayfa.locator(`h3:text-is(${JSON.stringify(baslik)})`) })
    .first();
}

try {
  /* --- 1. Sorumlu: "Sıra sizde" + düğme --------------------------------- */
  const sorumlu = await girisYap(dosya.username);
  await sorumlu.goto(`${dosyaUrl}?sekme=gorevler`, { waitUntil: "domcontentloaded" });
  const satirSorumlu = adimSatiri(sorumlu, ADIM);
  kontrol("Adım şeritte görünüyor", (await satirSorumlu.count()) > 0);
  kontrol(
    "Sorumlu 'Sıra sizde' görüyor",
    (await satirSorumlu.getByText("Sıra sizde").count()) > 0,
  );
  kontrol(
    "Sorumlunun 'Başladım' düğmesi var",
    (await satirSorumlu.locator('button:has-text("Başladım")').count()) > 0,
  );


  /*
   * Sorumluya "size düşen işlem yok" denmemeli. Bu, adımın formu başka
   * sekmede olduğunda (numune, analiz, imza zinciri) ya da hiç eklenmediğinde
   * (ekip kurma) ortaya çıkan hata sınıfını yakalar.
   */
  await sorumlu.goto(`${dosyaUrl}?sekme=islemler`, { waitUntil: "domcontentloaded" });
  const sorumluMetni = await sorumlu.locator("body").innerText();
  kontrol(
    "Sorumluya 'size düşen işlem yok' denmiyor",
    !sorumluMetni.includes("Şu anda size düşen bir işlem yok"),
    ADIM,
  );
  const sorumluFormlar = await adimFormlari(sorumlu);
  const yonlendirme = await sorumlu
    .locator('a:has-text("sekmesine git")')
    .count();
  kontrol(
    "Sorumluya ya formu ya da adımın sekmesine bağlantı gösteriliyor",
    sorumluFormlar.length > 0 || yonlendirme > 0,
    `form=${sorumluFormlar.length} bağlantı=${yonlendirme}`,
  );

  /* --- 2. İlgisiz personel: düğme yok, kimde olduğu yazıyor -------------- */
  const ilgisiz = await girisYap(digeri.username);
  await ilgisiz.goto(`${dosyaUrl}?sekme=gorevler`, { waitUntil: "domcontentloaded" });
  const satirIlgisiz = adimSatiri(ilgisiz, ADIM);
  kontrol(
    "İlgisiz personelin düğmesi yok",
    (await satirIlgisiz.locator("button").count()) === 0,
  );
  kontrol(
    "İlgisiz personele adımın kimde olduğu yazıyor",
    (await satirIlgisiz.getByText(`Sıra: ${dosya.full_name}`).count()) > 0,
  );

  await ilgisiz.goto(`${dosyaUrl}?sekme=islemler`, { waitUntil: "domcontentloaded" });
  const ilgisizFormlar = await adimFormlari(ilgisiz);
  kontrol(
    "İlgisiz personele hiç adım formu çıkmıyor",
    ilgisizFormlar.length === 0,
    ilgisizFormlar.join(" | "),
  );
  const ilgisizMetni = await ilgisiz.locator("body").innerText();
  kontrol(
    "İlgisiz personele adımın gerçek sorumlusu adıyla bildiriliyor",
    ilgisizMetni.includes(dosya.full_name),
    ilgisizMetni.split("\n").filter((l) => /Sıradaki adım/.test(l)).join(" ") || "(mesaj yok)",
  );

  /* --- 3. Sırası gelmemiş adım ------------------------------------------ */
  await ilgisiz.goto(`${dosyaUrl}?sekme=gorevler`, { waitUntil: "domcontentloaded" });
  const satirTutanak = SONRAKI ? adimSatiri(ilgisiz, SONRAKI) : null;
  if (satirTutanak && (await satirTutanak.count()) > 0) {
    kontrol(
      "Sırası gelmeyen adım 'Sırada bekliyor' gösteriyor",
      (await satirTutanak.getByText("Sırada bekliyor").count()) > 0,
    );
    kontrol(
      "Sırası gelmeyen adımda düğme yok",
      (await satirTutanak.locator("button").count()) === 0,
    );
    kontrol(
      "Sırası gelmeyen adım hangi adımı beklediğini söylüyor",
      (await satirTutanak.getByText(/Sırası gelmedi\. Önce tamamlanmalı/).count()) > 0,
    );
  }

  /* --- 4-5. Fabrika Müdürü: işi yapmaz, sorumluyu değiştirir ------------- */
  const md = await girisYap(mudur.username);
  if (dosya.role !== "FABRIKA_MUDURU") {
    await md.goto(`${dosyaUrl}?sekme=islemler`, { waitUntil: "domcontentloaded" });
    const mdFormlar = await adimFormlari(md);
    kontrol(
      "Fabrika Müdürü başkasının adımının formunu görmüyor",
      mdFormlar.length === 0,
      mdFormlar.join(" | "),
    );
  }

  await md.goto(`${dosyaUrl}?sekme=gorevler`, { waitUntil: "domcontentloaded" });
  const satirMd = adimSatiri(md, ADIM);
  kontrol(
    "Fabrika Müdürüne 'Sorumluyu değiştir' çıkıyor",
    (await satirMd.locator('summary:has-text("Sorumluyu değiştir")').count()) > 0,
  );
  kontrol(
    "Diğer personele 'Sorumluyu değiştir' çıkmıyor",
    (await satirIlgisiz.locator('summary:has-text("Sorumluyu değiştir")').count()) === 0,
  );

  // Atama listesi yalnızca yetkili personeli içeriyor mu?
  if ((await satirMd.locator("summary").count()) > 0) {
    await satirMd.locator('summary:has-text("Sorumluyu değiştir")').click();
    const secenekler = await satirMd.locator("select option:not([disabled])").allInnerTexts();
    kontrol("Atama listesi dolu", secenekler.length > 0, `${secenekler.length} seçenek`);
    kontrol(
      "Atama listesinde mevcut sorumlu da var",
      secenekler.some((t) => t.includes(dosya.full_name)),
      secenekler.join(" | "),
    );
  }

  kontrol(
    "Şeritte elle 'Tamamlandı' düğmesi yok",
    (await md.locator('button:has-text("Tamamlandı")').count()) === 0,
  );
  kontrol(
    "Dosyada 'Şu anki adım' şeridi var",
    (await md.getByText("Şu anki adım").count()) > 0,
  );

  /* --- 6. Başka fabrikanın personeli ------------------------------------ */
  const disFabrika = await girisYap(yabanci.username);
  const yanit = await disFabrika.goto(dosyaUrl, { waitUntil: "domcontentloaded" });
  kontrol(
    "Başka fabrikanın personeli dosyayı açamıyor",
    /hata=yetki/.test(disFabrika.url()) || yanit.status() >= 400,
    disFabrika.url(),
  );

  /* --- 7. Her açık adım türü: sorumlusuna iş gösteriliyor mu? ----------- */
  /*
   * Bazı adımların formu kendi sekmesinde durur (numune ve analiz laboratuvarda,
   * imza zinciri tutanaklarda, daire kararı itiraz sayfasında). Sorumlusuna
   * "size düşen işlem yok" denmemeli; ya formu ya da o sekmeye bir bağlantı
   * görmeli. Veritabanındaki her açık adım türü için bir örnek denenir.
   */
  console.log("\n  Açık adım türleri:");
  const ornekler = new Map();
  for (const r of sorgu(`
    SELECT c.id AS cid, t.code, u.username, u.full_name
      FROM complaints c
      JOIN tasks t ON t.complaint_id = c.id
      JOIN users u ON u.id = t.assignee_id
     WHERE t.status IN ('BEKLEMEDE','DEVAM_EDIYOR')
       AND t.sort_order = (SELECT MIN(x.sort_order) FROM tasks x
                            WHERE x.complaint_id = c.id
                              AND x.status IN ('BEKLEMEDE','DEVAM_EDIYOR'))
     ORDER BY t.code, c.id`)) {
    if (!ornekler.has(r.code)) ornekler.set(r.code, r);
  }

  const oturumlar = new Map();
  for (const [kod, r] of ornekler) {
    let sayfa = oturumlar.get(r.username);
    if (!sayfa) {
      sayfa = await girisYap(r.username);
      oturumlar.set(r.username, sayfa);
    }
    await sayfa.goto(`${BASE}/panel/sikayet/${r.cid}?sekme=islemler`, { waitUntil: "networkidle" });
    const metin = await sayfa.locator("body").innerText();
    const formlar = await adimFormlari(sayfa);
    const baglanti = await sayfa.locator('a.btn-primary, a:has-text("sekmesine git")').count();
    kontrol(
      `${kod}: sorumlusuna yapacak iş gösteriliyor`,
      !metin.includes("Şu anda size düşen bir işlem yok") &&
        (formlar.length > 0 || baglanti > 0),
      `${r.full_name} — form=[${formlar.join(", ") || "-"}] bağlantı=${baglanti}`,
    );
  }
  if (ornekler.size === 0) {
    console.log("    (demo verisinde açık adım yok — bu bölüm atlandı)");
  }

  console.log(`\nSonuç: ${gecen} geçti, ${kalan} kaldı\n`);
} finally {
  await tarayici.close();
  db.close();
}

process.exit(kalan === 0 ? 0 : 1);
