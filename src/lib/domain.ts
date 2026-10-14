/* ===========================================================================
   Alan sözlüğü — durumlar, talepler, belge türleri ve Türkçe etiketleri.
   Tüm arayüz metinleri buradan okunur; tek kaynak ilkesi.
   =========================================================================== */

/* --- Şikâyet durumu (iş akışı) -------------------------------------------- */

export const STATUS = {
  YENI: "YENI",
  YONLENDIRILDI: "YONLENDIRILDI",
  INCELEMEDE: "INCELEMEDE",
  KARAR_VERILDI: "KARAR_VERILDI",
  ITIRAZ_DEGERLENDIRME: "ITIRAZ_DEGERLENDIRME",
  ISLEMDE: "ISLEMDE",
  RAPORLAMA: "RAPORLAMA",
  KAPANDI: "KAPANDI",
  REDDEDILDI: "REDDEDILDI",
  IPTAL: "IPTAL",
} as const;
export type Status = (typeof STATUS)[keyof typeof STATUS];

export const STATUS_LABEL: Record<Status, string> = {
  YENI: "Yeni kayıt — ekip bekleniyor",
  YONLENDIRILDI: "Yönlendirildi",
  INCELEMEDE: "İnceleme ve belge toplama",
  KARAR_VERILDI: "Karar verildi",
  ITIRAZ_DEGERLENDIRME: "İtiraz değerlendirmede",
  ISLEMDE: "İade / değişim sürüyor",
  RAPORLAMA: "Resmî yazı ve bilgilendirme",
  KAPANDI: "Kapandı",
  REDDEDILDI: "Haksız bulundu",
  IPTAL: "İptal",
};

/** Müşteriye gösterilen sadeleştirilmiş durum metni. */
export const STATUS_PUBLIC_LABEL: Record<Status, string> = {
  YENI: "Şikâyetiniz alındı, inceleme ekibi oluşturuluyor",
  YONLENDIRILDI: "Size daha yakın fabrikaya yönlendirildi",
  INCELEMEDE: "İnceleme ve analiz sürüyor",
  KARAR_VERILDI: "İnceleme tamamlandı, karar verildi",
  ITIRAZ_DEGERLENDIRME: "Genel Müdürlük değerlendirmesinde",
  ISLEMDE: "İade / değişim işlemi yapılıyor",
  RAPORLAMA: "İşlem tamamlandı, bilgilendirme hazırlanıyor",
  KAPANDI: "Şikâyetiniz kapatıldı",
  REDDEDILDI: "İnceleme sonucu: şikâyet haklı bulunmadı",
  IPTAL: "Kayıt iptal edildi",
};

type ChipTone = "ink" | "info" | "warn" | "danger" | "ok" | "brand";

export const STATUS_TONE: Record<Status, ChipTone> = {
  YENI: "info",
  YONLENDIRILDI: "brand",
  INCELEMEDE: "brand",
  KARAR_VERILDI: "warn",
  ITIRAZ_DEGERLENDIRME: "danger",
  ISLEMDE: "brand",
  RAPORLAMA: "info",
  KAPANDI: "ok",
  REDDEDILDI: "ink",
  IPTAL: "ink",
};

/** Dosya kapandı mı (SLA sayacı durur). */
export const TERMINAL_STATUSES: Status[] = [STATUS.KAPANDI, STATUS.REDDEDILDI, STATUS.IPTAL];
export function isTerminal(s: string): boolean {
  return (TERMINAL_STATUSES as string[]).includes(s);
}

/** Açık dosya durumları — listelerde "açık dosyalar" filtresi. */
export const OPEN_STATUSES: Status[] = [
  STATUS.YENI, STATUS.YONLENDIRILDI, STATUS.INCELEMEDE,
  STATUS.KARAR_VERILDI, STATUS.ITIRAZ_DEGERLENDIRME, STATUS.ISLEMDE, STATUS.RAPORLAMA,
];

/** Durumun iş akışındaki sıra numarası — ilerleme çubuğu için. */
export const STATUS_STEP: Record<Status, number> = {
  YENI: 1, YONLENDIRILDI: 1, INCELEMEDE: 2,
  KARAR_VERILDI: 3, ITIRAZ_DEGERLENDIRME: 4, ISLEMDE: 4,
  RAPORLAMA: 5, KAPANDI: 6, REDDEDILDI: 6, IPTAL: 6,
};
export const TOTAL_STEPS = 6;

/* --- Başvuru kanalı (aylık tablo "Kayıt türü") ---------------------------- */

export const CHANNEL = {
  WEB: "WEB", TELEFON: "TELEFON", EPOSTA: "EPOSTA", YAZILI: "YAZILI", ELDEN: "ELDEN",
} as const;
export type Channel = (typeof CHANNEL)[keyof typeof CHANNEL];

export const CHANNEL_LABEL: Record<Channel, string> = {
  WEB: "İnternet sitesi",
  TELEFON: "Telefon",
  EPOSTA: "E-posta",
  YAZILI: "Yazılı dilekçe",
  ELDEN: "Elden başvuru",
};

/* --- Şikâyetçi talebi ----------------------------------------------------- */

export const DEMAND = {
  IADE: "IADE",
  DEGISIM: "DEGISIM",
  IADE_NAKLIYE: "IADE_NAKLIYE",
  DEGISIM_NAKLIYE: "DEGISIM_NAKLIYE",
  BILGI: "BILGI",
  DIGER: "DIGER",
} as const;
export type Demand = (typeof DEMAND)[keyof typeof DEMAND];

export const DEMAND_LABEL: Record<Demand, string> = {
  IADE: "Ürünün iadesi",
  DEGISIM: "Ürünün değişimi",
  IADE_NAKLIYE: "Ürünün iadesi + nakliye bedeli",
  DEGISIM_NAKLIYE: "Ürünün değişimi + nakliye bedeli",
  BILGI: "Yalnızca bilgi / şikâyet bildirimi",
  DIGER: "Diğer",
};

/** Nakliye bedeli talep ediliyor mu (TL PASAT 004 md. 6-b). */
export function demandIncludesFreight(d: string): boolean {
  return d === DEMAND.IADE_NAKLIYE || d === DEMAND.DEGISIM_NAKLIYE;
}
/** İade mi değişim mi. */
export function demandIsExchange(d: string): boolean {
  return d === DEMAND.DEGISIM || d === DEMAND.DEGISIM_NAKLIYE;
}

/* --- Ürün grupları -------------------------------------------------------- */

export const PRODUCT_GROUP = {
  PAKETLI_SEKER: "PAKETLI_SEKER",
  DOKME_SEKER: "DOKME_SEKER",
  MELAS: "MELAS",
  POSA: "POSA",
} as const;
export type ProductGroup = (typeof PRODUCT_GROUP)[keyof typeof PRODUCT_GROUP];

export const PRODUCT_GROUP_LABEL: Record<ProductGroup, string> = {
  PAKETLI_SEKER: "Paketli şeker",
  DOKME_SEKER: "Dökme / çuvallı şeker",
  MELAS: "Melas",
  POSA: "Küspe / posa",
};

/* --- Karar ---------------------------------------------------------------- */

export const VERDICT = { HAKLI: "HAKLI", HAKSIZ: "HAKSIZ" } as const;
export type Verdict = (typeof VERDICT)[keyof typeof VERDICT];
export const VERDICT_LABEL: Record<Verdict, string> = {
  HAKLI: "Şikâyet haklı",
  HAKSIZ: "Şikâyet haklı bulunmadı",
};

/* --- Belge türleri -------------------------------------------------------- */

export const DOC_TYPE = { FR_PASAT_007: "FR_PASAT_007" } as const;
export type DocType = (typeof DOC_TYPE)[keyof typeof DOC_TYPE];

export const DOC_TYPE_LABEL: Record<DocType, string> = {
  FR_PASAT_007: "Müşteri Şikâyet Formu",
};

export const DOC_TYPE_CODE: Record<DocType, string> = {
  FR_PASAT_007: "FR PASAT 007",
};

export const DOC_STATUS = { ONAYLANDI: "ONAYLANDI", IPTAL: "IPTAL" } as const;
export type DocStatus = (typeof DOC_STATUS)[keyof typeof DOC_STATUS];

/* --- Görev durumu --------------------------------------------------------- */

export const TASK_STATUS = {
  BEKLEMEDE: "BEKLEMEDE", DEVAM_EDIYOR: "DEVAM_EDIYOR",
  TAMAMLANDI: "TAMAMLANDI", GEREKSIZ: "GEREKSIZ",
} as const;
export type TaskStatus = (typeof TASK_STATUS)[keyof typeof TASK_STATUS];
export const TASK_STATUS_LABEL: Record<TaskStatus, string> = {
  BEKLEMEDE: "Beklemede",
  DEVAM_EDIYOR: "Devam ediyor",
  TAMAMLANDI: "Tamamlandı",
  GEREKSIZ: "Gerek yok",
};

/* --- Ek türleri ----------------------------------------------------------- */

/*
 * Ek türleri aşama kodlarıyla aynı adı taşır: her kilometre taşı bir belge
 * yüklenerek kapandığı için ek, hangi aşamanın belgesi olduğunu kendi üzerinde
 * taşır. KANIT müşterinin başvuruda ilettiği görsel/belge, DIGER serbest ektir.
 */
export const ATTACHMENT_KIND = {
  KANIT: "KANIT",
  INCELEME: "INCELEME",
  KARAR: "KARAR",
  ITIRAZ: "ITIRAZ",
  DAIRE_KARAR: "DAIRE_KARAR",
  ISLEM: "ISLEM",
  RESMI_YAZI: "RESMI_YAZI",
  DIGER: "DIGER",
} as const;
export type AttachmentKind = (typeof ATTACHMENT_KIND)[keyof typeof ATTACHMENT_KIND];
export const ATTACHMENT_KIND_LABEL: Record<AttachmentKind, string> = {
  KANIT: "Müşterinin ilettiği kanıt",
  INCELEME: "İnceleme tutanağı / analiz raporu",
  KARAR: "İmzalı karar tutanağı",
  ITIRAZ: "Daire Başkanlığına üst yazı",
  DAIRE_KARAR: "Daire Başkanlığı karar yazısı",
  ISLEM: "İade / değişim / nakliye belgesi",
  RESMI_YAZI: "Resmî yazı ve müşteri bilgilendirmesi",
  DIGER: "Diğer belge",
};

/* --- Daire başkanlıkları -------------------------------------------------- */

export const DEPT = {
  PAZARLAMA_SATIS: "PAZARLAMA_SATIS",
  PERAKENDE_LOJISTIK: "PERAKENDE_LOJISTIK",
  SEKER_URETIM: "SEKER_URETIM",
  MALI_ISLER: "MALI_ISLER",
  STRATEJI: "STRATEJI",
} as const;
export type DeptCode = (typeof DEPT)[keyof typeof DEPT];

/* --- İtiraz eşikleri (TL PASAT 004 md. 5) --------------------------------- */
/** Şikâyet haksız bulunduğunda bu miktarları aşan dosyalar Daire Başkanlığına
 *  gönderilir. Değerler kilogram cinsindendir. */
export const ESCALATION_THRESHOLD_KG: Record<ProductGroup, number> = {
  DOKME_SEKER: 50_000,      // 50 ton şeker
  PAKETLI_SEKER: 50_000,    // 50 ton şeker
  POSA: 1_000_000,          // 1000 ton paketli posa
  MELAS: 30_000,            // 30 ton melas
};

export const ESCALATION_THRESHOLD_TEXT: Record<ProductGroup, string> = {
  DOKME_SEKER: "50 ton ve üzeri şeker",
  PAKETLI_SEKER: "50 ton ve üzeri şeker",
  POSA: "1.000 ton ve üzeri paketli posa",
  MELAS: "30 ton ve üzeri melas",
};

/* --- SLA gün sayıları (iş günü) ------------------------------------------- */

export const SLA = {
  /** Ekip oluşturma veya yönlendirme: şikâyet tarihinden +1 iş günü (md. 2) */
  EKIP: 1,
  /** İnceleme, analiz ve tutanak: şikâyet tarihinden +3 iş günü (md. 4) */
  INCELEME: 3,
  /** İade / değişim / nakliye ödemesi: şikâyet tarihinden +5 iş günü (md. 6) */
  ISLEM: 5,
  /** Resmî yazı dağıtımı: işlem tarihinden +3 iş günü (md. 6) */
  RESMI_YAZI: 3,
  /** Daire Başkanlığı itiraz kararı: itiraz tarihinden +5 iş günü (md. 5) */
  ITIRAZ: 5,
} as const;
