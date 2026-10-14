/* ===========================================================================
   Tek sorumlu ve sıra bekçisi.

   Süreçteki her adım tek bir kişinin üzerindedir. Rol yetkisi yalnızca
   "bu göreve kim atanabilir" sorusunu yanıtlar; işi fiilen yapma hakkı
   görevin üzerindeki kişiye aittir. Bekçi dört şeyi birlikte doğrular:
     1. kullanıcı dosyanın fabrikasına erişebiliyor mu,
     2. adım bu dosyada açık mı,
     3. öncül adımlar kapanmış mı (sıra geldi mi),
     4. işlemi yapan, görevin sorumlusu mu.
   =========================================================================== */

import { all, one } from "@/lib/db";
import { TASK_STATUS } from "@/lib/domain";
import { ROLE_LABEL, can, type Role } from "@/lib/roles";
import {
  TASK_CATALOG, blockingPrerequisites, toTaskStatusMap, type TaskCode,
} from "@/lib/workflow";
import { canAccessFactory, requireUser, type SessionUser } from "./auth";

interface TaskRow {
  id: number;
  code: string;
  title: string;
  status: string;
  assignee_id: number | null;
  assignee_role: string | null;
}

function ownerOf(userId: number): string {
  const u = one<{ full_name: string; title: string }>(
    "SELECT full_name, title FROM users WHERE id = ?", userId,
  );
  return u ? `${u.full_name} (${u.title})` : "başka bir personel";
}

/** Bir adımın şu anki sorumlusunu arayüz metni olarak verir. */
export function taskOwnerLabel(task: {
  assignee_id: number | null;
  assignee_role: string | null;
}): string {
  if (task.assignee_id) return ownerOf(task.assignee_id);
  if (task.assignee_role) {
    const label = ROLE_LABEL[task.assignee_role as Role] ?? task.assignee_role;
    return `${label} — sorumlu atanmadı`;
  }
  return "sorumlu atanmadı";
}

/**
 * Adımı işlemeye hakkı olan kullanıcıyı döndürür, yoksa yönlendirici bir hata
 * fırlatır. Her adım eylemi bu bekçiden geçer.
 */
export async function requireTaskTurn(
  complaintId: number,
  code: TaskCode,
): Promise<SessionUser> {
  const user = await requireUser();
  const tpl = TASK_CATALOG[code];
  if (!tpl) throw new Error("Tanımsız süreç adımı.");

  const c = one<{ factory_id: number }>(
    "SELECT factory_id FROM complaints WHERE id = ?", complaintId,
  );
  if (!c) throw new Error("Dosya bulunamadı.");
  if (!canAccessFactory(user, c.factory_id)) {
    throw new Error("Bu dosya başka bir fabrikaya ait; işlem yapma yetkiniz yok.");
  }

  const tasks = all<TaskRow>(
    "SELECT id, code, title, status, assignee_id, assignee_role FROM tasks WHERE complaint_id = ?",
    complaintId,
  );
  const task = tasks.find((t) => t.code === code);
  if (!task) {
    throw new Error(`Bu dosyada "${tpl.title}" adımı açılmamış.`);
  }
  if (task.status === TASK_STATUS.TAMAMLANDI || task.status === TASK_STATUS.GEREKSIZ) {
    throw new Error(`"${task.title}" adımı daha önce kapatılmış.`);
  }

  const blocking = blockingPrerequisites(code, toTaskStatusMap(tasks));
  if (blocking.length > 0) {
    const bekleyen = blocking.map((prev) => {
      const row = tasks.find((t) => t.code === prev);
      const owner = row ? taskOwnerLabel(row) : null;
      return `${TASK_CATALOG[prev].title}${owner ? ` — ${owner}` : ""}`;
    });
    throw new Error(
      `Bu adımın sırası gelmedi. Önce tamamlanması gereken adım: ${bekleyen.join("; ")}.`,
    );
  }

  if (task.assignee_id === null) {
    throw new Error(
      `"${task.title}" adımının sorumlusu atanmamış. Fabrika Müdürü görevi bir personele atadıktan sonra işlenebilir.`,
    );
  }
  if (task.assignee_id !== user.id) {
    throw new Error(
      `"${task.title}" adımı ${ownerOf(task.assignee_id)} üzerinde. Bir adımı yalnızca sorumlusu işler; ` +
      "sorumluyu Fabrika Müdürü değiştirebilir.",
    );
  }
  if (!can(user.role, tpl.permission)) {
    throw new Error(`Bu işlem için yetkiniz bulunmuyor (${user.title}).`);
  }

  return user;
}
