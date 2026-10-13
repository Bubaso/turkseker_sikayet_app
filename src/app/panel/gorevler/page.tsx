import Link from "next/link";
import { isGmRole } from "@/lib/roles";
import { fmtDate, slaInfo, today } from "@/lib/dates";
import { TASK_CATALOG, type TaskCode } from "@/lib/workflow";
import {requirePageUser} from "@/server/auth";
import { myTasks, openTasksFor } from "@/server/tasks";
import { holidaySet } from "@/server/settings";
import { Card, Chip, EmptyState, PageHeader, SlaChip, StatusChip, TaskStatusChip } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function TasksPage({
  searchParams,
}: {
  searchParams: Promise<{ kapsam?: string }>;
}) {
  const { kapsam } = await searchParams;
  const user = await requirePageUser();
  const gm = isGmRole(user.role) || user.role === "SISTEM_YONETICISI";
  const holidays = holidaySet();
  const scope = kapsam === "fabrika" ? "fabrika" : "bana";

  const rows = scope === "fabrika"
    ? openTasksFor(gm ? null : user.factory_id, 300)
    : myTasks(user, { onlyOpen: true });

  const ref = today();
  const overdue = rows.filter((t) => t.due_at && t.due_at < ref);
  const todayDue = rows.filter((t) => t.due_at === ref);
  const upcoming = rows.filter((t) => !t.due_at || t.due_at > ref);

  function group(title: string, list: typeof rows, tone: "danger" | "warn" | "ink") {
    if (list.length === 0) return null;
    return (
      <Card key={title} title={<span className="flex items-center gap-2">{title}<Chip tone={tone}>{list.length}</Chip></span>} bodyClass="">
        <div className="table-wrap">
          <table className="tbl">
            <thead>
              <tr>
                <th>Görev</th><th>Şikâyet</th><th>Müşteri</th>
                {scope === "fabrika" && <th>Sorumlu</th>}
                <th>Son tarih</th><th>SLA</th><th>Durum</th><th>Dosya durumu</th>
              </tr>
            </thead>
            <tbody>
              {list.map((t) => {
                const sla = slaInfo(t.due_at, null, holidays);
                const tpl = TASK_CATALOG[t.code as TaskCode];
                return (
                  <tr key={t.id}>
                    <td className="max-w-[18rem]">
                      <Link href={`/panel/sikayet/${t.complaint_id}?sekme=islemler`}
                            className="font-medium text-ink-800 hover:text-brand-700 hover:underline">
                        {t.title}
                      </Link>
                      {tpl?.basis && <span className="block text-xs text-ink-500">{tpl.basis}</span>}
                    </td>
                    <td className="whitespace-nowrap">
                      <Link href={`/panel/sikayet/${t.complaint_id}`} className="font-mono text-xs text-brand-700 hover:underline">
                        {t.complaint_no}
                      </Link>
                      {t.factory_short && <span className="block text-xs text-ink-500">{t.factory_short}</span>}
                    </td>
                    <td className="max-w-[14rem] truncate text-ink-700">{t.customer_company}</td>
                    {scope === "fabrika" && (
                      <td className="text-ink-600">
                        {t.assignee_name ?? <span className="text-ink-400">atanmadı</span>}
                      </td>
                    )}
                    <td className="tnum whitespace-nowrap">{fmtDate(t.due_at)}</td>
                    <td><SlaChip sla={sla} compact /></td>
                    <td><TaskStatusChip status={t.status} /></td>
                    <td><StatusChip status={t.complaint_status} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title={scope === "bana" ? "Görevlerim" : gm ? "Tüm açık görevler" : `${user.factory_name} açık görevleri`}
        subtitle={`${rows.length} açık görev · ${overdue.length} gecikmede`}
        actions={
          <div className="flex gap-2">
            <Link href="/panel/gorevler"
                  className={`btn btn-sm ${scope === "bana" ? "btn-primary" : "btn-secondary"}`}>
              Bana atananlar
            </Link>
            <Link href="/panel/gorevler?kapsam=fabrika"
                  className={`btn btn-sm ${scope === "fabrika" ? "btn-primary" : "btn-secondary"}`}>
              {gm ? "Tüm fabrikalar" : "Fabrikanın tamamı"}
            </Link>
          </div>
        }
      />

      {rows.length === 0 ? (
        <Card>
          <EmptyState
            title="Açık görev yok"
            hint={scope === "bana"
              ? "Size atanmış bekleyen görev bulunmuyor. Yeni bir şikâyet geldiğinde veya imza sırası size ulaştığında burada görünür."
              : "Bu kapsamda açık görev bulunmuyor."}
          />
        </Card>
      ) : (
        <>
          {group("Gecikmiş görevler", overdue, "danger")}
          {group("Son günü bugün", todayDue, "warn")}
          {group("Yaklaşan görevler", upcoming, "ink")}
        </>
      )}
    </div>
  );
}
