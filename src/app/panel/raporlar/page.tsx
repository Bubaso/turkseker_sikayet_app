import { isGmRole } from "@/lib/roles";
import { PRODUCT_GROUP_LABEL, type ProductGroup } from "@/lib/domain";
import { MONTH_NAMES_TR, fmtDate, today } from "@/lib/dates";
import { fmtPct, fmtQuantity, fmtTl } from "@/lib/format";
import { ASAMALAR, type AsamaKodu } from "@/lib/asamalar";
import { kategoriAilesi } from "@/lib/category-labels";
import { requirePageUser } from "@/server/auth";
import {
  categoryBreakdown, defaultRange, factoryPerformance, milestoneSla,
  monthlyTrend, productGroupBreakdown, totalRow,
} from "@/server/stats";
import { Notice, PageHeader, Stat } from "@/components/ui";
import { BarChartH, LineChart, Meter, StackedBarH } from "@/components/charts";
import { Grafik } from "@/components/grafik";
import { DonemSecici } from "@/components/donem-secici";

export const dynamic = "force-dynamic";

/**
 * Fabrikanın kendi performans panosu. Genel Müdürlük tarafı aynı ölçüleri
 * gösterge panelinde 14 fabrika için görür; burası tek fabrikanın kendi
 * aynasıdır. Her ölçü ya grafik ya tablo olarak görünür.
 */
export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ bas?: string; bit?: string }>;
}) {
  const q = await searchParams;
  const user = await requirePageUser();
  const gm = isGmRole(user.role) || user.role === "SISTEM_YONETICISI";

  const def = defaultRange();
  const range = { from: q.bas || def.from, to: q.bit || def.to };
  const factoryId = gm ? null : user.factory_id;

  const perf = factoryPerformance(range, factoryId);
  const toplam = totalRow(perf);
  const kategoriler = categoryBreakdown(range, factoryId);
  const trend = monthlyTrend(12, factoryId);
  const gruplar = productGroupBreakdown(range, factoryId);
  const asamalar = milestoneSla(range, factoryId);

  const hakliOrani = toplam.justified + toplam.rejected > 0
    ? Math.round((toplam.justified / (toplam.justified + toplam.rejected)) * 1000) / 10
    : null;

  const trendEtiket = trend.map((t) => {
    const [y, m] = t.ym.split("-");
    return `${MONTH_NAMES_TR[Number(m) - 1]!.slice(0, 3)} ${y!.slice(2)}`;
  });

  const ilk10 = kategoriler.slice(0, 10);
  const kalan = kategoriler.slice(10).reduce((a, c) => a + c.count, 0);
  const kategoriCubuk = [
    ...ilk10.map((c) => ({
      label: c.name.length > 26 ? `${c.name.slice(0, 25)}…` : c.name,
      value: c.count,
      hint: `${c.name} (${kategoriAilesi(c.family)}): ${c.count} şikâyet, ${c.justified} haklı`,
    })),
    ...(kalan > 0 ? [{ label: "Diğer", value: kalan, hint: `Diğer türler: ${kalan} şikâyet` }] : []),
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Performans panosu"
        subtitle={`${fmtDate(range.from)} – ${fmtDate(range.to)} · ${
          gm ? "14 fabrika" : user.factory_name
        }`}
        actions={<a href="/api/rapor/aylik" className="btn btn-secondary btn-sm">Aylık tablo (Excel)</a>}
      />

      <section className="card-pad">
        <DonemSecici bas={range.from} bit={range.to} hedef="/panel/raporlar" />
      </section>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Toplam şikâyet" value={toplam.total}
              hint={`${toplam.open} açık · ${toplam.closed} kapandı`} />
        <Stat label="SLA uyum oranı" value={toplam.sla_rate == null ? "—" : fmtPct(toplam.sla_rate, 1)}
              tone={toplam.sla_rate == null ? "ink" : toplam.sla_rate >= 95 ? "ok" : toplam.sla_rate >= 85 ? "warn" : "danger"}
              hint={`${toplam.total_tasks - toplam.overdue_tasks} / ${toplam.total_tasks} aşama süresinde`} />
        <Stat label="Ortalama kapanma"
              value={toplam.avg_close_days == null ? "—" : `${toplam.avg_close_days} iş günü`}
              tone="brand" hint="Şikâyet tarihinden kapanışa" />
        <Stat label="Haklı bulunma oranı" value={hakliOrani == null ? "—" : fmtPct(hakliOrani, 1)}
              hint={`${toplam.justified} haklı · ${toplam.rejected} haksız`} />
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="İade edilen miktar" value={fmtQuantity(toplam.returned_kg)} />
        <Stat label="Değişen miktar" value={fmtQuantity(toplam.exchanged_kg)} />
        <Stat label="İade / mahsup bedeli" value={fmtTl(toplam.refund_amount)} />
        <Stat label="Ödenen nakliye bedeli" value={fmtTl(toplam.freight_amount)} tone="warn" />
      </div>

      {toplam.total === 0 && (
        <Notice tone="info" title="Seçilen aralıkta veri yok">
          Rapor aralığını genişletin veya şikâyet kaydı oluşturun.
        </Notice>
      )}

      <Grafik
        baslik="Son 12 ayın seyri"
        tablo={{
          headers: ["Ay", "Gelen", "Haklı", "Kapanan"],
          rows: trend.map((t, i) => [trendEtiket[i]!, t.total, t.justified, t.closed]),
        }}
      >
        <LineChart
          labels={trendEtiket}
          series={[
            { name: "Gelen şikâyet", values: trend.map((t) => t.total), slot: 1 },
            { name: "Haklı bulunan", values: trend.map((t) => t.justified), slot: 2 },
            { name: "Kapanan dosya", values: trend.map((t) => t.closed), slot: 3 },
          ]}
          caption="Aylık şikâyet adedi, haklı bulunan dosya sayısı ve kapanan dosya sayısı."
        />
      </Grafik>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <Grafik
          baslik="Şikâyet türü dağılımı"
          tablo={{
            headers: ["Şikâyet türü", "Aile", "Adet", "Haklı bulunan"],
            rows: kategoriler.map((c) => [c.name, kategoriAilesi(c.family), c.count, c.justified]),
          }}
        >
          <BarChartH rows={kategoriCubuk} unit="şikâyet" labelWidth={170}
                     caption="En çok bildirilen şikâyet türleri." />
        </Grafik>

        <Grafik
          baslik="Ürün grubu dağılımı"
          tablo={{
            headers: ["Ürün grubu", "Adet", "Şikâyete konu miktar (kg)"],
            rows: gruplar.map((g) => [
              PRODUCT_GROUP_LABEL[g.product_group as ProductGroup] ?? g.product_group,
              g.count, g.quantity_kg,
            ]),
          }}
        >
          <BarChartH
            rows={gruplar.map((g) => ({
              label: PRODUCT_GROUP_LABEL[g.product_group as ProductGroup] ?? g.product_group,
              value: g.count,
              hint: `${PRODUCT_GROUP_LABEL[g.product_group as ProductGroup] ?? g.product_group}: ${
                g.count} şikâyet, ${fmtQuantity(g.quantity_kg)}`,
            }))}
            unit="şikâyet" labelWidth={150}
            caption="Ürün gruplarına göre şikâyet adedi."
          />
        </Grafik>
      </div>

      <Grafik
        baslik="Aşama bazında süre uyumu"
        tablo={{
          headers: ["Aşama", "Toplam", "Süresinde", "Gecikmeli", "Hâlâ gecikmede", "Uyum %"],
          rows: asamalar.map((m) => [
            ASAMALAR[m.code as AsamaKodu]?.kisa ?? m.title,
            m.total, m.onTime, m.late, m.pendingLate,
            m.total > 0 ? Math.round((m.onTime / m.total) * 1000) / 10 : "—",
          ]),
        }}
      >
        <StackedBarH
          rows={asamalar.map((m) => ({
            label: ASAMALAR[m.code as AsamaKodu]?.kisa ?? m.title,
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
          caption="Her aşamanın süresinde tamamlanma oranı. Sağdaki yüzde, süresinde tamamlananın payıdır."
        />
      </Grafik>

      <Grafik baslik="SLA uyumu" aciklama="Süresinde tamamlanan aşamaların tüm aşamalara oranı. Hedef: %95 ve üzeri.">
        <Meter
          label={gm ? "Tüm fabrikalar" : (user.factory_name ?? "Fabrika")}
          rate={toplam.sla_rate}
          hint={toplam.total_tasks > 0
            ? `${toplam.total_tasks - toplam.overdue_tasks} / ${toplam.total_tasks} aşama süresinde`
            : "Bu aralıkta aşama yok"}
        />
      </Grafik>

      <p className="text-xs text-ink-500">
        Rapor {fmtDate(today())} tarihinde üretildi. SLA hesapları iş günü bazlıdır; hafta sonları
        ve Tanımlar sayfasında kayıtlı resmî tatiller düşülür.
      </p>
    </div>
  );
}
