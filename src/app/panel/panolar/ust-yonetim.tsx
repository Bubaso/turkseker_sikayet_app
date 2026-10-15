import Link from "next/link";
import { MONTH_NAMES_TR, fmtDate } from "@/lib/dates";
import { fmtNum, fmtPct, fmtQuantity, fmtTl } from "@/lib/format";
import { PRODUCT_GROUP_LABEL, type ProductGroup } from "@/lib/domain";
import { ASAMALAR, type AsamaKodu } from "@/lib/asamalar";
import { kategoriAilesi } from "@/lib/category-labels";
import type { SessionUser } from "@/server/auth";
import {
  categoryBreakdown, dashboardStats, factoryPerformance, milestoneSla, monthlyTrend,
  productGroupBreakdown, totalRow, yonetimAraligi, type PerfRange,
} from "@/server/stats";
import { donemKiyasi } from "@/server/yonetim";
import { countComplaints } from "@/server/complaints";
import { PageHeader, Stat, StatDelta } from "@/components/ui";
import { BarChartH, LineChart, Meter, StackedBarH } from "@/components/charts";
import { Grafik } from "@/components/grafik";
import { DonemSecici } from "@/components/donem-secici";

/* ===========================================================================
   Genel Müdür Yardımcısı panosu.

   Tek ekran: üç net sayı (toplam, devam eden, geciken), dönem göstergeleri ve
   fabrika karşılaştırmasıyla performans panosunun tamamı. Her ölçü ya grafik
   ya tablo olarak görünür; başlıktaki düğme geçişi yapar.
   =========================================================================== */

export async function UstYonetimPano({
  user, q,
}: {
  user: SessionUser;
  q: { bas?: string; bit?: string };
}) {
  const varsayilan = yonetimAraligi();
  const aralik: PerfRange = { from: q.bas || varsayilan.from, to: q.bit || varsayilan.to };

  const kiyas = donemKiyasi(aralik);
  const stats = dashboardStats(null);
  const toplamDosya = countComplaints({});

  const perf = factoryPerformance(aralik).filter((f) => f.total > 0);
  const toplam = totalRow(perf);
  const trend = monthlyTrend(12, null);
  const kategoriler = categoryBreakdown(aralik);
  const gruplar = productGroupBreakdown(aralik);
  const asamalar = milestoneSla(aralik);

  const hakliOrani = toplam.justified + toplam.rejected > 0
    ? Math.round((toplam.justified / (toplam.justified + toplam.rejected)) * 1000) / 10
    : null;
  const maliyetSimdi = kiyas.simdi.iadeBedeli + kiyas.simdi.nakliyeBedeli;
  const maliyetOnceki = kiyas.onceki.iadeBedeli + kiyas.onceki.nakliyeBedeli;

  const trendEtiket = trend.map((t) => {
    const [y, m] = t.ym.split("-");
    return `${MONTH_NAMES_TR[Number(m) - 1]!.slice(0, 3)} ${y!.slice(2)}`;
  });

  // En çok şikâyet alan ilk 10 tür; kalanı "Diğer" olarak toplanır.
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

  const siraliPerf = [...perf].sort((a, b) => b.total - a.total);
  const slaSirali = [...perf].sort((a, b) => (a.sla_rate ?? 101) - (b.sla_rate ?? 101));

  return (
    <div className="space-y-5">
      <PageHeader
        title={`Merhaba, ${user.full_name.split(" ")[0]}`}
        subtitle={`${user.department_name ?? "Genel Müdürlük"} — 14 fabrikanın tüm şikâyet dosyaları`}
        actions={
          <div className="flex flex-wrap gap-2">
            <Link href={`/panel/ozet?bas=${aralik.from}&bit=${aralik.to}`}
                  className="btn btn-secondary btn-sm">Yönetim özeti</Link>
            <a href="/api/rapor/aylik" className="btn btn-secondary btn-sm">Aylık tablo (Excel)</a>
          </div>
        }
      />

      {/* 1. Üç net sayı — dönemden bağımsız, sistemin o anki hâli */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Stat label="Toplam şikâyet" value={toplamDosya}
              hint="Sistemdeki bütün dosyalar" href="/panel/sikayetler" />
        <Stat label="İşlemi devam eden" value={stats.openCount} tone="brand"
              hint="Henüz kapanmamış dosya" href="/panel/sikayetler?grup=ACIK" />
        <Stat label="Geciken" value={stats.overdueCount}
              tone={stats.overdueCount ? "danger" : "ok"}
              hint="Süresi aşılmış aşaması olan dosya" href="/panel/sikayetler?gecikme=1" />
      </div>

      {/* 2. Dönem — seçili aralığın göstergeleri, önceki dönemle kıyaslı */}
      <section className="card-pad">
        <h2 className="mb-3 text-[13px] font-semibold tracking-wide text-ink-700 uppercase">
          Dönem: {fmtDate(aralik.from)} – {fmtDate(aralik.to)}
        </h2>
        <DonemSecici bas={aralik.from} bit={aralik.to} hedef="/panel" />
      </section>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatDelta label="Dönemde gelen" value={kiyas.simdi.gelen}
                   current={kiyas.simdi.gelen} previous={kiyas.onceki.gelen} iyiYon="azalis" />
        <StatDelta label="SLA uyumu"
                   value={toplam.sla_rate == null ? "—" : fmtPct(toplam.sla_rate, 1)}
                   current={kiyas.simdi.slaOrani} previous={kiyas.onceki.slaOrani}
                   iyiYon="artis" hint="Hedef %95" />
        <StatDelta label="Ortalama kapanma"
                   value={toplam.avg_close_days == null ? "—" : toplam.avg_close_days}
                   unit="iş günü"
                   current={kiyas.simdi.ortKapanma} previous={kiyas.onceki.ortKapanma}
                   iyiYon="azalis" />
        <StatDelta label="Toplam maliyet" value={fmtTl(maliyetSimdi)}
                   current={maliyetSimdi} previous={maliyetOnceki} iyiYon="azalis"
                   hint="İade/mahsup + nakliye" format={(v) => fmtTl(v)} />
      </div>

      {/* 3. Seyir */}
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

      {/* 4. Fabrika karşılaştırma — adet grafiği, tablosunda tüm ölçüler */}
      <Grafik
        baslik="Fabrika karşılaştırma"
        tablo={{
          headers: ["Fabrika", "Toplam", "Açık", "Kapandı", "Haklı", "Haksız",
                    "SLA %", "Ort. kapanma", "İade (kg)", "Değişim (kg)", "Nakliye (₺)"],
          rows: [
            ...siraliPerf.map((p) => [
              p.factory, p.total, p.open, p.closed, p.justified, p.rejected,
              p.sla_rate ?? "—", p.avg_close_days ?? "—",
              p.returned_kg || "—", p.exchanged_kg || "—", p.freight_amount || "—",
            ]),
            ["TOPLAM", toplam.total, toplam.open, toplam.closed, toplam.justified, toplam.rejected,
             toplam.sla_rate ?? "—", toplam.avg_close_days ?? "—",
             fmtNum(toplam.returned_kg), fmtNum(toplam.exchanged_kg), fmtNum(toplam.freight_amount)],
          ],
        }}
      >
        <BarChartH
          rows={siraliPerf.map((p) => ({
            label: p.factory,
            value: p.total,
            hint: `${p.factory}: ${p.total} şikâyet · ${p.open} açık · SLA ${
              p.sla_rate == null ? "—" : `%${p.sla_rate}`}`,
          }))}
          unit="şikâyet"
          caption="Seçilen dönemde her fabrikaya düşen şikâyet dosyası sayısı."
        />
      </Grafik>

      {/* 5. SLA — ölçerler sayıyı zaten taşıdığı için ayrı tablo yok */}
      <Grafik
        baslik="Fabrikalara göre SLA uyumu"
        aciklama="Süresinde tamamlanan aşamaların tüm aşamalara oranı. Hedef: %95 ve üzeri. En zayıf fabrika başta."
      >
        {slaSirali.length === 0 ? (
          <p className="py-6 text-center text-sm text-ink-500">Seçilen dönemde veri yok.</p>
        ) : (
          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
            {slaSirali.map((p) => (
              <Link key={p.factory_id} href={`/panel/sikayetler?fabrika=${p.factory_id}`}>
                <Meter
                  label={p.factory}
                  rate={p.sla_rate}
                  hint={p.total_tasks > 0
                    ? `${p.total_tasks - p.overdue_tasks} / ${p.total_tasks} aşama süresinde · ${p.total} dosya`
                    : "Bu dönemde aşama yok"}
                />
              </Link>
            ))}
          </div>
        )}
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

      {/* 6. Aşama bazında süre uyumu */}
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

      <p className="text-xs text-ink-500">
        SLA hesapları iş günü bazlıdır; hafta sonları ve Tanımlar sayfasında kayıtlı resmî
        tatiller düşülür. Kıyas dönemi: {fmtDate(kiyas.oncekiAralik.from)} – {fmtDate(kiyas.oncekiAralik.to)}.
      </p>
    </div>
  );
}
