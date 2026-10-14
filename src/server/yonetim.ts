/* ===========================================================================
   Üst yönetim sorguları.

   Genel Müdür Yardımcısı 14 fabrikayı gözetir: kıyas, seyir, risk ve maliyet
   sorar. Daire Başkanı ise dar bir karar görevi (itiraz) ile kendi alanına
   bakar. Bu modül iki rolün de ihtiyacı olan toplu sorguları toplar; dosya
   düzeyindeki sorgular complaints/stats modüllerinde kalır.
   =========================================================================== */

import { all, one, run, scalar } from "@/lib/db";
import { businessDaysBetween, dayOf, today } from "@/lib/dates";
import { DEPT, PRODUCT_GROUP, type DeptCode, type ProductGroup } from "@/lib/domain";
import { holidaySet } from "./settings";
import type { PerfRange } from "./stats";

/* --- Daire merceği -------------------------------------------------------- */

/**
 * Her Daire Başkanlığının doğal bakış açısı. Pazarlama dökme şeker, melas ve
 * posadan; Perakende paketli şekerden sorumludur (md. 5-6). Üretim dairesi
 * üretim kaynaklı kusurlara, Mali İşler bedellere, Strateji kurum geneline
 * bakar. Pano ve listeler bu mercekle açılır, kullanıcı isterse tümünü görür.
 */
export interface DaireMercegi {
  /** Varsayılan ürün grubu süzgeci; boşsa tüm ürünler. */
  productGroups: ProductGroup[];
  /** Panoda öne çıkarılacak bakış. */
  odak: "urun" | "uretim" | "mali" | "kurum";
  aciklama: string;
}

export const DAIRE_MERCEGI: Record<DeptCode, DaireMercegi> = {
  [DEPT.PAZARLAMA_SATIS]: {
    productGroups: [PRODUCT_GROUP.DOKME_SEKER, PRODUCT_GROUP.MELAS, PRODUCT_GROUP.POSA],
    odak: "urun",
    aciklama: "Dökme şeker, melas ve küspe/posa satışlarına ilişkin şikâyetler",
  },
  [DEPT.PERAKENDE_LOJISTIK]: {
    productGroups: [PRODUCT_GROUP.PAKETLI_SEKER],
    odak: "urun",
    aciklama: "Paketli şeker satışlarına ilişkin şikâyetler",
  },
  [DEPT.SEKER_URETIM]: {
    productGroups: [],
    odak: "uretim",
    aciklama: "Üretim kaynaklı kusurlar — topaklanma, renk, nem, yabancı madde",
  },
  [DEPT.MALI_ISLER]: {
    productGroups: [],
    odak: "mali",
    aciklama: "İade/mahsup ve nakliye bedellerinin fabrika ve ay bazında seyri",
  },
  [DEPT.STRATEJI]: {
    productGroups: [],
    odak: "kurum",
    aciklama: "Kurum geneli göstergeler, seyir ve aylık tablo",
  },
};

/** Üretim dairesinin merceğindeki şikâyet aileleri. */
const URETIM_AILELERI = ["FIZIKSEL", "KIMYASAL", "MIKROBIYOLOJIK", "DUYUSAL"];

export function mercekSuzgeci(code: DeptCode | null): { sql: string; params: unknown[] } {
  if (!code) return { sql: "", params: [] };
  const m = DAIRE_MERCEGI[code];
  if (!m) return { sql: "", params: [] };
  if (m.productGroups.length > 0) {
    return {
      sql: ` AND c.product_group IN (${m.productGroups.map(() => "?").join(",")})`,
      params: [...m.productGroups],
    };
  }
  if (m.odak === "uretim") {
    return {
      sql: ` AND EXISTS (SELECT 1 FROM complaint_categories cc
                          WHERE cc.id = c.category_id
                            AND cc.family IN (${URETIM_AILELERI.map(() => "?").join(",")}))`,
      params: [...URETIM_AILELERI],
    };
  }
  return { sql: "", params: [] };
}

/* --- Dönem karşılaştırması ------------------------------------------------ */

export interface DonemOlcumu {
  gelen: number;
  kapanan: number;
  acik: number;
  haklı: number;
  slaOrani: number | null;
  ortKapanma: number | null;
  iadeBedeli: number;
  nakliyeBedeli: number;
  etkilenenKg: number;
}

export interface DonemKiyasi {
  simdi: DonemOlcumu;
  onceki: DonemOlcumu;
  oncekiAralik: PerfRange;
}

/** Aralığın hemen öncesindeki eşit uzunlukta dönem. */
export function oncekiAralik(r: PerfRange): PerfRange {
  const bas = new Date(`${r.from}T00:00:00Z`);
  const bit = new Date(`${r.to}T00:00:00Z`);
  const gun = Math.max(1, Math.round((bit.getTime() - bas.getTime()) / 864e5) + 1);
  const oncekiBit = new Date(bas.getTime() - 864e5);
  const oncekiBas = new Date(oncekiBit.getTime() - (gun - 1) * 864e5);
  return { from: oncekiBas.toISOString().slice(0, 10), to: oncekiBit.toISOString().slice(0, 10) };
}

function olc(r: PerfRange, ek: { sql: string; params: unknown[] }): DonemOlcumu {
  const holidays = holidaySet();
  const temel = `FROM complaints c WHERE c.received_at BETWEEN ? AND ?${ek.sql}`;
  const p = [r.from, r.to, ...ek.params];

  const satir = one<{
    gelen: number; kapanan: number; acik: number; hakli: number;
    iade: number; nakliye: number; kg: number;
  }>(
    `SELECT COUNT(*) AS gelen,
            SUM(CASE WHEN c.status IN ('KAPANDI','REDDEDILDI') THEN 1 ELSE 0 END) AS kapanan,
            SUM(CASE WHEN c.status NOT IN ('KAPANDI','REDDEDILDI','IPTAL') THEN 1 ELSE 0 END) AS acik,
            SUM(CASE WHEN c.verdict = 'HAKLI' THEN 1 ELSE 0 END) AS hakli,
            IFNULL(SUM(c.refund_amount), 0) AS iade,
            IFNULL(SUM(c.freight_amount), 0) AS nakliye,
            IFNULL(SUM(c.quantity_kg), 0) AS kg
       ${temel}`,
    ...p,
  )!;

  const gorev = one<{ toplam: number; geciken: number }>(
    `SELECT COUNT(*) AS toplam,
            SUM(CASE WHEN (t.status = 'TAMAMLANDI' AND date(t.completed_at) > t.due_at)
                       OR (t.status IN ('BEKLEMEDE','DEVAM_EDIYOR') AND t.due_at < date('now'))
                     THEN 1 ELSE 0 END) AS geciken
       FROM tasks t JOIN complaints c ON c.id = t.complaint_id
      WHERE t.due_at IS NOT NULL AND t.status <> 'GEREKSIZ'
        AND c.received_at BETWEEN ? AND ?${ek.sql}`,
    ...p,
  )!;

  const kapananlar = all<{ received_at: string; closed_at: string }>(
    `SELECT c.received_at, c.closed_at ${temel} AND c.closed_at IS NOT NULL`,
    ...p,
  ).map((c) => businessDaysBetween(c.received_at, dayOf(c.closed_at)!, holidays));

  return {
    gelen: satir.gelen,
    kapanan: satir.kapanan ?? 0,
    acik: satir.acik ?? 0,
    haklı: satir.hakli ?? 0,
    slaOrani: gorev.toplam > 0
      ? Math.round(((gorev.toplam - (gorev.geciken ?? 0)) / gorev.toplam) * 1000) / 10
      : null,
    ortKapanma: kapananlar.length
      ? Math.round((kapananlar.reduce((a, b) => a + b, 0) / kapananlar.length) * 10) / 10
      : null,
    iadeBedeli: satir.iade,
    nakliyeBedeli: satir.nakliye,
    etkilenenKg: satir.kg,
  };
}

export function donemKiyasi(r: PerfRange, deptCode: DeptCode | null = null): DonemKiyasi {
  const ek = mercekSuzgeci(deptCode);
  const onceki = oncekiAralik(r);
  return { simdi: olc(r, ek), onceki: olc(onceki, ek), oncekiAralik: onceki };
}

/* --- Dikkat gerektirenler ------------------------------------------------- */

export type DikkatTuru =
  | "SLA_ASILDI" | "KRITIK_ACIK" | "ITIRAZ_SURESI" | "UZUN_SUREDIR_ACIK"
  | "TEKRAR_EDEN_URUN" | "TEKRAR_EDEN_MUSTERI";

export interface DikkatSatiri {
  tur: DikkatTuru;
  baslik: string;
  detay: string;
  /** Tıklanınca gidilecek liste ya da dosya. */
  href: string;
  agirlik: number;
}

export const DIKKAT_BASLIK: Record<DikkatTuru, string> = {
  SLA_ASILDI: "Süresi aşılmış açık dosya",
  KRITIK_ACIK: "Açık gıda güvenliği ihbarı",
  ITIRAZ_SURESI: "Karar süresi dolmak üzere olan itiraz",
  UZUN_SUREDIR_ACIK: "10 iş gününden uzun süredir açık",
  TEKRAR_EDEN_URUN: "Tekrar eden sorun",
  TEKRAR_EDEN_MUSTERI: "Tekrar eden müşteri",
};

/**
 * Üst yönetim listeye değil istisnaya bakar. Altı kural, en ağırdan hafife
 * sıralanır. Son iki kural tekil dosyayı değil örüntüyü yakalar.
 */
export function dikkatGerektirenler(deptCode: DeptCode | null = null): DikkatSatiri[] {
  const ek = mercekSuzgeci(deptCode);
  const out: DikkatSatiri[] = [];

  for (const r of all<{ id: number; complaint_no: string; factory: string; gun: number }>(
    `SELECT c.id, c.complaint_no, f.short_name AS factory,
            CAST(julianday('now') - julianday(MIN(t.due_at)) AS INTEGER) AS gun
       FROM complaints c
       JOIN tasks t ON t.complaint_id = c.id
       LEFT JOIN factories f ON f.id = c.factory_id
      WHERE c.status NOT IN ('KAPANDI','REDDEDILDI','IPTAL')
        AND t.status IN ('BEKLEMEDE','DEVAM_EDIYOR')
        AND t.due_at IS NOT NULL AND t.due_at < date('now')${ek.sql}
      GROUP BY c.id ORDER BY gun DESC LIMIT 20`, ...ek.params)) {
    out.push({
      tur: "SLA_ASILDI",
      baslik: `${r.complaint_no} — ${r.factory}`,
      detay: `${r.gun} gündür süresi aşılmış`,
      href: `/panel/sikayet/${r.id}`,
      agirlik: 100 + r.gun,
    });
  }

  for (const r of all<{ id: number; complaint_no: string; factory: string; subject: string }>(
    `SELECT c.id, c.complaint_no, f.short_name AS factory, c.subject
       FROM complaints c
       JOIN complaint_categories cat ON cat.id = c.category_id
       LEFT JOIN factories f ON f.id = c.factory_id
      WHERE cat.is_critical = 1
        AND c.status NOT IN ('KAPANDI','REDDEDILDI','IPTAL')${ek.sql}
      ORDER BY c.received_at LIMIT 20`, ...ek.params)) {
    out.push({
      tur: "KRITIK_ACIK",
      baslik: `${r.complaint_no} — ${r.factory}`,
      detay: r.subject,
      href: `/panel/sikayet/${r.id}`,
      agirlik: 90,
    });
  }

  for (const r of all<{ id: number; complaint_no: string; dept: string; due: string }>(
    `SELECT c.id, c.complaint_no, d.name AS dept, c.escalation_due_at AS due
       FROM complaints c JOIN departments d ON d.id = c.escalated_dept_id
      WHERE c.escalated_at IS NOT NULL AND c.escalation_decided_at IS NULL
        AND c.escalation_due_at IS NOT NULL
        AND c.escalation_due_at <= date('now','+1 day')${ek.sql}
      ORDER BY c.escalation_due_at LIMIT 20`, ...ek.params)) {
    out.push({
      tur: "ITIRAZ_SURESI",
      baslik: `${r.complaint_no} — ${r.dept}`,
      detay: `Karar süresi: ${r.due}`,
      href: "/panel/itirazlar",
      agirlik: 80,
    });
  }

  const holidays = holidaySet();
  const bugun = today();
  for (const r of all<{ id: number; complaint_no: string; factory: string; received_at: string }>(
    `SELECT c.id, c.complaint_no, f.short_name AS factory, c.received_at
       FROM complaints c LEFT JOIN factories f ON f.id = c.factory_id
      WHERE c.status NOT IN ('KAPANDI','REDDEDILDI','IPTAL')
        AND c.received_at <= date('now','-10 days')${ek.sql}
      ORDER BY c.received_at LIMIT 20`, ...ek.params)) {
    const gun = businessDaysBetween(r.received_at, bugun, holidays);
    if (gun < 10) continue;
    out.push({
      tur: "UZUN_SUREDIR_ACIK",
      baslik: `${r.complaint_no} — ${r.factory}`,
      detay: `${gun} iş günüdür açık`,
      href: `/panel/sikayet/${r.id}`,
      agirlik: 60 + gun,
    });
  }

  // Örüntü 1: aynı fabrika + ürün + şikâyet türü son 30 günde 3 kez ve üzeri
  for (const r of all<{ factory: string; product: string; kategori: string; n: number; fid: number }>(
    `SELECT f.short_name AS factory, c.product_name AS product, cat.name AS kategori,
            COUNT(*) AS n, c.factory_id AS fid
       FROM complaints c
       JOIN complaint_categories cat ON cat.id = c.category_id
       LEFT JOIN factories f ON f.id = c.factory_id
      WHERE c.received_at >= date('now','-30 days')${ek.sql}
      GROUP BY c.factory_id, c.product_name, c.category_id
     HAVING n >= 3 ORDER BY n DESC LIMIT 10`, ...ek.params)) {
    out.push({
      tur: "TEKRAR_EDEN_URUN",
      baslik: `${r.factory} · ${r.product}`,
      detay: `Son 30 günde ${r.n} kez "${r.kategori}"`,
      href: `/panel/sikayetler?fabrika=${r.fid}&ara=${encodeURIComponent(r.product)}`,
      agirlik: 70 + r.n,
    });
  }

  // Örüntü 2: aynı müşteri son 90 günde 3 şikâyet ve üzeri
  for (const r of all<{ firma: string; n: number }>(
    `SELECT c.customer_company AS firma, COUNT(*) AS n
       FROM complaints c
      WHERE c.received_at >= date('now','-90 days')${ek.sql}
      GROUP BY LOWER(TRIM(c.customer_company))
     HAVING n >= 3 ORDER BY n DESC LIMIT 10`, ...ek.params)) {
    out.push({
      tur: "TEKRAR_EDEN_MUSTERI",
      baslik: r.firma,
      detay: `Son 90 günde ${r.n} şikâyet`,
      href: `/panel/sikayetler?ara=${encodeURIComponent(r.firma)}`,
      agirlik: 65 + r.n,
    });
  }

  return out.sort((a, b) => b.agirlik - a.agirlik);
}

/* --- Maliyet seyri -------------------------------------------------------- */

export interface MaliyetAyi {
  ay: string;
  iade: number;
  nakliye: number;
}

export function maliyetSeyri(aySayisi: number, deptCode: DeptCode | null = null): MaliyetAyi[] {
  const ek = mercekSuzgeci(deptCode);
  return all<MaliyetAyi>(
    `SELECT strftime('%Y-%m', c.closed_at) AS ay,
            IFNULL(SUM(c.refund_amount), 0) AS iade,
            IFNULL(SUM(c.freight_amount), 0) AS nakliye
       FROM complaints c
      WHERE c.closed_at IS NOT NULL
        AND c.closed_at >= date('now','start of month', ?)${ek.sql}
      GROUP BY ay ORDER BY ay`,
    `-${aySayisi - 1} months`, ...ek.params,
  );
}

/* --- Resmî yazı gelen kutusu (md. 6 ve 8) --------------------------------- */

export interface ResmiYaziSatiri {
  id: number;
  letter_no: string;
  sent_at: string;
  note: string | null;
  complaint_id: number;
  complaint_no: string;
  customer_company: string;
  factory: string | null;
  product_name: string;
  verdict: string | null;
  okundu_mu: number;
  okuyan: string | null;
  okunma_zamani: string | null;
}

/**
 * Bir Daire Başkanlığına gönderilen resmî yazılar. Alıcılar JSON listesinde
 * tutulduğundan eşleşme JSON dizisi üzerinde yapılır.
 */
export function daireyeGelenYazilar(departmentId: number, limit = 200): ResmiYaziSatiri[] {
  return all<ResmiYaziSatiri>(
    `SELECT l.id, l.letter_no, l.sent_at, l.note,
            c.id AS complaint_id, c.complaint_no, c.customer_company, c.product_name, c.verdict,
            f.short_name AS factory,
            CASE WHEN r.letter_id IS NULL THEN 0 ELSE 1 END AS okundu_mu,
            u.full_name AS okuyan, r.read_at AS okunma_zamani
       FROM official_letters l
       JOIN complaints c ON c.id = l.complaint_id
       LEFT JOIN factories f ON f.id = c.factory_id
       LEFT JOIN official_letter_reads r ON r.letter_id = l.id AND r.department_id = ?
       LEFT JOIN users u ON u.id = r.user_id
      WHERE EXISTS (SELECT 1 FROM json_each(l.recipients) j WHERE j.value = ?)
      ORDER BY l.sent_at DESC, l.id DESC LIMIT ?`,
    departmentId, departmentId, limit,
  );
}

export function okunmamisYaziSayisi(departmentId: number): number {
  return scalar<number>(
    `SELECT COUNT(*) FROM official_letters l
      WHERE EXISTS (SELECT 1 FROM json_each(l.recipients) j WHERE j.value = ?)
        AND NOT EXISTS (SELECT 1 FROM official_letter_reads r
                         WHERE r.letter_id = l.id AND r.department_id = ?)`,
    departmentId, departmentId,
  ) ?? 0;
}

export function yaziyiOkunduIsaretle(letterId: number, departmentId: number, userId: number): void {
  run(
    `INSERT INTO official_letter_reads (letter_id, department_id, user_id)
     VALUES (?, ?, ?) ON CONFLICT(letter_id, department_id) DO NOTHING`,
    letterId, departmentId, userId,
  );
}

/* --- Daire karar geçmişi -------------------------------------------------- */

export interface DaireKararOzeti {
  bekleyen: number;
  toplam: number;
  kabul: number;
  ret: number;
  ortKararGunu: number | null;
  sureyeUyum: number | null;
}

export function daireKararOzeti(departmentId: number): DaireKararOzeti {
  const holidays = holidaySet();
  const bekleyen = scalar<number>(
    `SELECT COUNT(*) FROM complaints
      WHERE escalated_dept_id = ? AND escalated_at IS NOT NULL AND escalation_decided_at IS NULL`,
    departmentId,
  ) ?? 0;

  const kararlar = all<{ result: string; escalated_at: string; decided: string; due: string | null }>(
    `SELECT escalation_result AS result, escalated_at,
            escalation_decided_at AS decided, escalation_due_at AS due
       FROM complaints
      WHERE escalated_dept_id = ? AND escalation_decided_at IS NOT NULL`,
    departmentId,
  );

  const gunler = kararlar.map((k) =>
    businessDaysBetween(dayOf(k.escalated_at)!, dayOf(k.decided)!, holidays));
  const sureliler = kararlar.filter((k) => k.due && dayOf(k.decided)! <= k.due).length;

  return {
    bekleyen,
    toplam: kararlar.length,
    kabul: kararlar.filter((k) => k.result === "SIKAYET_HAKLI").length,
    ret: kararlar.filter((k) => k.result === "SIKAYET_HAKSIZ").length,
    ortKararGunu: gunler.length
      ? Math.round((gunler.reduce((a, b) => a + b, 0) / gunler.length) * 10) / 10
      : null,
    sureyeUyum: kararlar.length
      ? Math.round((sureliler / kararlar.length) * 1000) / 10
      : null,
  };
}

export interface ItirazAyi {
  ay: string;
  gelen: number;
  kabul: number;
}

export function itirazSeyri(aySayisi: number, departmentId: number): ItirazAyi[] {
  return all<ItirazAyi>(
    `SELECT strftime('%Y-%m', escalated_at) AS ay,
            COUNT(*) AS gelen,
            SUM(CASE WHEN escalation_result = 'SIKAYET_HAKLI' THEN 1 ELSE 0 END) AS kabul
       FROM complaints
      WHERE escalated_dept_id = ? AND escalated_at IS NOT NULL
        AND escalated_at >= date('now','start of month', ?)
      GROUP BY ay ORDER BY ay`,
    departmentId, `-${aySayisi - 1} months`,
  );
}
