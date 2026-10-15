import Link from "next/link";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { all, one, scalar } from "@/lib/db";
import { PERMISSIONS, can, isGmRole } from "@/lib/roles";
import { currentUser, demoAccounts, type DemoAccount } from "@/server/auth";
import { isDemoMode } from "@/server/settings";
import { okunmamisYaziSayisi } from "@/server/yonetim";
import { logoutAction } from "@/app/giris/actions";
import RoleSwitcher, { type FactoryGroup } from "@/components/role-switcher";
import { PanelNav } from "@/components/panel-nav";
import { PanelCekmece } from "@/components/panel-cekmece";
import { FlashMessage } from "@/components/flash";
import { Amblem } from "@/components/marka";

export const dynamic = "force-dynamic";

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const user = await currentUser();
  if (!user) redirect("/giris?next=/panel");

  const gm = isGmRole(user.role) || user.role === "SISTEM_YONETICISI";

  // Sayaçlar — yan menüde gösterilir.
  const factoryClause = gm ? "" : "AND c.factory_id = " + Number(user.factory_id ?? -1);
  const openCount = scalar<number>(
    `SELECT COUNT(*) FROM complaints c
      WHERE c.status NOT IN ('KAPANDI','REDDEDILDI','IPTAL') ${factoryClause}`,
  ) ?? 0;
  const overdueCount = scalar<number>(
    `SELECT COUNT(DISTINCT c.id) FROM complaints c JOIN tasks t ON t.complaint_id = c.id
      WHERE c.status NOT IN ('KAPANDI','REDDEDILDI','IPTAL')
        AND t.status IN ('BEKLEMEDE','DEVAM_EDIYOR')
        AND t.due_at IS NOT NULL AND t.due_at < date('now') ${factoryClause}`,
  ) ?? 0;
  const myTaskCount = gm
    ? scalar<number>(
        `SELECT COUNT(*) FROM tasks
          WHERE status IN ('BEKLEMEDE','DEVAM_EDIYOR')
            AND (assignee_id = ? OR (department_id IS NOT NULL AND department_id = ?))`,
        user.id, user.department_id,
      ) ?? 0
    : scalar<number>(
        `SELECT COUNT(*) FROM tasks
          WHERE status IN ('BEKLEMEDE','DEVAM_EDIYOR')
            AND (assignee_id = ? OR (assignee_id IS NULL AND factory_id = ? AND assignee_role = ?))`,
        user.id, user.factory_id, user.role,
      ) ?? 0;
  const escalationCount = scalar<number>(
    `SELECT COUNT(*) FROM complaints
      WHERE escalated_at IS NOT NULL AND escalation_decided_at IS NULL
        ${user.role === "GM_DAIRE" ? `AND escalated_dept_id = ${Number(user.department_id ?? -1)}` : ""}`,
  ) ?? 0;

  // Üst yönetim ve daire menüsünün ek sayaçları
  const kademe: "fabrika" | "ustyonetim" | "daire" =
    user.role === "GM_DAIRE" && user.department_id ? "daire" : gm ? "ustyonetim" : "fabrika";
  const yaziSayisi = user.department_id ? okunmamisYaziSayisi(user.department_id) : 0;

  // Menü iki yerde çizilir (geniş ekranda kenar çubuğu, dar ekranda çekmece);
  // sayaçlar tek yerde toplanır.
  const menuSayaclari = {
    open: openCount, overdue: overdueCount, myTasks: myTaskCount,
    escalations: escalationCount, yazilar: yaziSayisi,
  };

  const demo = isDemoMode();
  let factoryAccounts: FactoryGroup[] = [];
  let gmAccounts: DemoAccount[] = [];
  if (demo) {
    const factories = all<{ id: number; short_name: string; name: string }>(
      "SELECT id, short_name, name FROM factories WHERE is_active = 1 ORDER BY short_name",
    );
    factoryAccounts = factories.map((f) => ({ ...f, accounts: demoAccounts(f.id) }));
    gmAccounts = demoAccounts(null);
  }

  return (
    <div className="flex min-h-screen flex-col bg-ink-100">
      <div className="h-1 bg-brand-600" aria-hidden />

      <header className="sticky top-0 z-10 border-b border-ink-200 bg-white">
        <div className="mx-auto flex max-w-[1500px] items-center justify-between gap-2 px-4 py-2.5">
          <div className="flex min-w-0 items-center gap-1.5">
            <PanelCekmece
              gm={gm}
              counts={menuSayaclari}
              kademe={kademe}
              canManageDefs={can(user.role, PERMISSIONS.TANIM_YONET)}
              canSeeNotifications={can(user.role, PERMISSIONS.BILDIRIM_GOR)}
              altbilgi={
                <div className="leading-tight">
                  <span className="block text-sm font-medium text-ink-800">{user.full_name}</span>
                  <span className="block text-xs text-ink-500">{user.title}</span>
                </div>
              }
            />
            <Link href="/panel" className="flex min-w-0 items-center gap-2.5">
              <Amblem boyut={30} className="shrink-0" />
              <span className="min-w-0 leading-tight">
                <span className="block truncate text-sm font-semibold text-ink-900">Şikâyet Takip Sistemi</span>
                <span className="block truncate text-xs text-ink-500">
                  {gm ? (user.department_name ?? "Genel Müdürlük") : user.factory_name}
                </span>
              </span>
            </Link>
          </div>

          <div className="flex items-center gap-2">
            <div className="hidden text-right leading-tight sm:block">
              <span className="block text-sm font-medium text-ink-800">{user.full_name}</span>
              <span className="block text-xs text-ink-500">{user.title}</span>
            </div>
            {demo && (factoryAccounts.length > 0 || gmAccounts.length > 0) && (
              <RoleSwitcher
                factories={factoryAccounts}
                gmAccounts={gmAccounts}
                currentUserId={user.id}
                currentLabel={`${user.title}${user.factory_name ? ` — ${user.factory_name}` : ""}`}
                currentFactoryId={user.factory_id}
                isGm={gm}
              />
            )}
            <form action={logoutAction}>
              <button type="submit" className="btn btn-secondary btn-sm">Çıkış</button>
            </form>
          </div>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-[1500px] flex-1 flex-col gap-5 px-4 py-5 lg:flex-row">
        <PanelNav
          gm={gm}
          counts={menuSayaclari}
          kademe={kademe}
          canManageDefs={can(user.role, PERMISSIONS.TANIM_YONET)}
          canSeeNotifications={can(user.role, PERMISSIONS.BILDIRIM_GOR)}
        />
        <main className="min-w-0 flex-1">
          <Suspense fallback={null}>
            <FlashMessage />
          </Suspense>
          {children}
        </main>
      </div>
    </div>
  );
}
