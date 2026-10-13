/* ===========================================================================
   Numune ve laboratuvar analizi (TL PASAT 004 md. 4).
   Numune alınan gün, mümkün olmazsa takip eden iş günü analiz yapılır;
   sonuç analiz raporuyla birlikte tutanağa bağlanır.
   =========================================================================== */

import { all, one, run, scalar, tx } from "@/lib/db";
import { CONFORMITY } from "@/lib/domain";
import { PERMISSIONS } from "@/lib/roles";
import { TASK } from "@/lib/workflow";
import type { AnalysisResultRow, AnalysisView, LabParameter, SampleView } from "@/lib/types";
import { requireFactoryAccess, requirePermission } from "./auth";
import { EVENT_TYPE, logEvent } from "./events";
import { completeTask } from "./tasks";
import { TEMPLATE, notifyCustomer } from "./notify";

/* --- Numune -------------------------------------------------------------- */

export interface SampleInput {
  takenAt: string;
  takenPlace: string;
  lotNo?: string | null;
  quantity?: string | null;
  sealNo?: string | null;
  note?: string | null;
}

/** NUM/2026-ANK-0001/1 biçiminde numune numarası. */
function nextSampleNo(complaintId: number): string {
  const c = one<{ complaint_no: string }>(
    "SELECT complaint_no FROM complaints WHERE id = ?", complaintId,
  );
  const n = (scalar<number>("SELECT COUNT(*) FROM samples WHERE complaint_id = ?", complaintId) ?? 0) + 1;
  return `NUM/${c?.complaint_no ?? complaintId}/${n}`;
}

export async function addSample(complaintId: number, input: SampleInput): Promise<number> {
  const user = await requirePermission(PERMISSIONS.INCELEME_GIR);
  const c = one<{ factory_id: number; customer_phone: string; customer_email: string | null;
                  complaint_no: string; tracking_token: string; customer_company: string }>(
    "SELECT factory_id, customer_phone, customer_email, complaint_no, tracking_token, customer_company FROM complaints WHERE id = ?",
    complaintId,
  );
  if (!c) throw new Error("Şikâyet kaydı bulunamadı.");
  await requireFactoryAccess(c.factory_id);

  const sampleNo = nextSampleNo(complaintId);
  const id = tx(() => {
    const res = run(
      `INSERT INTO samples (complaint_id, sample_no, taken_at, taken_by, taken_place, lot_no, quantity, seal_no, note)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      complaintId, sampleNo, input.takenAt, user.id, input.takenPlace,
      input.lotNo ?? null, input.quantity ?? null, input.sealNo ?? null, input.note ?? null,
    );
    completeTask(complaintId, TASK.NUMUNE_AL, user.id, sampleNo);
    logEvent({
      complaintId,
      type: EVENT_TYPE.NUMUNE,
      title: `Numune alındı: ${sampleNo}`,
      note: [input.takenPlace, input.quantity, input.sealNo && `Mühür: ${input.sealNo}`, input.note]
        .filter(Boolean).join(" · "),
      actorId: user.id,
      payload: { sampleNo, ...input },
    });
    return Number(res.lastInsertRowid);
  });

  await notifyCustomer({
    complaintId,
    code: TEMPLATE.NUMUNE,
    phone: c.customer_phone,
    email: c.customer_email,
    ctx: {
      complaintNo: c.complaint_no,
      trackingToken: c.tracking_token,
      customerCompany: c.customer_company,
      date: input.takenAt,
    },
  });
  return id;
}

export function complaintSamples(complaintId: number): SampleView[] {
  return all<SampleView>(
    `SELECT s.*, u.full_name AS taken_by_name,
            (SELECT COUNT(*) FROM analyses a WHERE a.sample_id = s.id) AS analysis_count
       FROM samples s LEFT JOIN users u ON u.id = s.taken_by
      WHERE s.complaint_id = ? ORDER BY s.id`,
    complaintId,
  );
}

/* --- Analiz -------------------------------------------------------------- */

export interface AnalysisResultInput {
  parameterId?: number | null;
  parameter: string;
  value: string;
  unit?: string | null;
  specText?: string | null;
  conforms?: boolean | null;
}

export interface AnalysisInput {
  sampleId?: number | null;
  reportNo: string;
  analyzedAt: string;
  labName?: string | null;
  summary?: string | null;
  results: AnalysisResultInput[];
}

/**
 * Analiz sonucunu kaydeder. Genel uygunluk, parametre bazlı uygunluklardan
 * otomatik türetilir: bir parametre bile uygun değilse sonuç "uygun değil".
 */
export async function addAnalysis(complaintId: number, input: AnalysisInput): Promise<number> {
  const user = await requirePermission(PERMISSIONS.ANALIZ_GIR);
  const c = one<{ factory_id: number }>("SELECT factory_id FROM complaints WHERE id = ?", complaintId);
  if (!c) throw new Error("Şikâyet kaydı bulunamadı.");
  await requireFactoryAccess(c.factory_id);
  if (!input.reportNo.trim()) throw new Error("Analiz rapor numarası zorunludur.");
  if (input.results.length === 0) throw new Error("En az bir analiz parametresi girilmelidir.");

  const nonConforming = input.results.filter((r) => r.conforms === false).length;
  const conforming = input.results.filter((r) => r.conforms === true).length;
  const conformity =
    nonConforming === 0 ? CONFORMITY.UYGUN
    : conforming === 0 ? CONFORMITY.UYGUN_DEGIL
    : CONFORMITY.KISMEN;

  return tx(() => {
    const res = run(
      `INSERT INTO analyses (complaint_id, sample_id, report_no, analyzed_at, analyzed_by, lab_name, conformity, summary)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      complaintId, input.sampleId ?? null, input.reportNo, input.analyzedAt, user.id,
      input.labName ?? "Kalite ve İşletme Kontrol Laboratuvarı", conformity, input.summary ?? null,
    );
    const id = Number(res.lastInsertRowid);

    input.results.forEach((r, i) => {
      run(
        `INSERT INTO analysis_results (analysis_id, parameter_id, parameter, value, unit, spec_text, conforms, sort_order)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        id, r.parameterId ?? null, r.parameter, r.value, r.unit ?? null, r.specText ?? null,
        r.conforms === null || r.conforms === undefined ? null : r.conforms ? 1 : 0, i,
      );
    });

    completeTask(complaintId, TASK.ANALIZ_GIR, user.id, `${input.reportNo} — ${conformity}`);
    logEvent({
      complaintId,
      type: EVENT_TYPE.ANALIZ,
      title: `Laboratuvar analizi girildi: ${input.reportNo}`,
      note: `Sonuç: ${conformity === CONFORMITY.UYGUN ? "Standartlara uygun"
              : conformity === CONFORMITY.UYGUN_DEGIL ? "Standartlara uygun değil" : "Kısmen uygun"}` +
            (nonConforming ? ` — ${nonConforming} parametre sınır dışı.` : "") +
            (input.summary ? `\n${input.summary}` : ""),
      actorId: user.id,
      payload: { analysisId: id, conformity, nonConforming },
    });
    return id;
  });
}

export function complaintAnalyses(complaintId: number): AnalysisView[] {
  const rows = all<Omit<AnalysisView, "results">>(
    `SELECT a.*, u.full_name AS analyzed_by_name, s.sample_no
       FROM analyses a
       LEFT JOIN users u ON u.id = a.analyzed_by
       LEFT JOIN samples s ON s.id = a.sample_id
      WHERE a.complaint_id = ? ORDER BY a.id`,
    complaintId,
  );
  return rows.map((r) => ({
    ...r,
    results: all<AnalysisResultRow>(
      "SELECT * FROM analysis_results WHERE analysis_id = ? ORDER BY sort_order, id", r.id,
    ),
  }));
}

/** Ürün grubuna uygun analiz parametreleri — analiz formunu önceden doldurur. */
export function labParameters(productGroup?: string | null): LabParameter[] {
  if (!productGroup) {
    return all<LabParameter>(
      "SELECT * FROM lab_parameters WHERE is_active = 1 ORDER BY sort_order",
    );
  }
  return all<LabParameter>(
    `SELECT * FROM lab_parameters
      WHERE is_active = 1 AND (product_group IS NULL OR product_group = ?)
      ORDER BY sort_order`,
    productGroup,
  );
}

/** Spesifikasyona göre otomatik uygunluk değerlendirmesi. */
export function evaluateParameter(p: LabParameter, rawValue: string): boolean | null {
  const v = Number(String(rawValue).replace(",", "."));
  if (!Number.isFinite(v)) return null;
  if (p.spec_min != null && v < p.spec_min) return false;
  if (p.spec_max != null && v > p.spec_max) return false;
  if (p.spec_min == null && p.spec_max == null) return null;
  return true;
}
