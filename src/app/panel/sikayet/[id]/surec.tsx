/* ===========================================================================
   Süreç — dosyanın aşamaları ve kayıt formları.

   Her aşama tek bir kutudur. Kapanmış aşama tarihini, kaydedeni ve yüklenen
   belgeyi gösterir; sırası gelmiş aşama kayıt formunu açar; sırası gelmemiş
   aşama neyi beklediğini yazar. Uygulama belge üretmez: kayıt, dışarıda
   hazırlanmış belgenin yüklenmesiyle tamamlanır.
   =========================================================================== */

import { ASAMA, ASAMALAR, type AsamaKodu } from "@/lib/asamalar";
import { VERDICT } from "@/lib/domain";
import { fmtDate, fmtDateTime } from "@/lib/dates";
import { fmtBytes } from "@/lib/format";
import type { EsikSonucu } from "@/lib/esik";
import type { AttachmentView, ComplaintView } from "@/lib/types";
import type { AsamaGorunumu } from "@/server/asamalar-db";
import { ActionForm } from "@/components/action-form";
import { Chip } from "@/components/ui";
import {
  asamaAction, asamaGerekmezAction, assignTaskAction, closeAction,
} from "@/app/panel/actions";
import { EkipKur, type EkipPersoneli } from "./ekip-kur";

export interface SurecVerisi {
  c: ComplaintView;
  asamalar: AsamaGorunumu[];
  /** Aşama koduna göre o aşamada yüklenmiş belgeler. */
  belgeler: Record<string, AttachmentView[]>;
  bugun: string;
  esik: EsikSonucu;
  /** Fabrika Müdürü (ya da sistem yöneticisi): sorumlu değiştirip aşama atlayabilir. */
  mudur: boolean;
  personel: EkipPersoneli[];
  fabrikalar: { id: number; name: string }[];
  oneri: { id: number; name: string } | null;
  accept: string;
  maxMb: number;
}

export function Surec(v: SurecVerisi) {
  return (
    <ol className="space-y-3">
      {v.asamalar.map((a, i) => (
        <AsamaKutusu key={a.id} a={a} sira={i + 1} v={v} />
      ))}
    </ol>
  );
}

function AsamaKutusu({ a, sira, v }: { a: AsamaGorunumu; sira: number; v: SurecVerisi }) {
  const kod = a.code as AsamaKodu;
  const tanim = ASAMALAR[kod];
  const atlandi = a.status === "GEREKSIZ";
  const belgeler = v.belgeler[kod] ?? [];
  const acikForm = a.islenebilir && !v.c.closed_at;

  return (
    <li
      className={`card overflow-hidden ${
        acikForm ? "border-brand-300 ring-1 ring-brand-100" : ""
      }`}
    >
      <div className="flex items-start gap-3 px-4 py-3">
        <Isaretci kapandi={a.kapandi} atlandi={atlandi} sirasiGeldi={a.sirasiGeldi} sira={sira} />

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <p className={`text-sm font-semibold ${a.kapandi ? "text-ink-600" : "text-ink-900"}`}>
              {a.title}
            </p>
            {atlandi && <Chip tone="ink">Gerek görülmedi</Chip>}
            {acikForm && <Chip tone="brand" dot>Sıra sizde</Chip>}
            {!a.kapandi && !a.sirasiGeldi && <Chip tone="ink">Sırası gelmedi</Chip>}
            {a.belgeli && !a.kapandi && <Chip tone="warn">Belge yüklenir</Chip>}
          </div>

          <p className="mt-1 text-xs text-ink-500">
            {a.kapandi ? (
              <>
                {fmtDateTime(a.completed_at)}
                {a.completed_by_name && <> · {a.completed_by_name} kaydetti</>}
              </>
            ) : (
              <>
                Sorumlu:{" "}
                {a.assignee_name
                  ? `${a.assignee_name} (${a.assignee_title})`
                  : "atanmadı"}
                {a.due_at && <> · en geç {fmtDate(a.due_at)}</>}
              </>
            )}
          </p>

          {a.result_note && (
            <p className="mt-1.5 text-sm whitespace-pre-wrap text-ink-600">{a.result_note}</p>
          )}

          {belgeler.length > 0 && (
            <ul className="mt-1.5 space-y-0.5">
              {belgeler.map((b) => (
                <li key={b.id} className="text-sm">
                  <a href={`/api/ek/${b.id}`} target="_blank" rel="noreferrer" className="link">
                    {b.file_name}
                  </a>
                  <span className="ml-1.5 text-xs text-ink-500">{fmtBytes(b.size)}</span>
                </li>
              ))}
            </ul>
          )}

          {!a.kapandi && !a.sirasiGeldi && a.bekleyen.length > 0 && (
            <p className="mt-1.5 text-sm text-ink-600">
              Önce tamamlanmalı: {a.bekleyen.map((b) => b.baslik).join("; ")}.
            </p>
          )}

          {!a.kapandi && a.sirasiGeldi && !a.islenebilir && (
            <p className="mt-1.5 text-sm text-ink-600">
              Bu aşamayı sorumlusu ya da Fabrika Müdürü kaydeder.
            </p>
          )}
        </div>
      </div>

      {acikForm && (
        <div className="border-t border-ink-200 bg-ink-50 px-4 py-3.5">
          <p className="mb-3 max-w-[72ch] text-sm leading-relaxed text-ink-600">
            {tanim.aciklama}
          </p>
          {kod === ASAMA.EKIP ? (
            <EkipKur
              complaintId={v.c.id}
              personel={v.personel}
              sonTarih={fmtDate(v.c.due_team_at)}
              fabrikalar={v.fabrikalar}
              mevcutFabrikaId={v.c.factory_id}
              oneri={v.oneri}
            />
          ) : kod === ASAMA.KAPANIS ? (
            <ActionForm action={closeAction} complaintId={v.c.id} submitLabel="Dosyayı kapat"
                        confirm="Dosya kapatılacak ve müşteriye bilgi verilecek. Onaylıyor musunuz?">
              <div>
                <label className="label" htmlFor="note">Kapanış notu</label>
                <textarea id="note" name="note" rows={3} className="input" required
                          placeholder="Yapılan işlemlerin özeti — müşteriye gönderilen bildirimde de yer alır." />
              </div>
            </ActionForm>
          ) : (
            <KayitFormu kod={kod} v={v} />
          )}

          {v.mudur && kod !== ASAMA.KAPANIS && (
            <YonetimSecenekleri a={a} kod={kod} v={v} />
          )}
        </div>
      )}
    </li>
  );
}

/** Belgeli aşamaların tek tip kayıt formu: tarih + açıklama + belge. */
function KayitFormu({ kod, v }: { kod: AsamaKodu; v: SurecVerisi }) {
  const tanim = ASAMALAR[kod];
  return (
    <ActionForm action={asamaAction} complaintId={v.c.id} submitLabel="Kaydet ve aşamayı kapat">
      <input type="hidden" name="asama" value={kod} />

      {kod === ASAMA.KARAR && (
        <fieldset>
          <legend className="label">Şikâyet haklı bulundu mu?</legend>
          <div className="space-y-1.5">
            <label className="flex items-start gap-2 text-sm">
              <input type="radio" name="karar" value={VERDICT.HAKLI} required className="mt-1" />
              <span>
                <strong className="font-semibold">Haklı</strong> — iade/değişim yapılacak,
                talep varsa nakliye bedeli ödenecek.
              </span>
            </label>
            <label className="flex items-start gap-2 text-sm">
              <input type="radio" name="karar" value={VERDICT.HAKSIZ} required className="mt-1" />
              <span>
                <strong className="font-semibold">Haklı bulunmadı</strong> —{" "}
                {v.esik.required
                  ? "miktar eşiği aşıldığı için dosya Daire Başkanlığına gönderilecek."
                  : "karar fabrika düzeyinde kesinleşir."}
              </span>
            </label>
          </div>
          <span className="hint">{v.esik.reason}</span>
        </fieldset>
      )}

      {kod === ASAMA.DAIRE_KARAR && (
        <fieldset>
          <legend className="label">Daire Başkanlığı kararı</legend>
          <div className="space-y-1.5">
            <label className="flex items-start gap-2 text-sm">
              <input type="radio" name="itirazKabul" value="1" required className="mt-1" />
              <span>
                <strong className="font-semibold">Şikâyet haklı</strong> — iade/değişim süreci
                açılır, 5 iş günlük süre bu tarihten başlar.
              </span>
            </label>
            <label className="flex items-start gap-2 text-sm">
              <input type="radio" name="itirazKabul" value="0" required className="mt-1" />
              <span>
                <strong className="font-semibold">Fabrika kararı yerinde</strong> — dosya
                müşteriye yazılı bildirimle kapatılır.
              </span>
            </label>
          </div>
        </fieldset>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[11rem_1fr]">
        <div>
          <label className="label" htmlFor={`tarih-${kod}`}>İşlem tarihi</label>
          <input id={`tarih-${kod}`} name="tarih" type="date" className="input"
                 defaultValue={v.bugun} max={v.bugun} required />
        </div>
        <div>
          <label className="label" htmlFor={`not-${kod}`}>Kısa açıklama</label>
          <input id={`not-${kod}`} name="not" className="input" required
                 placeholder={ipucu(kod)} />
        </div>
      </div>

      {kod === ASAMA.ISLEM && (
        <fieldset>
          <legend className="label">
            Gerçekleşme tutarları{" "}
            <span className="font-normal text-ink-500">— isteğe bağlı</span>
          </legend>
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            <div>
              <label className="label text-xs" htmlFor="iadeKg">İade (kg)</label>
              <input id="iadeKg" name="iadeKg" inputMode="decimal" className="input" />
            </div>
            <div>
              <label className="label text-xs" htmlFor="degisimKg">Değişim (kg)</label>
              <input id="degisimKg" name="degisimKg" inputMode="decimal" className="input" />
            </div>
            <div>
              <label className="label text-xs" htmlFor="bedel">İade bedeli (TL)</label>
              <input id="bedel" name="bedel" inputMode="decimal" className="input" />
            </div>
            <div>
              <label className="label text-xs" htmlFor="nakliye">Nakliye (TL)</label>
              <input id="nakliye" name="nakliye" inputMode="decimal" className="input" />
            </div>
          </div>
          <span className="hint">
            Yalnızca Genel Müdürlüğe giden aylık tablo ve maliyet takibi için; aşamayı kapatan
            şey yüklenen belgedir.
          </span>
        </fieldset>
      )}

      {tanim.belgeli && (
        <div>
          <label className="label" htmlFor={`belge-${kod}`}>{tanim.belgeAdi}</label>
          <input id={`belge-${kod}`} name="belge" type="file" multiple required
                 accept={v.accept}
                 className="input file:mr-3 file:rounded file:border-0 file:bg-ink-100 file:px-3 file:py-1.5 file:text-sm" />
          <span className="hint">
            Belge fabrikada hazırlanır ve imzalanır; buraya yalnızca son hâli yüklenir.
            Her dosya en çok {v.maxMb} MB (PDF, JPG, PNG, Word, Excel).
          </span>
        </div>
      )}
    </ActionForm>
  );
}

function ipucu(kod: AsamaKodu): string {
  switch (kod) {
    case ASAMA.INCELEME: return "Örnek: Yerinde inceleme yapıldı, 2 kg numune alındı.";
    case ASAMA.KARAR: return "Kararın gerekçesi — müşteriye de bu gerekçe bildirilir.";
    case ASAMA.ITIRAZ: return "Örnek: 2026/142 sayılı üst yazıyla gönderildi.";
    case ASAMA.DAIRE_KARAR: return "Kararın gerekçesi.";
    case ASAMA.ISLEM: return "Örnek: 1.200 kg iade alındı, nakliye bedeli ödendi.";
    case ASAMA.RESMI_YAZI: return "Örnek: 2026/142 sayılı yazı dört daireye gönderildi.";
    default: return "Kısa açıklama";
  }
}

/** Fabrika Müdürünün aşama üzerindeki iki yetkisi: sorumluyu değiştir, aşamayı atla. */
function YonetimSecenekleri({
  a, kod, v,
}: {
  a: AsamaGorunumu;
  kod: AsamaKodu;
  v: SurecVerisi;
}) {
  return (
    <details className="mt-3 border-t border-ink-200 pt-2.5">
      <summary className="cursor-pointer text-xs font-medium text-ink-500">
        Bu aşamayı devret veya atla
      </summary>
      <div className="mt-3 grid grid-cols-1 gap-4 lg:grid-cols-2">
        {a.department_id === null && (
          <ActionForm action={assignTaskAction} complaintId={v.c.id} compact
                      submitLabel="Sorumluyu değiştir" submitTone="secondary">
            <input type="hidden" name="taskId" value={a.id} />
            <div>
              <label className="label" htmlFor={`assignee-${kod}`}>Yeni sorumlu</label>
              <select id={`assignee-${kod}`} name="assigneeId" className="input" required
                      defaultValue={a.assignee_id ?? ""}>
                <option value="">Seçiniz…</option>
                {v.personel.map((p) => (
                  <option key={p.id} value={p.id}>{p.full_name} — {p.title}</option>
                ))}
              </select>
            </div>
          </ActionForm>
        )}
        <ActionForm action={asamaGerekmezAction} complaintId={v.c.id} compact
                    submitLabel="Gerek yok olarak işaretle" submitTone="secondary"
                    confirm="Aşama atlanmış sayılacak. Onaylıyor musunuz?">
          <input type="hidden" name="asama" value={kod} />
          <div>
            <label className="label" htmlFor={`gerekce-${kod}`}>Gerekçe</label>
            <input id={`gerekce-${kod}`} name="gerekce" className="input" required
                   placeholder="Örnek: Müşteri yalnızca bilgi talep etti." />
          </div>
        </ActionForm>
      </div>
    </details>
  );
}

function Isaretci({
  kapandi, atlandi, sirasiGeldi, sira,
}: {
  kapandi: boolean;
  atlandi: boolean;
  sirasiGeldi: boolean;
  sira: number;
}) {
  const gorunum = atlandi
    ? "border-ink-300 bg-ink-200 text-ink-500"
    : kapandi
      ? "border-ok-600 bg-ok-600 text-white"
      : sirasiGeldi
        ? "border-brand-600 bg-white text-brand-700"
        : "border-ink-300 bg-white text-ink-400";
  return (
    <span
      className={`mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full border text-rozet font-semibold ${gorunum}`}
      aria-hidden
    >
      {atlandi ? "–" : kapandi ? "✓" : sira}
    </span>
  );
}
