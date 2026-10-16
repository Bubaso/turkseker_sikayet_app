/* ===========================================================================
   Süreç aşamaları — sadeleştirilmiş model.

   Uygulama belge ÜRETMEZ. Tutanak, analiz raporu, resmî yazı ve bilgilendirme
   formu kurum dışında/elle hazırlanır, imzalanır ve yalnızca sonuç belgesi
   buraya yüklenir. Uygulamanın işi, her kilometre taşının ne zaman, kim
   tarafından ve hangi belgeyle kayda geçtiğini tutmak ve süreci izlenebilir
   kılmaktır.

   Dayanak: TL PASAT 004 "Müşteri Şikâyetlerinde Uygulamalar".
   =========================================================================== */

import { ROLES, type Role } from "./roles";
import { SLA, STATUS, type Status } from "./domain";

export const ASAMA = {
  EKIP: "EKIP",
  INCELEME: "INCELEME",
  KARAR: "KARAR",
  ITIRAZ: "ITIRAZ",
  DAIRE_KARAR: "DAIRE_KARAR",
  ISLEM: "ISLEM",
  RESMI_YAZI: "RESMI_YAZI",
  KAPANIS: "KAPANIS",
} as const;
export type AsamaKodu = (typeof ASAMA)[keyof typeof ASAMA];

export type SureKaynagi = "EKIP" | "INCELEME" | "ISLEM" | "RAPOR" | "ITIRAZ" | "YOK";

export interface Asama {
  kod: AsamaKodu;
  baslik: string;
  /** Grafik eksenleri ve dar sütunlar için kısa ad. */
  kisa: string;
  aciklama: string;
  /** Varsayılan sorumlu unvan. */
  rol: Role;
  /** Bu aşama bir belge yüklenerek kapanır mı? */
  belgeli: boolean;
  /** Yüklenecek belgenin ne olduğu — yükleme formunda gösterilir. */
  belgeAdi?: string;
  sure: SureKaynagi;
  sira: number;
  dayanak: string;
  /** Tamamlandığında dosyanın geçeceği durum. */
  durum: Status | null;
  /** Önce kapanması gereken aşamalar. Dosyada bulunmayan öncül sağlanmış sayılır. */
  oncul: AsamaKodu[];
}

export const ASAMALAR: Record<AsamaKodu, Asama> = {
  EKIP: {
    kod: "EKIP",
    baslik: "İnceleme ekibini oluştur",
    kisa: "Ekip oluşturma",
    aciklama:
      "Şikâyet tarihinden itibaren en geç 1 iş günü içinde inceleme ekibi görevlendirilir. " +
      "Firma adresine daha yakın bir fabrikamız varsa dosya oraya yönlendirilebilir.",
    rol: ROLES.FABRIKA_MUDURU,
    belgeli: false,
    sure: "EKIP",
    sira: 10,
    dayanak: "TL PASAT 004 md. 2-3",
    durum: STATUS.INCELEMEDE,
    oncul: [],
  },
  INCELEME: {
    kod: "INCELEME",
    baslik: "İnceleme ve analiz belgelerini yükle",
    kisa: "İnceleme",
    aciklama:
      "Yerinde (ya da ürün görselleri üzerinden) inceleme yapılır, gerekiyorsa numune alınıp " +
      "analiz ettirilir. İnceleme tutanağı ve varsa analiz raporu elde hazırlanır; buraya " +
      "yalnızca imzalı/kaşeli nüshası yüklenir.",
    rol: ROLES.KALITE_SORUMLUSU,
    belgeli: true,
    belgeAdi: "İnceleme tutanağı (varsa analiz raporuyla birlikte)",
    sure: "INCELEME",
    sira: 20,
    dayanak: "TL PASAT 004 md. 4",
    durum: STATUS.INCELEMEDE,
    oncul: ["EKIP"],
  },
  KARAR: {
    kod: "KARAR",
    baslik: "Kararı ve imzalı tutanağı yükle",
    kisa: "Karar tutanağı",
    aciklama:
      "Şikâyetin haklı bulunup bulunmadığı karara bağlanır. İmza süreci fabrikada elle " +
      "yürütülür; tamamlanan imzalı tutanağın son hâli buraya yüklenir ve karar işaretlenir.",
    rol: ROLES.KALITE_SORUMLUSU,
    belgeli: true,
    belgeAdi: "İmzaları tamamlanmış karar tutanağı",
    sure: "INCELEME",
    sira: 30,
    dayanak: "TL PASAT 004 md. 4",
    durum: STATUS.KARAR_VERILDI,
    oncul: ["INCELEME"],
  },
  ITIRAZ: {
    kod: "ITIRAZ",
    baslik: "İtirazı Daire Başkanlığına gönder",
    kisa: "İtiraz gönderimi",
    aciklama:
      "Şikâyet haklı bulunmadığı ve miktar eşiği aşıldığı için dosya ilgili Daire " +
      "Başkanlığının değerlendirmesine gönderilir.",
    rol: ROLES.FABRIKA_MUDURU,
    belgeli: true,
    belgeAdi: "Daire Başkanlığına gönderilen üst yazı",
    sure: "ISLEM",
    sira: 40,
    dayanak: "TL PASAT 004 md. 5",
    durum: STATUS.ITIRAZ_DEGERLENDIRME,
    oncul: ["KARAR"],
  },
  DAIRE_KARAR: {
    kod: "DAIRE_KARAR",
    baslik: "Daire Başkanlığı kararını kaydet",
    kisa: "Daire kararı",
    aciklama:
      "İlgili Daire Başkanlığı, itirazın yapıldığı tarihten itibaren 5 iş günü içinde " +
      "değerlendirir ve kararını kaydeder.",
    rol: ROLES.GM_DAIRE,
    belgeli: true,
    belgeAdi: "Daire Başkanlığı karar yazısı",
    sure: "ITIRAZ",
    sira: 50,
    dayanak: "TL PASAT 004 md. 5",
    durum: null,
    oncul: ["ITIRAZ"],
  },
  ISLEM: {
    kod: "ISLEM",
    baslik: "İade / değişim ve nakliye belgelerini yükle",
    kisa: "İade / değişim",
    aciklama:
      "Şikâyet tarihinden itibaren en geç 5 iş günü içinde ürünün iadesi alınır veya değişimi " +
      "yapılır; kusur fabrikadan kaynaklanıyorsa nakliye bedeli ödenir. İrsaliye, dekont ve " +
      "benzeri belgeler buraya yüklenir.",
    rol: ROLES.AMBAR_SEFI,
    belgeli: true,
    belgeAdi: "İade/değişim irsaliyesi, varsa nakliye ödeme dekontu",
    sure: "ISLEM",
    sira: 60,
    dayanak: "TL PASAT 004 md. 6",
    durum: STATUS.ISLEMDE,
    oncul: ["KARAR", "DAIRE_KARAR"],
  },
  RESMI_YAZI: {
    kod: "RESMI_YAZI",
    baslik: "Resmî yazıyı ve müşteri bilgilendirmesini yükle",
    kisa: "Resmî yazı",
    aciklama:
      "Şikâyet formu, tutanaklar ve yapılan işlemlerin sonucu ilgili Daire Başkanlıklarına " +
      "resmî yazıyla gönderilir; müşteriye bilgilendirme yapılır. Gönderilen yazı buraya " +
      "yüklenir ve Daire Başkanlıklarının gelen kutusunda görünür.",
    rol: ROLES.KALITE_SORUMLUSU,
    belgeli: true,
    belgeAdi: "Daire Başkanlıklarına gönderilen resmî yazı ve müşteri bilgilendirmesi",
    sure: "RAPOR",
    sira: 70,
    dayanak: "TL PASAT 004 md. 6-7",
    durum: STATUS.RAPORLAMA,
    // Dosyada bulunmayan öncül sağlanmış sayıldığı için aynı tanım üç dalda da
    // çalışır: haklı dosyada işlemi, itiraz dalında daire kararını bekler,
    // eşik altındaki haksız dosyada doğrudan sırası gelir.
    oncul: ["KARAR", "ITIRAZ", "DAIRE_KARAR", "ISLEM"],
  },
  KAPANIS: {
    kod: "KAPANIS",
    baslik: "Dosyayı kapat",
    kisa: "Dosya kapanışı",
    aciklama: "Tüm aşamalar tamamlandıktan sonra Fabrika Müdürü dosyayı kapatır.",
    rol: ROLES.FABRIKA_MUDURU,
    belgeli: false,
    sure: "RAPOR",
    sira: 80,
    dayanak: "TL PASAT 004 md. 8",
    durum: null,
    oncul: ["RESMI_YAZI"],
  },
};

/*
 * Evrak sorumlusuna düşen aşamalar.
 *
 * Fabrika Müdürü ekibi kurarken üyelerden birini evrak sorumlusu seçer ve
 * dosyanın fabrika tarafındaki bütün belgeli aşamaları o kişiye düşer: dosya
 * tek bir kişinin ekranında, tek bir elden yürür. Aşama aşama farklı kişilere
 * dağıtmak, kimsenin dosyanın tamamını izlemediği bir süreç üretiyordu.
 *
 * Dışarıda kalan üçünün sorumlusu tartışmasızdır: ekip kurma müdürün kendi
 * işi, daire kararı ilgili Daire Başkanlığının, dosya kapanışı ise sürecin
 * sonundaki müdür onayı.
 */
export const EVRAK_ASAMALARI: AsamaKodu[] = [
  ASAMA.INCELEME, ASAMA.KARAR, ASAMA.ITIRAZ, ASAMA.ISLEM, ASAMA.RESMI_YAZI,
];

/** Kayıt anında açılan aşamalar — dosyanın yol haritası. */
export function baslangicAsamalari(): AsamaKodu[] {
  return [ASAMA.EKIP, ASAMA.INCELEME, ASAMA.KARAR];
}

/** Karar kaydedildikten sonra açılan aşamalar. */
export function kararSonrasiAsamalar(opts: {
  hakli: boolean;
  itirazGerekir: boolean;
}): AsamaKodu[] {
  if (opts.hakli) return [ASAMA.ISLEM, ASAMA.RESMI_YAZI, ASAMA.KAPANIS];
  if (opts.itirazGerekir) return [ASAMA.ITIRAZ, ASAMA.DAIRE_KARAR, ASAMA.RESMI_YAZI, ASAMA.KAPANIS];
  return [ASAMA.RESMI_YAZI, ASAMA.KAPANIS];
}

/** Aşamanın son tarihinin okunacağı şikâyet alanı. */
export function sureAlani(k: SureKaynagi):
  | "due_team_at" | "due_inspection_at" | "due_resolution_at" | "due_report_at" | "escalation_due_at" | null {
  switch (k) {
    case "EKIP": return "due_team_at";
    case "INCELEME": return "due_inspection_at";
    case "ISLEM": return "due_resolution_at";
    case "RAPOR": return "due_report_at";
    case "ITIRAZ": return "escalation_due_at";
    default: return null;
  }
}

/* --- Sıra bekçisi --------------------------------------------------------- */

const KAPALI = ["TAMAMLANDI", "GEREKSIZ"];

export type AsamaDurumHaritasi = Record<string, string | undefined>;

export function durumHaritasi(
  satirlar: readonly { code: string; status: string }[],
): AsamaDurumHaritasi {
  const m: AsamaDurumHaritasi = {};
  for (const s of satirlar) m[s.code] = s.status;
  return m;
}

/** Sırası gelmesi için kapanması gereken, hâlâ açık öncül aşamalar. */
export function bekleyenOnculler(kod: AsamaKodu, harita: AsamaDurumHaritasi): AsamaKodu[] {
  const a = ASAMALAR[kod];
  if (!a) return [];
  return a.oncul.filter((o) => {
    const d = harita[o];
    if (d === undefined) return false;
    return !KAPALI.includes(d);
  });
}

export function sirasiGeldiMi(kod: AsamaKodu, harita: AsamaDurumHaritasi): boolean {
  return bekleyenOnculler(kod, harita).length === 0;
}

export { SLA };
