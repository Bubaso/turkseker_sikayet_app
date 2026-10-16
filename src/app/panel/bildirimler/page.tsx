import Link from "next/link";
import { all, scalar } from "@/lib/db";
import { isGmRole } from "@/lib/roles";
import { fmtDateTime } from "@/lib/dates";
import {requirePageUser} from "@/server/auth";
import { TEMPLATE_LABEL, type TemplateCode } from "@/server/notify";
import { isSimulation } from "@/server/providers";
import type { NotificationView } from "@/lib/types";
import { Card, Chip, EmptyState, Notice, PageHeader, Stat } from "@/components/ui";
import { RetryButton } from "./retry";

export const dynamic = "force-dynamic";

const DURUM_ETIKET: Record<string, string> = {
  GONDERILDI: "Gönderilen",
  HATA: "Hatalı",
  KUYRUKTA: "Kuyrukta",
};

/** SMS ve e-posta giden kutusu. */
export default async function OutboxPage({
  searchParams,
}: {
  searchParams: Promise<{ kanal?: string; durum?: string; s?: string }>;
}) {
  const q = await searchParams;

  /* Kutulara ve çiplere adres üreten tek yer; sayfa numarası her zaman sıfırlanır. */
  const suzgec = (yama: { kanal?: string | null; durum?: string | null }) => {
    const p = new URLSearchParams();
    const kanal = yama.kanal === undefined ? q.kanal : yama.kanal;
    const durum = yama.durum === undefined ? q.durum : yama.durum;
    if (kanal) p.set("kanal", kanal);
    if (durum) p.set("durum", durum);
    const qs = p.toString();
    return `/panel/bildirimler${qs ? `?${qs}` : ""}`;
  };
  const user = await requirePageUser();
  const gm = isGmRole(user.role) || user.role === "SISTEM_YONETICISI";
  const page = Math.max(1, Number(q.s ?? 1));
  const size = 40;

  const where: string[] = ["n.template_code <> 'OTP'"];
  if (!gm) where.push(`c.factory_id = ${Number(user.factory_id ?? -1)}`);
  if (q.kanal) where.push(`n.channel = '${q.kanal === "SMS" ? "SMS" : "EPOSTA"}'`);
  if (q.durum) {
    const s = ["GONDERILDI", "HATA", "KUYRUKTA"].includes(q.durum) ? q.durum : "GONDERILDI";
    where.push(`n.status = '${s}'`);
  }
  const clause = `WHERE ${where.join(" AND ")}`;

  const rows = all<NotificationView>(
    `SELECT n.*, c.complaint_no, f.short_name AS factory_short
       FROM notifications n
       LEFT JOIN complaints c ON c.id = n.complaint_id
       LEFT JOIN factories f ON f.id = c.factory_id
      ${clause}
      ORDER BY n.id DESC LIMIT ? OFFSET ?`,
    size, (page - 1) * size,
  );
  const total = scalar<number>(
    `SELECT COUNT(*) FROM notifications n LEFT JOIN complaints c ON c.id = n.complaint_id ${clause}`,
  ) ?? 0;

  const counts = all<{ status: string; channel: string; n: number; credits: number }>(
    `SELECT n.status, n.channel, COUNT(*) AS n, IFNULL(SUM(n.segments),0) AS credits
       FROM notifications n LEFT JOIN complaints c ON c.id = n.complaint_id
      ${clause} GROUP BY n.status, n.channel`,
  );
  const sum = (f: (r: typeof counts[number]) => boolean) =>
    counts.filter(f).reduce((a, r) => a + r.n, 0);
  const smsCredits = counts.filter((r) => r.channel === "SMS").reduce((a, r) => a + r.credits, 0);
  const failed = sum((r) => r.status === "HATA");
  const kuyrukta = sum((r) => r.status === "KUYRUKTA");

  return (
    <div className="space-y-5">
      <PageHeader
        title="SMS / e-posta giden kutusu"
        subtitle={`${total} bildirim${gm ? " — tüm fabrikalar" : ` — ${user.factory_name}`}`}
        actions={
          <div className="flex flex-wrap items-center gap-1.5">
            {/* Kanal süzgeci: kaldırılan Filtreler kutusunun karşılığı. */}
            {([["SMS", "SMS"], ["EPOSTA", "E-posta"]] as const).map(([deger, etiket]) => (
              <Link key={deger}
                    href={suzgec({ kanal: q.kanal === deger ? null : deger })}
                    className={`btn btn-sm ${q.kanal === deger ? "btn-primary" : "btn-secondary"}`}>
                {etiket}
              </Link>
            ))}
            {failed > 0 && <RetryButton />}
          </div>
        }
      />

      {/*
        Simülasyon uyarısı tek satıra indi. Kurulum yönergesi (.env.local,
        SMS_PROVIDER, sağlayıcı adları) bu ekranı her gün açan Kalite
        Sorumlusunu ilgilendirmiyor; sistem yöneticisi aynı bilgiyi Tanımlar
        sayfasında bulur. Burada bilinmesi gereken tek şey mesajların
        gerçekten gitmediği.
      */}
      {isSimulation() && (
        <Notice tone="warn">
          Sağlayıcı simülasyon modunda: mesajlar gerçekten gönderilmiyor, yalnızca bu listeye
          yazılıyor.
        </Notice>
      )}

      {/*
        Sayıların kendisi süzgeç. Üç kutu zaten Gönderilen / Hatalı / Kuyrukta
        diye sayıyordu; altlarında aynı üç durumu seçtiren ayrı bir "Filtreler"
        kutusu duruyordu. Kutuya tıklamak artık o durumu süzüyor — iki tıklama
        yerine bir tıklama, bir kutu eksik. Kanal süzgeci başlıktaki iki
        düğmede kaldı.
      */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Gönderilen" value={sum((r) => r.status === "GONDERILDI")}
              tone="ok" href={suzgec({ durum: "GONDERILDI" })} />
        <Stat label="Hatalı" value={failed} tone={failed ? "danger" : "ink"}
              href={suzgec({ durum: "HATA" })} />
        <Stat label="Kuyrukta" value={kuyrukta} tone={kuyrukta ? "warn" : "ink"}
              href={suzgec({ durum: "KUYRUKTA" })} />
        <Stat label="SMS kredisi" value={smsCredits} hint="Operatörün ücretlendireceği mesaj adedi" />
      </div>

      {(q.kanal || q.durum) && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-ink-500">Süzgeç:</span>
          {q.durum && (
            <Link href={suzgec({ durum: null })} className="chip border-brand-200 bg-brand-50 text-brand-700 hover:bg-brand-100">
              {DURUM_ETIKET[q.durum] ?? q.durum} ✕
            </Link>
          )}
          {q.kanal && (
            <Link href={suzgec({ kanal: null })} className="chip border-brand-200 bg-brand-50 text-brand-700 hover:bg-brand-100">
              {q.kanal === "SMS" ? "SMS" : "E-posta"} ✕
            </Link>
          )}
        </div>
      )}

      <Card bodyClass="">
        {rows.length === 0 ? (
          <EmptyState title="Bildirim yok" />
        ) : (
          <ul className="divide-y divide-ink-100">
            {rows.map((n) => (
              <li key={n.id} className="px-4 py-3">
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
                  {n.complaint_no && n.complaint_id && (
                    <Link href={`/panel/sikayet/${n.complaint_id}`}
                          className="inline-flex min-h-6 items-center font-mono text-xs text-brand-700 hover:underline">
                      {n.complaint_no}
                    </Link>
                  )}
                  {n.factory_short && <span className="text-xs text-ink-500">{n.factory_short}</span>}
                  <span className="tnum text-xs text-ink-500">{n.recipient}</span>
                  <span className="tnum text-xs text-ink-500">{fmtDateTime(n.created_at)}</span>
                  {n.channel === "SMS" && <span className="text-xs text-ink-500">{n.segments} kredi</span>}
                  {n.provider && <span className="text-xs text-ink-400">{n.provider}</span>}
                  {n.status === "HATA" && <RetryButton notificationId={n.id} />}
                </div>
                {n.subject && <p className="mt-1 text-sm font-medium text-ink-800">{n.subject}</p>}
                {/* Gövde katlı durur. Bu sayfa gönderilenin kanıtıdır, okuma
                    listesi değil: elli bildirimin tam e-posta metni açıkken
                    liste dar ekranda on binlerce piksel uzuyor ve hangi
                    bildirimin nerede bittiği görünmüyordu. */}
                <details className="group mt-0.5">
                  <summary className="flex min-h-8 cursor-pointer list-none items-center gap-1.5 text-sm text-ink-600">
                    <span className="min-w-0 flex-1 truncate">{n.body}</span>
                    <span aria-hidden className="shrink-0 text-xs text-ink-400 transition-transform group-open:rotate-180">▾</span>
                    <span className="sr-only">Mesajın tamamını göster</span>
                  </summary>
                  <p className="mt-1 text-sm leading-relaxed break-words whitespace-pre-wrap text-ink-600">{n.body}</p>
                </details>
                {n.error && <p className="mt-1 text-xs break-words text-danger-700">Hata: {n.error}</p>}
              </li>
            ))}
          </ul>
        )}
        {total > size && (
          <div className="flex items-center justify-between gap-2 border-t border-ink-200 px-4 py-2.5">
            <p className="text-xs text-ink-500">Sayfa {page} / {Math.ceil(total / size)}</p>
            <div className="flex gap-2">
              {page > 1 && (
                <Link href={`/panel/bildirimler?s=${page - 1}`} className="btn btn-secondary btn-sm">← Önceki</Link>
              )}
              {page * size < total && (
                <Link href={`/panel/bildirimler?s=${page + 1}`} className="btn btn-secondary btn-sm">Sonraki →</Link>
              )}
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
