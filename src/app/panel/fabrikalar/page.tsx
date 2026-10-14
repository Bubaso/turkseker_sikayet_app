import Link from "next/link";
import { redirect } from "next/navigation";
import { one } from "@/lib/db";
import { fmtDate } from "@/lib/dates";
import { fmtQuantity, fmtTl } from "@/lib/format";
import { isGmRole } from "@/lib/roles";
import type { DeptCode } from "@/lib/domain";
import { requirePageUser } from "@/server/auth";
import { yonetimAraligi, factoryPerformance, totalRow, type PerfRange } from "@/server/stats";
import { donemKiyasi, maliyetSeyri, oncekiAralik } from "@/server/yonetim";
import { BarChartH, Meter, StackedBarH, TableView } from "@/components/charts";
import { Card, Chip, PageHeader, StatDelta } from "@/components/ui";
import { DonemSecici } from "@/components/donem-secici";

export const dynamic = "force-dynamic";

type Olcut = "sla" | "adet" | "maliyet" | "sure";

const OLCUT_ETIKET: Record<Olcut, string> = {
  sla: "SLA uyumu",
  adet: "Şikâyet adedi",
  maliyet: "Toplam maliyet",
  sure: "Ortalama kapanma",
};

/**
 * Fabrika karşılaştırma. Üst yönetimin "hangi fabrika kötü?" sorusunun
 * ekranıdır: tek ölçüte göre sıralama, önceki dönemle kıyas ve maliyet seyri.
 */
export default async function FabrikalarPage({
  searchParams,
}: {
  searchParams: Promise<{ bas?: string; bit?: string; olcut?: string }>;
}) {
  const q = await searchParams;
  const user = await requirePageUser();
  if (!isGmRole(user.role) && user.role !== "SISTEM_YONETICISI") redirect("/panel?hata=yetki");

  const varsayilan = yonetimAraligi();
  const aralik: PerfRange = { from: q.bas || varsayilan.from, to: q.bit || varsayilan.to };
  const olcut = (["sla", "adet", "maliyet", "sure"].includes(q.olcut ?? "")
    ? q.olcut : "sla") as Olcut;

  const deptCode = user.department_id
    ? ((one<{ code: string }>("SELECT code FROM departments WHERE id = ?", user.department_id)?.code
        ?? null) as DeptCode | null)
    : null;

  const satirlar = factoryPerformance(aralik).filter((f) => f.total > 0);
  const toplam = totalRow(satirlar);
  const kiyas = donemKiyasi(aralik, deptCode);
  const onceki = oncekiAralik(aralik);
  const maliyet = maliyetSeyri(12, deptCode);

  const maliyetiOf = (f: (typeof satirlar)[number]) => f.refund_amount + f.freight_amount;
  const sirali = [...satirlar].sort((a, b) => {
    switch (olcut) {
      case "adet": return b.total - a.total;
      case "maliyet": return maliyetiOf(b) - maliyetiOf(a);
      case "sure": return (b.avg_close_days ?? -1) - (a.avg_close_days ?? -1);
      default: return (a.sla_rate ?? 101) - (b.sla_rate ?? 101);
    }
  });

  const grafikSatirlari = sirali.map((f) => ({
    label: f.factory,
    value: olcut === "adet" ? f.total
      : olcut === "maliyet" ? maliyetiOf(f)
      : olcut === "sure" ? (f.avg_close_days ?? 0)
      : (f.sla_rate ?? 0),
    hint: `${f.total} dosya · ${f.open} açık`,
  }));

  const maliyetSimdi = kiyas.simdi.iadeBedeli + kiyas.simdi.nakliyeBedeli;
  const maliyetOnceki = kiyas.onceki.iadeBedeli + kiyas.onceki.nakliyeBedeli;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Fabrika karşılaştırma"
        subtitle={`${fmtDate(aralik.from)} – ${fmtDate(aralik.to)} · ${satirlar.length} fabrika · kıyas dönemi ${fmtDate(onceki.from)} – ${fmtDate(onceki.to)}`}
        actions={<Link href="/panel/ozet" className="btn btn-secondary btn-sm">Yönetim özeti</Link>}
      />

      <Card title="Dönem" bodyClass="p-4 sm:p-5">
        <DonemSecici bas={aralik.from} bit={aralik.to} hedef="/panel/fabrikalar"
                     ekAlanlar={{ olcut }} />
      </Card>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatDelta label="Gelen şikâyet" value={kiyas.simdi.gelen}
                   current={kiyas.simdi.gelen} previous={kiyas.onceki.gelen} iyiYon="azalis" />
        <StatDelta label="SLA uyumu"
                   value={kiyas.simdi.slaOrani == null ? "—" : `%${kiyas.simdi.slaOrani}`}
                   current={kiyas.simdi.slaOrani} previous={kiyas.onceki.slaOrani} iyiYon="artis" />
        <StatDelta label="Ortalama kapanma"
                   value={kiyas.simdi.ortKapanma == null ? "—" : kiyas.simdi.ortKapanma}
                   unit="iş günü"
                   current={kiyas.simdi.ortKapanma} previous={kiyas.onceki.ortKapanma} iyiYon="azalis" />
        <StatDelta label="Toplam maliyet" value={fmtTl(maliyetSimdi)}
                   current={maliyetSimdi} previous={maliyetOnceki} iyiYon="azalis"
                   format={(v) => fmtTl(v)} />
      </div>

      <Card
        title={`Sıralama — ${OLCUT_ETIKET[olcut]}`}
        actions={
          <div className="flex flex-wrap gap-1.5">
            {(Object.keys(OLCUT_ETIKET) as Olcut[]).map((o) => (
              <Link key={o}
                    href={`/panel/fabrikalar?bas=${aralik.from}&bit=${aralik.to}&olcut=${o}`}
                    className={`btn btn-sm ${o === olcut ? "btn-primary" : "btn-secondary"}`}>
                {OLCUT_ETIKET[o]}
              </Link>
            ))}
          </div>
        }
        bodyClass="p-4 sm:p-5"
      >
        <BarChartH
          rows={grafikSatirlari}
          unit={olcut === "sla" ? "%" : olcut === "maliyet" ? "₺" : olcut === "sure" ? "gün" : ""}
          caption={`Seçilen dönemde fabrika bazında ${OLCUT_ETIKET[olcut].toLowerCase()}.`}
        />
        <TableView
          headers={["Fabrika", OLCUT_ETIKET[olcut]]}
          rows={grafikSatirlari.map((r) => [r.label, r.value])}
        />
      </Card>

      <Card title="SLA uyumu — fabrika bazında" bodyClass="p-4 sm:p-5">
        <div className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
          {sirali.map((f) => (
            <Link key={f.factory_id} href={`/panel/sikayetler?fabrika=${f.factory_id}`}
                  className="block rounded-[5px] px-1 py-0.5 hover:bg-brand-50/50">
              <Meter label={f.factory} rate={f.sla_rate}
                     hint={`${f.total_tasks - f.overdue_tasks} / ${f.total_tasks} görev süresinde · ${f.total} dosya`} />
            </Link>
          ))}
        </div>
      </Card>

      <Card title="Haklılık oranı — ortalamadan sapanlar" bodyClass="p-4 sm:p-5">
        <HaklilikKiyasi rows={sirali} />
      </Card>

      <Card title="Maliyetin 12 aylık seyri" bodyClass="p-4 sm:p-5">
        <StackedBarH
          rows={maliyet.map((m) => ({
            label: m.ay,
            segments: [
              { name: "İade / mahsup bedeli", slot: 1 as const, value: m.iade },
              { name: "Nakliye bedeli", slot: 2 as const, value: m.nakliye },
            ],
          }))}
          legend={[
            { name: "İade / mahsup bedeli", slot: 1 },
            { name: "Nakliye bedeli", slot: 2 },
          ]}
          caption="Kapanan dosyaların ay bazında toplam bedeli (₺). Şikâyet adedi düşerken maliyet artabilir; ikisi ayrı ölçülür."
          labelWidth={64}
        />
        <TableView
          headers={["Ay", "İade / mahsup", "Nakliye", "Toplam"]}
          rows={maliyet.map((m) => [m.ay, fmtTl(m.iade), fmtTl(m.nakliye), fmtTl(m.iade + m.nakliye)])}
        />
      </Card>

      <Card title="Karşılaştırma tablosu" bodyClass="">
        <div className="table-wrap">
          <table className="tbl">
            <thead>
              <tr>
                <th>Fabrika</th><th>Toplam</th><th>Açık</th><th>Kapanan</th>
                <th>Haklı</th><th>SLA</th><th>Ort. kapanma</th>
                <th>İade (kg)</th><th>Maliyet (₺)</th>
              </tr>
            </thead>
            <tbody>
              {sirali.map((f) => (
                <tr key={f.factory_id}>
                  <td className="font-medium">
                    <Link href={`/panel/sikayetler?fabrika=${f.factory_id}`} className="link">
                      {f.factory}
                    </Link>
                  </td>
                  <td className="tnum">{f.total}</td>
                  <td className="tnum">{f.open}</td>
                  <td className="tnum">{f.closed}</td>
                  <td className="tnum">{f.justified}</td>
                  <td className="tnum">
                    {f.sla_rate == null ? "—" : (
                      <Chip tone={f.sla_rate >= 95 ? "ok" : f.sla_rate >= 85 ? "warn" : "danger"}>
                        %{f.sla_rate}
                      </Chip>
                    )}
                  </td>
                  <td className="tnum">{f.avg_close_days ?? "—"}</td>
                  <td className="tnum">{fmtQuantity(f.returned_kg)}</td>
                  <td className="tnum">{fmtTl(maliyetiOf(f))}</td>
                </tr>
              ))}
              <tr className="font-semibold">
                <td>TOPLAM</td>
                <td className="tnum">{toplam.total}</td>
                <td className="tnum">{toplam.open}</td>
                <td className="tnum">{toplam.closed}</td>
                <td className="tnum">{toplam.justified}</td>
                <td className="tnum">{toplam.sla_rate == null ? "—" : `%${toplam.sla_rate}`}</td>
                <td className="tnum">{toplam.avg_close_days ?? "—"}</td>
                <td className="tnum">{fmtQuantity(toplam.returned_kg)}</td>
                <td className="tnum">{fmtTl(maliyetiOf(toplam))}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

/**
 * Haklılık oranının ortalamadan sapması. Çok düşük oran ya ürünün iyi
 * olduğunu ya da değerlendirmenin sıkı olduğunu gösterir; ikisi de yönetimin
 * bilmesi gereken şeydir.
 */
function HaklilikKiyasi({
  rows,
}: {
  rows: { factory_id: number; factory: string; total: number; justified: number; rejected: number }[];
}) {
  const kararli = rows.filter((r) => r.justified + r.rejected > 0);
  if (kararli.length === 0) {
    return <p className="text-sm text-ink-500">Seçilen dönemde karara bağlanmış dosya yok.</p>;
  }
  const oranlar = kararli.map((r) => ({
    ...r,
    oran: Math.round((r.justified / (r.justified + r.rejected)) * 1000) / 10,
  }));
  const ortalama =
    Math.round((oranlar.reduce((a, b) => a + b.oran, 0) / oranlar.length) * 10) / 10;

  return (
    <>
      <p className="mb-3 text-sm text-ink-600">
        Kurum ortalaması <strong className="font-semibold">%{ortalama}</strong>.
        10 puandan fazla sapan fabrikalar işaretlidir.
      </p>
      <ul className="grid grid-cols-1 gap-x-6 gap-y-1.5 sm:grid-cols-2">
        {oranlar.sort((a, b) => b.oran - a.oran).map((r) => {
          const sapma = Math.round((r.oran - ortalama) * 10) / 10;
          const belirgin = Math.abs(sapma) > 10;
          return (
            <li key={r.factory_id} className="flex items-center justify-between gap-2 text-sm">
              <Link href={`/panel/sikayetler?fabrika=${r.factory_id}&karar=HAKLI`} className="link truncate">
                {r.factory}
              </Link>
              <span className="flex shrink-0 items-center gap-2">
                <span className="tnum text-ink-700">%{r.oran}</span>
                {belirgin && (
                  <Chip tone={sapma > 0 ? "warn" : "brand"}>
                    {sapma > 0 ? "+" : ""}{sapma} puan
                  </Chip>
                )}
              </span>
            </li>
          );
        })}
      </ul>
    </>
  );
}
