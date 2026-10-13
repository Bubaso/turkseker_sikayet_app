import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { all } from "@/lib/db";
import { DEPT, STATUS_STEP, TOTAL_STEPS } from "@/lib/domain";
import { PERMISSIONS, can, isGmRole } from "@/lib/roles";
import { fmtDate, today } from "@/lib/dates";
import { checkEscalation, letterRecipients } from "@/lib/workflow";
import {canAccessFactory, requirePageUser} from "@/server/auth";
import { complaintTeam, assignableStaff } from "@/server/process";
import { getComplaint, listFactories, suggestNearerFactory } from "@/server/complaints";
import { complaintTasks } from "@/server/tasks";
import { complaintSamples, complaintAnalyses, labParameters } from "@/server/lab";
import { canSignNow, complaintDocuments } from "@/server/documents";
import { ACCEPT_ATTR, complaintAttachments } from "@/server/attachments";
import { complaintEvents } from "@/server/events";
import { holidaySet, getSettingNum } from "@/server/settings";
import { Card, Chip, Notice, PageHeader, StatusChip, Tabs, VerdictChip } from "@/components/ui";
import { OzetTab } from "./tabs/ozet";
import { GorevlerTab, TaskSummary } from "./tabs/gorevler";
import { EkipTab } from "./tabs/ekip";
import { LabTab } from "./tabs/lab";
import { BelgelerTab } from "./tabs/belgeler";
import { EklerTab } from "./tabs/ekler";
import { GecmisTab, BildirimlerTab } from "./tabs/gecmis";
import { IslemlerPanel, type ActionCtx } from "./tabs/islemler";
import type { NotificationView } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function ComplaintDetailPage({
  params, searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ sekme?: string }>;
}) {
  const { id } = await params;
  const { sekme } = await searchParams;
  const user = await requirePageUser();
  const c = getComplaint(Number(id));
  if (!c) notFound();
  if (!canAccessFactory(user, c.factory_id)) {
    redirect("/panel/sikayetler?hata=yetki");
  }

  const holidays = holidaySet();
  const gm = isGmRole(user.role) || user.role === "SISTEM_YONETICISI";
  const tasks = complaintTasks(c.id);
  const documents = complaintDocuments(c.id);
  const attachments = complaintAttachments(c.id);
  const samples = complaintSamples(c.id);
  const analyses = complaintAnalyses(c.id);
  const team = complaintTeam(c.id);
  const events = complaintEvents(c.id);
  const notifications = all<NotificationView>(
    `SELECT n.*, NULL AS complaint_no, NULL AS factory_short FROM notifications n
      WHERE n.complaint_id = ? AND n.template_code <> 'OTP' ORDER BY n.id DESC`,
    c.id,
  );

  const openTasks = tasks
    .filter((t) => t.status === "BEKLEMEDE" || t.status === "DEVAM_EDIYOR")
    .map((t) => t.code);
  const signableIds = documents.filter((d) => canSignNow(d.id, user)).map((d) => d.id);
  const esc = checkEscalation(c.product_group, c.quantity_kg);
  const deptNames = all<{ code: string; name: string }>("SELECT code, name FROM departments");
  const recipients = letterRecipients(c.product_group)
    .map((code) => deptNames.find((d) => d.code === code)?.name ?? code);
  const approvedTutanak = documents.some(
    (d) => ["FR_PASAT_004", "FR_PASAT_005"].includes(d.type) && d.status === "ONAYLANDI",
  );

  const tab = sekme ?? "ozet";
  const tabs = [
    { key: "ozet", label: "Özet" },
    { key: "islemler", label: "Yapılacak işlem", count: gm ? 0 : openTasks.length },
    { key: "gorevler", label: "Görevler", count: openTasks.length },
    { key: "ekip", label: "Ekip", count: team.length },
    { key: "lab", label: "Numune ve analiz", count: samples.length + analyses.length },
    { key: "belgeler", label: "Tutanaklar", count: documents.length },
    { key: "ekler", label: "Ekler", count: attachments.length },
    { key: "bildirimler", label: "Bildirimler", count: notifications.length },
    { key: "gecmis", label: "Geçmiş", count: events.length },
  ];

  const ctx: ActionCtx = {
    complaintId: c.id,
    today: today(),
    openTasks,
    demand: c.demand,
    demandsFreight: c.demands_freight === 1,
    labRequired: c.lab_required === 1,
    quantityKg: c.quantity_kg,
    verdict: c.verdict,
    hasApprovedTutanak: approvedTutanak,
    transactionDone: !!c.transaction_date,
    escalated: !!c.escalated_at,
    escalationRequired: esc.required,
    escalationReason: esc.reason,
    letterSent: !!c.letter_sent_at,
    customerInformed: !!c.customer_informed_at,
    closed: !!c.closed_at,
    recipients,
    suggestedLetterNo: `${c.factory_code}-${c.complaint_no.replace(/-/g, "")}`,
    perms: {
      inceleme: can(user.role, PERMISSIONS.INCELEME_GIR),
      belge: can(user.role, PERMISSIONS.BELGE_HAZIRLA),
      islem: can(user.role, PERMISSIONS.ISLEM_GIR),
      itiraz: can(user.role, PERMISSIONS.ITIRAZ_GONDER),
      yazi: can(user.role, PERMISSIONS.RESMI_YAZI),
      kapat: can(user.role, PERMISSIONS.SIKAYET_KAPAT),
    },
  };

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
            <Link href={`/takip/${c.tracking_token}`} target="_blank" className="btn btn-secondary btn-sm">
              Müşteri görünümü
            </Link>
            {!gm && (
              <Link href={`/panel/sikayet/${c.id}?sekme=islemler`} className="btn btn-primary btn-sm">
                Yapılacak işlem
              </Link>
            )}
          </>
        }
      />

      {/* İlerleme */}
      <div className="card px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-ink-200">
            <div className={`h-full rounded-full ${
                  c.status === "REDDEDILDI" || c.status === "IPTAL" ? "bg-ink-400" : "bg-brand-600"
                }`}
                 style={{ width: `${Math.round((step / TOTAL_STEPS) * 100)}%` }} />
          </div>
          <span className="tnum shrink-0 text-xs text-ink-500">Adım {step} / {TOTAL_STEPS}</span>
        </div>
      </div>

      {c.escalated_at && !c.escalation_decided_at && (
        <Notice tone="warn" title="Daire Başkanlığı değerlendirmesinde">
          Dosya {c.department_name} birimine gönderildi. Karar en geç{" "}
          {fmtDate(c.escalation_due_at)} tarihine kadar verilecek.
        </Notice>
      )}

      <Tabs tabs={tabs} active={tab} baseHref={`/panel/sikayet/${c.id}`} />

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-4">
        <div className="min-w-0 xl:col-span-3">
          {tab === "ozet" && <OzetTab c={c} holidays={holidays} />}

          {tab === "islemler" && (
            gm ? (
              <Notice tone="ink" title="Genel Müdürlük görünümü">
                Fabrika süreç işlemleri yalnızca ilgili fabrika personeli tarafından yapılır.
                İtiraz değerlendirmeleri için{" "}
                <Link href="/panel/itirazlar" className="link">İtiraz değerlendirmeleri</Link>{" "}
                sayfasını kullanın.
              </Notice>
            ) : (
              <IslemlerPanel ctx={ctx} />
            )
          )}

          {tab === "gorevler" && (
            <GorevlerTab complaintId={c.id} tasks={tasks} holidays={holidays} canUpdate={!gm} />
          )}

          {tab === "ekip" && (
            <EkipTab
              complaintId={c.id}
              team={team}
              staff={assignableStaff(c.factory_id)}
              canManage={!gm && can(user.role, PERMISSIONS.EKIP_YONET)}
              factories={listFactories().map((f) => ({ id: f.id, name: f.name }))}
              currentFactoryId={c.factory_id}
              suggestion={suggestNearerFactory(c.id)}
              teamFormed={c.team_formed_at}
              redirectedAt={c.redirected_at}
              redirectedFrom={
                c.redirected_from_id
                  ? (listFactories().find((f) => f.id === c.redirected_from_id)?.name ?? null)
                  : null
              }
              redirectReason={c.redirect_reason}
              dueTeamAt={fmtDate(c.due_team_at)}
            />
          )}

          {tab === "lab" && (
            <LabTab
              complaintId={c.id}
              samples={samples}
              analyses={analyses}
              parameters={labParameters(c.product_group)}
              productGroup={c.product_group}
              today={today()}
              canSample={!gm && can(user.role, PERMISSIONS.INCELEME_GIR)}
              canAnalyze={!gm && can(user.role, PERMISSIONS.ANALIZ_GIR)}
              accept={ACCEPT_ATTR}
            />
          )}

          {tab === "belgeler" && (
            <BelgelerTab complaintId={c.id} documents={documents} signableIds={signableIds}
                         canPrepare={!gm && can(user.role, PERMISSIONS.BELGE_HAZIRLA)} />
          )}

          {tab === "ekler" && (
            <EklerTab complaintId={c.id} attachments={attachments} canUpload={!gm}
                      accept={ACCEPT_ATTR} maxMb={getSettingNum("ek_dosya_max_mb", 10)} />
          )}

          {tab === "bildirimler" && <BildirimlerTab rows={notifications} />}
          {tab === "gecmis" && <GecmisTab events={events} />}
        </div>

        <aside className="min-w-0 space-y-5">
          <Card title="Süreç adımları" bodyClass="">
            <TaskSummary tasks={tasks} holidays={holidays} />
          </Card>

          {signableIds.length > 0 && (
            <Notice tone="warn" title="İmzanız bekleniyor">
              {signableIds.length} belge sizin imzanızı bekliyor.{" "}
              <Link href={`/panel/sikayet/${c.id}?sekme=belgeler`} className="link">
                Tutanaklar sekmesine git
              </Link>
            </Notice>
          )}

          <Card title="İtiraz eşiği" bodyClass="p-4">
            <p className="text-xs leading-relaxed text-ink-600">{esc.reason}</p>
            <p className="mt-2 text-xs text-ink-500">
              Yönlendirilecek daire:{" "}
              <strong>
                {deptNames.find((d) => d.code === esc.departmentCode)?.name ??
                 (esc.departmentCode === DEPT.PERAKENDE_LOJISTIK
                   ? "Perakende Satışlar ve Lojistik Daire Başkanlığı"
                   : "Pazarlama ve Satış Daire Başkanlığı")}
              </strong>
            </p>
          </Card>
        </aside>
      </div>
    </div>
  );
}
