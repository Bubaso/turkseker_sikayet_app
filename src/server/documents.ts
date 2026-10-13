/* ===========================================================================
   Belgeler ve imza zinciri.
   FR PASAT 004 / 005 tutanakları sıralı imza zinciriyle onaylanır:
   Ambar Şefi → Satışı Yapan Birim Şefi → Kalite ve İşletme Kontrol Md.Yrd. →
   Fabrika Md.Yrd. (Teknik/Ziraat) → Fabrika Md.Yrd. (İdari) → Fabrika Müdürü onayı.
   =========================================================================== */

import { all, one, run, scalar, tx } from "@/lib/db";
import { DOC_STATUS, DOC_TYPE, DOC_TYPE_CODE, type DocType } from "@/lib/domain";
import { rolesForSlot, signatureChain } from "@/lib/workflow";
import type { DocumentRow, DocumentView, SignatureRow } from "@/lib/types";
import type { SessionUser } from "./auth";
import { EVENT_TYPE, logEvent } from "./events";

/** 004-2026-ANK-0001 biçiminde belge numarası. */
function nextDocNo(complaintId: number, type: DocType): string {
  const c = one<{ complaint_no: string }>("SELECT complaint_no FROM complaints WHERE id = ?", complaintId);
  const suffix = type.replace("FR_PASAT_", "").replace("MUSTERI_BILGILENDIRME", "BLG");
  const n = (scalar<number>(
    "SELECT COUNT(*) FROM documents WHERE complaint_id = ? AND type = ?", complaintId, type,
  ) ?? 0) + 1;
  return `${suffix}/${c?.complaint_no ?? complaintId}${n > 1 ? `/${n}` : ""}`;
}

/**
 * Belgeyi taslak olarak açar ve imza zincirini kurar.
 * İmza sıraları, o fabrikada ilgili unvanı taşıyan kullanıcıya bağlanır.
 */
export function createDocument(
  complaintId: number,
  type: DocType,
  createdBy: number | null,
  body?: unknown,
): number {
  return tx(() => {
    const factoryId = scalar<number>("SELECT factory_id FROM complaints WHERE id = ?", complaintId);
    const docNo = nextDocNo(complaintId, type);

    const id = Number(
      run(
        `INSERT INTO documents (complaint_id, type, doc_no, status, body, created_by)
         VALUES (?, ?, ?, 'TASLAK', ?, ?)`,
        complaintId, type, docNo, body === undefined ? null : JSON.stringify(body), createdBy,
      ).lastInsertRowid,
    );

    for (const slot of signatureChain(type)) {
      const roles = rolesForSlot(slot);
      const placeholders = roles.map(() => "?").join(",");
      const u = factoryId
        ? one<{ id: number; full_name: string; title: string }>(
            `SELECT id, full_name, title FROM users
              WHERE factory_id = ? AND role IN (${placeholders}) AND is_active = 1
              ORDER BY id LIMIT 1`,
            factoryId, ...roles,
          )
        : undefined;
      run(
        `INSERT INTO document_signatures
           (document_id, sort_order, expected_role, expected_title, is_approval, user_id, decision)
         VALUES (?, ?, ?, ?, ?, ?, 'BEKLIYOR')`,
        id, slot.order, slot.role, slot.title, slot.isApproval ? 1 : 0, u?.id ?? null,
      );
    }

    logEvent({
      complaintId,
      type: EVENT_TYPE.BELGE,
      title: `${DOC_TYPE_CODE[type]} düzenlendi (taslak)`,
      note: docNo,
      actorId: createdBy,
      payload: { documentId: id, docType: type },
    });
    return id;
  });
}

/** Taslak belgeyi imza sürecine alır. */
export function submitDocument(documentId: number, user: SessionUser): void {
  const doc = one<DocumentRow>("SELECT * FROM documents WHERE id = ?", documentId);
  if (!doc) throw new Error("Belge bulunamadı.");
  if (doc.status !== DOC_STATUS.TASLAK) throw new Error("Belge zaten imza sürecinde veya tamamlanmış.");

  run(
    "UPDATE documents SET status = 'IMZADA', submitted_at = datetime('now') WHERE id = ?",
    documentId,
  );
  logEvent({
    complaintId: doc.complaint_id,
    type: EVENT_TYPE.BELGE,
    title: `${DOC_TYPE_CODE[doc.type as DocType]} imza sürecine alındı`,
    note: doc.doc_no,
    actorId: user.id,
    payload: { documentId },
  });
}

export function updateDocumentBody(documentId: number, body: unknown, user: SessionUser): void {
  const doc = one<DocumentRow>("SELECT * FROM documents WHERE id = ?", documentId);
  if (!doc) throw new Error("Belge bulunamadı.");
  if (doc.status === DOC_STATUS.ONAYLANDI) throw new Error("Onaylanmış belge değiştirilemez.");
  run("UPDATE documents SET body = ? WHERE id = ?", JSON.stringify(body), documentId);
  logEvent({
    complaintId: doc.complaint_id,
    type: EVENT_TYPE.BELGE,
    title: `${DOC_TYPE_CODE[doc.type as DocType]} içeriği güncellendi`,
    note: doc.doc_no,
    actorId: user.id,
  });
}

/* --- İmza ---------------------------------------------------------------- */

/** Zincirde imza bekleyen ilk sıra. */
export function pendingSignature(documentId: number): SignatureRow | undefined {
  return one<SignatureRow>(
    `SELECT * FROM document_signatures
      WHERE document_id = ? AND decision = 'BEKLIYOR'
      ORDER BY sort_order LIMIT 1`,
    documentId,
  );
}

/** Kullanıcı bu belgeyi şu an imzalayabilir mi. */
export function canSignNow(documentId: number, user: SessionUser): boolean {
  const doc = one<DocumentRow>("SELECT status FROM documents WHERE id = ?", documentId);
  if (!doc || doc.status !== DOC_STATUS.IMZADA) return false;
  const p = pendingSignature(documentId);
  if (!p) return false;
  if (p.user_id && p.user_id === user.id) return true;
  // Atanmış kullanıcı yoksa aynı unvanı taşıyan herkes imzalayabilir.
  const slot = signatureChain(doc.type as DocType).find((s) => s.order === p.sort_order);
  if (!slot) return false;
  return !p.user_id && rolesForSlot(slot).includes(user.role);
}

export interface SignResult {
  /** Zincir tamamlandı ve belge onaylandı mı. */
  completed: boolean;
  rejected: boolean;
}

/**
 * Sıradaki imzayı atar. "RED" verilirse belge reddedilir ve zincir durur.
 * Sıra dışı imza atılamaz — zincir sıralıdır.
 */
export function signDocument(
  documentId: number,
  user: SessionUser,
  decision: "ONAY" | "RED",
  note?: string | null,
): SignResult {
  return tx(() => {
    const doc = one<DocumentRow>("SELECT * FROM documents WHERE id = ?", documentId);
    if (!doc) throw new Error("Belge bulunamadı.");
    if (doc.status !== DOC_STATUS.IMZADA) throw new Error("Belge imza sürecinde değil.");

    const slotRow = pendingSignature(documentId);
    if (!slotRow) throw new Error("İmza bekleyen sıra yok.");

    const slot = signatureChain(doc.type as DocType).find((s) => s.order === slotRow.sort_order);
    const allowed = slot ? rolesForSlot(slot) : [];
    const isAssignee = slotRow.user_id === user.id;
    if (!isAssignee && !(slotRow.user_id === null && allowed.includes(user.role))) {
      throw new Error(
        `Bu sıradaki imza "${slotRow.expected_title}" unvanına aittir; sizin unvanınız "${user.title}".`,
      );
    }

    run(
      `UPDATE document_signatures
          SET user_id = ?, signer_name = ?, signer_title = ?, decision = ?,
              decided_at = datetime('now'), note = ?
        WHERE id = ?`,
      user.id, user.full_name, user.title, decision, note ?? null, slotRow.id,
    );

    logEvent({
      complaintId: doc.complaint_id,
      type: EVENT_TYPE.IMZA,
      title:
        decision === "ONAY"
          ? `${slotRow.expected_title} ${slotRow.is_approval ? "onayladı" : "imzaladı"}`
          : `${slotRow.expected_title} reddetti`,
      note: note ?? null,
      actorId: user.id,
      payload: { documentId, order: slotRow.sort_order, docType: doc.type },
    });

    if (decision === "RED") {
      run("UPDATE documents SET status = 'REDDEDILDI' WHERE id = ?", documentId);
      logEvent({
        complaintId: doc.complaint_id,
        type: EVENT_TYPE.BELGE,
        title: `${DOC_TYPE_CODE[doc.type as DocType]} reddedildi`,
        note: doc.doc_no,
        actorId: user.id,
      });
      return { completed: false, rejected: true };
    }

    const remaining = scalar<number>(
      "SELECT COUNT(*) FROM document_signatures WHERE document_id = ? AND decision = 'BEKLIYOR'",
      documentId,
    ) ?? 0;

    if (remaining === 0) {
      run(
        `UPDATE documents SET status = 'ONAYLANDI', approved_at = datetime('now'), approved_by = ?
          WHERE id = ?`,
        user.id, documentId,
      );
      logEvent({
        complaintId: doc.complaint_id,
        type: EVENT_TYPE.BELGE,
        title: `${DOC_TYPE_CODE[doc.type as DocType]} onaylandı`,
        note: `${doc.doc_no} — imza zinciri tamamlandı`,
        actorId: user.id,
        payload: { documentId },
      });
      return { completed: true, rejected: false };
    }
    return { completed: false, rejected: false };
  });
}

/** Reddedilen belgeyi yeniden taslağa alır ve imzaları sıfırlar. */
export function reopenDocument(documentId: number, user: SessionUser, reason: string): void {
  const doc = one<DocumentRow>("SELECT * FROM documents WHERE id = ?", documentId);
  if (!doc) throw new Error("Belge bulunamadı.");
  if (doc.status === DOC_STATUS.ONAYLANDI) throw new Error("Onaylanmış belge yeniden açılamaz.");
  tx(() => {
    run(
      `UPDATE document_signatures
          SET decision = 'BEKLIYOR', decided_at = NULL, signer_name = NULL,
              signer_title = NULL, note = NULL
        WHERE document_id = ?`,
      documentId,
    );
    run("UPDATE documents SET status = 'TASLAK', submitted_at = NULL WHERE id = ?", documentId);
  });
  logEvent({
    complaintId: doc.complaint_id,
    type: EVENT_TYPE.BELGE,
    title: `${DOC_TYPE_CODE[doc.type as DocType]} düzeltme için taslağa alındı`,
    note: reason,
    actorId: user.id,
  });
}

export function cancelDocument(documentId: number, user: SessionUser, reason: string): void {
  const doc = one<DocumentRow>("SELECT * FROM documents WHERE id = ?", documentId);
  if (!doc) throw new Error("Belge bulunamadı.");
  run(
    "UPDATE documents SET status = 'IPTAL', cancelled_at = datetime('now'), cancel_reason = ? WHERE id = ?",
    reason, documentId,
  );
  logEvent({
    complaintId: doc.complaint_id,
    type: EVENT_TYPE.BELGE,
    title: `${DOC_TYPE_CODE[doc.type as DocType]} iptal edildi`,
    note: reason,
    actorId: user.id,
  });
}

/* --- Sorgular ------------------------------------------------------------ */

function withSignatures(doc: DocumentRow & { created_by_name: string | null }): DocumentView {
  const signatures = all<SignatureRow>(
    "SELECT * FROM document_signatures WHERE document_id = ? ORDER BY sort_order", doc.id,
  );
  return {
    ...doc,
    signatures,
    pending: signatures.find((s) => s.decision === "BEKLIYOR") ?? null,
  };
}

export function complaintDocuments(complaintId: number): DocumentView[] {
  const docs = all<DocumentRow & { created_by_name: string | null }>(
    `SELECT d.*, u.full_name AS created_by_name
       FROM documents d LEFT JOIN users u ON u.id = d.created_by
      WHERE d.complaint_id = ? ORDER BY d.id`,
    complaintId,
  );
  return docs.map(withSignatures);
}

export function getDocument(documentId: number): DocumentView | undefined {
  const doc = one<DocumentRow & { created_by_name: string | null }>(
    `SELECT d.*, u.full_name AS created_by_name
       FROM documents d LEFT JOIN users u ON u.id = d.created_by
      WHERE d.id = ?`,
    documentId,
  );
  return doc ? withSignatures(doc) : undefined;
}

/** Şikâyetin onaylanmış tutanağı (FR PASAT 004 veya 005). */
export function approvedTutanak(complaintId: number): DocumentView | undefined {
  const doc = one<DocumentRow & { created_by_name: string | null }>(
    `SELECT d.*, NULL AS created_by_name FROM documents d
      WHERE d.complaint_id = ? AND d.type IN ('FR_PASAT_004','FR_PASAT_005','INCELEME_TUTANAGI')
        AND d.status = 'ONAYLANDI'
      ORDER BY d.id DESC LIMIT 1`,
    complaintId,
  );
  return doc ? withSignatures(doc) : undefined;
}

/** Kullanıcının imzasını bekleyen belgeler. */
export function documentsAwaitingUser(user: SessionUser, limit = 50): (DocumentView & {
  complaint_no: string; customer_company: string; factory_short: string | null;
})[] {
  const rows = all<DocumentRow & {
    created_by_name: string | null; complaint_no: string;
    customer_company: string; factory_short: string | null;
  }>(
    `SELECT d.*, NULL AS created_by_name, c.complaint_no, c.customer_company,
            f.short_name AS factory_short
       FROM documents d
       JOIN complaints c ON c.id = d.complaint_id
       LEFT JOIN factories f ON f.id = c.factory_id
      WHERE d.status = 'IMZADA'
        AND (c.factory_id = ? OR ? = 1)
      ORDER BY d.id DESC LIMIT ?`,
    user.factory_id ?? -1, user.role === "SISTEM_YONETICISI" ? 1 : 0, limit,
  );
  return rows
    .map((r) => ({ ...withSignatures(r), complaint_no: r.complaint_no,
                   customer_company: r.customer_company, factory_short: r.factory_short }))
    .filter((d) => {
      const p = d.pending;
      if (!p) return false;
      if (p.user_id === user.id) return true;
      const slot = signatureChain(d.type as DocType).find((s) => s.order === p.sort_order);
      return !p.user_id && !!slot && rolesForSlot(slot).includes(user.role);
    });
}

export { DOC_TYPE };
