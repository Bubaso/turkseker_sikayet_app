/* ===========================================================================
   Testlerin tarayıcı sürücüsünü çözümlemesi.

   Playwright projenin bağımlılığı değildir (kurulumu ağır ve uygulamanın
   çalışması için gerekmez). Bu yüzden önce normal yoldan, bulunamazsa
   PLAYWRIGHT_PATH ortam değişkeninden ya da bilinen genel kurulum
   dizininden yüklenir. Hiçbiri yoksa açıklayıcı bir hata verilir.
   =========================================================================== */

const ADAYLAR = [
  "playwright",
  process.env.PLAYWRIGHT_PATH,
  "/opt/node-tools/node_modules/playwright/index.js",
].filter(Boolean);

export async function chromiumYukle() {
  const hatalar = [];
  for (const yol of ADAYLAR) {
    try {
      const mod = await import(yol);
      const chromium = mod.chromium ?? mod.default?.chromium;
      if (chromium) return chromium;
      hatalar.push(`${yol}: chromium bulunamadı`);
    } catch (e) {
      hatalar.push(`${yol}: ${e.code ?? e.message}`);
    }
  }
  throw new Error(
    "Playwright yüklenemedi. Kurmak için: npm i -D playwright && npx playwright install chromium\n" +
    "Hazır kurulum varsa PLAYWRIGHT_PATH ile yolunu verin.\n" +
    hatalar.map((h) => `  - ${h}`).join("\n"),
  );
}
