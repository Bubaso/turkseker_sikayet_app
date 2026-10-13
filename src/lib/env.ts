/* ===========================================================================
   Ortam değişkeni okuma.

   process.env.X ?? "varsayilan" kalıbı GÜVENSİZDİR: ?? yalnızca undefined ve
   null için varsayılana düşer, BOŞ DİZGE için düşmez. .env dosyalarında
   "UPLOAD_DIR=" gibi değeri boş bırakılmış satırlar çok yaygın olduğundan
   (bu projenin .env.example dosyasında da vardır) boş dizge sessizce yol,
   adres veya sağlayıcı adı yerine geçebilir. path.resolve("") çağrısı
   process.cwd() döndürdüğü için bu, yanlış dizinde işlem yapılmasına yol açar.

   Bu yardımcı boş ve yalnızca boşluktan oluşan değerleri de tanımsız sayar.
   =========================================================================== */

/** Ortam değişkenini okur; tanımsız, boş veya yalnızca boşluksa varsayılanı döndürür. */
export function env(name: string, fallback: string): string {
  const raw = process.env[name];
  if (raw === undefined || raw === null) return fallback;
  const trimmed = raw.trim();
  return trimmed === "" ? fallback : trimmed;
}

/** Ortam değişkenini okur; anlamlı bir değer yoksa undefined döndürür. */
export function envOptional(name: string): string | undefined {
  const raw = process.env[name];
  if (raw === undefined || raw === null) return undefined;
  const trimmed = raw.trim();
  return trimmed === "" ? undefined : trimmed;
}

/** Sayısal ortam değişkeni. */
export function envNumber(name: string, fallback: number): number {
  const v = Number(env(name, String(fallback)));
  return Number.isFinite(v) ? v : fallback;
}

/** "true"/"1"/"evet" değerlerini doğru kabul eden mantıksal ortam değişkeni. */
export function envBool(name: string, fallback = false): boolean {
  const v = env(name, fallback ? "true" : "false").toLowerCase();
  return v === "true" || v === "1" || v === "evet";
}
