import { fmtDate, fmtDateTime, slaInfo, type HolidaySet } from "@/lib/dates";
import { TASK_CATALOG, type TaskCode } from "@/lib/workflow";
import type { StepView } from "@/server/tasks";
import type { TaskView } from "@/lib/types";
import { ActionButton, ActionForm } from "@/components/action-form";
import { Card, Chip, EmptyState } from "@/components/ui";
import { assignTaskAction, noteAction, taskStatusAction } from "@/app/panel/actions";

export interface AssigneeOption {
  id: number;
  full_name: string;
  title: string;
}

/** Bir adımın gösterim durumu — şeritteki renk ve etiket buradan gelir. */
type StepState = "tamam" | "atlandi" | "sirasizde" | "sirada-baskasinda" | "bekliyor";

function stateOf(s: StepView): StepState {
  if (s.status === "TAMAMLANDI") return "tamam";
  if (s.status === "GEREKSIZ") return "atlandi";
  if (!s.ready) return "bekliyor";
  return s.mine ? "sirasizde" : "sirada-baskasinda";
}

/**
 * Süreç adımları şeridi. Her adım sırayla ve tek sorumluyla gösterilir:
 * düğmeler yalnızca sırası gelmiş ve sorumlusu o kişi olan adımda çıkar.
 * Sorumluyu değiştirmek Fabrika Müdürüne aittir.
 */
export function GorevlerTab({
  complaintId, steps, holidays, assignableBy, canAssign, canAddNote,
}: {
  complaintId: number;
  steps: StepView[];
  holidays: HolidaySet;
  /** Adım kodu → o adıma atanabilecek personel. */
  assignableBy: Record<string, AssigneeOption[]>;
  canAssign: boolean;
  canAddNote: boolean;
}) {
  const openCount = steps.filter((s) => !s.settled).length;

  return (
    <div className="space-y-5">
      <Card
        title={`Süreç adımları (${steps.length - openCount} / ${steps.length} tamamlandı)`}
        bodyClass=""
      >
        {steps.length === 0 ? (
          <EmptyState title="Adım yok" hint="Bu dosyada henüz süreç adımı açılmamış." />
        ) : (
          <ol className="divide-y divide-ink-200">
            {steps.map((s, i) => (
              <StepRow
                key={s.id}
                index={i + 1}
                step={s}
                complaintId={complaintId}
                holidays={holidays}
                candidates={assignableBy[s.code] ?? []}
                canAssign={canAssign}
              />
            ))}
          </ol>
        )}
      </Card>

      {canAddNote && (
        <Card title="Dosya notu ekle">
          <ActionForm action={noteAction} complaintId={complaintId} submitLabel="Notu kaydet">
            <div>
              <label className="label" htmlFor="note">Not</label>
              <textarea id="note" name="note" rows={3} required className="input"
                        placeholder="Dosyaya ilişkin açıklama, telefon görüşmesi özeti vb." />
            </div>
          </ActionForm>
        </Card>
      )}
    </div>
  );
}

function StepRow({
  index, step, complaintId, holidays, candidates, canAssign,
}: {
  index: number;
  step: StepView;
  complaintId: number;
  holidays: HolidaySet;
  candidates: AssigneeOption[];
  canAssign: boolean;
}) {
  const state = stateOf(step);
  const sla = slaInfo(step.due_at, step.completed_at, holidays);
  const tpl = TASK_CATALOG[step.code as TaskCode];
  const geciken = !step.settled && sla.state === "GECIKTI";

  return (
    <li className={`flex gap-3 p-4 sm:gap-4 sm:p-5 ${state === "sirasizde" ? "bg-brand-50/60" : ""}`}>
      <StepMarker index={index} state={state} overdue={geciken} />

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className={`text-sm font-semibold ${step.settled ? "text-ink-500" : "text-ink-900"}`}>
            {step.title}
          </h3>
          <StateChip state={state} ownerName={step.assignee_name} />
          {geciken && <Chip tone="danger" dot>Gecikti</Chip>}
        </div>

        <p className="mt-1 text-sm leading-relaxed text-ink-600">
          {step.description ?? tpl?.description}
        </p>

        <dl className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs text-ink-500">
          <div>
            <dt className="inline font-medium">Sorumlu: </dt>
            <dd className="inline">
              {step.assignee_name
                ? `${step.assignee_name} (${step.assignee_title})`
                : "atanmadı — Fabrika Müdürü atamalı"}
            </dd>
          </div>
          {!step.settled && step.due_at && (
            <div>
              <dt className="inline font-medium">En geç: </dt>
              <dd className="tnum inline">{fmtDate(step.due_at)}</dd>
            </div>
          )}
          {step.completed_at && (
            <div>
              <dt className="inline font-medium">
                {step.status === "GEREKSIZ" ? "Atlandı: " : "Tamamlandı: "}
              </dt>
              <dd className="inline">
                {fmtDateTime(step.completed_at)}
                {step.completed_by_name && ` — ${step.completed_by_name}`}
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

        {state === "bekliyor" && step.blockedBy.length > 0 && (
          <p className="mt-2 rounded-[5px] border border-ink-200 bg-ink-50 px-2.5 py-1.5 text-xs text-ink-600">
            Sırası gelmedi. Önce tamamlanmalı:{" "}
            {step.blockedBy.map((b) => `${b.title}${b.owner ? ` — ${b.owner}` : ""}`).join("; ")}
          </p>
        )}

        {step.result_note && (
          <p className="mt-2 rounded-[5px] border border-ink-200 bg-ink-50 px-2.5 py-1.5 text-xs whitespace-pre-wrap text-ink-700">
            {step.result_note}
          </p>
        )}

        {(step.actionable || (canAssign && !step.settled)) && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {step.actionable && step.status === "BEKLEMEDE" && (
              <ActionButton action={taskStatusAction} complaintId={complaintId}
                            label="Başladım" tone="primary"
                            fields={{ taskId: step.id, status: "DEVAM_EDIYOR" }} />
            )}
            {canAssign && !step.settled && (
              <ActionButton action={taskStatusAction} complaintId={complaintId}
                            label="Bu adım gerekmiyor" tone="secondary"
                            fields={{ taskId: step.id, status: "GEREKSIZ",
                                      note: "Fabrika Müdürü tarafından gerekli görülmedi" }}
                            confirm="Bu adım atlanmış sayılacak ve süreçte kapatılacak. Onaylıyor musunuz?" />
            )}
          </div>
        )}

        {canAssign && !step.settled && candidates.length > 0 && (
          <details className="mt-2.5">
            <summary className="cursor-pointer text-xs font-medium text-brand-700 hover:underline">
              Sorumluyu değiştir
            </summary>
            <div className="mt-2 max-w-md">
              <ActionForm action={assignTaskAction} complaintId={complaintId}
                         submitLabel="Sorumluyu güncelle" submitTone="secondary"
                         className="flex flex-wrap items-end gap-2" compact>
                <input type="hidden" name="taskId" value={step.id} />
                <div className="min-w-[14rem] flex-1">
                  <label className="label" htmlFor={`assignee-${step.id}`}>
                    Bu adımı yürütecek personel
                  </label>
                  <select id={`assignee-${step.id}`} name="assigneeId" required className="input"
                          defaultValue={step.assignee_id ?? ""}>
                    <option value="" disabled>Seçiniz</option>
                    {candidates.map((u) => (
                      <option key={u.id} value={u.id}>{u.full_name} — {u.title}</option>
                    ))}
                  </select>
                </div>
              </ActionForm>
              <p className="hint mt-1">
                Listede yalnızca bu adımı yürütme yetkisi olan personel görünür.
              </p>
            </div>
          </details>
        )}
      </div>
    </li>
  );
}

function StepMarker({
  index, state, overdue,
}: { index: number; state: StepState; overdue: boolean }) {
  const base = "flex size-7 shrink-0 items-center justify-center rounded-full border text-xs font-semibold";
  const look =
    state === "tamam" ? "border-ok-600 bg-ok-600 text-white"
    : state === "atlandi" ? "border-ink-300 bg-ink-200 text-ink-500"
    : state === "sirasizde" ? "border-brand-600 bg-brand-600 text-white"
    : overdue ? "border-danger-600 bg-danger-50 text-danger-700"
    : state === "sirada-baskasinda" ? "border-brand-600 bg-white text-brand-700"
    : "border-ink-300 bg-white text-ink-400";

  return (
    <span className={`${base} ${look}`} aria-hidden>
      {state === "tamam" ? "✓" : state === "atlandi" ? "–" : index}
    </span>
  );
}

function StateChip({ state, ownerName }: { state: StepState; ownerName?: string | null }) {
  switch (state) {
    case "tamam": return <Chip tone="ok">Tamamlandı</Chip>;
    case "atlandi": return <Chip tone="ink">Atlandı</Chip>;
    case "sirasizde": return <Chip tone="brand" dot>Sıra sizde</Chip>;
    case "sirada-baskasinda":
      return <Chip tone="warn">Sıra: {ownerName ?? "sorumlu atanmadı"}</Chip>;
    default: return <Chip tone="ink">Sırada bekliyor</Chip>;
  }
}

/** Kenar çubuğundaki kısa özet şeridi. */
export function TaskSummary({
  steps, holidays,
}: { steps: StepView[]; holidays: HolidaySet }) {
  return (
    <ol className="divide-y divide-ink-100">
      {steps.map((s, i) => {
        const sla = slaInfo(s.due_at, s.completed_at, holidays);
        const state = stateOf(s);
        return (
          <li key={s.id} className="flex items-start gap-2.5 px-4 py-2">
            <span
              className={
                "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border text-[9px] font-semibold " +
                (state === "tamam" ? "border-ok-600 bg-ok-600 text-white"
                  : state === "atlandi" ? "border-ink-300 bg-ink-200 text-ink-500"
                  : state === "sirasizde" ? "border-brand-600 bg-brand-600 text-white"
                  : !s.settled && sla.state === "GECIKTI" ? "border-danger-600 bg-danger-600 text-white"
                  : "border-ink-300 bg-white text-ink-400")
              }
              aria-hidden
            >
              {state === "tamam" ? "✓" : state === "atlandi" ? "–" : i + 1}
            </span>
            <div className="min-w-0 flex-1">
              <p className={`truncate text-xs ${s.settled ? "text-ink-500" : "font-medium text-ink-800"}`}
                 title={s.title}>
                {s.title}
              </p>
              {!s.settled && (
                <p className="text-[11px] text-ink-500">
                  {state === "bekliyor"
                    ? "sırada bekliyor"
                    : `${s.assignee_name ?? "atanmadı"} · ${fmtDate(s.due_at)}`}
                </p>
              )}
            </div>
            {!s.settled && sla.state === "GECIKTI" && <Chip tone="danger">gecikme</Chip>}
          </li>
        );
      })}
    </ol>
  );
}

/** Eski imza ile çağrılan yerler için — artık kullanılmıyor. */
export type { TaskView };
