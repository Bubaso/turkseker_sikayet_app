"use client";

import { TEAM_UNIT_LABEL, TEAM_UNIT_ROLES, TEAM_UNITS, type TeamUnit } from "@/lib/roles";
import { fmtDateTime } from "@/lib/dates";
import type { TeamMemberView } from "@/lib/types";
import { ActionForm } from "@/components/action-form";
import { Basis, Card, Chip, EmptyState, Notice } from "@/components/ui";
import { formTeamAction, redirectAction } from "@/app/panel/actions";

export interface Staff {
  id: number;
  full_name: string;
  title: string;
  role: string;
}

/** Ekip oluşturma (md. 3) ve daha yakın fabrikaya yönlendirme (md. 2). */
export function EkipTab({
  complaintId, team, staff, canManage, factories, currentFactoryId,
  suggestion, teamFormed, redirectedAt, redirectedFrom, redirectReason, dueTeamAt,
}: {
  complaintId: number;
  team: TeamMemberView[];
  staff: Staff[];
  canManage: boolean;
  factories: { id: number; name: string }[];
  currentFactoryId: number;
  suggestion: { id: number; name: string } | null;
  teamFormed: string | null;
  redirectedAt: string | null;
  redirectedFrom: string | null;
  redirectReason: string | null;
  dueTeamAt: string | null;
}) {
  const units = Object.values(TEAM_UNITS) as TeamUnit[];

  return (
    <div className="space-y-5">
      <Card title="İnceleme ekibi" bodyClass="">
        {team.length === 0 ? (
          <EmptyState
            title="Ekip henüz oluşturulmadı"
            hint={`Şikâyet tarihinden itibaren en geç 1 iş günü içinde (${dueTeamAt ?? "—"}) ekip oluşturulmalıdır.`}
          />
        ) : (
          <div className="table-wrap">
            <table className="tbl">
              <thead>
                <tr><th>Personel</th><th>Unvan</th><th>Birim</th><th>Görev</th><th>Atama</th></tr>
              </thead>
              <tbody>
                {team.map((m) => (
                  <tr key={m.id}>
                    <td className="font-medium text-ink-800">{m.full_name}</td>
                    <td className="text-ink-600">{m.title}</td>
                    <td>{TEAM_UNIT_LABEL[m.unit as TeamUnit] ?? m.unit}</td>
                    <td>{m.is_lead ? <Chip tone="brand" dot>Ekip lideri</Chip> : <span className="text-ink-400">Üye</span>}</td>
                    <td className="tnum text-xs text-ink-500">{fmtDateTime(m.assigned_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {redirectedAt && (
        <Notice tone="brand" title="Bu dosya yönlendirildi">
          {redirectedFrom} fabrikasından {fmtDateTime(redirectedAt)} tarihinde yönlendirildi.
          {redirectReason && <span className="mt-1 block">Gerekçe: {redirectReason}</span>}
        </Notice>
      )}

      {canManage && !teamFormed && (
        <>
          <Card title="Ekibi oluştur">
            <ActionForm action={formTeamAction} complaintId={complaintId}
                        submitLabel="Ekibi oluştur ve incelemeyi başlat">
              <p className="text-sm text-ink-600">
                Şikâyetin mahiyetine göre aşağıdaki birimlerden uygun gördüğünüz personeli seçin.
                Ekip liderini seçmeyi unutmayın; yerinde inceleme ve numune görevleri ona atanır.
              </p>
              <div className="space-y-3">
                {units.map((unit) => {
                  const roles = TEAM_UNIT_ROLES[unit] as string[];
                  const list = staff.filter((s) => roles.includes(s.role));
                  if (list.length === 0) return null;
                  return (
                    <fieldset key={unit} className="rounded-[5px] border border-ink-200 p-3">
                      <legend className="px-1 text-xs font-semibold tracking-wide text-ink-600 uppercase">
                        {TEAM_UNIT_LABEL[unit]}
                      </legend>
                      <div className="space-y-1.5">
                        {list.map((s) => (
                          <div key={`${unit}-${s.id}`} className="flex flex-wrap items-center gap-3">
                            <label className="flex flex-1 cursor-pointer items-center gap-2 text-sm">
                              <input type="checkbox" name="member" value={`${s.id}|${unit}`} />
                              <span>
                                {s.full_name}
                                <span className="ml-1.5 text-xs text-ink-500">{s.title}</span>
                              </span>
                            </label>
                            <label className="flex cursor-pointer items-center gap-1.5 text-xs text-ink-600">
                              <input type="radio" name="lead" value={s.id} />
                              lider
                            </label>
                          </div>
                        ))}
                      </div>
                    </fieldset>
                  );
                })}
              </div>
              <div>
                <label className="label" htmlFor="note">Görevlendirme notu</label>
                <input id="note" name="note" className="input"
                       placeholder="Örnek: Firma deposunda 15 Ekim sabahı inceleme yapılacak." />
              </div>
              <Basis>
                TL PASAT 004 md. 2-3 — en geç 1 iş günü içinde Kalite ve İşletme Kontrol, Teknik
                (İşletme), Muhasebe ve Ziraat birimlerinden Fabrika Müdürünün uygun göreceği personel
                görevlendirilir.
              </Basis>
            </ActionForm>
          </Card>

          <Card title="Dosyayı daha yakın fabrikaya yönlendir">
            {suggestion && (
              <div className="mb-3">
                <Notice tone="info" title="Sistem önerisi">
                  Müşterinin iline en yakın fabrikamız <strong>{suggestion.name}</strong>. Dosyayı
                  oraya yönlendirirseniz ekip kurma süresi (1 iş günü) yeniden başlar.
                </Notice>
              </div>
            )}
            <ActionForm action={redirectAction} complaintId={complaintId}
                        submitLabel="Dosyayı yönlendir" submitTone="secondary"
                        confirm="Dosya seçtiğiniz fabrikaya devredilecek ve açık görevler oradaki personele atanacak. Onaylıyor musunuz?">
              <div>
                <label className="label" htmlFor="toFactoryId">Hedef fabrika</label>
                <select id="toFactoryId" name="toFactoryId" required className="input"
                        defaultValue={suggestion?.id ?? ""}>
                  <option value="">Seçiniz…</option>
                  {factories.filter((f) => f.id !== currentFactoryId).map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}{suggestion?.id === f.id ? " (en yakın)" : ""}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label" htmlFor="reason">Yönlendirme gerekçesi</label>
                <textarea id="reason" name="reason" rows={2} required className="input"
                          defaultValue={
                            suggestion
                              ? `Şikâyetçi firmanın adresi ${suggestion.name}'na daha yakın olduğundan dosya bu fabrikaya yönlendirilmiştir.`
                              : ""
                          } />
              </div>
              <Basis>
                TL PASAT 004 md. 2 — firma adresine daha yakın olan fabrikamızdan ekip oluşturulması
                talep edilebilir; yönlendirilen fabrika dosyanın kendisine ulaşmasından itibaren en
                geç 1 iş günü içinde ekip oluşturur.
              </Basis>
            </ActionForm>
          </Card>
        </>
      )}

      {canManage && teamFormed && (
        <Notice tone="ink">
          Ekip {fmtDateTime(teamFormed)} tarihinde oluşturuldu. Ekip oluşturulduktan sonra dosya
          başka fabrikaya yönlendirilemez.
        </Notice>
      )}
    </div>
  );
}
