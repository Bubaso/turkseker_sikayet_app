import { isGmRole, ROLES } from "@/lib/roles";
import { requirePageUser } from "@/server/auth";
import { holidaySet } from "@/server/settings";
import { FabrikaPano } from "./panolar/fabrika";
import { UstYonetimPano } from "./panolar/ust-yonetim";
import { DairePano } from "./panolar/daire";

export const dynamic = "force-dynamic";

/*
 * Gösterge paneli role göre üç ayrı pano gösterir. Bir fabrika personeli günlük
 * işini, Genel Müdür Yardımcısı 14 fabrikanın kıyasını ve riskini, Daire
 * Başkanı kendi karar kuyruğunu ve alanını görür. Üçü aynı ekranı paylaşmaz;
 * bekledikleri bilgi aynı değildir.
 */
export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ bas?: string; bit?: string }>;
}) {
  const user = await requirePageUser();
  const q = await searchParams;

  if (user.role === ROLES.GM_DAIRE && user.department_id) {
    return <DairePano user={user} holidays={holidaySet()} q={q} />;
  }
  if (isGmRole(user.role) || user.role === ROLES.SISTEM_YONETICISI) {
    return <UstYonetimPano user={user} q={q} />;
  }
  return <FabrikaPano user={user} />;
}
