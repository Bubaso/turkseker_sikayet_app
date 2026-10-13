import fs from "node:fs";
import path from "node:path";
import { Db, assertDriverAvailable } from "./driver";
import { env } from "../env";

export type DB = Db;

const DB_PATH = env("DATABASE_PATH", "./data/sikayet.db");
const SCHEMA_PATH = path.join(process.cwd(), "src", "lib", "db", "schema.sql");

declare global {
  // Next.js geliştirme modunda sıcak yenileme sırasında tek bağlantı korunur.
  // eslint-disable-next-line no-var
  var __turksekerDb: Db | undefined;
}

/**
 * node:sqlite "deneysel" olarak işaretli olduğu için her açılışta uyarı basar.
 * Kurum kullanıcısını tedirgin etmemek adına yalnızca bu uyarı bastırılır;
 * diğer tüm Node uyarıları olduğu gibi görünmeye devam eder.
 */
function silenceSqliteWarning(): void {
  const g = globalThis as { __turksekerWarnPatched?: boolean };
  if (g.__turksekerWarnPatched) return;
  g.__turksekerWarnPatched = true;

  const original = process.emitWarning.bind(process);
  process.emitWarning = ((warning: string | Error, ...rest: unknown[]) => {
    const text = typeof warning === "string" ? warning : warning?.message ?? "";
    if (text.includes("SQLite is an experimental feature")) return;
    return (original as (...a: unknown[]) => void)(warning, ...rest);
  }) as typeof process.emitWarning;
}

function open(): Db {
  assertDriverAvailable();
  silenceSqliteWarning();

  const file = path.resolve(DB_PATH);
  fs.mkdirSync(path.dirname(file), { recursive: true });

  const db = new Db(file);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.pragma("busy_timeout = 5000");

  // Şema tamamen "IF NOT EXISTS" olduğu için her açılışta güvenle çalıştırılır.
  if (!fs.existsSync(SCHEMA_PATH)) {
    throw new Error(
      `Veritabanı şeması bulunamadı: ${SCHEMA_PATH}\n` +
      "Uygulamayı proje kök dizininden başlattığınızdan emin olun (npm run dev).",
    );
  }
  db.exec(fs.readFileSync(SCHEMA_PATH, "utf8"));
  return db;
}

export function getDb(): Db {
  if (!globalThis.__turksekerDb) globalThis.__turksekerDb = open();
  return globalThis.__turksekerDb;
}

/** Tek satır döndüren sorgu. */
export function one<T = Record<string, unknown>>(sql: string, ...params: unknown[]): T | undefined {
  return getDb().prepare<T>(sql).get(...params);
}

/** Çok satır döndüren sorgu. */
export function all<T = Record<string, unknown>>(sql: string, ...params: unknown[]): T[] {
  return getDb().prepare<T>(sql).all(...params);
}

/** INSERT / UPDATE / DELETE. */
export function run(sql: string, ...params: unknown[]) {
  return getDb().prepare(sql).run(...params);
}

/** Tek bir sayısal/metinsel değer döndüren sorgu. */
export function scalar<T = number>(sql: string, ...params: unknown[]): T | undefined {
  const row = one<Record<string, T>>(sql, ...params);
  return row ? (Object.values(row)[0] as T) : undefined;
}

/** Birden fazla yazmayı tek işlem (transaction) içinde yürütür. */
export function tx<T>(fn: (db: Db) => T): T {
  const db = getDb();
  return db.transaction(() => fn(db));
}
