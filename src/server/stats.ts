/* ===========================================================================
   Performans ve pano istatistikleri.
   =========================================================================== */

import { all, one, scalar } from "@/lib/db";
import { businessDaysBetween, dayOf, today } from "@/lib/dates";
import { holidaySet } from "./settings";

export interface DashboardStats {
  openCount: number;
  overdueCount: number;
  newThisWeek: number;
  closedThisMonth: number;
  awaitingTeam: number;
  /** Belge yüklenmesi beklenen açık dosya sayısı. */
  belgeBekleyen: number;
  inEscalation: number;
  criticalOpen: number;
}

function scope(factoryId: number | null): string {
  return factoryId ? `AND c.factory_id = ${Number(factoryId)}` : "";
}

export function dashboardStats(factoryId: number | null): DashboardStats {
  const s = scope(factoryId);
  const n = (sql: string) => scalar<number>(sql) ?? 0;
  return {
    openCount: n(`SELECT COUNT(*) FROM complaints c
                   WHERE c.status NOT IN ('KAPANDI','REDDEDILDI','IPTAL') ${s}`),
    overdueCount: n(`SELECT COUNT(DISTINCT c.id) FROM complaints c JOIN tasks t ON t.complaint_id = c.id
                      WHERE c.status NOT IN ('KAPANDI','REDDEDILDI','IPTAL')
                        AND t.status IN ('BEKLEMEDE','DEVAM_EDIYOR')
                        AND t.due_at IS NOT NULL AND t.due_at < date('now') ${s}`),
    newThisWeek: n(`SELECT COUNT(*) FROM complaints c
                     WHERE c.received_at >= date('now','-7 days') ${s}`),
    closedThisMonth: n(`SELECT COUNT(*) FROM complaints c
                         WHERE c.closed_at IS NOT NULL
                           AND strftime('%Y-%m', c.closed_at) = strftime('%Y-%m','now') ${s}`),
    awaitingTeam: n(`SELECT COUNT(*) FROM complaints c
                      WHERE c.team_formed_at IS NULL
                        AND c.status IN ('YENI','YONLENDIRILDI') ${s}`),
    belgeBekleyen: n(`SELECT COUNT(DISTINCT c.id) FROM complaints c JOIN tasks t ON t.complaint_id = c.id
                       WHERE t.status IN ('BEKLEMEDE','DEVAM_EDIYOR')
                         AND t.code IN ('INCELEME','KARAR','ITIRAZ','DAIRE_KARAR','ISLEM','RESMI_YAZI')
                         AND c.status NOT IN ('KAPANDI','REDDEDILDI','IPTAL') ${s}`),
    inEscalation: n(`SELECT COUNT(*) FROM complaints c
                      WHERE c.escalated_at IS NOT NULL AND c.escalation_decided_at IS NULL ${s}`),
    criticalOpen: n(`SELECT COUNT(*) FROM complaints c
                      JOIN complaint_categories cat ON cat.id = c.category_id
                      WHERE cat.is_critical = 1
                        AND c.status NOT IN ('KAPANDI','REDDEDILDI','IPTAL') ${s}`),
  };
}

/* --- Performans panosu --------------------------------------------------- */

export interface PerfRange {
  from: string;
  to: string;
}

export interface FactoryPerf {
  factory_id: number;
  factory: string;
  total: number;
  open: number;
  closed: number;
  justified: number;
  rejected: number;
  overdue_tasks: number;
  total_tasks: number;
  returned_kg: number;
  exchanged_kg: number;
  refund_amount: number;
  freight_amount: number;
  /** SLA'sı süresinde tamamlanan görev oranı (%). */
  sla_rate: number | null;
  /** Ortalama kapanma süresi (iş günü). */
  avg_close_days: number | null;
}

export function factoryPerformance(r: PerfRange, factoryId?: number | null): FactoryPerf[] {
  const holidays = holidaySet();
  const extra = factoryId ? `AND c.factory_id = ${Number(factoryId)}` : "";

  const rows = all<Omit<FactoryPerf, "sla_rate" | "avg_close_days">>(
    `SELECT f.id AS factory_id, f.short_name AS factory,
            COUNT(c.id) AS total,
            SUM(CASE WHEN c.status NOT IN ('KAPANDI','REDDEDILDI','IPTAL') THEN 1 ELSE 0 END) AS open,
            SUM(CASE WHEN c.status IN ('KAPANDI','REDDEDILDI') THEN 1 ELSE 0 END) AS closed,
            SUM(CASE WHEN c.verdict = 'HAKLI' THEN 1 ELSE 0 END) AS justified,
            SUM(CASE WHEN c.verdict = 'HAKSIZ' THEN 1 ELSE 0 END) AS rejected,
            IFNULL(SUM(c.returned_kg), 0) AS returned_kg,
            IFNULL(SUM(c.exchanged_kg), 0) AS exchanged_kg,
            IFNULL(SUM(c.refund_amount), 0) AS refund_amount,
            IFNULL(SUM(c.freight_amount), 0) AS freight_amount,
            (SELECT COUNT(*) FROM tasks t JOIN complaints c2 ON c2.id = t.complaint_id
              WHERE c2.factory_id = f.id AND c2.received_at BETWEEN ? AND ?
                AND t.due_at IS NOT NULL
                AND ((t.status = 'TAMAMLANDI' AND date(t.completed_at) > t.due_at)
                     OR (t.status IN ('BEKLEMEDE','DEVAM_EDIYOR') AND t.due_at < date('now')))
            ) AS overdue_tasks,
            (SELECT COUNT(*) FROM tasks t JOIN complaints c2 ON c2.id = t.complaint_id
              WHERE c2.factory_id = f.id AND c2.received_at BETWEEN ? AND ?
                AND t.due_at IS NOT NULL AND t.status <> 'GEREKSIZ'
            ) AS total_tasks
       FROM factories f
       LEFT JOIN complaints c ON c.factory_id = f.id AND c.received_at BETWEEN ? AND ? ${extra}
      WHERE f.is_active = 1 ${factoryId ? `AND f.id = ${Number(factoryId)}` : ""}
      GROUP BY f.id
      ORDER BY f.short_name`,
    r.from, r.to, r.from, r.to, r.from, r.to,
  );

  return rows.map((row) => {
    const closeDays = all<{ received_at: string; closed_at: string }>(
      `SELECT received_at, closed_at FROM complaints
        WHERE factory_id = ? AND closed_at IS NOT NULL AND received_at BETWEEN ? AND ?`,
      row.factory_id, r.from, r.to,
    ).map((c) => businessDaysBetween(c.received_at, dayOf(c.closed_at)!, holidays));

    return {
      ...row,
      sla_rate: row.total_tasks > 0
        ? Math.round(((row.total_tasks - row.overdue_tasks) / row.total_tasks) * 1000) / 10
        : null,
      avg_close_days: closeDays.length
        ? Math.round((closeDays.reduce((a, b) => a + b, 0) / closeDays.length) * 10) / 10
        : null,
    };
  });
}

export interface CategoryStat {
  name: string;
  family: string;
  count: number;
  justified: number;
}

export function categoryBreakdown(r: PerfRange, factoryId?: number | null): CategoryStat[] {
  return all<CategoryStat>(
    `SELECT cat.name, cat.family, COUNT(c.id) AS count,
            SUM(CASE WHEN c.verdict = 'HAKLI' THEN 1 ELSE 0 END) AS justified
       FROM complaints c JOIN complaint_categories cat ON cat.id = c.category_id
      WHERE c.received_at BETWEEN ? AND ? ${factoryId ? "AND c.factory_id = ?" : ""}
      GROUP BY cat.id HAVING count > 0
      ORDER BY count DESC`,
    ...(factoryId ? [r.from, r.to, factoryId] : [r.from, r.to]),
  );
}

export interface MonthPoint {
  ym: string;
  total: number;
  justified: number;
  closed: number;
}

export function monthlyTrend(months: number, factoryId?: number | null): MonthPoint[] {
  return all<MonthPoint>(
    `SELECT strftime('%Y-%m', received_at) AS ym,
            COUNT(*) AS total,
            SUM(CASE WHEN verdict = 'HAKLI' THEN 1 ELSE 0 END) AS justified,
            SUM(CASE WHEN status IN ('KAPANDI','REDDEDILDI') THEN 1 ELSE 0 END) AS closed
       FROM complaints
      WHERE received_at >= date('now', ?) ${factoryId ? "AND factory_id = ?" : ""}
      GROUP BY ym ORDER BY ym`,
    ...(factoryId ? [`-${months} months`, factoryId] : [`-${months} months`]),
  );
}

export interface ProductGroupStat {
  product_group: string;
  count: number;
  quantity_kg: number;
}

export function productGroupBreakdown(r: PerfRange, factoryId?: number | null): ProductGroupStat[] {
  return all<ProductGroupStat>(
    `SELECT product_group, COUNT(*) AS count, IFNULL(SUM(quantity_kg),0) AS quantity_kg
       FROM complaints
      WHERE received_at BETWEEN ? AND ? ${factoryId ? "AND factory_id = ?" : ""}
      GROUP BY product_group ORDER BY count DESC`,
    ...(factoryId ? [r.from, r.to, factoryId] : [r.from, r.to]),
  );
}

/** Kilometre taşı bazında SLA uyum oranı. */
export interface MilestoneSla {
  code: string;
  title: string;
  total: number;
  onTime: number;
  late: number;
  pendingLate: number;
}

export function milestoneSla(r: PerfRange, factoryId?: number | null): MilestoneSla[] {
  return all<MilestoneSla>(
    `SELECT t.code, t.title,
            COUNT(*) AS total,
            SUM(CASE WHEN t.status = 'TAMAMLANDI' AND date(t.completed_at) <= t.due_at THEN 1 ELSE 0 END) AS onTime,
            SUM(CASE WHEN t.status = 'TAMAMLANDI' AND date(t.completed_at) > t.due_at THEN 1 ELSE 0 END) AS late,
            SUM(CASE WHEN t.status IN ('BEKLEMEDE','DEVAM_EDIYOR') AND t.due_at < date('now') THEN 1 ELSE 0 END) AS pendingLate
       FROM tasks t JOIN complaints c ON c.id = t.complaint_id
      WHERE t.due_at IS NOT NULL AND t.status <> 'GEREKSIZ'
        AND c.received_at BETWEEN ? AND ? ${factoryId ? "AND c.factory_id = ?" : ""}
      GROUP BY t.code ORDER BY MIN(t.sort_order)`,
    ...(factoryId ? [r.from, r.to, factoryId] : [r.from, r.to]),
  );
}

/** Varsayılan rapor aralığı: içinde bulunulan yılın başından bugüne. */
export function defaultRange(): PerfRange {
  const t = today();
  return { from: `${t.slice(0, 4)}-01-01`, to: t };
}

/**
 * Üst yönetim ekranlarının varsayılan aralığı: içinde bulunulan ay dâhil son
 * üç ay. Yılbaşından bugüne aralığında kıyas dönemi bir önceki yıla düştüğü
 * için karşılaştırma anlamsızlaşıyordu.
 */
export function yonetimAraligi(): PerfRange {
  const t = today();
  const d = new Date(`${t}T00:00:00Z`);
  const bas = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - 2, 1));
  return { from: bas.toISOString().slice(0, 10), to: t };
}

export function totalRow(rows: FactoryPerf[]): FactoryPerf {
  const sum = (k: keyof FactoryPerf) => rows.reduce((a, r) => a + (Number(r[k]) || 0), 0);
  const totalTasks = sum("total_tasks");
  const overdue = sum("overdue_tasks");
  const closeAvgs = rows.map((r) => r.avg_close_days).filter((x): x is number => x != null);
  return {
    factory_id: 0,
    factory: "TOPLAM",
    total: sum("total"),
    open: sum("open"),
    closed: sum("closed"),
    justified: sum("justified"),
    rejected: sum("rejected"),
    overdue_tasks: overdue,
    total_tasks: totalTasks,
    returned_kg: sum("returned_kg"),
    exchanged_kg: sum("exchanged_kg"),
    refund_amount: sum("refund_amount"),
    freight_amount: sum("freight_amount"),
    sla_rate: totalTasks > 0 ? Math.round(((totalTasks - overdue) / totalTasks) * 1000) / 10 : null,
    avg_close_days: closeAvgs.length
      ? Math.round((closeAvgs.reduce((a, b) => a + b, 0) / closeAvgs.length) * 10) / 10
      : null,
  };
}

/** Bir şikâyetin açık görevlerinden en yakın son tarihi döndürür. */
export function nextDue(complaintId: number): { due_at: string | null; title: string | null } {
  return one<{ due_at: string | null; title: string | null }>(
    `SELECT due_at, title FROM tasks
      WHERE complaint_id = ? AND status IN ('BEKLEMEDE','DEVAM_EDIYOR') AND due_at IS NOT NULL
      ORDER BY due_at LIMIT 1`,
    complaintId,
  ) ?? { due_at: null, title: null };
}
