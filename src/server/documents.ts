/* ===========================================================================
   Belgeler — sadeleştirilmiş.

   Uygulama yalnızca Müşteri Şikâyet Formunu (FR PASAT 007) üretir: bu form
   müşterinin beyanının kaydıdır ve Fabrika Müdürü dosyayı açtığında görmesi
   gereken belgedir. Tutanak, analiz raporu, resmî yazı ve bilgilendirme
   yazısı uygulamada ÜRETİLMEZ; fabrikada elle hazırlanıp aşama kaydında ek
   olarak yüklenir.
   =========================================================================== */

import { all, one, run, scalar } from "@/lib/db";
import { DOC_STATUS, DOC_TYPE, DOC_TYPE_CODE, type DocType } from "@/lib/domain";
import type { DocumentRow } from "@/lib/types";
import { EVENT_TYPE, logEvent } from "./events";

function belgeNo(complaintId: number, type: DocType): string {
  const no = scalar<string>("SELECT complaint_no FROM complaints WHERE id = ?", complaintId);
  return `${DOC_TYPE_CODE[type].replace(/\D/g, "")}/${no}`;
}

/** Şikâyet kaydıyla birlikte Müşteri Şikâyet Formunu kayda geçirir. */
export function createComplaintForm(complaintId: number, createdBy: number | null): number {
  const type = DOC_TYPE.FR_PASAT_007;
  const id = Number(
    run(
      `INSERT INTO documents (complaint_id, type, doc_no, status, created_by, approved_at)
       VALUES (?, ?, ?, ?, ?, datetime('now'))`,
      complaintId, type, belgeNo(complaintId, type), DOC_STATUS.ONAYLANDI, createdBy,
    ).lastInsertRowid,
  );
  logEvent({
    complaintId, type: EVENT_TYPE.BELGE,
    title: "Müşteri Şikâyet Formu kayda geçirildi",
    actorId: createdBy, payload: { documentId: id },
  });
  return id;
}

export function complaintDocuments(complaintId: number): DocumentRow[] {
  return all<DocumentRow>(
    "SELECT * FROM documents WHERE complaint_id = ? ORDER BY id", complaintId,
  );
}

export function getDocument(documentId: number): DocumentRow | undefined {
  return one<DocumentRow>("SELECT * FROM documents WHERE id = ?", documentId);
}

export { DOC_TYPE };
