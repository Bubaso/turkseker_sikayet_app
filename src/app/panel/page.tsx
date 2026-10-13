import Link from "next/link";
import { isGmRole } from "@/lib/roles";
import { fmtDate, slaInfo } from "@/lib/dates";
import { STATUS_LABEL, type Status } from "@/lib/domain";
import { all, scalar } from "@/lib/db";
import {requirePageUser} from "@/server/auth";
import { listComplaints } from "@/server/complaints";
import { myTasks } from "@/server/tasks";
import { dashboardStats, nextDue } from "@/server/stats";
import { holidaySet } from "@/server/settings";
import { Card, EmptyState, Notice, PageHeader, SlaChip, Stat, StatusChip } from "@/components/ui";
import { ComplaintTable, type TableRowExtra } from "@/components/complaint-table";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await requirePageUser();
  const gm = isGmRole(user.role) || user.role === "SISTEM_YONETICISI";
  const factoryId = gm ? null : user.factory_id;
  const holidays = holidaySet();

  const stats = dashboardStats(factoryId);
  const tasks = myTasks(user, { onlyOpen: true, limit: 8 });
  const recent = listComplaints({ factoryId, limit: 8, orderBy: "received_desc" });
  const extras: Record<number, TableRowExtra> = {};
  for (const c of recent) {
    const d = nextDue(c.id);
    extras[c.id] = { nextDue: d.due_at, nextTitle: d.title };
  }

  const totalComplaints = scalar<number>("SELECT COUNT(*) FROM complaints") ?? 0;
  const statusMix = all<{ status: string; n: number }>(
    `SELECT status, COUNT(*) AS n FROM complaints
      WHERE status NOT IN ('KAPANDI','REDDEDILDI','IPTAL')
        ${factoryId ? `AND factory_id = ${Number(factoryId)}` : ""}
      GROUP BY status ORDER BY n DESC`,
  );

  return (
    <div className="space-y-5">
      <PageHeader
        title={`Merhaba, ${user.full_name.split(" ")[0]}`}
        subtitle={
          gm
            ? `${user.department_name ?? "Genel Müdürlük"} — 14 fabrikanın tüm şikâyet dosyaları`
            : `${user.factory_name} — ${user.title}`
        }
        actions={
          !gm && (
            <Link href="/panel/sikayetler/yeni" className="btn btn-primary btn-sm">
              Elden şikâyet kaydet
            </Link>
          )
        }
      />

      {totalComplaints === 0 && (
        <Notice tone="info" title="Henüz şikâyet kaydı yok">
          Sistemi denemek için <Link href="/sikayet/yeni" className="link">halka açık şikâyet
          formundan</Link> kayıt açabilir ya da{" "}
          {user.role === "SISTEM_YONETICISI" ? (
            <><Link href="/panel/tanimlar" className="link">Tanımlar</Link> sayfasından örnek demo
            verisi üretebilirsiniz.</>
          ) : (
            <>sistem yöneticisinden örnek demo verisi üretmesini isteyebilirsiniz.</>
          )}
        </Notice>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Açık dosya" value={stats.openCount} href="/panel/sikayetler" />
        <Stat label="Geciken dosya" value={stats.overdueCount} tone={stats.overdueCount ? "danger" : "ink"}
              href="/panel/sikayetler?gecikme=1" hint="SLA süresi aşılmış" />
        <Stat label="Son 7 günde gelen" value={stats.newThisWeek} tone="brand" />
        <Stat label="Bu ay kapanan" value={stats.closedThisMonth} tone="ok" />
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Ekip bekleyen" value={stats.awaitingTeam} tone={stats.awaitingTeam ? "warn" : "ink"}
              hint="1 iş günü içinde kurulmalı" />
        <Stat label="İmza bekleyen belge" value={stats.awaitingSignature}
              href={gm ? undefined : "/panel/belgeler"} />
        <Stat label="İtiraz değerlendirmede" value={stats.inEscalation}
              tone={stats.inEscalation ? "warn" : "ink"} href="/panel/itirazlar" />
        <Stat label="Gıda güvenliği ihbarı" value={stats.criticalOpen}
              tone={stats.criticalOpen ? "danger" : "ink"} hint="Açık kritik dosya" />
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        <Card title="Görevlerim" className="xl:col-span-2"
              actions={<Link href="/panel/gorevler" className="btn btn-ghost btn-sm">Tümü →</Link>}
              bodyClass="">
          {tasks.length === 0 ? (
            <EmptyState title="Size atanmış açık görev yok"
                        hint="Yeni bir şikâyet geldiğinde veya sıra size ulaştığında burada görünür." />
          ) : (
            <ul className="divide-y divide-ink-100">
              {tasks.map((t) => {
                const sla = slaInfo(t.due_at, null, holidays);
                return (
                  <li key={t.id} className="flex flex-wrap items-start justify-between gap-2 px-4 py-2.5">
                    <div className="min-w-0 flex-1">
                      <Link href={`/panel/sikayet/${t.complaint_id}`}
                            className="text-sm font-medium text-ink-800 hover:text-brand-700 hover:underline">
                        {t.title}
                      </Link>
                      <p className="text-xs text-ink-500">
                        <span className="font-mono">{t.complaint_no}</span> · {t.customer_company}
                        {t.factory_short && ` · ${t.factory_short}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="tnum text-xs text-ink-500">{fmtDate(t.due_at)}</span>
                      <SlaChip sla={sla} compact />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <Card title="Açık dosyaların durumu" bodyClass="">
          {statusMix.length === 0 ? (
            <EmptyState title="Açık dosya yok" />
          ) : (
            <ul className="divide-y divide-ink-100">
              {statusMix.map((s) => (
                <li key={s.status} className="flex items-center justify-between gap-2 px-4 py-2.5">
                  <Link href={`/panel/sikayetler?durum=${s.status}`} className="min-w-0">
                    <StatusChip status={s.status} />
                  </Link>
                  <span className="tnum text-sm font-semibold text-ink-800">{s.n}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card title="Son gelen şikâyetler"
            actions={<Link href="/panel/sikayetler" className="btn btn-ghost btn-sm">Tümü →</Link>}
            bodyClass="">
        <ComplaintTable rows={recent} extras={extras} holidays={holidays} showFactory={gm}
                        emptyHint="Henüz şikâyet kaydı oluşturulmamış." />
      </Card>
    </div>
  );
}
