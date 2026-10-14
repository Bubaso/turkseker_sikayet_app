import Link from "next/link";
import { all } from "@/lib/db";
import { isGmRole } from "@/lib/roles";
import {
  OPEN_STATUSES, PRODUCT_GROUP_LABEL, STATUS_LABEL, VERDICT_LABEL,
  type ProductGroup, type Status, type Verdict,
} from "@/lib/domain";
import {requirePageUser} from "@/server/auth";
import { countComplaints, listComplaints, type ComplaintFilter } from "@/server/complaints";
import { nextDue } from "@/server/stats";
import { holidaySet } from "@/server/settings";
import { Card, PageHeader } from "@/components/ui";
import { ComplaintTable, type TableRowExtra } from "@/components/complaint-table";

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

  const title = q.kapanis ? "Kapanan dosyalar"
    : q.gecikme === "1" ? "Geciken dosyalar"
    : q.itiraz === "1" ? "İtiraza giden dosyalar"
    : "Şikâyet dosyaları";

  return (
    <div className="space-y-5">
      <PageHeader
        title={title}
        subtitle={`${total} kayıt${gm ? " — tüm fabrikalar" : ` — ${user.factory_name}`}`}
        actions={
          !gm && (
            <Link href="/panel/sikayetler/yeni" className="btn btn-primary btn-sm">
              Elden şikâyet kaydet
            </Link>
          )
        }
      />

      <Card title="Filtreler" bodyClass="p-3.5">
        <form method="get" className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="lg:col-span-2">
            <label className="label" htmlFor="ara">Ara</label>
            <input id="ara" name="ara" defaultValue={q.ara} className="input"
                   placeholder="Şikâyet no, müşteri, konu, lot, telefon" />
          </div>
          <div>
            <label className="label" htmlFor="durum">Durum</label>
            <select id="durum" name="durum" defaultValue={q.durum ?? ""} className="input">
              <option value="">Tümü</option>
              {(Object.keys(STATUS_LABEL) as Status[]).map((s) => (
                <option key={s} value={s}>{STATUS_LABEL[s]}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="grup">Dosya</label>
            <select id="grup" name="grup" defaultValue={q.grup ?? ""} className="input">
              <option value="">Tümü</option>
              <option value="ACIK">Yalnızca açık dosyalar</option>
              <option value="KAPALI">Yalnızca kapanmış dosyalar</option>
            </select>
          </div>
          <div>
            <label className="label" htmlFor="karar">Karar</label>
            <select id="karar" name="karar" defaultValue={q.karar ?? ""} className="input">
              <option value="">Tümü</option>
              {(Object.keys(VERDICT_LABEL) as Verdict[]).map((v) => (
                <option key={v} value={v}>{VERDICT_LABEL[v]}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="urun">Ürün grubu</label>
            <select id="urun" name="urun" defaultValue={q.urun ?? ""} className="input">
              <option value="">Tümü</option>
              {(Object.keys(PRODUCT_GROUP_LABEL) as ProductGroup[]).map((g) => (
                <option key={g} value={g}>{PRODUCT_GROUP_LABEL[g]}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="kategori">Şikâyet türü</label>
            <select id="kategori" name="kategori" defaultValue={q.kategori ?? ""} className="input">
              <option value="">Tümü</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          {gm && (
            <div>
              <label className="label" htmlFor="fabrika">Fabrika</label>
              <select id="fabrika" name="fabrika" defaultValue={q.fabrika ?? ""} className="input">
                <option value="">Tümü (14 fabrika)</option>
                {factories.map((f) => <option key={f.id} value={f.id}>{f.short_name}</option>)}
              </select>
            </div>
          )}
          <div>
            <label className="label" htmlFor="bas">Başlangıç tarihi</label>
            <input id="bas" name="bas" type="date" defaultValue={q.bas} className="input" />
          </div>
          <div>
            <label className="label" htmlFor="bit">Bitiş tarihi</label>
            <input id="bit" name="bit" type="date" defaultValue={q.bit} className="input" />
          </div>
          <div className="flex items-end gap-2 lg:col-span-2">
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input type="checkbox" name="gecikme" value="1" defaultChecked={q.gecikme === "1"} />
              Yalnızca gecikenler
            </label>
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input type="checkbox" name="itiraz" value="1" defaultChecked={q.itiraz === "1"} />
              Yalnızca itirazlar
            </label>
          </div>
          <div className="flex items-end gap-2 lg:col-span-2 lg:justify-end">
            <Link href="/panel/sikayetler" className="btn btn-secondary">Temizle</Link>
            <button type="submit" className="btn btn-primary">Filtrele</button>
          </div>
        </form>
      </Card>

      <Card bodyClass="">
        <ComplaintTable rows={rows} extras={extras} holidays={holidays} showFactory={gm} />
        {pages > 1 && (
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-ink-200 px-4 py-2.5">
            <p className="text-xs text-ink-500">
              Sayfa {page} / {pages} — {total} kayıt
            </p>
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

      <p className="text-xs text-ink-500">
        Açık dosya durumları: {OPEN_STATUSES.map((s) => STATUS_LABEL[s]).join(" · ")}
      </p>
    </div>
  );
}
