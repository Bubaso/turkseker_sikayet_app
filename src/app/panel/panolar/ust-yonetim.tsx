import Link from "next/link";
import { MONTH_NAMES_TR, fmtDate } from "@/lib/dates";
import { fmtNum, fmtPct, fmtQuantity, fmtTl } from "@/lib/format";
import { PRODUCT_GROUP_LABEL, type ProductGroup } from "@/lib/domain";
import { ASAMALAR, type AsamaKodu } from "@/lib/asamalar";
import { kategoriAilesi } from "@/lib/category-labels";
import type { SessionUser } from "@/server/auth";
import {
  categoryBreakdown, dashboardStats, factoryPerformance, milestoneSla, monthlyTrend,
  productGroupBreakdown, totalRow, tumAralik, tumAySayisi,
} from "@/server/stats";
import { countComplaints } from "@/server/complaints";
import { PageHeader, Stat } from "@/components/ui";
import { BarChartH, LineChart, StackedBarH } from "@/components/charts";
import { Grafik } from "@/components/grafik";

/* ===========================================================================
   Genel Müdür Yardımcısı panosu.

   Tek ekran: üç net sayı (toplam, devam eden, geciken), performans ölçüleri ve
   fabrika karşılaştırmasıyla panonun tamamı. Her ölçü ya grafik ya tablo
   olarak görünür; başlıktaki düğme geçişi yapar.

   Burada dönem süzgeci yoktur. Genel Müdürlük tarafı kurumun tamamına bakar:
   bütün sayılar ilk şikâyetten bugüne kayıtlı her dosyayı kapsar. Dönem
   seçtirmek, iki kişinin aynı ekrana bakıp farklı sayı okumasına yol açıyordu;
   dönem kıyası isteyen Yönetim özeti çıktısına gider.
   =========================================================================== */

export async function UstYonetimPano({ user }: { user: SessionUser }) {
  const aralik = tumAralik();

  const stats = dashboardStats(null);
  const toplamDosya = countComplaints({});

  const perf = factoryPerformance(aralik).filter((f) => f.total > 0);
  const toplam = totalRow(perf);
  const trend = monthlyTrend(tumAySayisi(), null);
  const kategoriler = categoryBreakdown(aralik);
  const gruplar = productGroupBreakdown(aralik);
  const asamalar = milestoneSla(aralik);

  const hakliOrani = toplam.justified + toplam.rejected > 0
    ? Math.round((toplam.justified / (toplam.justified + toplam.rejected)) * 1000) / 10
    : null;
  const maliyet = toplam.refund_amount + toplam.freight_amount;

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

  return (
    <div className="space-y-5">
      {/*
        Ad, unvan ve birim üst şeritte duruyor; başlık sayfanın adını söyler.
        "Yönetim özeti" düğmesi menüdeki maddenin kopyasıydı, kaldırıldı.
      */}
      <PageHeader
        title="Gösterge paneli"
        subtitle="14 fabrikanın tüm şikâyet dosyaları"
        actions={
          <a href="/api/rapor/aylik" className="btn btn-secondary btn-sm">Aylık tablo (Excel)</a>
        }
      />

      {/* 1. Üç net sayı — sistemin o anki hâli */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Stat label="Toplam şikâyet" value={toplamDosya}
              hint="Sistemdeki bütün dosyalar" href="/panel/sikayetler" />
        <Stat label="İşlemi devam eden" value={stats.openCount}
              hint="Henüz kapanmamış dosya" href="/panel/sikayetler?grup=ACIK" />
        <Stat label="Geciken" value={stats.overdueCount}
              tone={stats.overdueCount ? "danger" : "ok"}
              hint="Süresi aşılmış aşaması olan dosya" href="/panel/sikayetler?gecikme=1" />
      </div>

      {/* 2. Performans ölçüleri — kayıtlı bütün dosyalar üzerinden */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Haklı bulunan" value={toplam.justified}
              hint={hakliOrani == null
                ? "Karara bağlanmış dosya yok"
                : `Karara bağlanan dosyaların ${fmtPct(hakliOrani, 1)}'i`}
              href="/panel/sikayetler?karar=HAKLI" />
        <Stat label="SLA uyumu"
              value={toplam.sla_rate == null ? "—" : fmtPct(toplam.sla_rate, 1)}
              tone={toplam.sla_rate != null && toplam.sla_rate < 95 ? "warn" : "ok"}
              hint="Süresinde tamamlanan aşamalar · hedef %95" />
        <Stat label="Ortalama kapanma"
              value={toplam.avg_close_days == null ? "—" : `${toplam.avg_close_days} iş günü`}
              hint="Şikâyet kaydından dosya kapanışına" />
        <Stat label="Toplam maliyet" value={fmtTl(maliyet)}
              hint="İade/mahsup + nakliye bedeli" />
      </div>

      {/* 3. Seyir */}
      <Grafik
        baslik="Aylara göre seyir"
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

      {/*
        4. Fabrika karşılaştırma — adet grafiği, tablosunda tüm ölçüler.

        SLA uyumu buraya katıldı: her çubuğun sağında fabrikanın yüzdesi,
        hedefe göre renklenmiş olarak duruyor. Altında aynı 14 fabrikayı
        ölçer ölçer yeniden listeleyen ayrı bir kutu vardı; iki kutu
        masaüstünde 1068, mobilde 1516 piksel tutuyordu.
      */}
      <Grafik
        baslik="Fabrika karşılaştırma"
        aciklama="Sağdaki yüzde SLA uyumudur; hedef %95. Yeşil hedefte, sarı dikkat, kırmızı hedef altı."
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
            sag: p.sla_rate == null ? "—" : `SLA %${p.sla_rate}`,
            bant: p.sla_rate == null ? undefined
                  : p.sla_rate >= 95 ? "iyi" : p.sla_rate >= 85 ? "dikkat" : "kotu",
            hint: `${p.factory}: ${p.total} şikâyet · ${p.open} açık · SLA ${
              p.sla_rate == null ? "—" : `%${p.sla_rate}`}`,
          }))}
          unit="şikâyet"
          caption="Her fabrikaya düşen toplam şikâyet dosyası sayısı ve SLA uyumu."
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

      {/* 6. Aşama bazında süre uyumu */}
      <Grafik
        baslik="Aşama bazında süre uyumu"
        aciklama="Sağdaki yüzde, süresinde tamamlananın payıdır."
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
        Bu ekrandaki bütün sayılar kayıtlı dosyaların tamamını kapsar: ilk şikâyet
        ({fmtDate(aralik.from)}) ile bugün arası, dönem süzgeci uygulanmadan. SLA hesapları
        iş günü bazlıdır; hafta sonları ve Tanımlar sayfasında kayıtlı resmî tatiller düşülür.
        Dönem kıyası isteyen Yönetim özeti çıktısına bakabilir.
      </p>
    </div>
  );
}
