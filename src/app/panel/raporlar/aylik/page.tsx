import Link from "next/link";
import { all } from "@/lib/db";
import { isGmRole } from "@/lib/roles";
import { MONTH_NAMES_TR, fmtDate, today } from "@/lib/dates";
import { fmtKg, fmtNum, fmtTl } from "@/lib/format";
import {requirePageUser} from "@/server/auth";
import { MONTHLY_HEADERS, buildMonthlyReport, monthlyCells } from "@/server/monthly";
import { Card, Chip, Notice, PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";

/** FR PASAT 005 — Aylık Müşteri Şikâyetleri Tablosu (ekran görünümü + Excel). */
export default async function MonthlyReportPage({
  searchParams,
}: {
  searchParams: Promise<{ y?: string; a?: string; fabrika?: string }>;
}) {
  const q = await searchParams;
  const user = await requirePageUser();
  const gm = isGmRole(user.role) || user.role === "SISTEM_YONETICISI";

  const ref = today();
  const year = Number(q.y ?? ref.slice(0, 4));
  const month = Number(q.a ?? ref.slice(5, 7));

  const factories = all<{ id: number; name: string; short_name: string }>(
    "SELECT id, name, short_name FROM factories WHERE is_active = 1 ORDER BY short_name",
  );
  const factoryId = gm
    ? Number(q.fabrika ?? factories[0]?.id ?? 0)
    : (user.factory_id ?? 0);

  if (!factoryId) {
    return (
      <div className="space-y-5">
        <PageHeader title="Aylık şikâyet tablosu" />
        <Notice tone="warn">Fabrika tanımı bulunamadı.</Notice>
      </div>
    );
  }

  const rep = buildMonthlyReport(factoryId, year, month);
  const excelHref =
    `/api/rapor/aylik?y=${year}&a=${month}${gm ? `&fabrika=${factoryId}` : ""}`;

  const years = [Number(ref.slice(0, 4)), Number(ref.slice(0, 4)) - 1, Number(ref.slice(0, 4)) - 2];

  return (
    <div className="space-y-5">
      <PageHeader
        breadcrumb={[
          { href: "/panel", label: "Panel" },
          { href: "/panel/raporlar", label: "Raporlar" },
        ]}
        title="Aylık Müşteri Şikâyetleri Tablosu"
        subtitle={`${rep.factoryName} · ${rep.periodLabel} · ${rep.rows.length} kayıt`}
        actions={
          <a href={excelHref} className="btn btn-primary btn-sm">Excel olarak indir</a>
        }
      />

      <Card title="Dönem seçimi" bodyClass="p-3.5">
        <form method="get" className="flex flex-wrap items-end gap-3">
          {gm && (
            <div>
              <label className="label" htmlFor="fabrika">Fabrika</label>
              <select id="fabrika" name="fabrika" defaultValue={String(factoryId)} className="input">
                {factories.map((f) => <option key={f.id} value={f.id}>{f.short_name}</option>)}
              </select>
            </div>
          )}
          <div>
            <label className="label" htmlFor="a">Ay</label>
            <select id="a" name="a" defaultValue={String(month)} className="input">
              {MONTH_NAMES_TR.map((m, i) => (
                <option key={m} value={i + 1}>{m}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="y">Yıl</label>
            <select id="y" name="y" defaultValue={String(year)} className="input">
              {years.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          <button type="submit" className="btn btn-primary">Göster</button>
        </form>
      </Card>

      <Notice tone="info" title="Gönderim dağıtımı">
        <ul className="mt-1 list-inside list-disc">
          {rep.recipients.map((r) => <li key={r}>{r}</li>)}
        </ul>
        <p className="mt-1.5 text-xs">
          Dayanak: TL PASAT 004 md. 8 — fabrika bazında müşteri şikâyetleri aylık bazda bu tabloya
          işlenerek ilgili Daire Başkanlıklarına gönderilir. Paketli şekerlerde Perakende Satışlar
          ve Lojistik, diğer ürünlerde Pazarlama ve Satış Daire Başkanlığı; her iki halde de Şeker
          Üretim, Mali İşler ve Muhasebe ve Strateji Geliştirme Daire Başkanlıkları.
        </p>
      </Notice>

      {rep.emptyNote && <Notice tone="warn" title="Tablo notu">{rep.emptyNote}</Notice>}

      <Card title="Tablo" bodyClass="">
        <div className="table-wrap">
          <table className="tbl">
            <thead>
              <tr>
                {MONTHLY_HEADERS.map((h) => (
                  <th key={h} className="align-bottom whitespace-normal" style={{ minWidth: 92 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rep.rows.length === 0 ? (
                <tr>
                  <td colSpan={MONTHLY_HEADERS.length} className="py-6 text-center text-ink-500">
                    Bu dönemde kayıt yok.
                  </td>
                </tr>
              ) : (
                rep.rows.map((row) => {
                  const cells = monthlyCells(row);
                  return (
                    <tr key={row.id} className={row.carried_over ? "bg-warn-50" : undefined}>
                      {cells.map((v, i) => (
                        <td key={i} className={[9, 12, 13, 14, 15].includes(i + 1) ? "tnum text-right" : ""}>
                          {i === 0 ? (
                            <Link href={`/panel/sikayet/${row.id}`}
                                  className="font-mono text-xs text-brand-700 hover:underline">
                              {String(v)}
                            </Link>
                          ) : v == null || v === "" ? (
                            <span className="text-ink-400">—</span>
                          ) : typeof v === "number" ? (
                            [14, 15].includes(i + 1) ? fmtTl(v) : fmtKg(v)
                          ) : (
                            <span className="block max-w-[22rem] text-xs">{v}</span>
                          )}
                        </td>
                      ))}
                    </tr>
                  );
                })
              )}
            </tbody>
            {rep.rows.length > 0 && (
              <tfoot>
                <tr className="border-t-2 border-ink-300 font-semibold">
                  <td colSpan={11}>AYLIK İŞLEM TOPLAMI</td>
                  <td className="tnum text-right">{fmtKg(rep.totals.returned_kg)}</td>
                  <td className="tnum text-right">{fmtKg(rep.totals.exchanged_kg)}</td>
                  <td className="tnum text-right">{fmtTl(rep.totals.refund_amount)}</td>
                  <td className="tnum text-right">{fmtTl(rep.totals.freight_amount)}</td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
        <div className="flex flex-wrap items-center gap-3 border-t border-ink-200 px-4 py-2.5 text-xs text-ink-500">
          <span className="flex items-center gap-1.5">
            <span className="inline-block size-3 rounded-sm border border-warn-200 bg-warn-50" aria-hidden />
            Önceki aydan devreden açık dosya
          </span>
          <span>Düzenleme tarihi: {fmtDate(today())}</span>
          <span>Mali alanlara yalnızca {rep.periodLabel} içinde gerçekleşen işlemler yazılmıştır.</span>
        </div>
      </Card>

      {gm && (
        <Card title="Tüm fabrikaların bu dönem özeti" bodyClass="">
          <div className="table-wrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Fabrika</th><th className="text-right">Kayıt</th>
                  <th className="text-right">Devreden</th><th className="text-right">İade (kg)</th>
                  <th className="text-right">Değişim (kg)</th><th className="text-right">İade bedeli</th>
                  <th className="text-right">Nakliye bedeli</th><th></th>
                </tr>
              </thead>
              <tbody>
                {factories.map((f) => {
                  const r = buildMonthlyReport(f.id, year, month);
                  const carried = r.rows.filter((x) => x.carried_over).length;
                  return (
                    <tr key={f.id} className={f.id === factoryId ? "bg-brand-50/60" : undefined}>
                      <td className="font-medium text-ink-800">{f.short_name}</td>
                      <td className="tnum text-right">{r.rows.length}</td>
                      <td className="tnum text-right">
                        {carried > 0 ? <Chip tone="warn">{carried}</Chip> : <span className="text-ink-400">—</span>}
                      </td>
                      <td className="tnum text-right">{r.totals.returned_kg ? fmtNum(r.totals.returned_kg) : "—"}</td>
                      <td className="tnum text-right">{r.totals.exchanged_kg ? fmtNum(r.totals.exchanged_kg) : "—"}</td>
                      <td className="tnum text-right">{r.totals.refund_amount ? fmtNum(r.totals.refund_amount) : "—"}</td>
                      <td className="tnum text-right">{r.totals.freight_amount ? fmtNum(r.totals.freight_amount) : "—"}</td>
                      <td className="text-right">
                        <a href={`/api/rapor/aylik?y=${year}&a=${month}&fabrika=${f.id}`}
                           className="btn btn-secondary btn-sm">Excel</a>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
