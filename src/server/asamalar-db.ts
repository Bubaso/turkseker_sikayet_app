/* ===========================================================================
   Aşama satırlarının veritabanı işlemleri ve görünüm sorguları.

   Aşamalar tasks tablosunda tutulur; eski 14 görevli modelin yerine artık
   en çok sekiz aşama vardır ve her biri bir kilometre taşına karşılık gelir.
   =========================================================================== */

import { all, one, run } from "@/lib/db";
import { ROLE_LABEL, can, type Role } from "@/lib/roles";
import { TASK_STATUS } from "@/lib/domain";
import {
  ASAMALAR, bekleyenOnculler, durumHaritasi, sureAlani, type AsamaKodu,
} from "@/lib/asamalar";
import type { Complaint, TaskView } from "@/lib/types";
import type { SessionUser } from "./auth";

function rolSahibi(factoryId: number | null, role: string): number | null {
  if (!factoryId) return null;
  return one<{ id: number }>(
    "SELECT id FROM users WHERE factory_id = ? AND role = ? AND is_active = 1 ORDER BY id LIMIT 1",
    factoryId, role,
  )?.id ?? null;
}

/** Ekip kurulurken bu aşamaya atanan kişi (varsa). */
function gorevlendirilen(complaintId: number, kod: AsamaKodu): number | null {
  return one<{ user_id: number }>(
    "SELECT user_id FROM stage_assignments WHERE complaint_id = ? AND code = ?",
    complaintId, kod,
  )?.user_id ?? null;
}

function daireSahibi(departmentId: number | null): number | null {
  if (!departmentId) return null;
  return one<{ id: number }>(
    "SELECT id FROM users WHERE department_id = ? AND is_active = 1 ORDER BY id LIMIT 1",
    departmentId,
  )?.id ?? null;
}

/** Verilen aşamaları dosyaya ekler; zaten varsa atlanır. */
export function asamalariAc(c: Complaint, kodlar: AsamaKodu[]): number {
  let eklenen = 0;
  for (const kod of kodlar) {
    const a = ASAMALAR[kod];
    if (!a) continue;
    const alan = sureAlani(a.sure);
    const sonTarih = alan
      ? ((c as unknown as Record<string, string | null>)[alan] ?? null)
      : null;
    const daireAsamasi = a.rol.startsWith("GM_");
    /*
     * Sorumlu sırasıyla aranır: Fabrika Müdürünün ekip kurarken yaptığı
     * görevlendirme, yoksa unvana göre varsayılan. Böylece karar sonrası
     * açılan aşamalar da (iade/değişim, resmî yazı) müdürün dediği kişiye
     * düşer; ekibi tanımayan bir varsayılan devreye girmez.
     */
    const sorumlu = daireAsamasi
      ? daireSahibi(c.escalated_dept_id)
      : (gorevlendirilen(c.id, kod) ?? rolSahibi(c.factory_id, a.rol));

    const r = run(
      `INSERT INTO tasks
         (complaint_id, code, title, description, assignee_id, assignee_role,
          factory_id, department_id, due_at, status, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'BEKLEMEDE', ?)
       ON CONFLICT(complaint_id, code) DO NOTHING`,
      c.id, kod, a.baslik, a.aciklama, sorumlu, a.rol,
      daireAsamasi ? null : c.factory_id,
      daireAsamasi ? c.escalated_dept_id : null,
      sonTarih, a.sira,
    );
    if (r.changes > 0) eklenen++;
  }
  return eklenen;
}

export function asamayiKapat(
  complaintId: number, kod: AsamaKodu, userId: number | null,
  not?: string | null, tarih?: string | null,
): void {
  run(
    `UPDATE tasks SET status = 'TAMAMLANDI',
            completed_at = COALESCE(?, datetime('now')), completed_by = ?, result_note = ?
      WHERE complaint_id = ? AND code = ? AND status <> 'TAMAMLANDI'`,
    tarih ?? null, userId, not ?? null, complaintId, kod,
  );
}

export function asamayiAtla(complaintId: number, kod: AsamaKodu, gerekce: string): void {
  run(
    `UPDATE tasks SET status = 'GEREKSIZ', completed_at = datetime('now'), result_note = ?
      WHERE complaint_id = ? AND code = ? AND status IN ('BEKLEMEDE','DEVAM_EDIYOR')`,
    gerekce, complaintId, kod,
  );
}

/** Açık aşamaların son tarihlerini şikâyetteki güncel değerlere eşitler. */
export function sonTarihleriEsitle(c: Complaint): void {
  for (const r of all<{ id: number; code: string }>(
    "SELECT id, code FROM tasks WHERE complaint_id = ? AND status IN ('BEKLEMEDE','DEVAM_EDIYOR')",
    c.id,
  )) {
    const a = ASAMALAR[r.code as AsamaKodu];
    if (!a) continue;
    const alan = sureAlani(a.sure);
    if (!alan) continue;
    run("UPDATE tasks SET due_at = ? WHERE id = ?",
        (c as unknown as Record<string, string | null>)[alan] ?? null, r.id);
  }
}

/* --- Görünüm -------------------------------------------------------------- */

const SELECT = `
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

export interface AsamaGorunumu extends TaskView {
  kapandi: boolean;
  sirasiGeldi: boolean;
  benim: boolean;
  islenebilir: boolean;
  belgeli: boolean;
  belgeAdi: string | null;
  bekleyen: { kod: string; baslik: string }[];
}

export function dosyaAsamalari(complaintId: number, user: SessionUser): AsamaGorunumu[] {
  const satirlar = all<TaskView>(
    `${SELECT} WHERE t.complaint_id = ? ORDER BY t.sort_order, t.id`, complaintId,
  );
  const harita = durumHaritasi(satirlar);
  const mudurMu = user.role === "FABRIKA_MUDURU" || user.role === "SISTEM_YONETICISI";

  return satirlar.map((t) => {
    const a = ASAMALAR[t.code as AsamaKodu];
    const kapandi = t.status === TASK_STATUS.TAMAMLANDI || t.status === TASK_STATUS.GEREKSIZ;
    const bekleyen = bekleyenOnculler(t.code as AsamaKodu, harita);
    const sirasiGeldi = bekleyen.length === 0;
    const benim = t.assignee_id !== null && t.assignee_id === user.id;
    const daireMi = user.role === "GM_DAIRE" && t.department_id === user.department_id;
    return {
      ...t,
      kapandi,
      sirasiGeldi,
      benim,
      islenebilir: !kapandi && sirasiGeldi && (benim || mudurMu || daireMi),
      belgeli: a?.belgeli ?? false,
      belgeAdi: a?.belgeAdi ?? null,
      bekleyen: bekleyen.map((b) => ({ kod: b, baslik: ASAMALAR[b].baslik })),
    };
  });
}

/** Kullanıcının üzerindeki açık aşamalar. */
export function benimAsamalarim(user: SessionUser, limit?: number): TaskView[] {
  const son = limit ? `LIMIT ${Number(limit)}` : "";
  if (user.role === "GM_DAIRE" || user.role === "GM_UST_YONETIM") {
    return all<TaskView>(
      `${SELECT} WHERE t.status IN ('BEKLEMEDE','DEVAM_EDIYOR')
          AND (t.assignee_id = ? OR (t.department_id IS NOT NULL AND t.department_id = ?))
        ORDER BY (t.due_at IS NULL), t.due_at, t.sort_order ${son}`,
      user.id, user.department_id,
    );
  }
  if (can(user.role, "GOREV_ATA")) {
    return all<TaskView>(
      `${SELECT} WHERE t.status IN ('BEKLEMEDE','DEVAM_EDIYOR')
          AND (t.assignee_id = ? OR (t.assignee_id IS NULL AND t.factory_id = ?))
        ORDER BY (t.due_at IS NULL), t.due_at, t.sort_order ${son}`,
      user.id, user.factory_id,
    );
  }
  return all<TaskView>(
    `${SELECT} WHERE t.status IN ('BEKLEMEDE','DEVAM_EDIYOR') AND t.assignee_id = ?
      ORDER BY (t.due_at IS NULL), t.due_at, t.sort_order ${son}`,
    user.id,
  );
}

export function fabrikaAcikAsamalari(factoryId: number | null, limit = 500): TaskView[] {
  if (factoryId) {
    return all<TaskView>(
      `${SELECT} WHERE t.status IN ('BEKLEMEDE','DEVAM_EDIYOR') AND c.factory_id = ?
        ORDER BY (t.due_at IS NULL), t.due_at LIMIT ?`, factoryId, limit,
    );
  }
  return all<TaskView>(
    `${SELECT} WHERE t.status IN ('BEKLEMEDE','DEVAM_EDIYOR')
      ORDER BY (t.due_at IS NULL), t.due_at LIMIT ?`, limit,
  );
}

/** Aşamanın sorumlusunu değiştirir — Fabrika Müdürünün yetkisi. */
export function sorumluyuDegistir(taskId: number, userId: number, actor: SessionUser): void {
  const t = one<{ complaint_id: number; title: string }>(
    "SELECT complaint_id, title FROM tasks WHERE id = ?", taskId,
  );
  if (!t) throw new Error("Aşama bulunamadı.");
  run("UPDATE tasks SET assignee_id = ? WHERE id = ?", userId, taskId);
  void actor;
}

/** Bir aşamaya atanabilecek fabrika personeli. */
export function atanabilirPersonel(
  factoryId: number,
): { id: number; full_name: string; title: string }[] {
  return all(
    `SELECT id, full_name, title FROM users
      WHERE factory_id = ? AND is_active = 1 ORDER BY id`, factoryId,
  );
}

/* --- Ekip görünümü ------------------------------------------------------- */

export interface EkipUyesiGorunum {
  user_id: number;
  full_name: string;
  title: string;
  unit: string;
  is_lead: number;
  /** Bu kişiye düşen aşamaların kodları. */
  asamalar: AsamaKodu[];
}

/**
 * Dosyanın inceleme ekibi ve kimin hangi aşamadan sorumlu olduğu.
 *
 * Ekip kurulduktan sonra bir daha görünmüyordu; oysa "bu dosyada kim vardı"
 * sorusu dosya kapandıktan sonra da sorulur.
 */
export function dosyaEkibi(complaintId: number): EkipUyesiGorunum[] {
  const uyeler = all<Omit<EkipUyesiGorunum, "asamalar">>(
    `SELECT tm.user_id, u.full_name, u.title, tm.unit, tm.is_lead
       FROM team_members tm JOIN users u ON u.id = tm.user_id
      WHERE tm.complaint_id = ? ORDER BY tm.is_lead DESC, tm.id`,
    complaintId,
  );
  if (uyeler.length === 0) return [];

  /*
   * Yalnızca gerçekten açılmış aşamalar. Görevlendirme ekip kurulurken beş
   * aşamanın tamamına yazılır, ama itiraz ve iade/değişim yalnızca koşulu
   * oluşursa açılır. Açılmamış aşamayı ekip kartında rozetlemek, yapılmamış
   * işi yapılmış gibi gösteriyordu.
   */
  const gorevler = all<{ code: string; user_id: number }>(
    `SELECT sa.code, sa.user_id FROM stage_assignments sa
      WHERE sa.complaint_id = ?
        AND EXISTS (SELECT 1 FROM tasks t
                     WHERE t.complaint_id = sa.complaint_id AND t.code = sa.code)`,
    complaintId,
  );
  const sirali = (k: string) => ASAMALAR[k as AsamaKodu]?.sira ?? 999;

  return uyeler.map((u) => ({
    ...u,
    asamalar: gorevler
      .filter((g) => g.user_id === u.user_id)
      .map((g) => g.code as AsamaKodu)
      .sort((a, b) => sirali(a) - sirali(b)),
  }));
}

export function rolEtiketi(role: string | null): string {
  if (!role) return "—";
  return ROLE_LABEL[role as Role] ?? role;
}
