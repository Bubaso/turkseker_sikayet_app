import Link from "next/link";
import { redirect } from "next/navigation";
import { all } from "@/lib/db";
import { fmtDate, fmtDateTime } from "@/lib/dates";
import { fmtQuantity, fmtTl } from "@/lib/format";
import { isGmRole } from "@/lib/roles";
import { requirePageUser } from "@/server/auth";
import { daireyeGelenYazilar } from "@/server/yonetim";
import { Card, Chip, EmptyState, Notice, PageHeader, VerdictChip } from "@/components/ui";
import { ActionButton } from "@/components/action-form";
import { letterReadAction } from "@/app/panel/actions";

export const dynamic = "force-dynamic";

/**
 * Daire Başkanlığına gönderilen resmî yazılar (TL PASAT 004 md. 6 ve 8).
 * Fabrika, işlem tamamlandıktan sonra şikâyet formu, analiz raporları,
 * tutanaklar ve yapılan işlemlerin sonucunu ilgili dairelere gönderir;
 * bu sayfa dairenin gelen kutusudur.
 */
export default async function ResmiYazilarPage({
  searchParams,
}: {
  searchParams: Promise<{ daire?: string; durum?: string }>;
}) {
  const q = await searchParams;
  const user = await requirePageUser();
  if (!isGmRole(user.role) && user.role !== "SISTEM_YONETICISI") {
    redirect("/panel?hata=yetki");
  }

  const daireler = all<{ id: number; name: string }>(
    "SELECT id, name FROM departments WHERE is_active = 1 ORDER BY id",
  );
  // Daire Başkanı kendi kutusunu görür; üst yönetim daire seçebilir.
  const seciliId = user.department_id ?? (q.daire ? Number(q.daire) : daireler[0]?.id);
  const secili = daireler.find((d) => d.id === seciliId);
  const hepsi = secili ? daireyeGelenYazilar(secili.id) : [];
  const yazilar = q.durum === "okunmamis" ? hepsi.filter((y) => y.okundu_mu === 0) : hepsi;
  const okunmamis = hepsi.filter((y) => y.okundu_mu === 0).length;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Resmî yazılar"
        subtitle={
          secili
            ? `${secili.name} — ${hepsi.length} yazı, ${okunmamis} okunmamış`
            : "Daire bulunamadı"
        }
        actions={
          <div className="flex flex-wrap gap-2">
            <Link href="/panel/resmi-yazilar"
                  className={`btn btn-sm ${q.durum ? "btn-secondary" : "btn-primary"}`}>
              Tümü
            </Link>
            <Link href="/panel/resmi-yazilar?durum=okunmamis"
                  className={`btn btn-sm ${q.durum === "okunmamis" ? "btn-primary" : "btn-secondary"}`}>
              Okunmamış {okunmamis > 0 && `(${okunmamis})`}
            </Link>
          </div>
        }
      />

      {!user.department_id && daireler.length > 0 && (
        <Card title="Daire seçimi" bodyClass="p-4">
          <div className="flex flex-wrap gap-2">
            {daireler.map((d) => (
              <Link key={d.id} href={`/panel/resmi-yazilar?daire=${d.id}`}
                    className={`btn btn-sm ${d.id === seciliId ? "btn-primary" : "btn-secondary"}`}>
                {d.name.replace(" Daire Başkanlığı", "")}
              </Link>
            ))}
          </div>
        </Card>
      )}

      <Notice tone="info" title="Resmî yazı ne zaman gelir?">
        Şikâyet haklı bulunup iade veya değişim tamamlandıktan sonra, en geç 3 iş günü içinde
        şikâyet formu, analiz raporları, tutanaklar ve yapılan işlemlerin sonucu ilgili Daire
        Başkanlıklarına gönderilir (TL PASAT 004 md. 6 ve 8).
      </Notice>

      {yazilar.length === 0 ? (
        <Card>
          <EmptyState
            title={q.durum === "okunmamis" ? "Okunmamış yazı yok" : "Henüz resmî yazı gelmemiş"}
            hint="İşlemi tamamlanan dosyaların resmî yazıları burada listelenir."
          />
        </Card>
      ) : (
        <Card title={`Gelen yazılar (${yazilar.length})`} bodyClass="">
          <ul className="divide-y divide-ink-100">
            {yazilar.map((y) => (
              <li key={y.id}
                  className={`px-4 py-3.5 sm:px-5 ${y.okundu_mu === 0 ? "bg-brand-50/40" : ""}`}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-sm font-semibold text-ink-900">
                        {y.letter_no}
                      </span>
                      {y.okundu_mu === 0 ? (
                        <Chip tone="brand" dot>Okunmadı</Chip>
                      ) : (
                        <Chip tone="ink">Okundu</Chip>
                      )}
                      <VerdictChip verdict={y.verdict} />
                    </div>
                    <p className="mt-1 text-sm text-ink-700">
                      <Link href={`/panel/sikayet/${y.complaint_id}`} className="link font-mono">
                        {y.complaint_no}
                      </Link>
                      {" · "}{y.customer_company}
                      {y.factory && ` · ${y.factory}`}
                      {" · "}{y.product_name}
                    </p>
                    {y.note && (
                      <p className="mt-1 text-sm leading-relaxed text-ink-600">{y.note}</p>
                    )}
                    <p className="mt-1 text-xs text-ink-500">
                      Gönderim: {fmtDate(y.sent_at)}
                      {y.okunma_zamani && ` · Okuyan: ${y.okuyan} (${fmtDateTime(y.okunma_zamani)})`}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center gap-2">
                    <Link href={`/panel/sikayet/${y.complaint_id}?sekme=belgeler`}
                          className="btn btn-secondary btn-sm">
                      Ekleri gör
                    </Link>
                    {y.okundu_mu === 0 && secili && (
                      <ActionButton action={letterReadAction} label="Okundu olarak işaretle"
                                    tone="primary" fields={{ letterId: y.id, departmentId: secili.id }} />
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
