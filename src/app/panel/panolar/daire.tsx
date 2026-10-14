import Link from "next/link";
import { all } from "@/lib/db";
import { fmtDate, slaInfo, type HolidaySet } from "@/lib/dates";
import { fmtQuantity, fmtTl } from "@/lib/format";
import { PRODUCT_GROUP_LABEL, type DeptCode, type ProductGroup } from "@/lib/domain";
import type { SessionUser } from "@/server/auth";
import { yonetimAraligi } from "@/server/stats";
import {
  DAIRE_MERCEGI, daireKararOzeti, dikkatGerektirenler, donemKiyasi, okunmamisYaziSayisi,
} from "@/server/yonetim";
import { Card, Chip, EmptyState, PageHeader, SlaChip, Stat, StatDelta } from "@/components/ui";
import { DikkatKarti } from "./dikkat";

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

/**
 * Daire Başkanı panosu. Ekranın merkezi kendi karar kuyruğudur; kartlar
 * dairenin kendi sayılarını gösterir ve liste dairenin merceğiyle açılır.
 */
export async function DairePano({
  user, holidays,
}: {
  user: SessionUser;
  holidays: HolidaySet;
}) {
  const deptId = user.department_id;
  const deptCode = (all<{ code: string }>(
    "SELECT code FROM departments WHERE id = ?", deptId ?? -1,
  )[0]?.code ?? null) as DeptCode | null;
  const mercek = deptCode ? DAIRE_MERCEGI[deptCode] : null;

  const aralik = yonetimAraligi();
  const kiyas = donemKiyasi(aralik, deptCode);
  const ozet = deptId ? daireKararOzeti(deptId) : null;
  const okunmamis = deptId ? okunmamisYaziSayisi(deptId) : 0;
  const dikkat = dikkatGerektirenler(deptCode);

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
          <Link href="/panel/resmi-yazilar" className="btn btn-secondary btn-sm">
            Resmî yazılar{okunmamis > 0 && ` (${okunmamis})`}
          </Link>
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
                    <Link href="/panel/itirazlar" className="btn btn-primary btn-sm">
                      Değerlendir
                    </Link>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      {/* Dairenin kendi sayıları */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Kararım bekleniyor" value={ozet?.bekleyen ?? 0}
              tone={(ozet?.bekleyen ?? 0) > 0 ? "warn" : "ink"} href="/panel/itirazlar" />
        <Stat label="Karara bağladığım" value={ozet?.toplam ?? 0}
              hint={ozet ? `${ozet.kabul} kabul · ${ozet.ret} ret` : undefined}
              href="/panel/itirazlar?gecmis=1" />
        <Stat label="Ortalama karar süresi"
              value={ozet?.ortKararGunu == null ? "—" : `${ozet.ortKararGunu} iş günü`}
              hint="Hedef: 5 iş günü" />
        <Stat label="Okunmamış resmî yazı" value={okunmamis}
              tone={okunmamis ? "brand" : "ink"} href="/panel/resmi-yazilar?durum=okunmamis" />
      </div>

      {/* Dairenin merceğindeki şikâyetler */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatDelta label="Alanımdaki şikâyet" value={kiyas.simdi.gelen}
                   current={kiyas.simdi.gelen} previous={kiyas.onceki.gelen}
                   iyiYon="azalis" href={mercekHref(mercek?.productGroups ?? [])} />
        <StatDelta label="Açık dosya" value={kiyas.simdi.acik}
                   current={kiyas.simdi.acik} previous={kiyas.onceki.acik}
                   iyiYon="azalis" href={mercekHref(mercek?.productGroups ?? [], "&grup=ACIK")} />
        <StatDelta label="Haklı bulunan" value={kiyas.simdi.haklı}
                   current={kiyas.simdi.haklı} previous={kiyas.onceki.haklı} iyiYon="azalis" />
        <StatDelta label="Alanımın maliyeti"
                   value={fmtTl(kiyas.simdi.iadeBedeli + kiyas.simdi.nakliyeBedeli)}
                   current={kiyas.simdi.iadeBedeli + kiyas.simdi.nakliyeBedeli}
                   previous={kiyas.onceki.iadeBedeli + kiyas.onceki.nakliyeBedeli}
                   iyiYon="azalis" format={(v) => fmtTl(v)} />
      </div>

      {mercek && mercek.productGroups.length > 0 && (
        <p className="text-xs text-ink-500">
          Alanınız: {mercek.productGroups.map((g) => PRODUCT_GROUP_LABEL[g]).join(" · ")}.{" "}
          <Link href="/panel/sikayetler" className="link">Tüm ürün gruplarını görmek için şikâyet dosyaları</Link>
        </p>
      )}

      <DikkatKarti satirlar={dikkat} limit={6} tumuHref="/panel/dikkat" />
    </div>
  );
}

function mercekHref(gruplar: ProductGroup[], ek = ""): string {
  if (gruplar.length === 1) return `/panel/sikayetler?urun=${gruplar[0]}${ek}`;
  return `/panel/sikayetler${ek ? `?${ek.slice(1)}` : ""}`;
}
