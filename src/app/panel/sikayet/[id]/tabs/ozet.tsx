import Link from "next/link";
import { CHANNEL_LABEL, DEMAND_LABEL, PRODUCT_GROUP_LABEL, STATUS_LABEL,
         type Channel, type Demand, type ProductGroup, type Status } from "@/lib/domain";
import { fmtDate, fmtDateLong, fmtDateTime, slaInfo, type HolidaySet } from "@/lib/dates";
import { fmtPhone, fmtQuantity, fmtTl } from "@/lib/format";
import { checkEscalation, nextStepHint } from "@/lib/workflow";
import { kategoriAilesi } from "@/lib/category-labels";
import type { ComplaintView } from "@/lib/types";
import { Card, Chip, DefList, Notice, SlaChip, VerdictChip } from "@/components/ui";

/** Dosya özeti: müşteri, ürün, şikâyet, SLA kilometre taşları ve mali gerçekleşme. */
export function OzetTab({ c, holidays }: { c: ComplaintView; holidays: HolidaySet }) {
  const esc = checkEscalation(c.product_group, c.quantity_kg);

  const milestones = [
    { label: "Ekip oluşturma", basis: "1 iş günü", due: c.due_team_at, done: c.team_formed_at },
    { label: "İnceleme ve tutanak", basis: "3 iş günü", due: c.due_inspection_at, done: c.verdict_at },
    { label: "İade / değişim / nakliye", basis: "5 iş günü", due: c.due_resolution_at, done: c.transaction_date },
    { label: "Resmî yazı dağıtımı", basis: "işlemden 3 iş günü", due: c.due_report_at, done: c.letter_sent_at },
    ...(c.escalated_at
      ? [{ label: "Daire Başkanlığı kararı", basis: "5 iş günü", due: c.escalation_due_at, done: c.escalation_decided_at }]
      : []),
  ];

  return (
    <div className="space-y-5">
      <Notice tone="brand" title="Sıradaki adım">{nextStepHint(c.status)}</Notice>

      <Card title="Süre takibi (iş günü bazlı)" bodyClass="">
        <div className="table-wrap">
          <table className="tbl">
            <thead>
              <tr>
                <th>Kilometre taşı</th><th>Süre</th><th>Son tarih</th>
                <th>Gerçekleşme</th><th>Durum</th>
              </tr>
            </thead>
            <tbody>
              {milestones.map((m) => {
                const sla = slaInfo(m.due, m.done, holidays);
                return (
                  <tr key={m.label}>
                    <td className="font-medium text-ink-800">{m.label}</td>
                    <td className="text-ink-500">{m.basis}</td>
                    <td className="tnum">{fmtDate(m.due)}</td>
                    <td className="tnum">{m.done ? fmtDate(m.done) : <span className="text-ink-400">—</span>}</td>
                    <td><SlaChip sla={sla} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <Card title="Şikâyet sahibi">
          <DefList
            cols={2}
            items={[
              { label: "Firma / kişi", value: c.customer_company, wide: true },
              { label: "Yetkili", value: c.customer_name ?? "—" },
              { label: "Unvan", value: c.customer_title ?? "—" },
              { label: "Telefon", value: <span className="tnum">{fmtPhone(c.customer_phone)}</span> },
              { label: "E-posta", value: c.customer_email ?? "—" },
              { label: "İl", value: c.province_name ?? "—" },
              { label: "Vergi / TC no", value: c.customer_tax_no ?? "—" },
              { label: "Adres", value: c.customer_address ?? "—", wide: true },
              {
                label: "Telefon doğrulaması",
                value: c.phone_verified_at
                  ? <Chip tone="ok" dot>SMS ile doğrulandı</Chip>
                  : <Chip tone="ink">Doğrulanmadı ({CHANNEL_LABEL[c.channel as Channel]} başvurusu)</Chip>,
              },
              {
                label: "KVKK onayı",
                value: c.kvkk_consent_at ? fmtDateTime(c.kvkk_consent_at) : "—",
              },
            ]}
          />
        </Card>

        <Card title="Ürün ve şikâyet">
          <DefList
            cols={2}
            items={[
              { label: "Ürün", value: `${c.product_name}${c.packaging ? ` — ${c.packaging}` : ""}`, wide: true },
              { label: "Ürün grubu", value: PRODUCT_GROUP_LABEL[c.product_group as ProductGroup] ?? c.product_group },
              { label: "Parti / Lot", value: c.lot_no ?? "—" },
              { label: "Şikâyete konu miktar", value: c.quantity_kg ? fmtQuantity(c.quantity_kg) : "—" },
              { label: "Teslim tarihi", value: fmtDate(c.delivery_date) },
              { label: "Fatura no", value: c.invoice_no ?? "—" },
              { label: "İrsaliye no", value: c.delivery_note_no ?? "—" },
              { label: "Sözleşme no", value: c.contract_no ?? "—" },
              {
                label: "Şikâyet türü",
                value: c.category_name
                  ? <>
                      {c.category_name}
                      <span className="ml-1.5 text-xs text-ink-500">({kategoriAilesi(c.category_family)})</span>
                      {c.category_critical === 1 && (
                        <span className="ml-1.5"><Chip tone="danger" dot>Gıda güvenliği ihbarı</Chip></span>
                      )}
                    </>
                  : "—",
                wide: true,
              },
              { label: "Şikâyet konusu", value: c.subject, wide: true },
              {
                label: "Açıklama",
                value: c.description
                  ? <span className="whitespace-pre-wrap">{c.description}</span>
                  : "—",
                wide: true,
              },
              {
                label: "Şikâyetçi talebi",
                value: <>
                  {DEMAND_LABEL[c.demand as Demand] ?? c.demand}
                  {c.demands_freight === 1 && (
                    <span className="ml-1.5"><Chip tone="warn">Nakliye bedeli talebi</Chip></span>
                  )}
                </>,
                wide: true,
              },
            ]}
          />
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <Card title="İnceleme ve karar">
          <DefList
            cols={2}
            items={[
              { label: "Ekip oluşturulma", value: fmtDateTime(c.team_formed_at) },
              { label: "Yerinde inceleme", value: fmtDate(c.visited_at) },
              {
                label: "Laboratuvar analizi",
                value: c.lab_required === 1
                  ? <Chip tone="brand">Gerekli</Chip>
                  : <Chip tone="ink">Yapılmadı</Chip>,
              },
              { label: "Analiz yapılmama gerekçesi", value: c.lab_skip_reason ?? "—" },
              {
                label: "İnceleme notu",
                value: c.inspection_note ? <span className="whitespace-pre-wrap">{c.inspection_note}</span> : "—",
                wide: true,
              },
              { label: "Karar", value: <VerdictChip verdict={c.verdict} /> },
              { label: "Karar tarihi", value: fmtDateTime(c.verdict_at) },
              {
                label: "İnceleme sonucu / gerekçe",
                value: c.verdict_reason ? <span className="whitespace-pre-wrap">{c.verdict_reason}</span> : "—",
                wide: true,
              },
              {
                label: "Karar / yapılan işlem",
                value: c.decision ? <span className="whitespace-pre-wrap">{c.decision}</span> : "—",
                wide: true,
              },
            ]}
          />
          {c.verdict === "HAKSIZ" && (
            <div className="mt-4 border-t border-ink-100 pt-3">
              <Notice tone={esc.required ? "warn" : "ink"}
                      title={esc.required ? "İtiraz eşiği aşıldı" : "İtiraz eşiğinin altında"}>
                {esc.reason}
              </Notice>
            </div>
          )}
        </Card>

        <Card title="Gerçekleşme ve kapanış">
          <DefList
            cols={2}
            items={[
              { label: "İşlem tarihi", value: fmtDate(c.transaction_date) },
              { label: "İade miktarı", value: c.returned_kg ? fmtQuantity(c.returned_kg) : "—" },
              { label: "Değişim miktarı", value: c.exchanged_kg ? fmtQuantity(c.exchanged_kg) : "—" },
              { label: "İade / mahsup bedeli", value: c.refund_amount ? fmtTl(c.refund_amount) : "—" },
              { label: "Ödenen nakliye bedeli", value: c.freight_amount ? fmtTl(c.freight_amount) : "—" },
              { label: "FSSC 22000 düzeltici faaliyet", value: c.capa_no ?? "—" },
              {
                label: "DF açıklaması",
                value: c.capa_note ? <span className="whitespace-pre-wrap">{c.capa_note}</span> : "—",
                wide: true,
              },
              { label: "Resmî yazı sayısı", value: c.letter_no ?? "—" },
              { label: "Resmî yazı tarihi", value: fmtDate(c.letter_sent_at) },
              { label: "Müşteri bilgilendirmesi", value: fmtDateTime(c.customer_informed_at) },
              { label: "Kapanış tarihi", value: fmtDateTime(c.closed_at) },
              {
                label: "Kapanış notu",
                value: c.closing_note ? <span className="whitespace-pre-wrap">{c.closing_note}</span> : "—",
                wide: true,
              },
            ]}
          />
        </Card>
      </div>

      {c.escalated_at && (
        <Card title="Genel Müdürlük itiraz süreci">
          <DefList
            cols={2}
            items={[
              { label: "Gönderilen daire", value: c.department_name ?? "—" },
              { label: "Gönderim tarihi", value: fmtDateTime(c.escalated_at) },
              { label: "Karar son tarihi", value: fmtDateLong(c.escalation_due_at) },
              {
                label: "Karar",
                value: c.escalation_result
                  ? <Chip tone={c.escalation_result === "SIKAYET_HAKLI" ? "ok" : "ink"} dot>
                      {c.escalation_result === "SIKAYET_HAKLI" ? "Şikâyet haklı" : "Şikâyet haklı bulunmadı"}
                    </Chip>
                  : <Chip tone="warn" dot>Değerlendirmede</Chip>,
              },
              {
                label: "Gönderim gerekçesi",
                value: c.escalation_reason ? <span className="whitespace-pre-wrap">{c.escalation_reason}</span> : "—",
                wide: true,
              },
              {
                label: "Daire kararı gerekçesi",
                value: c.escalation_note ? <span className="whitespace-pre-wrap">{c.escalation_note}</span> : "—",
                wide: true,
              },
            ]}
          />
        </Card>
      )}

      <Card title="Dosya künyesi">
        <DefList
          cols={3}
          items={[
            { label: "Şikâyet no", value: <span className="font-mono">{c.complaint_no}</span> },
            { label: "Şikâyet tarihi", value: fmtDateLong(c.received_at) },
            { label: "Başvuru kanalı", value: CHANNEL_LABEL[c.channel as Channel] ?? c.channel },
            { label: "Durum", value: STATUS_LABEL[c.status as Status] ?? c.status },
            { label: "Üretici fabrika", value: c.origin_factory_name ?? "—" },
            { label: "Dosyayı yürüten fabrika", value: c.factory_name },
            { label: "Şikâyeti alan", value: c.received_by_name ?? "Müşteri (web formu)" },
            {
              label: "Yönlendirme",
              value: c.redirected_at
                ? `${fmtDate(c.redirected_at)} tarihinde yönlendirildi`
                : "—",
            },
            {
              label: "Müşteri takip bağlantısı",
              value: (
                <Link href={`/takip/${c.tracking_token}`} className="link text-xs" target="_blank">
                  Müşterinin gördüğü sayfayı aç
                </Link>
              ),
            },
            {
              label: "Yönlendirme gerekçesi",
              value: c.redirect_reason ?? "—",
              wide: true,
            },
          ]}
        />
      </Card>
    </div>
  );
}
