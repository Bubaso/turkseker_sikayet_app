import { redirect } from "next/navigation";
import { one } from "@/lib/db";
import { isGmRole } from "@/lib/roles";
import type { DeptCode } from "@/lib/domain";
import { requirePageUser } from "@/server/auth";
import { DIKKAT_BASLIK, dikkatGerektirenler, type DikkatTuru } from "@/server/yonetim";
import { Notice, PageHeader } from "@/components/ui";
import { DikkatKarti } from "../panolar/dikkat";

export const dynamic = "force-dynamic";

const ACIKLAMA: Record<DikkatTuru, string> = {
  SLA_ASILDI: "Açık dosyada bir görevin son tarihi geçmiş.",
  KRITIK_ACIK: "Gıda güvenliği kategorisindeki dosya hâlâ açık.",
  ITIRAZ_SURESI: "Daire Başkanlığının 5 iş günlük karar süresi dolmak üzere.",
  UZUN_SUREDIR_ACIK: "Dosya 10 iş gününden uzun süredir kapanmamış.",
  TEKRAR_EDEN_URUN: "Aynı fabrika, ürün ve şikâyet türü son 30 günde 3 kez ve üzeri bildirilmiş.",
  TEKRAR_EDEN_MUSTERI: "Aynı müşteri son 90 günde 3 ve üzeri şikâyet açmış.",
};

/** Üst yönetimin istisna listesi — tekil dosya ve örüntü uyarıları bir arada. */
export default async function DikkatPage() {
  const user = await requirePageUser();
  if (!isGmRole(user.role) && user.role !== "SISTEM_YONETICISI") redirect("/panel?hata=yetki");

  const deptCode = user.department_id
    ? ((one<{ code: string }>("SELECT code FROM departments WHERE id = ?", user.department_id)?.code
        ?? null) as DeptCode | null)
    : null;
  const satirlar = dikkatGerektirenler(deptCode);
  const turler = [...new Set(satirlar.map((s) => s.tur))];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Dikkat gerektirenler"
        subtitle={`${satirlar.length} uyarı · ${turler.length} farklı türde`}
      />

      <Notice tone="info" title="Bu liste nasıl oluşur?">
        <ul className="mt-1 space-y-0.5">
          {(Object.keys(ACIKLAMA) as DikkatTuru[]).map((t) => (
            <li key={t}>
              <span className="font-medium">{DIKKAT_BASLIK[t]}:</span> {ACIKLAMA[t]}
            </li>
          ))}
        </ul>
      </Notice>

      <DikkatKarti satirlar={satirlar} />
    </div>
  );
}
