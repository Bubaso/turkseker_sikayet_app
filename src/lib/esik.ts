/* ===========================================================================
   İtiraz eşiği ve daire yönlendirmesi (TL PASAT 004 md. 5-6).
   =========================================================================== */

import {
  DEPT, ESCALATION_THRESHOLD_KG, PRODUCT_GROUP, type DeptCode, type ProductGroup,
} from "./domain";

export interface EsikSonucu {
  required: boolean;
  thresholdKg: number;
  quantityKg: number;
  departmentCode: DeptCode;
  reason: string;
}

/** Haklı bulunmayan şikâyette itirazın Daire Başkanlığına gidip gitmeyeceği. */
export function checkEscalation(
  productGroup: string, quantityKg: number | null | undefined,
): EsikSonucu {
  const group = (productGroup as ProductGroup) ?? PRODUCT_GROUP.DOKME_SEKER;
  const threshold = ESCALATION_THRESHOLD_KG[group] ?? ESCALATION_THRESHOLD_KG.DOKME_SEKER;
  const qty = quantityKg ?? 0;
  const ton = (v: number) => (v / 1000).toLocaleString("tr-TR");
  const required = qty >= threshold;
  return {
    required, thresholdKg: threshold, quantityKg: qty,
    departmentCode: escalationDepartment(group),
    reason: required
      ? `Şikâyete konu miktar (${ton(qty)} ton) ${ton(threshold)} ton eşiğini aştığı için ` +
        "itiraz Daire Başkanlığına gönderilir."
      : `Şikâyete konu miktar (${ton(qty)} ton) ${ton(threshold)} ton eşiğinin altında ` +
        "olduğu için karar fabrika düzeyinde kesinleşir.",
  };
}

/** İtirazı değerlendirecek daire: paketli şeker ise Perakende, değilse Pazarlama. */
export function escalationDepartment(productGroup: string): DeptCode {
  return productGroup === PRODUCT_GROUP.PAKETLI_SEKER
    ? DEPT.PERAKENDE_LOJISTIK
    : DEPT.PAZARLAMA_SATIS;
}

/** Resmî yazının gönderileceği daireler (md. 6 ve 8). */
export function letterRecipients(productGroup: string): DeptCode[] {
  return [
    escalationDepartment(productGroup),
    DEPT.SEKER_URETIM,
    DEPT.MALI_ISLER,
    DEPT.STRATEJI,
  ];
}
