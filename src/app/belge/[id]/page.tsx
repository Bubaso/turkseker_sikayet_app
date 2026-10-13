import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { all, one } from "@/lib/db";
import {
  DEMAND_LABEL, DOC_TYPE, DOC_TYPE_CODE, DOC_TYPE_LABEL, PRODUCT_GROUP_LABEL,
  type Demand, type DocType, type ProductGroup,
} from "@/lib/domain";
import { fmtDate, fmtDateLong, fmtDateTime } from "@/lib/dates";
import { fmtPhone, fmtQuantity, fmtTl } from "@/lib/format";
import { canAccessFactory, currentUser } from "@/server/auth";
import { getDocument } from "@/server/documents";
import { getComplaint } from "@/server/complaints";
import { complaintAnalyses, complaintSamples } from "@/server/lab";
import { PrintToolbar } from "./toolbar";

export const metadata: Metadata = { title: "Belge" };
export const dynamic = "force-dynamic";

interface Body {
  verdict?: string; verdictReason?: string; decision?: string; note?: string | null;
  visitedAt?: string | null; inspectionNote?: string | null; labSkipReason?: string | null;
  exchange?: boolean; freight?: boolean; explanation?: string;
  returnedKg?: number; exchangedKg?: number; freightAmount?: number; transactionDate?: string | null;
}

export default async function DocumentPrintPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await currentUser();
  if (!user) redirect(`/giris?next=/belge/${id}`);

  const doc = getDocument(Number(id));
  if (!doc) notFound();
  const c = getComplaint(doc.complaint_id);
  if (!c) notFound();
  if (!canAccessFactory(user, c.factory_id)) redirect("/panel/sikayetler");

  const body: Body = doc.body ? JSON.parse(doc.body) : {};
  const type = doc.type as DocType;
  const samples = complaintSamples(c.id);
  const analyses = complaintAnalyses(c.id);
  const letters = all<{ letter_no: string; sent_at: string }>(
    "SELECT letter_no, sent_at FROM official_letters WHERE complaint_id = ? ORDER BY id", c.id,
  );
  const settings = one<{ value: string }>("SELECT value FROM settings WHERE key = 'kurum_adi'");
  const kurum = settings?.value ?? "Türkiye Şeker Fabrikaları A.Ş.";

  const isTutanak = type === DOC_TYPE.FR_PASAT_004 || type === DOC_TYPE.FR_PASAT_005
    || type === DOC_TYPE.INCELEME_TUTANAGI;

  return (
    <div className="min-h-screen bg-ink-200 py-6 print:bg-white print:py-0">
      <PrintToolbar complaintId={c.id} docNo={doc.doc_no} />

      <article className="print-page mx-auto w-[210mm] max-w-full bg-white p-[18mm_16mm] text-[11pt] leading-relaxed text-black shadow-sm print:w-auto print:shadow-none">
        {/* Antet */}
        <header className="mb-6 border-b-2 border-black pb-2.5 text-center">
          <p className="text-[13pt] font-bold tracking-wide">{kurum.toLocaleUpperCase("tr-TR")}</p>
          <p className="text-[11pt]">{c.factory_name.toLocaleUpperCase("tr-TR")}</p>
          <p className="mt-2.5 text-[12pt] font-bold">
            {(DOC_TYPE_LABEL[type] ?? "BELGE").toLocaleUpperCase("tr-TR")}
          </p>
          <div className="mt-1.5 flex justify-between text-[9pt]">
            <span>Doküman kodu: {DOC_TYPE_CODE[type]}</span>
            <span>Belge no: {doc.doc_no}</span>
            <span>Şikâyet no: {c.complaint_no}</span>
          </div>
        </header>

        {/* ---------- FR PASAT 007: Müşteri Şikâyet Formu ---------- */}
        {type === DOC_TYPE.FR_PASAT_007 && (
          <table className="w-full border-collapse text-[10.5pt]">
            <tbody>
              {[
                ["ÜRETİCİ ŞEKER FABRİKASI", c.origin_factory_name ?? c.factory_name],
                ["ŞİKÂYET NUMARASI / TARİH", `${c.complaint_no} / ${fmtDate(c.received_at)}`],
                ["ŞİKÂYETİ ALAN", c.received_by_name ?? "Çevrim içi başvuru (müşteri)"],
                ["ÜRÜN ADI", `${c.product_name}${c.packaging ? ` — ${c.packaging}` : ""}`],
                ["ÜRÜN MİKTARI", c.quantity_kg ? fmtQuantity(c.quantity_kg) : "—"],
                ["PARTİ / LOT NO", c.lot_no ?? "—"],
                ["ŞİKÂYET KONUSU", `${c.subject}${c.description ? `\n\n${c.description}` : ""}`],
                [
                  "ŞİKÂYET SAHİBİ\n(Firma adı, ünvan, isim)",
                  [c.customer_company, c.customer_title, c.customer_name].filter(Boolean).join("\n"),
                ],
                ["ADRES", [c.customer_address, c.province_name].filter(Boolean).join("\n") || "—"],
                ["TELEFON", fmtPhone(c.customer_phone)],
                ["E-MAIL", c.customer_email ?? "—"],
                ["ŞİKÂYETÇİ TALEBİ", DEMAND_LABEL[c.demand as Demand] ?? c.demand],
                [
                  "KANITLAR (Görseller vb.)",
                  (() => {
                    const n = all<{ file_name: string }>(
                      "SELECT file_name FROM attachments WHERE complaint_id = ? AND kind = 'KANIT'", c.id,
                    );
                    return n.length ? n.map((x) => `• ${x.file_name}`).join("\n") : "Ek yok";
                  })(),
                ],
              ].map(([label, value]) => (
                <tr key={label}>
                  <th className="w-[34%] border border-black p-2 text-left align-top font-semibold whitespace-pre-line">
                    {label}
                  </th>
                  <td className="border border-black p-2 align-top whitespace-pre-line">{value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* ---------- Tutanaklar ---------- */}
        {isTutanak && (
          <>
            <section className="space-y-3.5 text-justify">
              {type === DOC_TYPE.FR_PASAT_004 && (
                <p>
                  <strong>{c.factory_name}</strong> deposundan{" "}
                  <strong>{fmtDate(c.delivery_date ?? c.received_at)}</strong> tarihinde{" "}
                  <strong>{c.customer_company}</strong> firmasına satışı yapılan{" "}
                  <strong>{c.quantity_kg ? fmtQuantity(c.quantity_kg) : "—"}</strong>{" "}
                  <strong>{c.product_name}</strong> ile ilgili firmanın{" "}
                  <strong>{fmtDate(c.received_at)}</strong> tarihli
                  {body.exchange ? " ürün değişimi" : " ürün iadesi"} talebi üzerine,{" "}
                  <strong>{c.factory_name}</strong> tarafından görevlendirilen yetkililerce yapılan
                  incelemeler sonucunda aşağıda belirtildiği şekilde söz konusu{" "}
                  <strong>{c.quantity_kg ? fmtQuantity(c.quantity_kg) : "—"}</strong>{" "}
                  <strong>{c.product_name}</strong>{" "}
                  {body.exchange ? "değişiminin" : "iadesinin"} uygun olduğu kararlaştırılmıştır.
                </p>
              )}

              {type === DOC_TYPE.FR_PASAT_005 && (
                <p>
                  <strong>{c.factory_name}</strong> deposundan{" "}
                  <strong>{fmtDate(c.delivery_date ?? c.received_at)}</strong> tarihinde{" "}
                  <strong>{c.customer_company}</strong> firmasına satışı yapılan{" "}
                  <strong>{c.quantity_kg ? fmtQuantity(c.quantity_kg) : "—"}</strong>{" "}
                  <strong>{c.product_name}</strong> ile ilgili firmanın{" "}
                  <strong>{fmtDate(c.received_at)}</strong> tarihli
                  {body.exchange ? " ürün değişimi" : " ürün iadesi"} ve nakliye bedelinin
                  fabrikamızca ödenmesi talebi üzerine, <strong>{c.factory_name}</strong> tarafından
                  görevlendirilen yetkililerce yapılan incelemeler sonucunda aşağıda belirtildiği
                  şekilde söz konusu{" "}
                  <strong>{c.quantity_kg ? fmtQuantity(c.quantity_kg) : "—"}</strong>{" "}
                  <strong>{c.product_name}</strong>{" "}
                  {body.exchange ? "değişiminin" : "iadesinin"} uygun olduğu, ayrıca{" "}
                  {body.exchange ? "değişimi" : "iadesi"} yapılan üründe bulunan kusurun{" "}
                  <strong>{c.factory_name}</strong>'ndan kaynaklandığı göz önünde bulundurularak
                  firmanın geliş-gidiş nakliye masraflarının{" "}
                  <strong>{c.factory_name}</strong>'nca ödenmesinin uygun olacağı
                  kararlaştırılmıştır.
                </p>
              )}

              {type === DOC_TYPE.INCELEME_TUTANAGI && (
                <p>
                  <strong>{c.factory_name}</strong> deposundan{" "}
                  <strong>{fmtDate(c.delivery_date ?? c.received_at)}</strong> tarihinde{" "}
                  <strong>{c.customer_company}</strong> firmasına satışı yapılan{" "}
                  <strong>{c.quantity_kg ? fmtQuantity(c.quantity_kg) : "—"}</strong>{" "}
                  <strong>{c.product_name}</strong> ile ilgili firmanın{" "}
                  <strong>{fmtDate(c.received_at)}</strong> tarihli şikâyeti üzerine,{" "}
                  <strong>{c.factory_name}</strong> tarafından görevlendirilen yetkililerce yapılan
                  incelemeler sonucunda aşağıda belirtilen tespitler yapılmış ve{" "}
                  <strong>
                    şikâyete konu ürünün ilgili kalite standartlarına ve satış sözleşmesine uygun
                    olduğu
                  </strong>{" "}
                  kararlaştırılmıştır.
                </p>
              )}
            </section>

            {/* İnceleme bilgileri */}
            <section className="mt-5">
              <h2 className="mb-1.5 text-[11pt] font-bold">1. İNCELEME BİLGİLERİ</h2>
              <table className="w-full border-collapse text-[10pt]">
                <tbody>
                  {[
                    ["Şikâyet konusu", c.subject],
                    ["Şikâyet türü", c.category_name ?? "—"],
                    ["Parti / Lot no", c.lot_no ?? "—"],
                    ["Ürün grubu", PRODUCT_GROUP_LABEL[c.product_group as ProductGroup] ?? c.product_group],
                    ["İnceleme tarihi", fmtDate(body.visitedAt ?? c.visited_at)],
                    ["İnceleme bulguları", body.inspectionNote ?? c.inspection_note ?? "—"],
                    ...(body.labSkipReason || c.lab_skip_reason
                      ? [["Analiz yapılmama gerekçesi", body.labSkipReason ?? c.lab_skip_reason ?? ""]]
                      : []),
                  ].map(([k, v]) => (
                    <tr key={k}>
                      <th className="w-[30%] border border-black p-1.5 text-left align-top font-semibold">{k}</th>
                      <td className="border border-black p-1.5 align-top whitespace-pre-line">{v}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>

            {/* Numune ve analiz */}
            {(samples.length > 0 || analyses.length > 0) && (
              <section className="mt-4">
                <h2 className="mb-1.5 text-[11pt] font-bold">2. NUMUNE VE ANALİZ SONUÇLARI</h2>
                {samples.length > 0 && (
                  <table className="mb-2.5 w-full border-collapse text-[9.5pt]">
                    <thead>
                      <tr className="bg-ink-100">
                        <th className="border border-black p-1 text-left">Numune no</th>
                        <th className="border border-black p-1 text-left">Alınma tarihi</th>
                        <th className="border border-black p-1 text-left">Alındığı yer</th>
                        <th className="border border-black p-1 text-left">Miktar</th>
                        <th className="border border-black p-1 text-left">Mühür no</th>
                      </tr>
                    </thead>
                    <tbody>
                      {samples.map((s) => (
                        <tr key={s.id}>
                          <td className="border border-black p-1">{s.sample_no}</td>
                          <td className="border border-black p-1">{fmtDate(s.taken_at)}</td>
                          <td className="border border-black p-1">{s.taken_place ?? "—"}</td>
                          <td className="border border-black p-1">{s.quantity ?? "—"}</td>
                          <td className="border border-black p-1">{s.seal_no ?? "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
                {analyses.map((a) => (
                  <div key={a.id} className="mb-2.5">
                    <p className="mb-1 text-[10pt]">
                      <strong>Analiz raporu {a.report_no}</strong> — {fmtDate(a.analyzed_at)} ·{" "}
                      {a.lab_name} · Sonuç:{" "}
                      <strong>
                        {a.conformity === "UYGUN" ? "Standartlara uygun"
                          : a.conformity === "UYGUN_DEGIL" ? "Standartlara uygun DEĞİL"
                          : "Kısmen uygun"}
                      </strong>
                    </p>
                    <table className="w-full border-collapse text-[9.5pt]">
                      <thead>
                        <tr className="bg-ink-100">
                          <th className="border border-black p-1 text-left">Parametre</th>
                          <th className="border border-black p-1 text-left">Sonuç</th>
                          <th className="border border-black p-1 text-left">Birim</th>
                          <th className="border border-black p-1 text-left">Spesifikasyon</th>
                          <th className="border border-black p-1 text-left">Değerlendirme</th>
                        </tr>
                      </thead>
                      <tbody>
                        {a.results.map((r) => (
                          <tr key={r.id}>
                            <td className="border border-black p-1">{r.parameter}</td>
                            <td className="border border-black p-1 font-semibold">{r.value}</td>
                            <td className="border border-black p-1">{r.unit ?? "—"}</td>
                            <td className="border border-black p-1">{r.spec_text ?? "—"}</td>
                            <td className="border border-black p-1">
                              {r.conforms === 1 ? "Uygun" : r.conforms === 0 ? "Uygun değil" : "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {a.summary && <p className="mt-1 text-[10pt] whitespace-pre-line">{a.summary}</p>}
                  </div>
                ))}
              </section>
            )}

            {/* Sonuç ve karar */}
            <section className="mt-4">
              <h2 className="mb-1.5 text-[11pt] font-bold">
                {samples.length > 0 || analyses.length > 0 ? "3." : "2."} SONUÇ VE KARAR
              </h2>
              <table className="w-full border-collapse text-[10pt]">
                <tbody>
                  <tr>
                    <th className="w-[30%] border border-black p-1.5 text-left align-top font-semibold">
                      İnceleme sonucu / gerekçe
                    </th>
                    <td className="border border-black p-1.5 align-top whitespace-pre-line">
                      {body.verdictReason ?? c.verdict_reason ?? "—"}
                    </td>
                  </tr>
                  <tr>
                    <th className="border border-black p-1.5 text-left align-top font-semibold">Karar</th>
                    <td className="border border-black p-1.5 align-top">
                      {(body.verdict ?? c.verdict) === "HAKLI"
                        ? "Şikâyet HAKLI bulunmuştur."
                        : "Şikâyet HAKLI BULUNMAMIŞTIR."}
                    </td>
                  </tr>
                  <tr>
                    <th className="border border-black p-1.5 text-left align-top font-semibold">
                      Yapılan / yapılacak işlem
                    </th>
                    <td className="border border-black p-1.5 align-top whitespace-pre-line">
                      {body.decision ?? c.decision ?? "—"}
                    </td>
                  </tr>
                  <tr>
                    <th className="border border-black p-1.5 text-left align-top font-semibold">
                      Şikâyetçi talebi
                    </th>
                    <td className="border border-black p-1.5 align-top">
                      {DEMAND_LABEL[c.demand as Demand] ?? c.demand}
                    </td>
                  </tr>
                  {type === DOC_TYPE.FR_PASAT_005 && (
                    <tr>
                      <th className="border border-black p-1.5 text-left align-top font-semibold">
                        Nakliye bedeli
                      </th>
                      <td className="border border-black p-1.5 align-top">
                        Firmanın geliş-gidiş nakliye masrafları {c.factory_name} tarafından ödenecektir.
                        {c.freight_amount > 0 && ` Ödenen tutar: ${fmtTl(c.freight_amount)}.`}
                      </td>
                    </tr>
                  )}
                  {body.note && (
                    <tr>
                      <th className="border border-black p-1.5 text-left align-top font-semibold">Açıklama</th>
                      <td className="border border-black p-1.5 align-top whitespace-pre-line">{body.note}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </section>

            <p className="mt-5 text-justify">
              İş bu tutanak aşağıda ad, soyad ve unvanları bulunan yetkililerce imza altına
              alınmıştır. {doc.approved_at ? fmtDateLong(doc.approved_at) : "…… / …… / ………"}
            </p>
          </>
        )}

        {/* ---------- Müşteri Bilgilendirme Formu ---------- */}
        {type === DOC_TYPE.MUSTERI_BILGILENDIRME && (
          <>
            <table className="w-full border-collapse text-[10.5pt]">
              <tbody>
                {[
                  ["Sayın", [c.customer_company, c.customer_name].filter(Boolean).join(" / ")],
                  ["Şikâyet numarası / tarihi", `${c.complaint_no} / ${fmtDate(c.received_at)}`],
                  ["Ürün", `${c.product_name}${c.packaging ? ` — ${c.packaging}` : ""}`],
                  ["Şikâyet konusu", c.subject],
                  ["İnceleme sonucu", c.verdict_reason ?? "—"],
                  [
                    "Karar",
                    c.verdict === "HAKLI"
                      ? "Şikâyetiniz haklı bulunmuştur."
                      : "Şikâyetiniz, ürünün ilgili kalite standartlarına ve satış sözleşmesine uygun bulunması nedeniyle haklı bulunmamıştır.",
                  ],
                  ["AÇIKLAMA", body.explanation ?? "—"],
                  ...(c.transaction_date
                    ? [[
                        "Yapılan işlem",
                        [
                          `İşlem tarihi: ${fmtDate(c.transaction_date)}`,
                          c.returned_kg ? `İade alınan miktar: ${fmtQuantity(c.returned_kg)}` : null,
                          c.exchanged_kg ? `Değişimi yapılan miktar: ${fmtQuantity(c.exchanged_kg)}` : null,
                          c.refund_amount ? `İade / mahsup bedeli: ${fmtTl(c.refund_amount)}` : null,
                          c.freight_amount ? `Ödenen nakliye bedeli: ${fmtTl(c.freight_amount)}` : null,
                        ].filter(Boolean).join("\n"),
                      ]]
                    : []),
                  ...(letters.length > 0
                    ? [["Resmî yazı", letters.map((l) => `${l.letter_no} — ${fmtDate(l.sent_at)}`).join("\n")]]
                    : []),
                ].map(([k, v]) => (
                  <tr key={k}>
                    <th className="w-[30%] border border-black p-2 text-left align-top font-semibold">{k}</th>
                    <td className="border border-black p-2 align-top whitespace-pre-line">{v}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-5 text-justify">
              Şikâyetinizi bize bildirdiğiniz için teşekkür ederiz. Görüşleriniz ürün ve hizmet
              kalitemizi geliştirmemize katkı sağlamaktadır.
            </p>
          </>
        )}

        {/* ---------- İmza bloğu ---------- */}
        <section className="mt-8">
          <table className="w-full border-collapse text-[9.5pt]">
            <tbody>
              {(() => {
                const rows: typeof doc.signatures[] = [];
                const normal = doc.signatures.filter((s) => s.is_approval === 0);
                for (let i = 0; i < normal.length; i += 3) rows.push(normal.slice(i, i + 3));
                return rows.map((row, ri) => (
                  <tr key={ri}>
                    {row.map((s) => (
                      <td key={s.id} className="border border-black p-2 align-top" style={{ width: "33.33%" }}>
                        <p className="font-semibold">{s.expected_title}</p>
                        <p className="mt-6">{s.signer_name ?? "…………………………"}</p>
                        <p className="text-[8.5pt] text-ink-700">{s.signer_title ?? ""}</p>
                        <p className="text-[8pt]">
                          {s.decision === "ONAY"
                            ? `İmzalandı: ${fmtDateTime(s.decided_at)}`
                            : s.decision === "RED"
                              ? `REDDEDİLDİ: ${fmtDateTime(s.decided_at)}`
                              : "İmza bekliyor"}
                        </p>
                      </td>
                    ))}
                    {row.length < 3 &&
                      Array.from({ length: 3 - row.length }).map((_, i) => (
                        <td key={`bos-${i}`} className="border border-black p-2" />
                      ))}
                  </tr>
                ));
              })()}
            </tbody>
          </table>

          {doc.signatures.filter((s) => s.is_approval === 1).map((s) => (
            <div key={s.id} className="mx-auto mt-4 w-[60%] border border-black p-2.5 text-center text-[9.5pt]">
              <p className="font-bold">ONAY</p>
              <p className="font-semibold">{s.expected_title}</p>
              <p className="mt-6">{s.signer_name ?? "…………………………"}</p>
              <p className="text-[8.5pt]">{s.signer_title ?? ""}</p>
              <p className="text-[8pt]">
                {s.decision === "ONAY"
                  ? `Onaylandı: ${fmtDateTime(s.decided_at)}`
                  : s.decision === "RED"
                    ? `REDDEDİLDİ: ${fmtDateTime(s.decided_at)}`
                    : "Onay bekliyor"}
              </p>
            </div>
          ))}
        </section>

        <footer className="mt-6 flex justify-between border-t border-ink-400 pt-1.5 text-[8pt] text-ink-700">
          <span>{DOC_TYPE_CODE[type]} · {kurum}</span>
          <span>
            {doc.status === "ONAYLANDI"
              ? `Elektronik onaylı — ${fmtDateTime(doc.approved_at)}`
              : doc.status === "IMZADA" ? "İmza sürecinde — taslak çıktı"
              : doc.status === "REDDEDILDI" ? "REDDEDİLDİ"
              : "TASLAK"}
          </span>
          <span>Belge no: {doc.doc_no}</span>
        </footer>
      </article>
    </div>
  );
}
