/* ===========================================================================
   SQLite sürücü katmanı.

   Node.js'in yerleşik "node:sqlite" modülünü kullanır. Böylece projede
   derlenmesi gereken hiçbir yerel (native) bağımlılık kalmaz:
     - node-gyp, Python ve Visual Studio Build Tools gerekmez,
     - kurulumda nodejs.org veya github.com'dan ikili dosya indirilmez,
   bu da kurumsal TLS kesmesi (self-signed sertifika) yapan ağların arkasında
   kurulumun sorunsuz tamamlanmasını sağlar.

   API, better-sqlite3'ün kullandığımız alt kümesiyle birebir uyumludur:
   exec / prepare().get() / .all() / .run() / transaction(). node:sqlite'ta
   bulunmayan davranışlar burada tamamlanır:
     - db.pragma(...)        -> db.exec("PRAGMA ...")
     - db.transaction(fn)    -> BEGIN/COMMIT/ROLLBACK, iç içe çağrılarda SAVEPOINT
     - undefined parametre   -> NULL'a çevrilir (node:sqlite bağlamayı reddeder)
     - boolean parametre     -> 0/1'e çevrilir (node:sqlite bağlamayı reddeder)
   =========================================================================== */

import { DatabaseSync, type StatementSync } from "node:sqlite";

export interface RunResult {
  changes: number;
  lastInsertRowid: number;
}

export interface Statement<T = Record<string, unknown>> {
  get(...params: unknown[]): T | undefined;
  all(...params: unknown[]): T[];
  run(...params: unknown[]): RunResult;
}

/* --- Parametre normalleştirme -------------------------------------------- */

type Bindable = string | number | bigint | null | Uint8Array;

/**
 * node:sqlite yalnızca string, number, bigint, null ve Uint8Array bağlayabilir.
 * Uygulama kodunun ürettiği undefined ve boolean değerleri SQLite'ın beklediği
 * karşılıklara çevirir; böylece çağrı yerlerinde savunma kodu yazmak gerekmez.
 */
function normalize(value: unknown): Bindable {
  if (value === undefined || value === null) return null;
  if (typeof value === "boolean") return value ? 1 : 0;
  if (typeof value === "number") {
    // NaN ve Infinity SQLite'a bağlanamaz; sessiz bozulma yerine NULL yazılır.
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === "string" || typeof value === "bigint") return value;
  if (value instanceof Uint8Array) return value;
  if (value instanceof Date) return value.toISOString().slice(0, 19).replace("T", " ");
  // Nesne/dizi gibi beklenmeyen türler JSON'a çevrilir (sessizce kaybolmasın).
  return JSON.stringify(value);
}

/** Konumsal (?) veya adlandırılmış (@ad) parametre listesini normalleştirir. */
function normalizeParams(params: unknown[]): unknown[] {
  return params.map((p) => {
    if (p !== null && typeof p === "object" && !(p instanceof Uint8Array) && !(p instanceof Date)) {
      const out: Record<string, Bindable> = {};
      for (const [k, v] of Object.entries(p as Record<string, unknown>)) out[k] = normalize(v);
      return out;
    }
    return normalize(p);
  });
}

/** node:sqlite tamsayıları çok büyükse bigint döndürebilir; number'a indirger. */
function unwrapRowid(value: number | bigint): number {
  return typeof value === "bigint" ? Number(value) : value;
}

/**
 * node:sqlite satırları null prototiple (Object.create(null)) döndürür.
 * React Sunucu Bileşenleri böyle nesneleri İstemci Bileşenlerine aktaramaz
 * ("Only plain objects ... can be passed to Client Components"), bu yüzden
 * her satır düz nesneye kopyalanır.
 */
function plain<T>(row: T | undefined): T | undefined {
  return row === undefined || row === null ? undefined : ({ ...row } as T);
}

/* --- Veritabanı ----------------------------------------------------------- */

export class Db {
  private readonly raw: DatabaseSync;
  /** Açık işlem derinliği — iç içe tx() çağrılarını SAVEPOINT'e çevirmek için. */
  private depth = 0;
  private readonly cache = new Map<string, StatementSync>();

  constructor(file: string) {
    this.raw = new DatabaseSync(file);
  }

  exec(sql: string): void {
    this.raw.exec(sql);
  }

  /** PRAGMA ayarını uygular (better-sqlite3'teki db.pragma karşılığı). */
  pragma(statement: string): void {
    this.raw.exec(`PRAGMA ${statement}`);
  }

  prepare<T = Record<string, unknown>>(sql: string): Statement<T> {
    let stmt = this.cache.get(sql);
    if (!stmt) {
      stmt = this.raw.prepare(sql);
      this.cache.set(sql, stmt);
    }
    const s = stmt;
    return {
      get: (...params: unknown[]) =>
        plain(s.get(...(normalizeParams(params) as never[])) as T | undefined),
      all: (...params: unknown[]) =>
        (s.all(...(normalizeParams(params) as never[])) as T[]).map((r) => ({ ...r })),
      run: (...params: unknown[]) => {
        const r = s.run(...(normalizeParams(params) as never[]));
        return {
          changes: unwrapRowid(r.changes),
          lastInsertRowid: unwrapRowid(r.lastInsertRowid),
        };
      },
    };
  }

  /**
   * Fonksiyonu tek bir işlem içinde çalıştırır. İç içe çağrılarda dış işlem
   * korunur, iç blok SAVEPOINT ile sarılır; böylece iç bir hata yalnızca kendi
   * bloğunu geri alır ve dış işlemi bozmaz.
   */
  transaction<T>(fn: () => T): T {
    const nested = this.depth > 0;
    const savepoint = `tx_${this.depth}`;

    this.raw.exec(nested ? `SAVEPOINT ${savepoint}` : "BEGIN");
    this.depth++;
    try {
      const result = fn();
      this.raw.exec(nested ? `RELEASE ${savepoint}` : "COMMIT");
      return result;
    } catch (e) {
      try {
        this.raw.exec(nested ? `ROLLBACK TO ${savepoint}` : "ROLLBACK");
        if (nested) this.raw.exec(`RELEASE ${savepoint}`);
      } catch {
        // Geri alma da başarısızsa özgün hata daha bilgilendiricidir.
      }
      throw e;
    } finally {
      // Derinlik finally içinde azaltılır. Aksi halde COMMIT/RELEASE satırının
      // kendisi hata fırlattığında (disk dolması, antivirüs kaynaklı SQLITE_IOERR)
      // azaltma hem try hem catch bloğunda işletilir, sayaç -1'e iner ve bağlantı
      // kalıcı olarak bozulur: sonraki iç içe işlemler SAVEPOINT yerine BEGIN
      // göndermeye çalışır, çıplak ROLLBACK dış işlemin yazmalarını siler.
      this.depth--;
    }
  }

  close(): void {
    this.cache.clear();
    this.raw.close();
  }
}

/** Sürücünün bu Node sürümünde kullanılabilir olduğunu doğrular. */
export function assertDriverAvailable(): void {
  if (typeof DatabaseSync !== "function") {
    throw new Error(
      "Bu Node.js sürümünde yerleşik SQLite (node:sqlite) bulunmuyor. " +
      "Node.js 22.13 veya üzeri (ya da 24 LTS) sürüme yükseltin: https://nodejs.org",
    );
  }
}
