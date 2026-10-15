"use client";

import { useState, type ReactNode } from "react";

/* ===========================================================================
   Grafik kutusu.

   Bir ölçü ya grafik ya tablo olarak gösterilir, ikisi birden değil: aynı
   sayıyı iki kez okumak ekranı uzatmaktan başka bir şey yapmıyordu. Grafik
   varsayılandır; tablo isteyen başlıktaki düğmeyle geçer.
   =========================================================================== */

export interface GrafikTablosu {
  headers: string[];
  rows: (string | number)[][];
}

const bicim = (v: number) =>
  Number.isInteger(v) ? v.toLocaleString("tr-TR") : v.toLocaleString("tr-TR", { maximumFractionDigits: 1 });

export function Grafik({
  baslik, aciklama, tablo, children, className = "",
}: {
  baslik: ReactNode;
  /** Başlığın altındaki kısa açıklama. */
  aciklama?: string;
  /** Verilmezse geçiş düğmesi çıkmaz (grafik zaten sayıları taşıyorsa). */
  tablo?: GrafikTablosu;
  /** Grafiğin kendisi. */
  children: ReactNode;
  className?: string;
}) {
  const [tabloGorunumu, setTabloGorunumu] = useState(false);

  return (
    <section className={`card ${className}`}>
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-ink-200 px-4 py-2.5">
        <h2 className="text-baslik font-semibold tracking-wide text-ink-700 uppercase">{baslik}</h2>
        {tablo && (
          <button
            type="button"
            onClick={() => setTabloGorunumu((o) => !o)}
            className="btn btn-secondary btn-sm"
            aria-pressed={tabloGorunumu}
          >
            {tabloGorunumu ? "Grafik" : "Tablo"}
          </button>
        )}
      </header>

      {aciklama && (
        <p className="border-b border-ink-100 px-4 py-2 text-xs text-ink-500">{aciklama}</p>
      )}

      {tabloGorunumu && tablo ? (
        <div className="table-wrap">
          <table className="tbl">
            <thead>
              <tr>
                {tablo.headers.map((h, i) => (
                  <th key={h} className={i === 0 ? undefined : "text-right"}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tablo.rows.map((r, i) => (
                <tr key={i}>
                  {r.map((hucre, j) => (
                    <td key={j} className={typeof hucre === "number" ? "tnum text-right" : undefined}>
                      {typeof hucre === "number" ? bicim(hucre) : hucre}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="p-4 sm:p-5">{children}</div>
      )}
    </section>
  );
}
