/* ===========================================================================
   Müşteri Şikâyet Formu (FR PASAT 007) — formun kendisi.

   Aynı bileşen iki yerde kullanılır: dosyayı açan Fabrika Müdürünün ekranında
   (ilk gördüğü şey formun kendisidir) ve yazdırma sayfasında. Bu yüzden veri
   okumaz; yalnızca verilen satırları çizer.
   =========================================================================== */

import {
  CHANNEL_LABEL, DEMAND_LABEL, PRODUCT_GROUP_LABEL,
  type Channel, type Demand, type ProductGroup,
} from "@/lib/domain";
import { fmtDate } from "@/lib/dates";
import { fmtPhone, fmtQuantity } from "@/lib/format";
import type { ComplaintView } from "@/lib/types";

export interface FormKaniti {
  id: number;
  file_name: string;
}

/** Formun satırları — yazdırma ve ekran görünümü aynı metni kullanır. */
export function formSatirlari(c: ComplaintView): [string, string][] {
  return [
    ["ÜRETİCİ ŞEKER FABRİKASI", c.origin_factory_name ?? c.factory_name],
    ["ŞİKÂYET NUMARASI / TARİH", `${c.complaint_no} / ${fmtDate(c.received_at)}`],
    [
      "ŞİKÂYETİ ALAN",
      c.received_by_name
        ? `${c.received_by_name} (${CHANNEL_LABEL[c.channel as Channel] ?? c.channel})`
        : "Çevrim içi başvuru (müşteri)",
    ],
    ["ÜRÜN ADI", `${c.product_name}${c.packaging ? ` — ${c.packaging}` : ""}`],
    [
      "ÜRÜN GRUBU / MİKTARI",
      `${PRODUCT_GROUP_LABEL[c.product_group as ProductGroup] ?? c.product_group}` +
      ` / ${c.quantity_kg ? fmtQuantity(c.quantity_kg) : "belirtilmedi"}`,
    ],
    ["PARTİ / LOT NO", c.lot_no ?? "—"],
    [
      "FATURA / İRSALİYE / SÖZLEŞME NO",
      [c.invoice_no, c.delivery_note_no, c.contract_no].filter(Boolean).join(" / ") || "—",
    ],
    ["TESLİM TARİHİ", fmtDate(c.delivery_date)],
    [
      "ŞİKÂYET KONUSU",
      `${c.subject}${c.description ? `\n\n${c.description}` : ""}` +
      (c.category_name ? `\n\n(Şikâyet türü: ${c.category_name})` : ""),
    ],
    [
      "ŞİKÂYET SAHİBİ\n(Firma adı, unvan, isim)",
      [c.customer_company, c.customer_title, c.customer_name].filter(Boolean).join("\n"),
    ],
    ["ADRES", [c.customer_address, c.province_name].filter(Boolean).join("\n") || "—"],
    ["TELEFON", fmtPhone(c.customer_phone)],
    ["E-MAIL", c.customer_email ?? "—"],
    ["ŞİKÂYETÇİ TALEBİ", DEMAND_LABEL[c.demand as Demand] ?? c.demand],
  ];
}

/**
 * Formu çizer. `kanitlar` verildiğinde son satır müşterinin ilettiği
 * dosyaların bağlantılarını gösterir.
 */
export function SikayetFormu({
  c, kanitlar = [], yazdirma = false,
}: {
  c: ComplaintView;
  kanitlar?: FormKaniti[];
  /** Yazdırma sayfasında siyah çerçeveli, ekranda gri çerçeveli çizilir. */
  yazdirma?: boolean;
}) {
  const cerceve = yazdirma ? "border border-black" : "border border-ink-200";
  const baslik = yazdirma
    ? "w-[34%] text-left align-top font-semibold"
    : "w-[38%] bg-ink-50 text-left align-top text-xs font-semibold tracking-wide text-ink-600 uppercase sm:w-[32%]";

  return (
    <table className={`w-full border-collapse ${yazdirma ? "text-[10.5pt]" : "text-sm"}`}>
      <tbody>
        {formSatirlari(c).map(([label, value]) => (
          <tr key={label}>
            <th className={`${cerceve} ${baslik} p-2 whitespace-pre-line`}>{label}</th>
            <td className={`${cerceve} p-2 align-top whitespace-pre-line ${yazdirma ? "" : "text-ink-800"}`}>
              {value}
            </td>
          </tr>
        ))}
        <tr>
          <th className={`${cerceve} ${baslik} p-2 whitespace-pre-line`}>
            KANITLAR{"\n"}(Görseller vb.)
          </th>
          <td className={`${cerceve} p-2 align-top`}>
            {kanitlar.length === 0 ? (
              <span className={yazdirma ? "" : "text-ink-500"}>Ek yok</span>
            ) : yazdirma ? (
              <span className="whitespace-pre-line">
                {kanitlar.map((k) => `• ${k.file_name}`).join("\n")}
              </span>
            ) : (
              <ul className="space-y-0.5">
                {kanitlar.map((k) => (
                  <li key={k.id}>
                    <a href={`/api/ek/${k.id}`} target="_blank" rel="noreferrer" className="link">
                      {k.file_name}
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </td>
        </tr>
      </tbody>
    </table>
  );
}
