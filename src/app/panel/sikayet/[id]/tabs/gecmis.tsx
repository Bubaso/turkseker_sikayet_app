import { fmtDateTime } from "@/lib/dates";
import { STATUS_LABEL, type Status } from "@/lib/domain";
import type { EventView, NotificationView } from "@/lib/types";
import { TEMPLATE_LABEL, type TemplateCode } from "@/server/notify";
import { Card, Chip, EmptyState } from "@/components/ui";

const TYPE_TONE: Record<string, "ink" | "info" | "brand" | "ok" | "warn" | "danger"> = {
  KAYIT: "info", DURUM: "ink", EKIP: "brand", YONLENDIRME: "brand",
  INCELEME: "brand", NUMUNE: "brand", ANALIZ: "brand", BELGE: "info",
  IMZA: "info", KARAR: "warn", ITIRAZ: "danger", ISLEM: "ok",
  CAPA: "warn", RESMI_YAZI: "info", BILDIRIM: "info", GOREV: "ink",
  EK: "ink", KAPANIS: "ok", NOT: "ink",
};

/** Denetim izi — dosyada ne olduysa kim ve ne zaman yaptı. */
export function GecmisTab({ events }: { events: EventView[] }) {
  if (events.length === 0) return <EmptyState title="Kayıt yok" />;
  return (
    <Card title={`Dosya geçmişi (${events.length} kayıt)`} bodyClass="">
      <ol className="divide-y divide-ink-100">
        {events.map((e) => (
          <li key={e.id} className="flex gap-3 px-4 py-3 sm:px-5">
            <div className="w-36 shrink-0">
              <p className="tnum text-xs text-ink-500">{fmtDateTime(e.created_at)}</p>
              <Chip tone={TYPE_TONE[e.type] ?? "ink"}>{e.type}</Chip>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-ink-900">{e.title}</p>
              {e.note && (
                <p className="mt-0.5 text-sm leading-relaxed whitespace-pre-wrap text-ink-600">{e.note}</p>
              )}
              <p className="mt-0.5 text-xs text-ink-500">
                {e.actor_name
                  ? `${e.actor_name} — ${e.actor_title}`
                  : (e.actor_label ?? "Sistem")}
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
    </Card>
  );
}

/** Dosya için müşteriye gönderilen SMS ve e-postalar. */
export function BildirimlerTab({ rows }: { rows: NotificationView[] }) {
  if (rows.length === 0) {
    return <EmptyState title="Bildirim yok" hint="Kilometre taşlarına ulaşıldığında müşteriye otomatik SMS ve e-posta gider." />;
  }
  return (
    <Card title={`Gönderilen bildirimler (${rows.length})`} bodyClass="">
      <ul className="divide-y divide-ink-100">
        {rows.map((n) => (
          <li key={n.id} className="px-4 py-3 sm:px-5">
            <div className="flex flex-wrap items-center gap-2">
              <Chip tone={n.channel === "SMS" ? "brand" : "info"}>
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
              {n.channel === "SMS" && (
                <span className="text-xs text-ink-500">{n.segments} kredi</span>
              )}
            </div>
            {n.subject && <p className="mt-1 text-sm font-medium text-ink-800">{n.subject}</p>}
            <p className="mt-0.5 text-sm leading-relaxed whitespace-pre-wrap text-ink-600">{n.body}</p>
            {n.error && <p className="mt-1 text-xs text-danger-700">Hata: {n.error}</p>}
          </li>
        ))}
      </ul>
    </Card>
  );
}
