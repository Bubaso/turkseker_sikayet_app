import Link from "next/link";
import { fmtDate, slaInfo, type HolidaySet } from "@/lib/dates";
import { fmtQuantity } from "@/lib/format";
import type { ComplaintView } from "@/lib/types";
import { Chip, EmptyState, SlaChip, StatusChip, VerdictChip } from "./ui";
import { BaslikFiltre, type FiltreSecenegi } from "./tablo-filtre";

export interface TableRowExtra {
  nextDue: string | null;
  nextTitle: string | null;
}

/**
 * Sütun başlıklarına düşecek filtreler. Verilmeyen sütunda ok çıkmaz; böylece
 * aynı tablo panoda filtresiz, listede filtreli kullanılır.
 */
export interface TabloFiltreleri {
  fabrika?: FiltreSecenegi[];
  tarih?: FiltreSecenegi[];
  konu?: FiltreSecenegi[];
  urun?: FiltreSecenegi[];
  durum?: FiltreSecenegi[];
  karar?: FiltreSecenegi[];
  sira?: FiltreSecenegi[];
}

/** Dosyanın yanındaki işaretler: gıda güvenliği ihbarı ve yönlendirme. */
function Isaretler({ c }: { c: ComplaintView }) {
  return (
    <>
      {c.category_critical === 1 && (
        <span className="align-middle" title="Gıda güvenliği ihbarı">
          <Chip tone="danger">GG</Chip>
        </span>
      )}
      {c.redirected_at && (
        <span className="align-middle" title="Başka fabrikadan yönlendirildi">
          <Chip tone="brand">↷</Chip>
        </span>
      )}
    </>
  );
}

/* ===========================================================================
   Şikâyet dosyaları listesi.

   Aynı veri iki düzende çizilir. Geniş ekranda on sütunlu tablo: operatör
   dosyaları yan yana karşılaştırır. Dar ekranda kart: 360px'lik bir ekranda
   bu tablo 1600px genişliğindeydi ve en çok bakılan sütun — durum — ekranın
   dışında kalıyordu; kullanıcı her dosya için yana kaydırmak zorundaydı.

   Kartta sıralama önceliğe göredir: kim (müşteri), ne (konu), nerede durduğu
   (durum, karar) ve sırada ne olduğu. Tarih, ürün ve miktar ikincil satırda
   kalır.
   =========================================================================== */
export function ComplaintTable({
  rows, extras, holidays, showFactory = false, emptyHint, filtreler,
}: {
  rows: ComplaintView[];
  extras: Record<number, TableRowExtra>;
  holidays: HolidaySet;
  showFactory?: boolean;
  emptyHint?: string;
  filtreler?: TabloFiltreleri;
}) {
  /** Filtre tanımlıysa başlığı okla, değilse düz metinle çizer. */
  function baslik(metin: string, secenekler?: FiltreSecenegi[]) {
    return secenekler ? <BaslikFiltre baslik={metin} secenekler={secenekler} /> : metin;
  }

  if (rows.length === 0 && !filtreler) {
    return (
      <EmptyState
        title="Kayıt bulunamadı"
        hint={emptyHint ?? "Seçtiğiniz filtrelere uyan şikâyet dosyası yok."}
      />
    );
  }

  const bosMesaj = emptyHint ?? "Seçtiğiniz filtrelere uyan şikâyet dosyası yok.";

  /*
   * Dar ekrandaki şerit için tanımlı süzgeçler. Sıra tablodakinden farklıdır:
   * kartta en çok bakılan süzgeçler (durum, karar) öne alınır, çünkü şerit
   * yatay kayar ve soldaki maddeler kaydırmadan görünür.
   */
  const suzgecler: [string, FiltreSecenegi[]][] = [];
  const ekle = (ad: string, s?: FiltreSecenegi[]) => { if (s) suzgecler.push([ad, s]); };
  ekle("Durum", filtreler?.durum);
  ekle("Karar", filtreler?.karar);
  if (showFactory) ekle("Fabrika", filtreler?.fabrika);
  ekle("Tarih", filtreler?.tarih);
  ekle("Konu", filtreler?.konu);
  ekle("Ürün", filtreler?.urun);
  ekle("Sıradaki adım", filtreler?.sira);

  return (
    <>
      {/* --- Dar ekran: kart listesi --------------------------------------- */}
      <div className="lg:hidden">
        {/* Kartta sütun başlığı yoktur; süzgeçler listenin üstünde yatay
            kaydırılan bir şeritte toplanır. Seçili olan dolu çizilir ve
            seçimi üzerinde yazar, böylece şerit aynı zamanda neyin açık
            olduğunun özetidir. */}
        {suzgecler.length > 0 && (
          <div className="-mx-px flex gap-1.5 overflow-x-auto border-b border-ink-100 px-4 py-2.5
                          [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {suzgecler.map(([ad, secenekler]) => (
              <BaslikFiltre key={ad} baslik={ad} secenekler={secenekler} gorunum="serit" />
            ))}
          </div>
        )}

        {rows.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-ink-500">{bosMesaj}</p>
        ) : (
          <ul className="divide-y divide-ink-100">
            {rows.map((c) => {
              const e = extras[c.id] ?? { nextDue: null, nextTitle: null };
              const sla = slaInfo(e.nextDue, null, holidays);
              return (
                <li key={c.id}>
                  {/* Kartın tamamı dokunma hedefidir: dar ekranda küçük bir
                      bağlantıya nişan almak gerekmez. */}
                  <Link
                    href={`/panel/sikayet/${c.id}`}
                    className="block px-4 py-3 transition-colors active:bg-brand-50"
                  >
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="font-mono text-xs font-semibold text-brand-700">
                        {c.complaint_no}
                      </span>
                      <Isaretler c={c} />
                      <span className="tnum ml-auto text-xs text-ink-500">
                        {fmtDate(c.received_at)}
                      </span>
                    </div>

                    <p className="mt-1.5 font-medium break-words text-ink-900">
                      {c.customer_company}
                    </p>
                    <p className="mt-0.5 text-sm break-words text-ink-600">{c.subject}</p>

                    {/*
                      Talep ("Ürünün iadesi + nakliye") listeden çıkarıldı:
                      masaüstünde zaten kırpılıp okunamıyordu, mobilde kartı
                      bir satır uzatıyordu. Dosyayı açan ilk ekranda görüyor.
                    */}
                    <p className="mt-1 text-xs text-ink-500">
                      {showFactory && <>{c.factory_short} · </>}
                      {c.province_name ?? "—"}
                      {" · "}{c.product_name}
                      {c.quantity_kg ? ` · ${fmtQuantity(c.quantity_kg)}` : ""}
                    </p>

                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      <StatusChip status={c.status} kisa />
                      <VerdictChip verdict={c.verdict} durum={c.status} bosGizle />
                    </div>

                    {e.nextTitle && (
                      <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 border-t border-ink-100 pt-2">
                        <span className="text-xs text-ink-600">Sırada: {e.nextTitle}</span>
                        <SlaChip sla={sla} compact />
                      </div>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* --- Geniş ekran: tam tablo ---------------------------------------- */}
      <div className="table-wrap hidden lg:block">
        <table className="tbl">
          <thead>
            <tr>
              <th>Şikâyet no</th>
              {showFactory && <th>{baslik("Fabrika", filtreler?.fabrika)}</th>}
              <th>{baslik("Tarih", filtreler?.tarih)}</th>
              <th>Müşteri</th>
              <th>{baslik("Konu", filtreler?.konu)}</th>
              <th className="hidden genis:table-cell">{baslik("Ürün", filtreler?.urun)}</th>
              <th className="hidden text-right genis:table-cell">Miktar</th>
              {/* Durum ve karar tek sütundadır: ikisi birlikte okunur ve
                  ayrı sütun dar masaüstünde tabloyu taşırıyordu. Başlık da
                  tek başlıktır, süzgeçleri yan yana durur. */}
              <th>
                <span className="inline-flex items-center gap-x-2">
                  {baslik("Durum", filtreler?.durum)}
                  {filtreler?.karar && (
                    <>
                      <span className="text-ink-400" aria-hidden>/</span>
                      {baslik("Karar", filtreler.karar)}
                    </>
                  )}
                  {!filtreler?.karar && " / Karar"}
                </span>
              </th>
              <th>{baslik("Sıradaki adım", filtreler?.sira)}</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={showFactory ? 9 : 8} className="px-4 py-10 text-center text-sm text-ink-500">
                  {bosMesaj}
                </td>
              </tr>
            )}
            {rows.map((c) => {
              const e = extras[c.id] ?? { nextDue: null, nextTitle: null };
              const sla = slaInfo(e.nextDue, null, holidays);
              return (
                <tr key={c.id}>
                  <td>
                    <Link href={`/panel/sikayet/${c.id}`}
                          className="font-mono text-xs font-semibold whitespace-nowrap text-brand-700 hover:underline">
                      {c.complaint_no}
                    </Link>
                    {/* İşaretler gerekirse alt satıra iner; sütunu genişletmezler. */}
                    <span className="mt-0.5 flex flex-wrap gap-1"><Isaretler c={c} /></span>
                  </td>
                  {showFactory && <td className="whitespace-nowrap text-ink-600">{c.factory_short}</td>}
                  <td className="tnum whitespace-nowrap text-ink-600">{fmtDate(c.received_at)}</td>
                  <td className="max-w-[10rem] genis:max-w-[14rem]">
                    <span className="block truncate font-medium text-ink-800" title={c.customer_company}>
                      {c.customer_company}
                    </span>
                    <span className="block truncate text-xs text-ink-500">
                      {c.province_name ?? "—"}
                    </span>
                  </td>
                  <td className="max-w-[12rem] genis:max-w-[18rem]">
                    <span className="block truncate" title={c.subject}>{c.subject}</span>
                    {c.category_name && (
                      <span className="block truncate text-xs text-ink-500">{c.category_name}</span>
                    )}
                  </td>
                  <td className="hidden max-w-[12rem] genis:table-cell">
                    <span className="block truncate text-ink-700">{c.product_name}</span>
                    {c.lot_no && <span className="block truncate text-xs text-ink-500">Lot {c.lot_no}</span>}
                  </td>
                  <td className="tnum hidden text-right whitespace-nowrap text-ink-700 genis:table-cell">
                    {c.quantity_kg ? fmtQuantity(c.quantity_kg) : "—"}
                  </td>
                  <td>
                    {/* Yan yana; yer kalmazsa alta sarar, satır yüksekliğini
                        gereksiz yere iki katına çıkarmaz. */}
                    <span className="flex flex-wrap items-center gap-1">
                      <StatusChip status={c.status} kisa />
                      <VerdictChip verdict={c.verdict} durum={c.status} bosGizle nokta={false} />
                    </span>
                  </td>
                  <td className="max-w-[10rem] genis:max-w-[14rem]">
                    {e.nextTitle ? (
                      <>
                        <span className="block truncate text-xs text-ink-700" title={e.nextTitle}>
                          {e.nextTitle}
                        </span>
                        <span className="mt-0.5 block"><SlaChip sla={sla} compact /></span>
                      </>
                    ) : (
                      <span className="text-xs text-ink-400">Açık görev yok</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
