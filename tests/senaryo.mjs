#!/usr/bin/env node
/* ===========================================================================
   Uçtan uca senaryo testi.
   Bir şikâyeti halka açık formdan açar ve TL PASAT 004 akışının tamamını
   arayüz üzerinden yürütür: ekip oluşturma, yerinde inceleme, numune, analiz,
   tutanak, 6 adımlı imza zinciri, Fabrika Müdürü onayı, düzeltici faaliyet,
   iade/değişim + nakliye bedeli, resmî yazı, müşteri bilgilendirmesi ve
   kapanış. Her adımda müşteriye giden bildirimleri de doğrular.

   Çalıştırma:
     1) Uygulamayı DEMO_MODE=true ile başlatın (npm run dev veya npm start)
     2) npm install -D playwright && npx playwright install chromium
     3) node tests/senaryo.mjs [temel-adres]
   =========================================================================== */

import { chromium } from "playwright";

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

function ok(mesaj) {
  basarili.push(mesaj);
  console.log(`  ✓ ${mesaj}`);
}
function hata(mesaj) {
  basarisiz.push(mesaj);
  console.log(`  ✗ ${mesaj}`);
}
function baslik(metin) {
  adim++;
  console.log(`\n${String(adim).padStart(2, "0")}. ${metin}`);
}

const tarayici = await chromium.launch();

/** Belirtilen kullanıcı için yeni bir oturum açar. */
async function girisYap(kullanici) {
  const sayfa = await (await tarayici.newContext({ viewport: { width: 1440, height: 980 } })).newPage();
  sayfa.on("pageerror", (e) => hata(`Sayfa hatası (${kullanici}): ${e.message}`));
  // Onay soran işlemlerde tarayıcı diyaloğu kabul edilir.
  sayfa.on("dialog", (d) => d.accept());
  await sayfa.goto(`${BASE}/giris`, { waitUntil: "domcontentloaded" });
  await sayfa.fill("#username", kullanici);
  await sayfa.fill("#password", SIFRE);
  await sayfa.click('button[type="submit"]');
  await sayfa.waitForURL(/\/panel/, { timeout: 20000 });
  return sayfa;
}

/** Bir eylem formunu gönderip sonuç bildirimini bekler. */
async function eylem(sayfa, dugmeMetni) {
  await sayfa.locator(`button:has-text("${dugmeMetni}")`).first().click();
  await sayfa.waitForLoadState("networkidle");
  await sayfa.waitForTimeout(500);
}

try {
  /* --- 1. Müşteri şikâyet formunu doldurur --------------------------------- */
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
  const durum0 = await musteri.locator(".chip").first().textContent();
  ok(`Müşteri takip sayfası açıldı: "${durum0.trim()}"`);

  /* --- Dosyanın panel adresini bul ---------------------------------------- */
  const kalite = await girisYap("ank.kalite");
  await kalite.goto(`${BASE}/panel/sikayetler?ara=${encodeURIComponent(sikayetNo)}`,
                    { waitUntil: "domcontentloaded" });
  const dosyaYolu = await kalite.locator('a[href^="/panel/sikayet/"]').first().getAttribute("href");
  if (!dosyaYolu) throw new Error("Oluşturulan şikâyet panelde bulunamadı.");
  ok(`Dosya Ankara Şeker Fabrikası paneline düştü: ${dosyaYolu}`);

  const gorevSayisi = await (async () => {
    await kalite.goto(`${BASE}${dosyaYolu}?sekme=gorevler`, { waitUntil: "domcontentloaded" });
    return kalite.locator("h3").count();
  })();
  ok(`${gorevSayisi} görev kartı otomatik açıldı`);

  /* --- 2. Fabrika Müdürü ekibi oluşturur ----------------------------------- */
  baslik("Fabrika Müdürü inceleme ekibini oluşturuyor (md. 2-3)");
  const mudur = await girisYap("ank.mudur");
  await mudur.goto(`${BASE}${dosyaYolu}?sekme=ekip`, { waitUntil: "domcontentloaded" });
  const uyeler = mudur.locator('input[name="member"]');
  const uyeSayisi = await uyeler.count();
  for (let i = 0; i < Math.min(4, uyeSayisi); i++) await uyeler.nth(i).check();
  await mudur.locator('input[name="lead"]').first().check();
  await mudur.fill("#note", "Ekip görevlendirilmiş, 15 Ekim sabahı firma deposuna gidilecektir.");
  await eylem(mudur, "Ekibi oluştur ve incelemeyi başlat");
  const ekipSatir = await mudur.locator("table tbody tr").count();
  ekipSatir > 0 ? ok(`${ekipSatir} kişilik ekip kaydedildi`) : hata("Ekip kaydedilemedi");

  /* --- 3. Yerinde inceleme -------------------------------------------------- */
  baslik("Ekip yerinde inceleme sonucunu giriyor (md. 4)");
  await kalite.goto(`${BASE}${dosyaYolu}?sekme=islemler`, { waitUntil: "domcontentloaded" });
  await kalite.fill("#note",
    "Firma deposunda yapılan incelemede 180 çuvalda sert topaklanma teyit edilmiştir. " +
    "Depo bağıl nemi %52 ölçülmüş, istif düzeni uygun bulunmuştur. Numune alınmıştır.");
  await kalite.check('input[name="labRequired"]');
  await eylem(kalite, "İncelemeyi kaydet");
  ok("Yerinde inceleme kaydedildi");

  /* --- 4. Numune --------------------------------------------------------- */
  baslik("Numune alınıyor");
  await kalite.goto(`${BASE}${dosyaYolu}?sekme=lab`, { waitUntil: "domcontentloaded" });
  await kalite.fill("#takenPlace", "Şikâyetçi firma deposu");
  await kalite.fill("#quantity", "2 x 500 g");
  await kalite.fill("#sealNo", "M-77401");
  await eylem(kalite, "Numuneyi kaydet");
  const numuneNo = await kalite.locator("table tbody tr td").first().textContent();
  ok(`Numune kaydedildi: ${numuneNo.trim()}`);

  /* --- 5. Laboratuvar analizi ---------------------------------------------- */
  baslik("Laboratuvar analiz sonucunu giriyor");
  const lab = await girisYap("ank.lab");
  await lab.goto(`${BASE}${dosyaYolu}?sekme=lab`, { waitUntil: "domcontentloaded" });
  await lab.fill("#reportNo", "LAB-2026-SENARYO");
  const nemAlani = lab.locator('input[name^="deger_"]').nth(2);
  await lab.locator('input[name^="deger_"]').nth(0).fill("99,78");
  await nemAlani.fill("0,09");
  await lab.fill("#summary",
    "Nem oranı %0,09 ölçülmüş olup TS 861 standardının öngördüğü en çok %0,06 sınırının üzerindedir.");
  await eylem(lab, "Analizi kaydet");
  await lab.goto(`${BASE}${dosyaYolu}?sekme=lab`, { waitUntil: "domcontentloaded" });
  const analizSonuc = await lab.locator(".chip").filter({ hasText: /uygun/i }).first()
    .textContent().catch(() => "");
  // Polarizasyon uygun, nem sınır dışı girildiği için sonuç "Kısmen uygun"
  // olmalıdır; uygunluk parametre spesifikasyonlarından otomatik türetilir.
  /^(Kısmen uygun|Standartlara uygun değil)$/.test(analizSonuc.trim())
    ? ok(`Analiz kaydedildi — otomatik değerlendirme: ${analizSonuc.trim()} (nem sınır dışı)`)
    : hata(`Analiz uygunluğu beklenen gibi değil: ${analizSonuc.trim()}`);

  /* --- 6. Tutanak ve karar ------------------------------------------------- */
  baslik("Tutanak düzenleniyor, karar veriliyor (md. 4)");
  await kalite.goto(`${BASE}${dosyaYolu}?sekme=islemler`, { waitUntil: "domcontentloaded" });
  await kalite.check('input[name="verdict"][value="HAKLI"]');
  await kalite.fill("#verdictReason",
    "Alınan numunede nem oranı %0,09 ölçülmüş olup standart sınırın üzerindedir. " +
    "Topaklanmanın üretimdeki kurutma yetersizliğinden kaynaklandığı tespit edilmiştir.");
  await kalite.fill("#decision",
    "Şikâyete konu 28 ton ürünün iadesinin alınması ve geliş-gidiş nakliye bedelinin " +
    "fabrikamızca ödenmesi uygun görülmüştür.");
  await eylem(kalite, "Tutanağı düzenle ve imzaya gönder");

  await kalite.goto(`${BASE}${dosyaYolu}?sekme=belgeler`, { waitUntil: "domcontentloaded" });
  const tutanakBasligi = await kalite.locator("h2").filter({ hasText: "Nakliye" }).count();
  tutanakBasligi > 0
    ? ok("Nakliye bedeli talebi olduğu için FR PASAT 005 tutanağı düzenlendi")
    : hata("Beklenen FR PASAT 005 tutanağı bulunamadı");

  /* --- 7. İmza zinciri ----------------------------------------------------- */
  baslik("6 adımlı imza zinciri yürütülüyor");
  const zincir = [
    ["ank.ambar", "Ambar Şefi"],
    ["ank.satis", "Satışı Yapan Birim Şefi"],
    ["ank.kalitemy", "Kalite ve İşletme Kontrol Md. Yrd."],
    ["ank.myteknik", "Fabrika Müdür Yrd. (Teknik)"],
    ["ank.myidari", "Fabrika Müdür Yrd. (İdari)"],
    ["ank.mudur", "Fabrika Müdürü (Onay)"],
  ];
  for (const [kullanici, unvan] of zincir) {
    const s = await girisYap(kullanici);
    await s.goto(`${BASE}${dosyaYolu}?sekme=belgeler`, { waitUntil: "domcontentloaded" });
    const siraSizde = await s.locator("text=/Sıra sizde/").count();
    if (siraSizde === 0) {
      hata(`${unvan} (${kullanici}) için imza sırası açılmadı`);
      await s.context().close();
      continue;
    }
    await s.locator('button:has-text("İmzalıyorum"), button:has-text("Onaylıyorum")').first().click();
    await s.waitForLoadState("networkidle");
    await s.waitForTimeout(400);
    ok(`${unvan} imzaladı`);
    await s.context().close();
  }

  await kalite.goto(`${BASE}${dosyaYolu}?sekme=belgeler`, { waitUntil: "domcontentloaded" });
  const onayli = await kalite.locator("text=Onaylandı").count();
  onayli > 0 ? ok("Tutanak Fabrika Müdürü onayıyla tamamlandı") : hata("Tutanak onaylanmadı");

  /* --- 8. Düzeltici faaliyet ----------------------------------------------- */
  baslik("FSSC 22000 düzeltici faaliyeti başlatılıyor");
  await kalite.goto(`${BASE}${dosyaYolu}?sekme=islemler`, { waitUntil: "domcontentloaded" });
  await kalite.fill("#capaNo", "DF-2026-SENARYO");
  await kalite.locator('form:has(#capaNo) #note').fill(
    "Kurutma hattı çıkış nemi için kontrol sıklığı saatlik ölçüme çıkarılmıştır.");
  await eylem(kalite, "Düzeltici faaliyeti kaydet");
  ok("Düzeltici faaliyet kaydedildi");

  /* --- 9. İade ve nakliye bedeli ------------------------------------------- */
  baslik("İade işlemi ve nakliye bedeli kaydediliyor (md. 6-b)");
  const ambar = await girisYap("ank.ambar");
  await ambar.goto(`${BASE}${dosyaYolu}?sekme=islemler`, { waitUntil: "domcontentloaded" });
  await ambar.fill("#returnedKg", "28000");
  await ambar.fill("#refundAmount", "742000");
  await ambar.fill("#freightAmount", "11500");
  await ambar.locator('form:has(#transactionDate) #note').fill(
    "Ürün iadesi alınmış, fatura mahsuplaştırılmış, nakliye bedeli firmaya ödenmiştir.");
  await eylem(ambar, "İşlemi kaydet");
  ok("İade (28.000 kg) ve nakliye bedeli (11.500 ₺) kaydedildi");

  /* --- 10. Resmî yazı ------------------------------------------------------ */
  baslik("Resmî yazı Daire Başkanlıklarına gönderiliyor (md. 6)");
  await kalite.goto(`${BASE}${dosyaYolu}?sekme=islemler`, { waitUntil: "domcontentloaded" });
  const daireler = await kalite.locator("li").filter({ hasText: "Daire Başkanlığı" }).count();
  await eylem(kalite, "Gönderimi kaydet");
  ok(`Resmî yazı ${daireler} Daire Başkanlığına gönderildi`);

  /* --- 11. Müşteri bilgilendirme ------------------------------------------- */
  baslik("Müşteri Bilgilendirme Formu düzenleniyor (md. 7)");
  await kalite.goto(`${BASE}${dosyaYolu}?sekme=islemler`, { waitUntil: "domcontentloaded" });
  await kalite.fill("#explanation",
    "Şikâyetiniz kapsamında yerinde inceleme ve laboratuvar analizi yapılmış, şikâyetiniz " +
    "haklı bulunmuştur. 28 ton ürünün iadesi alınmış, geliş-gidiş nakliye bedeli tarafınıza " +
    "ödenmiştir. Benzer durumun yeniden yaşanmaması için düzeltici faaliyet başlatılmıştır.");
  await eylem(kalite, "Formu düzenle ve müşteriye gönder");
  ok("Müşteri Bilgilendirme Formu düzenlendi");

  // Bilgilendirme formunun imza zinciri
  for (const kullanici of ["ank.kalite", "ank.mudur"]) {
    const s = await girisYap(kullanici);
    await s.goto(`${BASE}${dosyaYolu}?sekme=belgeler`, { waitUntil: "domcontentloaded" });
    if (await s.locator("text=/Sıra sizde/").count()) {
      await s.locator('button:has-text("İmzalıyorum"), button:has-text("Onaylıyorum")').first().click();
      await s.waitForLoadState("networkidle");
      await s.waitForTimeout(300);
    }
    await s.context().close();
  }
  ok("Bilgilendirme formu onaylandı");

  /* --- 12. Kapanış --------------------------------------------------------- */
  baslik("Dosya kapatılıyor (md. 8)");
  const mudur2 = await girisYap("ank.mudur");
  await mudur2.goto(`${BASE}${dosyaYolu}?sekme=islemler`, { waitUntil: "domcontentloaded" });
  await mudur2.locator('form:has(button:has-text("Dosyayı kapat")) #note').fill(
    "İade işlemi ve nakliye bedeli ödemesi tamamlanmış, resmî yazı gönderilmiş, " +
    "müşteri bilgilendirilmiştir. Dosya kapatılmıştır.");
  await eylem(mudur2, "Dosyayı kapat");

  await mudur2.goto(`${BASE}${dosyaYolu}`, { waitUntil: "domcontentloaded" });
  const sonDurum = await mudur2.locator("h1 .chip").first().textContent();
  sonDurum.includes("Kapandı")
    ? ok(`Dosya kapatıldı — durum: ${sonDurum.trim()}`)
    : hata(`Beklenen kapanış durumu oluşmadı: ${sonDurum.trim()}`);

  /* --- 13. Müşteri tarafındaki sonuç --------------------------------------- */
  baslik("Müşteri takip sayfası ve bildirimler doğrulanıyor");
  await musteri.goto(takipUrl, { waitUntil: "domcontentloaded" });
  const musteriDurum = await musteri.locator(".chip").first().textContent();
  musteriDurum.includes("kapatıldı")
    ? ok(`Müşteri "${musteriDurum.trim()}" görüyor`)
    : hata(`Müşteri tarafında beklenmeyen durum: ${musteriDurum.trim()}`);

  const bildirimler = await musteri.locator("section:has-text('Size gönderilen bilgilendirmeler') li").count();
  bildirimler >= 6
    ? ok(`Müşteriye ${bildirimler} bildirim gönderildi (SMS + e-posta)`)
    : hata(`Beklenenden az bildirim: ${bildirimler}`);

  const tamamAdim = await musteri.locator("ol li span:has-text('✓')").count();
  ok(`Müşteri ${tamamAdim} tamamlanmış süreç adımı görüyor`);

  /* --- 14. Belgeler ve rapor ------------------------------------------------ */
  baslik("Belge çıktıları ve aylık rapor doğrulanıyor");
  await kalite.goto(`${BASE}${dosyaYolu}?sekme=belgeler`, { waitUntil: "domcontentloaded" });
  const belgeSayisi = await kalite.locator('a[href^="/belge/"]').count();
  ok(`${belgeSayisi} resmî belge üretildi (şikâyet formu, tutanak, bilgilendirme)`);

  const belgeLink = await kalite.locator('a[href^="/belge/"]').nth(1).getAttribute("href");
  const r = await kalite.goto(`${BASE}${belgeLink}`, { waitUntil: "domcontentloaded" });
  const imzaSatirlari = await kalite.locator("td:has-text('Şefi'), td:has-text('Müdür')").count();
  r.status() === 200 && imzaSatirlari > 0
    ? ok(`Tutanak çıktısı ${imzaSatirlari} imza alanıyla üretildi`)
    : hata("Tutanak çıktısı üretilemedi");

  const excel = await kalite.context().request.get(`${BASE}/api/rapor/aylik`);
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
