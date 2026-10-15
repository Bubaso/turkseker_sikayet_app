import Link from "next/link";
import { all } from "@/lib/db";
import { PERMISSIONS, can } from "@/lib/roles";
import { PRODUCT_GROUP_LABEL, type ProductGroup } from "@/lib/domain";
import { fmtDate, slaInfo, today } from "@/lib/dates";
import { fmtQuantity } from "@/lib/format";
import { ESCALATION_THRESHOLD_TEXT } from "@/lib/domain";
import {requirePageUser} from "@/server/auth";
import { ACCEPT_ATTR } from "@/server/attachments";
import { holidaySet } from "@/server/settings";
import { Card, Chip, EmptyState, Notice, PageHeader, SlaChip, Stat } from "@/components/ui";
import { LineChart } from "@/components/charts";
import { Grafik } from "@/components/grafik";
import { daireKararOzeti, itirazSeyri } from "@/server/yonetim";
import type { ComplaintView } from "@/lib/types";
import { EscalationDecision } from "./decision";

export const dynamic = "force-dynamic";

/** Daire Başkanlığı itiraz kuyruğu (TL PASAT 004 md. 5). */
export default async function EscalationsPage({
  searchParams,
}: {
  searchParams: Promise<{ gecmis?: string }>;
}) {
  const { gecmis } = await searchParams;
  const user = await requirePageUser();
  const holidays = holidaySet();
  const showHistory = gecmis === "1";
  const mine = user.role === "GM_DAIRE" ? user.department_id : null;

  const rows = all<ComplaintView>(
    `SELECT c.*, f.name AS factory_name, f.code AS factory_code, f.short_name AS factory_short,
            NULL AS origin_factory_name, cat.name AS category_name, cat.family AS category_family,
            cat.is_critical AS category_critical, p.name AS province_name,
            d.name AS department_name, NULL AS received_by_name, 0 AS open_task_count
       FROM complaints c
       JOIN factories f ON f.id = c.factory_id
       LEFT JOIN complaint_categories cat ON cat.id = c.category_id
       LEFT JOIN provinces p ON p.code = c.customer_province
       LEFT JOIN departments d ON d.id = c.escalated_dept_id
      WHERE c.escalated_at IS NOT NULL
        AND c.escalation_decided_at IS ${showHistory ? "NOT NULL" : "NULL"}
        ${mine ? `AND c.escalated_dept_id = ${Number(mine)}` : ""}
      ORDER BY c.escalation_due_at IS NULL, c.escalation_due_at`,
  );

  const canDecide = can(user.role, PERMISSIONS.ITIRAZ_KARAR);
  // Daire Başkanının kendi tutarlılığını görebilmesi için karar geçmişi özeti.
  const ozet = mine ? daireKararOzeti(Number(mine)) : null;
  const seyir = mine ? itirazSeyri(12, Number(mine)) : [];

  return (
    <div className="space-y-5">
      <PageHeader
        title={showHistory ? "Karara bağlanmış itirazlar" : "İtiraz değerlendirmeleri"}
        subtitle={
          mine
            ? `${user.department_name} — ${rows.length} dosya`
            : `Tüm daireler — ${rows.length} dosya`
        }
        actions={
          <div className="flex gap-2">
            <Link href="/panel/itirazlar"
                  className={`btn btn-sm ${!showHistory ? "btn-primary" : "btn-secondary"}`}>
              Bekleyenler
            </Link>
            <Link href="/panel/itirazlar?gecmis=1"
                  className={`btn btn-sm ${showHistory ? "btn-primary" : "btn-secondary"}`}>
              Karara bağlananlar
            </Link>
          </div>
        }
      />

      {ozet && ozet.toplam > 0 && (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat label="Karara bağladığım" value={ozet.toplam} />
            <Stat label="Kabul oranı"
                  value={`%${Math.round((ozet.kabul / ozet.toplam) * 1000) / 10}`}
                  hint={`${ozet.kabul} kabul · ${ozet.ret} ret`} />
            <Stat label="Ortalama karar süresi"
                  value={ozet.ortKararGunu == null ? "—" : `${ozet.ortKararGunu} iş günü`}
                  tone={ozet.ortKararGunu != null && ozet.ortKararGunu > 5 ? "warn" : "ink"}
                  hint="Hedef: 5 iş günü" />
            <Stat label="Süreye uyum"
                  value={ozet.sureyeUyum == null ? "—" : `%${ozet.sureyeUyum}`}
                  tone={ozet.sureyeUyum != null && ozet.sureyeUyum < 95 ? "danger" : "ok"}
                  hint="5 iş günü içinde karara bağlanan" />
          </div>

          {seyir.length > 1 && (
            <Grafik
              baslik="İtirazların 12 aylık seyri"
              tablo={{
                headers: ["Ay", "Gelen", "Kabul"],
                rows: seyir.map((a) => [a.ay, a.gelen, a.kabul]),
              }}
            >
              <LineChart
                labels={seyir.map((a) => a.ay)}
                series={[
                  { name: "Gelen itiraz", slot: 1, values: seyir.map((a) => a.gelen) },
                  { name: "Kabul edilen", slot: 2, values: seyir.map((a) => a.kabul) },
                ]}
                caption="Dairenize gelen itiraz sayısı ve kabul edilen itirazlar."
              />
            </Grafik>
          )}
        </>
      )}

      {!showHistory && (
        <Notice tone="info" title="İtiraz hangi dosyalar için gelir?">
          Fabrika tarafından haklı bulunmayan şikâyetlerde, şikâyete konu miktar{" "}
          {Object.entries(ESCALATION_THRESHOLD_TEXT)
            .filter(([k]) => k !== "PAKETLI_SEKER")
            .map(([, v]) => v).join(", ")}{" "}
          eşiklerini aşıyorsa dosya ilgili Daire Başkanlığına gönderilir. Paketli şekerde dosya
          Perakende Satışlar ve Lojistik Daire Başkanlığına, diğer ürünlerde Pazarlama ve Satış
          Daire Başkanlığına düşer. Karar süresi <strong>5 iş günü</strong>dür.
        </Notice>
      )}

      {rows.length === 0 ? (
        <Card>
          <EmptyState
            title={showHistory ? "Karara bağlanmış itiraz yok" : "Bekleyen itiraz yok"}
            hint={showHistory ? undefined : "Eşiği aşan ve haklı bulunmayan bir dosya geldiğinde burada listelenir."}
          />
        </Card>
      ) : (
        <div className="space-y-5">
          {rows.map((c) => {
            const sla = slaInfo(c.escalation_due_at, c.escalation_decided_at, holidays);
            const isMine = !mine || c.escalated_dept_id === mine;
            return (
              <Card
                key={c.id}
                title={
                  <span className="flex flex-wrap items-center gap-2">
                    <Link href={`/panel/sikayet/${c.id}`} className="font-mono text-brand-700 hover:underline">
                      {c.complaint_no}
                    </Link>
                    <span className="font-normal normal-case">{c.factory_name}</span>
                    {c.category_critical === 1 && <Chip tone="danger" dot>Gıda güvenliği</Chip>}
                  </span>
                }
                actions={<SlaChip sla={sla} />}
              >
                <div className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-3">
                  {[
                    ["Müşteri", c.customer_company],
                    ["İl", c.province_name ?? "—"],
                    ["Şikâyet tarihi", fmtDate(c.received_at)],
                    ["Ürün", `${c.product_name}${c.packaging ? ` — ${c.packaging}` : ""}`],
                    ["Ürün grubu", PRODUCT_GROUP_LABEL[c.product_group as ProductGroup] ?? c.product_group],
                    ["Şikâyete konu miktar", c.quantity_kg ? fmtQuantity(c.quantity_kg) : "—"],
                    ["Değerlendiren daire", c.department_name ?? "—"],
                    ["İtiraz tarihi", fmtDate(c.escalated_at)],
                    ["Karar son tarihi", fmtDate(c.escalation_due_at)],
                  ].map(([k, v]) => (
                    <div key={k}>
                      <dt className="text-xs font-medium tracking-wide text-ink-500 uppercase">{k}</dt>
                      <dd className="mt-0.5 text-sm text-ink-900">{v}</dd>
                    </div>
                  ))}
                  <div className="sm:col-span-3">
                    <dt className="text-xs font-medium tracking-wide text-ink-500 uppercase">Şikâyet konusu</dt>
                    <dd className="mt-0.5 text-sm text-ink-900">{c.subject}</dd>
                  </div>
                  <div className="sm:col-span-3">
                    <dt className="text-xs font-medium tracking-wide text-ink-500 uppercase">
                      Fabrikanın inceleme sonucu ve gerekçesi
                    </dt>
                    <dd className="mt-0.5 text-sm whitespace-pre-wrap text-ink-900">
                      {c.verdict_reason ?? "—"}
                    </dd>
                  </div>
                  <div className="sm:col-span-3">
                    <dt className="text-xs font-medium tracking-wide text-ink-500 uppercase">
                      İtiraz gerekçesi
                    </dt>
                    <dd className="mt-0.5 text-sm whitespace-pre-wrap text-ink-900">
                      {c.escalation_reason ?? "—"}
                    </dd>
                  </div>
                  {c.escalation_decided_at && (
                    <div className="sm:col-span-3 border-t border-ink-100 pt-3">
                      <dt className="text-xs font-medium tracking-wide text-ink-500 uppercase">
                        Daire kararı — {fmtDate(c.escalation_decided_at)}
                      </dt>
                      <dd className="mt-1">
                        <Chip tone={c.escalation_result === "SIKAYET_HAKLI" ? "ok" : "ink"} dot>
                          {c.escalation_result === "SIKAYET_HAKLI"
                            ? "Şikâyet haklı — itiraz kabul edildi"
                            : "Şikâyet haklı bulunmadı — fabrika kararı teyit edildi"}
                        </Chip>
                        <p className="mt-1.5 text-sm whitespace-pre-wrap text-ink-700">
                          {c.escalation_note ?? "—"}
                        </p>
                      </dd>
                    </div>
                  )}
                </div>

                <div className="mt-4 border-t border-ink-100 pt-3">
                  <Link href={`/panel/sikayet/${c.id}`} className="btn btn-secondary btn-sm">
                    Dosyayı aç — form, tutanaklar ve kanıtlar
                  </Link>
                </div>

                {!showHistory && canDecide && isMine && (
                  <div className="mt-4 border-t border-ink-200 pt-4">
                    <EscalationDecision complaintId={c.id} bugun={today()} accept={ACCEPT_ATTR} />
                  </div>
                )}
                {!showHistory && canDecide && !isMine && (
                  <p className="mt-3 text-xs text-ink-500">
                    Bu dosya {c.department_name} değerlendirmesinde; karar yetkisi o dairededir.
                  </p>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
