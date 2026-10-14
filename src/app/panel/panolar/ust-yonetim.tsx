import Link from "next/link";
import { fmtDate } from "@/lib/dates";
import { fmtQuantity, fmtTl } from "@/lib/format";
import type { SessionUser } from "@/server/auth";
import { dashboardStats, yonetimAraligi, factoryPerformance } from "@/server/stats";
import { dikkatGerektirenler, donemKiyasi } from "@/server/yonetim";
import { listComplaints } from "@/server/complaints";
import { Card, Chip, PageHeader, Stat, StatDelta } from "@/components/ui";
import { bandOf, bandTone } from "@/components/charts";
import { DikkatKarti } from "./dikkat";

/**
 * Genel Müdür Yardımcısı panosu. Görev kartı yoktur; kıyas, risk ve maliyet
 * vardır. Her sayı kendisini üreten listeye bağlanır.
 */
export async function UstYonetimPano({ user }: { user: SessionUser }) {
  const aralik = yonetimAraligi();
  const kiyas = donemKiyasi(aralik);
  const stats = dashboardStats(null);
  const dikkat = dikkatGerektirenler();
  const fabrikalar = factoryPerformance(aralik)
    .filter((f) => f.total > 0)
    .sort((a, b) => (a.sla_rate ?? 101) - (b.sla_rate ?? 101));
  const hedefAlti = fabrikalar.filter((f) => f.sla_rate != null && f.sla_rate < 95).length;
  const enKotu = fabrikalar.slice(0, 5);
  const sonGelenler = listComplaints({ limit: 5, orderBy: "received_desc" });

  const maliyetSimdi = kiyas.simdi.iadeBedeli + kiyas.simdi.nakliyeBedeli;
  const maliyetOnceki = kiyas.onceki.iadeBedeli + kiyas.onceki.nakliyeBedeli;

  return (
    <div className="space-y-5">
      <PageHeader
        title={`Merhaba, ${user.full_name.split(" ")[0]}`}
        subtitle={`${user.department_name ?? "Genel Müdürlük"} — 14 fabrika · ${fmtDate(aralik.from)} – ${fmtDate(aralik.to)}`}
        actions={
          <div className="flex flex-wrap gap-2">
            <Link href="/panel/ozet" className="btn btn-secondary btn-sm">Yönetim özeti</Link>
            <Link href="/panel/fabrikalar" className="btn btn-primary btn-sm">Fabrika karşılaştırma</Link>
          </div>
        }
      />

      {/* Dönem göstergeleri — hepsi önceki dönemle kıyaslı */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StatDelta label="Gelen şikâyet" value={kiyas.simdi.gelen}
                   current={kiyas.simdi.gelen} previous={kiyas.onceki.gelen}
                   iyiYon="azalis" href="/panel/sikayetler" />
        <StatDelta label="SLA uyumu"
                   value={kiyas.simdi.slaOrani == null ? "—" : `%${kiyas.simdi.slaOrani}`}
                   current={kiyas.simdi.slaOrani} previous={kiyas.onceki.slaOrani}
                   iyiYon="artis" hint="Hedef %95" href="/panel/fabrikalar" />
        <StatDelta label="Ortalama kapanma"
                   value={kiyas.simdi.ortKapanma == null ? "—" : kiyas.simdi.ortKapanma}
                   unit="iş günü"
                   current={kiyas.simdi.ortKapanma} previous={kiyas.onceki.ortKapanma}
                   iyiYon="azalis" href="/panel/raporlar" />
        <StatDelta label="Toplam maliyet" value={fmtTl(maliyetSimdi)}
                   current={maliyetSimdi} previous={maliyetOnceki}
                   iyiYon="azalis" hint="İade/mahsup + nakliye"
                   format={(v) => fmtTl(v)} href="/panel/fabrikalar?olcut=maliyet" />
        <Stat label="Hedef altı fabrika" value={hedefAlti}
              tone={hedefAlti ? "danger" : "ok"} hint={`${fabrikalar.length} fabrikadan`}
              href="/panel/fabrikalar" />
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Açık dosya" value={stats.openCount} href="/panel/sikayetler" />
        <Stat label="Geciken dosya" value={stats.overdueCount}
              tone={stats.overdueCount ? "danger" : "ink"} href="/panel/sikayetler?gecikme=1" />
        <Stat label="İtiraz değerlendirmede" value={stats.inEscalation}
              tone={stats.inEscalation ? "warn" : "ink"} href="/panel/itirazlar" />
        <Stat label="Gıda güvenliği ihbarı" value={stats.criticalOpen}
              tone={stats.criticalOpen ? "danger" : "ink"} hint="Açık kritik dosya"
              href="/panel/dikkat" />
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-5">
        <div className="xl:col-span-3">
          <DikkatKarti satirlar={dikkat} limit={7} tumuHref="/panel/dikkat" />
        </div>

        <Card
          title="SLA'da en zayıf fabrikalar"
          className="xl:col-span-2"
          actions={<Link href="/panel/fabrikalar" className="btn btn-ghost btn-sm">Tümü →</Link>}
          bodyClass=""
        >
          <ul className="divide-y divide-ink-100">
            {enKotu.map((f) => {
              const band = bandOf(f.sla_rate);
              return (
                <li key={f.factory_id} className="px-4 py-2.5">
                  <Link href={`/panel/sikayetler?fabrika=${f.factory_id}`}
                        className="flex items-center justify-between gap-3">
                    <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink-800">
                      {f.factory}
                    </span>
                    <span className="text-xs text-ink-500">{f.open} açık</span>
                    <Chip tone={bandTone(band)}>
                      {f.sla_rate == null ? "—" : `%${f.sla_rate}`}
                    </Chip>
                  </Link>
                </li>
              );
            })}
            {enKotu.length === 0 && (
              <li className="px-4 py-6 text-center text-sm text-ink-500">
                Seçilen dönemde veri yok.
              </li>
            )}
          </ul>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Card title="Dönemin özeti" bodyClass="p-4 sm:p-5">
          <dl className="grid grid-cols-2 gap-x-5 gap-y-3 text-sm">
            <div>
              <dt className="text-xs tracking-wide text-ink-500 uppercase">Kapanan dosya</dt>
              <dd className="tnum mt-0.5 font-semibold text-ink-900">{kiyas.simdi.kapanan}</dd>
            </div>
            <div>
              <dt className="text-xs tracking-wide text-ink-500 uppercase">Haklı bulunan</dt>
              <dd className="tnum mt-0.5 font-semibold text-ink-900">
                {kiyas.simdi.haklı}
                {kiyas.simdi.gelen > 0 &&
                  <span className="ml-1 text-xs font-normal text-ink-500">
                    (%{Math.round((kiyas.simdi.haklı / kiyas.simdi.gelen) * 100)})
                  </span>}
              </dd>
            </div>
            <div>
              <dt className="text-xs tracking-wide text-ink-500 uppercase">İade/mahsup bedeli</dt>
              <dd className="tnum mt-0.5 font-semibold text-ink-900">{fmtTl(kiyas.simdi.iadeBedeli)}</dd>
            </div>
            <div>
              <dt className="text-xs tracking-wide text-ink-500 uppercase">Nakliye bedeli</dt>
              <dd className="tnum mt-0.5 font-semibold text-ink-900">{fmtTl(kiyas.simdi.nakliyeBedeli)}</dd>
            </div>
            <div className="col-span-2">
              <dt className="text-xs tracking-wide text-ink-500 uppercase">Şikâyete konu miktar</dt>
              <dd className="tnum mt-0.5 font-semibold text-ink-900">
                {fmtQuantity(kiyas.simdi.etkilenenKg)}
              </dd>
            </div>
          </dl>
          <p className="hint mt-3">
            Kıyas dönemi: {fmtDate(kiyas.oncekiAralik.from)} – {fmtDate(kiyas.oncekiAralik.to)}
          </p>
        </Card>

        <Card title="Son gelen şikâyetler"
              actions={<Link href="/panel/sikayetler" className="btn btn-ghost btn-sm">Tümü →</Link>}
              bodyClass="">
          <ul className="divide-y divide-ink-100">
            {sonGelenler.map((c) => (
              <li key={c.id} className="px-4 py-2.5">
                <Link href={`/panel/sikayet/${c.id}`} className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-ink-800">
                      <span className="font-mono text-xs">{c.complaint_no}</span> · {c.customer_company}
                    </p>
                    <p className="truncate text-xs text-ink-500">
                      {c.factory_short} · {c.subject}
                    </p>
                  </div>
                  <span className="shrink-0 text-xs text-ink-500">{fmtDate(c.received_at)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}
