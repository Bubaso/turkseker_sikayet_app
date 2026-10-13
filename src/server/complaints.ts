/* ===========================================================================
   Şikâyet kaydı oluşturma ve sorgular.
   =========================================================================== */

import { all, one, run, scalar, tx } from "@/lib/db";
import { addBusinessDays, now, today } from "@/lib/dates";
import { normalizePhone } from "@/lib/format";
import { randomToken } from "@/lib/password";
import { CHANNEL, DEMAND, OPEN_STATUSES, SLA, STATUS, demandIncludesFreight } from "@/lib/domain";
import { initialTaskCodes } from "@/lib/workflow";
import type { Complaint, ComplaintView, Factory } from "@/lib/types";
import { EVENT_TYPE, logEvent } from "./events";
import { createTasks } from "./tasks";
import { holidaySet } from "./settings";
import { TEMPLATE, notifyCustomer } from "./notify";
import { createDocument } from "./documents";
import { DOC_TYPE } from "@/lib/domain";

/* --- Şikâyet numarası ---------------------------------------------------- */

/** 2026-ANK-0001 biçiminde, fabrika ve yıl bazında artan numara üretir. */
function nextComplaintNo(factoryCode: string, year: number): string {
  const prefix = `${year}-${factoryCode}-`;
  const last = scalar<string>(
    "SELECT complaint_no FROM complaints WHERE complaint_no LIKE ? ORDER BY complaint_no DESC LIMIT 1",
    `${prefix}%`,
  );
  const seq = last ? Number(last.slice(prefix.length)) + 1 : 1;
  return `${prefix}${String(seq).padStart(4, "0")}`;
}

/* --- Kayıt oluşturma ----------------------------------------------------- */

export interface CreateComplaintInput {
  channel?: string;
  /** Üretici fabrika — formdaki "Üretici Şeker Fabrikası". */
  originFactoryId: number;
  /** Dosyayı yürütecek fabrika; verilmezse üretici fabrika. */
  factoryId?: number;
  receivedAt?: string;
  receivedById?: number | null;

  customerCompany: string;
  customerName?: string | null;
  customerTitle?: string | null;
  customerPhone: string;
  customerEmail?: string | null;
  customerAddress?: string | null;
  customerProvince?: string | null;
  customerTaxNo?: string | null;

  productId?: number | null;
  productName: string;
  productGroup: string;
  packaging?: string | null;
  lotNo?: string | null;
  quantityKg?: number | null;
  invoiceNo?: string | null;
  deliveryNoteNo?: string | null;
  contractNo?: string | null;
  deliveryDate?: string | null;

  categoryId?: number | null;
  subject: string;
  description?: string | null;
  demand?: string;

  kvkkConsent?: boolean;
  phoneVerified?: boolean;
  sourceIp?: string | null;
  /** Doğrudan gelen kanıt dosyaları (halka açık formdan). */
  attachments?: { fileName: string; storedName: string; mime: string; size: number }[];
}

export interface CreateComplaintResult {
  id: number;
  complaintNo: string;
  trackingToken: string;
  factoryName: string;
  dueInspectionAt: string;
  /** Daha yakın bir fabrika varsa önerisi. */
  nearerFactory: { id: number; name: string } | null;
}

export async function createComplaint(input: CreateComplaintInput): Promise<CreateComplaintResult> {
  const holidays = holidaySet();
  const receivedAt = input.receivedAt ?? today();
  const factoryId = input.factoryId ?? input.originFactoryId;

  const factory = one<Factory>("SELECT * FROM factories WHERE id = ?", factoryId);
  if (!factory) throw new Error("Geçersiz fabrika seçimi.");

  const labRequired = input.categoryId
    ? (one<{ needs_lab: number }>(
        "SELECT needs_lab FROM complaint_categories WHERE id = ?", input.categoryId,
      )?.needs_lab ?? 0) === 1
    : false;

  const demand = input.demand ?? DEMAND.IADE;
  const token = randomToken(18);

  const created = tx(() => {
    const complaintNo = nextComplaintNo(factory.code, Number(receivedAt.slice(0, 4)));

    const dueTeam = addBusinessDays(receivedAt, SLA.EKIP, holidays);
    const dueInspection = addBusinessDays(receivedAt, SLA.INCELEME, holidays);
    const dueResolution = addBusinessDays(receivedAt, SLA.ISLEM, holidays);

    const res = run(
      `INSERT INTO complaints (
         complaint_no, tracking_token, channel, status,
         origin_factory_id, factory_id, received_at, received_by_id,
         customer_company, customer_name, customer_title, customer_phone, customer_email,
         customer_address, customer_province, customer_tax_no,
         product_id, product_name, product_group, packaging, lot_no, quantity_kg,
         invoice_no, delivery_note_no, contract_no, delivery_date,
         category_id, subject, description, demand, demands_freight,
         kvkk_consent_at, phone_verified_at, source_ip,
         due_team_at, due_inspection_at, due_resolution_at, lab_required
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      complaintNo, token, input.channel ?? CHANNEL.WEB, STATUS.YENI,
      input.originFactoryId, factoryId, receivedAt, input.receivedById ?? null,
      input.customerCompany.trim(), input.customerName?.trim() || null,
      input.customerTitle?.trim() || null, normalizePhone(input.customerPhone),
      input.customerEmail?.trim() || null, input.customerAddress?.trim() || null,
      input.customerProvince || null, input.customerTaxNo?.trim() || null,
      input.productId ?? null, input.productName.trim(), input.productGroup,
      input.packaging?.trim() || null, input.lotNo?.trim() || null, input.quantityKg ?? null,
      input.invoiceNo?.trim() || null, input.deliveryNoteNo?.trim() || null,
      input.contractNo?.trim() || null, input.deliveryDate || null,
      input.categoryId ?? null, input.subject.trim(), input.description?.trim() || null,
      demand, demandIncludesFreight(demand) ? 1 : 0,
      input.kvkkConsent ? now() : null, input.phoneVerified ? now() : null,
      input.sourceIp ?? null,
      dueTeam, dueInspection, dueResolution, labRequired ? 1 : 0,
    );

    const id = Number(res.lastInsertRowid);
    const complaint = one<Complaint>("SELECT * FROM complaints WHERE id = ?", id)!;

    createTasks(complaint, initialTaskCodes(labRequired));

    for (const a of input.attachments ?? []) {
      run(
        `INSERT INTO attachments (complaint_id, kind, file_name, stored_name, mime, size, uploader_label)
         VALUES (?, 'KANIT', ?, ?, ?, ?, 'Müşteri')`,
        id, a.fileName, a.storedName, a.mime, a.size,
      );
    }

    logEvent({
      complaintId: id,
      type: EVENT_TYPE.KAYIT,
      title: "Şikâyet kaydı oluşturuldu",
      note: `${complaintNo} — ${factory.name}`,
      toStatus: STATUS.YENI,
      actorId: input.receivedById ?? null,
      actorLabel: input.receivedById ? null : "Müşteri",
      payload: { channel: input.channel ?? CHANNEL.WEB, demand, labRequired },
    });

    return { id, complaintNo, dueInspection };
  });

  // Müşteri Şikâyet Formu (FR PASAT 007) kayıtla birlikte otomatik açılır.
  createDocument(created.id, DOC_TYPE.FR_PASAT_007, input.receivedById ?? null);

  const nearer = suggestNearerFactory(created.id);

  await notifyCustomer({
    complaintId: created.id,
    code: TEMPLATE.KAYIT,
    phone: input.customerPhone,
    email: input.customerEmail,
    ctx: {
      complaintNo: created.complaintNo,
      trackingToken: token,
      factoryName: factory.name,
      customerCompany: input.customerCompany,
    },
  });

  return {
    id: created.id,
    complaintNo: created.complaintNo,
    trackingToken: token,
    factoryName: factory.name,
    dueInspectionAt: created.dueInspection,
    nearerFactory: nearer,
  };
}

/**
 * Müşterinin iline göre daha yakın bir fabrika varsa önerir
 * (TL PASAT 004 md. 2 — "firma adresine daha yakın olan fabrikamız").
 */
export function suggestNearerFactory(complaintId: number): { id: number; name: string } | null {
  const row = one<{ factory_id: number; nearest_id: number | null; nearest_name: string | null }>(
    `SELECT c.factory_id, p.nearest_factory_id AS nearest_id, f.name AS nearest_name
       FROM complaints c
       LEFT JOIN provinces p ON p.code = c.customer_province
       LEFT JOIN factories f ON f.id = p.nearest_factory_id
      WHERE c.id = ?`,
    complaintId,
  );
  if (!row?.nearest_id || !row.nearest_name) return null;
  if (row.nearest_id === row.factory_id) return null;
  return { id: row.nearest_id, name: row.nearest_name };
}

/* --- Sorgular ------------------------------------------------------------ */

const COMPLAINT_SELECT = `
  SELECT c.*,
         f.name AS factory_name, f.code AS factory_code, f.short_name AS factory_short,
         of.name AS origin_factory_name,
         cat.name AS category_name, cat.family AS category_family, cat.is_critical AS category_critical,
         p.name AS province_name,
         d.name AS department_name,
         ru.full_name AS received_by_name,
         (SELECT COUNT(*) FROM tasks t
           WHERE t.complaint_id = c.id AND t.status IN ('BEKLEMEDE','DEVAM_EDIYOR')) AS open_task_count
    FROM complaints c
    JOIN factories f ON f.id = c.factory_id
    LEFT JOIN factories of ON of.id = c.origin_factory_id
    LEFT JOIN complaint_categories cat ON cat.id = c.category_id
    LEFT JOIN provinces p ON p.code = c.customer_province
    LEFT JOIN departments d ON d.id = c.escalated_dept_id
    LEFT JOIN users ru ON ru.id = c.received_by_id
`;

export function getComplaint(id: number): ComplaintView | undefined {
  return one<ComplaintView>(`${COMPLAINT_SELECT} WHERE c.id = ?`, id);
}

export function getComplaintByNo(no: string): ComplaintView | undefined {
  return one<ComplaintView>(`${COMPLAINT_SELECT} WHERE c.complaint_no = ?`, no.trim());
}

export function getComplaintByToken(token: string): ComplaintView | undefined {
  return one<ComplaintView>(`${COMPLAINT_SELECT} WHERE c.tracking_token = ?`, token);
}

/** Müşteri takibi: şikâyet no + telefonun son 4 hanesi. */
export function findForTracking(no: string, phoneLast4: string): ComplaintView | undefined {
  const c = getComplaintByNo(no);
  if (!c) return undefined;
  return c.customer_phone.slice(-4) === phoneLast4.trim() ? c : undefined;
}

export interface ComplaintFilter {
  factoryId?: number | null;
  departmentId?: number | null;
  status?: string | null;
  /** "ACIK" açık dosyalar, "KAPALI" kapanmış dosyalar. */
  group?: "ACIK" | "KAPALI" | null;
  verdict?: string | null;
  productGroup?: string | null;
  categoryId?: number | null;
  search?: string | null;
  from?: string | null;
  to?: string | null;
  /** Yalnızca SLA'sı gecikmiş dosyalar. */
  overdueOnly?: boolean;
  escalatedOnly?: boolean;
  limit?: number;
  offset?: number;
  orderBy?: "received_desc" | "received_asc" | "due_asc";
}

function buildWhere(f: ComplaintFilter): { sql: string; params: unknown[] } {
  const w: string[] = [];
  const p: unknown[] = [];

  if (f.factoryId) { w.push("c.factory_id = ?"); p.push(f.factoryId); }
  if (f.departmentId) { w.push("c.escalated_dept_id = ?"); p.push(f.departmentId); }
  if (f.status) { w.push("c.status = ?"); p.push(f.status); }
  if (f.group === "ACIK") {
    w.push(`c.status IN (${OPEN_STATUSES.map(() => "?").join(",")})`);
    p.push(...OPEN_STATUSES);
  }
  if (f.group === "KAPALI") {
    w.push("c.status IN ('KAPANDI','REDDEDILDI','IPTAL')");
  }
  if (f.verdict) { w.push("c.verdict = ?"); p.push(f.verdict); }
  if (f.productGroup) { w.push("c.product_group = ?"); p.push(f.productGroup); }
  if (f.categoryId) { w.push("c.category_id = ?"); p.push(f.categoryId); }
  if (f.from) { w.push("c.received_at >= ?"); p.push(f.from); }
  if (f.to) { w.push("c.received_at <= ?"); p.push(f.to); }
  if (f.escalatedOnly) w.push("c.escalated_at IS NOT NULL");
  if (f.overdueOnly) {
    w.push(`c.status NOT IN ('KAPANDI','REDDEDILDI','IPTAL')
            AND EXISTS (SELECT 1 FROM tasks t
                         WHERE t.complaint_id = c.id
                           AND t.status IN ('BEKLEMEDE','DEVAM_EDIYOR')
                           AND t.due_at IS NOT NULL AND t.due_at < date('now'))`);
  }
  if (f.search) {
    const q = `%${f.search.trim()}%`;
    w.push(`(c.complaint_no LIKE ? OR c.customer_company LIKE ? OR c.customer_phone LIKE ?
             OR c.subject LIKE ? OR c.lot_no LIKE ? OR c.product_name LIKE ?)`);
    p.push(q, q, q, q, q, q);
  }
  return { sql: w.length ? `WHERE ${w.join(" AND ")}` : "", params: p };
}

export function listComplaints(f: ComplaintFilter = {}): ComplaintView[] {
  const { sql, params } = buildWhere(f);
  const order =
    f.orderBy === "received_asc" ? "c.received_at ASC, c.id ASC"
    : f.orderBy === "due_asc" ? "(c.due_inspection_at IS NULL), c.due_inspection_at ASC"
    : "c.received_at DESC, c.id DESC";
  const limit = f.limit ?? 50;
  const offset = f.offset ?? 0;
  return all<ComplaintView>(
    `${COMPLAINT_SELECT} ${sql} ORDER BY ${order} LIMIT ? OFFSET ?`,
    ...params, limit, offset,
  );
}

export function countComplaints(f: ComplaintFilter = {}): number {
  const { sql, params } = buildWhere(f);
  return scalar<number>(`SELECT COUNT(*) FROM complaints c ${sql}`, ...params) ?? 0;
}

/* --- Referans listeleri -------------------------------------------------- */

export function listFactories(onlyActive = true): Factory[] {
  return all<Factory>(
    `SELECT * FROM factories ${onlyActive ? "WHERE is_active = 1" : ""} ORDER BY name`,
  );
}

export function factoryById(id: number): Factory | undefined {
  return one<Factory>("SELECT * FROM factories WHERE id = ?", id);
}
