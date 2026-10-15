"use client";

import { ATTACHMENT_KIND_LABEL, type AttachmentKind } from "@/lib/domain";
import { fmtDateTime } from "@/lib/dates";
import { fmtBytes } from "@/lib/format";
import type { AttachmentView } from "@/lib/types";
import { ActionButton, ActionForm } from "@/components/action-form";
import { BelgeOnizleme } from "@/components/belge-onizleme";
import { Chip } from "@/components/ui";
import { deleteAttachmentAction, uploadAction } from "@/app/panel/actions";

/* ===========================================================================
   Dosyanın bütün ekleri.

   Her aşama kendi belgesini aşama kutusunda gösterir; burası dosyadaki tüm
   dosyaların tek listesi ve serbest yükleme yeridir. Günlük işte gerekmediği
   için katlanmış durur.

   Listenin ilk satırı, uygulamanın ürettiği tek belge olan Müşteri Şikâyet
   Formudur. Diskte bir dosyası yoktur; şikâyet verisinden çizilir, bu yüzden
   "Göster" düğmesiyle önizlenir ve silinemez.
   =========================================================================== */

export interface FormBelgesi {
  id: number;
  doc_no: string;
  created_at: string;
}

export function Ekler({
  complaintId, attachments, form, canUpload, accept, maxMb,
}: {
  complaintId: number;
  attachments: AttachmentView[];
  form: FormBelgesi | null;
  canUpload: boolean;
  accept: string;
  maxMb: number;
}) {
  const gorseller = attachments.filter(
    (a) => a.mime.startsWith("image/") && a.mime !== "image/heic",
  );

  return (
    <details className="card overflow-hidden">
      <summary className="cursor-pointer border-b border-ink-200 px-4 py-2.5 text-baslik font-semibold tracking-wide text-ink-700 uppercase">
        Bütün ekler ({attachments.length + (form ? 1 : 0)})
      </summary>

      <div className="space-y-4 p-4 sm:p-5">
        {gorseller.length > 0 && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {gorseller.map((a) => (
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
                  <span className="block text-rozet text-ink-500">
                    {a.uploader_label ?? a.uploaded_by_name ?? "—"} · {fmtBytes(a.size)}
                  </span>
                </figcaption>
              </figure>
            ))}
          </div>
        )}

        {attachments.length === 0 && !form ? (
          <p className="text-sm text-ink-500">
            Dosyada henüz ek yok. Müşterinin ilettiği görseller ve aşama kayıtlarında yüklenen
            belgeler burada toplanır.
          </p>
        ) : (
          <div className="table-wrap">
            <table className="tbl">
              <thead>
                <tr><th>Dosya</th><th>Tür</th><th>Boyut</th><th>Yükleyen</th><th>Tarih</th><th></th></tr>
              </thead>
              <tbody>
                {form && (
                  <tr>
                    <td>
                      <span className="font-medium text-ink-800">Müşteri Şikâyet Formu</span>
                      <span className="block font-mono text-xs text-ink-500">{form.doc_no}</span>
                    </td>
                    <td><Chip tone="info">Uygulamanın ürettiği belge</Chip></td>
                    <td className="text-ink-400">—</td>
                    <td className="text-ink-600">Kayıtla birlikte</td>
                    <td className="tnum text-xs text-ink-500">{fmtDateTime(form.created_at)}</td>
                    <td className="text-right">
                      <BelgeOnizleme documentId={form.id}
                                     baslik="Müşteri Şikâyet Formu (FR PASAT 007)"
                                     docNo={form.doc_no} />
                    </td>
                  </tr>
                )}
                {attachments.map((a) => (
                  <tr key={a.id}>
                    <td>
                      <a href={`/api/ek/${a.id}`} target="_blank" rel="noreferrer" className="link">
                        {a.file_name}
                      </a>
                      {a.caption && <span className="block text-xs text-ink-500">{a.caption}</span>}
                    </td>
                    <td>
                      <Chip tone={a.kind === "KANIT" ? "ink" : "info"}>
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

        {canUpload && (
          <div className="border-t border-ink-100 pt-4">
            <ActionForm action={uploadAction} complaintId={complaintId} submitLabel="Yükle" compact>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div>
                  <label className="label" htmlFor="kind">Dosya türü</label>
                  <select id="kind" name="kind" className="input" defaultValue="DIGER">
                    {(Object.keys(ATTACHMENT_KIND_LABEL) as AttachmentKind[]).map((k) => (
                      <option key={k} value={k}>{ATTACHMENT_KIND_LABEL[k]}</option>
                    ))}
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label className="label" htmlFor="caption">Açıklama</label>
                  <input id="caption" name="caption" className="input"
                         placeholder="Örnek: Müşteriden gelen ek fotoğraflar" />
                </div>
              </div>
              <div>
                <label className="label" htmlFor="dosya">Dosyalar</label>
                <input id="dosya" name="dosya" type="file" multiple accept={accept} required
                       className="input file:mr-3 file:rounded file:border-0 file:bg-ink-100 file:px-3 file:py-1.5 file:text-sm" />
                <span className="hint">Her dosya en çok {maxMb} MB. JPG, PNG, WEBP, PDF, Word, Excel.</span>
              </div>
            </ActionForm>
          </div>
        )}
      </div>
    </details>
  );
}
