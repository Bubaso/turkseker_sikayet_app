/* ===========================================================================
   Roller ve yetki matrisi
   Dayanak: TL PASAT 004 md. 3 (ekip birimleri) ve tutanak imza zinciri
   (FR PASAT 004 / FR PASAT 005).
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

/* --- Ekip birimleri (md. 3) ----------------------------------------------- */

export const TEAM_UNITS = {
  KALITE_ISLETME_KONTROL: "KALITE_ISLETME_KONTROL",
  TEKNIK_ISLETME: "TEKNIK_ISLETME",
  MUHASEBE: "MUHASEBE",
  ZIRAAT: "ZIRAAT",
} as const;
export type TeamUnit = (typeof TEAM_UNITS)[keyof typeof TEAM_UNITS];

export const TEAM_UNIT_LABEL: Record<TeamUnit, string> = {
  KALITE_ISLETME_KONTROL: "Kalite ve İşletme Kontrol",
  TEKNIK_ISLETME: "Teknik (İşletme)",
  MUHASEBE: "Muhasebe",
  ZIRAAT: "Ziraat",
};

/** Bir ekip birimine atanabilecek roller. */
export const TEAM_UNIT_ROLES: Record<TeamUnit, Role[]> = {
  KALITE_ISLETME_KONTROL: [ROLES.KALITE_MUDUR_YRD, ROLES.KALITE_SORUMLUSU, ROLES.LABORATUVAR],
  TEKNIK_ISLETME: [ROLES.TEKNIK_ISLETME, ROLES.MUDUR_YRD_TEKNIK],
  MUHASEBE: [ROLES.MUHASEBE],
  ZIRAAT: [ROLES.ZIRAAT, ROLES.MUDUR_YRD_ZIRAAT],
};

/* --- Yetkiler -------------------------------------------------------------- */

export const PERMISSIONS = {
  /** Şikâyet kaydı açabilir (telefon/e-posta/elden gelen başvurular). */
  SIKAYET_KAYDET: "SIKAYET_KAYDET",
  /** Ekip kurabilir veya dosyayı başka fabrikaya yönlendirebilir. */
  EKIP_YONET: "EKIP_YONET",
  /** Yerinde inceleme ve numune kaydı girebilir. */
  INCELEME_GIR: "INCELEME_GIR",
  /** Laboratuvar analiz sonucu girebilir. */
  ANALIZ_GIR: "ANALIZ_GIR",
  /** Tutanak/belge taslağı hazırlayabilir. */
  BELGE_HAZIRLA: "BELGE_HAZIRLA",
  /** İmza zincirinde onay verebilir. */
  BELGE_IMZALA: "BELGE_IMZALA",
  /** Fabrika müdürü nihai onayı. */
  BELGE_ONAYLA: "BELGE_ONAYLA",
  /** Haklı/haksız kararını kaydedebilir. */
  KARAR_VER: "KARAR_VER",
  /** İade/değişim ve nakliye ödemesi gerçekleşmesini girebilir. */
  ISLEM_GIR: "ISLEM_GIR",
  /** İtirazı Daire Başkanlığına gönderebilir. */
  ITIRAZ_GONDER: "ITIRAZ_GONDER",
  /** Daire Başkanlığı olarak itirazı karara bağlayabilir. */
  ITIRAZ_KARAR: "ITIRAZ_KARAR",
  /** Resmî yazı dağıtımını kaydedebilir. */
  RESMI_YAZI: "RESMI_YAZI",
  /** Şikâyeti kapatabilir. */
  SIKAYET_KAPAT: "SIKAYET_KAPAT",
  /** Tüm fabrikaların verisini görebilir. */
  TUM_FABRIKALAR: "TUM_FABRIKALAR",
  /** Bildirim giden kutusunu görebilir. */
  BILDIRIM_GOR: "BILDIRIM_GOR",
  /** Tanımları (ürün, kategori, tatil, kullanıcı) yönetebilir. */
  TANIM_YONET: "TANIM_YONET",
  /** Aylık raporu üretip gönderim kaydı açabilir. */
  RAPOR_URET: "RAPOR_URET",
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

const P = PERMISSIONS;

const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  SISTEM_YONETICISI: Object.values(P),

  FABRIKA_MUDURU: [
    P.SIKAYET_KAYDET, P.EKIP_YONET, P.INCELEME_GIR, P.BELGE_HAZIRLA, P.BELGE_IMZALA,
    P.BELGE_ONAYLA, P.KARAR_VER, P.ISLEM_GIR, P.ITIRAZ_GONDER, P.RESMI_YAZI,
    P.SIKAYET_KAPAT, P.BILDIRIM_GOR, P.RAPOR_URET,
  ],
  MUDUR_YRD_TEKNIK: [P.SIKAYET_KAYDET, P.INCELEME_GIR, P.BELGE_HAZIRLA, P.BELGE_IMZALA, P.BILDIRIM_GOR],
  MUDUR_YRD_ZIRAAT: [P.SIKAYET_KAYDET, P.INCELEME_GIR, P.BELGE_HAZIRLA, P.BELGE_IMZALA, P.BILDIRIM_GOR],
  MUDUR_YRD_IDARI: [P.SIKAYET_KAYDET, P.INCELEME_GIR, P.BELGE_HAZIRLA, P.BELGE_IMZALA, P.ISLEM_GIR, P.BILDIRIM_GOR],
  KALITE_MUDUR_YRD: [
    P.SIKAYET_KAYDET, P.INCELEME_GIR, P.ANALIZ_GIR, P.BELGE_HAZIRLA, P.BELGE_IMZALA,
    P.KARAR_VER, P.BILDIRIM_GOR, P.RAPOR_URET,
  ],
  KALITE_SORUMLUSU: [
    P.SIKAYET_KAYDET, P.INCELEME_GIR, P.BELGE_HAZIRLA, P.KARAR_VER, P.RESMI_YAZI,
    P.BILDIRIM_GOR, P.RAPOR_URET,
  ],
  AMBAR_SEFI: [P.SIKAYET_KAYDET, P.BELGE_IMZALA, P.ISLEM_GIR],
  SATIS_BIRIM_SEFI: [P.SIKAYET_KAYDET, P.BELGE_IMZALA, P.ISLEM_GIR],
  LABORATUVAR: [P.INCELEME_GIR, P.ANALIZ_GIR],
  MUHASEBE: [P.ISLEM_GIR, P.INCELEME_GIR],
  ZIRAAT: [P.INCELEME_GIR],
  TEKNIK_ISLETME: [P.INCELEME_GIR],

  GM_UST_YONETIM: [P.TUM_FABRIKALAR, P.BILDIRIM_GOR, P.RAPOR_URET, P.ITIRAZ_KARAR],
  GM_DAIRE: [P.TUM_FABRIKALAR, P.ITIRAZ_KARAR, P.BILDIRIM_GOR, P.RAPOR_URET],
};

export function can(role: string, permission: Permission): boolean {
  const list = ROLE_PERMISSIONS[role as Role];
  return !!list && list.includes(permission);
}

export function permissionsOf(role: string): Permission[] {
  return ROLE_PERMISSIONS[role as Role] ?? [];
}
