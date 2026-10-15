"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

/* ===========================================================================
   Sütun başlığı filtresi.

   Filtreler ayrı bir kutuda değil, listenin kendi başlıklarında durur: hangi
   sütunu süzdüğün, süzdüğün yerde görünür. Seçim adres satırına yazılır, yani
   filtrelenmiş liste paylaşılabilir ve geri tuşu çalışır.

   Açılan kutu `position: fixed` ile çizilir; tablo yatay kaydırma kabı
   içindedir ve mutlak konumlandırma orada kırpılıyordu.
   =========================================================================== */

export interface FiltreSecenegi {
  etiket: string;
  /** Uygulanınca yazılacak parametreler; null olan parametre silinir. */
  deger: Record<string, string | null>;
  /** Seçili mi? */
  secili?: boolean;
}

export function BaslikFiltre({ baslik, secenekler }: {
  baslik: string;
  secenekler: FiltreSecenegi[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [acik, setAcik] = useState(false);
  const [konum, setKonum] = useState<{ top: number; left: number } | null>(null);
  const dugme = useRef<HTMLButtonElement>(null);

  // İlk seçenek "Tümü"dür; ondan sonrası seçiliyse sütun süzülüyor demektir.
  const etkin = secenekler.some((s, i) => i > 0 && s.secili);

  /*
   * Kutu sayfayla birlikte kaymasın diye kaydırmada kapatılmaz, yeniden
   * yerleştirilir: düğmeye tıklamak tabloyu yatay kaydırabiliyor ve kapatma
   * kutuyu daha açılmadan kapatıyordu.
   */
  useEffect(() => {
    if (!acik) return;
    const kapat = (e: KeyboardEvent) => { if (e.key === "Escape") setAcik(false); };
    const yerlestir = () => {
      const r = dugme.current?.getBoundingClientRect();
      if (!r) return;
      if (r.bottom < 0 || r.top > window.innerHeight) { setAcik(false); return; }
      setKonum({ top: r.bottom + 4, left: Math.max(8, Math.min(r.left, window.innerWidth - 248)) });
    };
    window.addEventListener("keydown", kapat);
    window.addEventListener("resize", yerlestir);
    window.addEventListener("scroll", yerlestir, true);
    return () => {
      window.removeEventListener("keydown", kapat);
      window.removeEventListener("resize", yerlestir);
      window.removeEventListener("scroll", yerlestir, true);
    };
  }, [acik]);

  function ac() {
    const r = dugme.current?.getBoundingClientRect();
    if (r) setKonum({ top: r.bottom + 4, left: Math.max(8, Math.min(r.left, window.innerWidth - 248)) });
    setAcik((o) => !o);
  }

  function uygula(s: FiltreSecenegi) {
    const p = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(s.deger)) {
      if (v === null || v === "") p.delete(k);
      else p.set(k, v);
    }
    p.delete("s"); // filtre değişince ilk sayfaya dön
    const sorgu = p.toString();
    setAcik(false);
    router.push(sorgu ? `${pathname}?${sorgu}` : pathname);
  }

  return (
    <span className="relative inline-flex items-center gap-1">
      {baslik}
      <button
        ref={dugme}
        type="button"
        onClick={ac}
        aria-haspopup="listbox"
        aria-expanded={acik}
        aria-label={`${baslik} sütununu filtrele`}
        className={`flex size-4 items-center justify-center rounded-[3px] text-[9px] leading-none transition-colors ${
          etkin
            ? "bg-brand-600 text-white"
            : "text-ink-400 hover:bg-ink-200 hover:text-ink-700"
        }`}
      >
        ▼
      </button>

      {acik && konum && (
        <>
          <span className="fixed inset-0 z-40" onClick={() => setAcik(false)} aria-hidden />
          <span
            role="listbox"
            style={{ top: konum.top, left: konum.left }}
            className="fixed z-50 max-h-[60vh] w-60 overflow-y-auto rounded-[5px] border border-ink-300 bg-white py-1 shadow-lg"
          >
            {secenekler.map((s) => (
              <button
                key={s.etiket}
                type="button"
                role="option"
                aria-selected={!!s.secili}
                onClick={() => uygula(s)}
                className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm normal-case ${
                  s.secili ? "bg-brand-50 font-medium text-brand-700" : "text-ink-700 hover:bg-ink-50"
                }`}
              >
                <span className="w-3 shrink-0 text-xs" aria-hidden>{s.secili ? "✓" : ""}</span>
                <span className="min-w-0 flex-1 truncate">{s.etiket}</span>
              </button>
            ))}
          </span>
        </>
      )}
    </span>
  );
}
