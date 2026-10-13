/* ===========================================================================
   İş görev kartları.
   Görevler şikâyetin SLA kilometre taşlarından son tarih alır; sorumlu olarak
   fabrikadaki ilgili unvan atanır.
   =========================================================================== */

import { all, one, run } from "@/lib/db";
import { isGmRole } from "@/lib/roles";
import { TASK_CATALOG, dueFieldFor, type TaskCode } from "@/lib/workflow";
import { TASK_STATUS } from "@/lib/domain";
import type { Complaint, TaskView } from "@/lib/types";
import type { SessionUser } from "./auth";
import { EVENT_TYPE, logEvent } from "./events";

/** Fabrikada verilen rolü taşıyan ilk etkin kullanıcı. */
function userByRole(factoryId: number | null, role: string): number | null {
  if (!factoryId) return null;
  const r = one<{ id: number }>(
    "SELECT id FROM users WHERE factory_id = ? AND role = ? AND is_active = 1 ORDER BY id LIMIT 1",
    factoryId, role,
  );
  return r?.id ?? null;
}

function deptUser(departmentId: number | null): number | null {
  if (!departmentId) return null;
  const r = one<{ id: number }>(
    "SELECT id FROM users WHERE department_id = ? AND is_active = 1 ORDER BY id LIMIT 1",
    departmentId,
  );
  return r?.id ?? null;
}

/**
 * Verilen görev kodlarını şikâyete ekler. Zaten var olanlar atlanır
 * (tasks tablosunda complaint_id + code tekildir).
 */
export function createTasks(complaint: Complaint, codes: TaskCode[]): number {
  let added = 0;
  for (const code of codes) {
    const t = TASK_CATALOG[code];
    if (!t) continue;

    const field = dueFieldFor(t.dueSource);
    const due = field ? ((complaint as unknown as Record<string, string | null>)[field] ?? null) : null;

    const isDeptTask = isGmRole(t.role);
    const assignee = isDeptTask
      ? deptUser(complaint.escalated_dept_id)
      : userByRole(complaint.factory_id, t.role);

    const res = run(
      `INSERT INTO tasks
         (complaint_id, code, title, description, assignee_id, assignee_role,
          factory_id, department_id, due_at, status, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'BEKLEMEDE', ?)
       ON CONFLICT(complaint_id, code) DO NOTHING`,
      complaint.id, code, t.title, t.description, assignee, t.role,
      isDeptTask ? null : complaint.factory_id,
      isDeptTask ? complaint.escalated_dept_id : null,
      due, t.sortOrder,
    );
    if (res.changes > 0) added++;
  }
  return added;
}

/** Yönlendirme sonrası tamamlanmamış görevleri yeni fabrikanın personeline devreder. */
export function reassignOpenTasks(complaintId: number, newFactoryId: number): void {
  const open = all<{ id: number; assignee_role: string | null }>(
    "SELECT id, assignee_role FROM tasks WHERE complaint_id = ? AND status IN ('BEKLEMEDE','DEVAM_EDIYOR')",
    complaintId,
  );
  for (const t of open) {
    if (!t.assignee_role || isGmRole(t.assignee_role)) continue;
    run(
      "UPDATE tasks SET factory_id = ?, assignee_id = ? WHERE id = ?",
      newFactoryId, userByRole(newFactoryId, t.assignee_role), t.id,
    );
  }
}

/** Görevin son tarihini SLA alanındaki güncel değere eşitler. */
export function syncTaskDueDates(complaint: Complaint): void {
  const rows = all<{ id: number; code: string }>(
    "SELECT id, code FROM tasks WHERE complaint_id = ? AND status IN ('BEKLEMEDE','DEVAM_EDIYOR')",
    complaint.id,
  );
  for (const r of rows) {
    const t = TASK_CATALOG[r.code as TaskCode];
    if (!t) continue;
    const field = dueFieldFor(t.dueSource);
    if (!field) continue;
    const due = (complaint as unknown as Record<string, string | null>)[field] ?? null;
    run("UPDATE tasks SET due_at = ? WHERE id = ?", due, r.id);
  }
}

/** Bir görevi tamamlandı olarak işaretler. */
export function completeTask(
  complaintId: number,
  code: TaskCode,
  userId: number | null,
  note?: string | null,
): void {
  run(
    `UPDATE tasks
        SET status = 'TAMAMLANDI', completed_at = datetime('now'), completed_by = ?, result_note = ?
      WHERE complaint_id = ? AND code = ? AND status <> 'TAMAMLANDI'`,
    userId, note ?? null, complaintId, code,
  );
}

/** Koşulu sağlanmayan görevi "gerek yok" olarak kapatır. */
export function skipTask(complaintId: number, code: TaskCode, reason: string): void {
  run(
    `UPDATE tasks
        SET status = 'GEREKSIZ', completed_at = datetime('now'), result_note = ?
      WHERE complaint_id = ? AND code = ? AND status IN ('BEKLEMEDE','DEVAM_EDIYOR')`,
    reason, complaintId, code,
  );
}

export function setTaskStatus(taskId: number, status: string, user: SessionUser, note?: string | null): void {
  const t = one<{ complaint_id: number; title: string; status: string }>(
    "SELECT complaint_id, title, status FROM tasks WHERE id = ?",
    taskId,
  );
  if (!t) throw new Error("Görev bulunamadı.");

  const done = status === TASK_STATUS.TAMAMLANDI || status === TASK_STATUS.GEREKSIZ;
  run(
    `UPDATE tasks SET status = ?, result_note = COALESCE(?, result_note),
            completed_at = CASE WHEN ? THEN datetime('now') ELSE NULL END,
            completed_by = CASE WHEN ? THEN ? ELSE NULL END
      WHERE id = ?`,
    status, note ?? null, done ? 1 : 0, done ? 1 : 0, user.id, taskId,
  );
  logEvent({
    complaintId: t.complaint_id,
    type: EVENT_TYPE.GOREV,
    title: `Görev güncellendi: ${t.title}`,
    note: note ?? null,
    actorId: user.id,
    payload: { taskId, from: t.status, to: status },
  });
}

/** Görevi başka bir kullanıcıya atar. */
export function assignTask(taskId: number, userId: number | null, actor: SessionUser): void {
  const t = one<{ complaint_id: number; title: string }>(
    "SELECT complaint_id, title FROM tasks WHERE id = ?", taskId,
  );
  if (!t) throw new Error("Görev bulunamadı.");
  run("UPDATE tasks SET assignee_id = ? WHERE id = ?", userId, taskId);
  const target = userId
    ? one<{ full_name: string }>("SELECT full_name FROM users WHERE id = ?", userId)
    : null;
  logEvent({
    complaintId: t.complaint_id,
    type: EVENT_TYPE.GOREV,
    title: `Görev atandı: ${t.title}`,
    note: target ? `Sorumlu: ${target.full_name}` : "Sorumlu kaldırıldı",
    actorId: actor.id,
  });
}

/* --- Sorgular ------------------------------------------------------------ */

const TASK_SELECT = `
  SELECT t.*, u.full_name AS assignee_name, u.title AS assignee_title,
         cu.full_name AS completed_by_name,
         c.complaint_no, c.status AS complaint_status, c.customer_company,
         f.short_name AS factory_short
    FROM tasks t
    JOIN complaints c ON c.id = t.complaint_id
    LEFT JOIN users u  ON u.id = t.assignee_id
    LEFT JOIN users cu ON cu.id = t.completed_by
    LEFT JOIN factories f ON f.id = c.factory_id
`;

export function complaintTasks(complaintId: number): TaskView[] {
  return all<TaskView>(`${TASK_SELECT} WHERE t.complaint_id = ? ORDER BY t.sort_order, t.id`, complaintId);
}

export interface MyTaskFilter {
  onlyOpen?: boolean;
  limit?: number;
}

/**
 * Kullanıcının görevleri: doğrudan kendisine atananlar ile kendi fabrikasında
 * kendi rolüne açık olanlar.
 */
export function myTasks(user: SessionUser, filter: MyTaskFilter = {}): TaskView[] {
  const openOnly = filter.onlyOpen !== false;
  const statusClause = openOnly ? "AND t.status IN ('BEKLEMEDE','DEVAM_EDIYOR')" : "";
  const limit = filter.limit ? `LIMIT ${Number(filter.limit)}` : "";

  if (isGmRole(user.role)) {
    return all<TaskView>(
      `${TASK_SELECT}
        WHERE (t.assignee_id = ? OR (t.department_id IS NOT NULL AND t.department_id = ?))
          ${statusClause}
        ORDER BY (t.due_at IS NULL), t.due_at, t.sort_order ${limit}`,
      user.id, user.department_id,
    );
  }

  return all<TaskView>(
    `${TASK_SELECT}
      WHERE (t.assignee_id = ?
             OR (t.assignee_id IS NULL AND t.factory_id = ? AND t.assignee_role = ?))
        ${statusClause}
      ORDER BY (t.due_at IS NULL), t.due_at, t.sort_order ${limit}`,
    user.id, user.factory_id, user.role,
  );
}

/** Fabrikanın (ya da tümünün) açık görevleri — takvim ve panoda kullanılır. */
export function openTasksFor(factoryId: number | null, limit = 500): TaskView[] {
  if (factoryId) {
    return all<TaskView>(
      `${TASK_SELECT}
        WHERE t.status IN ('BEKLEMEDE','DEVAM_EDIYOR') AND c.factory_id = ?
        ORDER BY (t.due_at IS NULL), t.due_at LIMIT ?`,
      factoryId, limit,
    );
  }
  return all<TaskView>(
    `${TASK_SELECT}
      WHERE t.status IN ('BEKLEMEDE','DEVAM_EDIYOR')
      ORDER BY (t.due_at IS NULL), t.due_at LIMIT ?`,
    limit,
  );
}

export function taskById(id: number): TaskView | undefined {
  return one<TaskView>(`${TASK_SELECT} WHERE t.id = ?`, id);
}
