"use client";

import { useMemo, useState } from "react";
import { ActionForm } from "@/components/action-form";
import { Notice } from "@/components/ui";
import { formTeamAction, redirectAction } from "@/app/panel/actions";

/* ===========================================================================
   Ekip kurma düzeneği.

   Fabrika Müdürünün burada iki işi vardır, üçüncüsü yoktur:
     1. ekibi seçmek,
     2. ekipten birini evrak sorumlusu işaretlemek.

   Müdür ekibin kaç kişi olacağını seçer; o kadar kişi kutusu belirir ve her
   kutuda önce unvan, sonra o unvandaki isim seçilir. Unvan listesi fabrikanın
   kadrosundan kendiliğinden gelir.

   Evrak sorumlusu ayrı bir listeden değil, kişinin kendi kutusundaki
   kutucuktan işaretlenir: seçim kimin üzerinde olduğu tek bakışta görünsün
   diye. Dosyanın fabrika tarafındaki bütün belgeli aşamaları — inceleme,
   karar, varsa itiraz, iade/değişim, resmî yazı — o kişiye düşer; dosya
   yalnızca onun ekranında görünür ve sürecin sonundaki müdür onayına kadar
   tek elden yürür.

   Aşamaları tek tek farklı kişilere dağıtmak, kimsenin dosyanın tamamını
   izlemediği bir süreç üretiyordu; onun yerine tek sorumlu konuldu.
   =========================================================================== */

export interface EkipPersoneli {
  id: number;
  full_name: string;
  title: string;
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

  /* --- Evrak sorumlusu ---------------------------------------------------- */

  /*
   * İşaretlenen kutunun sırası. Kutucuk kişinin yanında durduğu için seçim
   * satıra bağlıdır: o satırdaki isim değiştirilirse sorumluluk yeni isme
   * geçer. Satır boşaltılır ya da ekip küçültülürse seçim, kişisi seçilmiş
   * ilk satıra döner; böylece hiçbir anda sorumlusuz bir ekip görünmez.
   */
  const [isaretli, setIsaretli] = useState(0);
  const sorumlu = satirlar[isaretli]?.kisi
    ? isaretli
    : satirlar.findIndex((s) => s.kisi);

  const sorumluKisi = personel.find(
    (p) => String(p.id) === satirlar[sorumlu]?.kisi,
  );

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
              Dosya evrak sorumlusuna düşer:{" "}
              <strong className="font-semibold text-ink-700">
                {sorumluKisi?.full_name}
              </strong>
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

        <p className="text-xs leading-relaxed text-ink-500">
          Her kutuda önce unvan, sonra o unvandaki isim seçilir. Ardından ekip
          üyelerinden birinin yanındaki{" "}
          <strong className="font-semibold text-ink-700">Evrak sorumlusu</strong>{" "}
          kutucuğunu işaretleyin: dosyanın fabrika tarafındaki bütün belgeli
          aşamaları — inceleme, karar, varsa itiraz, iade/değişim, resmî yazı —
          o kişiye düşer ve dosya, sürecin sonundaki kapanış onayına kadar onun
          ekranında yürür. Kapanış onayı Fabrika Müdüründe, itiraz
          değerlendirmesi ilgili Daire Başkanlığında kalır.
        </p>

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
                className={
                  "rounded-[5px] border p-2.5 sm:p-3 " +
                  (sorumlu === i
                    ? "border-brand-300 bg-brand-50"
                    : "border-ink-200 bg-ink-50")
                }
              >
                <div className="mb-1.5 flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
                  <p className="text-xs font-semibold tracking-wide text-ink-500 uppercase">
                    {i + 1}. kişi
                  </p>
                  {/* Kutucuk ancak kutuda bir isim varken anlam taşır. */}
                  {s.kisi && (
                    <label className="flex cursor-pointer items-center gap-2 text-xs font-medium text-ink-700">
                      <input
                        type="radio"
                        name="evrakSorumlusu"
                        value={s.kisi}
                        checked={sorumlu === i}
                        onChange={() => setIsaretli(i)}
                        className="size-6 shrink-0 accent-brand-600"
                      />
                      Evrak sorumlusu
                    </label>
                  )}
                </div>
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
