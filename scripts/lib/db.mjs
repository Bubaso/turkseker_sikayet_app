/* ===========================================================================
   Betikler için SQLite sürücüsü — src/lib/db/driver.ts dosyasının düz JS eşi.
   İkisi birlikte güncellenmelidir.

   Node'un yerleşik node:sqlite modülünü kullanır; projede derlenmesi gereken
   yerel bağımlılık yoktur.
   =========================================================================== */

import { DatabaseSync } from "node:sqlite";

/** node:sqlite'ın bağlayamadığı undefined ve boolean değerleri çevirir. */
function normalize(value) {
  if (value === undefined || value === null) return null;
  if (typeof value === "boolean") return value ? 1 : 0;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string" || typeof value === "bigint") return value;
  if (value instanceof Uint8Array) return value;
  if (value instanceof Date) return value.toISOString().slice(0, 19).replace("T", " ");
  return JSON.stringify(value);
}

function normalizeParams(params) {
  return params.map((p) => {
    if (p !== null && typeof p === "object" && !(p instanceof Uint8Array) && !(p instanceof Date)) {
      const out = {};
      for (const [k, v] of Object.entries(p)) out[k] = normalize(v);
      return out;
    }
    return normalize(p);
  });
}

const num = (v) => (typeof v === "bigint" ? Number(v) : v);

/** node:sqlite satırları null prototiplidir; düz nesneye kopyalanır. */
const plain = (row) => (row === undefined || row === null ? undefined : { ...row });

export class Db {
  #raw;
  #depth = 0;

  constructor(file) {
    this.#raw = new DatabaseSync(file);
  }

  exec(sql) {
    this.#raw.exec(sql);
  }

  pragma(statement) {
    this.#raw.exec(`PRAGMA ${statement}`);
  }

  prepare(sql) {
    const s = this.#raw.prepare(sql);
    return {
      get: (...p) => plain(s.get(...normalizeParams(p))),
      all: (...p) => s.all(...normalizeParams(p)).map((r) => ({ ...r })),
      run: (...p) => {
        const r = s.run(...normalizeParams(p));
        return { changes: num(r.changes), lastInsertRowid: num(r.lastInsertRowid) };
      },
    };
  }

  /** İç içe çağrılarda SAVEPOINT kullanır. */
  transaction(fn) {
    const nested = this.#depth > 0;
    const sp = `tx_${this.#depth}`;
    this.#raw.exec(nested ? `SAVEPOINT ${sp}` : "BEGIN");
    this.#depth++;
    try {
      const result = fn();
      this.#depth--;
      this.#raw.exec(nested ? `RELEASE ${sp}` : "COMMIT");
      return result;
    } catch (e) {
      this.#depth--;
      try {
        this.#raw.exec(nested ? `ROLLBACK TO ${sp}` : "ROLLBACK");
        if (nested) this.#raw.exec(`RELEASE ${sp}`);
      } catch {
        /* özgün hata daha bilgilendiricidir */
      }
      throw e;
    }
  }

  close() {
    this.#raw.close();
  }
}

/** node:sqlite'ın "deneysel" uyarısını bastırır; diğer uyarılar etkilenmez. */
export function silenceSqliteWarning() {
  const original = process.emitWarning.bind(process);
  process.emitWarning = (warning, ...rest) => {
    const text = typeof warning === "string" ? warning : (warning?.message ?? "");
    if (text.includes("SQLite is an experimental feature")) return;
    return original(warning, ...rest);
  };
}

/** Node sürümünün yerleşik SQLite desteğini doğrular. */
export function assertDriverAvailable() {
  if (typeof DatabaseSync !== "function") {
    throw new Error(
      "Bu Node.js sürümünde yerleşik SQLite (node:sqlite) bulunmuyor.\n" +
      "Node.js 22.13 veya üzeri (ya da 24 LTS) sürüme yükseltin: https://nodejs.org",
    );
  }
}
