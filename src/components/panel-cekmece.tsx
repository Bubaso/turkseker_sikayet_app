"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import {
  menuAktifMi, panelMenusu, sayacSinifi, type MenuArgumanlari,
} from "./panel-menu";

/* ===========================================================================
   Dar ekranın menüsü.

   Kenar çubuğu dar ekranda içeriğin üstüne yığılıyordu: kullanıcı her sayfada
   önce on bir menü maddesini geçip sonra içeriğe varıyordu. Menü artık
   başlıktaki düğmeden açılan bir çekmecede durur ve sayfa doğrudan içerikle
   başlar.

   Çekmece bir kalıcı pencere (modal) gibi davranır: arka plan kararır ve
   dokununca kapanır, Esc kapatır, odak içeride döner, açıkken sayfa kaymaz,
   başka bir sayfaya geçilince kendiliğinden kapanır.
   =========================================================================== */

/** Odaklanabilir öğeler — odak tuzağı için. */
const ODAKLANABILIR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function PanelCekmece(props: MenuArgumanlari & { altbilgi?: React.ReactNode }) {
  const { altbilgi, ...menuArgs } = props;
  const path = usePathname();
  const search = useSearchParams();
  const [acik, setAcik] = useState(false);
  const panel = useRef<HTMLDivElement>(null);
  const dugme = useRef<HTMLButtonElement>(null);

  const gruplar = panelMenusu(menuArgs);
  const sorgu = search.toString();

  // Başka sayfaya geçilince çekmece kapanır; menüden tıklayan kullanıcı
  // kapatmayı ayrıca düşünmez.
  useEffect(() => { setAcik(false); }, [path, sorgu]);

  useEffect(() => {
    if (!acik) return;
    const onceki = document.activeElement as HTMLElement | null;

    // Açıkken arkadaki sayfa kaymaz.
    const eskiTasma = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function tus(e: KeyboardEvent) {
      if (e.key === "Escape") { setAcik(false); return; }
      if (e.key !== "Tab" || !panel.current) return;
      // Odak tuzağı: sekme çekmecenin içinde döner.
      const odaklar = [...panel.current.querySelectorAll<HTMLElement>(ODAKLANABILIR)]
        .filter((e) => e.offsetParent !== null);
      if (odaklar.length === 0) return;
      const ilk = odaklar[0]!;
      const son = odaklar[odaklar.length - 1]!;
      if (e.shiftKey && document.activeElement === ilk) { e.preventDefault(); son.focus(); }
      else if (!e.shiftKey && document.activeElement === son) { e.preventDefault(); ilk.focus(); }
    }

    window.addEventListener("keydown", tus);
    // Açılınca odak çekmeceye girer.
    panel.current?.querySelector<HTMLElement>(ODAKLANABILIR)?.focus();

    return () => {
      window.removeEventListener("keydown", tus);
      document.body.style.overflow = eskiTasma;
      // Kapanınca odak düğmeye döner.
      (onceki ?? dugme.current)?.focus?.();
    };
  }, [acik]);

  return (
    <>
      <button
        ref={dugme}
        type="button"
        onClick={() => setAcik(true)}
        aria-label="Menüyü aç"
        aria-expanded={acik}
        aria-controls="panel-cekmece"
        aria-haspopup="dialog"
        className="-ml-1.5 flex size-11 shrink-0 items-center justify-center rounded-[5px] text-ink-700 transition-colors hover:bg-ink-100 active:bg-ink-200 lg:hidden"
      >
        <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden>
          <path d="M3 5.5h16M3 11h16M3 16.5h16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      </button>

      {acik && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="cekmece-perde absolute inset-0 bg-ink-900/45"
            onClick={() => setAcik(false)}
            aria-hidden
          />

          <div
            ref={panel}
            id="panel-cekmece"
            role="dialog"
            aria-modal="true"
            aria-label="Panel menüsü"
            className="cekmece-panel absolute inset-y-0 left-0 flex w-[17.5rem] max-w-[85vw] flex-col bg-white shadow-xl"
          >
            <div className="flex items-center justify-between border-b border-ink-200 px-4 py-3">
              <span className="text-baslik font-semibold tracking-wide text-ink-700 uppercase">Menü</span>
              <button
                type="button"
                onClick={() => setAcik(false)}
                aria-label="Menüyü kapat"
                className="-mr-2 flex size-11 items-center justify-center rounded-[5px] text-ink-600 transition-colors hover:bg-ink-100 active:bg-ink-200"
              >
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
                  <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                </svg>
              </button>
            </div>

            <nav
              aria-label="Panel menüsü"
              className="flex-1 overflow-y-auto overscroll-contain px-3 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]"
            >
              <div className="space-y-5">
                {gruplar.map((g) => (
                  <div key={g.title}>
                    <p className="mb-1 px-2 text-rozet font-semibold tracking-wider text-ink-400 uppercase">
                      {g.title}
                    </p>
                    <ul>
                      {g.items.map((i) => {
                        const on = menuAktifMi(i.href, path, (k) => search.get(k), (k) => search.has(k));
                        return (
                          <li key={i.href}>
                            <Link
                              href={i.href}
                              aria-current={on ? "page" : undefined}
                              className={
                                "flex min-h-11 items-center justify-between gap-2 rounded-[5px] px-2.5 py-2 text-sm transition-colors " +
                                (on ? "bg-brand-50 font-medium text-brand-800" : "text-ink-700 active:bg-ink-100")
                              }
                            >
                              <span className="truncate">{i.label}</span>
                              {i.count != null && i.count > 0 && (
                                <span className={`tnum shrink-0 rounded-full px-1.5 text-rozet font-semibold ${sayacSinifi(i.tone)}`}>
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

            {altbilgi && (
              <div className="border-t border-ink-200 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
                {altbilgi}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
