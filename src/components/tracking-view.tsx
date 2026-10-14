import { all } from "@/lib/db";
import {
  DEMAND_LABEL, STATUS_PUBLIC_LABEL, STATUS_STEP, STATUS_TONE, TOTAL_STEPS,
  type Demand, type Status,
} from "@/lib/domain";
import { fmtDateLong, fmtDateTime } from "@/lib/dates";
import { fmtQuantity, fmtTl, maskPhone } from "@/lib/format";
import type { ComplaintView } from "@/lib/types";
import { TEMPLATE_LABEL, type TemplateCode } from "@/server/notify";
import { Chip, Notice } from "./ui";
import { SurecSeridi } from "./surec-seridi";

interface Milestone {
  label: string;
  date: string | null;
  note?: string | null;
  done: boolean;
  /** Koşulu oluşmadığı için atlanan adım (ör. analiz gerekmedi). */
  atlandi?: boolean;
}

/** Müşteriye gösterilecek kilometre taşları — iç yazışma ve notlar yer almaz. */
function milestones(c: ComplaintView): Milestone[] {
  const out: Milestone[] = [
    { label: "Şikâyetiniz kaydedildi", date: c.received_at, done: true },
  ];

  if (c.redirected_at) {
    out.push({
      label: `Dosya ${c.factory_name}'na yönlendirildi`,
      date: c.redirected_at,
      note: "Adresinize daha yakın fabrikamız incelemeyi yürütecek.",
      done: true,
    });
  }

  out.push({
    label: "İnceleme ekibi görevlendirildi",
    date: c.team_formed_at,
    note: c.team_formed_at ? null : `En geç ${fmtDateLong(c.due_team_at)} tarihine kadar`,
    done: !!c.team_formed_at,
  });

  out.push({
    label: "Ürününüz incelendi",
    date: c.visited_at,
    note: c.visited_at ? null : `En geç ${fmtDateLong(c.due_inspection_at)} tarihine kadar`,
    done: !!c.visited_at,
  });

  out.push({
    label: c.verdict
      ? c.verdict === "HAKLI"
        ? "İnceleme sonucu: şikâyet haklı bulundu"
        : "İnceleme sonucu: şikâyet haklı bulunmadı"
      : "İnceleme sonuçlanır",
    date: c.verdict_at,
    note: c.verdict_reason,
    done: !!c.verdict_at,
  });

  if (c.escalated_at) {
    out.push({
      label: "Genel Müdürlük değerlendirmesine gönderildi",
      date: c.escalated_at,
      note: c.escalation_decided_at
        ? null
        : `Karar en geç ${fmtDateLong(c.escalation_due_at)} tarihine kadar verilecek`,
      done: true,
    });
    out.push({
      label: c.escalation_result
        ? c.escalation_result === "SIKAYET_HAKLI"
          ? "Genel Müdürlük kararı: şikâyet haklı"
          : "Genel Müdürlük kararı: şikâyet haklı bulunmadı"
        : "Genel Müdürlük kararı",
      date: c.escalation_decided_at,
      note: c.escalation_note,
      done: !!c.escalation_decided_at,
    });
  }

  if (c.verdict === "HAKLI") {
    const detay = [
      c.returned_kg ? `İade: ${fmtQuantity(c.returned_kg)}` : null,
      c.exchanged_kg ? `Değişim: ${fmtQuantity(c.exchanged_kg)}` : null,
      c.freight_amount ? `Ödenen nakliye bedeli: ${fmtTl(c.freight_amount)}` : null,
    ].filter(Boolean).join(" · ");
    out.push({
      label: "Sonuç uygulandı: iade / değişim",
      date: c.transaction_date,
      note: detay || (c.transaction_date ? null : `En geç ${fmtDateLong(c.due_resolution_at)} tarihine kadar`),
      done: !!c.transaction_date,
    });
  }

  out.push({
    label: "Sonuç yazılı olarak bildirildi",
    date: c.letter_sent_at ?? c.customer_informed_at,
    done: !!(c.letter_sent_at ?? c.customer_informed_at),
  });
  out.push({
    label: "Dosyanız kapatıldı",
    date: c.closed_at,
    note: c.closing_note,
    done: !!c.closed_at,
  });

  return out;
}

export function TrackingView({ c }: { c: ComplaintView }) {
  const steps = milestones(c);
  const status = c.status as Status;
  /*
   * Bildirim kaydı müşteriye "ne zaman haberdar edildim" sorusunu yanıtlar;
   * mesajların metni zaten telefonunda ve e-posta kutusundadır. Bu yüzden
   * gövdeler değil, kilometre taşının adı, tarihi ve hangi kanaldan gittiği
   * gösterilir. Aynı taşın SMS'i ve e-postası tek satırda birleşir.
   */
  const bildirimler = all<{ template_code: string; channel: string; created_at: string }>(
    `SELECT template_code, channel, created_at FROM notifications
      WHERE complaint_id = ? AND template_code <> 'OTP' AND status = 'GONDERILDI'
      ORDER BY id`,
    c.id,
  );
  const gruplar: { kod: string; tarih: string; kanallar: string[] }[] = [];
  for (const b of bildirimler) {
    const son = gruplar[gruplar.length - 1];
    if (son && son.kod === b.template_code) {
      if (!son.kanallar.includes(b.channel)) son.kanallar.push(b.channel);
    } else {
      gruplar.push({ kod: b.template_code, tarih: b.created_at, kanallar: [b.channel] });
    }
  }

  const step = STATUS_STEP[status] ?? 1;

  return (
    <div className="space-y-5">
      <section className="card">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-ink-200 px-4 py-3.5 sm:px-5">
          <div>
            <p className="text-xs font-medium tracking-wide text-ink-500 uppercase">Şikâyet numarası</p>
            <p className="tnum font-mono text-lg font-semibold text-brand-700">{c.complaint_no}</p>
          </div>
          <div className="text-right">
            <p className="text-xs font-medium tracking-wide text-ink-500 uppercase">Durum</p>
            <div className="mt-0.5">
              <Chip tone={STATUS_TONE[status] ?? "ink"} dot>
                {STATUS_PUBLIC_LABEL[status] ?? c.status}
              </Chip>
            </div>
          </div>
        </div>

        <div className="px-4 py-3 sm:px-5">
          <div className="flex items-center gap-2">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-ink-200">
              <div
                className={`h-full rounded-full ${
                  status === "REDDEDILDI" || status === "IPTAL" ? "bg-ink-400" : "bg-brand-600"
                }`}
                style={{ width: `${Math.round((step / TOTAL_STEPS) * 100)}%` }}
              />
            </div>
            <span className="tnum text-xs text-ink-500">{step} / {TOTAL_STEPS}</span>
          </div>
        </div>

        <dl className="grid grid-cols-1 gap-x-6 gap-y-3 border-t border-ink-100 px-4 py-4 sm:grid-cols-2 sm:px-5">
          {[
            ["Şikâyet tarihi", fmtDateLong(c.received_at)],
            ["İnceleyen fabrika", c.factory_name],
            ["Başvuru sahibi", c.customer_company],
            ["Telefon", maskPhone(c.customer_phone)],
            ["Ürün", `${c.product_name}${c.packaging ? ` — ${c.packaging}` : ""}`],
            ["Parti / Lot", c.lot_no ?? "—"],
            ["Şikâyete konu miktar", c.quantity_kg ? fmtQuantity(c.quantity_kg) : "—"],
            ["Talebiniz", DEMAND_LABEL[c.demand as Demand] ?? c.demand],
          ].map(([k, v]) => (
            <div key={k}>
              <dt className="text-xs font-medium tracking-wide text-ink-500 uppercase">{k}</dt>
              <dd className="mt-0.5 text-sm break-words text-ink-900">{v}</dd>
            </div>
          ))}
          <div className="sm:col-span-2">
            <dt className="text-xs font-medium tracking-wide text-ink-500 uppercase">Şikâyet konusu</dt>
            <dd className="mt-0.5 text-sm text-ink-900">{c.subject}</dd>
          </div>
        </dl>
      </section>

      <section className="card">
        <h2 className="card-title">Süreç adımları</h2>
        <SurecSeridi
          adimlar={steps.map((m) => ({
            baslik: m.label,
            zaman: m.date ? fmtDateTime(m.date) : null,
            aciklama: m.note ?? null,
            durum: m.atlandi ? "atlandi" : m.done ? "tamam" : "bekliyor",
          }))}
        />
      </section>

      {gruplar.length > 0 && (
        <details className="card overflow-hidden">
          <summary className="card-title cursor-pointer normal-case">
            Size gönderilen bilgilendirmeler ({gruplar.length})
          </summary>
          <ul className="divide-y divide-ink-100">
            {gruplar.map((g) => (
              <li key={g.kod + g.tarih}
                  className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 px-4 py-2.5 sm:px-5">
                <span className="text-sm text-ink-800">
                  {TEMPLATE_LABEL[g.kod as TemplateCode] ?? g.kod}
                </span>
                <span className="tnum text-xs text-ink-500">
                  {fmtDateTime(g.tarih)} ·{" "}
                  {g.kanallar.map((k) => (k === "SMS" ? "SMS" : "e-posta")).join(" ve ")}
                </span>
              </li>
            ))}
          </ul>
        </details>
      )}

      {c.status === "KAPANDI" && (
        <Notice tone="ok" title="Dosyanız kapatıldı">
          Şikâyetinizi bize bildirdiğiniz için teşekkür ederiz. Görüşleriniz ürün ve hizmet
          kalitemizi geliştirmemize katkı sağlamaktadır.
        </Notice>
      )}
      {c.status === "REDDEDILDI" && (
        <Notice tone="ink" title="İnceleme tamamlandı">
          Yapılan inceleme ve analizler sonucunda ürünün ilgili kalite standartlarına ve satış
          sözleşmesine uygun olduğu tespit edilmiştir. Karara katılmıyorsanız ürünü aldığınız
          fabrikamıza yazılı olarak başvurabilirsiniz.
        </Notice>
      )}
    </div>
  );
}
