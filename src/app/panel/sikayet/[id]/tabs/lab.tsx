"use client";

import { CONFORMITY_LABEL, type Conformity } from "@/lib/domain";
import { fmtDate, fmtDateTime } from "@/lib/dates";
import type { AnalysisView, LabParameter, SampleView } from "@/lib/types";
import { ActionForm } from "@/components/action-form";
import { Basis, Card, Chip, EmptyState, Notice } from "@/components/ui";
import { analysisAction, sampleAction } from "@/app/panel/actions";

/** Numune kaydı ve laboratuvar analizi (md. 4). */
export function LabTab({
  complaintId, samples, analyses, parameters, productGroup, today,
  canSample, canAnalyze, accept,
}: {
  complaintId: number;
  samples: SampleView[];
  analyses: AnalysisView[];
  parameters: LabParameter[];
  productGroup: string;
  today: string;
  canSample: boolean;
  canAnalyze: boolean;
  accept: string;
}) {
  return (
    <div className="space-y-5">
      <Card title="Numuneler" bodyClass="">
        {samples.length === 0 ? (
          <EmptyState title="Numune kaydı yok"
                      hint="Şikâyetin mahiyetine göre gerektiğinde numune alınır ve buraya kaydedilir." />
        ) : (
          <div className="table-wrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Numune no</th><th>Alınma tarihi</th><th>Alan</th><th>Yer</th>
                  <th>Lot</th><th>Miktar</th><th>Mühür</th><th>Analiz</th>
                </tr>
              </thead>
              <tbody>
                {samples.map((s) => (
                  <tr key={s.id}>
                    <td className="font-mono text-xs">{s.sample_no}</td>
                    <td className="tnum">{fmtDate(s.taken_at)}</td>
                    <td className="text-ink-600">{s.taken_by_name ?? "—"}</td>
                    <td>{s.taken_place ?? "—"}</td>
                    <td>{s.lot_no ?? "—"}</td>
                    <td>{s.quantity ?? "—"}</td>
                    <td>{s.seal_no ?? "—"}</td>
                    <td>
                      {s.analysis_count > 0
                        ? <Chip tone="ok">{s.analysis_count} analiz</Chip>
                        : <Chip tone="warn">Bekliyor</Chip>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {canSample && (
        <Card title="Numune kaydı ekle">
          <ActionForm action={sampleAction} complaintId={complaintId} submitLabel="Numuneyi kaydet">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div>
                <label className="label" htmlFor="takenAt">Alınma tarihi</label>
                <input id="takenAt" name="takenAt" type="date" required defaultValue={today} className="input" />
              </div>
              <div className="sm:col-span-2">
                <label className="label" htmlFor="takenPlace">Alındığı yer</label>
                <input id="takenPlace" name="takenPlace" required className="input"
                       placeholder="Örnek: Şikâyetçi firma deposu / Fabrika ambarı" />
              </div>
              <div>
                <label className="label" htmlFor="lotNo">Parti / Lot no</label>
                <input id="lotNo" name="lotNo" className="input" />
              </div>
              <div>
                <label className="label" htmlFor="quantity">Numune miktarı</label>
                <input id="quantity" name="quantity" className="input" placeholder="2 x 500 g" />
              </div>
              <div>
                <label className="label" htmlFor="sealNo">Mühür no</label>
                <input id="sealNo" name="sealNo" className="input" />
              </div>
            </div>
            <div>
              <label className="label" htmlFor="note">Not</label>
              <input id="note" name="note" className="input" />
            </div>
            <Basis>TL PASAT 004 md. 4 — gerektiğinde numune alınır, aynı gün veya takip eden iş günü analiz edilir.</Basis>
          </ActionForm>
        </Card>
      )}

      <Card title="Analiz sonuçları" bodyClass="">
        {analyses.length === 0 ? (
          <EmptyState title="Analiz kaydı yok" />
        ) : (
          <div className="divide-y divide-ink-200">
            {analyses.map((a) => (
              <div key={a.id} className="p-4 sm:p-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-medium text-ink-900">
                      Rapor no: <span className="font-mono text-sm">{a.report_no}</span>
                    </p>
                    <p className="text-xs text-ink-500">
                      {fmtDate(a.analyzed_at)} · {a.analyzed_by_name ?? "—"} · {a.lab_name ?? "—"}
                      {a.sample_no && ` · Numune ${a.sample_no}`}
                    </p>
                  </div>
                  <Chip tone={a.conformity === "UYGUN" ? "ok" : a.conformity === "UYGUN_DEGIL" ? "danger" : "warn"} dot>
                    {CONFORMITY_LABEL[a.conformity as Conformity] ?? a.conformity}
                  </Chip>
                </div>

                {a.summary && (
                  <p className="mt-2 text-sm whitespace-pre-wrap text-ink-700">{a.summary}</p>
                )}

                <div className="table-wrap mt-3">
                  <table className="tbl">
                    <thead>
                      <tr><th>Parametre</th><th className="text-right">Sonuç</th><th>Birim</th>
                          <th>Spesifikasyon</th><th>Değerlendirme</th></tr>
                    </thead>
                    <tbody>
                      {a.results.map((r) => (
                        <tr key={r.id}>
                          <td className="font-medium text-ink-800">{r.parameter}</td>
                          <td className="tnum text-right font-semibold">{r.value}</td>
                          <td className="text-ink-500">{r.unit ?? "—"}</td>
                          <td className="text-ink-600">{r.spec_text ?? "—"}</td>
                          <td>
                            {r.conforms === 1 ? <Chip tone="ok">Uygun</Chip>
                              : r.conforms === 0 ? <Chip tone="danger" dot>Uygun değil</Chip>
                              : <Chip tone="ink">Değerlendirilmedi</Chip>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="mt-2 text-xs text-ink-500">Kayıt: {fmtDateTime(a.created_at)}</p>
              </div>
            ))}
          </div>
        )}
      </Card>

      {canAnalyze && (
        <Card title="Analiz sonucu gir">
          <ActionForm action={analysisAction} complaintId={complaintId} submitLabel="Analizi kaydet">
            <input type="hidden" name="productGroup" value={productGroup} />
            {samples.length === 0 && (
              <Notice tone="warn">
                Henüz numune kaydı yok. Numune alınmadan analiz girerseniz numune bağlantısı boş kalır.
              </Notice>
            )}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
              <div>
                <label className="label" htmlFor="reportNo">Rapor no</label>
                <input id="reportNo" name="reportNo" required className="input" placeholder="LAB-2026-0147" />
              </div>
              <div>
                <label className="label" htmlFor="analyzedAt">Analiz tarihi</label>
                <input id="analyzedAt" name="analyzedAt" type="date" required defaultValue={today} className="input" />
              </div>
              <div>
                <label className="label" htmlFor="sampleId">Numune</label>
                <select id="sampleId" name="sampleId" className="input">
                  <option value="">Numune bağlamayın</option>
                  {samples.map((s) => <option key={s.id} value={s.id}>{s.sample_no}</option>)}
                </select>
              </div>
              <div>
                <label className="label" htmlFor="labName">Laboratuvar</label>
                <input id="labName" name="labName" className="input"
                       defaultValue="Kalite ve İşletme Kontrol Laboratuvarı" />
              </div>
            </div>

            <div>
              <span className="label">Parametre sonuçları</span>
              <p className="hint mb-2">
                Yalnızca ölçtüğünüz parametrelere değer girin. Uygunluk, spesifikasyon sınırlarına
                göre otomatik değerlendirilir; gerekirse elle değiştirebilirsiniz.
              </p>
              <div className="table-wrap">
                <table className="tbl">
                  <thead>
                    <tr><th>Parametre</th><th>Spesifikasyon</th><th className="w-32">Sonuç</th>
                        <th className="w-44">Uygunluk</th></tr>
                  </thead>
                  <tbody>
                    {parameters.map((p) => (
                      <tr key={p.id}>
                        <td className="font-medium text-ink-800">
                          {p.name}{p.unit ? <span className="ml-1 text-xs text-ink-500">({p.unit})</span> : null}
                        </td>
                        <td className="text-ink-600">{p.spec_text ?? "—"}</td>
                        <td>
                          <input name={`deger_${p.id}`} className="input px-2 py-1 text-sm"
                                 inputMode="decimal" placeholder="—" />
                        </td>
                        <td>
                          <select name={`uygun_${p.id}`} className="input px-2 py-1 text-sm">
                            <option value="">Otomatik</option>
                            <option value="1">Uygun</option>
                            <option value="0">Uygun değil</option>
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div>
              <label className="label" htmlFor="summary">Değerlendirme özeti</label>
              <textarea id="summary" name="summary" rows={3} className="input"
                        placeholder="Analiz sonuçlarının genel değerlendirmesi. Tutanağa işlenecektir." />
            </div>
            <div>
              <label className="label" htmlFor="rapor">Analiz raporu dosyası</label>
              <input id="rapor" name="rapor" type="file" accept={accept}
                     className="input file:mr-3 file:rounded file:border-0 file:bg-ink-100 file:px-3 file:py-1.5 file:text-sm" />
            </div>
            <Basis>
              TL PASAT 004 md. 4 — Kalite ve İşletme Kontrol Laboratuvarı analizi yapar, sonucu
              analiz raporuyla birlikte tutanak altına alınır.
            </Basis>
          </ActionForm>
        </Card>
      )}
    </div>
  );
}
