#!/usr/bin/env node
/* Veritabanını ve yüklenen dosyaları siler, ardından referans verisini yükler.
   DİKKAT: Tüm şikâyet kayıtları kaybolur. Yalnızca geliştirme ortamında kullanın. */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dbPath = path.resolve(process.env.DATABASE_PATH ?? path.join(ROOT, "data/sikayet.db"));
const uploadDir = path.resolve(process.env.UPLOAD_DIR ?? path.join(ROOT, "data/uploads"));

for (const suffix of ["", "-wal", "-shm", "-journal"]) {
  const f = dbPath + suffix;
  if (fs.existsSync(f)) { fs.rmSync(f); console.log("silindi:", path.basename(f)); }
}
if (fs.existsSync(uploadDir)) {
  for (const f of fs.readdirSync(uploadDir)) {
    if (f === ".gitkeep") continue;
    fs.rmSync(path.join(uploadDir, f), { recursive: true, force: true });
  }
  console.log("yüklenen dosyalar temizlendi");
}

const r = spawnSync(process.execPath, [path.join(ROOT, "scripts/seed.mjs")], { stdio: "inherit" });
process.exit(r.status ?? 0);
