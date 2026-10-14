/* ===========================================================================
   Süreç motoru — TL PASAT 004 iş akışının tüm adımları.
   Her adım: yetki kontrolü -> veri güncellemesi -> görev kartları -> olay
   günlüğü -> müşteri bildirimi.
   =========================================================================== */

import { all, one, run, scalar, tx } from "@/lib/db";
import { addBusinessDays, today } from "@/lib/dates";
import {
  DEPT, DOC_STATUS, SLA, STATUS, VERDICT, demandIsExchange, type Verdict,
} from "@/lib/domain";
import { PERMISSIONS } from "@/lib/roles";
import {
  TASK, TASK_CATALOG, checkEscalation, escalationDepartment, letterRecipients,
  postVerdictTaskCodes, tutanakTypeFor,
} from "@/lib/workflow";
import type { Complaint, Department, TeamMemberView } from "@/lib/types";
import { requireFactoryAccess, requirePermission, type SessionUser } from "./auth";
import { fmtTl } from "@/lib/format";
import { EVENT_TYPE, logEvent } from "./events";
import { requireTaskTurn } from "./task-guard";
import { completeTask, createTasks, skipTask, syncTaskDueDates } from "./tasks";
import { createDocument, submitDocument } from "./documents";
import { TEMPLATE, notifyCustomer } from "./notify";
import { holidaySet } from "./settings";

/* --- Yardımcılar --------------------------------------------------------- */

function load(complaintId: number): Complaint {
  const c = one<Complaint>("SELECT * FROM complaints WHERE id = ?", complaintId);
  if (!c) throw new Error("Şikâyet kaydı bulunamadı.");
  return c;
}

function touch(complaintId: number): void {
  run("UPDATE complaints SET updated_at = datetime('now') WHERE id = ?", complaintId);
}

function setStatus(c: Complaint, to: string, user: SessionUser | null, note?: string): void {
  if (c.status === to) return;
  run("UPDATE complaints SET status = ?, updated_at = datetime('now') WHERE id = ?", to, c.id);
  logEvent({
    complaintId: c.id,
    type: EVENT_TYPE.DURUM,
    title: "Dosya durumu değişti",
    note: note ?? null,
    fromStatus: c.status,
    toStatus: to,
    actorId: user?.id ?? null,
  });
}

function notifyCtx(c: Complaint, extra: Record<string, unknown> = {}) {
  const f = one<{ name: string }>("SELECT name FROM factories WHERE id = ?", c.factory_id);
  return {
    complaintNo: c.complaint_no,
    trackingToken: c.tracking_token,
    factoryName: f?.name,
    customerCompany: c.customer_company,
    ...extra,
  };
}

/* --- 1. Ekip oluşturma (md. 2-3) ----------------------------------------- */

export interface TeamMemberInput {
  userId: number;
  unit: string;
  isLead?: boolean;
}

export async function formTeam(
  complaintId: number,
  members: TeamMemberInput[],
  note?: string | null,
): Promise<void> {
  const user = await requireTaskTurn(complaintId, TASK.EKIP_KUR);
  const c = load(complaintId);

  if (members.length === 0) throw new Error("Ekibe en az bir personel eklenmelidir.");
  if (!members.some((m) => m.isLead)) members[0].isLead = true;

  tx(() => {
    run("DELETE FROM team_members WHERE complaint_id = ?", complaintId);
    for (const m of members) {
      run(
        `INSERT INTO team_members (complaint_id, user_id, unit, is_lead, assigned_by)
         VALUES (?, ?, ?, ?, ?)`,
        complaintId, m.userId, m.unit, m.isLead ? 1 : 0, user.id,
      );
    }
    run("UPDATE complaints SET team_formed_at = datetime('now') WHERE id = ?", complaintId);

    // Yerinde inceleme ve numune görevleri ekip liderine devredilir.
    const lead = members.find((m) => m.isLead)!;
    for (const code of [TASK.YERINDE_INCELEME, TASK.NUMUNE_AL]) {
      run(
        `UPDATE tasks SET assignee_id = ?
          WHERE complaint_id = ? AND code = ? AND status IN ('BEKLEMEDE','DEVAM_EDIYOR')`,
        lead.userId, complaintId, code,
      );
    }

    completeTask(complaintId, TASK.EKIP_KUR, user.id, note ?? null);

    const names = all<{ full_name: string; title: string }>(
      `SELECT u.full_name, u.title FROM team_members tm
         JOIN users u ON u.id = tm.user_id WHERE tm.complaint_id = ?`,
      complaintId,
    ).map((r) => `${r.full_name} (${r.title})`);

    logEvent({
      complaintId,
      type: EVENT_TYPE.EKIP,
      title: `İnceleme ekibi oluşturuldu (${members.length} kişi)`,
      note: names.join(", "),
      actorId: user.id,
      payload: { members },
    });
    setStatus(c, STATUS.INCELEMEDE, user, "Ekip oluşturuldu");
  });

  await notifyCustomer({
    complaintId,
    code: TEMPLATE.EKIP,
    phone: c.customer_phone,
    email: c.customer_email,
    ctx: notifyCtx(c, { dueDate: c.due_inspection_at }),
  });
}

/* --- 2. Daha yakın fabrikaya yönlendirme (md. 2) ------------------------- */

export async function redirectComplaint(
  complaintId: number,
  toFactoryId: number,
  reason: string,
): Promise<void> {
  const user = await requireTaskTurn(complaintId, TASK.EKIP_KUR);
  const c = load(complaintId);

  if (toFactoryId === c.factory_id) throw new Error("Dosya zaten bu fabrikada.");
  if (c.team_formed_at) throw new Error("Ekip oluşturulduktan sonra dosya yönlendirilemez.");

  const target = one<{ id: number; name: string }>(
    "SELECT id, name FROM factories WHERE id = ? AND is_active = 1", toFactoryId,
  );
  if (!target) throw new Error("Hedef fabrika bulunamadı.");

  const holidays = holidaySet();
  // Yönlendirilen fabrika, dosyanın kendisine ulaşmasından itibaren 1 iş günü
  // içinde ekip kurar (md. 2). Ekip süresi bu tarihten yeniden hesaplanır.
  const newTeamDue = addBusinessDays(today(), SLA.EKIP, holidays);

  tx(() => {
    run(
      `UPDATE complaints
          SET factory_id = ?, redirected_from_id = ?, redirected_at = datetime('now'),
              redirect_reason = ?, due_team_at = ?, status = ?, updated_at = datetime('now')
        WHERE id = ?`,
      toFactoryId, c.factory_id, reason, newTeamDue, STATUS.YONLENDIRILDI, complaintId,
    );

    // Açık görevler yeni fabrikanın ilgili unvanlarına devredilir.
    const open = all<{ id: number; assignee_role: string | null }>(
      `SELECT id, assignee_role FROM tasks
        WHERE complaint_id = ? AND status IN ('BEKLEMEDE','DEVAM_EDIYOR')`,
      complaintId,
    );
    for (const t of open) {
      if (!t.assignee_role) continue;
      const u = one<{ id: number }>(
        "SELECT id FROM users WHERE factory_id = ? AND role = ? AND is_active = 1 ORDER BY id LIMIT 1",
        toFactoryId, t.assignee_role,
      );
      run("UPDATE tasks SET factory_id = ?, assignee_id = ? WHERE id = ?", toFactoryId, u?.id ?? null, t.id);
    }
    run(
      `UPDATE tasks SET due_at = ?
        WHERE complaint_id = ? AND code = ? AND status IN ('BEKLEMEDE','DEVAM_EDIYOR')`,
      newTeamDue, complaintId, TASK.EKIP_KUR,
    );

    // Taslak haldeki belgeler yeni fabrikanın imza zinciriyle yenilenir.
    const drafts = all<{ id: number; type: string }>(
      "SELECT id, type FROM documents WHERE complaint_id = ? AND status = 'TASLAK'", complaintId,
    );
    for (const d of drafts) {
      run("DELETE FROM document_signatures WHERE document_id = ?", d.id);
      run("DELETE FROM documents WHERE id = ?", d.id);
    }

    logEvent({
      complaintId,
      type: EVENT_TYPE.YONLENDIRME,
      title: `Dosya ${target.name}'na yönlendirildi`,
      note: reason,
      fromStatus: c.status,
      toStatus: STATUS.YONLENDIRILDI,
      actorId: user.id,
      payload: { fromFactoryId: c.factory_id, toFactoryId, newTeamDue },
    });
  });

  for (const d of all<{ type: string }>(
    "SELECT type FROM documents WHERE complaint_id = ?", complaintId,
  )) void d;
  // Şikâyet formu yeni fabrikanın imza zinciriyle yeniden açılır.
  if (!scalar<number>(
    "SELECT COUNT(*) FROM documents WHERE complaint_id = ? AND type = 'FR_PASAT_007'", complaintId,
  )) {
    createDocument(complaintId, "FR_PASAT_007", user.id);
  }

  await notifyCustomer({
    complaintId,
    code: TEMPLATE.YONLENDIRME,
    phone: c.customer_phone,
    email: c.customer_email,
    ctx: { ...notifyCtx(c), factoryName: target.name },
  });
}

/* --- 3. Yerinde inceleme (md. 4) ----------------------------------------- */

export interface InspectionInput {
  visitedAt: string;
  note: string;
  /** Yerinde gidilemediyse görseller üzerinden inceleme yapıldı mı. */
  remoteOnly?: boolean;
  labRequired?: boolean;
  /** Analiz alınmadıysa gerekçe — tutanakta belirtilmesi zorunludur. */
  labSkipReason?: string | null;
}

export async function recordInspection(complaintId: number, input: InspectionInput): Promise<void> {
  const user = await requireTaskTurn(complaintId, TASK.YERINDE_INCELEME);
  const c = load(complaintId);

  const labRequired = input.labRequired ?? c.lab_required === 1;
  if (!labRequired && !input.labSkipReason?.trim()) {
    throw new Error(
      "Laboratuvar analizi yapılmayacaksa gerekçesi girilmelidir (TL PASAT 004 md. 4).",
    );
  }

  tx(() => {
    run(
      `UPDATE complaints
          SET visited_at = ?, inspection_note = ?, lab_required = ?, lab_skip_reason = ?,
              updated_at = datetime('now')
        WHERE id = ?`,
      input.visitedAt, input.note, labRequired ? 1 : 0,
      labRequired ? null : (input.labSkipReason ?? null), complaintId,
    );

    completeTask(complaintId, TASK.YERINDE_INCELEME, user.id, input.note);

    if (!labRequired) {
      skipTask(complaintId, TASK.NUMUNE_AL, input.labSkipReason ?? "Analiz gerekmedi");
      skipTask(complaintId, TASK.ANALIZ_GIR, input.labSkipReason ?? "Analiz gerekmedi");
    } else {
      const fresh = load(complaintId);
      createTasks(fresh, [TASK.NUMUNE_AL, TASK.ANALIZ_GIR]);
    }

    logEvent({
      complaintId,
      type: EVENT_TYPE.INCELEME,
      title: input.remoteOnly
        ? "Ürün görselleri üzerinden inceleme yapıldı"
        : "Şikâyetçi firmada yerinde inceleme yapıldı",
      note: input.note,
      actorId: user.id,
      payload: { visitedAt: input.visitedAt, labRequired, labSkipReason: input.labSkipReason },
    });
    if (c.status === STATUS.YENI || c.status === STATUS.YONLENDIRILDI) {
      setStatus(c, STATUS.INCELEMEDE, user, "İnceleme başladı");
    }
  });

  await notifyCustomer({
    complaintId,
    code: TEMPLATE.ZIYARET,
    phone: c.customer_phone,
    email: c.customer_email,
    ctx: notifyCtx(c, { date: input.visitedAt }),
  });
}

/* --- 4. Tutanak hazırlama ve karar (md. 4) ------------------------------- */

export interface TutanakInput {
  verdict: Verdict;
  /** Aylık tablodaki "İnceleme sonucu / gerekçe". */
  verdictReason: string;
  /** Aylık tablodaki "Karar / Yapılan işlem". */
  decision: string;
  /** Tutanağa basılacak serbest metin açıklaması. */
  bodyNote?: string | null;
}

/**
 * İnceleme sonucunu ve kararı tutanak altına alır, belgeyi imza sürecine
 * sokar. Karar, Fabrika Müdürü onayı ile resmîleşir (md. 4).
 */
export async function prepareTutanak(complaintId: number, input: TutanakInput): Promise<number> {
  const user = await requireTaskTurn(complaintId, TASK.TUTANAK_HAZIRLA);
  const c = load(complaintId);

  if (!input.verdictReason.trim()) throw new Error("İnceleme sonucu / gerekçe zorunludur.");
  if (!input.decision.trim()) throw new Error("Karar / yapılan işlem zorunludur.");

  const docType = tutanakTypeFor(c.demand, input.verdict);
  const analyses = all<{ report_no: string; conformity: string; analyzed_at: string }>(
    "SELECT report_no, conformity, analyzed_at FROM analyses WHERE complaint_id = ? ORDER BY id",
    complaintId,
  );

  const docId = tx(() => {
    run(
      `UPDATE complaints
          SET verdict = ?, verdict_reason = ?, verdict_at = datetime('now'), decision = ?,
              updated_at = datetime('now')
        WHERE id = ?`,
      input.verdict, input.verdictReason, input.decision, complaintId,
    );

    const id = createDocument(complaintId, docType, user.id, {
      verdict: input.verdict,
      verdictReason: input.verdictReason,
      decision: input.decision,
      note: input.bodyNote ?? null,
      visitedAt: c.visited_at,
      inspectionNote: c.inspection_note,
      labSkipReason: c.lab_skip_reason,
      analyses,
      exchange: demandIsExchange(c.demand),
      freight: c.demands_freight === 1,
    });

    completeTask(complaintId, TASK.TUTANAK_HAZIRLA, user.id, input.verdictReason);
    logEvent({
      complaintId,
      type: EVENT_TYPE.KARAR,
      title: input.verdict === VERDICT.HAKLI
        ? "Şikâyet haklı bulundu (tutanak taslağı)"
        : "Şikâyet haklı bulunmadı (tutanak taslağı)",
      note: input.verdictReason,
      actorId: user.id,
      payload: { documentId: id, docType },
    });
    return id;
  });

  submitDocument(docId, user);
  const fresh = load(complaintId);
  setStatus(fresh, STATUS.TUTANAK_IMZADA, user, "Tutanak imza sürecine alındı");
  return docId;
}

/**
 * Tutanak Fabrika Müdürü onayıyla tamamlandığında çağrılır.
 * Karar resmîleşir, dal görevleri açılır, müşteriye bildirim gider.
 */
export async function onTutanakApproved(complaintId: number, user: SessionUser): Promise<void> {
  const c = load(complaintId);
  if (!c.verdict) return;

  const cat = c.category_id
    ? one<{ is_critical: number }>(
        "SELECT is_critical FROM complaint_categories WHERE id = ?", c.category_id,
      )
    : null;
  const isCritical = (cat?.is_critical ?? 0) === 1;
  const esc = checkEscalation(c.product_group, c.quantity_kg);
  const needsEscalation = c.verdict === VERDICT.HAKSIZ && esc.required;

  tx(() => {
    completeTask(complaintId, TASK.TUTANAK_IMZA, user.id, "İmza zinciri tamamlandı");

    if (needsEscalation) {
      const dept = one<Department>(
        "SELECT * FROM departments WHERE code = ?", esc.departmentCode,
      );
      run(
        "UPDATE complaints SET escalated_dept_id = ?, escalation_reason = ? WHERE id = ?",
        dept?.id ?? null, esc.reason, complaintId,
      );
    }

    const fresh = load(complaintId);
    createTasks(fresh, postVerdictTaskCodes({
      verdict: fresh.verdict as "HAKLI" | "HAKSIZ",
      demand: fresh.demand,
      isCritical,
      needsEscalation,
    }));

    if (c.verdict === VERDICT.HAKLI) {
      setStatus(fresh, STATUS.ISLEM_SURECINDE, user, "Karar onaylandı, işlem süreci başladı");
    }
    logEvent({
      complaintId,
      type: EVENT_TYPE.KARAR,
      title: c.verdict === VERDICT.HAKLI
        ? "Karar Fabrika Müdürü onayıyla kesinleşti: HAKLI"
        : "Karar Fabrika Müdürü onayıyla kesinleşti: HAKLI BULUNMADI",
      note: needsEscalation ? esc.reason : esc.reason,
      actorId: user.id,
      payload: { escalation: esc, isCritical },
    });
  });

  // Daire Başkanlığı kararı sonrası yeniden düzenlenen tutanakta müşteriye
  // ikinci bir karar bildirimi gönderilmez; sonuç zaten İTİRAZ_SONUC ile iletilmiştir.
  if (!c.escalation_decided_at) {
    await notifyCustomer({
      complaintId,
      code: c.verdict === VERDICT.HAKLI ? TEMPLATE.KARAR_HAKLI : TEMPLATE.KARAR_HAKSIZ,
      phone: c.customer_phone,
      email: c.customer_email,
      ctx: notifyCtx(c, {
        dueDate: c.due_resolution_at,
        verdictReason: c.verdict_reason ?? undefined,
      }),
    });
  }
}

/* --- 5. İtiraz: Daire Başkanlığına gönderme (md. 5) --------------------- */

export async function escalateComplaint(complaintId: number, note?: string | null): Promise<void> {
  const user = await requireTaskTurn(complaintId, TASK.ITIRAZ_GONDER);
  const c = load(complaintId);

  if (c.verdict !== VERDICT.HAKSIZ) {
    throw new Error("Yalnızca haklı bulunmayan şikâyetler için itiraz gönderilir.");
  }
  if (c.escalated_at) throw new Error("Dosya zaten Daire Başkanlığına gönderilmiş.");

  const esc = checkEscalation(c.product_group, c.quantity_kg);
  const dept = one<Department>("SELECT * FROM departments WHERE code = ?", esc.departmentCode);
  if (!dept) throw new Error("İlgili Daire Başkanlığı tanımlı değil.");

  const holidays = holidaySet();
  const due = addBusinessDays(today(), SLA.ITIRAZ, holidays);

  tx(() => {
    run(
      `UPDATE complaints
          SET escalated_at = datetime('now'), escalated_dept_id = ?, escalation_due_at = ?,
              escalation_reason = ?, status = ?, updated_at = datetime('now')
        WHERE id = ?`,
      dept.id, due, note?.trim() || esc.reason, STATUS.ITIRAZ_DEGERLENDIRME, complaintId,
    );
    completeTask(complaintId, TASK.ITIRAZ_GONDER, user.id, note ?? esc.reason);

    const fresh = load(complaintId);
    createTasks(fresh, [TASK.DAIRE_KARAR]);
    run(
      "UPDATE tasks SET due_at = ?, department_id = ? WHERE complaint_id = ? AND code = ?",
      due, dept.id, complaintId, TASK.DAIRE_KARAR,
    );

    logEvent({
      complaintId,
      type: EVENT_TYPE.ITIRAZ,
      title: `İtiraz ${dept.name}'na gönderildi`,
      note: `${esc.reason} Karar süresi: en geç ${due}.`,
      fromStatus: c.status,
      toStatus: STATUS.ITIRAZ_DEGERLENDIRME,
      actorId: user.id,
      payload: { departmentId: dept.id, due, threshold: esc },
    });
  });

  await notifyCustomer({
    complaintId,
    code: TEMPLATE.ITIRAZ_BASLADI,
    phone: c.customer_phone,
    email: c.customer_email,
    ctx: notifyCtx(c, { dueDate: due, departmentName: dept.name }),
  });
}

/* --- 6. Daire Başkanlığı kararı (md. 5) --------------------------------- */

export async function decideEscalation(
  complaintId: number,
  result: "SIKAYET_HAKLI" | "SIKAYET_HAKSIZ",
  note: string,
): Promise<void> {
  const user = await requireTaskTurn(complaintId, TASK.DAIRE_KARAR);
  const c = load(complaintId);

  if (!c.escalated_at) throw new Error("Dosya Daire Başkanlığı değerlendirmesinde değil.");
  if (c.escalation_decided_at) throw new Error("İtiraz zaten karara bağlanmış.");
  if (!note.trim()) throw new Error("Karar gerekçesi zorunludur.");
  if (user.role === "GM_DAIRE" && user.department_id !== c.escalated_dept_id) {
    throw new Error("Bu dosya başka bir Daire Başkanlığının değerlendirmesinde.");
  }

  const nowHaklı = result === "SIKAYET_HAKLI";

  tx(() => {
    run(
      `UPDATE complaints
          SET escalation_result = ?, escalation_note = ?, escalation_decided_at = datetime('now'),
              escalation_decided_by = ?, updated_at = datetime('now')
        WHERE id = ?`,
      result, note, user.id, complaintId,
    );
    completeTask(complaintId, TASK.DAIRE_KARAR, user.id, note);

    if (nowHaklı) {
      // Daire itirazı kabul etti: karar HAKLI'ya döner ve işlem dalı açılır.
      //
      // Fabrika daha önce şikâyeti haksız bulduğu için elindeki belge İnceleme
      // Tutanağıdır; md. 6 gereği iade/değişim ancak "Ürün Değişim İade
      // Tutanağı" (FR PASAT 004) veya nakliye bedeli de varsa FR PASAT 005 ile
      // yapılabilir. Bu nedenle tutanak düzenleme ve imza görevleri yeniden
      // açılır. 5 iş günlük işlem süresi, şikâyet tarihinden itibaren çoktan
      // geçtiği için daire kararı tarihinden yeniden başlatılır; bu yeniden
      // başlatma olay günlüğüne ayrıca işlenir.
      const holidays = holidaySet();
      const newResolution = addBusinessDays(today(), SLA.ISLEM, holidays);

      run(
        `UPDATE complaints
            SET verdict = 'HAKLI',
                verdict_reason = COALESCE(verdict_reason, '') ||
                  ' | Daire Başkanlığı kararı: şikâyet haklı bulundu.',
                decision = ?, due_resolution_at = ?, updated_at = datetime('now')
          WHERE id = ?`,
        note, newResolution, complaintId,
      );
      run(
        `UPDATE tasks
            SET status = 'BEKLEMEDE', completed_at = NULL, completed_by = NULL, due_at = ?,
                result_note = 'Daire Başkanlığı itirazı kabul ettiğinden iade/değişim tutanağı yeniden düzenlenecek.'
          WHERE complaint_id = ? AND code IN (?, ?)`,
        newResolution, complaintId, TASK.TUTANAK_HAZIRLA, TASK.TUTANAK_IMZA,
      );

      const fresh = load(complaintId);
      createTasks(fresh, postVerdictTaskCodes({
        verdict: "HAKLI", demand: fresh.demand, isCritical: false, needsEscalation: false,
      }));
      setStatus(fresh, STATUS.ISLEM_SURECINDE, user, "Daire Başkanlığı itirazı kabul etti");
      logEvent({
        complaintId,
        type: EVENT_TYPE.ITIRAZ,
        title: "İşlem süresi daire kararı tarihinden yeniden başlatıldı",
        note:
          `İade/değişim işlemi için 5 iş günlük süre ${newResolution} tarihine kadar uzatıldı. ` +
          "Ürün Değişim İade Tutanağının düzenlenmesi ve imza zinciri yeniden açıldı.",
        actorId: user.id,
        payload: { dueResolutionAt: newResolution },
      });
    } else {
      const fresh = load(complaintId);
      setStatus(fresh, STATUS.RAPORLAMA, user, "Daire Başkanlığı kararı: şikâyet haklı bulunmadı");
    }

    logEvent({
      complaintId,
      type: EVENT_TYPE.ITIRAZ,
      title: nowHaklı
        ? "Daire Başkanlığı kararı: şikâyet HAKLI"
        : "Daire Başkanlığı kararı: şikâyet HAKLI BULUNMADI",
      note,
      actorId: user.id,
      payload: { result },
    });
  });

  await notifyCustomer({
    complaintId,
    code: TEMPLATE.ITIRAZ_SONUC,
    phone: c.customer_phone,
    email: c.customer_email,
    ctx: notifyCtx(c, {
      extra: nowHaklı
        ? "Şikâyetiniz haklı bulunmuştur, iade/değişim işlemi başlatılmıştır."
        : "İnceleme sonucu teyit edilmiş, şikâyet haklı bulunmamıştır.",
    }),
  });
}

/* --- 7. İade / değişim ve nakliye bedeli (md. 6) ------------------------ */

export interface TransactionInput {
  transactionDate: string;
  returnedKg?: number;
  exchangedKg?: number;
  refundAmount?: number;
  note?: string | null;
}

export async function recordTransaction(complaintId: number, input: TransactionInput): Promise<void> {
  const user = await requireTaskTurn(complaintId, TASK.IADE_DEGISIM);
  const c = load(complaintId);

  if (c.verdict !== VERDICT.HAKLI) {
    throw new Error("İade/değişim işlemi yalnızca haklı bulunan şikâyetler için kaydedilir.");
  }
  const tutanak = one<{ id: number; status: string }>(
    `SELECT id, status FROM documents
      WHERE complaint_id = ? AND type IN ('FR_PASAT_004','FR_PASAT_005')
      ORDER BY id DESC LIMIT 1`,
    complaintId,
  );
  if (!tutanak || tutanak.status !== DOC_STATUS.ONAYLANDI) {
    throw new Error("İşlem kaydı için tutanağın imza süreci tamamlanmış olmalıdır.");
  }
  const holidays = holidaySet();
  const dueReport = addBusinessDays(input.transactionDate, SLA.RESMI_YAZI, holidays);

  tx(() => {
    run(
      `UPDATE complaints
          SET returned_kg = ?, exchanged_kg = ?, refund_amount = ?,
              transaction_date = ?, due_report_at = ?, updated_at = datetime('now')
        WHERE id = ?`,
      input.returnedKg ?? 0, input.exchangedKg ?? 0, input.refundAmount ?? 0,
      input.transactionDate, dueReport, complaintId,
    );
    completeTask(complaintId, TASK.IADE_DEGISIM, user.id, input.note ?? null);
    syncTaskDueDates(load(complaintId));

    logEvent({
      complaintId,
      type: EVENT_TYPE.ISLEM,
      title: "İade / değişim işlemi gerçekleşti",
      note: [
        input.returnedKg ? `İade: ${input.returnedKg} kg` : null,
        input.exchangedKg ? `Değişim: ${input.exchangedKg} kg` : null,
        input.refundAmount ? `İade/mahsup bedeli: ${input.refundAmount} TL` : null,
        input.note,
      ].filter(Boolean).join(" · "),
      actorId: user.id,
      payload: { ...input, dueReport },
    });
  });

  await notifyCustomer({
    complaintId,
    code: TEMPLATE.ISLEM_TAMAM,
    phone: c.customer_phone,
    email: c.customer_email,
    ctx: notifyCtx(c, {
      date: input.transactionDate,
      returnedKg: input.returnedKg,
      exchangedKg: input.exchangedKg,
    }),
  });
}

/**
 * Nakliye bedelinin ödenmesi (md. 6-b) — Muhasebe'nin kendi adımı.
 * İade/değişim ambarda, ödeme muhasebede yapıldığı için iki iş ayrı görev
 * kartı olarak yürür; böylece her adımın sorumlusu tek kişi olur.
 */
export async function recordFreightPayment(
  complaintId: number,
  input: { amount: number; paidAt: string; note?: string | null },
): Promise<void> {
  const user = await requireTaskTurn(complaintId, TASK.NAKLIYE_ODEME);

  if (!(input.amount > 0)) {
    throw new Error("Ödenen nakliye bedeli sıfırdan büyük olmalıdır (md. 6-b).");
  }
  if (!input.paidAt) throw new Error("Ödeme tarihi zorunludur.");

  run(
    `UPDATE complaints SET freight_amount = ?, freight_paid_at = ?, updated_at = datetime('now')
      WHERE id = ?`,
    input.amount, input.paidAt, complaintId,
  );
  completeTask(
    complaintId, TASK.NAKLIYE_ODEME, user.id,
    `Ödenen: ${fmtTl(input.amount)}${input.note ? ` — ${input.note}` : ""}`,
  );
  logEvent({
    complaintId,
    type: EVENT_TYPE.ISLEM,
    title: "Nakliye bedeli ödendi",
    note: [`Tutar: ${fmtTl(input.amount)}`, `Ödeme tarihi: ${input.paidAt}`, input.note]
      .filter(Boolean).join(" · "),
    actorId: user.id,
    payload: { ...input },
  });
}

/* --- 8. FSSC 22000 düzeltici faaliyet (md. 4) --------------------------- */

export async function startCapa(complaintId: number, capaNo: string, note: string): Promise<void> {
  const user = await requireTaskTurn(complaintId, TASK.CAPA_BASLAT);

  run(
    `UPDATE complaints SET capa_started_at = datetime('now'), capa_no = ?, capa_note = ?,
            updated_at = datetime('now') WHERE id = ?`,
    capaNo, note, complaintId,
  );
  completeTask(complaintId, TASK.CAPA_BASLAT, user.id, `${capaNo} — ${note}`);
  logEvent({
    complaintId,
    type: EVENT_TYPE.CAPA,
    title: "FSSC 22000 düzeltici faaliyet başlatıldı",
    note: `DF No: ${capaNo} — ${note}`,
    actorId: user.id,
    payload: { capaNo },
  });
}

/* --- 9. Resmî yazı dağıtımı (md. 6) ------------------------------------- */

export async function sendOfficialLetter(
  complaintId: number,
  letterNo: string,
  note?: string | null,
): Promise<void> {
  const user = await requireTaskTurn(complaintId, TASK.RESMI_YAZI);
  const c = load(complaintId);
  if (!letterNo.trim()) throw new Error("Resmî yazı sayısı zorunludur.");

  const codes = letterRecipients(c.product_group);
  const depts = all<Department>(
    `SELECT * FROM departments WHERE code IN (${codes.map(() => "?").join(",")})`, ...codes,
  );

  tx(() => {
    run(
      `INSERT INTO official_letters (complaint_id, letter_no, sent_at, sent_by, recipients, note)
       VALUES (?, ?, date('now'), ?, ?, ?)`,
      complaintId, letterNo, user.id, JSON.stringify(depts.map((d) => d.id)), note ?? null,
    );
    run(
      `UPDATE complaints SET letter_sent_at = date('now'), letter_no = ?, updated_at = datetime('now')
        WHERE id = ?`,
      letterNo, complaintId,
    );
    completeTask(complaintId, TASK.RESMI_YAZI, user.id, `${letterNo} — ${depts.length} daire`);
    logEvent({
      complaintId,
      type: EVENT_TYPE.RESMI_YAZI,
      title: `Resmî yazı ${depts.length} Daire Başkanlığına gönderildi`,
      note: `Sayı: ${letterNo}\n${depts.map((d) => `• ${d.name}`).join("\n")}`,
      actorId: user.id,
      payload: { letterNo, departments: depts.map((d) => d.code) },
    });
    setStatus(load(complaintId), STATUS.RAPORLAMA, user, "Resmî yazı gönderildi");
  });
}

/* --- 10. Müşteri Bilgilendirme Formu (md. 7) ---------------------------- */

export async function sendCustomerInfo(complaintId: number, explanation: string): Promise<number> {
  const user = await requireTaskTurn(complaintId, TASK.MUSTERI_BILGI);
  const c = load(complaintId);
  if (!explanation.trim()) throw new Error("Açıklama metni zorunludur.");

  const docId = createDocument(complaintId, "MUSTERI_BILGILENDIRME", user.id, {
    explanation,
    verdict: c.verdict,
    verdictReason: c.verdict_reason,
    decision: c.decision,
    transactionDate: c.transaction_date,
    returnedKg: c.returned_kg,
    exchangedKg: c.exchanged_kg,
    freightAmount: c.freight_amount,
  });
  submitDocument(docId, user);

  run(
    "UPDATE complaints SET customer_informed_at = datetime('now'), updated_at = datetime('now') WHERE id = ?",
    complaintId,
  );
  completeTask(complaintId, TASK.MUSTERI_BILGI, user.id, explanation.slice(0, 200));
  logEvent({
    complaintId,
    type: EVENT_TYPE.BILDIRIM,
    title: "Müşteri Bilgilendirme Formu düzenlendi ve müşteriye gönderildi",
    note: explanation,
    actorId: user.id,
    payload: { documentId: docId },
  });
  if (c.status !== STATUS.RAPORLAMA && c.status !== STATUS.KAPANDI) {
    setStatus(load(complaintId), STATUS.RAPORLAMA, user, "Müşteri bilgilendirildi");
  }
  return docId;
}

/* --- 11. Kapanış --------------------------------------------------------- */

export async function closeComplaint(complaintId: number, note: string): Promise<void> {
  const user = await requireTaskTurn(complaintId, TASK.DOSYA_KAPAT);
  const c = load(complaintId);

  const openTasks = all<{ title: string }>(
    `SELECT title FROM tasks
      WHERE complaint_id = ? AND code <> ? AND status IN ('BEKLEMEDE','DEVAM_EDIYOR')`,
    complaintId, TASK.DOSYA_KAPAT,
  );
  if (openTasks.length > 0) {
    throw new Error(
      `Kapatmadan önce tamamlanmayan ${openTasks.length} görev var: ` +
      openTasks.map((t) => t.title).join(", "),
    );
  }

  const finalStatus = c.verdict === VERDICT.HAKSIZ ? STATUS.REDDEDILDI : STATUS.KAPANDI;

  tx(() => {
    run(
      `UPDATE complaints SET closed_at = datetime('now'), closing_note = ?, status = ?,
              updated_at = datetime('now') WHERE id = ?`,
      note, finalStatus, complaintId,
    );
    completeTask(complaintId, TASK.DOSYA_KAPAT, user.id, note);
    logEvent({
      complaintId,
      type: EVENT_TYPE.KAPANIS,
      title: finalStatus === STATUS.KAPANDI ? "Dosya kapatıldı" : "Dosya kapatıldı (haklı bulunmadı)",
      note,
      fromStatus: c.status,
      toStatus: finalStatus,
      actorId: user.id,
    });
  });

  await notifyCustomer({
    complaintId,
    code: TEMPLATE.KAPANIS,
    phone: c.customer_phone,
    email: c.customer_email,
    ctx: notifyCtx(c, { extra: note }),
  });
}

export async function cancelComplaint(complaintId: number, reason: string): Promise<void> {
  const user = await requirePermission(PERMISSIONS.SIKAYET_KAPAT);
  const c = load(complaintId);
  await requireFactoryAccess(c.factory_id);
  if (!reason.trim()) throw new Error("İptal gerekçesi zorunludur.");

  tx(() => {
    run(
      `UPDATE complaints SET status = ?, closed_at = datetime('now'), closing_note = ?,
              updated_at = datetime('now') WHERE id = ?`,
      STATUS.IPTAL, reason, complaintId,
    );
    run(
      `UPDATE tasks SET status = 'GEREKSIZ', completed_at = datetime('now'), result_note = ?
        WHERE complaint_id = ? AND status IN ('BEKLEMEDE','DEVAM_EDIYOR')`,
      "Dosya iptal edildi", complaintId,
    );
    logEvent({
      complaintId,
      type: EVENT_TYPE.KAPANIS,
      title: "Dosya iptal edildi",
      note: reason,
      fromStatus: c.status,
      toStatus: STATUS.IPTAL,
      actorId: user.id,
    });
  });
}

/* --- Ekip sorguları ------------------------------------------------------ */

export function complaintTeam(complaintId: number): TeamMemberView[] {
  return all<TeamMemberView>(
    `SELECT tm.*, u.full_name, u.title, u.role, u.email
       FROM team_members tm JOIN users u ON u.id = tm.user_id
      WHERE tm.complaint_id = ?
      ORDER BY tm.is_lead DESC, tm.id`,
    complaintId,
  );
}

/** Ekibe atanabilecek fabrika personeli (md. 3 birimleri). */
export function assignableStaff(factoryId: number) {
  return all<{ id: number; full_name: string; title: string; role: string }>(
    `SELECT id, full_name, title, role FROM users
      WHERE factory_id = ? AND is_active = 1
        AND role IN ('KALITE_MUDUR_YRD','KALITE_SORUMLUSU','LABORATUVAR','TEKNIK_ISLETME',
                     'MUDUR_YRD_TEKNIK','MUHASEBE','ZIRAAT','MUDUR_YRD_ZIRAAT',
                     'AMBAR_SEFI','SATIS_BIRIM_SEFI','MUDUR_YRD_IDARI')
      ORDER BY role, full_name`,
    factoryId,
  );
}

export { TASK, TASK_CATALOG, checkEscalation, escalationDepartment, letterRecipients, DEPT };
