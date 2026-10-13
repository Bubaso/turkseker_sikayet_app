"use client";

import { ATTACHMENT_KIND_LABEL, type AttachmentKind } from "@/lib/domain";
import { fmtDateTime } from "@/lib/dates";
import { fmtBytes } from "@/lib/format";
import type { AttachmentView } from "@/lib/types";
import { ActionButton, ActionForm } from "@/components/action-form";
import { Card, Chip, EmptyState } from "@/components/ui";
import { deleteAttachmentAction, uploadAction } from "@/app/panel/actions";

/** Kanıt görselleri, analiz raporları ve ıslak imzalı tutanak taramaları. */
export function EklerTab({
  complaintId, attachments, canUpload, accept, maxMb,
}: {
  complaintId: number;
  attachments: AttachmentView[];
  canUpload: boolean;
  accept: string;
  maxMb: number;
}) {
  const images = attachments.filter((a) => a.mime.startsWith("image/") && a.mime !== "image/heic");
  const others = attachments.filter((a) => !images.includes(a));

  return (
    <div className="space-y-5">
      {images.length > 0 && (
        <Card title="Görseller">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {images.map((a) => (
              <figure key={a.id} className="overflow-hidden rounded-[5px] border border-ink-200">
                <a href={`/api/ek/${a.id}`} target="_blank" rel="noreferrer">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`/api/ek/${a.id}`} alt={a.caption ?? a.file_name}
                       className="h-36 w-full bg-ink-100 object-cover" loading="lazy" />
                </a>
                <figcaption className="border-t border-ink-100 px-2 py-1.5">
                  <span className="block truncate text-xs font-medium text-ink-700" title={a.file_name}>
                    {a.file_name}
                  </span>
                  <span className="block text-[11px] text-ink-500">
                    {a.uploader_label ?? a.uploaded_by_name ?? "—"} · {fmtBytes(a.size)}
                  </span>
                </figcaption>
              </figure>
            ))}
          </div>
        </Card>
      )}

      <Card title="Tüm ekler" bodyClass="">
        {attachments.length === 0 ? (
          <EmptyState title="Ek dosya yok" hint="Kanıt görselleri, analiz raporları ve imzalı tutanak taramaları buraya yüklenir." />
        ) : (
          <div className="table-wrap">
            <table className="tbl">
              <thead>
                <tr><th>Dosya</th><th>Tür</th><th>Boyut</th><th>Yükleyen</th><th>Tarih</th><th></th></tr>
              </thead>
              <tbody>
                {[...images, ...others].map((a) => (
                  <tr key={a.id}>
                    <td>
                      <a href={`/api/ek/${a.id}`} target="_blank" rel="noreferrer" className="link">
                        {a.file_name}
                      </a>
                      {a.caption && <span className="block text-xs text-ink-500">{a.caption}</span>}
                    </td>
                    <td>
                      <Chip tone={a.kind === "ANALIZ_RAPORU" ? "brand" : a.kind === "IMZALI_TUTANAK" ? "ok" : "ink"}>
                        {ATTACHMENT_KIND_LABEL[a.kind as AttachmentKind] ?? a.kind}
                      </Chip>
                    </td>
                    <td className="tnum text-ink-600">{fmtBytes(a.size)}</td>
                    <td className="text-ink-600">{a.uploader_label ?? a.uploaded_by_name ?? "—"}</td>
                    <td className="tnum text-xs text-ink-500">{fmtDateTime(a.created_at)}</td>
                    <td className="text-right">
                      {canUpload && (
                        <ActionButton action={deleteAttachmentAction} complaintId={complaintId}
                                      label="Sil" tone="secondary" fields={{ attachmentId: a.id }}
                                      confirm={`"${a.file_name}" dosyası kalıcı olarak silinecek. Onaylıyor musunuz?`} />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {canUpload && (
        <Card title="Dosya yükle">
          <ActionForm action={uploadAction} complaintId={complaintId} submitLabel="Yükle">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div>
                <label className="label" htmlFor="kind">Dosya türü</label>
                <select id="kind" name="kind" className="input" defaultValue="KANIT">
                  {(Object.keys(ATTACHMENT_KIND_LABEL) as AttachmentKind[]).map((k) => (
                    <option key={k} value={k}>{ATTACHMENT_KIND_LABEL[k]}</option>
                  ))}
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className="label" htmlFor="caption">Açıklama</label>
                <input id="caption" name="caption" className="input"
                       placeholder="Örnek: Fabrika Müdürü onaylı ıslak imzalı tutanak taraması" />
              </div>
            </div>
            <div>
              <label className="label" htmlFor="dosya">Dosyalar</label>
              <input id="dosya" name="dosya" type="file" multiple accept={accept} required
                     className="input file:mr-3 file:rounded file:border-0 file:bg-ink-100 file:px-3 file:py-1.5 file:text-sm" />
              <span className="hint">Her dosya en çok {maxMb} MB. JPG, PNG, WEBP, PDF, Word, Excel.</span>
            </div>
          </ActionForm>
        </Card>
      )}
    </div>
  );
}
