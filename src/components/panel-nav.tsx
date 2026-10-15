"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

interface NavItem {
  href: string;
  label: string;
  count?: number;
  tone?: "danger" | "warn";
  show?: boolean;
}

export function PanelNav({
  gm, kademe, counts, canManageDefs, canSeeNotifications,
}: {
  gm: boolean;
  /** Menünün hangi role göre kurulacağı. */
  kademe: "fabrika" | "ustyonetim" | "daire";
  counts: {
    open: number; overdue: number; myTasks: number; escalations: number; yazilar: number;
  };
  canManageDefs: boolean;
  canSeeNotifications: boolean;
}) {
  const path = usePathname();
  const search = useSearchParams();

  const daire = kademe === "daire";

  /*
   * Menü kademeye göre kurulur. Üst yönetimin görev kartı ve takvimi yoktur;
   * onun yerine gözetim ekranları gelir. Daire Başkanının kendi karar kuyruğu
   * ve resmî yazı kutusu öne çıkar.
   */
  /*
   * Menü kademeye göre kurulur. Genel Müdürlük tarafı izleyicidir: gösterge
   * paneli bütün ölçüleri taşıdığı için ayrı rapor, karşılaştırma ve dikkat
   * ekranı yoktur; geriye dosya listesi ile dairenin kendi işleri kalır.
   */
  const groups: { title: string; items: NavItem[] }[] = gm
    ? [
        {
          title: "Gözetim",
          items: [
            { href: "/panel", label: "Gösterge paneli" },
            { href: "/panel/sikayetler", label: "Şikâyet dosyaları", count: counts.open },
          ],
        },
        {
          title: daire ? "Daire Başkanlığı" : "Çıktı",
          items: [
            {
              href: "/panel/itirazlar",
              label: "Kararımı bekleyenler",
              count: counts.escalations,
              tone: "warn",
              show: daire,
            },
            {
              href: "/panel/resmi-yazilar",
              label: "Resmî yazılar",
              count: counts.yazilar,
              tone: "warn",
              show: daire,
            },
            { href: "/panel/ozet", label: "Yönetim özeti" },
            { href: "/panel/tanimlar", label: "Tanımlar ve ayarlar", show: canManageDefs },
          ],
        },
      ]
    : [
        {
          title: "Günlük iş",
          items: [
            { href: "/panel", label: "Gösterge paneli" },
            {
              href: "/panel/gorevler",
              label: "Bana düşen aşamalar",
              count: counts.myTasks,
              tone: "warn",
            },
            { href: "/panel/sikayetler", label: "Şikâyet dosyaları", count: counts.open },
            { href: "/panel/sikayetler?gecikme=1", label: "Geciken dosyalar", count: counts.overdue, tone: "danger" },
            { href: "/panel/takvim", label: "Takvim" },
          ],
        },
        {
          title: "Süreç",
          items: [
            { href: "/panel/bildirimler", label: "SMS / e-posta giden kutusu", show: canSeeNotifications },
            { href: "/panel/raporlar", label: "Performans panosu" },
          ],
        },
        {
          title: "Yönetim",
          items: [
            { href: "/panel/sikayetler/yeni", label: "Elden şikâyet kaydet" },
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
