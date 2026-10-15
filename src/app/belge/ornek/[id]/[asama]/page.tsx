import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { all, one } from "@/lib/db";
import { ASAMALAR, type AsamaKodu } from "@/lib/asamalar";
import { tutanakSablonu, tutanakVarMi, type TutanakVerisi } from "@/lib/tutanak";
import { fmtDate } from "@/lib/dates";
import { canAccessFactory, currentUser } from "@/server/auth";
import { getComplaint } from "@/server/complaints";
import { Logo } from "@/components/marka";
import { OrnekToolbar } from "./toolbar";

export const metadata: Metadata = { title: "Tutanak örneği" };
export const dynamic = "force-dynamic";

/* ===========================================================================
   Tutanak örneğinin yazdırma görünümü.

   Uygulama belge üretmez; bu sayfa da bir belge üretmez. Dosyanın bilinen
   bilgileri doldurulmuş, geri kalanı çizgili bırakılmış bir kâğıt verir:
   kullanıcı yazdırıp elle tamamlar ve imzalatır, ya da hiç açmadan kendi
   belgesini yükler. Sayfanın belge numarası yoktur, denetim izine yazılmaz
   ve dosyaya kendiliğinden eklenmez — yüklenen ıslak imzalı nüsha esastır.
   =========================================================================== */

export default async function TutanakOrnekPage({
  params,
}: {
  params: Promise<{ id: string; asama: string }>;
}) {
  const { id, asama } = await params;
  const kod = asama as AsamaKodu;
  if (!ASAMALAR[kod] || !tutanakVarMi(kod)) notFound();

  const user = await currentUser();
  if (!user) redirect(`/giris?next=/belge/ornek/${id}/${asama}`);

  const c = getComplaint(Number(id));
  if (!c) notFound();
  if (!canAccessFactory(user, c.factory_id)) redirect("/panel/sikayetler");

  const kurum = one<{ value: string }>("SELECT value FROM settings WHERE key = 'kurum_adi'")?.value
    ?? "Türkiye Şeker Fabrikaları A.Ş.";

  const ekip = all<{ full_name: string; title: string; is_lead: number }>(
    `SELECT u.full_name, u.title, tm.is_lead
       FROM team_members tm JOIN users u ON u.id = tm.user_id
      WHERE tm.complaint_id = ? ORDER BY tm.is_lead DESC, tm.id`,
    c.id,
  );
  const sorumlu = one<{ full_name: string; title: string }>(
    `SELECT u.full_name, u.title FROM tasks t JOIN users u ON u.id = t.assignee_id
      WHERE t.complaint_id = ? AND t.code = ?`,
    c.id, kod,
  ) ?? null;
  const mudur = one<{ full_name: string; title: string }>(
    `SELECT full_name, title FROM users
      WHERE factory_id = ? AND role = 'FABRIKA_MUDURU' AND is_active = 1 ORDER BY id LIMIT 1`,
    c.factory_id,
  ) ?? null;

  const veri: TutanakVerisi = {
    complaint_no: c.complaint_no,
    received_at: c.received_at,
    factory_name: c.factory_name,
    customer_company: c.customer_company,
    customer_name: c.customer_name,
    customer_title: c.customer_title,
    customer_address: c.customer_address,
    customer_province: c.province_name ?? c.customer_province,
    customer_phone: c.customer_phone,
    product_name: c.product_name,
    packaging: c.packaging,
    lot_no: c.lot_no,
    quantity_kg: c.quantity_kg,
    invoice_no: c.invoice_no,
    delivery_note_no: c.delivery_note_no,
    delivery_date: c.delivery_date,
    subject: c.subject,
    description: c.description,
    demand: c.demand,
    demands_freight: c.demands_freight,
    category_name: c.category_name,
    verdict: c.verdict,
    verdict_at: c.verdict_at,
    due_inspection_at: c.due_inspection_at,
    due_resolution_at: c.due_resolution_at,
    escalation_due_at: c.escalation_due_at,
    department_name: c.department_name,
    ekip, sorumlu, mudur,
  };

  const s = tutanakSablonu(kod, veri);
  if (!s) notFound();

  return (
    <div className="min-h-screen bg-ink-200 py-6 print:bg-white print:py-0">
      <OrnekToolbar complaintId={c.id} baslik={s.baslik} />

      <div className="overflow-x-auto px-4 print:overflow-visible print:px-0">
        <article className="print-page mx-auto w-[210mm] max-w-full bg-white p-[18mm_16mm] text-[10.5pt] leading-relaxed text-black shadow-sm print:w-auto print:shadow-none">
          <header className="mb-5 border-b-2 border-black pb-2.5 text-center">
            <div className="mb-2 flex justify-center">
              <Logo yukseklik={32} />
            </div>
            <p className="text-[12.5pt] font-bold tracking-wide">
              {kurum.toLocaleUpperCase("tr-TR")}
            </p>
            <p className="text-[10.5pt]">{c.factory_name.toLocaleUpperCase("tr-TR")}</p>
            <p className="mt-2.5 text-[12pt] font-bold">
              {s.baslik.toLocaleUpperCase("tr-TR")}
            </p>
            <div className="mt-1.5 flex justify-between text-[8.5pt]">
              <span>Dayanak: {s.kod}</span>
              <span>Şikâyet no: {c.complaint_no}</span>
              <span>Düzenleme tarihi: ……… / ……… / 20………</span>
            </div>
          </header>

          <p className="mb-4 text-justify">{s.giris}</p>

          {s.bolumler.map((b) => (
            <section key={b.baslik} className="mb-4 break-inside-avoid">
              <h2 className="mb-1.5 border-b border-ink-400 pb-0.5 text-[10.5pt] font-bold">
                {b.baslik}
              </h2>

              {b.secenekler && (
                <ul className="mb-2 space-y-1">
                  {b.secenekler.map((o) => (
                    <li key={o} className="flex items-start gap-2">
                      <span className="mt-[2px] inline-block size-3 shrink-0 border border-black" aria-hidden />
                      <span>{o}</span>
                    </li>
                  ))}
                </ul>
              )}

              {b.satirlar && (
                <table className="mb-2 w-full border-collapse">
                  <tbody>
                    {b.satirlar.map((r) => (
                      <tr key={r.etiket}>
                        <td className="w-[38%] border border-ink-400 px-2 py-1 align-top font-semibold">
                          {r.etiket}
                        </td>
                        <td className="border border-ink-400 px-2 py-1 align-top">{r.deger}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {b.kilavuz && (
                <p className="mb-1 text-[8.5pt] text-ink-600 italic">{b.kilavuz}</p>
              )}

              {b.bosSatir && (
                <div aria-hidden>
                  {Array.from({ length: b.bosSatir }).map((_, i) => (
                    <p key={i} className="border-b border-dotted border-ink-400 pt-[7mm]" />
                  ))}
                </div>
              )}
            </section>
          ))}

          <section className="mt-6 break-inside-avoid">
            <div className={`grid gap-6 text-center text-[9pt] ${
              s.imzalar.length >= 3 ? "grid-cols-3" : s.imzalar.length === 2 ? "grid-cols-2" : "grid-cols-1"
            }`}>
              {s.imzalar.map((im, i) => (
                <div key={`${im.unvan}-${i}`}>
                  <p className="border-b border-black pb-10" />
                  <p className="mt-1 font-semibold">{im.unvan}</p>
                  <p>{im.ad}</p>
                </div>
              ))}
            </div>
          </section>

          <footer className="mt-6 border-t border-ink-400 pt-1.5 text-[8pt] text-ink-700">
            {s.dipnot && <p className="mb-1">{s.dipnot}</p>}
            <div className="flex justify-between">
              <span>{kurum}</span>
              <span>
                Şikâyet no: {c.complaint_no} · {fmtDate(c.received_at)}
              </span>
            </div>
          </footer>
        </article>
      </div>
    </div>
  );
}
