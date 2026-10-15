"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/* ===========================================================================
   Görsel ekleri gösterir ve tıklanınca büyütür.

   Şikâyetin ne olduğunu çoğu zaman en iyi anlatan şey müşterinin çektiği
   fotoğraftır: topaklanmış çuval, yırtık torba, yabancı madde. Dosyayı açan
   kişi bunu görmek için dosya adına tıklayıp yeni sekme açmak zorunda
   kalmamalı.

   İki düzen, tek davranış:
     - "serit"  — Şikâyet Formunun KANITLAR satırındaki küçük kareler,
     - "izgara" — "Bütün ekler" bölümündeki büyük ızgara.
   İkisi de aynı büyütme penceresini açar; dosyanın iki yerinde aynı görsele
   tıklamak aynı şeyi yapar.

   Görsel olmayan ekler (PDF, Word, Excel) önizlenemez; onları çağıran taraf
   kendi listesinde gösterir. HEIC de dışarıda kalır: tarayıcılar çizemez.
   =========================================================================== */

export interface Gorsellenebilir {
  id: number;
  file_name: string;
  mime: string;
  caption?: string | null;
  /** Izgara düzeninde dosya adının altındaki satır. */
  altbilgi?: string;
}

export function GorselGalerisi({ gorseller, duzen = "serit" }: {
  gorseller: Gorsellenebilir[];
  duzen?: "serit" | "izgara";
}) {
  const [acik, setAcik] = useState<number | null>(null);
  // Dosyası okunamayan görseller bağlantıya düşürülür.
  const [bozuk, setBozuk] = useState<Set<number>>(new Set());
  const kapatma = useRef<HTMLButtonElement>(null);
  const acanDugme = useRef<HTMLButtonElement | null>(null);

  const cizilebilir = gorseller.filter((g) => !bozuk.has(g.id));

  const kaydir = useCallback((yon: number) => {
    setAcik((i) => (i === null ? i : (i + yon + cizilebilir.length) % cizilebilir.length));
  }, [cizilebilir.length]);

  useEffect(() => {
    if (acik === null) return;
    const eskiTasma = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function tus(e: KeyboardEvent) {
      if (e.key === "Escape") setAcik(null);
      else if (e.key === "ArrowRight") kaydir(1);
      else if (e.key === "ArrowLeft") kaydir(-1);
      else if (e.key === "Tab") { e.preventDefault(); kapatma.current?.focus(); }
    }
    window.addEventListener("keydown", tus);
    kapatma.current?.focus();

    return () => {
      window.removeEventListener("keydown", tus);
      document.body.style.overflow = eskiTasma;
      acanDugme.current?.focus();
    };
  }, [acik, kaydir]);

  function ac(i: number, e: React.MouseEvent<HTMLButtonElement>) {
    acanDugme.current = e.currentTarget;
    setAcik(i);
  }

  if (gorseller.length === 0) return null;

  const o = acik === null ? null : cizilebilir[acik];
  const izgara = duzen === "izgara";

  return (
    <>
      <ul className={
        izgara
          ? "grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4"
          : "flex flex-wrap gap-2"
      }>
        {gorseller.map((g) => {
          const i = cizilebilir.indexOf(g);
          if (i < 0) {
            return (
              <li key={g.id} className="self-center">
                <a href={`/api/ek/${g.id}`} target="_blank" rel="noreferrer" className="link text-sm">
                  {g.file_name}
                </a>
              </li>
            );
          }
          return (
            <li key={g.id}>
              <button
                type="button"
                onClick={(e) => ac(i, e)}
                title={g.caption ? `${g.file_name} — ${g.caption}` : g.file_name}
                aria-label={`${g.file_name} görselini büyüt`}
                className={
                  "block w-full overflow-hidden rounded-[5px] border border-ink-200 bg-ink-100 " +
                  "transition-colors hover:border-brand-400 focus-visible:border-brand-500"
                }
              >
                {/* Kullanıcının yüklediği, ölçüsü bilinmeyen bir dosya;
                    next/image yerine düz img kullanılır. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`/api/ek/${g.id}`}
                  alt={g.caption ?? g.file_name}
                  loading="lazy"
                  onError={() => setBozuk((s) => new Set(s).add(g.id))}
                  className={izgara ? "h-36 w-full object-cover" : "size-24 object-cover sm:size-28"}
                />
                {izgara && (
                  <span className="block border-t border-ink-100 bg-white px-2 py-1.5 text-left">
                    <span className="block truncate text-xs font-medium text-ink-700">
                      {g.file_name}
                    </span>
                    {g.altbilgi && (
                      <span className="block text-rozet text-ink-500">{g.altbilgi}</span>
                    )}
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>

      {o && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`${o.file_name} — büyütülmüş görünüm`}
          className="kanit-perde no-print fixed inset-0 z-50 flex flex-col bg-ink-900/90"
          onClick={() => setAcik(null)}
        >
          <div className="flex items-center justify-between gap-3 px-4 py-3 text-white">
            {/* Sayaç kesilmez: dar ekranda uzun dosya adı onu da yutuyordu. */}
            <span className="flex min-w-0 items-baseline gap-2 text-sm">
              <span className="min-w-0 truncate">{o.file_name}</span>
              {cizilebilir.length > 1 && (
                <span className="tnum shrink-0 text-white/60">
                  {acik! + 1} / {cizilebilir.length}
                </span>
              )}
            </span>
            <span className="flex shrink-0 items-center gap-1">
              <a
                href={`/api/ek/${o.id}`}
                target="_blank"
                rel="noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="flex min-h-11 items-center rounded-[5px] px-3 text-sm text-white/80 hover:bg-white/10 hover:text-white"
              >
                Yeni sekmede aç
              </a>
              <button
                ref={kapatma}
                type="button"
                onClick={() => setAcik(null)}
                aria-label="Kapat"
                className="flex size-11 items-center justify-center rounded-[5px] text-white/80 hover:bg-white/10 hover:text-white"
              >
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
                  <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                </svg>
              </button>
            </span>
          </div>

          <div className="flex min-h-0 flex-1 items-center justify-center gap-2 px-2 pb-4">
            {cizilebilir.length > 1 && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); kaydir(-1); }}
                aria-label="Önceki görsel"
                className="flex size-11 shrink-0 items-center justify-center rounded-full bg-white/10 text-xl text-white hover:bg-white/20"
              >
                ‹
              </button>
            )}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`/api/ek/${o.id}`}
              alt={o.caption ?? o.file_name}
              onClick={(e) => e.stopPropagation()}
              className="max-h-full max-w-full object-contain"
            />
            {cizilebilir.length > 1 && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); kaydir(1); }}
                aria-label="Sonraki görsel"
                className="flex size-11 shrink-0 items-center justify-center rounded-full bg-white/10 text-xl text-white hover:bg-white/20"
              >
                ›
              </button>
            )}
          </div>

          {o.caption && (
            <p className="px-4 pb-4 text-center text-sm text-white/80">{o.caption}</p>
          )}
        </div>
      )}
    </>
  );
}
