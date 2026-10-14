/* ===========================================================================
   Roller ve yetki matrisi.
   Dayanak: TL PASAT 004 md. 3 (inceleme ekibi fabrika birimlerinden kurulur).
   =========================================================================== */

export const ROLES = {
  SISTEM_YONETICISI: "SISTEM_YONETICISI",

  // --- Fabrika ---
  FABRIKA_MUDURU: "FABRIKA_MUDURU",
  MUDUR_YRD_TEKNIK: "MUDUR_YRD_TEKNIK",
  MUDUR_YRD_ZIRAAT: "MUDUR_YRD_ZIRAAT",
  MUDUR_YRD_IDARI: "MUDUR_YRD_IDARI",
  KALITE_MUDUR_YRD: "KALITE_MUDUR_YRD",
  KALITE_SORUMLUSU: "KALITE_SORUMLUSU",
  AMBAR_SEFI: "AMBAR_SEFI",
  SATIS_BIRIM_SEFI: "SATIS_BIRIM_SEFI",
  LABORATUVAR: "LABORATUVAR",
  MUHASEBE: "MUHASEBE",
  ZIRAAT: "ZIRAAT",
  TEKNIK_ISLETME: "TEKNIK_ISLETME",

  // --- Genel Müdürlük ---
  GM_UST_YONETIM: "GM_UST_YONETIM",
  GM_DAIRE: "GM_DAIRE",
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];

export const ROLE_LABEL: Record<Role, string> = {
  SISTEM_YONETICISI: "Sistem Yöneticisi",
  FABRIKA_MUDURU: "Fabrika Müdürü",
  MUDUR_YRD_TEKNIK: "Fabrika Müdür Yardımcısı (Teknik)",
  MUDUR_YRD_ZIRAAT: "Fabrika Müdür Yardımcısı (Ziraat)",
  MUDUR_YRD_IDARI: "Fabrika Müdür Yardımcısı (İdari)",
  KALITE_MUDUR_YRD: "Kalite ve İşletme Kontrol Müdür Yardımcısı",
  KALITE_SORUMLUSU: "Kalite Sorumlusu",
  AMBAR_SEFI: "Ambar Şefi",
  SATIS_BIRIM_SEFI: "Satışı Yapan Birim Şefi",
  LABORATUVAR: "Laboratuvar Sorumlusu",
  MUHASEBE: "Muhasebe Yetkilisi",
  ZIRAAT: "Ziraat Yetkilisi",
  TEKNIK_ISLETME: "Teknik (İşletme) Yetkilisi",
  GM_UST_YONETIM: "Genel Müdürlük Üst Yönetim",
  GM_DAIRE: "Daire Başkanlığı Yetkilisi",
};

export const FACTORY_ROLES: Role[] = [
  ROLES.FABRIKA_MUDURU,
  ROLES.MUDUR_YRD_TEKNIK,
  ROLES.MUDUR_YRD_ZIRAAT,
  ROLES.MUDUR_YRD_IDARI,
  ROLES.KALITE_MUDUR_YRD,
  ROLES.KALITE_SORUMLUSU,
  ROLES.AMBAR_SEFI,
  ROLES.SATIS_BIRIM_SEFI,
  ROLES.LABORATUVAR,
  ROLES.MUHASEBE,
  ROLES.ZIRAAT,
  ROLES.TEKNIK_ISLETME,
];

export const GM_ROLES: Role[] = [ROLES.GM_UST_YONETIM, ROLES.GM_DAIRE];

export function isFactoryRole(role: string): boolean {
  return (FACTORY_ROLES as string[]).includes(role);
}
export function isGmRole(role: string): boolean {
  return (GM_ROLES as string[]).includes(role);
}

/* --- Yetkiler -------------------------------------------------------------

   Sadeleştirilmiş modelde yetki matrisi küçüktür: bir aşamayı kimin
   kaydedebileceğini yetki değil, aşamanın sorumlusu belirler (bkz.
   asamaYetkisi). Burada yalnızca aşamalardan bağımsız altı yetki kalır.
   -------------------------------------------------------------------------- */

export const PERMISSIONS = {
  /** Şikâyet kaydı açabilir (telefon/e-posta/elden gelen başvurular). */
  SIKAYET_KAYDET: "SIKAYET_KAYDET",
  /** Bir aşamanın sorumlusunu değiştirebilir (izin, rapor, ayrılma hâlleri). */
  GOREV_ATA: "GOREV_ATA",
  /** Dosyayı kapatabilir ya da iptal edebilir. */
  SIKAYET_KAPAT: "SIKAYET_KAPAT",
  /** Daire Başkanlığı olarak itirazı karara bağlayabilir. */
  ITIRAZ_KARAR: "ITIRAZ_KARAR",
  /** Bildirim giden kutusunu görebilir. */
  BILDIRIM_GOR: "BILDIRIM_GOR",
  /** Tanımları (ürün, kategori, tatil, ayar) yönetebilir. */
  TANIM_YONET: "TANIM_YONET",
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

const P = PERMISSIONS;

/*
 * Fabrika Müdürü süreci yönetir: şikâyeti görür, ekibi kurar ya da dosyayı
 * yönlendirir, aşamaların sorumlusunu değiştirir, gerekirse aşamayı atlar ve
 * dosyayı kapatır. Diğer unvanlar kendilerine düşen aşamayı kaydeder; bunun
 * için ayrı bir yetkiye gerek yoktur.
 */
const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  SISTEM_YONETICISI: Object.values(P),

  FABRIKA_MUDURU: [
    P.SIKAYET_KAYDET, P.GOREV_ATA, P.SIKAYET_KAPAT, P.BILDIRIM_GOR,
  ],
  MUDUR_YRD_TEKNIK: [P.SIKAYET_KAYDET, P.BILDIRIM_GOR],
  MUDUR_YRD_ZIRAAT: [P.SIKAYET_KAYDET, P.BILDIRIM_GOR],
  MUDUR_YRD_IDARI: [P.SIKAYET_KAYDET, P.BILDIRIM_GOR],
  KALITE_MUDUR_YRD: [P.SIKAYET_KAYDET, P.BILDIRIM_GOR],
  KALITE_SORUMLUSU: [P.SIKAYET_KAYDET, P.BILDIRIM_GOR],
  AMBAR_SEFI: [P.SIKAYET_KAYDET],
  SATIS_BIRIM_SEFI: [P.SIKAYET_KAYDET],
  LABORATUVAR: [],
  MUHASEBE: [P.SIKAYET_KAYDET],
  ZIRAAT: [P.SIKAYET_KAYDET],
  TEKNIK_ISLETME: [P.SIKAYET_KAYDET],

  GM_UST_YONETIM: [P.BILDIRIM_GOR, P.ITIRAZ_KARAR],
  GM_DAIRE: [P.ITIRAZ_KARAR, P.BILDIRIM_GOR],
};

export function can(role: string, permission: Permission): boolean {
  const list = ROLE_PERMISSIONS[role as Role];
  return !!list && list.includes(permission);
}
