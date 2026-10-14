"use client";

import { useState } from "react";

/* ===========================================================================
   Süreç şeridi — ana sayfa ve müşteri takip sayfasının ortak bileşeni.

   Aynı süreç iki yerde gösterilir: ana sayfada müşteri henüz başvurmadan
   "ne olacak"ı, takip sayfasında başvurduktan sonra "nerede"yi okur. İki
   sayfanın aynı görsel dili kullanması, müşterinin başvurudan önce gördüğü
   resmi sonradan tanımasını sağlar.

   Adımlar numaralı dairelerden geçen tek bir omurga çizgisiyle bağlanır;
   böylece liste bir "sıra" olarak okunur. Telefonda açıklamalar katlanabilir,
   çünkü altı adımın tam metni iki ekranı aşıyordu.
   =========================================================================== */

export type AdimDurumu = "tamam" | "bekliyor" | "atlandi";

export interface AdimDali {
  baslik: string;
  aciklama: string;
  /** "ok" olumlu çıkış, "ink" nötr çıkış. */
  ton: "ok" | "ink";
}

export interface SurecAdimi {
  baslik: string;
  /** Ana sayfada süre ("3. iş günü"), takip sayfasında tarih. */
  zaman?: string | null;
  aciklama?: string | null;
  /** Müşterinin kendisinin yapması gereken şey. */
  sizden?: string | null;
  /** Adımın altında küçük punto ek bilgi. */
  dipnot?: string | null;
  /** Sonucun birden çok çıkışı varsa (haklı / haklı bulunmadı). */
  dallar?: AdimDali[];
  durum: AdimDurumu;
}

export function SurecSeridi({
  adimlar,
  zamanTonu = "sessiz",
  katlanabilir = false,
}: {
  adimlar: SurecAdimi[];
  /**
   * "vurgulu": süre rozeti marka renginde — sayfayı tarayan müşterinin gözüne
   * ilk çarpması gereken bilgi süredir. "sessiz": tarih, gri küçük punto.
   */
  zamanTonu?: "vurgulu" | "sessiz";
  /** Telefonda açıklamaları gizleyip tek düğmeyle açar. */
  katlanabilir?: boolean;
}) {
  const [acik, setAcik] = useState(false);
  // Katlanabilir modda açıklamalar telefonda gizli, sm ve üstünde her zaman açık.
  const detayGorunum = !katlanabilir || acik ? "block" : "hidden sm:block";

  return (
    <div>
      {katlanabilir && (
        <div className="border-b border-ink-200 px-4 py-2 sm:hidden">
          <button
            type="button"
            onClick={() => setAcik((o) => !o)}
            className="btn btn-ghost btn-sm -ml-2.5"
            aria-expanded={acik}
          >
            {acik ? "Açıklamaları gizle" : "Her adımın açıklamasını göster"}
          </button>
        </div>
      )}

      <ol>
        {adimlar.map((a, i) => (
          <li key={`${a.baslik}-${i}`} className="flex gap-3.5 px-4 sm:px-5">
            {/* Omurga: işaretçiden bir sonraki işaretçiye inen çizgi */}
            <div className="flex w-6 shrink-0 flex-col items-center">
              <Isaretci durum={a.durum} sira={i + 1} />
              {i < adimlar.length - 1 && (
                <span className="mt-1 w-px flex-1 bg-ink-200" aria-hidden />
              )}
            </div>

            <div className={`min-w-0 flex-1 ${i === adimlar.length - 1 ? "pt-2.5 pb-3.5" : "pt-2.5 pb-4"}`}>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <p className={`text-sm font-semibold ${
                  a.durum === "bekliyor" && zamanTonu === "sessiz" ? "text-ink-500" : "text-ink-900"
                }`}>
                  {a.baslik}
                </p>
                {a.zaman && (zamanTonu === "vurgulu" ? (
                  <span className="chip border-brand-200 bg-brand-50 px-1.5 text-[11px] font-semibold text-brand-700 sm:px-2 sm:text-xs">
                    {a.zaman}
                  </span>
                ) : (
                  <span className="tnum text-xs text-ink-500">{a.zaman}</span>
                ))}
              </div>

              <div className={detayGorunum}>
                {a.aciklama && (
                  <p className="mt-1 max-w-[68ch] text-sm leading-relaxed whitespace-pre-wrap text-ink-600">
                    {a.aciklama}
                  </p>
                )}

                {a.sizden && (
                  <p className="mt-2 max-w-[68ch] rounded-[5px] border border-warn-200 bg-warn-50 px-2.5 py-1.5 text-sm leading-snug text-warn-700">
                    <span className="font-semibold">Sizden beklenen: </span>
                    {a.sizden}
                  </p>
                )}

                {a.dallar && a.dallar.length > 0 && (
                  <div className="mt-2 max-w-[68ch] space-y-2">
                    {a.dallar.map((d) => (
                      <div
                        key={d.baslik}
                        className={`rounded-[5px] border-l-2 bg-ink-50 px-2.5 py-1.5 ${
                          d.ton === "ok" ? "border-l-ok-600" : "border-l-ink-400"
                        }`}
                      >
                        <p className="text-sm font-semibold text-ink-800">{d.baslik}</p>
                        <p className="mt-0.5 text-sm leading-snug text-ink-600">{d.aciklama}</p>
                      </div>
                    ))}
                  </div>
                )}

                {a.dipnot && <p className="mt-1.5 text-xs text-ink-500">{a.dipnot}</p>}
              </div>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

function Isaretci({ durum, sira }: { durum: AdimDurumu; sira: number }) {
  const temel =
    "mt-2 flex size-6 shrink-0 items-center justify-center rounded-full border text-[11px] font-semibold";
  const gorunum =
    durum === "tamam"
      ? "border-ok-600 bg-ok-600 text-white"
      : durum === "atlandi"
        ? "border-ink-300 bg-ink-200 text-ink-500"
        : "border-ink-300 bg-white text-ink-500";

  return (
    <span className={`${temel} ${gorunum}`} aria-hidden>
      {durum === "tamam" ? "✓" : durum === "atlandi" ? "–" : sira}
    </span>
  );
}
