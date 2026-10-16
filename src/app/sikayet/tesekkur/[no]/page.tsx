import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { fmtDateLong } from "@/lib/dates";
import { maskPhone } from "@/lib/format";
import { getComplaintByNo } from "@/server/complaints";
import { PublicShell } from "@/components/public-shell";
import { Notice } from "@/components/ui";

export const metadata: Metadata = { title: "Şikâyetiniz alındı" };
export const dynamic = "force-dynamic";

export default async function ThanksPage({
  params, searchParams,
}: {
  params: Promise<{ no: string }>;
  searchParams: Promise<{ t?: string }>;
}) {
  const { no } = await params;
  const { t } = await searchParams;
  const c = getComplaintByNo(decodeURIComponent(no));
  if (!c) notFound();

  // Takip bağlantısı yalnızca kaydı yeni oluşturan kişiye gösterilir.
  const token = t && t === c.tracking_token ? t : null;

  return (
    <PublicShell>
      <div className="space-y-5">
        <section className="card border-ok-200 bg-ok-50 p-5">
          <div className="flex items-start gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-ok-600 text-lg text-white" aria-hidden>
              ✓
            </span>
            <div>
              <h1 className="text-lg font-semibold text-ink-900">Şikâyetiniz kaydedildi</h1>
              <p className="mt-1 text-sm text-ink-700">
                Başvurunuz {c.factory_name} tarafından incelenmek üzere ilgili ekibe iletildi.
                Bilgilendirme mesajı {maskPhone(c.customer_phone)} numarasına gönderildi.
              </p>
            </div>
          </div>
        </section>

        <section className="card">
          <h2 className="card-title">Şikâyet numaranız</h2>
          <div className="p-5">
            <p className="tnum font-mono text-2xl font-semibold tracking-wide text-brand-700">
              {c.complaint_no}
            </p>
            <p className="mt-1 text-sm text-ink-600">
              Bu numarayı saklayınız. Takip sayfasında şikâyet numaranız ve telefonunuzun son 4
              hanesiyle durumu sorgulayabilirsiniz.
            </p>
            <dl className="mt-4 grid grid-cols-1 gap-x-6 gap-y-3 border-t border-ink-100 pt-4 sm:grid-cols-2">
              {/*
                Fabrika adı ve inceleme son tarihi buradan çıkarıldı: ikisi de
                aşağıdaki "Sırada ne var?" kutusunda zaten yazılı. Künyede
                müşterinin kendi beyanı kalır.
              */}
              {[
                ["Şikâyet tarihi", fmtDateLong(c.received_at)],
                ["Ürün", `${c.product_name}${c.packaging ? ` — ${c.packaging}` : ""}`],
              ].map(([k, val]) => (
                <div key={k}>
                  <dt className="text-xs font-medium tracking-wide text-ink-500 uppercase">{k}</dt>
                  <dd className="mt-0.5 text-sm text-ink-900">{val}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        <Notice tone="brand" title="Sırada ne var?">
          Dosyanız <strong>{c.factory_name}</strong> tarafından incelenecek. En geç{" "}
          <strong>1 iş günü</strong> içinde inceleme ekibi oluşturulacak ve size SMS ile bilgi
          verilecek; inceleme en geç{" "}
          <strong>{fmtDateLong(c.due_inspection_at)}</strong> tarihinde tamamlanır.
        </Notice>

        <div className="flex flex-wrap gap-3">
          {token ? (
            <Link href={`/takip/${token}`} className="btn btn-primary">Şikâyetimi görüntüle</Link>
          ) : (
            <Link href="/takip" className="btn btn-primary">Şikâyet takip sayfası</Link>
          )}
          <Link href="/" className="btn btn-secondary">Ana sayfa</Link>
        </div>
      </div>
    </PublicShell>
  );
}
