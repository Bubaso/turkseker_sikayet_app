import Link from "next/link";
import { all } from "@/lib/db";
import { isGmRole } from "@/lib/roles";
import {
  DAY_NAMES_TR, daysInMonth, fmtDate, isWeekend, monthName, today, weekday,
} from "@/lib/dates";
import {requirePageUser} from "@/server/auth";
import { openTasksFor } from "@/server/tasks";
import { holidaySet } from "@/server/settings";
import { Card, Chip, PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";

/** Aylık takvim — görev son tarihleri, resmî tatiller ve şikâyet giriş günleri. */
export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ y?: string; a?: string }>;
}) {
  const sp = await searchParams;
  const user = await requirePageUser();
  const gm = isGmRole(user.role) || user.role === "SISTEM_YONETICISI";
  const holidays = holidaySet();
  const ref = today();

  const year = Number(sp.y ?? ref.slice(0, 4));
  const month = Number(sp.a ?? ref.slice(5, 7));
  const days = daysInMonth(year, month);
  const first = days[0]!;
  const last = days[days.length - 1]!;

  const tasks = openTasksFor(gm ? null : user.factory_id, 1000)
    .filter((t) => t.due_at && t.due_at >= first && t.due_at <= last);

  const received = all<{ received_at: string; complaint_no: string; id: number; customer_company: string }>(
    `SELECT id, received_at, complaint_no, customer_company FROM complaints
      WHERE received_at BETWEEN ? AND ? ${gm ? "" : `AND factory_id = ${Number(user.factory_id ?? -1)}`}
      ORDER BY received_at`,
    first, last,
  );

  const holidayNames = Object.fromEntries(
    all<{ date: string; name: string }>(
      "SELECT date, name FROM holidays WHERE date BETWEEN ? AND ?", first, last,
    ).map((h) => [h.date, h.name]),
  );

  // Haftanın Pazartesi başlamasına göre baştaki boş hücreler
  const lead = (weekday(first) + 6) % 7;

  const prevMonth = month === 1 ? { y: year - 1, a: 12 } : { y: year, a: month - 1 };
  const nextMonth = month === 12 ? { y: year + 1, a: 1 } : { y: year, a: month + 1 };

  return (
    <div className="space-y-5">
      <PageHeader
        title={`${monthName(month)} ${year}`}
        subtitle={`${tasks.length} görev son tarihi · ${received.length} yeni şikâyet · ${
          Object.keys(holidayNames).length
        } resmî tatil`}
        actions={
          <div className="flex items-center gap-2">
            <Link href={`/panel/takvim?y=${prevMonth.y}&a=${prevMonth.a}`} className="btn btn-secondary btn-sm">
              ← {monthName(prevMonth.a)}
            </Link>
            <Link href="/panel/takvim" className="btn btn-secondary btn-sm">Bugün</Link>
            <Link href={`/panel/takvim?y=${nextMonth.y}&a=${nextMonth.a}`} className="btn btn-secondary btn-sm">
              {monthName(nextMonth.a)} →
            </Link>
          </div>
        }
      />

      <Card bodyClass="p-2 sm:p-3">
        <div className="grid grid-cols-7 gap-1.5 text-center text-xs font-semibold text-ink-500">
          {DAY_NAMES_TR.slice(1).concat(DAY_NAMES_TR[0]!).map((d) => (
            <div key={d} className="py-1">{d.slice(0, 3)}</div>
          ))}
        </div>
        <div className="mt-1 grid grid-cols-7 gap-1.5">
          {Array.from({ length: lead }).map((_, i) => <div key={`bos-${i}`} />)}
          {days.map((d) => {
            const dayTasks = tasks.filter((t) => t.due_at === d);
            const dayNew = received.filter((r) => r.received_at === d);
            const hol = holidayNames[d];
            const isToday = d === ref;
            const past = d < ref;
            const overdueHere = past && dayTasks.length > 0;

            return (
              <div
                key={d}
                className={
                  "min-h-24 rounded-[5px] border p-1.5 text-left " +
                  (isToday ? "border-brand-500 bg-brand-50"
                    : hol ? "border-warn-200 bg-warn-50"
                    : isWeekend(d) ? "border-ink-200 bg-ink-50"
                    : "border-ink-200 bg-white")
                }
              >
                <div className="flex items-start justify-between gap-1">
                  <span className={`tnum text-xs font-semibold ${isToday ? "text-brand-700" : "text-ink-700"}`}>
                    {Number(d.slice(8))}
                  </span>
                  {overdueHere && <Chip tone="danger">!</Chip>}
                </div>
                {hol && <p className="mt-0.5 text-[10px] leading-tight text-warn-700">{hol}</p>}
                {dayNew.length > 0 && (
                  <p className="mt-0.5 text-[10px] text-info-600">{dayNew.length} yeni şikâyet</p>
                )}
                <ul className="mt-1 space-y-0.5">
                  {dayTasks.slice(0, 3).map((t) => (
                    <li key={t.id}>
                      <Link href={`/panel/sikayet/${t.complaint_id}?sekme=islemler`}
                            className={`block truncate rounded px-1 py-0.5 text-[10px] leading-tight ${
                              past ? "bg-danger-50 text-danger-700" : "bg-ink-100 text-ink-700"
                            } hover:bg-brand-100`}
                            title={`${t.title} — ${t.complaint_no} — ${t.assignee_name ?? "atanmadı"}`}>
                        {t.title}
                      </Link>
                    </li>
                  ))}
                  {dayTasks.length > 3 && (
                    <li className="px-1 text-[10px] text-ink-500">+{dayTasks.length - 3} görev daha</li>
                  )}
                </ul>
              </div>
            );
          })}
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Card title="Bu ayın resmî tatilleri" bodyClass="">
          {Object.keys(holidayNames).length === 0 ? (
            <p className="px-4 py-3 text-sm text-ink-500">Bu ayda resmî tatil yok.</p>
          ) : (
            <ul className="divide-y divide-ink-100">
              {Object.entries(holidayNames).map(([d, name]) => (
                <li key={d} className="flex items-center justify-between gap-2 px-4 py-2 text-sm">
                  <span className="tnum text-ink-600">{fmtDate(d)}</span>
                  <span className="text-ink-800">{name}</span>
                </li>
              ))}
            </ul>
          )}
          <p className="border-t border-ink-100 px-4 py-2 text-xs text-ink-500">
            Resmî tatiller ve hafta sonları iş günü SLA hesabından düşülür. Dinî bayram tarihleri
            Tanımlar sayfasından güncellenebilir.
          </p>
        </Card>

        <Card title="Bu ay gelen şikâyetler" bodyClass="">
          {received.length === 0 ? (
            <p className="px-4 py-3 text-sm text-ink-500">Bu ayda şikâyet kaydı yok.</p>
          ) : (
            <ul className="max-h-64 divide-y divide-ink-100 overflow-y-auto">
              {received.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-2 px-4 py-2 text-sm">
                  <Link href={`/panel/sikayet/${r.id}`} className="font-mono text-xs text-brand-700 hover:underline">
                    {r.complaint_no}
                  </Link>
                  <span className="min-w-0 flex-1 truncate text-ink-700">{r.customer_company}</span>
                  <span className="tnum text-xs text-ink-500">{fmtDate(r.received_at)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
