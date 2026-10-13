import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

export type DB = Database.Database;

const DB_PATH = process.env.DATABASE_PATH ?? "./data/sikayet.db";
const SCHEMA_PATH = path.join(process.cwd(), "src/lib/db/schema.sql");

declare global {
  // Next.js geliştirme modunda sıcak yenileme sırasında tek bağlantı korunur.
  // eslint-disable-next-line no-var
  var __turksekerDb: DB | undefined;
}

function open(): DB {
  const file = path.resolve(DB_PATH);
  fs.mkdirSync(path.dirname(file), { recursive: true });

  const db = new Database(file);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.pragma("busy_timeout = 5000");

  // Şema tamamen "IF NOT EXISTS" olduğu için her açılışta güvenle çalıştırılır.
  if (fs.existsSync(SCHEMA_PATH)) {
    db.exec(fs.readFileSync(SCHEMA_PATH, "utf8"));
  }
  return db;
}

export function getDb(): DB {
  if (!globalThis.__turksekerDb) globalThis.__turksekerDb = open();
  return globalThis.__turksekerDb;
}

/** Tek satır döndüren sorgu. */
export function one<T = Record<string, unknown>>(sql: string, ...params: unknown[]): T | undefined {
  return getDb().prepare(sql).get(...(params as never[])) as T | undefined;
}

/** Çok satır döndüren sorgu. */
export function all<T = Record<string, unknown>>(sql: string, ...params: unknown[]): T[] {
  return getDb().prepare(sql).all(...(params as never[])) as T[];
}

/** INSERT / UPDATE / DELETE. */
export function run(sql: string, ...params: unknown[]): Database.RunResult {
  return getDb().prepare(sql).run(...(params as never[]));
}

/** Tek bir sayısal/metinsel değer döndüren sorgu. */
export function scalar<T = number>(sql: string, ...params: unknown[]): T | undefined {
  const row = one<Record<string, T>>(sql, ...params);
  return row ? (Object.values(row)[0] as T) : undefined;
}

/** Birden fazla yazmayı tek işlem (transaction) içinde yürütür. */
export function tx<T>(fn: (db: DB) => T): T {
  const db = getDb();
  return db.transaction(fn)(db);
}
