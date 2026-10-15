import Link from "next/link";
import { all } from "@/lib/db";
import { isGmRole } from "@/lib/roles";
import {
  PRODUCT_GROUP_LABEL, STATUS_LABEL, VERDICT_LABEL,
  type ProductGroup, type Status, type Verdict,
} from "@/lib/domain";
import { addDays, today } from "@/lib/dates";
import { requirePageUser } from "@/server/auth";
import { countComplaints, listComplaints, type ComplaintFilter } from "@/server/complaints";
import { nextDue } from "@/server/stats";
import { holidaySet } from "@/server/settings";
import { Card, PageHeader } from "@/components/ui";
import { ComplaintTable, type TableRowExtra, type TabloFiltreleri } from "@/components/complaint-table";
import type { FiltreSecenegi } from "@/components/tablo-filtre";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 25;

interface Q {
  ara?: string; durum?: string; grup?: string; karar?: string; urun?: string;
  kategori?: string; fabrika?: string; gecikme?: string; itiraz?: string; kapanis?: string;
  bas?: string; bit?: string; s?: string;
}

function qs(base: Q, patch: Partial<Q>): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries({ ...base, ...patch })) {
    if (v) p.set(k, String(v));
  }
  const s = p.toString();
  return s ? `?${s}` : "";
}

export default async function ComplaintsPage({ searchParams }: { searchParams: Promise<Q> }) {
  const q = await searchParams;
  const user = await requirePageUser();
  const gm = isGmRole(user.role) || user.role === "SISTEM_YONETICISI";
  const holidays = holidaySet();
  const page = Math.max(1, Number(q.s ?? 1));

  const filter: ComplaintFilter = {
    factoryId: gm ? (q.fabrika ? Number(q.fabrika) : null) : user.factory_id,
    status: q.durum || null,
    group: q.grup === "ACIK" ? "ACIK" : q.grup === "KAPALI" ? "KAPALI" : null,
    verdict: q.karar || null,
    productGroup: q.urun || null,
    categoryId: q.kategori ? Number(q.kategori) : null,
    search: q.ara || null,
    from: q.bas || null,
    to: q.bit || null,
    closedIn: q.kapanis || null,
    overdueOnly: q.gecikme === "1",
    escalatedOnly: q.itiraz === "1",
    limit: PAGE_SIZE,
    offset: (page - 1) * PAGE_SIZE,
  };

  const rows = listComplaints(filter);
  const total = countComplaints(filter);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const extras: Record<number, TableRowExtra> = {};
  for (const c of rows) {
    const d = nextDue(c.id);
    extras[c.id] = { nextDue: d.due_at, nextTitle: d.title };
  }

  const factories = gm
    ? all<{ id: number; short_name: string }>(
        "SELECT id, short_name FROM factories WHERE is_active = 1 ORDER BY short_name",
      )
    : [];
  const categories = all<{ id: number; name: string }>(
    "SELECT id, name FROM complaint_categories WHERE is_active = 1 ORDER BY sort_order",
  );

  /* --- Sütun başlığı filtreleri ----------------------------------------- */

  const bugun = today();
  const tarihAraliklari: { etiket: string; bas: string }[] = [
    { etiket: "Son 7 gün", bas: addDays(bugun, -6) },
    { etiket: "Son 30 gün", bas: addDays(bugun, -29) },
    { etiket: "Son 90 gün", bas: addDays(bugun, -89) },
    { etiket: "Bu yıl", bas: `${bugun.slice(0, 4)}-01-01` },
  ];

  const filtreler: TabloFiltreleri = {
    fabrika: gm
      ? [
          { etiket: "Tüm fabrikalar", deger: { fabrika: null }, secili: !q.fabrika },
          ...factories.map((f): FiltreSecenegi => ({
            etiket: f.short_name,
            deger: { fabrika: String(f.id) },
            secili: q.fabrika === String(f.id),
          })),
        ]
      : undefined,
    tarih: [
      { etiket: "Tüm tarihler", deger: { bas: null, bit: null, kapanis: null }, secili: !q.bas && !q.bit && !q.kapanis },
      ...tarihAraliklari.map((t): FiltreSecenegi => ({
        etiket: t.etiket,
        deger: { bas: t.bas, bit: bugun, kapanis: null },
        secili: q.bas === t.bas && q.bit === bugun,
      })),
    ],
    konu: [
      { etiket: "Tüm şikâyet türleri", deger: { kategori: null }, secili: !q.kategori },
      ...categories.map((c): FiltreSecenegi => ({
        etiket: c.name,
        deger: { kategori: String(c.id) },
        secili: q.kategori === String(c.id),
      })),
    ],
    urun: [
      { etiket: "Tüm ürün grupları", deger: { urun: null }, secili: !q.urun },
      ...(Object.keys(PRODUCT_GROUP_LABEL) as ProductGroup[]).map((g): FiltreSecenegi => ({
        etiket: PRODUCT_GROUP_LABEL[g],
        deger: { urun: g },
        secili: q.urun === g,
      })),
    ],
    durum: [
      { etiket: "Tüm dosyalar", deger: { durum: null, grup: null, itiraz: null }, secili: !q.durum && !q.grup && q.itiraz !== "1" },
      { etiket: "Yalnızca açık dosyalar", deger: { grup: "ACIK", durum: null, itiraz: null }, secili: q.grup === "ACIK" },
      { etiket: "Yalnızca kapanmış dosyalar", deger: { grup: "KAPALI", durum: null, itiraz: null }, secili: q.grup === "KAPALI" },
      { etiket: "Yalnızca itiraza gidenler", deger: { itiraz: "1", durum: null, grup: null }, secili: q.itiraz === "1" },
      ...(Object.keys(STATUS_LABEL) as Status[]).map((st): FiltreSecenegi => ({
        etiket: STATUS_LABEL[st],
        deger: { durum: st, grup: null, itiraz: null },
        secili: q.durum === st,
      })),
    ],
    karar: [
      { etiket: "Tüm kararlar", deger: { karar: null }, secili: !q.karar },
      ...(Object.keys(VERDICT_LABEL) as Verdict[]).map((v): FiltreSecenegi => ({
        etiket: VERDICT_LABEL[v],
        deger: { karar: v },
        secili: q.karar === v,
      })),
    ],
    sira: [
      { etiket: "Tümü", deger: { gecikme: null }, secili: q.gecikme !== "1" },
      { etiket: "Yalnızca gecikenler", deger: { gecikme: "1" }, secili: q.gecikme === "1" },
    ],
  };

  // Aktif filtreler, kaldırma bağlantılarıyla birlikte listenin üstünde durur.
  const etkinler: { etiket: string; temizHref: string }[] = [];
  const ekle = (etiket: string, patch: Partial<Q>) =>
    etkinler.push({ etiket, temizHref: `/panel/sikayetler${qs(q, { ...patch, s: "" })}` });
  if (q.ara) ekle(`Arama: "${q.ara}"`, { ara: "" });
  if (q.fabrika) {
    ekle(factories.find((f) => f.id === Number(q.fabrika))?.short_name ?? "Fabrika", { fabrika: "" });
  }
  if (q.bas || q.bit) ekle(`${q.bas ?? "…"} – ${q.bit ?? "…"}`, { bas: "", bit: "" });
  if (q.kategori) {
    ekle(categories.find((c) => c.id === Number(q.kategori))?.name ?? "Şikâyet türü", { kategori: "" });
  }
  if (q.urun) ekle(PRODUCT_GROUP_LABEL[q.urun as ProductGroup] ?? q.urun, { urun: "" });
  if (q.durum) ekle(STATUS_LABEL[q.durum as Status] ?? q.durum, { durum: "" });
  if (q.grup) ekle(q.grup === "ACIK" ? "Açık dosyalar" : "Kapanmış dosyalar", { grup: "" });
  if (q.karar) ekle(VERDICT_LABEL[q.karar as Verdict] ?? q.karar, { karar: "" });
  if (q.itiraz === "1") ekle("İtiraza gidenler", { itiraz: "" });
  if (q.gecikme === "1") ekle("Gecikenler", { gecikme: "" });
  if (q.kapanis) ekle(`${q.kapanis} içinde kapanan`, { kapanis: "" });

  return (
    <div className="space-y-5">
      <PageHeader
        title="Şikâyet dosyaları"
        subtitle={`${total} kayıt${gm ? " — tüm fabrikalar" : ` — ${user.factory_name}`}`}
        actions={
          !gm && (
            <Link href="/panel/sikayetler/yeni" className="btn btn-primary btn-sm">
              Elden şikâyet kaydet
            </Link>
          )
        }
      />

      <Card bodyClass="">
        {/* Listenin üstündeki tek şerit: arama ve açık filtreler.
            Sütun süzgeçleri başlıklardaki oklarda durur. */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-ink-200 px-4 py-2.5">
          {/* Dar ekranda arama şeridi tam genişlikte durur; filtre rozetleri
              altına iner. Geniş ekranda ikisi yan yanadır. */}
          <form method="get" action="/panel/sikayetler" className="flex w-full items-center gap-2 sm:w-auto">
            {(["durum", "grup", "karar", "urun", "kategori", "fabrika", "gecikme", "itiraz", "kapanis", "bas", "bit"] as const)
              .filter((k) => q[k])
              .map((k) => <input key={k} type="hidden" name={k} value={q[k]} />)}
            <input name="ara" defaultValue={q.ara}
                   className="input h-11 min-w-0 flex-1 sm:h-8 sm:w-56 sm:flex-none sm:py-1"
                   placeholder="Şikâyet no, müşteri, konu, lot…" aria-label="Listede ara" />
            <button type="submit" className="btn btn-secondary h-11 shrink-0 sm:h-auto sm:px-2.5 sm:py-1 sm:text-baslik">Ara</button>
          </form>

          <div className="flex flex-1 flex-wrap items-center gap-1.5">
            {etkinler.map((f) => (
              <Link key={f.etiket} href={f.temizHref}
                    className="chip border-brand-200 bg-brand-50 text-brand-700 hover:bg-brand-100"
                    title="Bu filtreyi kaldır">
                {f.etiket} <span aria-hidden className="ml-1">✕</span>
              </Link>
            ))}
            {etkinler.length > 1 && (
              <Link href="/panel/sikayetler" className="text-xs text-ink-500 hover:underline">
                tümünü temizle
              </Link>
            )}
          </div>
        </div>

        <ComplaintTable rows={rows} extras={extras} holidays={holidays} showFactory={gm}
                        filtreler={filtreler} />

        {pages > 1 && (
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-ink-200 px-4 py-2.5">
            <p className="text-xs text-ink-500">Sayfa {page} / {pages} — {total} kayıt</p>
            <div className="flex gap-2">
              {page > 1 && (
                <Link href={`/panel/sikayetler${qs(q, { s: String(page - 1) })}`}
                      className="btn btn-secondary btn-sm">← Önceki</Link>
              )}
              {page < pages && (
                <Link href={`/panel/sikayetler${qs(q, { s: String(page + 1) })}`}
                      className="btn btn-secondary btn-sm">Sonraki →</Link>
              )}
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
