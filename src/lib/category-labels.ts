/** Şikâyet kategorisi ailelerinin görünen adları. */
export const KATEGORI_AILE_ETIKET: Record<string, string> = {
  URUN_KALITE: "Ürün kalitesi",
  GIDA_GUVENLIGI: "Gıda güvenliği",
  AMBALAJ: "Ambalaj",
  MIKTAR: "Miktar / gramaj",
  TESLIM: "Teslim ve nakliye",
  TICARI: "Ticari / belge",
  DIGER: "Diğer",
};

export function kategoriAilesi(family: string | null | undefined): string {
  if (!family) return "—";
  return KATEGORI_AILE_ETIKET[family] ?? family;
}
