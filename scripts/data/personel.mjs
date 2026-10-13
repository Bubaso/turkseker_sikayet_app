/* Demo personel üretimi: her fabrikada 12 unvan + Genel Müdürlük kadrosu. */

/** Her fabrikada açılacak hesaplar. key -> kullanıcı adı eki. */
export const FABRIKA_KADROSU = [
  { key: "mudur",      role: "FABRIKA_MUDURU",   title: "Fabrika Müdürü" },
  { key: "myteknik",   role: "MUDUR_YRD_TEKNIK", title: "Fabrika Müdür Yardımcısı (Teknik)" },
  { key: "myziraat",   role: "MUDUR_YRD_ZIRAAT", title: "Fabrika Müdür Yardımcısı (Ziraat)" },
  { key: "myidari",    role: "MUDUR_YRD_IDARI",  title: "Fabrika Müdür Yardımcısı (İdari)" },
  { key: "kalitemy",   role: "KALITE_MUDUR_YRD", title: "Kalite ve İşletme Kontrol Müdür Yardımcısı" },
  { key: "kalite",     role: "KALITE_SORUMLUSU", title: "Kalite Sorumlusu" },
  { key: "ambar",      role: "AMBAR_SEFI",       title: "Ambar Şefi" },
  { key: "satis",      role: "SATIS_BIRIM_SEFI", title: "Satış Birim Şefi" },
  { key: "lab",        role: "LABORATUVAR",      title: "Laboratuvar Sorumlusu" },
  { key: "muhasebe",   role: "MUHASEBE",         title: "Muhasebe Yetkilisi" },
  { key: "ziraat",     role: "ZIRAAT",           title: "Ziraat Yetkilisi" },
  { key: "teknik",     role: "TEKNIK_ISLETME",   title: "Teknik (İşletme) Yetkilisi" },
];

/** Genel Müdürlük kadrosu. dept null ise daireye bağlı değil. */
export const GM_KADROSU = [
  { key: "gm.genelmudur",  role: "GM_UST_YONETIM", title: "Genel Müdür Yardımcısı",                                    dept: null },
  { key: "gm.pazarlama",   role: "GM_DAIRE",       title: "Pazarlama ve Satış Daire Başkanı",                          dept: "PAZARLAMA_SATIS" },
  { key: "gm.perakende",   role: "GM_DAIRE",       title: "Perakende Satışlar ve Lojistik Daire Başkanı",              dept: "PERAKENDE_LOJISTIK" },
  { key: "gm.uretim",      role: "GM_DAIRE",       title: "Şeker Üretim Daire Başkanı",                                dept: "SEKER_URETIM" },
  { key: "gm.maliisler",   role: "GM_DAIRE",       title: "Mali İşler ve Muhasebe Daire Başkanı",                      dept: "MALI_ISLER" },
  { key: "gm.strateji",    role: "GM_DAIRE",       title: "Strateji Geliştirme Daire Başkanı",                         dept: "STRATEJI" },
  { key: "sistem",         role: "SISTEM_YONETICISI", title: "Sistem Yöneticisi (Bilgi İşlem)",                        dept: null },
];

const ADLAR = [
  "Ahmet", "Mehmet", "Mustafa", "Ali", "Hasan", "Hüseyin", "İbrahim", "Osman", "Yusuf", "Murat",
  "Ömer", "Kemal", "Fatih", "Serkan", "Emre", "Burak", "Oğuz", "Levent", "Tayfun", "Cem",
  "Ayşe", "Fatma", "Emine", "Hatice", "Zeynep", "Elif", "Meryem", "Sevgi", "Özlem", "Derya",
  "Gülşen", "Nurcan", "Pınar", "Seda", "Tuğba", "Yasemin", "Hülya", "Şebnem", "Ebru", "Esra",
  "Recep", "Süleyman", "Ramazan", "Erdal", "Hakan", "Volkan", "Bülent", "Selim", "Okan", "Barış",
  "Gökhan", "İsmail", "Harun", "Sinan", "Cengiz", "Tolga", "Umut", "Koray", "Alper", "Ertuğrul",
];

const SOYADLAR = [
  "Yılmaz", "Kaya", "Demir", "Şahin", "Çelik", "Yıldız", "Yıldırım", "Öztürk", "Aydın", "Özdemir",
  "Arslan", "Doğan", "Kılıç", "Aslan", "Çetin", "Kara", "Koç", "Kurt", "Özkan", "Şimşek",
  "Polat", "Korkmaz", "Erdoğan", "Bulut", "Güneş", "Aksoy", "Turan", "Taş", "Bozkurt", "Avcı",
  "Karaca", "Köse", "Güler", "Yalçın", "Çakır", "Sarı", "Tekin", "Gül", "Çiftçi", "Acar",
  "Ateş", "Başaran", "Duman", "Erol", "Fidan", "Gündoğdu", "Keskin", "Mutlu", "Narin", "Ocak",
  "Pekcan", "Sezer", "Tunç", "Uysal", "Vural", "Yurt", "Zengin", "Balcı", "Candan", "Dalkılıç",
];

/** Fabrika sırası ve kadro sırasından sapmasız (deterministik) isim üretir. */
export function uret(fabrikaIndex, kadroIndex) {
  const a = (fabrikaIndex * 7 + kadroIndex * 13) % ADLAR.length;
  const s = (fabrikaIndex * 11 + kadroIndex * 5 + 3) % SOYADLAR.length;
  return `${ADLAR[a]} ${SOYADLAR[s]}`;
}
