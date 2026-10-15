"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  menuAktifMi, panelMenusu, sayacSinifi, type MenuArgumanlari,
} from "./panel-menu";

/* ===========================================================================
   Geniş ekranın sabit kenar çubuğu.

   Dar ekranda hiç çizilmez: orada menü başlıktaki düğmeden açılan çekmecede
   durur (panel-cekmece.tsx). Menünün kendisi iki yerde de aynı tanımdan
   gelir (panel-menu.ts).
   =========================================================================== */

export function PanelNav(props: MenuArgumanlari) {
  const path = usePathname();
  const search = useSearchParams();
  const gruplar = panelMenusu(props);

  return (
    <nav aria-label="Panel menüsü" className="hidden shrink-0 lg:block lg:w-56">
      <div className="space-y-4 lg:sticky lg:top-20">
        {gruplar.map((g) => (
          <div key={g.title}>
            <p className="mb-1 px-2 text-rozet font-semibold tracking-wider text-ink-400 uppercase">
              {g.title}
            </p>
            <ul className="space-y-0.5">
              {g.items.map((i) => {
                const on = menuAktifMi(i.href, path, (k) => search.get(k), (k) => search.has(k));
                return (
                  <li key={i.href}>
                    <Link
                      href={i.href}
                      aria-current={on ? "page" : undefined}
                      className={
                        "flex items-center justify-between gap-2 rounded-[5px] px-2.5 py-1.5 text-sm transition-colors " +
                        (on ? "bg-brand-50 font-medium text-brand-800" : "text-ink-700 hover:bg-white")
                      }
                    >
                      <span className="truncate">{i.label}</span>
                      {i.count != null && i.count > 0 && (
                        <span className={`tnum rounded-full px-1.5 text-rozet font-semibold ${sayacSinifi(i.tone)}`}>
                          {i.count}
                        </span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </nav>
  );
}
