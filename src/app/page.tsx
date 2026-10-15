import Link from "next/link";
import { scalar } from "@/lib/db";
import { PublicShell } from "@/components/public-shell";
import { Notice } from "@/components/ui";

export const dynamic = "force-dynamic";

/*
 * Ana sayfa müşteriye üç şey söyler: nereye başvuracağı, ne kadar süreceği ve
 * başvururken yanında ne olması gerektiği. Sürecin ayrıntısı burada değil,
 * müşteri başvurduktan sonra takip sayfasında durur; burada üç satırlık özeti
 * yeter. Kurum iç işleyişi (unvanlar, tutanaklar, daireler) hiç geçmez.
 */
const ADIMLAR = [
  {
    zaman: "Anında",
    baslik: "Şikâyetinizi kaydedersiniz",
    aciklama: "Şikâyet numaranız SMS ile gönderilir.",
  },
  {
    zaman: "3 iş günü",
    baslik: "Ürününüz incelenir",
    aciklama:
      "Ekip işletmenize gelir; gelinemezse ürün, ilettiğiniz görseller üzerinden incelenir.",
  },
  {
    zaman: "8 iş günü",
    baslik: "Sonuç uygulanır ve size bildirilir",
    aciklama:
      "Şikâyetiniz haklı bulunursa ürün iade alınır veya değiştirilir. Sonuç her hâlükârda " +
      "gerekçesiyle bildirilir.",
  },
];

export default function HomePage() {
  const seeded = (scalar<number>("SELECT COUNT(*) FROM factories WHERE is_active = 1") ?? 0) > 0;

  return (
    <PublicShell>
      <div className="space-y-5">
        <section className="rounded-[6px] border border-brand-200 bg-brand-50 p-5 sm:p-7">
          <h1 className="text-2xl font-semibold tracking-tight text-ink-900 sm:text-[1.75rem]">
            Şikâyetinizi buradan iletebilirsiniz
          </h1>
          <p className="mt-2.5 max-w-[60ch] text-[0.9375rem] leading-relaxed text-ink-700">
            Türkiye Şeker Fabrikaları A.Ş.’den aldığınız şeker, melas veya küspe ürünlerine
            ilişkin şikâyetinizi kaydedin; her aşamayı şikâyet numaranızla takip edin.
          </p>

          {/* Telefonda iki düğme tam genişlikte alt alta durur; yan yana
              sıkıştırıldıklarında metinleri kırpılıyordu. */}
          <div className="mt-5 flex flex-col gap-2.5 sm:flex-row sm:gap-3">
            <Link href="/sikayet/yeni" className="btn btn-primary w-full sm:w-auto">
              Şikâyet formu doldur
            </Link>
            <Link href="/takip" className="btn btn-secondary w-full sm:w-auto">
              Şikâyetimi takip et
            </Link>
          </div>

          <p className="mt-3 text-sm text-ink-600">
            Her adımda SMS ve e-posta ile bilgilendirilirsiniz. Takip için şikâyet numaranız ve
            telefonunuzun son 4 hanesi yeterlidir.
          </p>
        </section>

        {!seeded && (
          <Notice tone="warn" title="Referans verisi yüklenmemiş">
            Fabrika, ürün ve kullanıcı tanımları henüz yüklenmemiş görünüyor. Kurulumu tamamlamak
            için proje dizininde <code className="rounded bg-white px-1 py-0.5 text-xs">npm run db:seed</code>{" "}
            komutunu çalıştırın.
          </Notice>
        )}

        <section className="card-pad">
          <h2 className="text-sm font-semibold text-ink-900">Şikâyetiniz nasıl ilerler?</h2>
          <ol className="mt-3 space-y-3">
            {ADIMLAR.map((a, i) => (
              <li key={a.baslik} className="flex gap-3">
                <span
                  className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full border border-brand-200 bg-brand-50 text-rozet font-semibold text-brand-700"
                  aria-hidden
                >
                  {i + 1}
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-ink-900">
                    {a.baslik}
                    <span className="ml-2 font-normal text-ink-500">{a.zaman}</span>
                  </p>
                  <p className="mt-0.5 max-w-[64ch] text-sm leading-relaxed text-ink-600">
                    {a.aciklama}
                  </p>
                </div>
              </li>
            ))}
          </ol>
          <p className="mt-3.5 border-t border-ink-100 pt-3 text-sm text-ink-500">
            Süreler başvuru tarihinden sayılır; hafta sonu ve resmî tatiller hesaba katılmaz.
          </p>
        </section>

        <section className="card-pad">
          <h2 className="text-sm font-semibold text-ink-900">Başvururken yanınızda olsun</h2>
          <ul className="mt-2 space-y-1 text-sm text-ink-600">
            <li>• Fatura veya irsaliye numarası</li>
            <li>• Ambalaj üzerindeki parti / lot numarası</li>
            <li>• Şikâyete konu miktar</li>
            <li>• Varsa sorunu gösteren fotoğraflar</li>
          </ul>
          <p className="mt-3 rounded-[5px] border border-warn-200 bg-warn-50 px-3 py-2 text-sm leading-snug text-warn-700">
            <strong className="font-semibold">Önemli:</strong> şikâyete konu ürünü, inceleme
            tamamlanana kadar tüketmeden ve ambalajını bozmadan saklayın.
          </p>
        </section>
      </div>
    </PublicShell>
  );
}
