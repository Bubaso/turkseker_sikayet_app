import { fmtDate, fmtDateTime, slaInfo, type HolidaySet } from "@/lib/dates";
import { TASK_CATALOG, type TaskCode } from "@/lib/workflow";
import { ROLE_LABEL, type Role } from "@/lib/roles";
import type { TaskView } from "@/lib/types";
import { ActionButton, ActionForm } from "@/components/action-form";
import { Card, Chip, EmptyState, SlaChip, TaskStatusChip } from "@/components/ui";
import { noteAction, taskStatusAction } from "@/app/panel/actions";

/** Görev kartları listesi — her kartın sorumlusu, son tarihi ve dayanağı. */
export function GorevlerTab({
  complaintId, tasks, holidays, canUpdate,
}: {
  complaintId: number;
  tasks: TaskView[];
  holidays: HolidaySet;
  canUpdate: boolean;
}) {
  const open = tasks.filter((t) => t.status === "BEKLEMEDE" || t.status === "DEVAM_EDIYOR");
  const done = tasks.filter((t) => t.status !== "BEKLEMEDE" && t.status !== "DEVAM_EDIYOR");

  function card(t: TaskView) {
    const sla = slaInfo(t.due_at, t.completed_at, holidays);
    const tpl = TASK_CATALOG[t.code as TaskCode];
    return (
      <li key={t.id} className="p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-semibold text-ink-900">{t.title}</h3>
              <TaskStatusChip status={t.status} />
              <SlaChip sla={sla} compact />
            </div>
            <p className="mt-1 text-sm leading-relaxed text-ink-600">
              {t.description ?? tpl?.description}
            </p>
            <dl className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs text-ink-500">
              <div>
                <dt className="inline font-medium">Sorumlu: </dt>
                <dd className="inline">
                  {t.assignee_name
                    ? `${t.assignee_name} (${t.assignee_title})`
                    : t.assignee_role
                      ? `${ROLE_LABEL[t.assignee_role as Role] ?? t.assignee_role} (atanmadı)`
                      : "—"}
                </dd>
              </div>
              <div>
                <dt className="inline font-medium">Son tarih: </dt>
                <dd className="tnum inline">{fmtDate(t.due_at)}</dd>
              </div>
              {t.completed_at && (
                <div>
                  <dt className="inline font-medium">Tamamlanma: </dt>
                  <dd className="inline">
                    {fmtDateTime(t.completed_at)}
                    {t.completed_by_name && ` — ${t.completed_by_name}`}
                  </dd>
                </div>
              )}
              {tpl?.basis && (
                <div>
                  <dt className="inline font-medium">Dayanak: </dt>
                  <dd className="inline">{tpl.basis}</dd>
                </div>
              )}
            </dl>
            {t.result_note && (
              <p className="mt-2 rounded-[5px] border border-ink-200 bg-ink-50 px-2.5 py-1.5 text-xs whitespace-pre-wrap text-ink-700">
                {t.result_note}
              </p>
            )}
          </div>

          {canUpdate && (t.status === "BEKLEMEDE" || t.status === "DEVAM_EDIYOR") && (
            <div className="flex shrink-0 flex-wrap gap-2">
              {t.status === "BEKLEMEDE" && (
                <ActionButton action={taskStatusAction} complaintId={complaintId}
                              label="Başladım" fields={{ taskId: t.id, status: "DEVAM_EDIYOR" }} />
              )}
              <ActionButton action={taskStatusAction} complaintId={complaintId}
                            label="Gerek yok" tone="secondary"
                            fields={{ taskId: t.id, status: "GEREKSIZ", note: "Fabrika tarafından gereksiz görüldü" }}
                            confirm="Bu görev kapatılacak ve süreçte atlanmış sayılacak. Onaylıyor musunuz?" />
            </div>
          )}
        </div>
      </li>
    );
  }

  return (
    <div className="space-y-5">
      <Card title={`Açık görevler (${open.length})`} bodyClass="">
        {open.length === 0 ? (
          <EmptyState title="Açık görev yok" hint="Dosyadaki tüm adımlar tamamlanmış." />
        ) : (
          <ul className="divide-y divide-ink-200">{open.map(card)}</ul>
        )}
      </Card>

      {done.length > 0 && (
        <Card title={`Tamamlanan görevler (${done.length})`} bodyClass="">
          <ul className="divide-y divide-ink-200">{done.map(card)}</ul>
        </Card>
      )}

      <Card title="Dosya notu ekle">
        <ActionForm action={noteAction} complaintId={complaintId} submitLabel="Notu kaydet">
          <div>
            <label className="label" htmlFor="note">Not</label>
            <textarea id="note" name="note" rows={3} required className="input"
                      placeholder="Dosyayla ilgili iç not. Geçmiş sekmesinde görünür, müşteriye gönderilmez." />
          </div>
        </ActionForm>
      </Card>
    </div>
  );
}

/** Sağ kolondaki kompakt görev özeti. */
export function TaskSummary({ tasks, holidays }: { tasks: TaskView[]; holidays: HolidaySet }) {
  return (
    <ol className="divide-y divide-ink-100">
      {tasks.map((t) => {
        const sla = slaInfo(t.due_at, t.completed_at, holidays);
        const closed = t.status === "TAMAMLANDI" || t.status === "GEREKSIZ";
        return (
          <li key={t.id} className="flex items-start gap-2.5 px-4 py-2">
            <span
              className={
                "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border text-[10px] " +
                (t.status === "TAMAMLANDI" ? "border-ok-600 bg-ok-600 text-white"
                  : t.status === "GEREKSIZ" ? "border-ink-300 bg-ink-200 text-ink-500"
                  : sla.state === "GECIKTI" ? "border-danger-600 bg-danger-600 text-white"
                  : "border-ink-300 bg-white")
              }
              aria-hidden
            >
              {closed ? (t.status === "TAMAMLANDI" ? "✓" : "–") : ""}
            </span>
            <div className="min-w-0 flex-1">
              <p className={`truncate text-xs ${closed ? "text-ink-500" : "font-medium text-ink-800"}`}
                 title={t.title}>
                {t.title}
              </p>
              {!closed && (
                <p className="text-[11px] text-ink-500">
                  {t.assignee_name ?? "atanmadı"} · {fmtDate(t.due_at)}
                </p>
              )}
            </div>
            {!closed && sla.state === "GECIKTI" && <Chip tone="danger">gecikme</Chip>}
          </li>
        );
      })}
    </ol>
  );
}
