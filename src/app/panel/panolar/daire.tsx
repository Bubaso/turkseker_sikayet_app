import Link from "next/link";
import { all } from "@/lib/db";
import { MONTH_NAMES_TR, fmtDate, slaInfo, type HolidaySet } from "@/lib/dates";
import { fmtQuantity, fmtTl } from "@/lib/format";
import { PRODUCT_GROUP_LABEL, type DeptCode, type ProductGroup } from "@/lib/domain";
import { kategoriAilesi } from "@/lib/category-labels";
import type { SessionUser } from "@/server/auth";
import { yonetimAraligi, type PerfRange } from "@/server/stats";
import {
  DAIRE_MERCEGI, daireKararOzeti, daireSayilari, daireSeyri, daireTurDagilimi,
  donemKiyasi, okunmamisYaziSayisi,
} from "@/server/yonetim";
import { Card, Chip, EmptyState, PageHeader, SlaChip, Stat, StatDelta } from "@/components/ui";
import { BarChartH, LineChart } from "@/components/charts";
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

   Ekranın merkezi kendi karar kuyruğudur; altında dairenin alanına ait üç net
   sayı, dönem göstergeleri ve grafikler durur. Üst yönetim panosuyla aynı
   ilkeler: her ölçü ya grafik ya tablo, ikisi birden değil.
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
  const seyir = daireSeyri(12, deptCode);
  const turler = daireTurDagilimi(deptCode, aralik);

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

  const seyirEtiket = seyir.map((a) => {
    const [y, m] = a.ay.split("-");
    return `${MONTH_NAMES_TR[Number(m) - 1]!.slice(0, 3)} ${y!.slice(2)}`;
  });

  const ilk10 = turler.slice(0, 10);
  const kalan = turler.slice(10).reduce((a, c) => a + c.adet, 0);
  const turCubuk = [
    ...ilk10.map((c) => ({
      label: c.ad.length > 26 ? `${c.ad.slice(0, 25)}…` : c.ad,
      value: c.adet,
      hint: `${c.ad} (${kategoriAilesi(c.aile)}): ${c.adet} şikâyet, ${c.hakli} haklı`,
    })),
    ...(kalan > 0 ? [{ label: "Diğer", value: kalan, hint: `Diğer türler: ${kalan} şikâyet` }] : []),
  ];

  const alanHref = mercek && mercek.productGroups.length === 1
    ? `/panel/sikayetler?urun=${mercek.productGroups[0]}`
    : "/panel/sikayetler";

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
        <Stat label="İşlemi devam eden" value={sayilar.acik} tone="brand"
              hint="Henüz kapanmamış dosya" href={`${alanHref}${alanHref.includes("?") ? "&" : "?"}grup=ACIK`} />
        <Stat label="Geciken" value={sayilar.geciken}
              tone={sayilar.geciken ? "danger" : "ok"}
              hint="Süresi aşılmış aşaması olan dosya"
              href={`${alanHref}${alanHref.includes("?") ? "&" : "?"}gecikme=1`} />
      </div>

      <section className="card-pad">
        <h2 className="mb-3 text-[13px] font-semibold tracking-wide text-ink-700 uppercase">
          Dönem: {fmtDate(aralik.from)} – {fmtDate(aralik.to)}
        </h2>
        <DonemSecici bas={aralik.from} bit={aralik.to} hedef="/panel" />
      </section>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatDelta label="Dönemde gelen" value={kiyas.simdi.gelen}
                   current={kiyas.simdi.gelen} previous={kiyas.onceki.gelen} iyiYon="azalis" />
        <StatDelta label="Haklı bulunan" value={kiyas.simdi.haklı}
                   current={kiyas.simdi.haklı} previous={kiyas.onceki.haklı} iyiYon="azalis" />
        <StatDelta label="Alanımın maliyeti"
                   value={fmtTl(kiyas.simdi.iadeBedeli + kiyas.simdi.nakliyeBedeli)}
                   current={kiyas.simdi.iadeBedeli + kiyas.simdi.nakliyeBedeli}
                   previous={kiyas.onceki.iadeBedeli + kiyas.onceki.nakliyeBedeli}
                   iyiYon="azalis" format={(v) => fmtTl(v)} />
        <Stat label="Ortalama karar sürem"
              value={ozet?.ortKararGunu == null ? "—" : `${ozet.ortKararGunu} iş günü`}
              tone={ozet?.ortKararGunu != null && ozet.ortKararGunu > 5 ? "warn" : "ink"}
              hint={ozet ? `${ozet.toplam} karar · ${ozet.kabul} kabul` : "Hedef: 5 iş günü"}
              href="/panel/itirazlar?gecmis=1" />
      </div>

      <Grafik
        baslik="Alanımın 12 aylık seyri"
        tablo={{
          headers: ["Ay", "Gelen", "Haklı", "Kapanan"],
          rows: seyir.map((a, i) => [seyirEtiket[i]!, a.gelen, a.hakli, a.kapanan]),
        }}
      >
        <LineChart
          labels={seyirEtiket}
          series={[
            { name: "Gelen şikâyet", values: seyir.map((a) => a.gelen), slot: 1 },
            { name: "Haklı bulunan", values: seyir.map((a) => a.hakli), slot: 2 },
            { name: "Kapanan dosya", values: seyir.map((a) => a.kapanan), slot: 3 },
          ]}
          caption="Dairenizin alanındaki aylık şikâyet, haklı bulunan ve kapanan dosya sayısı."
        />
      </Grafik>

      <Grafik
        baslik="Alanımdaki şikâyet türleri"
        tablo={{
          headers: ["Şikâyet türü", "Aile", "Adet", "Haklı bulunan"],
          rows: turler.map((c) => [c.ad, kategoriAilesi(c.aile), c.adet, c.hakli]),
        }}
      >
        <BarChartH rows={turCubuk} unit="şikâyet" labelWidth={170}
                   caption="Seçilen dönemde dairenizin alanında en çok bildirilen şikâyet türleri." />
      </Grafik>

      {mercek && mercek.productGroups.length > 0 && (
        <p className="text-xs text-ink-500">
          Alanınız: {mercek.productGroups.map((g) => PRODUCT_GROUP_LABEL[g as ProductGroup]).join(" · ")}.{" "}
          <Link href="/panel/sikayetler" className="link">
            Tüm ürün gruplarını görmek için şikâyet dosyaları
          </Link>
        </p>
      )}
    </div>
  );
}
