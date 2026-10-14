"use client";

import { useEffect, useRef, useState } from "react";

/* ===========================================================================
   Belge önizleme.

   İmzalamadan önce belgenin okunabilmesi gerekir. Yazdırma penceresine gitmek
   yerine belge aynı sayfada açılır: masaüstünde ortada bir pencere, telefonda
   tam ekran. Yazdırma ve yeni sekmede açma seçenekleri korunur.
   =========================================================================== */

export function BelgeOnizleme({
  documentId, baslik, docNo, label = "Göster",
}: {
  documentId: number;
  baslik: string;
  docNo: string;
  label?: string;
}) {
  const [acik, setAcik] = useState(false);
  const cerceve = useRef<HTMLIFrameElement>(null);

  // Açıkken sayfa arkada kaymasın; Esc ile kapansın.
  useEffect(() => {
    if (!acik) return;
    const onceki = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const kapat = (e: KeyboardEvent) => { if (e.key === "Escape") setAcik(false); };
    window.addEventListener("keydown", kapat);
    return () => {
      document.body.style.overflow = onceki;
      window.removeEventListener("keydown", kapat);
    };
  }, [acik]);

  function yazdir() {
    cerceve.current?.contentWindow?.print();
  }

  return (
    <>
      <button type="button" onClick={() => setAcik(true)} className="btn btn-secondary btn-sm">
        {label}
      </button>

      {acik && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`${baslik} önizleme`}
          className="fixed inset-0 z-50 flex flex-col bg-ink-900/60 sm:p-6"
          onClick={(e) => { if (e.target === e.currentTarget) setAcik(false); }}
        >
          <div className="mx-auto flex h-full w-full max-w-4xl flex-col overflow-hidden bg-white sm:rounded-[6px]">
            <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-ink-200 px-4 py-2.5">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-ink-900">{baslik}</p>
                <p className="truncate font-mono text-xs text-ink-500">{docNo}</p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <button type="button" onClick={yazdir} className="btn btn-secondary btn-sm">
                  Yazdır
                </button>
                <a href={`/belge/${documentId}`} target="_blank" rel="noreferrer"
                   className="btn btn-secondary btn-sm">
                  Yeni sekmede
                </a>
                <button type="button" onClick={() => setAcik(false)}
                        className="btn btn-primary btn-sm" aria-label="Önizlemeyi kapat">
                  Kapat
                </button>
              </div>
            </div>
            <iframe
              ref={cerceve}
              src={`/belge/${documentId}?gomulu=1`}
              title={`${baslik} — ${docNo}`}
              className="min-h-0 w-full flex-1 bg-white"
            />
          </div>
        </div>
      )}
    </>
  );
}
