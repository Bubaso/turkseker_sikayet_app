import Link from "next/link";
import { all } from "@/lib/db";
import { isGmRole } from "@/lib/roles";
import {
  DAY_SHORT_TR, daysInMonth, fmtDate, isWeekend, monthName, today, weekday,
} from "@/lib/dates";
import {requirePageUser} from "@/server/auth";
import { fabrikaAcikAsamalari } from "@/server/asamalar-db";
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

  const tasks = fabrikaAcikAsamalari(gm ? null : user.factory_id, 1000)
    .filter((t) => t.due_at && t.due_at >= first && t.due_at <= last);

  // Dar ekrandaki liste için: ayın aşamaları tarih sırasına dizilir.
  const aylikAsamalar = [...tasks].sort((a, b) => (a.due_at! < b.due_at! ? -1 : 1));

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
        subtitle={`${tasks.length} aşama son tarihi · ${received.length} yeni şikâyet · ${
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
          {DAY_SHORT_TR.slice(1).concat(DAY_SHORT_TR[0]!).map((d) => (
            <div key={d} className="py-1">{d}</div>
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
            const ozet = [
              hol,
              dayNew.length > 0 ? `${dayNew.length} yeni şikâyet` : null,
              dayTasks.length > 0
                ? `${dayTasks.length} aşama son tarihi${overdueHere ? " (gecikmiş)" : ""}`
                : null,
            ].filter((x): x is string => !!x);

            return (
              <div
                key={d}
                title={ozet.length > 0 ? `${fmtDate(d)} — ${ozet.join(" · ")}` : undefined}
                className={
                  "min-h-14 overflow-hidden rounded-[5px] border p-1.5 text-left sm:min-h-24 " +
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
                  <span className="hidden sm:block">
                    {overdueHere && <Chip tone="danger">!</Chip>}
                  </span>
                </div>

                {/*
                 * Dar ekranda yedi sütunluk ızgarada hücre ~50px kalır ve
                 * başlıklar sütunun dışına taşardı. Orada hücre bir özettir:
                 * ne olduğunu renkli noktalar söyler, ayrıntı aşağıdaki
                 * listelerde durur. Geniş ekranda başlıklar görünür.
                 */}
                <div className="mt-1 flex flex-wrap gap-0.5 sm:hidden" aria-hidden>
                  {hol && <span className="size-1.5 rounded-full bg-warn-600" />}
                  {dayNew.length > 0 && <span className="size-1.5 rounded-full bg-info-600" />}
                  {dayTasks.length > 0 && (
                    <span className={`size-1.5 rounded-full ${past ? "bg-danger-600" : "bg-ink-400"}`} />
                  )}
                </div>
                <span className="sr-only">{ozet.join(", ")}</span>

                <div className="hidden sm:block">
                  {hol && <p className="mt-0.5 text-mini leading-tight text-warn-700">{hol}</p>}
                  {dayNew.length > 0 && (
                    <p className="mt-0.5 text-mini text-info-600">{dayNew.length} yeni şikâyet</p>
                  )}
                  <ul className="mt-1 space-y-0.5">
                    {dayTasks.slice(0, 3).map((t) => (
                      <li key={t.id}>
                        <Link href={`/panel/sikayet/${t.complaint_id}`}
                              className={`block truncate rounded px-1 py-0.5 text-mini leading-tight ${
                                past ? "bg-danger-50 text-danger-700" : "bg-ink-100 text-ink-700"
                              } hover:bg-brand-100`}
                              title={`${t.title} — ${t.complaint_no} — ${t.assignee_name ?? "atanmadı"}`}>
                          {t.title}
                        </Link>
                      </li>
                    ))}
                    {dayTasks.length > 3 && (
                      <li className="px-1 text-mini text-ink-500">+{dayTasks.length - 3} aşama daha</li>
                    )}
                  </ul>
                </div>
              </div>
            );
          })}
        </div>

        {/* Nokta kodunun karşılığı. Yalnızca dar ekranda gerekir: geniş
            ekranda hücre neyi gösterdiğini zaten yazıyor. */}
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-ink-500 sm:hidden">
          <span className="flex items-center gap-1.5">
            <span className="size-1.5 rounded-full bg-info-600" aria-hidden /> yeni şikâyet
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-1.5 rounded-full bg-ink-400" aria-hidden /> aşama son tarihi
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-1.5 rounded-full bg-danger-600" aria-hidden /> gecikmiş
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-1.5 rounded-full bg-warn-600" aria-hidden /> resmî tatil
          </span>
        </div>
      </Card>

      {/*
       * Aşama son tarihleri yalnızca dar ekranda liste olarak çizilir: geniş
       * ekranda aynı bilgi ızgaranın hücrelerinde zaten yazılı ve iki yerde
       * birden durması gereksiz tekrar olur. Dar ekranda ızgara yalnızca
       * "ne zaman" diyor, bu liste "ne" diyor.
       */}
      <div className="sm:hidden">
        <Card title="Bu ayın aşama son tarihleri" bodyClass="">
          {aylikAsamalar.length === 0 ? (
            <p className="px-4 py-3 text-sm text-ink-500">Bu ayda son tarihi olan aşama yok.</p>
          ) : (
            <ul className="divide-y divide-ink-100">
              {aylikAsamalar.map((t) => (
                <li key={t.id}>
                  <Link href={`/panel/sikayet/${t.complaint_id}`}
                        className="flex min-h-11 items-start gap-3 px-4 py-2.5 transition-colors active:bg-brand-50">
                    <span className={`tnum shrink-0 pt-0.5 text-xs font-semibold ${
                      t.due_at! < ref ? "text-danger-700" : "text-ink-600"
                    }`}>
                      {Number(t.due_at!.slice(8))}.{t.due_at!.slice(5, 7)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm break-words text-ink-800">{t.title}</span>
                      <span className="block text-xs text-ink-500">
                        {t.complaint_no}
                        {t.assignee_name ? ` · ${t.assignee_name}` : ""}
                      </span>
                    </span>
                    {t.due_at! < ref && <Chip tone="danger">Gecikmiş</Chip>}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

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
                <li key={r.id}>
                  {/* Satırın tamamı dokunma hedefidir: küçük bir şikâyet
                      numarasına nişan almak gerekmez. */}
                  <Link href={`/panel/sikayet/${r.id}`}
                        className="flex min-h-11 items-center justify-between gap-2 px-4 py-2 text-sm transition-colors hover:bg-brand-50/45 active:bg-brand-50">
                    <span className="font-mono text-xs text-brand-700">{r.complaint_no}</span>
                    <span className="min-w-0 flex-1 truncate text-ink-700">{r.customer_company}</span>
                    <span className="tnum text-xs text-ink-500">{fmtDate(r.received_at)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
