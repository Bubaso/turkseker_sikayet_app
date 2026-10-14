import Link from "next/link";
import { scalar } from "@/lib/db";
import { PublicShell } from "@/components/public-shell";
import { Notice } from "@/components/ui";
import { SurecSeridi, type SurecAdimi } from "@/components/surec-seridi";

export const dynamic = "force-dynamic";

/*
 * Ana sayfadaki süreç özeti, müşteri takip sayfasındaki şeritle aynı bileşeni
 * ve aynı başlıkları kullanır: müşteri başvurmadan önce burada gördüğü resmi,
 * başvurduktan sonra takip sayfasında tanır. Adım metinleri kurum unvanlarıyla
 * değil, müşterinin başına gelenle yazılmıştır.
 */
const SURECTE_ADIMLAR: SurecAdimi[] = [
  {
    baslik: "Şikâyetiniz kaydedilir",
    zaman: "Anında",
    durum: "bekliyor",
    aciklama:
      "Şikâyet numaranız SMS ile gönderilir; süreci baştan sona bu numarayla takip edebilirsiniz.",
  },
  {
    baslik: "İnceleme ekibi görevlendirilir",
    zaman: "1. iş günü",
    durum: "bekliyor",
    aciklama:
      "Adresinize daha yakın bir fabrikamız varsa dosyanız incelenmek üzere oraya yönlendirilir; " +
      "bu da size bildirilir.",
  },
  {
    baslik: "Ürününüz incelenir",
    zaman: "3. iş günü",
    durum: "bekliyor",
    aciklama:
      "Ekip işletmenize gelir ve gerekirse numune alır. Yerinde inceleme yapılamazsa ürününüz, " +
      "ilettiğiniz görseller üzerinden incelenir.",
    sizden:
      "Şikâyete konu ürünü, inceleme tamamlanana kadar tüketmeden ve ambalajını bozmadan saklayın.",
  },
  {
    baslik: "İnceleme sonuçlanır",
    zaman: "3. iş günü",
    durum: "bekliyor",
    aciklama:
      "Şikâyetinizin haklı bulunup bulunmadığı karara bağlanır ve sonuç size SMS ile bildirilir.",
  },
  {
    baslik: "Sonuç uygulanır",
    zaman: "5. iş günü",
    durum: "bekliyor",
    dallar: [
      {
        ton: "ok",
        baslik: "Şikâyetiniz haklı bulunursa",
        aciklama:
          "Ürünün iadesi alınır veya değişimi yapılır. Nakliye bedeli talep ettiyseniz ve kusur " +
          "fabrikamızdan kaynaklanıyorsa geliş-gidiş nakliye masrafınız ödenir.",
      },
      {
        ton: "ink",
        baslik: "Haklı bulunmazsa",
        aciklama:
          "İnceleme sonucu ve gerekçesi size yazılı olarak bildirilir. Şikâyete konu miktar " +
          "belirli bir eşiğin üzerindeyse dosyanız ayrıca Genel Müdürlüğümüzce yeniden " +
          "değerlendirilir; bu değerlendirme 5 iş günü sürer.",
      },
    ],
  },
  {
    baslik: "Dosyanız kapatılır",
    zaman: "İşlemden +3 iş günü",
    durum: "bekliyor",
    aciklama:
      "Yapılan işlemlerin tamamı yazılı olarak tarafınıza iletilir ve dosyanız kapatılır.",
  },
];

export default function HomePage() {
  const factoryCount = scalar<number>("SELECT COUNT(*) FROM factories WHERE is_active = 1") ?? 0;
  const seeded = factoryCount > 0;

  return (
    <PublicShell>
      <div className="space-y-5">
        {/* Giriş kartı sayfanın giriş noktasıdır; diğer kartlardan ayrışması için
            hafif marka zemini ve bir punto büyük başlık kullanır. */}
        <section className="rounded-[6px] border border-brand-200 bg-brand-50 p-5 sm:p-6">
          <h1 className="text-2xl font-semibold tracking-tight text-ink-900 sm:text-[26px]">
            Müşteri şikâyetlerinizi buradan iletebilirsiniz
          </h1>
          <p className="mt-2 max-w-[68ch] text-sm leading-relaxed text-ink-700">
            Türkiye Şeker Fabrikaları A.Ş.’den aldığınız şeker, melas veya küspe ürünlerine ilişkin
            şikâyetinizi çevrim içi kaydedebilir, sürecin her aşamasını şikâyet numaranızla takip
            edebilirsiniz. Kaydınız {seeded ? factoryCount : 14} fabrikamızdan ilgili olanın ekibine
            doğrudan düşer.
          </p>

          <div className="mt-5 flex flex-wrap gap-3">
            <Link href="/sikayet/yeni" className="btn btn-primary">Şikâyet formu doldur</Link>
            <Link href="/takip" className="btn btn-secondary">Şikâyetimi takip et</Link>
          </div>
        </section>

        {!seeded && (
          <Notice tone="warn" title="Referans verisi yüklenmemiş">
            Fabrika, ürün ve kullanıcı tanımları henüz yüklenmemiş görünüyor. Kurulumu tamamlamak
            için proje dizininde <code className="rounded bg-white px-1 py-0.5 text-xs">npm run db:seed</code>{" "}
            komutunu çalıştırın.
          </Notice>
        )}

        <section className="card">
          <div className="border-b border-ink-200 px-4 py-3 sm:px-5">
            <h2 className="text-[13px] font-semibold tracking-wide text-ink-700 uppercase">
              Şikâyetiniz nasıl ilerler?
            </h2>
            <p className="mt-1.5 max-w-[68ch] text-sm leading-relaxed text-ink-600">
              Çoğu dosya başvuru tarihinden itibaren <strong className="font-semibold text-ink-900">8
              iş günü</strong> içinde kapanır. Aşağıdaki süreler başvuru tarihinden sayılır;
              hafta sonu ve resmî tatiller hesaba katılmaz.
            </p>
          </div>
          <SurecSeridi adimlar={SURECTE_ADIMLAR} zamanTonu="vurgulu" katlanabilir />
        </section>

        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="card-pad">
            <h2 className="text-sm font-semibold text-ink-900">Başvurmadan önce hazırlayın</h2>
            <ul className="mt-2 space-y-1 text-sm text-ink-600">
              <li>• Ürünü aldığınız fabrika ve ürün bilgisi</li>
              <li>• Ambalaj üzerindeki parti / lot numarası</li>
              <li>• Fatura veya irsaliye numarası</li>
              <li>• Şikâyete konu miktar</li>
              <li>• Varsa sorunu gösteren fotoğraflar</li>
              <li className="text-warn-700">
                • <strong className="font-semibold">Şikâyete konu ürünün kendisi</strong> — ekip
                yerinde inceleme için işletmenize gelecektir
              </li>
            </ul>
          </div>
          <div className="card-pad">
            <h2 className="text-sm font-semibold text-ink-900">Şikâyetinizi nasıl takip edersiniz?</h2>
            <p className="mt-2 text-sm leading-relaxed text-ink-600">
              Her adımda cep telefonunuza SMS, e-posta adresinize bilgilendirme gönderilir.
              Durumu istediğiniz an iki yoldan görebilirsiniz:
            </p>
            <ul className="mt-2 space-y-1 text-sm text-ink-600">
              <li>• Size gelen SMS’teki takip bağlantısına dokunarak</li>
              <li>
                • <Link href="/takip" className="link">Şikâyet takibi</Link> sayfasında şikâyet
                numaranız ve telefonunuzun son 4 hanesiyle
              </li>
            </ul>
          </div>
        </section>
      </div>
    </PublicShell>
  );
}
