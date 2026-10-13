import { all } from "@/lib/db";
import {
  DEMAND_LABEL, STATUS_PUBLIC_LABEL, STATUS_STEP, STATUS_TONE, TOTAL_STEPS,
  type Demand, type Status,
} from "@/lib/domain";
import { fmtDateLong, fmtDateTime } from "@/lib/dates";
import { fmtQuantity, fmtTl, maskPhone } from "@/lib/format";
import type { ComplaintView } from "@/lib/types";
import { Chip, Notice } from "./ui";

interface Milestone {
  label: string;
  date: string | null;
  note?: string | null;
  done: boolean;
}

/** Müşteriye gösterilecek kilometre taşları — iç yazışma ve notlar yer almaz. */
function milestones(c: ComplaintView): Milestone[] {
  const firstSample = all<{ taken_at: string }>(
    "SELECT taken_at FROM samples WHERE complaint_id = ? ORDER BY id LIMIT 1", c.id,
  )[0];
  const firstAnalysis = all<{ analyzed_at: string; conformity: string }>(
    "SELECT analyzed_at, conformity FROM analyses WHERE complaint_id = ? ORDER BY id LIMIT 1", c.id,
  )[0];

  const out: Milestone[] = [
    { label: "Şikâyet kaydı alındı", date: c.received_at, done: true },
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
    label: "İnceleme ekibi oluşturuldu",
    date: c.team_formed_at,
    note: c.team_formed_at ? null : `En geç ${fmtDateLong(c.due_team_at)} tarihine kadar`,
    done: !!c.team_formed_at,
  });

  out.push({
    label: "Yerinde / görsel üzerinden inceleme",
    date: c.visited_at,
    note: c.visited_at ? null : `En geç ${fmtDateLong(c.due_inspection_at)} tarihine kadar`,
    done: !!c.visited_at,
  });

  if (firstSample || c.lab_required === 1) {
    out.push({ label: "Numune alındı", date: firstSample?.taken_at ?? null, done: !!firstSample });
    out.push({
      label: "Laboratuvar analizi tamamlandı",
      date: firstAnalysis?.analyzed_at ?? null,
      done: !!firstAnalysis,
    });
  } else if (c.lab_skip_reason) {
    out.push({
      label: "Analiz yapılmadı",
      date: c.visited_at,
      note: c.lab_skip_reason,
      done: !!c.visited_at,
    });
  }

  out.push({
    label: c.verdict
      ? c.verdict === "HAKLI"
        ? "Karar: şikâyet haklı bulundu"
        : "Karar: şikâyet haklı bulunmadı"
      : "İnceleme sonucu ve karar",
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
      label: "İade / değişim işlemi",
      date: c.transaction_date,
      note: detay || (c.transaction_date ? null : `En geç ${fmtDateLong(c.due_resolution_at)} tarihine kadar`),
      done: !!c.transaction_date,
    });
  }

  out.push({
    label: "Müşteri bilgilendirmesi",
    date: c.customer_informed_at,
    done: !!c.customer_informed_at,
  });
  out.push({
    label: "Dosya kapatıldı",
    date: c.closed_at,
    note: c.closing_note,
    done: !!c.closed_at,
  });

  return out;
}

export function TrackingView({ c }: { c: ComplaintView }) {
  const steps = milestones(c);
  const status = c.status as Status;
  const notifications = all<{
    id: number; channel: string; body: string; subject: string | null;
    created_at: string; status: string;
  }>(
    `SELECT id, channel, body, subject, created_at, status FROM notifications
      WHERE complaint_id = ? AND template_code <> 'OTP' AND status = 'GONDERILDI'
      ORDER BY id DESC LIMIT 20`,
    c.id,
  );

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
        <ol className="divide-y divide-ink-100">
          {steps.map((m, i) => (
            <li key={`${m.label}-${i}`} className="flex gap-3.5 px-4 py-3 sm:px-5">
              <span
                className={
                  "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border text-[11px] font-semibold " +
                  (m.done
                    ? "border-ok-600 bg-ok-600 text-white"
                    : "border-ink-300 bg-white text-ink-400")
                }
                aria-hidden
              >
                {m.done ? "✓" : i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <p className={`text-sm font-medium ${m.done ? "text-ink-900" : "text-ink-500"}`}>
                  {m.label}
                </p>
                {m.date && <p className="text-xs text-ink-500">{fmtDateTime(m.date)}</p>}
                {m.note && (
                  <p className="mt-0.5 text-sm leading-relaxed whitespace-pre-wrap text-ink-600">
                    {m.note}
                  </p>
                )}
              </div>
            </li>
          ))}
        </ol>
      </section>

      {notifications.length > 0 && (
        <section className="card">
          <h2 className="card-title">Size gönderilen bilgilendirmeler</h2>
          <ul className="divide-y divide-ink-100">
            {notifications.map((n) => (
              <li key={n.id} className="px-4 py-3 sm:px-5">
                <div className="flex flex-wrap items-center gap-2">
                  <Chip tone={n.channel === "SMS" ? "brand" : "info"}>
                    {n.channel === "SMS" ? "SMS" : "E-posta"}
                  </Chip>
                  <span className="text-xs text-ink-500">{fmtDateTime(n.created_at)}</span>
                </div>
                {n.subject && <p className="mt-1 text-sm font-medium text-ink-800">{n.subject}</p>}
                <p className="mt-0.5 text-sm leading-relaxed whitespace-pre-wrap text-ink-600">
                  {n.body}
                </p>
              </li>
            ))}
          </ul>
        </section>
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
