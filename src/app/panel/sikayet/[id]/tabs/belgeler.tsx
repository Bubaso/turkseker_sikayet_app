"use client";

import Link from "next/link";
import { DOC_TYPE_CODE, DOC_TYPE_LABEL, type DocType } from "@/lib/domain";
import { fmtDateTime } from "@/lib/dates";
import type { DocumentView } from "@/lib/types";
import { ActionForm } from "@/components/action-form";
import { BelgeOnizleme } from "@/components/belge-onizleme";
import { Card, Chip, DocStatusChip, EmptyState, Notice } from "@/components/ui";
import { reopenDocAction, signAction } from "@/app/panel/actions";

/** Belgeler ve sıralı imza zinciri. */
export function BelgelerTab({
  complaintId, documents, signableIds, canPrepare,
}: {
  complaintId: number;
  documents: DocumentView[];
  /** Kullanıcının şu an imzalayabileceği belge kimlikleri. */
  signableIds: number[];
  canPrepare: boolean;
}) {
  if (documents.length === 0) {
    return <EmptyState title="Belge yok" hint="Şikâyet formu ve tutanaklar süreç ilerledikçe otomatik açılır." />;
  }

  return (
    <div className="space-y-5">
      {documents.map((d) => {
        const canSign = signableIds.includes(d.id);
        const signed = d.signatures.filter((s) => s.decision === "ONAY").length;
        const rejected = d.signatures.find((s) => s.decision === "RED");

        return (
          <Card
            key={d.id}
            title={
              <span className="flex flex-wrap items-center gap-2">
                {DOC_TYPE_LABEL[d.type as DocType] ?? d.type}
                <Chip tone="ink">{DOC_TYPE_CODE[d.type as DocType] ?? ""}</Chip>
                <DocStatusChip status={d.status} />
              </span>
            }
            actions={
              <div className="flex flex-wrap items-center gap-2">
                <BelgeOnizleme
                  documentId={d.id}
                  baslik={DOC_TYPE_LABEL[d.type as DocType] ?? d.type}
                  docNo={d.doc_no}
                />
                <Link href={`/belge/${d.id}`} target="_blank" className="btn btn-secondary btn-sm">
                  Yazdır / PDF
                </Link>
              </div>
            }
            bodyClass=""
          >
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-ink-100 px-4 py-2.5 text-xs text-ink-500">
              <span>
                Belge no: <span className="font-mono">{d.doc_no}</span>
                {d.created_by_name && ` · Düzenleyen: ${d.created_by_name}`}
                {` · ${fmtDateTime(d.created_at)}`}
              </span>
              <span className="tnum">
                İmza: {signed} / {d.signatures.length}
              </span>
            </div>

            <div className="table-wrap">
              <table className="tbl">
                <thead>
                  <tr><th className="w-10">#</th><th>İmza yetkilisi</th><th>Kişi</th>
                      <th>Durum</th><th>Tarih</th><th>Not</th></tr>
                </thead>
                <tbody>
                  {d.signatures.map((s) => {
                    const isNext = d.pending?.id === s.id && d.status === "IMZADA";
                    return (
                      <tr key={s.id} className={isNext ? "bg-warn-50" : undefined}>
                        <td className="tnum text-ink-500">{s.sort_order}</td>
                        <td className="font-medium text-ink-800">
                          {s.expected_title}
                          {s.is_approval === 1 && <span className="ml-1.5"><Chip tone="brand">Onay</Chip></span>}
                        </td>
                        <td className="text-ink-600">{s.signer_name ?? "—"}</td>
                        <td>
                          {s.decision === "ONAY" ? <Chip tone="ok" dot>{s.is_approval ? "Onayladı" : "İmzaladı"}</Chip>
                            : s.decision === "RED" ? <Chip tone="danger" dot>Reddetti</Chip>
                            : isNext ? <Chip tone="warn" dot>Sırada</Chip>
                            : <Chip tone="ink">Bekliyor</Chip>}
                        </td>
                        <td className="tnum text-xs text-ink-500">{s.decided_at ? fmtDateTime(s.decided_at) : "—"}</td>
                        <td className="max-w-[16rem] text-xs text-ink-600">{s.note ?? "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {rejected && (
              <div className="border-t border-ink-100 p-4">
                <Notice tone="danger" title="Belge reddedildi">
                  {rejected.expected_title} tarafından reddedildi: {rejected.note ?? "gerekçe belirtilmemiş"}.
                </Notice>
              </div>
            )}

            {canSign && d.pending && (
              <div className="border-t border-ink-200 bg-ink-50 p-4 sm:p-5">
                <p className="mb-2.5 text-sm font-medium text-ink-800">
                  Sıra sizde — {d.pending.expected_title}
                  {d.pending.is_approval === 1 ? " olarak bu belgeyi onaylamanız bekleniyor." : " olarak bu belgeyi imzalamanız bekleniyor."}
                </p>
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <BelgeOnizleme
                    documentId={d.id}
                    baslik={DOC_TYPE_LABEL[d.type as DocType] ?? d.type}
                    docNo={d.doc_no}
                    label="Belgeyi oku"
                  />
                  <p className="text-xs text-ink-600">
                    İmzalamadan önce belgeyi okuyunuz. Onayınız ad-soyad, unvan ve zaman
                    damgasıyla kayda geçer.
                  </p>
                </div>
                <ActionForm action={signAction} complaintId={complaintId}
                            submitLabel={d.pending.is_approval === 1 ? "Onaylıyorum" : "İmzalıyorum"}
                            className="space-y-2.5"
                            extra={
                              <button type="submit" name="decision" value="RED"
                                      className="btn btn-danger btn-sm">
                                Reddet ve geri gönder
                              </button>
                            }>
                  <input type="hidden" name="documentId" value={d.id} />
                  <input type="hidden" name="decision" value="ONAY" />
                  <div>
                    <label className="label" htmlFor={`note-${d.id}`}>Not (reddediyorsanız zorunlu)</label>
                    <input id={`note-${d.id}`} name="note" className="input" />
                  </div>
                </ActionForm>
              </div>
            )}

            {canPrepare && d.status === "REDDEDILDI" && (
              <div className="border-t border-ink-200 p-4 sm:p-5">
                <ActionForm action={reopenDocAction} complaintId={complaintId}
                            submitLabel="Taslağa al ve düzelt" submitTone="secondary">
                  <input type="hidden" name="documentId" value={d.id} />
                  <div>
                    <label className="label" htmlFor={`reason-${d.id}`}>Düzeltme gerekçesi</label>
                    <input id={`reason-${d.id}`} name="reason" required className="input" />
                  </div>
                </ActionForm>
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}
