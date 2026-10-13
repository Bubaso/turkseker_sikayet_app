"use server";

/* Halka açık şikâyet formunun sunucu eylemleri. */

import { headers } from "next/headers";
import { all } from "@/lib/db";
import { DEMAND, PRODUCT_GROUP } from "@/lib/domain";
import { isValidEmail, isValidPhone } from "@/lib/format";
import { createComplaint } from "@/server/complaints";
import { storeFile } from "@/server/attachments";
import { checkRateLimit, recordRateUse, requestOtp, verifyOtp } from "@/server/otp";
import { getSettingBool, getSettingNum } from "@/server/settings";

async function clientIp(): Promise<string | null> {
  const h = await headers();
  const fwd = h.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim();
  return h.get("x-real-ip");
}

/* --- Doğrulama kodu ------------------------------------------------------ */

export interface OtpState {
  sent: boolean;
  error?: string;
  demoCode?: string;
  minutes?: number;
}

export async function sendOtpAction(phone: string): Promise<OtpState> {
  const ip = await clientIp();
  const limit = checkRateLimit("otp", ip);
  if (!limit.ok) return { sent: false, error: limit.error };

  const res = await requestOtp(phone, ip);
  recordRateUse("otp", ip);
  return res.ok
    ? { sent: true, demoCode: res.demoCode, minutes: res.expiresInMinutes }
    : { sent: false, error: res.error };
}

/* --- Şikâyet kaydı ------------------------------------------------------- */

export interface SubmitState {
  ok: boolean;
  error?: string;
  /** Alan adı -> hata metni */
  fieldErrors?: Record<string, string>;
  complaintNo?: string;
  trackingToken?: string;
  factoryName?: string;
}

function str(fd: FormData, k: string): string {
  return String(fd.get(k) ?? "").trim();
}
function num(fd: FormData, k: string): number | null {
  const raw = str(fd, k).replace(/\./g, "").replace(",", ".");
  if (!raw) return null;
  const v = Number(raw);
  return Number.isFinite(v) ? v : null;
}

export async function submitComplaintAction(fd: FormData): Promise<SubmitState> {
  if (!getSettingBool("halka_acik_form_aktif", true)) {
    return { ok: false, error: "Çevrim içi şikâyet formu şu anda kapalıdır. Lütfen ilgili fabrikamızla iletişime geçiniz." };
  }

  const ip = await clientIp();
  const limit = checkRateLimit("sikayet", ip);
  if (!limit.ok) return { ok: false, error: limit.error };

  const fieldErrors: Record<string, string> = {};

  const customerCompany = str(fd, "customer_company");
  const customerPhone = str(fd, "customer_phone");
  const customerEmail = str(fd, "customer_email");
  const province = str(fd, "customer_province");
  const originFactoryId = Number(str(fd, "origin_factory_id"));
  const productId = str(fd, "product_id");
  const subject = str(fd, "subject");
  const demand = str(fd, "demand") || DEMAND.IADE;
  const kvkk = str(fd, "kvkk") === "1";
  const otpCode = str(fd, "otp_code");

  if (!customerCompany) fieldErrors.customer_company = "Firma / kişi adı zorunludur.";
  if (!isValidPhone(customerPhone)) fieldErrors.customer_phone = "Geçerli bir cep telefonu giriniz.";
  if (customerEmail && !isValidEmail(customerEmail)) fieldErrors.customer_email = "Geçerli bir e-posta adresi giriniz.";
  if (!province) fieldErrors.customer_province = "İl seçimi zorunludur.";
  if (!originFactoryId) fieldErrors.origin_factory_id = "Ürünü aldığınız fabrikayı seçiniz.";
  if (!subject) fieldErrors.subject = "Şikâyet konusunu yazınız.";
  if (!kvkk) fieldErrors.kvkk = "Devam etmek için aydınlatma metnini onaylamanız gerekir.";
  if (!Object.values(DEMAND).includes(demand as never)) fieldErrors.demand = "Geçersiz talep türü.";

  // Telefon doğrulaması
  let phoneVerified = false;
  if (getSettingBool("otp_zorunlu", true)) {
    if (!otpCode) {
      fieldErrors.otp_code = "Telefonunuza gelen doğrulama kodunu giriniz.";
    } else {
      const v = verifyOtp(customerPhone, otpCode);
      if (!v.ok) fieldErrors.otp_code = v.error!;
      else phoneVerified = true;
    }
  }

  if (Object.keys(fieldErrors).length > 0) {
    return { ok: false, error: "Formda eksik veya hatalı alanlar var.", fieldErrors };
  }

  // Ürün bilgisi
  let productName = str(fd, "product_name_free");
  let productGroup = str(fd, "product_group") || PRODUCT_GROUP.DOKME_SEKER;
  let packaging = str(fd, "packaging");
  let pid: number | null = null;
  if (productId) {
    const p = all<{ id: number; name: string; product_group: string; packaging: string | null }>(
      "SELECT id, name, product_group, packaging FROM products WHERE id = ?", Number(productId),
    )[0];
    if (p) {
      pid = p.id;
      productName = p.name;
      productGroup = p.product_group;
      packaging = p.packaging ?? packaging;
    }
  }
  if (!productName) {
    return { ok: false, error: "Ürün seçimi zorunludur.", fieldErrors: { product_id: "Ürün seçiniz." } };
  }

  // Kanıt dosyaları
  const maxFiles = getSettingNum("ek_dosya_max_adet", 8);
  const files = fd.getAll("kanit").filter((f): f is File => f instanceof File && f.size > 0);
  if (files.length > maxFiles) {
    return { ok: false, error: `En fazla ${maxFiles} dosya yükleyebilirsiniz.` };
  }
  const stored = [];
  try {
    for (const f of files) stored.push(await storeFile(f));
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }

  const categoryId = str(fd, "category_id");

  try {
    const res = await createComplaint({
      channel: "WEB",
      originFactoryId,
      customerCompany,
      customerName: str(fd, "customer_name") || null,
      customerTitle: str(fd, "customer_title") || null,
      customerPhone,
      customerEmail: customerEmail || null,
      customerAddress: str(fd, "customer_address") || null,
      customerProvince: province,
      customerTaxNo: str(fd, "customer_tax_no") || null,
      productId: pid,
      productName,
      productGroup,
      packaging: packaging || null,
      lotNo: str(fd, "lot_no") || null,
      quantityKg: num(fd, "quantity_kg"),
      invoiceNo: str(fd, "invoice_no") || null,
      deliveryNoteNo: str(fd, "delivery_note_no") || null,
      contractNo: str(fd, "contract_no") || null,
      deliveryDate: str(fd, "delivery_date") || null,
      categoryId: categoryId ? Number(categoryId) : null,
      subject,
      description: str(fd, "description") || null,
      demand,
      kvkkConsent: true,
      phoneVerified,
      sourceIp: ip,
      attachments: stored,
    });

    recordRateUse("sikayet", ip);
    return {
      ok: true,
      complaintNo: res.complaintNo,
      trackingToken: res.trackingToken,
      factoryName: res.factoryName,
    };
  } catch (e) {
    return { ok: false, error: `Kayıt oluşturulamadı: ${(e as Error).message}` };
  }
}
