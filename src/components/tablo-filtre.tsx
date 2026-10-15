"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

/* ===========================================================================
   Sütun süzgeci.

   Filtreler ayrı bir kutuda değil, süzdükleri yerde durur. Geniş ekranda bu
   yer listenin sütun başlığıdır; dar ekranda tablo yerine kart çizildiği için
   başlık yoktur ve aynı süzgeçler listenin üstünde bir şeritte toplanır.
   İkisi de aynı bileşendir, yalnızca görünümü değişir.

   Seçim adres satırına yazılır: filtrelenmiş liste paylaşılabilir ve
   tarayıcının geri tuşu çalışır.

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

const KUTU_GENISLIK = 248;

export function BaslikFiltre({ baslik, secenekler, gorunum = "baslik" }: {
  baslik: string;
  secenekler: FiltreSecenegi[];
  /** "baslik": tablo sütunu. "serit": dar ekranda listenin üstündeki şerit. */
  gorunum?: "baslik" | "serit";
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [acik, setAcik] = useState(false);
  const [konum, setKonum] = useState<{ top: number; left: number } | null>(null);
  const dugme = useRef<HTMLButtonElement>(null);

  // İlk seçenek "Tümü"dür; ondan sonrası seçiliyse sütun süzülüyor demektir.
  const secili = secenekler.find((s, i) => i > 0 && !!s.secili);
  const etkin = !!secili;

  /*
   * Kutu sayfayla birlikte kaymasın diye kaydırmada kapatılmaz, yeniden
   * yerleştirilir: düğmeye tıklamak tabloyu yatay kaydırabiliyor ve kapatma
   * kutuyu daha açılmadan kapatıyordu.
   */
  function yerlestir() {
    const r = dugme.current?.getBoundingClientRect();
    if (!r) return null;
    return {
      top: r.bottom + 4,
      left: Math.max(8, Math.min(r.left, window.innerWidth - KUTU_GENISLIK)),
    };
  }

  useEffect(() => {
    if (!acik) return;
    const kapat = (e: KeyboardEvent) => { if (e.key === "Escape") setAcik(false); };
    const tasi = () => {
      const r = dugme.current?.getBoundingClientRect();
      if (!r) return;
      if (r.bottom < 0 || r.top > window.innerHeight) { setAcik(false); return; }
      setKonum(yerlestir());
    };
    window.addEventListener("keydown", kapat);
    window.addEventListener("resize", tasi);
    window.addEventListener("scroll", tasi, true);
    return () => {
      window.removeEventListener("keydown", kapat);
      window.removeEventListener("resize", tasi);
      window.removeEventListener("scroll", tasi, true);
    };
  }, [acik]);

  function ac() {
    setKonum(yerlestir());
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

  /*
   * Düğmenin tamamı — etiket ve ok birlikte — dokunma hedefidir. Önceden
   * yalnızca 16px'lik ok tıklanabiliyordu; dokunmatik ekranda isabet
   * ettirilemeyecek kadar küçüktü (WCAG 2.2 alt sınırı 24px).
   */
  const serit = gorunum === "serit";
  const dugmeSinifi = serit
    ? "inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors " +
      (etkin
        ? "border-brand-600 bg-brand-600 text-white"
        : "border-ink-300 bg-white text-ink-700 active:bg-ink-100")
    : "-mx-1 inline-flex min-h-6 items-center gap-1 rounded-[4px] px-1 transition-colors " +
      (etkin ? "text-brand-700" : "hover:bg-ink-200");

  return (
    <span className={serit ? "contents" : "relative inline-flex items-center"}>
      <button
        ref={dugme}
        type="button"
        onClick={ac}
        aria-haspopup="listbox"
        aria-expanded={acik}
        aria-label={`${baslik} süzgeci${secili ? `: ${secili.etiket}` : ""}`}
        className={dugmeSinifi}
      >
        <span className={serit ? "max-w-[11rem] truncate" : undefined}>
          {serit && secili ? `${baslik}: ${secili.etiket}` : baslik}
        </span>
        <span
          aria-hidden
          className={
            serit
              ? "shrink-0 text-[0.5rem] leading-none"
              : "flex size-4 shrink-0 items-center justify-center rounded-[3px] text-[0.5625rem] leading-none " +
                (etkin ? "bg-brand-600 text-white" : "text-ink-400")
          }
        >
          ▼
        </span>
      </button>

      {acik && konum && (
        <>
          <span className="fixed inset-0 z-40" onClick={() => setAcik(false)} aria-hidden />
          <span
            role="listbox"
            style={{ top: konum.top, left: konum.left }}
            className="fixed z-50 max-h-[60vh] w-60 overflow-y-auto overscroll-contain rounded-[5px] border border-ink-300 bg-white py-1 shadow-lg"
          >
            {secenekler.map((s) => (
              <button
                key={s.etiket}
                type="button"
                role="option"
                aria-selected={!!s.secili}
                onClick={() => uygula(s)}
                className={
                  "flex min-h-10 w-full items-center gap-2 px-3 py-1.5 text-left text-sm normal-case " +
                  (s.secili ? "bg-brand-50 font-medium text-brand-700" : "text-ink-700 hover:bg-ink-50")
                }
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
