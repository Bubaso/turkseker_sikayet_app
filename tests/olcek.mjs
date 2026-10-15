/* ===========================================================================
   Yazı ölçeği testi — arayüz tarayıcının yazı boyutu ayarını dinliyor mu?

   Görme güçlüğü çeken kullanıcının kullandığı ayar tarayıcının "varsayılan
   yazı boyutu" ayarıdır; bu ayar kök (html) font-size değerini belirler ve
   `rem` de ona göre çözülür. Yakınlaştırma (Ctrl +) zaten her birimi, px
   dahil, büyütür; asıl mesele yakınlaştırmadan yazının büyüyebilmesidir.

   CSS'imiz html'e font-size yazmadığı için kök boyutu sayfaya enjekte etmek
   ayarın birebir karşılığıdır.

   Doğrulananlar, her kök boyutu için:
     1. Gövde yazı boyutu kökle birlikte büyüyor (yani hiçbir yerde px'e
        sabitlenmemiş).
     2. Sayfa yatay taşmıyor (tablo kapları hariç; onlar bilerek kaydırılır).
     3. Kutusuna sığmayıp kırpılan metin yok (üç nokta ile kısaltılanlar
        kasıtlıdır, sayılmaz).

   A4 çıktı sayfaları (/belge/[id], /panel/ozet) bilerek kapsam dışıdır:
   onların ölçüsü `pt`'dir, çünkü 210mm'lik kâğıt kutusuna çizilirler ve
   ekrandaki önizlemenin baskıyla birebir aynı olması gerekir.

   Kullanım: sunucu ayakta ve demo verisi üretilmiş olmalı.
     TEST_BASE=http://localhost:3000 node tests/olcek.mjs
   =========================================================================== */

import { env } from "../scripts/lib/env.mjs";
import { chromiumYukle } from "./lib/tarayici.mjs";

const chromium = await chromiumYukle();
const BASE = env("TEST_BASE", "http://localhost:3000");
const SIFRE = "Demo2026!";

/** Kök boyutları: tarayıcı varsayılanı, büyütülmüş ve iyice büyütülmüş. */
const KOKLER = [16, 20, 24];

/** En yoğun yerleşimler: bir şey kırılacaksa önce burada kırılır. */
const SAYFALAR = [
  { kullanici: "gm.genelmudur", yol: "/panel",            ad: "üst yönetim panosu" },
  { kullanici: "gm.genelmudur", yol: "/panel/sikayetler", ad: "şikâyet listesi" },
  { kullanici: "ank.mudur",     yol: "/panel",            ad: "fabrika panosu" },
  { kullanici: "ank.mudur",     yol: "/panel/takvim",     ad: "takvim" },
  { kullanici: "ank.mudur",     yol: "/panel/gorevler",   ad: "bana düşen aşamalar" },
];

let gecen = 0;
let kalan = 0;

function kontrol(ad, kosul, ek = "") {
  if (kosul) { gecen++; console.log(`  ✓ ${ad}`); }
  else { kalan++; console.log(`  ✗ ${ad}${ek ? ` — ${ek}` : ""}`); }
}

const tarayici = await chromium.launch();

/** Verilen kök boyutuyla giriş yapmış bir sayfa döndürür. */
async function oturumAc(kullanici, kok) {
  const baglam = await tarayici.newContext({ viewport: { width: 1440, height: 1000 } });
  if (kok !== 16) {
    await baglam.addInitScript(`
      document.addEventListener("DOMContentLoaded", () => {
        const s = document.createElement("style");
        s.textContent = "html { font-size: ${kok}px }";
        document.head.appendChild(s);
      });
    `);
  }
  const sayfa = await baglam.newPage();
  await sayfa.goto(`${BASE}/giris`, { waitUntil: "domcontentloaded" });
  await sayfa.fill("#username", kullanici);
  await sayfa.fill("#password", SIFRE);
  await sayfa.click('button[type="submit"]');
  await sayfa.waitForURL(/\/panel/, { timeout: 20000 });
  return sayfa;
}

/** Sayfayı ölçer: gövde boyutu, yatay taşma ve kırpılan metinler. */
function olc() {
  const kok = document.documentElement;
  const kirpilan = [...document.querySelectorAll("p,span,h1,h2,h3,td,th,a,button,li,dd,dt")]
    .filter((e) => {
      const s = getComputedStyle(e);
      if (s.textOverflow === "ellipsis") return false;   // kasıtlı kısaltma
      if (s.overflow === "visible") return false;        // taşsa da görünür
      return e.scrollHeight > e.clientHeight + 2 || e.scrollWidth > e.clientWidth + 2;
    })
    .slice(0, 3)
    .map((e) => `<${e.tagName.toLowerCase()}> ${(e.textContent ?? "").trim().slice(0, 40)}`);
  return {
    govde: parseFloat(getComputedStyle(document.body).fontSize),
    tasma: kok.scrollWidth - kok.clientWidth,
    kirpilan,
  };
}

for (const kok of KOKLER) {
  console.log(`\nKök yazı boyutu ${kok}px`);
  const oturumlar = new Map();
  for (const { kullanici, yol, ad } of SAYFALAR) {
    if (!oturumlar.has(kullanici)) oturumlar.set(kullanici, await oturumAc(kullanici, kok));
    const sayfa = oturumlar.get(kullanici);
    await sayfa.goto(BASE + yol, { waitUntil: "networkidle" });
    await sayfa.waitForTimeout(200);
    const o = await sayfa.evaluate(olc);

    // Gövde 0.875rem; kökle orantılı büyümeli.
    const beklenen = kok * 0.875;
    kontrol(
      `${ad}: gövde ${o.govde}px (beklenen ${beklenen})`,
      Math.abs(o.govde - beklenen) < 0.6,
      "yazı boyutu köke bağlı değil — bir yerde px kalmış olabilir",
    );
    kontrol(`${ad}: yatay taşma yok`, o.tasma <= 1, `${o.tasma}px taşıyor`);
    kontrol(
      `${ad}: kırpılan metin yok`,
      o.kirpilan.length === 0,
      o.kirpilan.join(" | "),
    );
  }
  for (const sayfa of oturumlar.values()) await sayfa.context().close();
}

await tarayici.close();

console.log(`\n${"=".repeat(60)}`);
console.log(`SONUÇ: ${gecen} başarılı, ${kalan} başarısız`);
console.log("=".repeat(60));
process.exit(kalan ? 1 : 0);
