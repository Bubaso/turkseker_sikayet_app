import Link from "next/link";
import { isGmRole } from "@/lib/roles";
import { fmtDate, slaInfo, today } from "@/lib/dates";
import { ASAMALAR, type AsamaKodu } from "@/lib/asamalar";
import { requirePageUser } from "@/server/auth";
import { benimAsamalarim, fabrikaAcikAsamalari } from "@/server/asamalar-db";
import { holidaySet } from "@/server/settings";
import { Card, Chip, EmptyState, PageHeader, SlaChip, StatusChip } from "@/components/ui";
import type { TaskView } from "@/lib/types";

export const dynamic = "force-dynamic";

/** Üzerinde bekleyen aşamalar — "şimdi ne yapmam gerekiyor" sorusunun yanıtı. */
export default async function TasksPage({
  searchParams,
}: {
  searchParams: Promise<{ kapsam?: string }>;
}) {
  const { kapsam } = await searchParams;
  const user = await requirePageUser();
  const gm = isGmRole(user.role) || user.role === "SISTEM_YONETICISI";
  const holidays = holidaySet();
  const kapsamAdi = kapsam === "fabrika" ? "fabrika" : "bana";

  const rows = kapsamAdi === "fabrika"
    ? fabrikaAcikAsamalari(gm ? null : user.factory_id, 300)
    : benimAsamalarim(user);

  const ref = today();
  const geciken = rows.filter((t) => t.due_at && t.due_at < ref);
  const bugun = rows.filter((t) => t.due_at === ref);
  const yaklasan = rows.filter((t) => !t.due_at || t.due_at > ref);

  function grup(title: string, list: TaskView[], tone: "danger" | "warn" | "ink") {
    if (list.length === 0) return null;
    return (
      <Card
        key={title}
        title={<span className="flex items-center gap-2">{title}<Chip tone={tone}>{list.length}</Chip></span>}
        bodyClass=""
      >
        <div className="table-wrap">
          <table className="tbl">
            <thead>
              <tr>
                <th>Aşama</th><th>Şikâyet</th><th>Müşteri</th>
                {kapsamAdi === "fabrika" && <th>Sorumlu</th>}
                <th>Son tarih</th><th>SLA</th><th>Dosya durumu</th>
              </tr>
            </thead>
            <tbody>
              {list.map((t) => {
                const a = ASAMALAR[t.code as AsamaKodu];
                return (
                  <tr key={t.id}>
                    <td className="max-w-[20rem]">
                      <Link href={`/panel/sikayet/${t.complaint_id}`}
                            className="font-medium text-ink-800 hover:text-brand-700 hover:underline">
                        {t.title}
                      </Link>
                      <span className="block text-xs text-ink-500">
                        {a?.belgeli ? `Belge yüklenir — ${a.belgeAdi}` : (a?.dayanak ?? "")}
                      </span>
                    </td>
                    <td className="whitespace-nowrap">
                      <Link href={`/panel/sikayet/${t.complaint_id}`}
                            className="font-mono text-xs text-brand-700 hover:underline">
                        {t.complaint_no}
                      </Link>
                      {t.factory_short && <span className="block text-xs text-ink-500">{t.factory_short}</span>}
                    </td>
                    <td className="max-w-[14rem] truncate text-ink-700">{t.customer_company}</td>
                    {kapsamAdi === "fabrika" && (
                      <td className="text-ink-600">
                        {t.assignee_name ?? <span className="text-ink-400">atanmadı</span>}
                      </td>
                    )}
                    <td className="tnum whitespace-nowrap">{fmtDate(t.due_at)}</td>
                    <td><SlaChip sla={slaInfo(t.due_at, null, holidays)} compact /></td>
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
        title={
          kapsamAdi === "bana"
            ? "Bana düşen aşamalar"
            : gm ? "Tüm açık aşamalar" : `${user.factory_name} açık aşamaları`
        }
        subtitle={`${rows.length} açık aşama · ${geciken.length} gecikmede`}
        actions={
          <div className="flex gap-2">
            <Link href="/panel/gorevler"
                  className={`btn btn-sm ${kapsamAdi === "bana" ? "btn-primary" : "btn-secondary"}`}>
              Bana düşenler
            </Link>
            <Link href="/panel/gorevler?kapsam=fabrika"
                  className={`btn btn-sm ${kapsamAdi === "fabrika" ? "btn-primary" : "btn-secondary"}`}>
              {gm ? "Tüm fabrikalar" : "Fabrikanın tamamı"}
            </Link>
          </div>
        }
      />

      {rows.length === 0 ? (
        <Card>
          <EmptyState
            title="Açık aşama yok"
            hint={kapsamAdi === "bana"
              ? "Size düşen bekleyen bir aşama bulunmuyor. Yeni bir şikâyet geldiğinde ya da sıra size ulaştığında burada görünür."
              : "Bu kapsamda açık aşama bulunmuyor."}
          />
        </Card>
      ) : (
        <>
          {grup("Gecikmiş aşamalar", geciken, "danger")}
          {grup("Son günü bugün", bugun, "warn")}
          {grup("Yaklaşan aşamalar", yaklasan, "ink")}
        </>
      )}
    </div>
  );
}
