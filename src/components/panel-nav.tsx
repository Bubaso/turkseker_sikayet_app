"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

interface NavItem {
  href: string;
  label: string;
  count?: number;
  tone?: "danger" | "warn" | "brand";
  show?: boolean;
}

export function PanelNav({
  gm, counts, canManageDefs, canSeeNotifications, canDecideEscalation,
}: {
  gm: boolean;
  counts: { open: number; overdue: number; myTasks: number; escalations: number };
  canManageDefs: boolean;
  canSeeNotifications: boolean;
  canDecideEscalation: boolean;
}) {
  const path = usePathname();
  const search = useSearchParams();

  const groups: { title: string; items: NavItem[] }[] = [
    {
      title: "Günlük iş",
      items: [
        { href: "/panel", label: "Gösterge paneli" },
        { href: "/panel/gorevler", label: "Görevlerim", count: counts.myTasks, tone: "brand" },
        { href: "/panel/sikayetler", label: "Şikâyet dosyaları", count: counts.open },
        { href: "/panel/sikayetler?gecikme=1", label: "Geciken dosyalar", count: counts.overdue, tone: "danger" },
        { href: "/panel/takvim", label: "Takvim" },
      ],
    },
    {
      title: gm ? "Genel Müdürlük" : "Süreç",
      items: [
        {
          href: "/panel/itirazlar",
          label: "İtiraz değerlendirmeleri",
          count: counts.escalations,
          tone: "warn",
          show: gm || canDecideEscalation,
        },
        { href: "/panel/belgeler", label: "İmza bekleyen belgeler", show: !gm },
        { href: "/panel/bildirimler", label: "SMS / e-posta giden kutusu", show: canSeeNotifications },
      ],
    },
    {
      title: "Raporlama",
      items: [
        { href: "/panel/raporlar", label: "Performans panosu" },
        { href: "/panel/raporlar/aylik", label: "Aylık şikâyet tablosu" },
      ],
    },
    {
      title: "Yönetim",
      items: [
        { href: "/panel/sikayetler/yeni", label: "Elden şikâyet kaydet", show: !gm },
        { href: "/panel/tanimlar", label: "Tanımlar ve ayarlar", show: canManageDefs },
      ],
    },
  ];

  function active(href: string): boolean {
    const [base, query] = href.split("?") as [string, string | undefined];
    if (query) {
      const [k, v] = query.split("=");
      return path === base && search.get(k!) === v;
    }
    if (base === "/panel") return path === "/panel" && !search.has("gecikme");
    if (base === "/panel/sikayetler") return path === base && !search.has("gecikme");
    return path === base || path.startsWith(`${base}/`);
  }

  return (
    <nav aria-label="Panel menüsü" className="shrink-0 lg:w-56">
      <div className="space-y-4 lg:sticky lg:top-20">
        {groups.map((g) => {
          const items = g.items.filter((i) => i.show !== false);
          if (items.length === 0) return null;
          return (
            <div key={g.title}>
              <p className="mb-1 px-2 text-[11px] font-semibold tracking-wider text-ink-400 uppercase">
                {g.title}
              </p>
              <ul className="space-y-0.5">
                {items.map((i) => {
                  const on = active(i.href);
                  return (
                    <li key={i.href}>
                      <Link
                        href={i.href}
                        className={
                          "flex items-center justify-between gap-2 rounded-[5px] px-2.5 py-1.5 text-sm transition-colors " +
                          (on
                            ? "bg-brand-50 font-medium text-brand-800"
                            : "text-ink-700 hover:bg-white")
                        }
                      >
                        <span className="truncate">{i.label}</span>
                        {i.count != null && i.count > 0 && (
                          <span
                            className={
                              "tnum rounded-full px-1.5 text-[11px] font-semibold " +
                              (i.tone === "danger"
                                ? "bg-danger-50 text-danger-700"
                                : i.tone === "warn"
                                  ? "bg-warn-50 text-warn-700"
                                  : i.tone === "brand"
                                    ? "bg-brand-100 text-brand-700"
                                    : "bg-ink-100 text-ink-600")
                            }
                          >
                            {i.count}
                          </span>
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </div>
    </nav>
  );
}
