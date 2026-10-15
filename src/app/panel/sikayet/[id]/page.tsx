import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { all } from "@/lib/db";
import { ATTACHMENT_KIND, STATUS_STEP, TOTAL_STEPS } from "@/lib/domain";
import { PERMISSIONS, can, isGmRole } from "@/lib/roles";
import { fmtDate, today } from "@/lib/dates";
import { checkEscalation } from "@/lib/esik";
import { ASAMA } from "@/lib/asamalar";
import { canAccessFactory, requirePageUser } from "@/server/auth";
import { getComplaint, listFactories, suggestNearerFactory } from "@/server/complaints";
import { dosyaAsamalari, atanabilirPersonel } from "@/server/asamalar-db";
import { complaintDocuments } from "@/server/documents";
import { ACCEPT_ATTR, complaintAttachments } from "@/server/attachments";
import { complaintEvents } from "@/server/events";
import { getSettingNum } from "@/server/settings";
import { Chip, Notice, PageHeader, StatusChip, VerdictChip } from "@/components/ui";
import { SikayetFormu } from "@/components/sikayet-formu";
import { ActionForm } from "@/components/action-form";
import { cancelAction } from "@/app/panel/actions";
import { Surec } from "./surec";
import { Ekler } from "./ekler";
import { Gecmis } from "./gecmis";
import type { AttachmentView, NotificationView } from "@/lib/types";

export const dynamic = "force-dynamic";

/* ===========================================================================
   Şikâyet dosyası — tek sayfa.

   Sıra, ekranın sırasıdır: önce şikâyet formunun kendisi, hemen altında
   dosyanın aşamaları (sırası gelen aşama kayıt formunu açar), sonra belgeler
   ve geçmiş. Sekme yoktur; dosyanın tamamı tek akışta okunur.
   =========================================================================== */

export default async function ComplaintDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requirePageUser();
  const c = getComplaint(Number(id));
  if (!c) notFound();
  if (!canAccessFactory(user, c.factory_id)) redirect("/panel/sikayetler?hata=yetki");

  const gm = isGmRole(user.role);
  const mudur = user.role === "FABRIKA_MUDURU" || user.role === "SISTEM_YONETICISI";

  const asamalar = dosyaAsamalari(c.id, user);
  const attachments = complaintAttachments(c.id);
  const events = complaintEvents(c.id);
  const form = complaintDocuments(c.id)[0] ?? null;
  const notifications = all<NotificationView>(
    `SELECT n.*, NULL AS complaint_no, NULL AS factory_short FROM notifications n
      WHERE n.complaint_id = ? AND n.template_code <> 'OTP' ORDER BY n.id DESC`,
    c.id,
  );

  // Ekler aşama koduna göre gruplanır: her kilometre taşı kendi belgesini taşır.
  const belgeler: Record<string, AttachmentView[]> = {};
  for (const a of attachments) (belgeler[a.kind] ??= []).push(a);
  const kanitlar = belgeler[ATTACHMENT_KIND.KANIT] ?? [];

  const simdiki = asamalar.find((a) => !a.kapandi && a.sirasiGeldi) ?? null;
  const step = STATUS_STEP[c.status as keyof typeof STATUS_STEP] ?? 1;

  return (
    <div className="space-y-5">
      <PageHeader
        breadcrumb={[
          { href: "/panel", label: "Panel" },
          { href: "/panel/sikayetler", label: "Şikâyet dosyaları" },
        ]}
        title={
          <span className="flex flex-wrap items-center gap-2.5">
            <span className="font-mono">{c.complaint_no}</span>
            <StatusChip status={c.status} />
            <VerdictChip verdict={c.verdict} />
            {c.category_critical === 1 && <Chip tone="danger" dot>Gıda güvenliği ihbarı</Chip>}
          </span>
        }
        subtitle={
          <>
            {c.customer_company} · {c.product_name}
            {c.lot_no && ` · Lot ${c.lot_no}`} · {c.factory_name} ·{" "}
            {fmtDate(c.received_at)} tarihli başvuru
          </>
        }
        actions={
          <>
            {form && (
              <Link href={`/belge/${form.id}`} target="_blank" className="btn btn-secondary btn-sm">
                Formu yazdır
              </Link>
            )}
            <Link href={`/takip/${c.tracking_token}`} target="_blank" className="btn btn-secondary btn-sm">
              Müşteri görünümü
            </Link>
          </>
        }
      />

      {/* Dosya nerede: tek satırda şu anki adım ve ilerleme */}
      <div className="card px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-ink-200">
            <div
              className={`h-full rounded-full ${
                c.status === "REDDEDILDI" || c.status === "IPTAL" ? "bg-ink-400" : "bg-brand-600"
              }`}
              style={{ width: `${Math.round((step / TOTAL_STEPS) * 100)}%` }}
            />
          </div>
          <span className="tnum shrink-0 text-xs text-ink-500">Adım {step} / {TOTAL_STEPS}</span>
        </div>
        {simdiki && !c.closed_at && (
          <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
            <span className="text-ink-500">Şu anki adım:</span>
            <span className="font-semibold text-ink-900">{simdiki.title}</span>
            <span className="text-ink-600">
              — {simdiki.assignee_name
                ? `${simdiki.assignee_name} (${simdiki.assignee_title})`
                : "sorumlu atanmadı"}
            </span>
            {simdiki.due_at && (
              <span className="tnum text-ink-500">· en geç {fmtDate(simdiki.due_at)}</span>
            )}
            {simdiki.islenebilir && <Chip tone="brand" dot>Sıra sizde</Chip>}
          </p>
        )}
      </div>

      {c.escalated_at && !c.escalation_decided_at && (
        <Notice tone="warn" title="Daire Başkanlığı değerlendirmesinde">
          Dosya {c.department_name} birimine gönderildi. Karar en geç{" "}
          {fmtDate(c.escalation_due_at)} tarihine kadar verilecek.
        </Notice>
      )}

      {c.redirected_at && (
        <Notice tone="ink" title="Dosya yönlendirildi">
          {fmtDate(c.redirected_at)} tarihinde bu fabrikaya devredildi.
          {c.redirect_reason && <> Gerekçe: {c.redirect_reason}</>}
        </Notice>
      )}

      {/* 1. Şikâyet formunun kendisi — dosyayı açanın ilk gördüğü şey.
           Açık gelir; dosya ileri aşamalara geçtiğinde katlanabilir. */}
      <details open className="card overflow-hidden">
        <summary className="cursor-pointer border-b border-ink-200 px-4 py-2.5 text-baslik font-semibold tracking-wide text-ink-700 uppercase">
          Müşteri Şikâyet Formu (FR PASAT 007) ·{" "}
          <span className="font-normal normal-case text-ink-500">
            müşterinin {fmtDate(c.received_at)} tarihli beyanı
          </span>
        </summary>
        <div className="p-4 sm:p-5">
          <SikayetFormu c={c} kanitlar={kanitlar} />
        </div>
      </details>

      {/* 2. Aşamalar ve kayıt formları */}
      <section>
        <div className="mb-2.5 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-baslik font-semibold tracking-wide text-ink-700 uppercase">
            Süreç
          </h2>
          <p className="text-xs text-ink-500">
            Her aşama, fabrikada hazırlanan belgenin yüklenmesiyle kapanır.
          </p>
        </div>

        {gm && !asamalar.some((a) => a.islenebilir) && (
          <Notice tone="ink" title="Genel Müdürlük görünümü">
            Fabrika süreç işlemleri ilgili fabrika personeli tarafından yapılır. Bu sayfada
            dosyanın hangi aşamada olduğunu ve yüklenen belgeleri izleyebilirsiniz.
            {c.escalated_at && (
              <>
                {" "}İtiraz değerlendirmeleri için{" "}
                <Link href="/panel/itirazlar" className="link">İtiraz değerlendirmeleri</Link>{" "}
                sayfasını kullanın.
              </>
            )}
          </Notice>
        )}

        <div className={gm && !asamalar.some((a) => a.islenebilir) ? "mt-3" : ""}>
          <Surec
            c={c}
            asamalar={asamalar}
            belgeler={belgeler}
            bugun={today()}
            esik={checkEscalation(c.product_group, c.quantity_kg)}
            mudur={mudur}
            personel={atanabilirPersonel(c.factory_id)}
            fabrikalar={listFactories().map((f) => ({ id: f.id, name: f.name }))}
            oneri={asamalar.some((a) => a.code === ASAMA.EKIP && !a.kapandi)
              ? suggestNearerFactory(c.id)
              : null}
            accept={ACCEPT_ATTR}
            maxMb={getSettingNum("ek_dosya_max_mb", 10)}
          />
        </div>
      </section>

      {/* 3. Belgeler ve ekler */}
      <Ekler
        complaintId={c.id}
        attachments={attachments}
        form={form}
        canUpload={!gm && !c.closed_at}
        accept={ACCEPT_ATTR}
        maxMb={getSettingNum("ek_dosya_max_mb", 10)}
      />

      {/* 4. Geçmiş ve müşteriye giden bildirimler */}
      <Gecmis events={events} notifications={notifications} />

      {!c.closed_at && mudur && can(user.role, PERMISSIONS.SIKAYET_KAPAT) && (
        <details className="card-pad">
          <summary className="cursor-pointer text-sm font-medium text-danger-700">
            Dosyayı iptal et
          </summary>
          <p className="mt-2 max-w-[68ch] text-sm text-ink-600">
            Mükerrer kayıt veya müşterinin başvurusunu geri çekmesi gibi hâllerde kullanılır.
            Dosya kapanır, açık aşamalar düşer ve işlem geçmişe yazılır.
          </p>
          <div className="mt-3">
            <ActionForm action={cancelAction} complaintId={c.id} submitLabel="İptal et"
                        submitTone="danger" compact
                        confirm="Dosya iptal edilecek. Onaylıyor musunuz?">
              <div>
                <label className="label" htmlFor="reason">İptal gerekçesi</label>
                <input id="reason" name="reason" className="input" required
                       placeholder="Örnek: Müşteri başvurusunu geri çekti." />
              </div>
            </ActionForm>
          </div>
        </details>
      )}
    </div>
  );
}
