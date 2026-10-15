import { ASAMALAR } from "@/lib/asamalar";
import { fmtDate } from "@/lib/dates";
import type { EkipUyesiGorunum } from "@/server/asamalar-db";

/* ===========================================================================
   Dosyanın inceleme ekibi.

   Ekip kurulduktan sonra bir daha görünmüyordu; oysa "bu dosyaya kim baktı,
   hangi aşama kimdeydi" sorusu dosya kapandıktan sonra da sorulur — denetimde
   ilk sorulan budur. Kart dosya açıldığı sürece durur ve görevlendirmeyi
   kimin yaptığını da yazar.
   =========================================================================== */

export function Ekip({ uyeler, kurulma }: {
  uyeler: EkipUyesiGorunum[];
  kurulma: string | null;
}) {
  if (uyeler.length === 0) return null;

  return (
    <section className="card overflow-hidden">
      <h2 className="border-b border-ink-200 px-4 py-2.5 text-baslik font-semibold tracking-wide text-ink-700 uppercase">
        İnceleme ekibi{" "}
        <span className="font-normal text-ink-500 normal-case">
          ({uyeler.length} kişi{kurulma ? ` · ${fmtDate(kurulma)} tarihinde görevlendirildi` : ""})
        </span>
      </h2>

      <ul className="divide-y divide-ink-100">
        {uyeler.map((u) => (
          <li key={u.user_id} className="flex flex-col gap-1.5 px-4 py-3 sm:flex-row sm:items-start sm:gap-4">
            <div className="sm:w-64 sm:shrink-0">
              <p className="text-sm font-medium text-ink-900">
                {u.full_name}
                {u.is_lead === 1 && (
                  <span className="ml-2 rounded-full bg-brand-50 px-1.5 py-0.5 text-rozet font-semibold text-brand-700">
                    Ekip lideri
                  </span>
                )}
              </p>
              <p className="text-xs text-ink-500">{u.title}</p>
            </div>

            <div className="min-w-0 flex-1">
              {u.asamalar.length === 0 ? (
                <p className="text-sm text-ink-500">
                  Belirli bir aşamadan sorumlu değil; incelemeye katılır.
                </p>
              ) : (
                <ul className="flex flex-wrap gap-1.5">
                  {u.asamalar.map((kod) => (
                    <li key={kod}
                        className="rounded-full border border-ink-200 bg-ink-50 px-2 py-0.5 text-xs text-ink-700"
                        title={ASAMALAR[kod]?.baslik}>
                      {ASAMALAR[kod]?.kisa ?? kod}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
