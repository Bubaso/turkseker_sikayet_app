import Link from "next/link";
import { all } from "@/lib/db";
import { isGmRole } from "@/lib/roles";
import { PRODUCT_GROUP_LABEL, type ProductGroup } from "@/lib/domain";
import { MONTH_NAMES_TR, today } from "@/lib/dates";
import { fmtKg, fmtNum, fmtPct, fmtQuantity, fmtTl } from "@/lib/format";
import { kategoriAilesi } from "@/lib/category-labels";
import {requirePageUser} from "@/server/auth";
import {
  categoryBreakdown, defaultRange, factoryPerformance, milestoneSla,
  monthlyTrend, productGroupBreakdown, totalRow,
} from "@/server/stats";
import { Card, Notice, PageHeader, Stat } from "@/components/ui";
import { BarChartH, LineChart, Meter, StackedBarH, TableView, bandOf } from "@/components/charts";

export const dynamic = "force-dynamic";

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ bas?: string; bit?: string; fabrika?: string }>;
}) {
  const q = await searchParams;
  const user = await requirePageUser();
  const gm = isGmRole(user.role) || user.role === "SISTEM_YONETICISI";

  const def = defaultRange();
  const range = { from: q.bas || def.from, to: q.bit || def.to };
  const factoryFilter = gm ? (q.fabrika ? Number(q.fabrika) : null) : user.factory_id;

  const perf = factoryPerformance(range, factoryFilter);
  const total = totalRow(perf);
  const categories = categoryBreakdown(range, factoryFilter);
  const trend = monthlyTrend(12, factoryFilter);
  const groups = productGroupBreakdown(range, factoryFilter);
  const milestones = milestoneSla(range, factoryFilter);

  const factories = gm
    ? all<{ id: number; short_name: string }>(
        "SELECT id, short_name FROM factories WHERE is_active = 1 ORDER BY short_name",
      )
    : [];

  const justifiedRate = total.justified + total.rejected > 0
    ? Math.round((total.justified / (total.justified + total.rejected)) * 1000) / 10
    : null;

  const trendLabels = trend.map((t) => {
    const [y, m] = t.ym.split("-");
    return `${MONTH_NAMES_TR[Number(m) - 1]!.slice(0, 3)} ${y!.slice(2)}`;
  });

  // En çok şikâyet alan ilk 10 kategori; kalanı "Diğer" olarak toplanır.
  const topCats = categories.slice(0, 10);
  const restCount = categories.slice(10).reduce((a, c) => a + c.count, 0);
  const catRows = [
    ...topCats.map((c) => ({
      label: c.name.length > 26 ? `${c.name.slice(0, 25)}…` : c.name,
      value: c.count,
      hint: `${c.name} (${kategoriAilesi(c.family)}): ${c.count} şikâyet, ${c.justified} haklı`,
    })),
    ...(restCount > 0 ? [{ label: "Diğer", value: restCount, hint: `Diğer kategoriler: ${restCount} şikâyet` }] : []),
  ];

  const MILESTONE_SHORT: Record<string, string> = {
    EKIP_KUR: "Ekip oluşturma",
    YERINDE_INCELEME: "Yerinde inceleme",
    NUMUNE_AL: "Numune alma",
    ANALIZ_GIR: "Laboratuvar analizi",
    TUTANAK_HAZIRLA: "Tutanak düzenleme",
    TUTANAK_IMZA: "Tutanak imza",
    CAPA_BASLAT: "Düzeltici faaliyet",
    ITIRAZ_GONDER: "İtiraz gönderimi",
    DAIRE_KARAR: "Daire kararı",
    IADE_DEGISIM: "İade / değişim",
    NAKLIYE_ODEME: "Nakliye ödemesi",
    RESMI_YAZI: "Resmî yazı",
    MUSTERI_BILGI: "Müşteri bilgilendirme",
    DOSYA_KAPAT: "Dosya kapanışı",
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Performans panosu"
        subtitle={
          gm
            ? `${range.from} – ${range.to} · ${factoryFilter ? perf[0]?.factory : "14 fabrika"}`
            : `${range.from} – ${range.to} · ${user.factory_name}`
        }
        actions={
          <Link href="/panel/raporlar/aylik" className="btn btn-secondary btn-sm">
            Aylık şikâyet tablosu
          </Link>
        }
      />

      <Card title="Rapor aralığı" bodyClass="p-3.5">
        <form method="get" className="flex flex-wrap items-end gap-3">
          <div>
            <label className="label" htmlFor="bas">Başlangıç</label>
            <input id="bas" name="bas" type="date" defaultValue={range.from} className="input" />
          </div>
          <div>
            <label className="label" htmlFor="bit">Bitiş</label>
            <input id="bit" name="bit" type="date" defaultValue={range.to} className="input" />
          </div>
          {gm && (
            <div>
              <label className="label" htmlFor="fabrika">Fabrika</label>
              <select id="fabrika" name="fabrika" defaultValue={q.fabrika ?? ""} className="input">
                <option value="">Tümü (14 fabrika)</option>
                {factories.map((f) => <option key={f.id} value={f.id}>{f.short_name}</option>)}
              </select>
            </div>
          )}
          <button type="submit" className="btn btn-primary">Uygula</button>
          <Link href="/panel/raporlar" className="btn btn-secondary">Yılbaşından bugüne</Link>
        </form>
      </Card>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Toplam şikâyet" value={total.total} hint={`${total.open} açık · ${total.closed} kapandı`} />
        <Stat label="SLA uyum oranı" value={total.sla_rate == null ? "—" : fmtPct(total.sla_rate, 1)}
              tone={total.sla_rate == null ? "ink" : total.sla_rate >= 95 ? "ok" : total.sla_rate >= 85 ? "warn" : "danger"}
              hint={`${total.total_tasks - total.overdue_tasks} / ${total.total_tasks} görev süresinde`} />
        <Stat label="Ortalama kapanma" value={total.avg_close_days == null ? "—" : `${total.avg_close_days} iş günü`}
              tone="brand" hint="Şikâyet tarihinden kapanışa" />
        <Stat label="Haklı bulunma oranı" value={justifiedRate == null ? "—" : fmtPct(justifiedRate, 1)}
              hint={`${total.justified} haklı · ${total.rejected} haksız`} />
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="İade edilen miktar" value={fmtQuantity(total.returned_kg)} />
        <Stat label="Değişen miktar" value={fmtQuantity(total.exchanged_kg)} />
        <Stat label="İade / mahsup bedeli" value={fmtTl(total.refund_amount)} />
        <Stat label="Ödenen nakliye bedeli" value={fmtTl(total.freight_amount)} tone="warn" />
      </div>

      {total.total === 0 && (
        <Notice tone="info" title="Seçilen aralıkta veri yok">
          Rapor aralığını genişletin veya şikâyet kaydı oluşturun.
        </Notice>
      )}

      <Card title="Son 12 ayın seyri">
        <LineChart
          labels={trendLabels}
          series={[
            { name: "Gelen şikâyet", values: trend.map((t) => t.total), slot: 1 },
            { name: "Haklı bulunan", values: trend.map((t) => t.justified), slot: 2 },
            { name: "Kapanan dosya", values: trend.map((t) => t.closed), slot: 3 },
          ]}
          caption="Aylık şikâyet adedi, haklı bulunan dosya sayısı ve kapanan dosya sayısı."
        />
        <TableView
          headers={["Ay", "Gelen", "Haklı", "Kapanan"]}
          rows={trend.map((t, i) => [trendLabels[i]!, t.total, t.justified, t.closed])}
        />
      </Card>

      {gm && !factoryFilter && (
        <Card title="Fabrika bazında şikâyet adedi">
          <BarChartH
            rows={perf.map((p) => ({
              label: p.factory,
              value: p.total,
              hint: `${p.factory}: ${p.total} şikâyet · ${p.open} açık · SLA ${
                p.sla_rate == null ? "—" : `%${p.sla_rate}`
              }`,
            }))}
            unit="şikâyet"
            caption="Seçilen aralıkta her fabrikaya düşen şikâyet dosyası sayısı."
          />
          <TableView
            headers={["Fabrika", "Toplam", "Açık", "Kapandı", "Haklı", "Haksız", "SLA %", "Ort. kapanma (iş günü)"]}
            rows={perf.map((p) => [
              p.factory, p.total, p.open, p.closed, p.justified, p.rejected,
              p.sla_rate ?? "—", p.avg_close_days ?? "—",
            ])}
          />
        </Card>
      )}

      {gm && !factoryFilter && (
        <Card title="Fabrika bazında SLA uyum oranı">
          <p className="mb-3 text-xs text-ink-500">
            Son tarihi geçmemiş veya süresinde tamamlanmış görevlerin tüm görevlere oranı.
            Hedef: %95 ve üzeri.
          </p>
          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
            {perf.map((p) => (
              <Meter
                key={p.factory_id}
                label={p.factory}
                rate={p.sla_rate}
                hint={
                  p.total_tasks > 0
                    ? `${p.total_tasks - p.overdue_tasks} / ${p.total_tasks} görev süresinde · ${p.total} dosya`
                    : "Bu aralıkta görev yok"
                }
              />
            ))}
          </div>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <Card title="Şikâyet türü dağılımı">
          <BarChartH rows={catRows} unit="şikâyet" labelWidth={170}
                     caption="En çok bildirilen şikâyet türleri." />
          <TableView
            headers={["Şikâyet türü", "Aile", "Adet", "Haklı bulunan"]}
            rows={categories.map((c) => [c.name, kategoriAilesi(c.family), c.count, c.justified])}
          />
        </Card>

        <Card title="Ürün grubu dağılımı">
          <BarChartH
            rows={groups.map((g) => ({
              label: PRODUCT_GROUP_LABEL[g.product_group as ProductGroup] ?? g.product_group,
              value: g.count,
              hint: `${PRODUCT_GROUP_LABEL[g.product_group as ProductGroup] ?? g.product_group}: ${
                g.count
              } şikâyet, ${fmtQuantity(g.quantity_kg)} şikâyete konu miktar`,
            }))}
            unit="şikâyet" labelWidth={150}
            caption="Ürün gruplarına göre şikâyet adedi."
          />
          <TableView
            headers={["Ürün grubu", "Adet", "Şikâyete konu miktar (kg)"]}
            rows={groups.map((g) => [
              PRODUCT_GROUP_LABEL[g.product_group as ProductGroup] ?? g.product_group,
              g.count, g.quantity_kg,
            ])}
          />
        </Card>
      </div>

      <Card title="Kilometre taşı bazında süre uyumu">
        <StackedBarH
          rows={milestones.map((m) => ({
            label: MILESTONE_SHORT[m.code] ?? m.title,
            segments: [
              { name: "Süresinde tamamlandı", value: m.onTime, slot: 1 },
              { name: "Gecikmeli tamamlandı", value: m.late, slot: 2 },
              { name: "Hâlâ gecikmede", value: m.pendingLate, slot: 3 },
            ],
          }))}
          legend={[
            { name: "Süresinde tamamlandı", slot: 1 },
            { name: "Gecikmeli tamamlandı", slot: 2 },
            { name: "Hâlâ gecikmede", slot: 3 },
          ]}
          caption="Her adımın süresinde tamamlanma oranı. Sağdaki yüzde, süresinde tamamlanan payıdır."
        />
        <TableView
          headers={["Kilometre taşı", "Toplam", "Süresinde", "Gecikmeli", "Hâlâ gecikmede", "Uyum %"]}
          rows={milestones.map((m) => [
            MILESTONE_SHORT[m.code] ?? m.title, m.total, m.onTime, m.late, m.pendingLate,
            m.total > 0 ? Math.round((m.onTime / m.total) * 1000) / 10 : "—",
          ])}
        />
      </Card>

      {gm && !factoryFilter && (
        <Card title="Fabrika karşılaştırma tablosu" bodyClass="">
          <div className="table-wrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Fabrika</th><th className="text-right">Toplam</th><th className="text-right">Açık</th>
                  <th className="text-right">Kapandı</th><th className="text-right">Haklı</th>
                  <th className="text-right">Haksız</th><th className="text-right">SLA</th>
                  <th className="text-right">Ort. kapanma</th><th className="text-right">İade (kg)</th>
                  <th className="text-right">Değişim (kg)</th><th className="text-right">Nakliye (₺)</th>
                </tr>
              </thead>
              <tbody>
                {perf.map((p) => {
                  const band = bandOf(p.sla_rate);
                  return (
                    <tr key={p.factory_id}>
                      <td className="font-medium text-ink-800">{p.factory}</td>
                      <td className="tnum text-right">{p.total}</td>
                      <td className="tnum text-right">{p.open}</td>
                      <td className="tnum text-right">{p.closed}</td>
                      <td className="tnum text-right">{p.justified}</td>
                      <td className="tnum text-right">{p.rejected}</td>
                      <td className={`tnum text-right font-semibold ${
                            band === "good" ? "text-ok-700" : band === "warning" ? "text-warn-700"
                            : band === "critical" ? "text-danger-700" : "text-ink-400"}`}>
                        {p.sla_rate == null ? "—" : fmtPct(p.sla_rate, 1)}
                      </td>
                      <td className="tnum text-right">{p.avg_close_days ?? "—"}</td>
                      <td className="tnum text-right">{p.returned_kg ? fmtNum(p.returned_kg) : "—"}</td>
                      <td className="tnum text-right">{p.exchanged_kg ? fmtNum(p.exchanged_kg) : "—"}</td>
                      <td className="tnum text-right">{p.freight_amount ? fmtNum(p.freight_amount) : "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-ink-300 font-semibold">
                  <td>TOPLAM</td>
                  <td className="tnum text-right">{total.total}</td>
                  <td className="tnum text-right">{total.open}</td>
                  <td className="tnum text-right">{total.closed}</td>
                  <td className="tnum text-right">{total.justified}</td>
                  <td className="tnum text-right">{total.rejected}</td>
                  <td className="tnum text-right">{total.sla_rate == null ? "—" : fmtPct(total.sla_rate, 1)}</td>
                  <td className="tnum text-right">{total.avg_close_days ?? "—"}</td>
                  <td className="tnum text-right">{fmtNum(total.returned_kg)}</td>
                  <td className="tnum text-right">{fmtNum(total.exchanged_kg)}</td>
                  <td className="tnum text-right">{fmtNum(total.freight_amount)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </Card>
      )}

      <p className="text-xs text-ink-500">
        Rapor {today()} tarihinde üretildi. SLA hesapları iş günü bazlıdır; hafta sonları ve
        Tanımlar sayfasında kayıtlı resmî tatiller düşülür.
      </p>
    </div>
  );
}
