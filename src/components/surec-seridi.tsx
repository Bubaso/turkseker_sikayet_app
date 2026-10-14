/* ===========================================================================
   Süreç şeridi — müşteri takip sayfasının adım listesi.

   Adımlar numaralı dairelerden geçen tek bir omurga çizgisiyle bağlanır;
   böylece liste bir "sıra" olarak okunur. Tamamlanan adım onay işaretli ve
   tarihli, koşulu oluşmayan adım çizgili, bekleyen adım numaralıdır.
   =========================================================================== */

export type AdimDurumu = "tamam" | "bekliyor" | "atlandi";

export interface SurecAdimi {
  baslik: string;
  /** Gerçekleşme tarihi; henüz olmamış adımda boş. */
  zaman?: string | null;
  aciklama?: string | null;
  durum: AdimDurumu;
}

export function SurecSeridi({ adimlar }: { adimlar: SurecAdimi[] }) {
  return (
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

          <div className={`min-w-0 flex-1 pt-2.5 ${i === adimlar.length - 1 ? "pb-3.5" : "pb-4"}`}>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <p className={`text-sm font-semibold ${
                a.durum === "bekliyor" ? "text-ink-500" : "text-ink-900"
              }`}>
                {a.baslik}
              </p>
              {a.zaman && <span className="tnum text-xs text-ink-500">{a.zaman}</span>}
            </div>
            {a.aciklama && (
              <p className="mt-1 max-w-[68ch] text-sm leading-relaxed whitespace-pre-wrap text-ink-600">
                {a.aciklama}
              </p>
            )}
          </div>
        </li>
      ))}
    </ol>
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
