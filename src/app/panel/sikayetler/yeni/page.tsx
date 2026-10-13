import { redirect } from "next/navigation";
import { all } from "@/lib/db";
import { PERMISSIONS, can, isGmRole } from "@/lib/roles";
import { today } from "@/lib/dates";
import { KATEGORI_AILE_ETIKET } from "@/lib/category-labels";
import {requirePageUser} from "@/server/auth";
import { ACCEPT_ATTR } from "@/server/attachments";
import { PageHeader } from "@/components/ui";
import StaffComplaintForm, { type StaffFormRefs } from "./form";

export const dynamic = "force-dynamic";

export default async function StaffNewComplaintPage() {
  const user = await requirePageUser();
  if (isGmRole(user.role) || !user.factory_id || !can(user.role, PERMISSIONS.SIKAYET_KAYDET)) {
    redirect("/panel/sikayetler");
  }

  const refs: StaffFormRefs = {
    factories: all("SELECT id, name FROM factories WHERE is_active = 1 ORDER BY name"),
    products: all(
      "SELECT id, name, product_group, packaging FROM products WHERE is_active = 1 ORDER BY sort_order",
    ),
    categories: all(
      "SELECT id, name, family FROM complaint_categories WHERE is_active = 1 ORDER BY sort_order",
    ),
    provinces: all("SELECT code, name FROM provinces ORDER BY name"),
    familyLabels: KATEGORI_AILE_ETIKET,
    ownFactoryId: user.factory_id,
    today: today(),
    accept: ACCEPT_ATTR,
  };

  return (
    <div className="space-y-5">
      <PageHeader
        breadcrumb={[
          { href: "/panel", label: "Panel" },
          { href: "/panel/sikayetler", label: "Şikâyet dosyaları" },
        ]}
        title="Elden / telefonla gelen şikâyet kaydı"
        subtitle={`${user.factory_name} — kaydı açan: ${user.full_name} (${user.title})`}
      />
      <StaffComplaintForm refs={refs} />
    </div>
  );
}
