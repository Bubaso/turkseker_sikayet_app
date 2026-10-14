/* ===========================================================================
   FR PASAT 005 — Aylık Müşteri Şikâyetleri Tablosu (TL PASAT 004 md. 8).
   17 kolonlu tablo, ürün grubuna göre daire dağıtımı ve Excel çıktısı.
   =========================================================================== */

import { all, one } from "@/lib/db";
import { CHANNEL_LABEL, PRODUCT_GROUP_LABEL, type Channel, type ProductGroup } from "@/lib/domain";
import { fmtDate, monthName } from "@/lib/dates";
import { letterRecipients } from "@/lib/esik";

export interface MonthlyRow {
  id: number;
  complaint_no: string;
  channel: string;
  received_at: string;
  customer_company: string;
  product_name: string;
  packaging: string | null;
  product_group: string;
  lot_no: string | null;
  subject: string;
  quantity_kg: number | null;
  verdict: string | null;
  verdict_reason: string | null;
  decision: string | null;
  returned_kg: number;
  exchanged_kg: number;
  refund_amount: number;
  freight_amount: number;
  transaction_date: string | null;
  ref_note: string | null;
  letter_no: string | null;
  status: string;
  /** Önceki aydan devreden açık dosya mı. */
  carried_over: number;
}

export interface MonthlyReport {
  factoryId: number;
  factoryName: string;
  year: number;
  month: number;
  periodLabel: string;
  rows: MonthlyRow[];
  totals: {
    returned_kg: number;
    exchanged_kg: number;
    refund_amount: number;
    freight_amount: number;
  };
  /** Gönderilecek daire başkanlıkları. */
  recipients: string[];
  /** Tabloda hiç kayıt yoksa forma yazılacak not. */
  emptyNote: string | null;
}

/**
 * Bir fabrikanın verilen ay için tablosunu üretir.
 * Tabloya: o ay açılan dosyalar + önceki aylardan devreden açık dosyalar girer
 * (formun kullanım notu: "Önceki aydan devreden açık dosyaları aynı şikâyet
 * numarasıyla izleyiniz"). Mali alanlara yalnızca rapor ayında gerçekleşen
 * işlemler yazılır.
 */
export function buildMonthlyReport(factoryId: number, year: number, month: number): MonthlyReport {
  const ym = `${year}-${String(month).padStart(2, "0")}`;
  const monthStart = `${ym}-01`;
  const monthEnd = `${ym}-31`;

  const factory = one<{ name: string }>("SELECT name FROM factories WHERE id = ?", factoryId);

  const rows = all<MonthlyRow>(
    `SELECT c.id, c.complaint_no, c.channel, c.received_at, c.customer_company,
            c.product_name, c.packaging, c.product_group, c.lot_no, c.subject,
            c.quantity_kg, c.verdict, c.verdict_reason, c.decision,
            CASE WHEN strftime('%Y-%m', c.transaction_date) = ? THEN c.returned_kg ELSE 0 END AS returned_kg,
            CASE WHEN strftime('%Y-%m', c.transaction_date) = ? THEN c.exchanged_kg ELSE 0 END AS exchanged_kg,
            CASE WHEN strftime('%Y-%m', c.transaction_date) = ? THEN c.refund_amount ELSE 0 END AS refund_amount,
            CASE WHEN strftime('%Y-%m', c.transaction_date) = ? THEN c.freight_amount ELSE 0 END AS freight_amount,
            c.transaction_date, c.ref_note, c.letter_no, c.status,
            CASE WHEN c.received_at < ? THEN 1 ELSE 0 END AS carried_over
       FROM complaints c
      WHERE c.factory_id = ?
        AND c.status <> 'IPTAL'
        AND (
          strftime('%Y-%m', c.received_at) = ?
          OR (c.received_at < ?
              AND (c.closed_at IS NULL OR strftime('%Y-%m', c.closed_at) >= ?))
        )
      ORDER BY c.received_at, c.id`,
    ym, ym, ym, ym, monthStart, factoryId, ym, monthStart, ym,
  );

  const totals = rows.reduce(
    (a, r) => ({
      returned_kg: a.returned_kg + r.returned_kg,
      exchanged_kg: a.exchanged_kg + r.exchanged_kg,
      refund_amount: a.refund_amount + r.refund_amount,
      freight_amount: a.freight_amount + r.freight_amount,
    }),
    { returned_kg: 0, exchanged_kg: 0, refund_amount: 0, freight_amount: 0 },
  );

  // Dağıtım: tabloda bulunan ürün gruplarının gerektirdiği dairelerin birleşimi
  const deptCodes = new Set<string>();
  for (const g of new Set(rows.map((r) => r.product_group))) {
    for (const d of letterRecipients(g)) deptCodes.add(d);
  }
  if (deptCodes.size === 0) {
    for (const d of letterRecipients("DOKME_SEKER")) deptCodes.add(d);
  }
  const recipients = all<{ name: string }>(
    `SELECT name FROM departments WHERE code IN (${[...deptCodes].map(() => "?").join(",")})
      ORDER BY id`,
    ...[...deptCodes],
  ).map((d) => d.name);

  const newCount = rows.filter((r) => !r.carried_over).length;
  const carried = rows.filter((r) => r.carried_over).length;

  return {
    factoryId,
    factoryName: factory?.name ?? "—",
    year,
    month,
    periodLabel: `${monthName(month)} ${year}`,
    rows,
    totals,
    recipients,
    emptyNote:
      newCount === 0
        ? carried > 0
          ? `Bu ay yeni müşteri şikâyeti alınmamıştır. Önceki aylardan devreden ${carried} açık dosya izlenmektedir.`
          : "Bu ay yeni müşteri şikâyeti alınmamıştır."
        : null,
  };
}

/** Tablo başlıkları — formdaki 17 kolon, aynı sırayla. */
export const MONTHLY_HEADERS = [
  "Şikâyet No",
  "Kayıt türü",
  "Şikâyet tarihi",
  "Müşteri / Firma",
  "Ürün ve ambalaj bilgisi",
  "Ürün grubu",
  "Parti / Lot No",
  "Şikâyet konusu",
  "Şikâyete konu miktar (kg)",
  "İnceleme sonucu / gerekçe",
  "Karar / Yapılan işlem",
  "İade miktarı (kg)",
  "Değişim miktarı (kg)",
  "İade / mahsup bedeli (TL)",
  "Ödenen nakliye bedeli (TL)",
  "İşlem tarihi",
  "Açıklama / Belge referansı",
] as const;

/** Bir satırı formdaki 17 kolona dönüştürür. */
export function monthlyCells(r: MonthlyRow): (string | number | null)[] {
  return [
    r.complaint_no,
    CHANNEL_LABEL[r.channel as Channel] ?? r.channel,
    fmtDate(r.received_at),
    r.customer_company,
    `${r.product_name}${r.packaging ? ` — ${r.packaging}` : ""}`,
    PRODUCT_GROUP_LABEL[r.product_group as ProductGroup] ?? r.product_group,
    r.lot_no ?? "",
    r.subject,
    r.quantity_kg ?? null,
    r.verdict_reason ?? (r.verdict ? "" : "İnceleme sürüyor"),
    r.decision ?? "",
    r.returned_kg || null,
    r.exchanged_kg || null,
    r.refund_amount || null,
    r.freight_amount || null,
    r.transaction_date ? fmtDate(r.transaction_date) : "",
    [
      r.letter_no ? `Resmî yazı: ${r.letter_no}` : null,
      r.carried_over ? "Önceki aydan devreden" : null,
      r.ref_note,
    ].filter(Boolean).join(" · "),
  ];
}
