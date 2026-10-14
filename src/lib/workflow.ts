/* ===========================================================================
   İş kuralları motoru — TL PASAT 004 "Müşteri Şikâyetlerinde Uygulamalar"
   Görev kartı kataloğu, imza zincirleri, itiraz eşikleri, daire yönlendirmesi.
   =========================================================================== */

import { PERMISSIONS, ROLES, type Permission, type Role } from "./roles";
import {
  DEPT, DOC_TYPE, ESCALATION_THRESHOLD_KG, PRODUCT_GROUP, SLA, STATUS, TASK_STATUS,
  demandIncludesFreight, demandIsExchange,
  type DeptCode, type DocType, type ProductGroup, type Status,
} from "./domain";

/* --- Görev kartı kataloğu ------------------------------------------------- */

export const TASK = {
  EKIP_KUR: "EKIP_KUR",
  YERINDE_INCELEME: "YERINDE_INCELEME",
  NUMUNE_AL: "NUMUNE_AL",
  ANALIZ_GIR: "ANALIZ_GIR",
  TUTANAK_HAZIRLA: "TUTANAK_HAZIRLA",
  TUTANAK_IMZA: "TUTANAK_IMZA",
  CAPA_BASLAT: "CAPA_BASLAT",
  ITIRAZ_GONDER: "ITIRAZ_GONDER",
  DAIRE_KARAR: "DAIRE_KARAR",
  IADE_DEGISIM: "IADE_DEGISIM",
  NAKLIYE_ODEME: "NAKLIYE_ODEME",
  RESMI_YAZI: "RESMI_YAZI",
  MUSTERI_BILGI: "MUSTERI_BILGI",
  DOSYA_KAPAT: "DOSYA_KAPAT",
} as const;
export type TaskCode = (typeof TASK)[keyof typeof TASK];

/** Görevin son tarihinin hangi SLA kilometre taşından geleceği. */
export type DueSource = "EKIP" | "INCELEME" | "ISLEM" | "RESMI_YAZI" | "ITIRAZ" | "YOK";

export interface TaskTemplate {
  code: TaskCode;
  title: string;
  description: string;
  /** Görevin varsayılan sorumlusunun unvanı; görev bu role atanır. */
  role: Role;
  /**
   * Görevi işleyebilmek için gereken yetki. Yetki yalnızca "bu göreve kim
   * atanabilir" sorusunu yanıtlar; işi fiilen yapma hakkı görevin üzerindeki
   * kişidedir (bkz. requireTaskTurn).
   */
  permission: Permission;
  /**
   * Bu adımdan önce tamamlanmış olması gereken adımlar. Dosyada bulunmayan
   * öncül (ör. haksız dalda iade/değişim) sağlanmış sayılır; böylece tek bir
   * bağımlılık grafiği bütün dalları karşılar.
   */
  dependsOn: TaskCode[];
  dueSource: DueSource;
  sortOrder: number;
  /** Dayanak madde — arayüzde gösterilir. */
  basis: string;
}

export const TASK_CATALOG: Record<TaskCode, TaskTemplate> = {
  EKIP_KUR: {
    code: "EKIP_KUR",
    title: "İnceleme ekibini oluştur veya dosyayı yönlendir",
    description:
      "Şikâyet tarihinden itibaren en geç 1 iş günü içinde Kalite ve İşletme Kontrol, " +
      "Teknik (İşletme), Muhasebe ve Ziraat birimlerinden uygun görülen personel ile ekip " +
      "oluşturulur. Firma adresine daha yakın bir fabrikamız varsa dosya o fabrikaya yönlendirilir.",
    role: ROLES.FABRIKA_MUDURU,
    permission: PERMISSIONS.EKIP_YONET,
    dependsOn: [],
    dueSource: "EKIP",
    sortOrder: 10,
    basis: "TL PASAT 004 md. 2-3",
  },
  YERINDE_INCELEME: {
    code: "YERINDE_INCELEME",
    title: "Şikâyetçi firmada yerinde inceleme yap",
    description:
      "Ekip, şikâyetin mahiyetine göre en geç 3 iş günü içinde şikâyetçi firmaya gider. " +
      "Yerinde inceleme yapılamıyorsa ürün görselleri üzerinden inceleme yapılır ve gerekçesi " +
      "tutanakta belirtilir.",
    role: ROLES.KALITE_SORUMLUSU,
    permission: PERMISSIONS.INCELEME_GIR,
    dependsOn: [TASK.EKIP_KUR],
    dueSource: "INCELEME",
    sortOrder: 20,
    basis: "TL PASAT 004 md. 4",
  },
  NUMUNE_AL: {
    code: "NUMUNE_AL",
    title: "Numune al ve kayda geç",
    description:
      "Gerektiğinde numune alınır; numune numarası, alınma tarihi, parti/lot bilgisi ve " +
      "miktar kayda geçirilir.",
    role: ROLES.KALITE_SORUMLUSU,
    permission: PERMISSIONS.INCELEME_GIR,
    dependsOn: [TASK.YERINDE_INCELEME],
    dueSource: "INCELEME",
    sortOrder: 30,
    basis: "TL PASAT 004 md. 4",
  },
  ANALIZ_GIR: {
    code: "ANALIZ_GIR",
    title: "Laboratuvar analiz sonucunu gir",
    description:
      "Kalite ve İşletme Kontrol Laboratuvarı numune alınan gün, mümkün olmazsa takip eden " +
      "iş günü analizi yapar; sonuç analiz raporu ile birlikte kayda geçirilir.",
    role: ROLES.LABORATUVAR,
    permission: PERMISSIONS.ANALIZ_GIR,
    dependsOn: [TASK.NUMUNE_AL],
    dueSource: "INCELEME",
    sortOrder: 40,
    basis: "TL PASAT 004 md. 4",
  },
  TUTANAK_HAZIRLA: {
    code: "TUTANAK_HAZIRLA",
    title: "İnceleme tutanağını düzenle",
    description:
      "İnceleme ve analiz sonucu en geç 3 iş günü içinde tutanak altına alınır. Analiz " +
      "alınmamışsa gerekçesi tutanakta belirtilir.",
    role: ROLES.KALITE_SORUMLUSU,
    permission: PERMISSIONS.BELGE_HAZIRLA,
    dependsOn: [TASK.YERINDE_INCELEME, TASK.ANALIZ_GIR],
    dueSource: "INCELEME",
    sortOrder: 50,
    basis: "TL PASAT 004 md. 4",
  },
  TUTANAK_IMZA: {
    code: "TUTANAK_IMZA",
    title: "Tutanak imza zincirini tamamla",
    description:
      "Ambar Şefi, Satışı Yapan Birim Şefi, Kalite ve İşletme Kontrol Müdür Yardımcısı, " +
      "Fabrika Müdür Yardımcıları (Teknik/Ziraat ve İdari) imzalar; Fabrika Müdürü onaylar.",
    role: ROLES.KALITE_SORUMLUSU,
    permission: PERMISSIONS.BELGE_HAZIRLA,
    dependsOn: [TASK.TUTANAK_HAZIRLA],
    dueSource: "INCELEME",
    sortOrder: 60,
    basis: "FR PASAT 004 / FR PASAT 005",
  },
  CAPA_BASLAT: {
    code: "CAPA_BASLAT",
    title: "FSSC 22000 düzeltici faaliyeti başlat",
    description:
      "Tutanaklar Fabrika Müdürünün onayından sonra Gıda Güvenliği Ekibi, FSSC 22000 Gıda " +
      "Güvenliği Yönetim Sistemi kapsamında gerekli düzeltici faaliyeti başlatır.",
    role: ROLES.KALITE_SORUMLUSU,
    permission: PERMISSIONS.BELGE_HAZIRLA,
    dependsOn: [TASK.TUTANAK_IMZA],
    dueSource: "ISLEM",
    sortOrder: 80,
    basis: "TL PASAT 004 md. 4",
  },
  ITIRAZ_GONDER: {
    code: "ITIRAZ_GONDER",
    title: "İtirazı ilgili Daire Başkanlığına gönder",
    description:
      "Şikâyet haklı bulunmadığı ve miktar eşiği aşıldığı durumda müşteri itirazı ilgili " +
      "Daire Başkanlığına gönderilir.",
    role: ROLES.FABRIKA_MUDURU,
    permission: PERMISSIONS.ITIRAZ_GONDER,
    dependsOn: [TASK.TUTANAK_IMZA],
    dueSource: "ISLEM",
    sortOrder: 90,
    basis: "TL PASAT 004 md. 5",
  },
  DAIRE_KARAR: {
    code: "DAIRE_KARAR",
    title: "Daire Başkanlığı itiraz kararını ver",
    description:
      "İlgili Daire Başkanlığı, itirazın yapıldığı tarihten itibaren 5 iş günü içinde itirazı " +
      "değerlendirir ve karar verir.",
    role: ROLES.GM_DAIRE,
    permission: PERMISSIONS.ITIRAZ_KARAR,
    dependsOn: [TASK.ITIRAZ_GONDER],
    dueSource: "ITIRAZ",
    sortOrder: 100,
    basis: "TL PASAT 004 md. 5",
  },
  IADE_DEGISIM: {
    code: "IADE_DEGISIM",
    title: "İade / değişim işlemini gerçekleştir",
    description:
      "Müşteri memnuniyeti çerçevesinde, şikâyet tarihinden itibaren 5 iş günü içinde ürünün " +
      "iadesi alınır veya değişimi gerçekleştirilir.",
    role: ROLES.AMBAR_SEFI,
    permission: PERMISSIONS.ISLEM_GIR,
    dependsOn: [TASK.TUTANAK_IMZA],
    dueSource: "ISLEM",
    sortOrder: 110,
    basis: "TL PASAT 004 md. 6-a/b",
  },
  NAKLIYE_ODEME: {
    code: "NAKLIYE_ODEME",
    title: "Nakliye bedelini öde",
    description:
      "Kusurun fabrikadan kaynaklandığı tespit edildiğinden, firmanın geliş-gidiş nakliye " +
      "masrafları şikâyet tarihinden itibaren 5 iş günü içinde ödenir.",
    role: ROLES.MUHASEBE,
    permission: PERMISSIONS.ISLEM_GIR,
    dependsOn: [TASK.IADE_DEGISIM],
    dueSource: "ISLEM",
    sortOrder: 120,
    basis: "TL PASAT 004 md. 6-b",
  },
  RESMI_YAZI: {
    code: "RESMI_YAZI",
    title: "Resmî yazı ve eklerini Daire Başkanlıklarına gönder",
    description:
      "Şikâyet formu, analiz raporları, tutanaklar ve yapılan işlemlerin sonucu, iade/değişim " +
      "tarihinden itibaren 3 iş günü içinde ilgili Daire Başkanlıklarına PDF ekleriyle iletilir.",
    role: ROLES.KALITE_SORUMLUSU,
    permission: PERMISSIONS.RESMI_YAZI,
    dependsOn: [TASK.IADE_DEGISIM],
    dueSource: "RESMI_YAZI",
    sortOrder: 130,
    basis: "TL PASAT 004 md. 6",
  },
  MUSTERI_BILGI: {
    code: "MUSTERI_BILGI",
    title: "Müşteri Bilgilendirme Formunu gönder",
    description:
      "Fabrika tarafından yapılan işlemler Müşteri Bilgilendirme Formunun açıklama kısmına " +
      "yazılarak müşteriye gönderilir ve gerekli bilgilendirmeler yapılır.",
    role: ROLES.KALITE_SORUMLUSU,
    permission: PERMISSIONS.BELGE_HAZIRLA,
    dependsOn: [TASK.TUTANAK_IMZA, TASK.RESMI_YAZI, TASK.DAIRE_KARAR],
    dueSource: "RESMI_YAZI",
    sortOrder: 140,
    basis: "TL PASAT 004 md. 7",
  },
  DOSYA_KAPAT: {
    code: "DOSYA_KAPAT",
    title: "Dosyayı kapat",
    description:
      "Tüm adımlar tamamlandıktan sonra dosya kapatılır ve aylık raporlama tablosuna işlenir.",
    role: ROLES.FABRIKA_MUDURU,
    permission: PERMISSIONS.SIKAYET_KAPAT,
    dependsOn: [TASK.MUSTERI_BILGI],
    dueSource: "RESMI_YAZI",
    sortOrder: 150,
    basis: "TL PASAT 004 md. 8",
  },
};

/** Şikâyet kaydedildiğinde hemen açılan görevler — süreç yol haritası. */
export function initialTaskCodes(labRequired: boolean): TaskCode[] {
  const codes: TaskCode[] = [TASK.EKIP_KUR, TASK.YERINDE_INCELEME];
  if (labRequired) codes.push(TASK.NUMUNE_AL, TASK.ANALIZ_GIR);
  codes.push(TASK.TUTANAK_HAZIRLA, TASK.TUTANAK_IMZA);
  return codes;
}

/** Karar verildikten sonra açılan dal görevleri. */
export function postVerdictTaskCodes(opts: {
  verdict: "HAKLI" | "HAKSIZ";
  demand: string;
  isCritical: boolean;
  needsEscalation: boolean;
}): TaskCode[] {
  const codes: TaskCode[] = [];
  if (opts.verdict === "HAKLI") {
    codes.push(TASK.CAPA_BASLAT);
    if (opts.demand !== "BILGI") codes.push(TASK.IADE_DEGISIM);
    if (demandIncludesFreight(opts.demand)) codes.push(TASK.NAKLIYE_ODEME);
    codes.push(TASK.RESMI_YAZI, TASK.MUSTERI_BILGI, TASK.DOSYA_KAPAT);
  } else {
    if (opts.isCritical) codes.push(TASK.CAPA_BASLAT);
    if (opts.needsEscalation) codes.push(TASK.ITIRAZ_GONDER, TASK.DAIRE_KARAR);
    codes.push(TASK.MUSTERI_BILGI, TASK.DOSYA_KAPAT);
  }
  return codes;
}

/* --- İtiraz eşiği ve daire yönlendirmesi (md. 5-6) ----------------------- */

export interface EscalationCheck {
  required: boolean;
  thresholdKg: number;
  quantityKg: number;
  departmentCode: DeptCode;
  reason: string;
}

/**
 * Şikâyet haksız bulunduğunda itirazın Daire Başkanlığına gönderilmesi gerekip
 * gerekmediğini belirler (TL PASAT 004 md. 5).
 */
export function checkEscalation(
  productGroup: string,
  quantityKg: number | null | undefined,
): EscalationCheck {
  const group = (productGroup as ProductGroup) ?? PRODUCT_GROUP.DOKME_SEKER;
  const threshold = ESCALATION_THRESHOLD_KG[group] ?? ESCALATION_THRESHOLD_KG.DOKME_SEKER;
  const qty = quantityKg ?? 0;
  const dept = escalationDepartment(group);
  const required = qty >= threshold;
  return {
    required,
    thresholdKg: threshold,
    quantityKg: qty,
    departmentCode: dept,
    reason: required
      ? `Şikâyete konu miktar (${(qty / 1000).toLocaleString("tr-TR")} ton) ` +
        `${(threshold / 1000).toLocaleString("tr-TR")} ton eşiğini aştığı için itiraz ` +
        `Daire Başkanlığına gönderilir.`
      : `Şikâyete konu miktar (${(qty / 1000).toLocaleString("tr-TR")} ton) ` +
        `${(threshold / 1000).toLocaleString("tr-TR")} ton eşiğinin altında olduğu için ` +
        `karar fabrika düzeyinde kesinleşir.`,
  };
}

/** İtirazı değerlendirecek daire: paketli şeker ise Perakende, değilse Pazarlama. */
export function escalationDepartment(productGroup: string): DeptCode {
  return productGroup === PRODUCT_GROUP.PAKETLI_SEKER
    ? DEPT.PERAKENDE_LOJISTIK
    : DEPT.PAZARLAMA_SATIS;
}

/**
 * Resmî yazının gönderileceği daireler (TL PASAT 004 md. 6 ve 8).
 * Ürün grubuna göre Pazarlama ve Satış ya da Perakende Satışlar ve Lojistik,
 * her iki halde de Şeker Üretim, Mali İşler ve Muhasebe, Strateji Geliştirme.
 */
export function letterRecipients(productGroup: string): DeptCode[] {
  return [
    escalationDepartment(productGroup),
    DEPT.SEKER_URETIM,
    DEPT.MALI_ISLER,
    DEPT.STRATEJI,
  ];
}

/* --- İmza zincirleri ----------------------------------------------------- */

export interface SignatureSlot {
  order: number;
  role: Role;
  /** Zincirde bu sırayı dolduramayan ama kabul edilen alternatif roller. */
  altRoles?: Role[];
  title: string;
  isApproval: boolean;
}

/** FR PASAT 004 ve FR PASAT 005 tutanaklarının imza sırası. */
const TUTANAK_CHAIN: SignatureSlot[] = [
  { order: 1, role: ROLES.AMBAR_SEFI, title: "Ambar Şefi", isApproval: false },
  { order: 2, role: ROLES.SATIS_BIRIM_SEFI, title: "Satışı Yapan Birim Şefi", isApproval: false },
  { order: 3, role: ROLES.KALITE_MUDUR_YRD, title: "Kalite ve İşletme Kontrol Md. Yrd.", isApproval: false },
  {
    order: 4,
    role: ROLES.MUDUR_YRD_TEKNIK,
    altRoles: [ROLES.MUDUR_YRD_ZIRAAT],
    title: "Fabrika Müdür Yrd. (Teknik veya Ziraat)",
    isApproval: false,
  },
  { order: 5, role: ROLES.MUDUR_YRD_IDARI, title: "Fabrika Müdür Yrd. (İdari)", isApproval: false },
  { order: 6, role: ROLES.FABRIKA_MUDURU, title: "Fabrika Müdürü (Onay)", isApproval: true },
];

export function signatureChain(docType: DocType): SignatureSlot[] {
  switch (docType) {
    case DOC_TYPE.FR_PASAT_004:
    case DOC_TYPE.FR_PASAT_005:
    case DOC_TYPE.INCELEME_TUTANAGI:
      return TUTANAK_CHAIN;
    case DOC_TYPE.FR_PASAT_007:
      return [
        { order: 1, role: ROLES.KALITE_SORUMLUSU, title: "Şikâyeti Alan / Kalite Sorumlusu", isApproval: false },
        { order: 2, role: ROLES.FABRIKA_MUDURU, title: "Fabrika Müdürü (Onay)", isApproval: true },
      ];
    case DOC_TYPE.MUSTERI_BILGILENDIRME:
      return [
        { order: 1, role: ROLES.KALITE_SORUMLUSU, title: "Düzenleyen / Kalite Sorumlusu", isApproval: false },
        { order: 2, role: ROLES.FABRIKA_MUDURU, title: "Fabrika Müdürü (Onay)", isApproval: true },
      ];
    default:
      return TUTANAK_CHAIN;
  }
}

/** Bir imza sırasını doldurmaya yetkili roller. */
export function rolesForSlot(slot: SignatureSlot): Role[] {
  return [slot.role, ...(slot.altRoles ?? [])];
}

/**
 * Düzenlenecek tutanak türü (TL PASAT 004 md. 4 ve 6).
 * - Şikâyet haklı + nakliye bedeli talebi var  -> FR PASAT 005
 * - Şikâyet haklı + yalnızca iade/değişim      -> FR PASAT 004
 * - Şikâyet haklı bulunmadı veya yalnızca bilgi talebi -> İnceleme Tutanağı
 *
 * Not: "İnceleme Tutanağı", haklı bulunmayan şikâyetlerde inceleme sonucunu ve
 * gerekçesini imza altına almak üzere eklenmiş kurum içi belgedir; talimatın
 * ekindeki iki tutanak yalnızca iade/değişim hallerini kapsar.
 */
export function tutanakTypeFor(demand: string, verdict: string): DocType {
  if (verdict !== "HAKLI" || demand === "BILGI") return DOC_TYPE.INCELEME_TUTANAGI;
  return demandIncludesFreight(demand) ? DOC_TYPE.FR_PASAT_005 : DOC_TYPE.FR_PASAT_004;
}

/* --- Durum geçişleri ----------------------------------------------------- */

/** Bir görev tamamlandığında dosyanın geçeceği durum. */
export function statusAfterTask(code: TaskCode, ctx: { verdict?: string | null }): Status | null {
  switch (code) {
    case TASK.EKIP_KUR: return STATUS.INCELEMEDE;
    case TASK.TUTANAK_HAZIRLA: return STATUS.TUTANAK_IMZADA;
    case TASK.ITIRAZ_GONDER: return STATUS.ITIRAZ_DEGERLENDIRME;
    case TASK.RESMI_YAZI: return STATUS.RAPORLAMA;
    case TASK.DOSYA_KAPAT:
      return ctx.verdict === "HAKSIZ" ? STATUS.REDDEDILDI : STATUS.KAPANDI;
    default: return null;
  }
}

/** Dosyanın o anki durumuna göre "sıradaki adım" özeti. */
export function nextStepHint(status: string): string {
  switch (status) {
    case STATUS.YENI: return "Fabrika Müdürü ekibi oluşturacak veya dosyayı daha yakın fabrikaya yönlendirecek.";
    case STATUS.YONLENDIRILDI: return "Dosya yönlendirilen fabrikada ekip kurulmayı bekliyor.";
    case STATUS.INCELEMEDE: return "Ekip yerinde inceleme ve analiz çalışmasını yürütüyor.";
    case STATUS.TUTANAK_IMZADA: return "Tutanak imza zinciri ve Fabrika Müdürü onayı bekleniyor.";
    case STATUS.ITIRAZ_DEGERLENDIRME: return "İlgili Daire Başkanlığı itirazı değerlendiriyor.";
    case STATUS.ISLEM_SURECINDE: return "İade / değişim ve varsa nakliye bedeli ödemesi yapılıyor.";
    case STATUS.RAPORLAMA: return "Resmî yazı dağıtımı ve müşteri bilgilendirmesi yapılıyor.";
    case STATUS.KAPANDI: return "Dosya kapandı.";
    case STATUS.REDDEDILDI: return "Şikâyet haklı bulunmadı, dosya kapandı.";
    case STATUS.IPTAL: return "Kayıt iptal edildi.";
    default: return "—";
  }
}

/** SLA kaynağından şikâyet üzerindeki son tarih alanını seçer. */
export function dueFieldFor(source: DueSource):
  | "due_team_at" | "due_inspection_at" | "due_resolution_at" | "due_report_at" | "escalation_due_at" | null {
  switch (source) {
    case "EKIP": return "due_team_at";
    case "INCELEME": return "due_inspection_at";
    case "ISLEM": return "due_resolution_at";
    case "RESMI_YAZI": return "due_report_at";
    case "ITIRAZ": return "escalation_due_at";
    default: return null;
  }
}

export const SLA_DAYS = SLA;
export { demandIncludesFreight, demandIsExchange };

/* --- Sıra bekçisi: hangi adım şu an işlenebilir? ------------------------- */

const SETTLED_TASK_STATUSES: readonly string[] = [
  TASK_STATUS.TAMAMLANDI,
  TASK_STATUS.GEREKSIZ,
];

/** Dosyadaki görevlerin kod → durum eşlemesi. */
export type TaskStatusMap = Record<string, string | undefined>;

export function toTaskStatusMap(
  tasks: readonly { code: string; status: string }[],
): TaskStatusMap {
  const map: TaskStatusMap = {};
  for (const t of tasks) map[t.code] = t.status;
  return map;
}

/**
 * Bu adımın sırasının gelmesi için tamamlanması gereken, hâlâ açık öncül
 * adımlar. Dosyada hiç bulunmayan öncül sağlanmış sayılır: haklı bulunmayan
 * dosyada iade/değişim adımı açılmadığı için müşteri bilgilendirmesi onu
 * beklemez.
 */
export function blockingPrerequisites(code: TaskCode, statuses: TaskStatusMap): TaskCode[] {
  const tpl = TASK_CATALOG[code];
  if (!tpl) return [];
  return tpl.dependsOn.filter((prev) => {
    const status = statuses[prev];
    if (status === undefined) return false;
    return !SETTLED_TASK_STATUSES.includes(status);
  });
}

/** Adımın sırası geldi mi (öncüllerinin tamamı kapanmış mı)? */
export function isTaskReady(code: TaskCode, statuses: TaskStatusMap): boolean {
  return blockingPrerequisites(code, statuses).length === 0;
}

/** Açık görevi olan adımlardan sırası gelmiş olanlar — "şu anki adım". */
export function currentTaskCodes(
  tasks: readonly { code: string; status: string }[],
): TaskCode[] {
  const statuses = toTaskStatusMap(tasks);
  return tasks
    .filter((t) => !SETTLED_TASK_STATUSES.includes(t.status))
    .map((t) => t.code as TaskCode)
    .filter((code) => TASK_CATALOG[code] && isTaskReady(code, statuses))
    .sort((a, b) => TASK_CATALOG[a].sortOrder - TASK_CATALOG[b].sortOrder);
}
