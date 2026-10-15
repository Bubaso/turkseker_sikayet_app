/* ===========================================================================
   Daire Başkanlığı merceği.

   Her dairenin doğal bakış açısı burada tanımlıdır; hem gözetim sorguları
   (server/yonetim.ts) hem performans sorguları (server/stats.ts) aynı mercekle
   süzüldüğü için tanım ortak bir yerde durur.
   =========================================================================== */

import { DEPT, PRODUCT_GROUP, type DeptCode, type ProductGroup } from "./domain";

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

/*
 * Üretim dairesinin merceğindeki şikâyet aileleri. Üretim kaynaklı kusurlar
 * ürün kalitesi (topaklanma, renk, nem, tane iriliği) ve gıda güvenliği
 * (yabancı madde, küflenme) ailelerindedir; ambalaj, miktar, teslim ve ticari
 * aileler üretimden değil sevkiyat ve satış sürecinden doğar.
 */
const URETIM_AILELERI = ["URUN_KALITE", "GIDA_GUVENLIGI"];

/**
 * Dairenin merceğini SQL koşuluna çevirir. `alias`, sorgudaki complaints
 * tablosunun takma adıdır: aynı mercek hem `c` hem `c2` üzerinden süzülebilsin
 * diye parametre alır.
 */
export function mercekSuzgeci(
  code: DeptCode | null, alias = "c",
): { sql: string; params: unknown[] } {
  if (!code) return { sql: "", params: [] };
  const m = DAIRE_MERCEGI[code];
  if (!m) return { sql: "", params: [] };
  if (m.productGroups.length > 0) {
    return {
      sql: ` AND ${alias}.product_group IN (${m.productGroups.map(() => "?").join(",")})`,
      params: [...m.productGroups],
    };
  }
  if (m.odak === "uretim") {
    return {
      sql: ` AND EXISTS (SELECT 1 FROM complaint_categories cc
                          WHERE cc.id = ${alias}.category_id
                            AND cc.family IN (${URETIM_AILELERI.map(() => "?").join(",")}))`,
      params: [...URETIM_AILELERI],
    };
  }
  return { sql: "", params: [] };
}
