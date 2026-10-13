import Link from "next/link";
import { fmtDate, slaInfo, type HolidaySet } from "@/lib/dates";
import { fmtQuantity } from "@/lib/format";
import { DEMAND_LABEL, type Demand } from "@/lib/domain";
import type { ComplaintView } from "@/lib/types";
import { Chip, EmptyState, SlaChip, StatusChip, VerdictChip } from "./ui";

export interface TableRowExtra {
  nextDue: string | null;
  nextTitle: string | null;
}

/** Şikâyet dosyaları listesi. SLA sütunu en yakın açık görevin son tarihini gösterir. */
export function ComplaintTable({
  rows, extras, holidays, showFactory = false, emptyHint,
}: {
  rows: ComplaintView[];
  extras: Record<number, TableRowExtra>;
  holidays: HolidaySet;
  showFactory?: boolean;
  emptyHint?: string;
}) {
  if (rows.length === 0) {
    return (
      <EmptyState
        title="Kayıt bulunamadı"
        hint={emptyHint ?? "Seçtiğiniz filtrelere uyan şikâyet dosyası yok."}
      />
    );
  }

  return (
    <div className="table-wrap">
      <table className="tbl">
        <thead>
          <tr>
            <th>Şikâyet no</th>
            {showFactory && <th>Fabrika</th>}
            <th>Tarih</th>
            <th>Müşteri</th>
            <th>Konu</th>
            <th>Ürün</th>
            <th className="text-right">Miktar</th>
            <th>Durum</th>
            <th>Karar</th>
            <th>Sıradaki adım</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((c) => {
            const e = extras[c.id] ?? { nextDue: null, nextTitle: null };
            const sla = slaInfo(e.nextDue, null, holidays);
            return (
              <tr key={c.id}>
                <td className="whitespace-nowrap">
                  <Link href={`/panel/sikayet/${c.id}`} className="font-mono text-xs font-semibold text-brand-700 hover:underline">
                    {c.complaint_no}
                  </Link>
                  {c.category_critical === 1 && (
                    <span className="ml-1.5 align-middle" title="Gıda güvenliği ihbarı">
                      <Chip tone="danger">GG</Chip>
                    </span>
                  )}
                  {c.redirected_at && (
                    <span className="ml-1.5 align-middle" title="Başka fabrikadan yönlendirildi">
                      <Chip tone="brand">↷</Chip>
                    </span>
                  )}
                </td>
                {showFactory && <td className="whitespace-nowrap text-ink-600">{c.factory_short}</td>}
                <td className="tnum whitespace-nowrap text-ink-600">{fmtDate(c.received_at)}</td>
                <td className="max-w-[14rem]">
                  <span className="block truncate font-medium text-ink-800" title={c.customer_company}>
                    {c.customer_company}
                  </span>
                  <span className="block truncate text-xs text-ink-500">
                    {c.province_name ?? "—"} · {DEMAND_LABEL[c.demand as Demand] ?? c.demand}
                  </span>
                </td>
                <td className="max-w-[16rem]">
                  <span className="block truncate" title={c.subject}>{c.subject}</span>
                  {c.category_name && (
                    <span className="block truncate text-xs text-ink-500">{c.category_name}</span>
                  )}
                </td>
                <td className="max-w-[12rem]">
                  <span className="block truncate text-ink-700">{c.product_name}</span>
                  {c.lot_no && <span className="block truncate text-xs text-ink-500">Lot {c.lot_no}</span>}
                </td>
                <td className="tnum whitespace-nowrap text-right text-ink-700">
                  {c.quantity_kg ? fmtQuantity(c.quantity_kg) : "—"}
                </td>
                <td><StatusChip status={c.status} /></td>
                <td><VerdictChip verdict={c.verdict} /></td>
                <td className="max-w-[15rem]">
                  {e.nextTitle ? (
                    <>
                      <span className="block truncate text-xs text-ink-700" title={e.nextTitle}>
                        {e.nextTitle}
                      </span>
                      <span className="mt-0.5 block"><SlaChip sla={sla} compact /></span>
                    </>
                  ) : (
                    <span className="text-xs text-ink-400">Açık görev yok</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
