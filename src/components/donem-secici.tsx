import Link from "next/link";

/* ===========================================================================
   Ortak dönem seçici. Pano, fabrika karşılaştırma ve raporlar aynı aralığı
   aynı biçimde seçsin diye tek bileşene toplanmıştır: hazır kısayollar ve
   serbest aralık.
   =========================================================================== */

function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export interface DonemKisayolu {
  etiket: string;
  bas: string;
  bit: string;
}

export function donemKisayollari(): DonemKisayolu[] {
  const bugun = new Date();
  const bit = iso(bugun);
  const ayBasi = new Date(Date.UTC(bugun.getUTCFullYear(), bugun.getUTCMonth(), 1));
  const gecenAyBasi = new Date(Date.UTC(bugun.getUTCFullYear(), bugun.getUTCMonth() - 1, 1));
  const gecenAySonu = new Date(ayBasi.getTime() - 864e5);
  const ucAy = new Date(Date.UTC(bugun.getUTCFullYear(), bugun.getUTCMonth() - 2, 1));
  const yilBasi = new Date(Date.UTC(bugun.getUTCFullYear(), 0, 1));

  return [
    { etiket: "Bu ay", bas: iso(ayBasi), bit },
    { etiket: "Geçen ay", bas: iso(gecenAyBasi), bit: iso(gecenAySonu) },
    { etiket: "Son 3 ay", bas: iso(ucAy), bit },
    { etiket: "Yılbaşından bugüne", bas: iso(yilBasi), bit },
  ];
}

export function DonemSecici({
  bas, bit, hedef, ekAlanlar = {},
}: {
  bas: string;
  bit: string;
  /** Formun gideceği sayfa. */
  hedef: string;
  /** Aralıkla birlikte korunacak diğer parametreler. */
  ekAlanlar?: Record<string, string>;
}) {
  const ekSorgu = Object.entries(ekAlanlar)
    .map(([k, v]) => `&${k}=${encodeURIComponent(v)}`).join("");

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5">
        {donemKisayollari().map((k) => {
          const secili = k.bas === bas && k.bit === bit;
          return (
            <Link key={k.etiket}
                  href={`${hedef}?bas=${k.bas}&bit=${k.bit}${ekSorgu}`}
                  className={`btn btn-sm ${secili ? "btn-primary" : "btn-secondary"}`}>
              {k.etiket}
            </Link>
          );
        })}
      </div>

      <form method="get" action={hedef} className="flex flex-wrap items-end gap-3">
        {Object.entries(ekAlanlar).map(([k, v]) => (
          <input key={k} type="hidden" name={k} value={v} />
        ))}
        <div>
          <label className="label" htmlFor="bas">Başlangıç</label>
          <input id="bas" name="bas" type="date" defaultValue={bas} className="input" />
        </div>
        <div>
          <label className="label" htmlFor="bit">Bitiş</label>
          <input id="bit" name="bit" type="date" defaultValue={bit} className="input" />
        </div>
        <button type="submit" className="btn btn-secondary">Uygula</button>
      </form>
    </div>
  );
}
