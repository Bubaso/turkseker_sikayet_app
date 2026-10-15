import Link from "next/link";
import { all } from "@/lib/db";
import { MONTH_NAMES_TR, fmtDate, slaInfo, type HolidaySet } from "@/lib/dates";
import { fmtPct, fmtQuantity, fmtTl } from "@/lib/format";
import { PRODUCT_GROUP_LABEL, type DeptCode, type ProductGroup } from "@/lib/domain";
import { DAIRE_MERCEGI } from "@/lib/mercek";
import { ASAMALAR, type AsamaKodu } from "@/lib/asamalar";
import { kategoriAilesi } from "@/lib/category-labels";
import type { SessionUser } from "@/server/auth";
import {
  categoryBreakdown, factoryPerformance, milestoneSla, monthlyTrend,
  productGroupBreakdown, totalRow, yonetimAraligi, type PerfRange,
} from "@/server/stats";
import { daireKararOzeti, daireSayilari, donemKiyasi, okunmamisYaziSayisi } from "@/server/yonetim";
import { Card, Chip, EmptyState, PageHeader, SlaChip, Stat, StatDelta } from "@/components/ui";
import { BarChartH, LineChart, Meter, StackedBarH } from "@/components/charts";
import { Grafik } from "@/components/grafik";
import { DonemSecici } from "@/components/donem-secici";

interface BekleyenItiraz {
  id: number;
  complaint_no: string;
  customer_company: string;
  factory: string | null;
  product_name: string;
  quantity_kg: number | null;
  escalation_due_at: string | null;
  escalation_reason: string | null;
}

/* ===========================================================================
   Daire Başkanı panosu.

   Üst yönetim panosunun bütün ölçülerini taşır; farkı, hepsinin dairenin
   merceğinden süzülmesi ve en üstte kendi karar kuyruğunun durmasıdır.
   Her ölçü ya grafik ya tablo olarak görünür, ikisi birden değil.
   =========================================================================== */

export async function DairePano({
  user, holidays, q,
}: {
  user: SessionUser;
  holidays: HolidaySet;
  q: { bas?: string; bit?: string };
}) {
  const deptId = user.department_id;
  const deptCode = (all<{ code: string }>(
    "SELECT code FROM departments WHERE id = ?", deptId ?? -1,
  )[0]?.code ?? null) as DeptCode | null;
  const mercek = deptCode ? DAIRE_MERCEGI[deptCode] : null;

  const varsayilan = yonetimAraligi();
  const aralik: PerfRange = { from: q.bas || varsayilan.from, to: q.bit || varsayilan.to };

  const kiyas = donemKiyasi(aralik, deptCode);
  const sayilar = daireSayilari(deptCode);
  const ozet = deptId ? daireKararOzeti(deptId) : null;
  const okunmamis = deptId ? okunmamisYaziSayisi(deptId) : 0;

  // Üst yönetimin gördüğü ölçülerin aynısı; hepsi dairenin merceğiyle süzülür.
  const perf = factoryPerformance(aralik, null, deptCode).filter((f) => f.total > 0);
  const toplam = totalRow(perf);
  const trend = monthlyTrend(12, null, deptCode);
  const kategoriler = categoryBreakdown(aralik, null, deptCode);
  const gruplar = productGroupBreakdown(aralik, null, deptCode);
  const asamalar = milestoneSla(aralik, null, deptCode);

  const bekleyenler = deptId
    ? all<BekleyenItiraz>(
        `SELECT c.id, c.complaint_no, c.customer_company, c.product_name, c.quantity_kg,
                c.escalation_due_at, c.escalation_reason, f.short_name AS factory
           FROM complaints c LEFT JOIN factories f ON f.id = c.factory_id
          WHERE c.escalated_dept_id = ? AND c.escalated_at IS NOT NULL
            AND c.escalation_decided_at IS NULL
          ORDER BY (c.escalation_due_at IS NULL), c.escalation_due_at`,
        deptId,
      )
    : [];

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

  const siraliPerf = [...perf].sort((a, b) => b.total - a.total);
  const slaSirali = [...perf].sort((a, b) => (a.sla_rate ?? 101) - (b.sla_rate ?? 101));

  const alanHref = mercek && mercek.productGroups.length === 1
    ? `/panel/sikayetler?urun=${mercek.productGroups[0]}`
    : "/panel/sikayetler";
  const alanEk = (ek: string) => `${alanHref}${alanHref.includes("?") ? "&" : "?"}${ek}`;

  return (
    <div className="space-y-5">
      <PageHeader
        title={`Merhaba, ${user.full_name.split(" ")[0]}`}
        subtitle={
          <>
            {user.department_name ?? "Daire Başkanlığı"}
            {mercek && <> — {mercek.aciklama}</>}
          </>
        }
        actions={
          <div className="flex flex-wrap gap-2">
            <Link href="/panel/resmi-yazilar" className="btn btn-secondary btn-sm">
              Resmî yazılar{okunmamis > 0 && ` (${okunmamis})`}
            </Link>
            <Link href={`/panel/ozet?bas=${aralik.from}&bit=${aralik.to}`}
                  className="btn btn-secondary btn-sm">Yönetim özeti</Link>
            <a href="/api/rapor/aylik" className="btn btn-secondary btn-sm">Aylık tablo (Excel)</a>
          </div>
        }
      />

      {/* Ekranın merkezi: karar bekleyen itirazlar */}
      <Card
        title={
          <span className="flex items-center gap-2">
            Kararımı bekleyen itirazlar
            {bekleyenler.length > 0 && <Chip tone="warn">{bekleyenler.length}</Chip>}
          </span>
        }
        bodyClass=""
      >
        {bekleyenler.length === 0 ? (
          <EmptyState
            title="Kararınızı bekleyen itiraz yok"
            hint="Miktar eşiğini aşan ve haklı bulunmayan bir dosya dairenize gönderildiğinde burada görünür."
          />
        ) : (
          <ul className="divide-y divide-ink-100">
            {bekleyenler.map((i) => {
              const sla = slaInfo(i.escalation_due_at, null, holidays);
              return (
                <li key={i.id} className="flex flex-wrap items-start justify-between gap-3 px-4 py-3 sm:px-5">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-ink-900">
                      <span className="font-mono text-xs">{i.complaint_no}</span>
                      {" · "}{i.customer_company}
                      {i.factory && <span className="text-ink-500"> · {i.factory}</span>}
                    </p>
                    <p className="mt-0.5 text-xs text-ink-500">
                      {i.product_name}
                      {i.quantity_kg != null && ` · ${fmtQuantity(i.quantity_kg)}`}
                      {i.escalation_due_at && ` · Karar en geç ${fmtDate(i.escalation_due_at)}`}
                    </p>
                    {i.escalation_reason && (
                      <p className="mt-1 text-xs leading-relaxed text-ink-600">{i.escalation_reason}</p>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <SlaChip sla={sla} compact />
                    <Link href="/panel/itirazlar" className="btn btn-primary btn-sm">Değerlendir</Link>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      {/* Dairenin alanındaki üç net sayı */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Stat label="Alanımdaki toplam şikâyet" value={sayilar.toplam} href={alanHref} />
        <Stat label="İşlemi devam eden" value={sayilar.acik}
              hint="Henüz kapanmamış dosya" href={alanEk("grup=ACIK")} />
        <Stat label="Geciken" value={sayilar.geciken}
              tone={sayilar.geciken ? "danger" : "ok"}
              hint="Süresi aşılmış aşaması olan dosya" href={alanEk("gecikme=1")} />
      </div>

      <section className="card-pad">
        <h2 className="mb-3 text-baslik font-semibold tracking-wide text-ink-700 uppercase">
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
        <StatDelta label="Alanımın maliyeti"
                   value={fmtTl(kiyas.simdi.iadeBedeli + kiyas.simdi.nakliyeBedeli)}
                   current={kiyas.simdi.iadeBedeli + kiyas.simdi.nakliyeBedeli}
                   previous={kiyas.onceki.iadeBedeli + kiyas.onceki.nakliyeBedeli}
                   iyiYon="azalis" format={(v) => fmtTl(v)} />
      </div>

      {/* Dairenin kendi karar performansı — üst yönetimde karşılığı yok */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Kararım bekleniyor" value={ozet?.bekleyen ?? 0}
              tone={(ozet?.bekleyen ?? 0) > 0 ? "warn" : "ink"} href="/panel/itirazlar" />
        <Stat label="Karara bağladığım" value={ozet?.toplam ?? 0}
              hint={ozet ? `${ozet.kabul} kabul · ${ozet.ret} ret` : undefined}
              href="/panel/itirazlar?gecmis=1" />
        <Stat label="Ortalama karar sürem"
              value={ozet?.ortKararGunu == null ? "—" : `${ozet.ortKararGunu} iş günü`}
              tone={ozet?.ortKararGunu != null && ozet.ortKararGunu > 5 ? "warn" : "ink"}
              hint="Hedef: 5 iş günü" />
        <Stat label="Okunmamış resmî yazı" value={okunmamis}
              tone={okunmamis ? "warn" : "ink"} href="/panel/resmi-yazilar?durum=okunmamis" />
      </div>

      <Grafik
        baslik="Alanımın 12 aylık seyri"
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
          caption="Dairenizin alanındaki aylık şikâyet, haklı bulunan ve kapanan dosya sayısı."
        />
      </Grafik>

      <Grafik
        baslik="Fabrika karşılaştırma"
        aciklama="Yalnızca dairenizin alanındaki dosyalar sayılır."
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
             toplam.returned_kg, toplam.exchanged_kg, toplam.freight_amount],
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
          caption="Seçilen dönemde dairenizin alanında her fabrikaya düşen şikâyet sayısı."
        />
      </Grafik>

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
          baslik="Alanımdaki şikâyet türleri"
          tablo={{
            headers: ["Şikâyet türü", "Aile", "Adet", "Haklı bulunan"],
            rows: kategoriler.map((c) => [c.name, kategoriAilesi(c.family), c.count, c.justified]),
          }}
        >
          <BarChartH rows={kategoriCubuk} unit="şikâyet" labelWidth={170}
                     caption="Seçilen dönemde dairenizin alanında en çok bildirilen şikâyet türleri." />
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

      <p className="text-xs text-ink-500">
        {mercek && mercek.productGroups.length > 0 && (
          <>
            Alanınız: {mercek.productGroups.map((g) => PRODUCT_GROUP_LABEL[g as ProductGroup]).join(" · ")}.{" "}
            <Link href="/panel/sikayetler" className="link">
              Tüm ürün gruplarını görmek için şikâyet dosyaları
            </Link>
            {". "}
          </>
        )}
        SLA hesapları iş günü bazlıdır. Kıyas dönemi:{" "}
        {fmtDate(kiyas.oncekiAralik.from)} – {fmtDate(kiyas.oncekiAralik.to)}.
      </p>
    </div>
  );
}
