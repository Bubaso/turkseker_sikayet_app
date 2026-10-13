import Link from "next/link";
import { scalar } from "@/lib/db";
import { PublicShell } from "@/components/public-shell";
import { Notice } from "@/components/ui";

export const dynamic = "force-dynamic";

export default function HomePage() {
  const factoryCount = scalar<number>("SELECT COUNT(*) FROM factories WHERE is_active = 1") ?? 0;
  const seeded = factoryCount > 0;

  return (
    <PublicShell>
      <div className="space-y-6">
        <section className="card-pad">
          <h1 className="text-2xl font-semibold tracking-tight text-ink-900">
            Müşteri şikâyetlerinizi buradan iletebilirsiniz
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-600">
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
          <h2 className="card-title">Şikâyetiniz nasıl ilerler?</h2>
          <ol className="divide-y divide-ink-100">
            {[
              {
                t: "Kayıt",
                s: "Aynı gün",
                d: "Şikâyetiniz sisteme kaydedilir, Müşteri Şikâyet Formu otomatik düzenlenir ve size şikâyet numaranız SMS ile gönderilir.",
              },
              {
                t: "Ekip oluşturma",
                s: "En geç 1 iş günü",
                d: "Fabrika Müdürü; Kalite ve İşletme Kontrol, Teknik (İşletme), Muhasebe ve Ziraat birimlerinden inceleme ekibini görevlendirir. Adresinize daha yakın bir fabrikamız varsa dosya oraya yönlendirilir.",
              },
              {
                t: "İnceleme ve analiz",
                s: "En geç 3 iş günü",
                d: "Ekip işletmenize gelir, gerekirse numune alır. Kalite ve İşletme Kontrol Laboratuvarı analizi yapar ve sonuç tutanağa bağlanır.",
              },
              {
                t: "Karar",
                s: "Tutanak onayıyla",
                d: "Tutanak; Ambar Şefi, Satış Birim Şefi, Kalite Müdür Yardımcısı ve Fabrika Müdür Yardımcıları tarafından imzalanır, Fabrika Müdürü onaylar.",
              },
              {
                t: "İade / değişim",
                s: "En geç 5 iş günü",
                d: "Şikâyetiniz haklı bulunursa ürünün iadesi alınır veya değişimi yapılır; nakliye bedeli talep ettiyseniz ve kusur fabrikamızdan kaynaklanıyorsa geliş-gidiş nakliye masrafınız ödenir.",
              },
              {
                t: "Bilgilendirme ve kapanış",
                s: "İşlemden sonra 3 iş günü",
                d: "Yapılan işlemler Müşteri Bilgilendirme Formu ile tarafınıza iletilir; dosya Genel Müdürlük daire başkanlıklarına raporlanarak kapatılır.",
              },
            ].map((x, i) => (
              <li key={x.t} className="flex gap-4 px-4 py-3.5 sm:px-5">
                <span className="tnum flex size-7 shrink-0 items-center justify-center rounded-full border border-brand-200 bg-brand-50 text-xs font-semibold text-brand-700">
                  {i + 1}
                </span>
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-ink-900">
                    {x.t}
                    <span className="chip border-ink-200 bg-ink-100 text-ink-600">{x.s}</span>
                  </p>
                  <p className="mt-0.5 text-sm leading-relaxed text-ink-600">{x.d}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="card-pad">
            <h2 className="text-sm font-semibold text-ink-900">Başvurunuz için hazır olması iyi olur</h2>
            <ul className="mt-2 space-y-1 text-sm text-ink-600">
              <li>• Ürünü aldığınız fabrika ve ürün bilgisi</li>
              <li>• Ambalaj üzerindeki parti / lot numarası</li>
              <li>• Fatura veya irsaliye numarası</li>
              <li>• Şikâyete konu miktar</li>
              <li>• Varsa sorunu gösteren fotoğraflar</li>
            </ul>
          </div>
          <div className="card-pad">
            <h2 className="text-sm font-semibold text-ink-900">Takip ve bilgilendirme</h2>
            <p className="mt-2 text-sm leading-relaxed text-ink-600">
              Kaydınızdan sonra her kilometre taşında (ekip oluşturma, inceleme, karar, iade/değişim,
              kapanış) cep telefonunuza SMS ve e-posta adresinize bilgilendirme gönderilir. SMS’teki
              bağlantıdan ya da <Link href="/takip" className="link">şikâyet takibi</Link> sayfasından
              şikâyet numaranız ve telefonunuzun son 4 hanesiyle durumu görebilirsiniz.
            </p>
          </div>
        </section>
      </div>
    </PublicShell>
  );
}
