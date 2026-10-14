import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { all } from "@/lib/db";
import { DEPT, STATUS_STEP, TOTAL_STEPS } from "@/lib/domain";
import { PERMISSIONS, can, isGmRole } from "@/lib/roles";
import { fmtDate, today } from "@/lib/dates";
import { checkEscalation, letterRecipients, type TaskCode } from "@/lib/workflow";
import {canAccessFactory, requirePageUser} from "@/server/auth";
import { complaintTeam, assignableStaff } from "@/server/process";
import { getComplaint, listFactories, suggestNearerFactory } from "@/server/complaints";
import { complaintSteps, eligibleAssignees } from "@/server/tasks";
import { complaintSamples, complaintAnalyses, labParameters } from "@/server/lab";
import { canSignNow, complaintDocuments } from "@/server/documents";
import { ACCEPT_ATTR, complaintAttachments } from "@/server/attachments";
import { complaintEvents } from "@/server/events";
import { holidaySet, getSettingNum } from "@/server/settings";
import { Card, Chip, Notice, PageHeader, StatusChip, Tabs, VerdictChip } from "@/components/ui";
import { OzetTab } from "./tabs/ozet";
import { GorevlerTab, TaskSummary, type AssigneeOption } from "./tabs/gorevler";
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
  const steps = complaintSteps(c.id, user);
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

  const openTasks = steps.filter((t) => !t.settled).map((t) => t.code);
  // Şu anda bu kullanıcının işleyebileceği adımlar: açık + sırası gelmiş + sorumlusu kendisi.
  const actionable = steps.filter((t) => t.actionable).map((t) => t.code);
  // Sırası gelmiş açık adımlar — kimde olduğundan bağımsız olarak "dosya nerede" sorusunu yanıtlar.
  const currentSteps = steps.filter((t) => !t.settled && t.ready);
  const canAssign = !gm && can(user.role, PERMISSIONS.GOREV_ATA);
  const assignableBy: Record<string, AssigneeOption[]> = {};
  if (canAssign) {
    for (const t of steps) {
      if (t.settled || t.department_id !== null) continue;
      assignableBy[t.code] = eligibleAssignees(c.factory_id, t.code as TaskCode)
        .map((u) => ({ id: u.id, full_name: u.full_name, title: u.title }));
    }
  }
  const factories = listFactories().map((f) => ({ id: f.id, name: f.name }));
  const ekipVerisi = {
    staff: assignableStaff(c.factory_id),
    factories,
    currentFactoryId: c.factory_id,
    suggestion: suggestNearerFactory(c.id),
  };
  // Sırası gelmiş ama bu kullanıcının olmayan adım — "size düşen işlem yok"
  // mesajının doğru bilgi verebilmesi için.
  const bekleyenAdim = currentSteps.find((t) => !t.mine) ?? null;

  const stepOf = (code: string) => steps.find((t) => t.code === code);
  const canDo = (code: string) => stepOf(code)?.actionable === true;
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
    { key: "islemler", label: "Yapılacak işlem", count: gm ? 0 : actionable.length },
    { key: "gorevler", label: "Süreç adımları", count: openTasks.length },
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
    actionable,
    ekip: c.team_formed_at ? null : ekipVerisi,
    bekleyen: bekleyenAdim
      ? {
          baslik: bekleyenAdim.title,
          sorumlu: bekleyenAdim.assignee_name
            ? `${bekleyenAdim.assignee_name} (${bekleyenAdim.assignee_title})`
            : "henüz sorumlusu atanmamış bir adım",
        }
      : null,
    canCancel: !gm && can(user.role, PERMISSIONS.SIKAYET_KAPAT),
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

      {/* Dosya şu an kimde: sırası gelmiş açık adımlar */}
      {currentSteps.length > 0 && !c.closed_at && (
        <div className="card px-4 py-3">
          <p className="text-xs font-medium tracking-wide text-ink-500 uppercase">
            Şu anki adım
          </p>
          <ul className="mt-1.5 space-y-1.5">
            {currentSteps.map((t) => (
              <li key={t.id} className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-sm">
                <span className="font-semibold text-ink-900">{t.title}</span>
                <span className="text-ink-600">
                  — Sorumlu:{" "}
                  {t.assignee_name
                    ? `${t.assignee_name} (${t.assignee_title})`
                    : "atanmadı, Fabrika Müdürü atamalı"}
                </span>
                {t.due_at && (
                  <span className="tnum text-ink-500">· en geç {fmtDate(t.due_at)}</span>
                )}
                {t.mine && <Chip tone="brand" dot>Sıra sizde</Chip>}
              </li>
            ))}
          </ul>
        </div>
      )}

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
              // Daire kararı bu kullanıcıdaysa genel bir not yerine doğrudan işi gösterilir.
              actionable.includes("DAIRE_KARAR") ? (
                <Card title="Bu dosyanın itirazı sizin değerlendirmenizde">
                  <p className="text-sm leading-relaxed text-ink-600">
                    {c.escalation_reason}
                    {c.escalation_due_at && (
                      <> Karar en geç <strong>{fmtDate(c.escalation_due_at)}</strong> tarihine
                      kadar verilmelidir.</>
                    )}
                  </p>
                  <Link href="/panel/itirazlar" className="btn btn-primary mt-3">
                    İtiraz değerlendirme sayfasına git
                  </Link>
                </Card>
              ) : (
                <Notice tone="ink" title="Genel Müdürlük görünümü">
                  Fabrika süreç işlemleri yalnızca ilgili fabrika personeli tarafından yapılır.
                  İtiraz değerlendirmeleri için{" "}
                  <Link href="/panel/itirazlar" className="link">İtiraz değerlendirmeleri</Link>{" "}
                  sayfasını kullanın.
                </Notice>
              )
            ) : (
              <IslemlerPanel ctx={ctx} />
            )
          )}

          {tab === "gorevler" && (
            <GorevlerTab complaintId={c.id} steps={steps} holidays={holidays}
                         assignableBy={assignableBy} canAssign={canAssign} canAddNote={!gm} />
          )}

          {tab === "ekip" && (
            <EkipTab
              complaintId={c.id}
              team={team}
              staff={ekipVerisi.staff}
              canManage={canDo("EKIP_KUR")}
              factories={factories}
              currentFactoryId={c.factory_id}
              suggestion={ekipVerisi.suggestion}
              teamFormed={c.team_formed_at}
              redirectedAt={c.redirected_at}
              redirectedFrom={
                c.redirected_from_id
                  ? (factories.find((f) => f.id === c.redirected_from_id)?.name ?? null)
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
              canSample={canDo("NUMUNE_AL")}
              canAnalyze={canDo("ANALIZ_GIR")}
              accept={ACCEPT_ATTR}
            />
          )}

          {tab === "belgeler" && (
            <BelgelerTab complaintId={c.id} documents={documents} signableIds={signableIds}
                         canPrepare={canDo("TUTANAK_HAZIRLA") || canDo("MUSTERI_BILGI")} />
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
            <TaskSummary steps={steps} holidays={holidays} />
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
