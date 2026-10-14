#!/usr/bin/env node
/* ===========================================================================
   Uçtan uca senaryo testi — sadeleştirilmiş akış.

   Bir şikâyeti halka açık formdan açar ve dosyayı arayüz üzerinden sonuna
   kadar yürütür:
     1) müşteri formu doldurur,
     2) Fabrika Müdürü dosyayı açar, FORMUN KENDİSİNİ görür,
     3) formun altındaki düzenekte kaç kişilik ekip kurulacağını seçer, her
        kutuda unvan ve isim belirler,
     4) bundan sonrası belge yükleyerek yürür: inceleme tutanağı, imzalı karar
        tutanağı, iade/değişim belgesi, resmî yazı,
     5) Fabrika Müdürü dosyayı kapatır.
   Her adımda müşteriye giden bildirimler de doğrulanır.

   Çalıştırma:
     1) Uygulamayı DEMO_MODE=true ile başlatın (npm run dev veya npm start)
     2) npm install -D playwright && npx playwright install chromium
     3) node tests/senaryo.mjs [temel-adres]
   =========================================================================== */

import { chromiumYukle } from "./lib/tarayici.mjs";

const chromium = await chromiumYukle();

const BASE = (process.argv[2] || process.env.APP_BASE_URL || "http://localhost:3000").replace(/\/$/, "");
const SIFRE = process.env.SEED_PASSWORD || "Demo2026!";

// Her koşuda farklı numara kullanılır: aynı numaraya saatlik SMS doğrulama
// sınırı uygulandığı için testin arka arkaya çalışabilmesi buna bağlıdır.
const TELEFON = `05${String(30 + Math.floor(Math.random() * 10))} ` +
  `${String(100 + Math.floor(Math.random() * 900))} ` +
  `${String(10 + Math.floor(Math.random() * 90))} ` +
  `${String(10 + Math.floor(Math.random() * 90))}`;

let adim = 0;
const basarili = [];
const basarisiz = [];

function ok(mesaj) { basarili.push(mesaj); console.log(`  ✓ ${mesaj}`); }
function hata(mesaj) { basarisiz.push(mesaj); console.log(`  ✗ ${mesaj}`); }
function baslik(metin) { adim++; console.log(`\n${String(adim).padStart(2, "0")}. ${metin}`); }

/** Yüklenecek demo belgesi — gerçek bir dosya yazmaya gerek yoktur. */
function belge(ad) {
  return {
    name: ad,
    mimeType: "application/pdf",
    buffer: Buffer.from(
      `%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n`,
      "latin1",
    ),
  };
}

const tarayici = await chromium.launch();

/** Belirtilen kullanıcı için yeni bir oturum açar. */
async function girisYap(kullanici) {
  const sayfa = await (await tarayici.newContext({ viewport: { width: 1440, height: 980 } })).newPage();
  sayfa.on("pageerror", (e) => hata(`Sayfa hatası (${kullanici}): ${e.message}`));
  sayfa.on("dialog", (d) => d.accept());
  await sayfa.goto(`${BASE}/giris`, { waitUntil: "domcontentloaded" });
  await sayfa.fill("#username", kullanici);
  await sayfa.fill("#password", SIFRE);
  await sayfa.click('button[type="submit"]');
  await sayfa.waitForURL(/\/panel/, { timeout: 20000 });
  return sayfa;
}

/** Bir eylem formunu gönderip sonucun yerleşmesini bekler. */
async function eylem(sayfa, dugmeMetni) {
  await sayfa.locator(`button:has-text("${dugmeMetni}")`).first().click();
  await sayfa.waitForLoadState("networkidle");
  await sayfa.waitForTimeout(600);
}

/**
 * Sırası gelmiş bir aşamayı kaydeder: tarih ve açıklama yazar, belgeyi yükler.
 * Aşama kutusu "Kaydet ve aşamayı kapat" düğmesini taşıyan tek kutudur.
 */
async function asamayiKaydet(sayfa, dosyaYolu, { not, belgeAdi, ekstra }) {
  await sayfa.goto(`${BASE}${dosyaYolu}`, { waitUntil: "domcontentloaded" });
  const form = sayfa.locator("form").filter({
    has: sayfa.locator('button:has-text("Kaydet ve aşamayı kapat")'),
  }).first();
  if ((await form.count()) === 0) throw new Error("Sırası gelmiş aşama formu ekranda yok.");
  if (ekstra) await ekstra(form);
  await form.locator('input[name="not"]').fill(not);
  await form.locator('input[type="file"]').setInputFiles(belge(belgeAdi));
  await form.locator('button:has-text("Kaydet ve aşamayı kapat")').click();
  await sayfa.waitForLoadState("networkidle");
  await sayfa.waitForTimeout(800);
  // Eylem hata döndürdüyse form yerinde kalır ve kırmızı bildirim gösterir;
  // sessizce geçmek yerine testi burada durdururuz.
  const bildirim = sayfa.locator('div[role="status"].bg-danger-50');
  if (await bildirim.count()) {
    throw new Error(`Aşama kaydedilemedi: ${(await bildirim.first().innerText()).trim()}`);
  }
}

/** Dosyadaki kapanmış aşama sayısı. */
async function kapananAsama(sayfa, dosyaYolu) {
  await sayfa.goto(`${BASE}${dosyaYolu}`, { waitUntil: "domcontentloaded" });
  return sayfa.locator('ol > li span[aria-hidden]:text-is("✓")').count();
}

try {
  /* --- 1. Müşteri şikâyet formunu doldurur ------------------------------- */
  baslik("Müşteri halka açık formdan şikâyet oluşturuyor");
  const musteri = await (await tarayici.newContext()).newPage();
  musteri.on("dialog", (d) => d.accept());
  await musteri.goto(`${BASE}/sikayet/yeni`, { waitUntil: "domcontentloaded" });
  console.log(`     (test telefonu: ${TELEFON})`);

  await musteri.fill("#customer_company", "Senaryo Testi Gıda San. Tic. A.Ş.");
  await musteri.fill("#customer_name", "Kemal Öztürk");
  await musteri.fill("#customer_title", "Kalite Müdürü");
  await musteri.fill("#customer_phone", TELEFON);
  await musteri.fill("#customer_email", "kalite@senaryotest.com.tr");
  await musteri.selectOption("#customer_province", { label: "Ankara" });
  await musteri.fill("#customer_address", "OSB 5. Cadde No: 22 Sincan/Ankara");
  await musteri.click("text=İleri →");

  await musteri.waitForSelector("#origin_factory_id", { state: "visible" });
  await musteri.selectOption("#origin_factory_id", { label: "Ankara Şeker Fabrikası" });
  await musteri.selectOption("#product_id", { label: "Kristal Toz Şeker — 50 kg çuval" });
  await musteri.fill("#lot_no", "2026-ANK-SENARYO");
  await musteri.fill("#quantity_kg", "28000");
  await musteri.fill("#invoice_no", "FTR-2026-SENARYO");
  await musteri.click("text=İleri →");

  await musteri.waitForSelector("#subject", { state: "visible" });
  await musteri.selectOption("#category_id", { label: "Topaklanma / sertleşme" });
  await musteri.fill("#subject", "50 kg çuvallarda yaygın topaklanma");
  await musteri.fill("#description",
    "Teslim alınan 560 çuvalın yaklaşık 180'inde sert topaklanma tespit edilmiştir.");
  await musteri.check('input[name="demand"][value="IADE_NAKLIYE"]');
  await musteri.click("text=İleri →");

  await musteri.waitForSelector('input[name="kvkk"]', { state: "visible" });
  await musteri.check('input[name="kvkk"]');
  await musteri.click("text=Doğrulama kodu gönder");
  await musteri.waitForSelector("text=Demo modu", { timeout: 15000 });
  const kodMetni = await musteri.textContent("text=Demo modu");
  const kod = kodMetni.match(/(\d{6})/)?.[1];
  if (!kod) throw new Error("Demo modunda doğrulama kodu ekranda görünmedi.");
  ok(`SMS doğrulama kodu üretildi (${kod})`);
  await musteri.fill("#otp_code", kod);
  await musteri.click("text=Şikâyeti gönder");
  await musteri.waitForURL(/\/sikayet\/tesekkur\//, { timeout: 25000 });

  const sikayetNo = (await musteri.textContent(".font-mono")).trim();
  ok(`Şikâyet oluşturuldu: ${sikayetNo}`);

  await musteri.click("text=Şikâyetimi görüntüle");
  await musteri.waitForURL(/\/takip\//);
  const takipUrl = musteri.url();
  ok(`Müşteri takip sayfası açıldı: "${(await musteri.locator(".chip").first().textContent()).trim()}"`);

  /* --- 2. Dosya Fabrika Müdürünün ekranına düşer ------------------------- */
  baslik("Fabrika Müdürü dosyayı açıyor: formun kendisini görüyor");
  const mudur = await girisYap("ank.mudur");
  await mudur.goto(`${BASE}/panel/sikayetler?ara=${encodeURIComponent(sikayetNo)}`,
                   { waitUntil: "domcontentloaded" });
  const dosyaYolu = await mudur.locator('a[href^="/panel/sikayet/"]').first().getAttribute("href");
  if (!dosyaYolu) throw new Error("Oluşturulan şikâyet panelde bulunamadı.");
  ok(`Dosya Ankara Şeker Fabrikası paneline düştü: ${dosyaYolu}`);

  await mudur.goto(`${BASE}${dosyaYolu}`, { waitUntil: "domcontentloaded" });
  const formBasligi = await mudur.locator("h2", { hasText: "Müşteri Şikâyet Formu" }).count();
  const formSatiri = await mudur.locator("th", { hasText: "ŞİKÂYET KONUSU" }).count();
  const formIcerik = (await mudur.locator("body").textContent()).includes(
    "50 kg çuvallarda yaygın topaklanma");
  formBasligi > 0 && formSatiri > 0 && formIcerik
    ? ok("Dosyanın en üstünde müşterinin doldurduğu formun kendisi görünüyor")
    : hata("Şikâyet formu dosyanın üstünde görünmüyor");

  const asamaSayisi = await mudur.locator('ol > li.card').count();
  asamaSayisi === 3
    ? ok("Kayıtla birlikte 3 aşama açıldı (ekip, inceleme, karar)")
    : hata(`Beklenen 3 aşama, bulunan ${asamaSayisi}`);

  /* --- 3. Ekip kurma düzeneği -------------------------------------------- */
  baslik("Fabrika Müdürü formun altındaki düzenekte ekibi kuruyor (md. 2-3)");
  await mudur.selectOption("#kisiSayisi", "3");
  await mudur.waitForTimeout(200);
  const kutuSayisi = await mudur.locator('select[name^="unvan_"]').count();
  kutuSayisi === 3
    ? ok("Seçilen kişi sayısına göre 3 kişi kutusu belirdi")
    : hata(`Kişi kutusu sayısı beklenenden farklı: ${kutuSayisi}`);

  const unvanlar = ["Kalite Sorumlusu", "Teknik (İşletme) Yetkilisi", "Muhasebe Yetkilisi"];
  for (let i = 0; i < 3; i++) {
    await mudur.selectOption(`#unvan_${i}`, { label: unvanlar[i] });
    await mudur.waitForTimeout(150);
    // Unvanda tek kişi varsa isim kutusu kendiliğinden dolar; yine de açıkça seçilir.
    const secenekler = await mudur.locator(`#uye_${i} option`).count();
    if (secenekler > 1) await mudur.selectOption(`#uye_${i}`, { index: 1 });
  }
  const liderAdi = await mudur.locator("#uye_0 option:checked").textContent();
  ok(`Unvan ve isim kutuları dolduruldu (ekip lideri: ${liderAdi.trim()})`);

  await mudur.fill("#note", "Ekip görevlendirilmiş, inceleme firma deposunda yapılacaktır.");
  await eylem(mudur, "Ekibi oluştur");

  const ekipSonrasi = await mudur.locator('ol > li.card').count();
  ekipSonrasi === 3 && (await kapananAsama(mudur, dosyaYolu)) >= 1
    ? ok("Ekip kaydedildi, ekip aşaması kapandı")
    : hata("Ekip aşaması kapanmadı");

  /* --- 4. İnceleme tutanağı yükleniyor ---------------------------------- */
  baslik("Ekip lideri inceleme tutanağını yüklüyor (md. 4)");
  const kalite = await girisYap("ank.kalite");
  await asamayiKaydet(kalite, dosyaYolu, {
    not: "Firma deposunda yerinde inceleme yapılmış, 180 çuvalda topaklanma teyit edilmiştir.",
    belgeAdi: "inceleme-tutanagi.pdf",
  });
  const incelemeEki = await kalite.locator('a:has-text("inceleme-tutanagi.pdf")').count();
  incelemeEki > 0
    ? ok("İnceleme tutanağı aşamaya bağlı olarak kaydedildi")
    : hata("İnceleme tutanağı aşamada görünmüyor");

  /* --- 5. İmzalı karar tutanağı ----------------------------------------- */
  baslik("İmza süreci dışarıda tamamlandı: imzalı karar tutanağı yükleniyor");
  await asamayiKaydet(kalite, dosyaYolu, {
    not: "Topaklanmanın depolama değil üretim kaynaklı olduğu tespit edilmiş, şikâyet haklı bulunmuştur.",
    belgeAdi: "karar-tutanagi-imzali.pdf",
    ekstra: async (form) => { await form.locator('input[value="HAKLI"]').check(); },
  });
  const kararMetni = await kalite.locator("body").textContent();
  kararMetni.includes("Şikâyet haklı")
    ? ok("Karar haklı olarak kaydedildi, dosya işlem aşamasına geçti")
    : hata("Karar kaydedilemedi");

  const islemAcildi = await kalite.locator('ol > li.card').count();
  islemAcildi === 6
    ? ok("Karar sonrası aşamalar açıldı (işlem, resmî yazı, kapanış)")
    : hata(`Karar sonrası aşama sayısı beklenenden farklı: ${islemAcildi}`);

  /* --- 6. İade / değişim belgesi ---------------------------------------- */
  baslik("Ambar Şefi iade/değişim belgesini yüklüyor (md. 6)");
  const ambar = await girisYap("ank.ambar");
  await asamayiKaydet(ambar, dosyaYolu, {
    not: "9.000 kg ürün iadesi alınmış, nakliye bedeli firmaya ödenmiştir.",
    belgeAdi: "iade-irsaliyesi.pdf",
    ekstra: async (form) => {
      await form.locator('input[name="iadeKg"]').fill("9000");
      await form.locator('input[name="nakliye"]').fill("8400");
    },
  });
  const islemEki = await ambar.locator('a:has-text("iade-irsaliyesi.pdf")').count();
  const islemKapandi = await kapananAsama(ambar, dosyaYolu);
  islemEki > 0 && islemKapandi === 4
    ? ok("İade belgesi kaydedildi, işlem aşaması kapandı")
    : hata(`İade aşaması kapanmadı (ek: ${islemEki}, kapanan: ${islemKapandi})`);

  /* --- 7. Resmî yazı ---------------------------------------------------- */
  baslik("Resmî yazı ve müşteri bilgilendirmesi yükleniyor (md. 6-7)");
  await asamayiKaydet(kalite, dosyaYolu, {
    not: "2026/142 sayılı yazıyla dört Daire Başkanlığına gönderilmiş, müşteri bilgilendirilmiştir.",
    belgeAdi: "resmi-yazi.pdf",
  });
  const yaziEki = await kalite.locator('a:has-text("resmi-yazi.pdf")').count();
  yaziEki > 0 ? ok("Resmî yazı kaydedildi") : hata("Resmî yazı aşamada görünmüyor");

  /* --- 8. Kapanış ------------------------------------------------------- */
  baslik("Fabrika Müdürü dosyayı kapatıyor (md. 8)");
  await mudur.goto(`${BASE}${dosyaYolu}`, { waitUntil: "domcontentloaded" });
  await mudur.fill("#note",
    "İade tamamlanmış, resmî yazı gönderilmiş, müşteri bilgilendirilmiş ve dosya kapatılmıştır.");
  await eylem(mudur, "Dosyayı kapat");
  const kapandi = (await mudur.locator("body").textContent()).includes("Kapandı");
  kapandi ? ok("Dosya kapandı") : hata("Dosya kapanmadı");

  const tamamlanan = await kapananAsama(mudur, dosyaYolu);
  tamamlanan === 6
    ? ok("Altı aşamanın tamamı kapandı")
    : hata(`Kapanan aşama sayısı beklenenden farklı: ${tamamlanan}`);

  /* --- 9. Sıra bekçisi -------------------------------------------------- */
  baslik("Kapanan dosyada kayıt formu kalmadığı doğrulanıyor");
  const kalanForm = await mudur.locator('button:has-text("Kaydet ve aşamayı kapat")').count();
  kalanForm === 0
    ? ok("Kapanan dosyada açık kayıt formu yok")
    : hata(`Kapanan dosyada ${kalanForm} kayıt formu kaldı`);

  /* --- 10. Müşteri tarafı ----------------------------------------------- */
  baslik("Müşteri takip sayfası ve bildirimler doğrulanıyor");
  await musteri.goto(takipUrl, { waitUntil: "domcontentloaded" });
  const musteriDurum = await musteri.locator(".chip").first().textContent();
  musteriDurum.includes("kapatıldı")
    ? ok(`Müşteri "${musteriDurum.trim()}" görüyor`)
    : hata(`Müşteri tarafında beklenmeyen durum: ${musteriDurum.trim()}`);

  const bildirimler = await musteri.locator("section:has-text('Size gönderilen bilgilendirmeler') li").count();
  bildirimler >= 5
    ? ok(`Müşteriye ${bildirimler} bildirim gönderildi (SMS + e-posta)`)
    : hata(`Beklenenden az bildirim: ${bildirimler}`);

  /* --- 11. Form çıktısı ve aylık rapor ---------------------------------- */
  baslik("Form çıktısı ve aylık rapor doğrulanıyor");
  await mudur.goto(`${BASE}${dosyaYolu}`, { waitUntil: "domcontentloaded" });
  const formLink = await mudur.locator('a[href^="/belge/"]').first().getAttribute("href");
  const r = await mudur.goto(`${BASE}${formLink}`, { waitUntil: "domcontentloaded" });
  const basliklar = await mudur.locator("th:has-text('ŞİKÂYET SAHİBİ')").count();
  r.status() === 200 && basliklar > 0
    ? ok("Müşteri Şikâyet Formu yazdırma çıktısı üretildi")
    : hata("Form çıktısı üretilemedi");

  const excel = await mudur.context().request.get(`${BASE}/api/rapor/aylik`);
  const boyut = (await excel.body()).length;
  excel.ok() && boyut > 4000
    ? ok(`Aylık şikâyet tablosu Excel olarak üretildi (${(boyut / 1024).toFixed(1)} KB)`)
    : hata(`Excel üretilemedi (${excel.status()})`);

} catch (e) {
  hata(`Beklenmeyen hata: ${e.message}`);
  console.error(e.stack?.split("\n").slice(0, 4).join("\n"));
} finally {
  await tarayici.close();
}

console.log(`\n${"=".repeat(64)}`);
console.log(`SONUÇ: ${basarili.length} başarılı, ${basarisiz.length} başarısız`);
if (basarisiz.length) {
  console.log("\nBaşarısız adımlar:");
  for (const m of basarisiz) console.log(`  ✗ ${m}`);
}
console.log("=".repeat(64));
process.exit(basarisiz.length ? 1 : 0);
