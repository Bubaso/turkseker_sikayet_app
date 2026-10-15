import Link from "next/link";
import { all, scalar } from "@/lib/db";
import { isGmRole } from "@/lib/roles";
import { fmtDateTime } from "@/lib/dates";
import {requirePageUser} from "@/server/auth";
import { TEMPLATE_LABEL, type TemplateCode } from "@/server/notify";
import { isSimulation, smsProvider, mailProvider } from "@/server/providers";
import type { NotificationView } from "@/lib/types";
import { Card, Chip, EmptyState, Notice, PageHeader, Stat } from "@/components/ui";
import { RetryButton } from "./retry";

export const dynamic = "force-dynamic";

/** SMS ve e-posta giden kutusu. */
export default async function OutboxPage({
  searchParams,
}: {
  searchParams: Promise<{ kanal?: string; durum?: string; s?: string }>;
}) {
  const q = await searchParams;
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
        actions={failed > 0 ? <RetryButton /> : undefined}
      />

      {isSimulation() && (
        <Notice tone="warn" title="Sağlayıcı simülasyon modunda">
          SMS ve e-postalar gerçekten gönderilmiyor; yalnızca bu listeye yazılıyor. Canlıya geçmek
          için <code className="rounded bg-white px-1 py-0.5 text-xs">.env.local</code> dosyasında{" "}
          <code className="rounded bg-white px-1 py-0.5 text-xs">SMS_PROVIDER</code> değerini{" "}
          <code className="rounded bg-white px-1 py-0.5 text-xs">netgsm</code> veya{" "}
          <code className="rounded bg-white px-1 py-0.5 text-xs">iletimerkezi</code> yapıp API
          bilgilerini girin. Aktif sağlayıcılar: SMS <strong>{smsProvider().name}</strong>, e-posta{" "}
          <strong>{mailProvider().name}</strong>.
        </Notice>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Gönderilen" value={sum((r) => r.status === "GONDERILDI")} tone="ok" />
        <Stat label="Hatalı" value={failed} tone={failed ? "danger" : "ink"} />
        <Stat label="Kuyrukta" value={kuyrukta} tone={kuyrukta ? "warn" : "ink"} />
        <Stat label="SMS kredisi" value={smsCredits} hint="Operatörün ücretlendireceği mesaj adedi" />
      </div>

      <Card title="Filtreler" bodyClass="p-3.5">
        <form method="get" className="flex flex-wrap items-end gap-3">
          <div>
            <label className="label" htmlFor="kanal">Kanal</label>
            <select id="kanal" name="kanal" defaultValue={q.kanal ?? ""} className="input">
              <option value="">Tümü</option>
              <option value="SMS">SMS</option>
              <option value="EPOSTA">E-posta</option>
            </select>
          </div>
          <div>
            <label className="label" htmlFor="durum">Durum</label>
            <select id="durum" name="durum" defaultValue={q.durum ?? ""} className="input">
              <option value="">Tümü</option>
              <option value="GONDERILDI">Gönderildi</option>
              <option value="HATA">Hata</option>
              <option value="KUYRUKTA">Kuyrukta</option>
            </select>
          </div>
          <button type="submit" className="btn btn-primary">Filtrele</button>
          <Link href="/panel/bildirimler" className="btn btn-secondary">Temizle</Link>
        </form>
      </Card>

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
                          className="font-mono text-xs text-brand-700 hover:underline">
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
                <p className="mt-0.5 text-sm leading-relaxed whitespace-pre-wrap text-ink-600">{n.body}</p>
                {n.error && <p className="mt-1 text-xs text-danger-700">Hata: {n.error}</p>}
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
