import type { Metadata } from "next";
import Link from "next/link";
import { all } from "@/lib/db";
import { KATEGORI_AILE_ETIKET } from "@/lib/category-labels";
import { PublicShell } from "@/components/public-shell";
import { Notice } from "@/components/ui";
import { ACCEPT_ATTR } from "@/server/attachments";
import { getSetting, getSettingBool, getSettingNum } from "@/server/settings";
import ComplaintForm, { type FormRefs } from "./form";

export const metadata: Metadata = { title: "Şikâyet formu" };
export const dynamic = "force-dynamic";

export default function NewComplaintPage() {
  const open = getSettingBool("halka_acik_form_aktif", true);

  const refs: FormRefs = {
    factories: all("SELECT id, name, province FROM factories WHERE is_active = 1 ORDER BY name"),
    products: all(
      "SELECT id, name, product_group, packaging FROM products WHERE is_active = 1 ORDER BY sort_order",
    ),
    categories: all(
      "SELECT id, name, family FROM complaint_categories WHERE is_active = 1 ORDER BY sort_order",
    ),
    provinces: all("SELECT code, name FROM provinces ORDER BY name"),
    familyLabels: KATEGORI_AILE_ETIKET,
    kvkkText: getSetting("kvkk_metni", ""),
    otpRequired: getSettingBool("otp_zorunlu", true),
    maxFiles: getSettingNum("ek_dosya_max_adet", 8),
    maxMb: getSettingNum("ek_dosya_max_mb", 10),
    accept: ACCEPT_ATTR,
  };

  return (
    <PublicShell>
      <div className="mb-5">
        <h1 className="text-xl font-semibold tracking-tight text-ink-900">Müşteri Şikâyet Formu</h1>
        <p className="mt-0.5 text-sm text-ink-600">
          Yıldızlı (<span className="text-danger-600">*</span>) alanlar zorunludur. Formu 4 adımda
          tamamlayacaksınız.
        </p>
      </div>

      {!open ? (
        <Notice tone="warn" title="Çevrim içi form şu anda kapalı">
          Şikâyetinizi iletmek için ürünü aldığınız şeker fabrikamızla telefonla iletişime
          geçebilirsiniz. <Link href="/" className="link">Ana sayfaya dön</Link>
        </Notice>
      ) : refs.factories.length === 0 ? (
        <Notice tone="warn" title="Referans verisi yüklenmemiş">
          Fabrika ve ürün tanımları yüklenmemiş. Kurulum için{" "}
          <code className="rounded bg-white px-1 py-0.5 text-xs">npm run db:seed</code> komutunu
          çalıştırın.
        </Notice>
      ) : (
        <ComplaintForm refs={refs} />
      )}
    </PublicShell>
  );
}
