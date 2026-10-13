/* ===========================================================================
   Dosya ekleri — kanıt görselleri, analiz raporları, ıslak imzalı tutanaklar.
   Dosyalar UPLOAD_DIR altında rastgele adla saklanır; özgün ad veritabanında
   tutulur. Tarayıcıya yalnızca güvenli tür listesindekiler gömülü gösterilir.
   =========================================================================== */

import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { all, one, run } from "@/lib/db";
import type { AttachmentView } from "@/lib/types";
import { EVENT_TYPE, logEvent } from "./events";
import { getSettingNum } from "./settings";

const ALLOWED: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/heic": ".heic",
  "application/pdf": ".pdf",
  "application/msword": ".doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
  "application/vnd.ms-excel": ".xls",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": ".xlsx",
};

export const ACCEPT_ATTR = ".jpg,.jpeg,.png,.webp,.heic,.pdf,.doc,.docx,.xls,.xlsx";

export function uploadDir(): string {
  return path.resolve(process.env.UPLOAD_DIR ?? "./data/uploads");
}

export function isImage(mime: string): boolean {
  return mime.startsWith("image/") && mime !== "image/heic";
}

export interface StoredFile {
  fileName: string;
  storedName: string;
  mime: string;
  size: number;
}

/** Dosyayı diske yazar; tür ve boyut kontrolünü yapar. */
export async function storeFile(file: File): Promise<StoredFile> {
  const maxMb = getSettingNum("ek_dosya_max_mb", 10);
  if (file.size === 0) throw new Error(`"${file.name}" boş bir dosya.`);
  if (file.size > maxMb * 1024 * 1024) {
    throw new Error(`"${file.name}" dosyası ${maxMb} MB sınırını aşıyor.`);
  }
  const ext = ALLOWED[file.type];
  if (!ext) {
    throw new Error(
      `"${file.name}" türü desteklenmiyor. İzin verilen türler: JPG, PNG, WEBP, PDF, Word, Excel.`,
    );
  }

  const dir = uploadDir();
  await fs.mkdir(dir, { recursive: true });
  const storedName = `${Date.now().toString(36)}-${crypto.randomBytes(8).toString("hex")}${ext}`;
  await fs.writeFile(path.join(dir, storedName), Buffer.from(await file.arrayBuffer()));

  return {
    fileName: file.name.slice(0, 180),
    storedName,
    mime: file.type,
    size: file.size,
  };
}

export interface AttachInput {
  complaintId: number;
  kind?: string;
  caption?: string | null;
  documentId?: number | null;
  analysisId?: number | null;
  uploadedBy?: number | null;
  uploaderLabel?: string | null;
}

export function recordAttachment(f: StoredFile, input: AttachInput): number {
  const id = Number(
    run(
      `INSERT INTO attachments
         (complaint_id, document_id, analysis_id, kind, file_name, stored_name, mime, size,
          caption, uploaded_by, uploader_label)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      input.complaintId, input.documentId ?? null, input.analysisId ?? null,
      input.kind ?? "KANIT", f.fileName, f.storedName, f.mime, f.size,
      input.caption ?? null, input.uploadedBy ?? null, input.uploaderLabel ?? null,
    ).lastInsertRowid,
  );
  logEvent({
    complaintId: input.complaintId,
    type: EVENT_TYPE.EK,
    title: `Dosya eklendi: ${f.fileName}`,
    note: input.caption ?? null,
    actorId: input.uploadedBy ?? null,
    actorLabel: input.uploaderLabel ?? null,
    payload: { attachmentId: id, kind: input.kind ?? "KANIT" },
  });
  return id;
}

export function complaintAttachments(complaintId: number): AttachmentView[] {
  return all<AttachmentView>(
    `SELECT a.*, u.full_name AS uploaded_by_name
       FROM attachments a LEFT JOIN users u ON u.id = a.uploaded_by
      WHERE a.complaint_id = ? ORDER BY a.id`,
    complaintId,
  );
}

export function getAttachment(id: number): AttachmentView | undefined {
  return one<AttachmentView>(
    `SELECT a.*, u.full_name AS uploaded_by_name
       FROM attachments a LEFT JOIN users u ON u.id = a.uploaded_by WHERE a.id = ?`,
    id,
  );
}

export async function deleteAttachment(id: number, actorId: number): Promise<void> {
  const a = getAttachment(id);
  if (!a) return;
  run("DELETE FROM attachments WHERE id = ?", id);
  await fs.rm(path.join(uploadDir(), a.stored_name), { force: true });
  logEvent({
    complaintId: a.complaint_id,
    type: EVENT_TYPE.EK,
    title: `Dosya silindi: ${a.file_name}`,
    actorId,
  });
}
