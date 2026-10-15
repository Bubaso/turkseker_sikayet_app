import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { all, one } from "@/lib/db";
import { ATTACHMENT_KIND, DOC_TYPE_CODE, DOC_TYPE_LABEL, type DocType } from "@/lib/domain";
import { fmtDate, fmtDateTime } from "@/lib/dates";
import { canAccessFactory, currentUser } from "@/server/auth";
import { getDocument } from "@/server/documents";
import { getComplaint } from "@/server/complaints";
import { SikayetFormu, type FormKaniti } from "@/components/sikayet-formu";
import { Logo } from "@/components/marka";
import { PrintToolbar } from "./toolbar";

export const metadata: Metadata = { title: "Müşteri Şikâyet Formu" };
export const dynamic = "force-dynamic";

/* ===========================================================================
   Müşteri Şikâyet Formunun yazdırma görünümü.

   Uygulamanın ürettiği tek belge budur: müşterinin beyanının kaydı. Tutanak,
   analiz raporu ve resmî yazı fabrikada elle hazırlanır ve aşama kaydında ek
   olarak yüklenir; bu yüzden burada yalnızca form çizilir.
   =========================================================================== */

export default async function DocumentPrintPage({
  params, searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ gomulu?: string }>;
}) {
  const { id } = await params;
  // Önizleme penceresinde gömülü açıldığında yazdırma çubuğu gösterilmez.
  const gomulu = (await searchParams).gomulu === "1";
  const user = await currentUser();
  if (!user) redirect(`/giris?next=/belge/${id}`);

  const doc = getDocument(Number(id));
  if (!doc) notFound();
  const c = getComplaint(doc.complaint_id);
  if (!c) notFound();
  if (!canAccessFactory(user, c.factory_id)) redirect("/panel/sikayetler");

  const type = doc.type as DocType;
  const kanitlar = all<FormKaniti>(
    "SELECT id, file_name FROM attachments WHERE complaint_id = ? AND kind = ? ORDER BY id",
    c.id, ATTACHMENT_KIND.KANIT,
  );
  const kurum = one<{ value: string }>("SELECT value FROM settings WHERE key = 'kurum_adi'")?.value
    ?? "Türkiye Şeker Fabrikaları A.Ş.";

  return (
    <div className={`min-h-screen print:bg-white print:py-0 ${
      gomulu ? "bg-white py-0" : "bg-ink-200 py-6"
    }`}>
      {!gomulu && <PrintToolbar complaintId={c.id} docNo={doc.doc_no} />}

      <article className="print-page mx-auto w-[210mm] max-w-full bg-white p-[18mm_16mm] text-[11pt] leading-relaxed text-black shadow-sm print:w-auto print:shadow-none">
        <header className="mb-6 border-b-2 border-black pb-2.5 text-center">
          <div className="mb-2 flex justify-center">
            <Logo yukseklik={34} />
          </div>
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

        <SikayetFormu c={c} kanitlar={kanitlar} yazdirma />

        <section className="mt-8 grid grid-cols-2 gap-10 text-center text-[9.5pt]">
          <div>
            <p className="border-b border-black pb-10" />
            <p className="mt-1 font-semibold">Şikâyeti Alan</p>
            <p>{c.received_by_name ?? "Çevrim içi başvuru"}</p>
          </div>
          <div>
            <p className="border-b border-black pb-10" />
            <p className="mt-1 font-semibold">Fabrika Müdürü</p>
            <p>{fmtDate(c.received_at)}</p>
          </div>
        </section>

        <footer className="mt-6 flex justify-between border-t border-ink-400 pt-1.5 text-[8pt] text-ink-700">
          <span>{DOC_TYPE_CODE[type]} · {kurum}</span>
          <span>Kayda geçti: {fmtDateTime(doc.created_at)}</span>
          <span>Belge no: {doc.doc_no}</span>
        </footer>
      </article>
    </div>
  );
}
