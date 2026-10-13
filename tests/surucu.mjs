#!/usr/bin/env node
/* ===========================================================================
   SQLite sürücü katmanının davranış testi.
   İşlem (transaction) semantiği, iç içe SAVEPOINT kullanımı, parametre
   normalleştirme ve satır nesnelerinin React uyumluluğu doğrulanır.

   Çalıştırma:  npm run test:surucu
   =========================================================================== */

import { Db } from "../scripts/lib/db.mjs";

const db = new Db(":memory:");
db.exec("CREATE TABLE t (id INTEGER PRIMARY KEY, ad TEXT UNIQUE)");
const ekle = (ad) => db.prepare("INSERT INTO t (ad) VALUES (?)").run(ad);
const say = () => db.prepare("SELECT COUNT(*) c FROM t").get().c;
const adlar = () => db.prepare("SELECT ad FROM t ORDER BY id").all().map((r) => r.ad).join(",");

const sonuc = [];
const kontrol = (ad, beklenen, gercek) =>
  sonuc.push([ad, String(beklenen) === String(gercek), `beklenen=${beklenen} gerçek=${gercek}`]);

/* --- İşlem semantiği ------------------------------------------------------ */

db.transaction(() => ekle("a"));
kontrol("basit commit", 1, say());

try { db.transaction(() => { ekle("b"); throw new Error("x"); }); } catch { /* beklenen */ }
kontrol("basit rollback", 1, say());

db.transaction(() => {
  ekle("c");
  db.transaction(() => ekle("d"));
});
kontrol("iç içe commit", "a,c,d", adlar());

// İç blok hata verir ve dış blok yakalarsa yalnızca iç blok geri alınmalıdır.
db.transaction(() => {
  ekle("e");
  try { db.transaction(() => { ekle("f"); throw new Error("ic"); }); } catch { /* beklenen */ }
});
kontrol("iç hata, dış devam eder", "a,c,d,e", adlar());

// İç hata dışa yayılırsa tüm işlem geri alınmalıdır.
try {
  db.transaction(() => {
    ekle("g");
    db.transaction(() => { ekle("h"); throw new Error("yayil"); });
  });
} catch { /* beklenen */ }
kontrol("iç hata dışa yayıldı", "a,c,d,e", adlar());

// Hatadan sonra askıda işlem kalmamalı.
db.transaction(() => ekle("i"));
kontrol("hatadan sonra kullanılabilir", "a,c,d,e,i", adlar());

db.transaction(() => {
  ekle("j");
  db.transaction(() => {
    ekle("k");
    db.transaction(() => ekle("l"));
  });
});
kontrol("üç kat iç içe", "a,c,d,e,i,j,k,l", adlar());

try { db.transaction(() => { ekle("m"); ekle("a"); }); } catch { /* UNIQUE ihlali */ }
kontrol("UNIQUE ihlali geri aldı", "a,c,d,e,i,j,k,l", adlar());

kontrol("dönüş değeri aktarılıyor", 42, db.transaction(() => 42));

// COMMIT'in kendisi hata fırlatırsa (disk dolması, antivirüs kaynaklı SQLITE_IOERR)
// derinlik sayacı bozulmamalıdır. Bozulursa sonraki iç içe işlemler SAVEPOINT
// yerine BEGIN gönderir ve çıplak ROLLBACK dış işlemin yazmalarını siler.
const once = adlar();
try {
  db.transaction(() => {
    ekle("commit-hatasi");
    db.exec("COMMIT"); // işlemi erken kapatır; sürücünün COMMIT'i patlar
  });
} catch { /* beklenen */ }
db.transaction(() => {
  ekle("kurtarma-dis");
  db.transaction(() => ekle("kurtarma-ic"));
});
kontrol("COMMIT hatasından sonra iç içe tx çalışır",
  `${once},commit-hatasi,kurtarma-dis,kurtarma-ic`, adlar());

/* --- Parametre normalleştirme --------------------------------------------- */

db.exec("CREATE TABLE p (a TEXT, b INTEGER, c REAL)");
db.prepare("INSERT INTO p (a, b, c) VALUES (?, ?, ?)").run(undefined, true, NaN);
const satir = db.prepare("SELECT a, b, c FROM p").get();
kontrol("undefined -> NULL", "null", String(satir.a));
kontrol("boolean -> 1", 1, satir.b);
kontrol("NaN -> NULL", "null", String(satir.c));

db.prepare("INSERT INTO p (a, b) VALUES (@a, @b)").run({ a: "adli", b: false });
kontrol("adlandırılmış parametre", "adli",
  db.prepare("SELECT a FROM p WHERE a = ?").get("adli").a);
kontrol("adlandırılmış boolean -> 0", 0,
  db.prepare("SELECT b FROM p WHERE a = ?").get("adli").b);

/* --- React Sunucu Bileşeni uyumu ------------------------------------------ */
// node:sqlite satırları null prototiple döner; sürücü düz nesneye çevirmelidir.

kontrol("get() düz nesne döndürür", true, Object.getPrototypeOf(satir) === Object.prototype);
kontrol("all() düz nesne döndürür", true,
  db.prepare("SELECT * FROM t").all().every((x) => Object.getPrototypeOf(x) === Object.prototype));
kontrol("get() satır yoksa undefined", "undefined",
  String(db.prepare("SELECT * FROM t WHERE ad = ?").get("yok")));

/* --- Dönüş tipleri -------------------------------------------------------- */

const ekleme = db.prepare("INSERT INTO t (ad) VALUES (?)").run("son");
kontrol("lastInsertRowid number", "number", typeof ekleme.lastInsertRowid);
kontrol("changes number", "number", typeof ekleme.changes);
kontrol("ON CONFLICT DO NOTHING changes=0", 0,
  db.prepare("INSERT INTO t (ad) VALUES (?) ON CONFLICT DO NOTHING").run("son").changes);

db.close();

/* --- Rapor ---------------------------------------------------------------- */

console.log("\n" + "=".repeat(70));
for (const [ad, gecti, detay] of sonuc) {
  console.log(`  ${gecti ? "\x1b[32m✓\x1b[0m" : "\x1b[31m✗\x1b[0m"} ${ad.padEnd(34)} ${gecti ? "" : detay}`);
}
const basarisiz = sonuc.filter((x) => !x[1]).length;
console.log("=".repeat(70));
console.log(`${sonuc.length - basarisiz}/${sonuc.length} geçti` + (basarisiz ? ` — ${basarisiz} BAŞARISIZ` : ""));
process.exit(basarisiz ? 1 : 0);
