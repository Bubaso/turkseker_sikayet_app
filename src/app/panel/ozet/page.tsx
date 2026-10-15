import { redirect } from "next/navigation";
import { one } from "@/lib/db";
import { fmtDate } from "@/lib/dates";
import { fmtQuantity, fmtTl } from "@/lib/format";
import { isGmRole } from "@/lib/roles";
import type { DeptCode } from "@/lib/domain";
import { requirePageUser } from "@/server/auth";
import {
  categoryBreakdown, yonetimAraligi, factoryPerformance, totalRow, type PerfRange,
} from "@/server/stats";
import { donemKiyasi, oncekiAralik } from "@/server/yonetim";
import { PrintToolbar } from "@/app/belge/[id]/toolbar";

export const dynamic = "force-dynamic";

function yon(simdi: number | null, onceki: number | null, iyiYon: "artis" | "azalis"): string {
  if (simdi == null || onceki == null || simdi === onceki) return "—";
  const fark = simdi - onceki;
  const iyi = (fark > 0) === (iyiYon === "artis");
  return `${fark > 0 ? "▲" : "▼"} ${Math.abs(Math.round(fark * 10) / 10)} ${iyi ? "(iyileşme)" : "(kötüleşme)"}`;
}

/**
 * Yönetim özeti — toplantıya götürülecek tek sayfalık A4 çıktı.
 * Dönem göstergeleri, en zayıf fabrikalar, en çok bildirilen şikâyet türleri,
 * maliyet ve dikkat listesi tek sayfada toplanır.
 */
export default async function YonetimOzetiPage({
  searchParams,
}: {
  searchParams: Promise<{ bas?: string; bit?: string }>;
}) {
  const q = await searchParams;
  const user = await requirePageUser();
  if (!isGmRole(user.role) && user.role !== "SISTEM_YONETICISI") redirect("/panel?hata=yetki");

  const varsayilan = yonetimAraligi();
  const aralik: PerfRange = { from: q.bas || varsayilan.from, to: q.bit || varsayilan.to };
  const onceki = oncekiAralik(aralik);
  const deptCode = user.department_id
    ? ((one<{ code: string }>("SELECT code FROM departments WHERE id = ?", user.department_id)?.code
        ?? null) as DeptCode | null)
    : null;

  const kiyas = donemKiyasi(aralik, deptCode);
  const fabrikalar = factoryPerformance(aralik).filter((f) => f.total > 0);
  const toplam = totalRow(fabrikalar);
  const enZayif = [...fabrikalar].sort((a, b) => (a.sla_rate ?? 101) - (b.sla_rate ?? 101)).slice(0, 5);
  const turler = categoryBreakdown(aralik).slice(0, 5);
  const kurum = one<{ value: string }>("SELECT value FROM settings WHERE key = 'kurum_adi'")?.value
    ?? "Türkiye Şeker Fabrikaları A.Ş.";
  const maliyet = kiyas.simdi.iadeBedeli + kiyas.simdi.nakliyeBedeli;

  return (
    <div className="-mx-4 -my-6 min-h-screen bg-ink-200 py-6 print:bg-white print:py-0 sm:-my-8">
      <PrintToolbar complaintId={0} geriHref="/panel" geriEtiket="Panele dön"
                    docNo={`Yönetim özeti · ${aralik.from} – ${aralik.to}`} />

      <article className="print-page mx-auto w-[210mm] max-w-full bg-white p-[16mm_14mm] text-[10.5pt] leading-relaxed text-black shadow-sm print:w-auto print:shadow-none">
        <header className="mb-4 border-b-2 border-black pb-2 text-center">
          <h1 className="text-[15pt] font-bold">{kurum}</h1>
          <p className="text-[11pt] font-semibold">MÜŞTERİ ŞİKÂYETLERİ YÖNETİM ÖZETİ</p>
          <p className="mt-0.5 text-[9pt]">
            Dönem: {fmtDate(aralik.from)} – {fmtDate(aralik.to)} ·
            Kıyas: {fmtDate(onceki.from)} – {fmtDate(onceki.to)} ·
            Hazırlayan: {user.full_name} ({user.title})
          </p>
        </header>

        <section className="mb-4">
          <h2 className="mb-1.5 border-b border-black text-[11pt] font-bold">1. Dönem göstergeleri</h2>
          <table className="w-full border-collapse text-[10pt]">
            <tbody>
              {[
                ["Gelen şikâyet", String(kiyas.simdi.gelen), String(kiyas.onceki.gelen),
                 yon(kiyas.simdi.gelen, kiyas.onceki.gelen, "azalis")],
                ["Kapanan dosya", String(kiyas.simdi.kapanan), String(kiyas.onceki.kapanan),
                 yon(kiyas.simdi.kapanan, kiyas.onceki.kapanan, "artis")],
                ["Hâlâ açık", String(kiyas.simdi.acik), String(kiyas.onceki.acik),
                 yon(kiyas.simdi.acik, kiyas.onceki.acik, "azalis")],
                ["Haklı bulunan", String(kiyas.simdi.haklı), String(kiyas.onceki.haklı),
                 yon(kiyas.simdi.haklı, kiyas.onceki.haklı, "azalis")],
                ["SLA uyumu",
                 kiyas.simdi.slaOrani == null ? "—" : `%${kiyas.simdi.slaOrani}`,
                 kiyas.onceki.slaOrani == null ? "—" : `%${kiyas.onceki.slaOrani}`,
                 yon(kiyas.simdi.slaOrani, kiyas.onceki.slaOrani, "artis")],
                ["Ortalama kapanma (iş günü)",
                 String(kiyas.simdi.ortKapanma ?? "—"), String(kiyas.onceki.ortKapanma ?? "—"),
                 yon(kiyas.simdi.ortKapanma, kiyas.onceki.ortKapanma, "azalis")],
                ["İade / mahsup bedeli", fmtTl(kiyas.simdi.iadeBedeli), fmtTl(kiyas.onceki.iadeBedeli),
                 yon(kiyas.simdi.iadeBedeli, kiyas.onceki.iadeBedeli, "azalis")],
                ["Nakliye bedeli", fmtTl(kiyas.simdi.nakliyeBedeli), fmtTl(kiyas.onceki.nakliyeBedeli),
                 yon(kiyas.simdi.nakliyeBedeli, kiyas.onceki.nakliyeBedeli, "azalis")],
                ["Şikâyete konu miktar", fmtQuantity(kiyas.simdi.etkilenenKg),
                 fmtQuantity(kiyas.onceki.etkilenenKg),
                 yon(kiyas.simdi.etkilenenKg, kiyas.onceki.etkilenenKg, "azalis")],
              ].map(([ad, simdi, onceki2, degisim]) => (
                <tr key={ad} className="border-b border-ink-300">
                  <td className="py-1 pr-2 font-medium">{ad}</td>
                  <td className="tnum py-1 pr-2 text-right font-semibold">{simdi}</td>
                  <td className="tnum py-1 pr-2 text-right text-ink-600">{onceki2}</td>
                  <td className="py-1 text-right text-[9pt]">{degisim}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-1 text-[8.5pt] text-ink-600">
            Toplam maliyet (iade/mahsup + nakliye): <strong>{fmtTl(maliyet)}</strong>
          </p>
        </section>

        <section className="mb-4">
          <h2 className="mb-1.5 border-b border-black text-[11pt] font-bold">
            2. SLA'da en zayıf fabrikalar
          </h2>
          <table className="w-full border-collapse text-[10pt]">
            <thead>
              <tr className="border-b border-black">
                <th className="py-1 text-left">Fabrika</th>
                <th className="py-1 text-right">Dosya</th>
                <th className="py-1 text-right">Açık</th>
                <th className="py-1 text-right">SLA</th>
                <th className="py-1 text-right">Ort. kapanma</th>
              </tr>
            </thead>
            <tbody>
              {enZayif.map((f) => (
                <tr key={f.factory_id} className="border-b border-ink-300">
                  <td className="py-1">{f.factory}</td>
                  <td className="tnum py-1 text-right">{f.total}</td>
                  <td className="tnum py-1 text-right">{f.open}</td>
                  <td className="tnum py-1 text-right font-semibold">
                    {f.sla_rate == null ? "—" : `%${f.sla_rate}`}
                  </td>
                  <td className="tnum py-1 text-right">{f.avg_close_days ?? "—"}</td>
                </tr>
              ))}
              <tr className="font-semibold">
                <td className="py-1">KURUM TOPLAMI</td>
                <td className="tnum py-1 text-right">{toplam.total}</td>
                <td className="tnum py-1 text-right">{toplam.open}</td>
                <td className="tnum py-1 text-right">
                  {toplam.sla_rate == null ? "—" : `%${toplam.sla_rate}`}
                </td>
                <td className="tnum py-1 text-right">{toplam.avg_close_days ?? "—"}</td>
              </tr>
            </tbody>
          </table>
        </section>

        <section className="mb-4">
          <h2 className="mb-1.5 border-b border-black text-[11pt] font-bold">
            3. En çok bildirilen şikâyet türleri
          </h2>
          <ol className="ml-5 list-decimal text-[10pt]">
            {turler.map((t) => (
              <li key={t.name} className="py-0.5">
                {t.name} — <strong>{t.count}</strong> dosya
              </li>
            ))}
            {turler.length === 0 && <li>Dönemde kayıt yok.</li>}
          </ol>
        </section>

        <footer className="mt-6 border-t border-ink-400 pt-2 text-[8.5pt] text-ink-600">
          Bu özet {fmtDate(new Date().toISOString().slice(0, 10))} tarihinde sistem tarafından
          üretilmiştir. SLA hesapları iş günü bazlıdır; hafta sonları ve tanımlı resmî tatiller
          düşülür.
        </footer>
      </article>
    </div>
  );
}
