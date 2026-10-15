"use client";

import { useMemo, useState } from "react";
import { ActionForm } from "@/components/action-form";
import { Notice } from "@/components/ui";
import { ASAMALAR, EKIP_ASAMALARI } from "@/lib/asamalar";
import { ROLE_LABEL as ROL_ADI } from "@/lib/roles";
import { formTeamAction, redirectAction } from "@/app/panel/actions";

/* ===========================================================================
   Ekip kurma düzeneği.

   İki adım: önce ekip, sonra görevlendirme.

   Fabrika Müdürü ekibin kaç kişi olacağını seçer; o kadar kişi kutusu belirir
   ve her kutuda önce unvan, sonra o unvandaki isim seçilir. Unvan listesi
   fabrikanın kadrosundan kendiliğinden gelir.

   Ardından fabrikada elle yürüyen dört belgeli aşamanın her birinin kime
   düşeceği seçilir. Varsayılan, aşamanın unvanına uyan ekip üyesidir; yoksa
   ekip lideri. Bu dağıtım saklanır ve karar sonrası açılan aşamalar da
   (iade/değişim, resmî yazı) buradan okunur — yani iş akışı müdürün dediği
   kişiye göre kurulur, unvana göre değil.
   =========================================================================== */

export interface EkipPersoneli {
  id: number;
  full_name: string;
  title: string;
  /** Varsayılan görevlendirmede aşamanın rolüyle eşleştirmek için. */
  role: string;
}

const EN_AZ = 1;
const EN_COK = 8;
const VARSAYILAN = 3;

export function EkipKur({
  complaintId, personel, sonTarih, fabrikalar, mevcutFabrikaId, oneri,
}: {
  complaintId: number;
  personel: EkipPersoneli[];
  sonTarih: string;
  fabrikalar: { id: number; name: string }[];
  mevcutFabrikaId: number;
  /** Müşterinin iline daha yakın fabrika önerisi. */
  oneri: { id: number; name: string } | null;
}) {
  const unvanlar = useMemo(
    () =>
      Array.from(new Set(personel.map((p) => p.title)))
        .sort((a, b) => a.localeCompare(b, "tr")),
    [personel],
  );

  const [satirlar, setSatirlar] = useState<{ unvan: string; kisi: string }[]>(() =>
    Array.from({ length: VARSAYILAN }, () => ({ unvan: "", kisi: "" })),
  );

  function sayiyiDegistir(n: number) {
    setSatirlar((eski) =>
      Array.from({ length: n }, (_, i) => eski[i] ?? { unvan: "", kisi: "" }),
    );
  }

  function unvanSec(i: number, unvan: string) {
    setSatirlar((eski) =>
      eski.map((s, j) => {
        if (j !== i) return s;
        // Unvanda tek kişi varsa isim kutusu kendiliğinden dolar.
        const adaylar = personel.filter((p) => p.title === unvan);
        return { unvan, kisi: adaylar.length === 1 ? String(adaylar[0].id) : "" };
      }),
    );
  }

  function kisiSec(i: number, kisi: string) {
    setSatirlar((eski) => eski.map((s, j) => (j === i ? { ...s, kisi } : s)));
  }

  const secilenler = satirlar.map((s) => s.kisi).filter(Boolean);
  const eksik = satirlar.some((s) => !s.kisi);

  /* --- Aşama görevlendirmesi --------------------------------------------- */

  // Ekibe seçilmiş kişiler, seçildikleri sırayla. İlk kişi ekip lideridir.
  const ekip = useMemo(
    () =>
      satirlar
        .map((s) => personel.find((p) => String(p.id) === s.kisi))
        .filter((p): p is EkipPersoneli => !!p),
    [satirlar, personel],
  );

  // Kullanıcının elle değiştirdiği aşamalar. Dokunulmayanlar varsayılanı izler.
  const [elle, setElle] = useState<Record<string, string>>({});

  /*
   * Aşamanın varsayılan sorumlusu: unvanı aşamanın rolüne uyan kişi — önce
   * ekipten, yoksa fabrikanın kadrosundan. İade/değişim ambarın, resmî yazı
   * kalitenin işidir ve bu kişiler inceleme ekibinde olmayabilir.
   */
  function varsayilan(kod: string): string {
    const rol = ASAMALAR[kod as keyof typeof ASAMALAR]?.rol;
    const ekipten = ekip.find((p) => p.role === rol);
    if (ekipten) return String(ekipten.id);
    const fabrikadan = personel.find((p) => p.role === rol);
    return String((fabrikadan ?? ekip[0])?.id ?? "");
  }

  function gorevli(kod: string): string {
    const secim = elle[kod];
    // Elle seçilen kişi kadrodan çıkmışsa varsayılana dönülür.
    if (secim && personel.some((p) => String(p.id) === secim)) return secim;
    return varsayilan(kod);
  }

  // Seçim listesi: önce ekip, sonra fabrikanın geri kalanı.
  const ekipDisi = personel.filter((p) => !ekip.some((e) => e.id === p.id));

  return (
    <div className="space-y-4">
      <ActionForm
        action={formTeamAction}
        complaintId={complaintId}
        submitLabel="Ekibi oluştur"
        disabled={eksik}
        extra={
          eksik ? (
            <span className="text-xs text-ink-500">
              Her kutuda unvan ve isim seçilmelidir.
            </span>
          ) : (
            <span className="text-xs text-ink-500">
              İlk sıradaki kişi ekip lideri olur. Aşamalar aşağıdaki görevlendirmeye
              göre dağıtılır.
            </span>
          )
        }
      >
        <div>
          <label className="label" htmlFor="kisiSayisi">Ekip kaç kişi olacak?</label>
          <select
            id="kisiSayisi"
            className="input sm:max-w-[12rem]"
            value={satirlar.length}
            onChange={(e) => sayiyiDegistir(Number(e.target.value))}
          >
            {Array.from({ length: EN_COK - EN_AZ + 1 }, (_, i) => i + EN_AZ).map((n) => (
              <option key={n} value={n}>{n} kişi</option>
            ))}
          </select>
          <span className="hint">
            Ekip en geç {sonTarih} tarihine kadar görevlendirilmelidir.
          </span>
        </div>

        <ol className="space-y-2.5">
          {satirlar.map((s, i) => {
            const adaylar = personel.filter(
              (p) =>
                p.title === s.unvan &&
                (String(p.id) === s.kisi || !secilenler.includes(String(p.id))),
            );
            return (
              <li
                key={i}
                className="rounded-[5px] border border-ink-200 bg-ink-50 p-2.5 sm:p-3"
              >
                <p className="mb-1.5 text-xs font-semibold tracking-wide text-ink-500 uppercase">
                  {i + 1}. kişi{i === 0 && " — ekip lideri"}
                </p>
                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                  <div>
                    <label className="label" htmlFor={`unvan_${i}`}>Unvan / birim</label>
                    <select
                      id={`unvan_${i}`}
                      name={`unvan_${i}`}
                      className="input"
                      value={s.unvan}
                      onChange={(e) => unvanSec(i, e.target.value)}
                    >
                      <option value="">Seçiniz…</option>
                      {unvanlar.map((u) => (
                        <option key={u} value={u}>{u}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="label" htmlFor={`uye_${i}`}>Adı soyadı</label>
                    <select
                      id={`uye_${i}`}
                      name={`uye_${i}`}
                      className="input"
                      value={s.kisi}
                      disabled={!s.unvan}
                      onChange={(e) => kisiSec(i, e.target.value)}
                    >
                      <option value="">{s.unvan ? "Seçiniz…" : "Önce unvan seçin"}</option>
                      {adaylar.map((p) => (
                        <option key={p.id} value={p.id}>{p.full_name}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </li>
            );
          })}
        </ol>

        {/* Aşama görevlendirmesi — ekip seçildikten sonra anlam kazanır. */}
        {ekip.length > 0 && (
          <fieldset className="rounded-[5px] border border-ink-200 p-3 sm:p-4">
            <legend className="px-1 text-baslik font-semibold tracking-wide text-ink-700 uppercase">
              Hangi aşama kimde?
            </legend>
            <p className="mb-3 text-xs text-ink-500">
              Fabrikada elle yürüyen aşamaların sorumlusu. Varsayılan olarak unvanı
              uyan kişi gelir; değiştirebilirsiniz. Ekip dışından da
              görevlendirebilirsiniz — iade/değişim ambarın, resmî yazı kalitenin
              işidir. Karar sonrası açılacak aşamalar da bu dağıtıma göre atanır.
            </p>
            <ul className="space-y-2.5">
              {EKIP_ASAMALARI.map((kod) => {
                const a = ASAMALAR[kod];
                const deger = gorevli(kod);
                return (
                  <li key={kod} className="grid grid-cols-1 gap-1.5 sm:grid-cols-[1fr_16rem] sm:items-center sm:gap-3">
                    <label className="text-sm text-ink-800" htmlFor={`gorev_${kod}`}>
                      {a.baslik}
                      <span className="block text-xs text-ink-500">
                        Varsayılan: {ROL_ADI[a.rol] ?? a.rol}
                      </span>
                    </label>
                    <select
                      id={`gorev_${kod}`}
                      name={`gorev_${kod}`}
                      className="input"
                      value={deger}
                      onChange={(e) => setElle((o) => ({ ...o, [kod]: e.target.value }))}
                    >
                      <optgroup label="İnceleme ekibi">
                        {ekip.map((p, i) => (
                          <option key={p.id} value={p.id}>
                            {p.full_name} — {p.title}{i === 0 ? " (lider)" : ""}
                          </option>
                        ))}
                      </optgroup>
                      {ekipDisi.length > 0 && (
                        <optgroup label="Fabrikanın diğer personeli">
                          {ekipDisi.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.full_name} — {p.title}
                            </option>
                          ))}
                        </optgroup>
                      )}
                    </select>
                  </li>
                );
              })}
            </ul>
          </fieldset>
        )}

        <div>
          <label className="label" htmlFor="note">Görevlendirme notu (isteğe bağlı)</label>
          <input id="note" name="note" className="input"
                 placeholder="Örnek: İnceleme 2 gün içinde müşteri işletmesinde yapılacak." />
        </div>
      </ActionForm>

      <details className="rounded-[5px] border border-ink-200 px-3 py-2">
        <summary className="cursor-pointer text-sm font-medium text-ink-700">
          Dosyayı başka bir fabrikaya yönlendir
        </summary>
        <div className="mt-3 space-y-3">
          {oneri && (
            <Notice tone="info" title="Daha yakın fabrika">
              Müşterinin iline en yakın fabrikamız <strong>{oneri.name}</strong>. Dosya oraya
              yönlendirilirse ekip orada kurulur ve 1 iş günlük süre yeniden başlar.
            </Notice>
          )}
          <ActionForm
            action={redirectAction}
            complaintId={complaintId}
            submitLabel="Yönlendir"
            submitTone="secondary"
            confirm="Dosya seçilen fabrikaya devredilecek. Onaylıyor musunuz?"
          >
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="label" htmlFor="toFactoryId">Hedef fabrika</label>
                <select id="toFactoryId" name="toFactoryId" className="input" required
                        defaultValue={oneri?.id ?? ""}>
                  <option value="">Seçiniz…</option>
                  {fabrikalar.filter((f) => f.id !== mevcutFabrikaId).map((f) => (
                    <option key={f.id} value={f.id}>{f.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label" htmlFor="reason">Gerekçe</label>
                <input id="reason" name="reason" className="input" required
                       placeholder="Örnek: Müşteri adresine en yakın fabrika." />
              </div>
            </div>
          </ActionForm>
        </div>
      </details>
    </div>
  );
}
