/* ===========================================================================
   Tutanak örnekleri.

   Uygulama belge üretmez; tutanak, üst yazı ve resmî yazı fabrikada elle
   hazırlanır, ıslak imzalanır ve yalnızca sonucu buraya yüklenir. Bu dosya o
   kuralı değiştirmez — yalnızca boş sayfayla başlamayı gereksiz kılar.

   Her belgeli aşama için, dosyanın bilinen bilgileri doldurulmuş bir örnek
   üretilir. Kullanıcı isterse yazdırıp elle tamamlar ve imzalatır, isterse
   hiç açmadan kendi belgesini yükler. Üretilen sayfa bir sistem belgesi
   değildir: belge numarası taşımaz, denetim izine yazılmaz ve dosyaya
   kendiliğinden eklenmez.

   Şablonlar veri olarak durur; çizim tek bir sayfada yapılır. Yeni bir aşama
   eklendiğinde buraya bir kayıt eklemek yeter.
   =========================================================================== */

import { ASAMA, type AsamaKodu } from "./asamalar";
import { DEMAND_LABEL, type Demand } from "./domain";
import { fmtDate } from "./dates";
import { fmtQuantity } from "./format";

export interface TutanakSatiri {
  etiket: string;
  deger: string;
}

export interface TutanakBolumu {
  baslik: string;
  /** Dosyadan gelen, önceden dolu satırlar. */
  satirlar?: TutanakSatiri[];
  /** Elle doldurulacak çizgili alan — kaç satırlık. */
  bosSatir?: number;
  /** Alanın ne yazılacağını söyleyen kılavuz metni (çıktıda soluk durur). */
  kilavuz?: string;
  /** İşaretlenecek seçenekler (kutucuklu). */
  secenekler?: string[];
}

export interface TutanakImzasi {
  unvan: string;
  ad: string;
}

export interface TutanakSablonu {
  baslik: string;
  /** Kurum doküman kodu karşılığı; yalnızca üstbilgide görünür. */
  kod: string;
  giris: string;
  bolumler: TutanakBolumu[];
  imzalar: TutanakImzasi[];
  /** Çıktının altına düşülen not. */
  dipnot?: string;
}

/** Şablonu kurmak için gereken dosya bilgileri. */
export interface TutanakVerisi {
  complaint_no: string;
  received_at: string;
  factory_name: string;
  customer_company: string;
  customer_name: string | null;
  customer_title: string | null;
  customer_address: string | null;
  customer_province: string | null;
  customer_phone: string;
  product_name: string;
  packaging: string | null;
  lot_no: string | null;
  quantity_kg: number | null;
  invoice_no: string | null;
  delivery_note_no: string | null;
  delivery_date: string | null;
  subject: string;
  description: string | null;
  demand: string;
  demands_freight: number;
  category_name: string | null;
  verdict: string | null;
  verdict_at: string | null;
  due_inspection_at: string | null;
  due_resolution_at: string | null;
  escalation_due_at: string | null;
  department_name: string | null;
  /** İnceleme ekibi — imza bloğunu kurar. */
  ekip: { full_name: string; title: string; is_lead: number }[];
  /** Bu aşamanın sorumlusu. */
  sorumlu: { full_name: string; title: string } | null;
  mudur: { full_name: string; title: string } | null;
}

const BOS = "……………………………………";

/** Dosyanın her tutanakta tekrar eden künyesi. */
function kunye(v: TutanakVerisi): TutanakSatiri[] {
  return [
    { etiket: "Şikâyet numarası", deger: v.complaint_no },
    { etiket: "Şikâyet tarihi", deger: fmtDate(v.received_at) },
    { etiket: "Müşteri", deger: v.customer_company },
    {
      etiket: "Yetkili",
      deger: [v.customer_name, v.customer_title].filter(Boolean).join(" — ") || BOS,
    },
    {
      etiket: "Adres / il",
      deger: [v.customer_address, v.customer_province].filter(Boolean).join(" · ") || BOS,
    },
    {
      etiket: "Ürün",
      deger: [v.product_name, v.packaging].filter(Boolean).join(" — "),
    },
    { etiket: "Parti / lot no", deger: v.lot_no ?? BOS },
    {
      etiket: "Şikâyete konu miktar",
      deger: v.quantity_kg ? fmtQuantity(v.quantity_kg) : BOS,
    },
    {
      etiket: "Fatura / irsaliye no",
      deger: [v.invoice_no, v.delivery_note_no].filter(Boolean).join(" / ") || BOS,
    },
    { etiket: "Teslim tarihi", deger: v.delivery_date ? fmtDate(v.delivery_date) : BOS },
  ];
}

/** Şikâyetin müşteri beyanı — incelemenin konusunu tekrar eder. */
function beyan(v: TutanakVerisi): TutanakSatiri[] {
  return [
    { etiket: "Şikâyet konusu", deger: v.subject },
    { etiket: "Şikâyet türü", deger: v.category_name ?? BOS },
    { etiket: "Müşteri talebi", deger: DEMAND_LABEL[v.demand as Demand] ?? v.demand },
    {
      etiket: "Nakliye bedeli talebi",
      deger: v.demands_freight === 1 ? "Var" : "Yok",
    },
  ];
}

/** İmza bloğu: ekip varsa ekip, yoksa sorumlu ve müdür. */
function ekipImzalari(v: TutanakVerisi): TutanakImzasi[] {
  if (v.ekip.length > 0) {
    return v.ekip.map((u) => ({
      unvan: u.is_lead === 1 ? `${u.title} (Ekip lideri)` : u.title,
      ad: u.full_name,
    }));
  }
  return [{ unvan: "İnceleme ekibi üyesi", ad: BOS }];
}

function sorumluImzasi(v: TutanakVerisi, unvanYedek: string): TutanakImzasi {
  return v.sorumlu
    ? { unvan: v.sorumlu.title, ad: v.sorumlu.full_name }
    : { unvan: unvanYedek, ad: BOS };
}

function mudurImzasi(v: TutanakVerisi): TutanakImzasi {
  return v.mudur
    ? { unvan: v.mudur.title, ad: v.mudur.full_name }
    : { unvan: "Fabrika Müdürü", ad: BOS };
}

/* --- Şablonlar ----------------------------------------------------------- */

export function tutanakSablonu(kod: AsamaKodu, v: TutanakVerisi): TutanakSablonu | null {
  switch (kod) {
    case ASAMA.INCELEME:
      return {
        baslik: "Şikâyet İnceleme Tutanağı",
        kod: "TL PASAT 004 md. 4",
        giris:
          `Aşağıda künyesi yazılı müşteri şikâyeti, ${v.factory_name} tarafından ` +
          `görevlendirilen inceleme ekibince incelenmiş ve tespitler bu tutanakla kayda ` +
          `geçirilmiştir.`,
        bolumler: [
          { baslik: "1. Şikâyet künyesi", satirlar: kunye(v) },
          { baslik: "2. Müşteri beyanı", satirlar: beyan(v) },
          {
            baslik: "3. İnceleme biçimi",
            secenekler: [
              "Müşteri işletmesinde yerinde inceleme",
              "Fabrikada şahit numune üzerinden inceleme",
              "Müşterinin ilettiği görseller üzerinden inceleme",
            ],
            satirlar: [
              { etiket: "İnceleme tarihi", deger: BOS },
              { etiket: "İnceleme yeri", deger: BOS },
            ],
          },
          {
            baslik: "4. Tespitler",
            kilavuz:
              "Ürünün alındığı andaki durumu, ambalaj bütünlüğü, depolama koşulları " +
              "(sıcaklık, nem, istif), görülen kusurun yaygınlığı ve ölçülen değerler.",
            bosSatir: 8,
          },
          {
            baslik: "5. Numune ve analiz",
            secenekler: ["Numune alındı", "Numune alınmadı"],
            satirlar: [
              { etiket: "Numune adedi / miktarı", deger: BOS },
              { etiket: "Analiz yapan laboratuvar", deger: BOS },
              { etiket: "Analiz rapor no / tarihi", deger: BOS },
            ],
            kilavuz: "Analiz raporu varsa bu tutanağa ek olarak sunulur.",
          },
          {
            baslik: "6. Değerlendirme",
            kilavuz:
              "Kusurun üretim, depolama, nakliye ya da kullanım kaynaklı olup olmadığı ve " +
              "dayanağı.",
            bosSatir: 5,
          },
        ],
        imzalar: ekipImzalari(v),
        dipnot:
          `Bu tutanak en geç ${v.due_inspection_at ? fmtDate(v.due_inspection_at) : BOS} ` +
          `tarihine kadar tamamlanır.`,
      };

    case ASAMA.KARAR:
      return {
        baslik: "Şikâyet Değerlendirme ve Karar Tutanağı",
        kod: "TL PASAT 004 md. 4",
        giris:
          `İnceleme tutanağı ve varsa analiz raporu değerlendirilerek, aşağıda künyesi ` +
          `yazılı şikâyet hakkında işbu karar alınmıştır.`,
        bolumler: [
          { baslik: "1. Şikâyet künyesi", satirlar: kunye(v) },
          {
            baslik: "2. İnceleme sonucu",
            kilavuz: "İnceleme tutanağındaki tespitlerin özeti.",
            bosSatir: 4,
          },
          {
            baslik: "3. Karar",
            secenekler: [
              "Şikâyet HAKLI bulunmuştur",
              "Şikâyet HAKLI BULUNMAMIŞTIR",
            ],
            kilavuz: "Kararın gerekçesi aşağıya yazılır.",
            bosSatir: 5,
          },
          {
            baslik: "4. Haklı bulunması hâlinde yapılacak işlem",
            secenekler: [
              "Ürünün iadesi alınacak",
              "Ürün değişimi yapılacak",
              "Nakliye bedeli ödenecek",
            ],
            satirlar: [
              { etiket: "İşlem miktarı", deger: BOS },
              {
                etiket: "En geç tamamlanma tarihi",
                deger: v.due_resolution_at ? fmtDate(v.due_resolution_at) : BOS,
              },
            ],
          },
        ],
        imzalar: [...ekipImzalari(v), mudurImzasi(v)],
        dipnot:
          "Şikâyet haklı bulunmazsa ve miktar eşiği aşılmışsa dosya ilgili Daire " +
          "Başkanlığının değerlendirmesine gönderilir.",
      };

    case ASAMA.ITIRAZ:
      return {
        baslik: "Daire Başkanlığına Üst Yazı",
        kod: "TL PASAT 004 md. 5",
        giris:
          `${v.factory_name} tarafından incelenen ve haklı bulunmayan aşağıdaki müşteri ` +
          `şikâyeti, miktar eşiği aşıldığından ` +
          `${v.department_name ?? "ilgili Daire Başkanlığının"} değerlendirmesine sunulmuştur.`,
        bolumler: [
          { baslik: "1. Şikâyet künyesi", satirlar: kunye(v) },
          { baslik: "2. Müşteri beyanı", satirlar: beyan(v) },
          {
            baslik: "3. Fabrika kararı ve gerekçesi",
            satirlar: [
              { etiket: "Karar", deger: "Şikâyet haklı bulunmamıştır" },
              { etiket: "Karar tarihi", deger: v.verdict_at ? fmtDate(v.verdict_at) : BOS },
            ],
            kilavuz: "Kararın dayandığı tespitler.",
            bosSatir: 5,
          },
          {
            baslik: "4. Ekler",
            secenekler: [
              "Müşteri Şikâyet Formu (FR PASAT 007)",
              "İnceleme tutanağı",
              "Analiz raporu",
              "Karar tutanağı",
            ],
          },
          {
            baslik: "5. Talep",
            kilavuz:
              "Daire Başkanlığından beklenen değerlendirme; gerekiyorsa görüş sorulan " +
              "hususlar.",
            bosSatir: 3,
          },
        ],
        imzalar: [mudurImzasi(v)],
        dipnot:
          `Daire Başkanlığı kararını en geç ` +
          `${v.escalation_due_at ? fmtDate(v.escalation_due_at) : "5 iş günü"} ` +
          `içinde bildirir.`,
      };

    case ASAMA.DAIRE_KARAR:
      return {
        baslik: "Daire Başkanlığı Karar Yazısı",
        kod: "TL PASAT 004 md. 5",
        giris:
          `${v.factory_name} tarafından değerlendirmeye sunulan aşağıdaki müşteri şikâyeti ` +
          `${v.department_name ?? "Daire Başkanlığımızca"} incelenmiş ve işbu karara ` +
          `bağlanmıştır.`,
        bolumler: [
          { baslik: "1. Şikâyet künyesi", satirlar: kunye(v) },
          {
            baslik: "2. Fabrika kararı",
            satirlar: [
              { etiket: "Fabrika kararı", deger: "Şikâyet haklı bulunmamıştır" },
              { etiket: "İtiraz tarihi", deger: BOS },
            ],
          },
          {
            baslik: "3. Daire Başkanlığı değerlendirmesi",
            kilavuz: "Dosya üzerinden yapılan inceleme ve dayanaklar.",
            bosSatir: 6,
          },
          {
            baslik: "4. Karar",
            secenekler: [
              "Şikâyet HAKLIDIR — iade/değişim süreci başlatılır",
              "Fabrika kararı YERİNDEDİR — dosya müşteriye yazılı bildirimle kapatılır",
            ],
          },
        ],
        imzalar: [{ unvan: v.department_name ?? "Daire Başkanı", ad: BOS }],
      };

    case ASAMA.ISLEM:
      return {
        baslik: "İade / Değişim ve Nakliye Tutanağı",
        kod: "TL PASAT 004 md. 6",
        giris:
          `Haklı bulunan aşağıdaki şikâyet için yapılan iade/değişim işlemi ve varsa ` +
          `nakliye bedeli ödemesi bu tutanakla kayda geçirilmiştir.`,
        bolumler: [
          { baslik: "1. Şikâyet künyesi", satirlar: kunye(v) },
          {
            baslik: "2. Yapılan işlem",
            secenekler: ["Ürün iadesi alındı", "Ürün değişimi yapıldı"],
            satirlar: [
              { etiket: "İşlem tarihi", deger: BOS },
              { etiket: "İade alınan miktar", deger: BOS },
              { etiket: "Değişim yapılan miktar", deger: BOS },
              { etiket: "İade/değişim irsaliye no", deger: BOS },
              { etiket: "İade bedeli (TL)", deger: BOS },
            ],
          },
          {
            baslik: "3. Nakliye bedeli",
            secenekler: [
              "Kusur fabrika kaynaklıdır, nakliye bedeli ödenmiştir",
              "Nakliye bedeli talep edilmemiştir",
            ],
            satirlar: [
              { etiket: "Ödenen tutar (TL)", deger: BOS },
              { etiket: "Dekont / ödeme belgesi no", deger: BOS },
            ],
          },
          {
            baslik: "4. Teslim / tesellüm",
            kilavuz:
              "Ürünün müşteriden teslim alındığı ya da yenisinin teslim edildiği yer, " +
              "araç ve teslim alan kişi.",
            bosSatir: 4,
          },
        ],
        imzalar: [
          sorumluImzasi(v, "Ambar Şefi"),
          { unvan: "Müşteri yetkilisi", ad: v.customer_name ?? BOS },
          mudurImzasi(v),
        ],
        dipnot:
          `İşlem en geç ${v.due_resolution_at ? fmtDate(v.due_resolution_at) : BOS} ` +
          `tarihine kadar tamamlanır.`,
      };

    case ASAMA.RESMI_YAZI:
      return {
        baslik: "Resmî Yazı ve Müşteri Bilgilendirmesi",
        kod: "TL PASAT 004 md. 6-7",
        giris:
          `Aşağıda künyesi yazılı müşteri şikâyeti sonuçlandırılmış; şikâyet formu, ` +
          `tutanaklar ve yapılan işlemler ilgili Daire Başkanlıklarına bu yazıyla ` +
          `bildirilmiştir. Müşteriye de aynı içerikle bilgi verilmiştir.`,
        bolumler: [
          { baslik: "1. Şikâyet künyesi", satirlar: kunye(v) },
          { baslik: "2. Müşteri beyanı", satirlar: beyan(v) },
          {
            baslik: "3. Sonuç",
            satirlar: [
              {
                etiket: "Karar",
                deger:
                  v.verdict === "HAKLI" ? "Şikâyet haklı bulunmuştur"
                    : v.verdict === "HAKSIZ" ? "Şikâyet haklı bulunmamıştır"
                    : BOS,
              },
              { etiket: "Karar tarihi", deger: v.verdict_at ? fmtDate(v.verdict_at) : BOS },
            ],
            kilavuz: "Yapılan inceleme, kusurun kaynağı ve uygulanan işlem özeti.",
            bosSatir: 6,
          },
          {
            baslik: "4. Alınan düzeltici / önleyici tedbirler",
            kilavuz:
              "Aynı kusurun tekrarını önlemek için üretim, depolama veya sevkiyatta " +
              "alınan tedbirler.",
            bosSatir: 5,
          },
          {
            baslik: "5. Dağıtım",
            secenekler: [
              "Pazarlama Daire Başkanlığı",
              "Şeker Üretim Daire Başkanlığı",
              "Mali İşler Daire Başkanlığı",
              "Strateji Geliştirme Daire Başkanlığı",
              "Müşteri",
            ],
          },
        ],
        imzalar: [sorumluImzasi(v, "Kalite Sorumlusu"), mudurImzasi(v)],
      };

    default:
      return null;
  }
}

/** Bu aşamanın bir tutanak örneği var mı? */
export function tutanakVarMi(kod: AsamaKodu): boolean {
  return ([
    ASAMA.INCELEME, ASAMA.KARAR, ASAMA.ITIRAZ,
    ASAMA.DAIRE_KARAR, ASAMA.ISLEM, ASAMA.RESMI_YAZI,
  ] as AsamaKodu[]).includes(kod);
}
