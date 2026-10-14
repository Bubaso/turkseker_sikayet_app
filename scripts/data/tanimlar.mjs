/* Ürünler, şikâyet kategorileri, laboratuvar parametreleri, resmî tatiller. */

export const URUNLER = [
  // --- Paketli şeker (itirazlar Perakende Satışlar ve Lojistik DB'ye gider) ---
  { name: "Küp Şeker",            group: "PAKETLI_SEKER", packaging: "750 g paket" },
  { name: "Küp Şeker",            group: "PAKETLI_SEKER", packaging: "5 kg koli" },
  { name: "Toz Şeker",            group: "PAKETLI_SEKER", packaging: "1 kg paket" },
  { name: "Toz Şeker",            group: "PAKETLI_SEKER", packaging: "5 kg paket" },
  { name: "Toz Şeker",            group: "PAKETLI_SEKER", packaging: "10 kg paket" },
  { name: "Kesme Şeker",          group: "PAKETLI_SEKER", packaging: "500 g paket" },
  { name: "Stick Şeker",          group: "PAKETLI_SEKER", packaging: "1000 x 3 g koli" },
  // --- Dökme / çuvallı şeker ---
  { name: "Kristal Toz Şeker",    group: "DOKME_SEKER",   packaging: "50 kg çuval" },
  { name: "Kristal Toz Şeker",    group: "DOKME_SEKER",   packaging: "1000 kg big-bag" },
  { name: "Kristal Toz Şeker",    group: "DOKME_SEKER",   packaging: "Dökme (silobas)" },
  { name: "Rafine Küp Şeker",     group: "DOKME_SEKER",   packaging: "Dökme" },
  // --- Melas ---
  { name: "Şeker Pancarı Melası", group: "MELAS",         packaging: "Dökme (tanker)" },
  // --- Küspe / posa ---
  { name: "Yaş Küspe",            group: "POSA",          packaging: "Dökme" },
  { name: "Kuru Küspe",           group: "POSA",          packaging: "Dökme" },
  { name: "Pelet Küspe",          group: "POSA",          packaging: "50 kg paket" },
  { name: "Melaslı Kuru Küspe",   group: "POSA",          packaging: "50 kg paket" },
].map((p, i) => ({ ...p, sort: i + 1 }));

/** family: URUN_KALITE | GIDA_GUVENLIGI | AMBALAJ | MIKTAR | TESLIM | TICARI | DIGER
 *  critical: gıda güvenliği ihbarı — FSSC 22000 düzeltici faaliyet zorunlu
 *  lab: varsayılan olarak laboratuvar analizi gerektirir */
export const KATEGORILER = [
  { name: "Topaklanma / sertleşme",                     family: "URUN_KALITE",     critical: 0, lab: 1 },
  { name: "Renk bozukluğu / sararma",                   family: "URUN_KALITE",     critical: 0, lab: 1 },
  { name: "Nem oranı yüksekliği",                       family: "URUN_KALITE",     critical: 0, lab: 1 },
  { name: "Tane iriliği / elek analizi uygunsuzluğu",   family: "URUN_KALITE",     critical: 0, lab: 1 },
  { name: "Polarizasyon / şeker oranı düşüklüğü",       family: "URUN_KALITE",     critical: 0, lab: 1 },
  { name: "Tat / koku bozukluğu",                       family: "URUN_KALITE",     critical: 0, lab: 1 },

  { name: "Yabancı madde (metal, cam, plastik)",        family: "GIDA_GUVENLIGI",  critical: 1, lab: 1 },
  { name: "Böcek / haşere bulaşması",                   family: "GIDA_GUVENLIGI",  critical: 1, lab: 1 },
  { name: "Küflenme / mikrobiyolojik bulaşma",          family: "GIDA_GUVENLIGI",  critical: 1, lab: 1 },
  { name: "Kimyasal bulaşma şüphesi",                   family: "GIDA_GUVENLIGI",  critical: 1, lab: 1 },

  { name: "Çuval / paket yırtılması",                   family: "AMBALAJ",         critical: 0, lab: 0 },
  { name: "Ambalaj baskı / etiket hatası",              family: "AMBALAJ",         critical: 0, lab: 0 },
  { name: "Ambalaj sızdırması",                         family: "AMBALAJ",         critical: 0, lab: 0 },
  { name: "Palet / streç hasarı",                       family: "AMBALAJ",         critical: 0, lab: 0 },

  { name: "Eksik gramaj",                               family: "MIKTAR",          critical: 0, lab: 0 },
  { name: "Eksik teslim / tonaj farkı",                 family: "MIKTAR",          critical: 0, lab: 0 },

  { name: "Gecikmeli teslim",                           family: "TESLIM",          critical: 0, lab: 0 },
  { name: "Nakliye kaynaklı hasar",                     family: "TESLIM",          critical: 0, lab: 0 },
  { name: "Araç / hijyen uygunsuzluğu",                 family: "TESLIM",          critical: 0, lab: 0 },
  { name: "Yanlış ürün sevkiyatı",                      family: "TESLIM",          critical: 0, lab: 0 },

  { name: "Fatura / fiyat uyuşmazlığı",                 family: "TICARI",          critical: 0, lab: 0 },
  { name: "Sözleşme şartlarına aykırılık",              family: "TICARI",          critical: 0, lab: 0 },
  { name: "Son kullanma tarihi / parti sorunu",         family: "TICARI",          critical: 0, lab: 0 },

  { name: "Diğer",                                      family: "DIGER",           critical: 0, lab: 0 },
].map((k, i) => ({ ...k, sort: i + 1 }));

export const KATEGORI_AILE_ETIKET = {
  URUN_KALITE: "Ürün kalitesi",
  GIDA_GUVENLIGI: "Gıda güvenliği",
  AMBALAJ: "Ambalaj",
  MIKTAR: "Miktar / gramaj",
  TESLIM: "Teslim ve nakliye",
  TICARI: "Ticari / belge",
  DIGER: "Diğer",
};

/**
 * Türkiye resmî tatilleri.
 * DİKKAT: Dinî bayram tarihleri astronomik hesaba göre ön tanımlıdır.
 * Resmî ilan sonrası Tanımlar > Resmî Tatil Takvimi ekranından düzeltilmelidir.
 * İş günü bazlı tüm SLA hesapları bu listeyi kullanır.
 */
export const TATILLER = [
  // 2025
  ["2025-01-01", "Yılbaşı"],
  ["2025-03-30", "Ramazan Bayramı 1. Gün"], ["2025-03-31", "Ramazan Bayramı 2. Gün"], ["2025-04-01", "Ramazan Bayramı 3. Gün"],
  ["2025-04-23", "Ulusal Egemenlik ve Çocuk Bayramı"],
  ["2025-05-01", "Emek ve Dayanışma Günü"],
  ["2025-05-19", "Atatürk'ü Anma, Gençlik ve Spor Bayramı"],
  ["2025-06-06", "Kurban Bayramı 1. Gün"], ["2025-06-07", "Kurban Bayramı 2. Gün"],
  ["2025-06-08", "Kurban Bayramı 3. Gün"], ["2025-06-09", "Kurban Bayramı 4. Gün"],
  ["2025-07-15", "Demokrasi ve Millî Birlik Günü"],
  ["2025-08-30", "Zafer Bayramı"],
  ["2025-10-29", "Cumhuriyet Bayramı"],
  // 2026
  ["2026-01-01", "Yılbaşı"],
  ["2026-03-20", "Ramazan Bayramı 1. Gün"], ["2026-03-21", "Ramazan Bayramı 2. Gün"], ["2026-03-22", "Ramazan Bayramı 3. Gün"],
  ["2026-04-23", "Ulusal Egemenlik ve Çocuk Bayramı"],
  ["2026-05-01", "Emek ve Dayanışma Günü"],
  ["2026-05-19", "Atatürk'ü Anma, Gençlik ve Spor Bayramı"],
  ["2026-05-27", "Kurban Bayramı 1. Gün"], ["2026-05-28", "Kurban Bayramı 2. Gün"],
  ["2026-05-29", "Kurban Bayramı 3. Gün"], ["2026-05-30", "Kurban Bayramı 4. Gün"],
  ["2026-07-15", "Demokrasi ve Millî Birlik Günü"],
  ["2026-08-30", "Zafer Bayramı"],
  ["2026-10-29", "Cumhuriyet Bayramı"],
  // 2027
  ["2027-01-01", "Yılbaşı"],
  ["2027-03-09", "Ramazan Bayramı 1. Gün"], ["2027-03-10", "Ramazan Bayramı 2. Gün"], ["2027-03-11", "Ramazan Bayramı 3. Gün"],
  ["2027-04-23", "Ulusal Egemenlik ve Çocuk Bayramı"],
  ["2027-05-01", "Emek ve Dayanışma Günü"],
  ["2027-05-17", "Kurban Bayramı 1. Gün"], ["2027-05-18", "Kurban Bayramı 2. Gün"],
  ["2027-05-19", "Kurban Bayramı 3. Gün / Atatürk'ü Anma, Gençlik ve Spor Bayramı"],
  ["2027-05-20", "Kurban Bayramı 4. Gün"],
  ["2027-07-15", "Demokrasi ve Millî Birlik Günü"],
  ["2027-08-30", "Zafer Bayramı"],
  ["2027-10-29", "Cumhuriyet Bayramı"],
].map(([date, name]) => ({ date, name }));
