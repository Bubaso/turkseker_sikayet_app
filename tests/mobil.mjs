/* ===========================================================================
   Mobil ekran testi.

   Uygulama sahada telefondan da kullanılır: fabrika müdürü dosyayı ambarda
   açar, kalite sorumlusu aşamayı yerinde kaydeder. Bu test dar ekranda
   mekanik olarak kusur sayılan dört şeyi arar.

     1. Yatay taşma. Sayfanın kendisi yana kaymamalı. Tablo kapları gibi
        bilerek kaydırılan kutuların içi sayılmaz.
     2. Küçük dokunma hedefi. WCAG 2.2 AA alt sınırı 24x24 pikseldir; birincil
        eylemler için teamül 44x44'tür. Metin içinde geçen bağlantılar
        (cümlenin parçası olanlar) kuralın dışındadır.
     3. 16 pikselden küçük form alanı. iOS Safari böyle bir alana odaklanınca
        sayfayı kendiliğinden yakınlaştırır ve kullanıcı her alandan sonra el
        ile uzaklaştırmak zorunda kalır. Onay/radyo/dosya kutuları bunu
        tetiklemez, onlar sayılmaz.
     4. Kutusuna sığmayıp kırpılan metin. Üç nokta ile kısaltılanlar ve ekran
        okuyucuya ayrılmış `sr-only` metinler kasıtlıdır, sayılmaz.

   Kullanım: sunucu ayakta ve demo verisi üretilmiş olmalı.
     TEST_BASE=http://localhost:3000 node tests/mobil.mjs
   =========================================================================== */

import { env } from "../scripts/lib/env.mjs";
import { chromiumYukle } from "./lib/tarayici.mjs";

const chromium = await chromiumYukle();
const BASE = env("TEST_BASE", "http://localhost:3000");
const SIFRE = "Demo2026!";

/** 360 piyasadaki en dar yaygın Android; 375 iPhone SE. */
const CIHAZLAR = [
  { ad: "Android 360", w: 360, h: 740 },
  { ad: "iPhone SE 375", w: 375, h: 667 },
];

const SAYFALAR = [
  { k: null,            yol: "/",                      ad: "karşılama" },
  { k: null,            yol: "/sikayet/yeni",          ad: "şikâyet formu" },
  { k: null,            yol: "/takip",                 ad: "takip" },
  { k: null,            yol: "/giris",                 ad: "giriş" },
  { k: "ank.mudur",     yol: "/panel",                 ad: "fabrika panosu" },
  { k: "ank.mudur",     yol: "/panel/sikayetler",      ad: "şikâyet listesi" },
  { k: "ank.mudur",     yol: "/panel/gorevler",        ad: "bana düşen aşamalar" },
  { k: "ank.mudur",     yol: "/panel/takvim",          ad: "takvim" },
  { k: "ank.mudur",     yol: "/panel/bildirimler",     ad: "giden kutusu" },
  { k: "ank.mudur",     yol: "/panel/raporlar",        ad: "performans panosu" },
  { k: "ank.mudur",     yol: "/panel/sikayetler/yeni", ad: "elden şikâyet" },
  { k: "ank.mudur",     yol: "/panel/sikayet/48",      ad: "şikâyet dosyası" },
  { k: "ank.mudur",     yol: "/belge/ornek/48/KARAR",  ad: "tutanak örneği" },
  { k: "gm.genelmudur", yol: "/panel",                 ad: "üst yönetim panosu" },
  { k: "gm.genelmudur", yol: "/panel/sikayetler",      ad: "kurum listesi" },
  { k: "gm.genelmudur", yol: "/panel/ozet",            ad: "yönetim özeti" },
  { k: "gm.pazarlama",  yol: "/panel",                 ad: "daire panosu" },
  { k: "gm.pazarlama",  yol: "/panel/itirazlar",       ad: "itirazlar" },
  { k: "gm.pazarlama",  yol: "/panel/resmi-yazilar",   ad: "resmî yazılar" },
  { k: "sistem",        yol: "/panel/tanimlar",        ad: "tanımlar" },
];

let gecen = 0;
let kalan = 0;

function kontrol(ad, kosul, ek = "") {
  if (kosul) { gecen++; }
  else { kalan++; console.log(`  ✗ ${ad}${ek ? ` — ${ek}` : ""}`); }
}

/** Sayfa içinde çalışır; yukarıdaki dört kusuru toplar. */
function olc() {
  const kok = document.documentElement;
  const gorunumW = kok.clientWidth;
  const ad = (e) => {
    const metin = (e.textContent ?? "").trim().replace(/\s+/g, " ").slice(0, 28);
    const sinif = typeof e.className === "string" ? e.className.slice(0, 32) : "";
    return `<${e.tagName.toLowerCase()}> ${metin || sinif}`;
  };

  // 1. Yatay taşma ve kaynağı
  const tasma = kok.scrollWidth - gorunumW;
  const tasiranlar = [];
  if (tasma > 1) {
    for (const e of document.querySelectorAll("body *")) {
      const r = e.getBoundingClientRect();
      if (r.width === 0) continue;
      if (r.right <= gorunumW + 1 && r.left >= -1) continue;
      let kaydirilan = false;
      for (let p = e.parentElement; p; p = p.parentElement) {
        const s = getComputedStyle(p);
        if (s.overflowX === "auto" || s.overflowX === "scroll") { kaydirilan = true; break; }
      }
      if (!kaydirilan) tasiranlar.push(`${ad(e)} [sağ:${Math.round(r.right)}]`);
    }
    // Öğe bulunamazsa taşıran bir metin düğümüdür (kırılamayan uzun bağlantı).
    if (tasiranlar.length === 0) {
      const gez = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      let n;
      while ((n = gez.nextNode()) && tasiranlar.length < 3) {
        if (!n.nodeValue.trim()) continue;
        const rng = document.createRange();
        rng.selectNodeContents(n);
        for (const r of rng.getClientRects()) {
          if (r.right > gorunumW + 1) {
            tasiranlar.push(`metin: "${n.nodeValue.trim().slice(0, 36)}"`);
            break;
          }
        }
      }
    }
  }

  // 2. Dokunma hedefleri
  const kucukHedefler = [];
  const hedefler = 'a[href], button, input[type="checkbox"], input[type="radio"], summary, select';
  for (const e of document.querySelectorAll(hedefler)) {
    const r = e.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    if (e.tagName === "A" && getComputedStyle(e).display === "inline") continue;  // cümle içi bağlantı
    if (r.height < 24 || r.width < 24) {
      kucukHedefler.push(`${ad(e)} [${Math.round(r.width)}x${Math.round(r.height)}]`);
    }
  }

  // 3. iOS'ta yakınlaştırma tetikleyen alanlar
  const kucukAlanlar = [];
  for (const e of document.querySelectorAll("input, select, textarea")) {
    if (e.type === "checkbox" || e.type === "radio" || e.type === "file") continue;
    const r = e.getBoundingClientRect();
    if (r.width === 0) continue;
    const fs = parseFloat(getComputedStyle(e).fontSize);
    if (fs < 16) kucukAlanlar.push(`${ad(e)} [${fs}px]`);
  }

  // 4. Kırpılan metin
  const kirpilan = [];
  for (const e of document.querySelectorAll("p,span,h1,h2,h3,td,th,a,button,li,dd,dt,label")) {
    if (e.classList.contains("sr-only") || e.closest(".sr-only")) continue;
    const s = getComputedStyle(e);
    if (s.textOverflow === "ellipsis" || s.overflow === "visible") continue;
    if (e.scrollHeight > e.clientHeight + 2 || e.scrollWidth > e.clientWidth + 2) kirpilan.push(ad(e));
  }

  const tek = (a) => [...new Set(a)].slice(0, 4);
  return {
    tasma,
    tasiranlar: tek(tasiranlar),
    kucukHedefler: tek(kucukHedefler),
    kucukAlanlar: tek(kucukAlanlar),
    kirpilan: tek(kirpilan),
  };
}

const tarayici = await chromium.launch();

for (const c of CIHAZLAR) {
  console.log(`\n${c.ad} (${c.w}x${c.h})`);
  const oturumlar = new Map();

  async function sayfaAl(k) {
    const anahtar = k ?? "__konuk";
    if (oturumlar.has(anahtar)) return oturumlar.get(anahtar);
    const baglam = await tarayici.newContext({
      viewport: { width: c.w, height: c.h },
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true,
    });
    const sayfa = await baglam.newPage();
    if (k) {
      await sayfa.goto(`${BASE}/giris`, { waitUntil: "domcontentloaded" });
      await sayfa.fill("#username", k);
      await sayfa.fill("#password", SIFRE);
      await sayfa.click('button[type="submit"]');
      await sayfa.waitForURL(/\/panel/, { timeout: 20000 });
    }
    oturumlar.set(anahtar, sayfa);
    return sayfa;
  }

  for (const s of SAYFALAR) {
    const sayfa = await sayfaAl(s.k);
    await sayfa.goto(BASE + s.yol, { waitUntil: "networkidle" });
    await sayfa.waitForTimeout(150);
    const o = await sayfa.evaluate(olc);

    kontrol(`${s.ad}: yatay taşma yok`, o.tasma <= 1,
            `${o.tasma}px — ${o.tasiranlar.join(" ; ")}`);
    kontrol(`${s.ad}: dokunma hedefleri 24px+`, o.kucukHedefler.length === 0,
            o.kucukHedefler.join(" ; "));
    kontrol(`${s.ad}: form alanları 16px+`, o.kucukAlanlar.length === 0,
            o.kucukAlanlar.join(" ; "));
    kontrol(`${s.ad}: kırpılan metin yok`, o.kirpilan.length === 0,
            o.kirpilan.join(" ; "));
  }
  for (const sayfa of oturumlar.values()) await sayfa.context().close();
}

/* --- Menü çekmecesi: dar ekranda gezinmenin tek yolu --------------------- */
console.log("\nMenü çekmecesi");
{
  const baglam = await tarayici.newContext({
    viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
  });
  const sayfa = await baglam.newPage();
  await sayfa.goto(`${BASE}/giris`, { waitUntil: "domcontentloaded" });
  await sayfa.fill("#username", "ank.mudur");
  await sayfa.fill("#password", SIFRE);
  await sayfa.click('button[type="submit"]');
  await sayfa.waitForURL(/\/panel/, { timeout: 20000 });

  const dugme = sayfa.locator('button[aria-label="Menüyü aç"]');
  kontrol("çekmece düğmesi dar ekranda var", await dugme.isVisible());

  // Menü kapalıyken içerik sayfanın başında olmalı: kenar çubuğu yığılmamalı.
  const baslikY = await sayfa.locator("h1").first().boundingBox();
  kontrol("içerik ilk ekranda başlıyor", (baslikY?.y ?? 999) < 300,
          `başlık y=${Math.round(baslikY?.y ?? -1)}`);

  await dugme.click();
  await sayfa.waitForTimeout(250);
  const cekmece = sayfa.locator("#panel-cekmece");
  kontrol("çekmece açılıyor", await cekmece.isVisible());
  kontrol("çekmece kalıcı pencere olarak işaretli",
          (await cekmece.getAttribute("aria-modal")) === "true");

  // Açıkken arkadaki sayfa kaymamalı.
  const kilit = await sayfa.evaluate(() => getComputedStyle(document.body).overflow);
  kontrol("açıkken arka sayfa kilitli", kilit === "hidden", `overflow=${kilit}`);

  await sayfa.keyboard.press("Escape");
  await sayfa.waitForTimeout(250);
  kontrol("Esc kapatıyor", !(await cekmece.isVisible()));

  // Menüden bir sayfaya gidince çekmece kendiliğinden kapanmalı.
  await dugme.click();
  await sayfa.waitForTimeout(250);
  await sayfa.locator('#panel-cekmece a[href="/panel/takvim"]').click();
  await sayfa.waitForURL(/\/panel\/takvim/, { timeout: 20000 });
  await sayfa.waitForTimeout(350);
  kontrol("sayfa değişince kapanıyor", !(await sayfa.locator("#panel-cekmece").isVisible()));

  await baglam.close();
}

/* --- Liste dar ekranda kart olarak çizilmeli ----------------------------- */
console.log("\nŞikâyet listesi");
{
  const baglam = await tarayici.newContext({
    viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
  });
  const sayfa = await baglam.newPage();
  await sayfa.goto(`${BASE}/giris`, { waitUntil: "domcontentloaded" });
  await sayfa.fill("#username", "ank.mudur");
  await sayfa.fill("#password", SIFRE);
  await sayfa.click('button[type="submit"]');
  await sayfa.waitForURL(/\/panel/, { timeout: 20000 });
  await sayfa.goto(`${BASE}/panel/sikayetler`, { waitUntil: "networkidle" });

  kontrol("tablo dar ekranda gizli", !(await sayfa.locator("table.tbl").first().isVisible()));

  const ilkKart = sayfa.locator('a[href^="/panel/sikayet/"]').first();
  const kutu = await ilkKart.boundingBox();
  kontrol("kartın tamamı dokunma hedefi", (kutu?.height ?? 0) >= 44,
          `kart yüksekliği ${Math.round(kutu?.height ?? 0)}px`);

  // En çok bakılan bilgi — durum — kaydırmadan görünmeli.
  const durum = await ilkKart.locator(".chip").first().textContent();
  kontrol("durum kartta görünüyor", !!durum?.trim(), `bulunan: ${durum}`);

  // Süzgeçler kartta da erişilebilir olmalı.
  const suzgec = sayfa.locator('button[aria-label^="Durum süzgeci"]');
  kontrol("durum süzgeci dar ekranda var", await suzgec.first().isVisible());
  const sKutu = await suzgec.first().boundingBox();
  kontrol("süzgeç düğmesi 24px+", (sKutu?.height ?? 0) >= 24 && (sKutu?.width ?? 0) >= 24,
          `${Math.round(sKutu?.width ?? 0)}x${Math.round(sKutu?.height ?? 0)}`);

  await baglam.close();
}

await tarayici.close();

console.log(`\n${"=".repeat(60)}`);
console.log(`SONUÇ: ${gecen} başarılı, ${kalan} başarısız`);
console.log("=".repeat(60));
process.exit(kalan ? 1 : 0);
