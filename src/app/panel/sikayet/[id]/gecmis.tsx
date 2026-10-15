import { fmtDateTime } from "@/lib/dates";
import { STATUS_LABEL, type Status } from "@/lib/domain";
import type { EventView, NotificationView } from "@/lib/types";
import { TEMPLATE_LABEL, type TemplateCode } from "@/server/notify";
import { Chip } from "@/components/ui";

/* ===========================================================================
   Denetim izi ve müşteriye giden bildirimler.

   İkisi de her gün bakılan bilgi değil; dosyanın akışını bozmamaları için
   katlanmış durur. Açıldığında kim, ne zaman, ne yaptı tam olarak okunur.
   =========================================================================== */

/*
 * Denetim izinde tür etiketi yalnızca satırı sınıflandırır; "şimdi şunu yap"
 * demez. Bu yüzden dolu marka rozeti kullanılmaz — renk ancak kararın
 * ağırlığını taşıdığı yerde (karar, itiraz, kapanış) anlam yüklenir.
 */
const TYPE_TONE: Record<string, "ink" | "info" | "ok" | "warn" | "danger"> = {
  KAYIT: "info", DURUM: "ink", EKIP: "info", YONLENDIRME: "ink",
  INCELEME: "info", BELGE: "info", KARAR: "warn", ITIRAZ: "danger",
  ISLEM: "ok", RESMI_YAZI: "info", BILDIRIM: "info", GOREV: "ink",
  EK: "ink", KAPANIS: "ok", NOT: "ink",
};

const summaryClass =
  "cursor-pointer border-b border-ink-200 px-4 py-2.5 text-baslik font-semibold " +
  "tracking-wide text-ink-700 uppercase";

export function Gecmis({
  events, notifications,
}: {
  events: EventView[];
  notifications: NotificationView[];
}) {
  return (
    <div className="space-y-5">
      <details className="card overflow-hidden">
        <summary className={summaryClass}>Dosya geçmişi ({events.length} kayıt)</summary>
        <ol className="divide-y divide-ink-100">
          {events.map((e) => (
            <li key={e.id} className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:gap-3 sm:px-5">
              <div className="sm:w-36 sm:shrink-0">
                <p className="tnum text-xs text-ink-500">{fmtDateTime(e.created_at)}</p>
                <Chip tone={TYPE_TONE[e.type] ?? "ink"}>{e.type}</Chip>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-ink-900">{e.title}</p>
                {e.note && (
                  <p className="mt-0.5 text-sm leading-relaxed break-words whitespace-pre-wrap text-ink-600">
                    {e.note}
                  </p>
                )}
                <p className="mt-0.5 text-xs text-ink-500">
                  {e.actor_name ? `${e.actor_name} — ${e.actor_title}` : (e.actor_label ?? "Sistem")}
                  {e.from_status && e.to_status && (
                    <>
                      {" · "}
                      {STATUS_LABEL[e.from_status as Status] ?? e.from_status} →{" "}
                      {STATUS_LABEL[e.to_status as Status] ?? e.to_status}
                    </>
                  )}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </details>

      <details className="card overflow-hidden">
        <summary className={summaryClass}>
          Müşteriye giden bildirimler ({notifications.length})
        </summary>
        {notifications.length === 0 ? (
          <p className="px-4 py-3 text-sm text-ink-500 sm:px-5">
            Kilometre taşlarına ulaşıldığında müşteriye otomatik SMS ve e-posta gider.
          </p>
        ) : (
          <ul className="divide-y divide-ink-100">
            {notifications.map((n) => (
              <li key={n.id} className="px-4 py-3 sm:px-5">
                <div className="flex flex-wrap items-center gap-2">
                  <Chip tone={n.channel === "SMS" ? "ink" : "info"}>
                    {n.channel === "SMS" ? "SMS" : "E-posta"}
                  </Chip>
                  <Chip tone={n.status === "GONDERILDI" ? "ok" : n.status === "HATA" ? "danger" : "warn"} dot>
                    {n.status === "GONDERILDI" ? "Gönderildi" : n.status === "HATA" ? "Hata" : "Kuyrukta"}
                  </Chip>
                  <span className="text-xs font-medium text-ink-700">
                    {TEMPLATE_LABEL[n.template_code as TemplateCode] ?? n.template_code}
                  </span>
                  <span className="tnum text-xs text-ink-500">{fmtDateTime(n.created_at)}</span>
                  <span className="tnum text-xs text-ink-500">→ {n.recipient}</span>
                </div>
                {n.subject && <p className="mt-1 text-sm font-medium text-ink-800">{n.subject}</p>}
                <p className="mt-0.5 text-sm leading-relaxed break-words whitespace-pre-wrap text-ink-600">{n.body}</p>
                {n.error && <p className="mt-1 text-xs text-danger-700">Hata: {n.error}</p>}
              </li>
            ))}
          </ul>
        )}
      </details>
    </div>
  );
}
