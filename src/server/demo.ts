/* ===========================================================================
   Demo verisi üreticisi — sadeleştirilmiş modele göre.

   Üretilen her kayıt gerçek süreç motorundan geçer: ekip kurulur, sonra her
   kilometre taşı bir belge yüklenerek kapatılır. Uygulama belge üretmediği
   için demo belgeleri de "dışarıda hazırlanmış" sayılır; üretici her aşama
   için küçük bir PDF yazıp eki o aşamaya bağlar.

   Tek istisna zaman damgalarıdır: aşamalar anlık çalıştığı için üretim
   bittikten sonra damgalar geçmişe yayılmış gerçekçi bir takvime yazılır
   (bkz. retime). Bu yalnızca demo verisi içindir.
   =========================================================================== */

import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import zlib from "node:zlib";
import { all, one, run, scalar, tx } from "@/lib/db";
import { addBusinessDays, addDays, today } from "@/lib/dates";
import { ROLES } from "@/lib/roles";
import { CHANNEL, DEMAND, SLA, VERDICT, type Verdict } from "@/lib/domain";
import { ASAMA, type AsamaKodu } from "@/lib/asamalar";
import { checkEscalation } from "@/lib/esik";
import { runAs, runAsRole } from "./auth";
import { createComplaint } from "./complaints";
import { asamayiKaydet, dosyayiKapat, dosyayiYonlendir, ekibiKur } from "./asama";
import { uploadDir, type StoredFile } from "./attachments";
import { holidaySet } from "./settings";
import { FIRMALAR, SENARYOLAR, YETKILILER } from "./demo-data";

/* --- Sapmasız sahte rastgelelik (aynı girdi aynı sonucu verir) ----------- */

function makeRng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

export interface DemoOptions {
  /** Üretilecek şikâyet sayısı. */
  count?: number;
  /** Kaç ay geriye yayılacak. */
  months?: number;
  seed?: number;
}

export interface DemoResult {
  created: number;
  closed: number;
  rejected: number;
  escalated: number;
  open: number;
  redirected: number;
  log: string[];
}

/** Dosyanın aşama tarihleri. */
interface Takvim {
  received: string;
  ekip: string;
  inceleme: string;
  karar: string;
  itiraz: string | null;
  daireKarar: string | null;
  islem: string | null;
  resmiYazi: string | null;
  kapanis: string | null;
}

function takvimKur(received: string, gecikmeli: boolean, holidays: Set<string>): Takvim {
  const bd = (n: number) => addBusinessDays(received, n, holidays);
  return {
    received,
    ekip: bd(gecikmeli ? 2 : 1),
    inceleme: bd(gecikmeli ? 4 : 2),
    karar: bd(gecikmeli ? 5 : 3),
    itiraz: null, daireKarar: null, islem: null, resmiYazi: null, kapanis: null,
  };
}

/* --- Demo belgesi (küçük, geçerli bir PDF) ------------------------------- */

const TR_HARF: Record<string, string> = {
  ş: "s", Ş: "S", ğ: "g", Ğ: "G", ı: "i", İ: "I",
  ö: "o", Ö: "O", ü: "u", Ü: "U", ç: "c", Ç: "C", â: "a", î: "i", û: "u",
};
const sadeles = (t: string) => t.replace(/[şŞğĞıİöÖüÜçÇâîû]/g, (c) => TR_HARF[c] ?? c);

/**
 * Tek sayfalık, xref tablosu doğru bir PDF üretir. Demo eklerinin tarayıcıda
 * gerçekten açılabilmesi için yeterlidir.
 */
function kucukPdf(satirlar: string[]): Buffer {
  const kacis = (t: string) => sadeles(t).replace(/([\\()])/g, "\\$1");
  const icerik =
    "BT\n/F1 11 Tf\n56 780 Td\n16 TL\n" +
    satirlar.map((t) => `(${kacis(t)}) Tj T*`).join("\n") + "\nET\n";
  const nesneler = [
    "<</Type/Catalog/Pages 2 0 R>>",
    "<</Type/Pages/Kids[3 0 R]/Count 1>>",
    "<</Type/Page/Parent 2 0 R/MediaBox[0 0 595 842]" +
      "/Resources<</Font<</F1 4 0 R>>>>/Contents 5 0 R>>",
    "<</Type/Font/Subtype/Type1/BaseFont/Helvetica/Encoding/WinAnsiEncoding>>",
    `<</Length ${Buffer.byteLength(icerik, "latin1")}>>\nstream\n${icerik}endstream`,
  ];
  let pdf = "%PDF-1.4\n";
  const konum: number[] = [];
  nesneler.forEach((o, i) => {
    konum.push(Buffer.byteLength(pdf, "latin1"));
    pdf += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xref = Buffer.byteLength(pdf, "latin1");
  pdf += `xref\n0 ${nesneler.length + 1}\n0000000000 65535 f \n`;
  for (const k of konum) pdf += `${String(k).padStart(10, "0")} 00000 n \n`;
  pdf += `trailer\n<</Size ${nesneler.length + 1}/Root 1 0 R>>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(pdf, "latin1");
}

/** Aşamaya yüklenecek demo belgesini diske yazar. */
async function demoBelge(ad: string, satirlar: string[]): Promise<StoredFile> {
  const dir = uploadDir();
  await fs.mkdir(dir, { recursive: true });
  const storedName = `demo-${crypto.randomBytes(8).toString("hex")}.pdf`;
  const icerik = kucukPdf(satirlar);
  await fs.writeFile(path.join(dir, storedName), icerik);
  return {
    fileName: `${sadeles(ad).replace(/[^A-Za-z0-9.-]+/g, "-")}.pdf`,
    storedName, mime: "application/pdf", size: icerik.length,
  };
}

/* --- Demo kanıt görseli (küçük, geçerli bir PNG) ------------------------- */

/** PNG parçalarının gerektirdiği CRC-32. */
const CRC_TABLOSU = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLOSU[(c ^ b) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function pngParcasi(tip: string, veri: Buffer): Buffer {
  const uzunluk = Buffer.alloc(4);
  uzunluk.writeUInt32BE(veri.length);
  const govde = Buffer.concat([Buffer.from(tip, "latin1"), veri]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(govde));
  return Buffer.concat([uzunluk, govde, crc]);
}

/**
 * Verilen boyama işleviyle RGB bir PNG üretir.
 *
 * Demo verisinin müşteri kanıtı olması gerekiyor: şikâyetin ne olduğunu çoğu
 * zaman en iyi anlatan şey müşterinin çektiği fotoğraftır ve önizleme
 * düzeneği ancak ortada görsel varsa görünür. Gerçek fotoğraf koyamayacağımız
 * için şikâyet türüne göre değişen, bakışta ayırt edilen bir desen çizilir.
 */
function pngUret(
  en: number, boy: number, boya: (x: number, y: number) => [number, number, number],
): Buffer {
  const satirlar = Buffer.alloc(boy * (1 + en * 3));
  let i = 0;
  for (let y = 0; y < boy; y++) {
    satirlar[i++] = 0;                       // filtre: yok
    for (let x = 0; x < en; x++) {
      const [r, g, b] = boya(x, y);
      satirlar[i++] = r; satirlar[i++] = g; satirlar[i++] = b;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(en, 0);
  ihdr.writeUInt32BE(boy, 4);
  ihdr[8] = 8;    // bit derinliği
  ihdr[9] = 2;    // renk tipi: truecolor
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngParcasi("IHDR", ihdr),
    pngParcasi("IDAT", zlib.deflateSync(satirlar, { level: 9 })),
    pngParcasi("IEND", Buffer.alloc(0)),
  ]);
}

/** Şikâyet türüne göre kanıt deseni. */
function kanitDeseni(tur: string, tohum: number) {
  const ss = (n: number) => {           // tekrarlanabilir sözde rastgele
    const x = Math.sin(tohum * 97.3 + n * 12.9898) * 43758.5453;
    return x - Math.floor(x);
  };
  const zemin: [number, number, number] = [238, 236, 230];   // çuval bezi / şeker

  if (/Yabancı madde/i.test(tur)) {
    // Beyaz şekerin içinde koyu, köşeli bir parça.
    const px = 90 + ss(1) * 300, py = 70 + ss(2) * 180;
    return (x: number, y: number): [number, number, number] => {
      const d = Math.abs(x - px) + Math.abs(y - py);
      if (d < 26) return [40, 44, 52];
      if (d < 31) return [120, 124, 130];
      const n = ss(x * 0.07 + y * 0.11) * 14;
      return [zemin[0] - n, zemin[1] - n, zemin[2] - n];
    };
  }
  if (/yırtıl|Çuval|paket/i.test(tur)) {
    // Çuvalın ortasından geçen yırtık.
    return (x: number, y: number): [number, number, number] => {
      const cizgi = 180 + Math.sin(x * 0.035) * 46 + ss(x) * 16;
      if (Math.abs(y - cizgi) < 7) return [58, 48, 42];
      if (Math.abs(y - cizgi) < 13) return [150, 132, 116];
      const n = ss(x * 0.05 + y * 0.09) * 18;
      return [214 - n, 198 - n, 168 - n];
    };
  }
  if (/sarar|Renk/i.test(tur)) {
    // Solda normal, sağda sararmış şeker: fark bakışta görünür.
    return (x: number, y: number): [number, number, number] => {
      const n = ss(x * 0.06 + y * 0.1) * 12;
      return x < 310
        ? [244 - n, 242 - n, 236 - n]
        : [238 - n, 216 - n, 142 - n];
    };
  }
  // Varsayılan: topaklanma — dağınık, sert kümeler.
  const kumeler = Array.from({ length: 11 }, (_, k) => ({
    x: 40 + ss(k * 3) * 560, y: 40 + ss(k * 3 + 1) * 400, r: 22 + ss(k * 3 + 2) * 34,
  }));
  return (x: number, y: number): [number, number, number] => {
    for (const k of kumeler) {
      const d = Math.hypot(x - k.x, y - k.y);
      if (d < k.r) {
        const g = 196 - (1 - d / k.r) * 52;
        return [g + 6, g + 2, g - 10];
      }
    }
    const n = ss(x * 0.08 + y * 0.12) * 16;
    return [zemin[0] - n, zemin[1] - n, zemin[2] - n];
  };
}

/** Müşterinin ilettiği kanıt görselini diske yazar. */
async function demoKanit(tur: string, tohum: number, sira: number): Promise<StoredFile> {
  const dir = uploadDir();
  await fs.mkdir(dir, { recursive: true });
  const storedName = `demo-${crypto.randomBytes(8).toString("hex")}.png`;
  const icerik = pngUret(640, 480, kanitDeseni(tur, tohum + sira));
  await fs.writeFile(path.join(dir, storedName), icerik);
  return {
    fileName: `sikayet-gorseli-${sira}.png`,
    storedName, mime: "image/png", size: icerik.length,
  };
}

function rolKullanicisi(factoryId: number, role: string): number {
  const u = one<{ id: number }>(
    "SELECT id FROM users WHERE factory_id = ? AND role = ? AND is_active = 1 ORDER BY id LIMIT 1",
    factoryId, role,
  );
  if (!u) throw new Error(`${role} rolünde kullanıcı yok (fabrika ${factoryId}).`);
  return u.id;
}

/* --- Üretici -------------------------------------------------------------- */

export async function generateDemoData(opts: DemoOptions = {}): Promise<DemoResult> {
  const count = Math.min(120, Math.max(1, opts.count ?? 48));
  const months = Math.min(24, Math.max(1, opts.months ?? 9));
  const rnd = makeRng(opts.seed ?? 20261013);
  const holidays = holidaySet();

  const factories = all<{ id: number; code: string; name: string }>(
    "SELECT id, code, name FROM factories WHERE is_active = 1 ORDER BY id",
  );
  if (factories.length === 0) throw new Error("Fabrika tanımı yok. Önce npm run db:seed çalıştırın.");

  const products = all<{ id: number; name: string; product_group: string; packaging: string | null }>(
    "SELECT id, name, product_group, packaging FROM products WHERE is_active = 1",
  );
  const categories = all<{ id: number; name: string; needs_lab: number; is_critical: number }>(
    "SELECT id, name, needs_lab, is_critical FROM complaint_categories WHERE is_active = 1",
  );
  const provinces = all<{ code: string; nearest_factory_id: number | null }>(
    "SELECT code, nearest_factory_id FROM provinces",
  );

  const result: DemoResult = {
    created: 0, closed: 0, rejected: 0, escalated: 0, open: 0, redirected: 0, log: [],
  };

  const ref = today();
  const startDay = addDays(ref, -Math.round(months * 30.4));
  const span = Math.round(months * 30.4);

  for (let i = 0; i < count; i++) {
    const factory = factories[i % factories.length]!;
    const senaryo = SENARYOLAR[Math.floor(rnd() * SENARYOLAR.length)]!;
    const category = categories.find((c) => c.name === senaryo.kategori) ?? categories[0]!;
    const [company, title] = FIRMALAR[Math.floor(rnd() * FIRMALAR.length)]!;
    const contact = YETKILILER[Math.floor(rnd() * YETKILILER.length)]!;

    // Senaryoya uygun ürün grubu seçimi
    const grup =
      senaryo.kategori.includes("küspe") || senaryo.konu.includes("küspe") || senaryo.konu.includes("Pelet")
        ? "POSA"
        : senaryo.konu.toLowerCase().includes("melas")
          ? "MELAS"
          : /paket|Küp/i.test(senaryo.konu)
            ? "PAKETLI_SEKER"
            : "DOKME_SEKER";
    const havuz = products.filter((p) => p.product_group === grup);
    const product = (havuz.length ? havuz : products)[
      Math.floor(rnd() * (havuz.length || products.length))
    ]!;
    const province = provinces[Math.floor(rnd() * provinces.length)]!;

    // Dosyanın hangi aşamada duracağı önce belirlenir: açık kalacak dosyalar
    // yakın tarihli seçilir, yoksa aylar öncesinden kalan her dosya ağır
    // gecikmede görünür ve SLA raporları gerçeği yansıtmaz.
    const p = rnd();
    const durak = p < 0.09 ? "YENI" : p < 0.18 ? "EKIP" : p < 0.26 ? "INCELEME" : "TAM";
    const acikKalacak = durak !== "TAM";

    let received = acikKalacak
      ? addDays(ref, -(1 + Math.floor(rnd() * 12)))
      : addDays(startDay, Math.floor(rnd() * Math.max(1, span - 20)));
    while (holidays.has(received) || [0, 6].includes(new Date(`${received}T00:00:00Z`).getUTCDay())) {
      received = addDays(received, -1);
    }
    if (received > ref) received = ref;

    // Miktar: bazı dosyalar itiraz eşiğini aşsın
    const buyuk = rnd() < 0.4;
    const quantityKg =
      grup === "MELAS" ? (buyuk ? 32_000 + Math.floor(rnd() * 20_000) : 8_000 + Math.floor(rnd() * 15_000))
      : grup === "POSA" ? (buyuk ? 1_050_000 + Math.floor(rnd() * 400_000) : 40_000 + Math.floor(rnd() * 300_000))
      : buyuk ? 52_000 + Math.floor(rnd() * 80_000) : 2_000 + Math.floor(rnd() * 40_000);

    const nakliyeTalebi = rnd() < 0.45;
    const degisim = rnd() < 0.5;
    const demand = nakliyeTalebi
      ? degisim ? DEMAND.DEGISIM_NAKLIYE : DEMAND.IADE_NAKLIYE
      : degisim ? DEMAND.DEGISIM : DEMAND.IADE;

    const channel = [CHANNEL.WEB, CHANNEL.WEB, CHANNEL.WEB, CHANNEL.TELEFON, CHANNEL.EPOSTA, CHANNEL.YAZILI][
      Math.floor(rnd() * 6)
    ]!;

    const kaliteId = rolKullanicisi(factory.id, ROLES.KALITE_SORUMLUSU);

    /*
     * Müşterinin ilettiği kanıt görselleri. Gerçekte şikâyetlerin çoğuna
     * fotoğraf eklenir; dörtte birini eksiz bırakmak ikisini de göstermek
     * içindir.
     */
    const kanitSayisi = rnd() < 0.25 ? 0 : 1 + Math.floor(rnd() * 3);
    const kanitlar: StoredFile[] = [];
    for (let k = 1; k <= kanitSayisi; k++) {
      kanitlar.push(await demoKanit(senaryo.kategori, i * 31 + k, k));
    }

    /* 1) Kayıt ------------------------------------------------------------ */
    const created = await runAs(kaliteId, () =>
      createComplaint({
        channel,
        originFactoryId: factory.id,
        factoryId: factory.id,
        receivedAt: received,
        receivedById: channel === CHANNEL.WEB ? null : kaliteId,
        customerCompany: company,
        customerName: contact,
        customerTitle: title,
        customerPhone: `53${Math.floor(rnd() * 9)}${String(1000000 + Math.floor(rnd() * 8999999))}`.slice(0, 10),
        customerEmail: `${contact.split(" ")[0]!.toLowerCase()}@${
          company.split(" ")[0]!.toLowerCase().replace(/[^a-z]/g, "")
        }.com.tr`,
        customerAddress: "Organize Sanayi Bölgesi 3. Cadde No: 14",
        customerProvince: province.code,
        customerTaxNo: String(1000000000 + Math.floor(rnd() * 8999999999)).slice(0, 10),
        productId: product.id,
        productName: product.name,
        productGroup: product.product_group,
        packaging: product.packaging,
        lotNo: `${received.slice(0, 4)}-${factory.code}-${String(100 + Math.floor(rnd() * 800))}`,
        quantityKg,
        invoiceNo: `FTR-${received.slice(0, 4)}-${String(10000 + Math.floor(rnd() * 80000))}`,
        deliveryNoteNo: `IRS-${String(200000 + Math.floor(rnd() * 500000))}`,
        deliveryDate: addDays(received, -(3 + Math.floor(rnd() * 20))),
        categoryId: category.id,
        subject: senaryo.konu,
        description: senaryo.aciklama,
        demand,
        kvkkConsent: true,
        phoneVerified: channel === CHANNEL.WEB,
        attachments: kanitlar,
      }),
    );
    result.created++;
    const cid = created.id;
    const tk = takvimKur(received, rnd() < 0.18, holidays);

    /* 2) Daha yakın fabrikaya yönlendirme --------------------------------- */
    if (created.nearerFactory && rnd() < 0.25) {
      await runAsRole(factory.id, ROLES.FABRIKA_MUDURU, () =>
        dosyayiYonlendir(
          cid, created.nearerFactory!.id,
          `Şikâyetçi firmanın adresi ${created.nearerFactory!.name}'na daha yakın olduğundan ` +
          "dosya bu fabrikaya yönlendirilmiştir.",
        ),
      );
      result.redirected++;
    }
    const fid = scalar<number>("SELECT factory_id FROM complaints WHERE id = ?", cid)!;

    if (durak === "YENI") { result.open++; retime(cid, { ...tk, ekip: "" }); continue; }

    /* 3) Ekip ------------------------------------------------------------- */
    /*
     * İlk üye evrak sorumlusu olur; demo verisinde bu daima Kalite
     * Sorumlusudur. Diğer unvanlar rastgele katılır ki ekipler tek tip
     * olmasın — evrak tek kişide olduğu için kimin katıldığı akışı
     * etkilemez.
     */
    const kadro = all<{ id: number; title: string; role: string }>(
      `SELECT id, title, role FROM users WHERE factory_id = ? AND is_active = 1
         AND role IN ('KALITE_SORUMLUSU','AMBAR_SEFI','TEKNIK_ISLETME','MUHASEBE','ZIRAAT')
       ORDER BY CASE role
                  WHEN 'KALITE_SORUMLUSU' THEN 0
                  WHEN 'AMBAR_SEFI' THEN 1
                  ELSE 2
                END, id`,
      fid,
    );
    const uyeler = kadro
      .filter((u, idx) => idx === 0 || rnd() < 0.6)
      .map((u) => ({ userId: u.id, unvan: u.title }));

    /*
     * Evrak sorumlusu ekibin ilk üyesidir (demo verisinde daima Kalite
     * Sorumlusu). Fabrika tarafındaki bütün belgeli aşamaları o kaydeder;
     * aşağıdaki adımlar da onun adına çalışır.
     */
    const evrakId = uyeler[0]!.userId;
    await runAsRole(fid, ROLES.FABRIKA_MUDURU, () =>
      ekibiKur(cid, uyeler, "Şikâyetin mahiyetine göre ekip görevlendirilmiştir.", evrakId),
    );

    if (durak === "EKIP") { result.open++; retime(cid, tk); continue; }

    /* 4) İnceleme — tutanak ve varsa analiz raporu yüklenir ---------------- */
    const uzaktan = category.needs_lab !== 1 && rnd() < 0.5;
    const incelemeNotu = uzaktan
      ? "Firmaya gidilemediğinden şikâyet, iletilen ürün görselleri ve sevk belgeleri üzerinden incelenmiştir."
      : "Şikâyetçi firma deposunda yerinde inceleme yapılmış, numune alınmıştır.";
    await runAs(evrakId, async () => {
      const ek = await demoBelge("Inceleme tutanagi", [
        "INCELEME TUTANAGI",
        `Sikayet no: ${created.complaintNo}`,
        `Tarih: ${tk.inceleme}`,
        `Urun: ${product.name}`,
        incelemeNotu,
      ]);
      await asamayiKaydet(cid, ASAMA.INCELEME, { tarih: tk.inceleme, not: incelemeNotu, belgeler: [ek] });
    });

    if (durak === "INCELEME") { result.open++; retime(cid, tk); continue; }

    /* 5) Karar — imzaları tamamlanmış tutanak yüklenir -------------------- */
    const esik = checkEscalation(product.product_group, quantityKg);
    const haksiz = esik.required ? rnd() < 0.5 : rnd() < 0.22;
    const karar: Verdict = haksiz ? VERDICT.HAKSIZ : VERDICT.HAKLI;
    const kararNotu = haksiz ? senaryo.haksizGerekce : senaryo.hakliGerekce;

    await runAs(evrakId, async () => {
      const ek = await demoBelge("Karar tutanagi (imzali)", [
        "URUN DEGISIM-IADE TUTANAGI",
        `Sikayet no: ${created.complaintNo}`,
        `Karar: ${haksiz ? "Sikayet hakli bulunmadi" : "Sikayet hakli"}`,
        `Tarih: ${tk.karar}`,
        kararNotu,
        "Imzalar: Kalite Sorumlusu, Ambar Sefi, Satis Birim Sefi,",
        "Kalite ve Isletme Kontrol Mudur Yrd., Mudur Yrd., Fabrika Muduru",
      ]);
      await asamayiKaydet(cid, ASAMA.KARAR, {
        tarih: tk.karar, not: kararNotu, belgeler: [ek], karar,
      });
    });

    /* 6) İtiraz dalı ------------------------------------------------------ */
    let hakliSonuc = !haksiz;
    if (haksiz && esik.required) {
      tk.itiraz = tk.karar;
      await runAs(evrakId, async () => {
        const ek = await demoBelge("Daire Baskanligina ust yazi", [
          "DAIRE BASKANLIGINA UST YAZI",
          `Sikayet no: ${created.complaintNo}`,
          esik.reason,
        ]);
        await asamayiKaydet(cid, ASAMA.ITIRAZ, {
          tarih: tk.itiraz!, not: esik.reason, belgeler: [ek],
        });
      });
      result.escalated++;

      const deptId = scalar<number>("SELECT escalated_dept_id FROM complaints WHERE id = ?", cid);
      const daireUser = deptId
        ? one<{ id: number }>(
            "SELECT id FROM users WHERE department_id = ? AND is_active = 1 ORDER BY id LIMIT 1", deptId,
          )
        : null;

      if (daireUser && rnd() < 0.7) {
        const kabul = rnd() < 0.35;
        tk.daireKarar = addBusinessDays(tk.itiraz!, 4, holidays);
        const gerekce = kabul
          ? "Dosya ve inceleme tutanağı incelenmiş; satış sözleşmesinin kalite taahhütleri " +
            "çerçevesinde müşteri memnuniyeti gözetilerek şikâyetin haklı kabulüne karar verilmiştir."
          : "Dosya ve inceleme tutanağı incelenmiş; fabrika kararının standartlara ve satış " +
            "sözleşmesine uygun olduğu değerlendirilerek itirazın reddine karar verilmiştir.";
        await runAs(daireUser.id, async () => {
          const ek = await demoBelge("Daire Baskanligi karar yazisi", [
            "DAIRE BASKANLIGI KARAR YAZISI",
            `Sikayet no: ${created.complaintNo}`,
            `Karar: ${kabul ? "Itiraz kabul - sikayet hakli" : "Fabrika karari yerinde"}`,
            gerekce,
          ]);
          await asamayiKaydet(cid, ASAMA.DAIRE_KARAR, {
            tarih: tk.daireKarar!, not: gerekce, belgeler: [ek], itirazKabul: kabul,
          });
        });
        hakliSonuc = kabul;
      } else {
        // Daire kararı henüz verilmedi — açık dosya. Karar süresi hâlâ işlediği
        // için itiraz tarihi yakın geçmişe çekilir.
        const yakin = addDays(ref, -(1 + Math.floor(rnd() * 6)));
        const son = addBusinessDays(yakin, SLA.ITIRAZ, holidays);
        run("UPDATE complaints SET escalation_due_at = ? WHERE id = ?", son, cid);
        run("UPDATE tasks SET due_at = ? WHERE complaint_id = ? AND code = ?",
            son, cid, ASAMA.DAIRE_KARAR);
        tk.itiraz = yakin;
        result.open++;
        retime(cid, tk);
        continue;
      }
    }

    /* 7) İade / değişim --------------------------------------------------- */
    if (hakliSonuc) {
      tk.islem = tk.daireKarar
        ? addBusinessDays(tk.daireKarar, 3, holidays)
        : addBusinessDays(tk.karar, 2, holidays);
      const miktar = Math.round(quantityKg * (0.25 + rnd() * 0.7));
      const islemNotu = degisim
        ? "Ürün değişimi tamamlanmış, yeni parti firma deposuna teslim edilmiştir."
        : "Ürün iadesi alınmış, fatura mahsuplaştırılmıştır.";
      await runAs(evrakId, async () => {
        const ek = await demoBelge("Iade-degisim irsaliyesi", [
          "IADE / DEGISIM IRSALIYESI",
          `Sikayet no: ${created.complaintNo}`,
          `Tarih: ${tk.islem}`,
          `Miktar: ${(miktar / 1000).toFixed(1)} ton`,
          islemNotu,
        ]);
        await asamayiKaydet(cid, ASAMA.ISLEM, {
          tarih: tk.islem!, not: islemNotu, belgeler: [ek],
          iadeKg: degisim ? null : miktar,
          degisimKg: degisim ? miktar : null,
          bedel: degisim ? null : Math.round(miktar * (18 + rnd() * 10)),
          nakliye: nakliyeTalebi ? Math.round(3500 + rnd() * 14000) : null,
        });
      });
    }

    /* 8) Resmî yazı ve müşteri bilgilendirmesi ---------------------------- */
    tk.resmiYazi = addBusinessDays(tk.islem ?? tk.daireKarar ?? tk.karar, 2, holidays);
    const yaziNotu = hakliSonuc
      ? "Şikâyet formu, tutanaklar ve yapılan işlemlerin sonucu ilgili Daire Başkanlıklarına " +
        "gönderilmiş, müşteri yazılı olarak bilgilendirilmiştir."
      : "İnceleme sonucu ve gerekçesi müşteriye yazılı olarak bildirilmiş, dosya ilgili Daire " +
        "Başkanlıklarına gönderilmiştir.";
    await runAs(evrakId, async () => {
      const ek = await demoBelge("Resmi yazi ve musteri bilgilendirmesi", [
        "RESMI YAZI",
        `Sikayet no: ${created.complaintNo}`,
        `Tarih: ${tk.resmiYazi}`,
        yaziNotu,
      ]);
      await asamayiKaydet(cid, ASAMA.RESMI_YAZI, {
        tarih: tk.resmiYazi!, not: yaziNotu, belgeler: [ek],
      });
    });

    /* 9) Kapanış ---------------------------------------------------------- */
    tk.kapanis = addBusinessDays(tk.resmiYazi, 1, holidays);
    await runAsRole(fid, ROLES.FABRIKA_MUDURU, () =>
      dosyayiKapat(
        cid,
        hakliSonuc
          ? "İade/değişim işlemi tamamlanmış, resmî yazı gönderilmiş, müşteri bilgilendirilmiş " +
            "ve dosya kapatılmıştır."
          : "İnceleme sonucu müşteriye bildirilmiş, dosya kapatılmıştır.",
      ),
    );
    if (hakliSonuc) result.closed++; else result.rejected++;
    retime(cid, tk);
  }

  result.log.push(
    `${result.created} şikâyet üretildi: ${result.closed} kapandı, ${result.rejected} haklı ` +
    `bulunmadı, ${result.escalated} itiraza gitti, ${result.open} açık, ${result.redirected} yönlendirildi.`,
  );
  return result;
}

/* --- Zaman damgaları ----------------------------------------------------- */

/**
 * Damgaları geçmişe yayılmış gerçekçi takvime yazar.
 * Yalnızca demo verisi içindir; gerçek kayıtlara dokunulmaz.
 */
function retime(complaintId: number, tk: Takvim): void {
  const damga = (gun: string | null, saat = 10) =>
    gun
      ? `${gun} ${String(saat).padStart(2, "0")}:${String(5 + (complaintId % 50)).padStart(2, "0")}:00`
      : null;

  tx(() => {
    // Yalnızca gerçekten gerçekleşmiş aşamaların damgaları yeniden yazılır;
    // NULL olan alanlar (henüz yapılmamış aşamalar) NULL kalır.
    const tut = (col: string) => `${col} = CASE WHEN ${col} IS NULL THEN NULL ELSE ? END`;
    run(
      `UPDATE complaints SET
         ${tut("team_formed_at")}, ${tut("visited_at")}, ${tut("verdict_at")},
         ${tut("letter_sent_at")}, ${tut("customer_informed_at")}, ${tut("closed_at")},
         ${tut("escalated_at")}, ${tut("escalation_decided_at")},
         created_at = ?, updated_at = ?
       WHERE id = ?`,
      damga(tk.ekip || null, 9), tk.inceleme, damga(tk.karar, 16),
      tk.resmiYazi, damga(tk.resmiYazi, 14), damga(tk.kapanis, 17),
      damga(tk.itiraz, 15), damga(tk.daireKarar, 12),
      damga(tk.received, 8), damga(tk.kapanis ?? tk.karar, 17),
      complaintId,
    );

    const ASAMA_GUNU: Record<string, string | null> = {
      [ASAMA.EKIP]: tk.ekip || null,
      [ASAMA.INCELEME]: tk.inceleme,
      [ASAMA.KARAR]: tk.karar,
      [ASAMA.ITIRAZ]: tk.itiraz,
      [ASAMA.DAIRE_KARAR]: tk.daireKarar,
      [ASAMA.ISLEM]: tk.islem,
      [ASAMA.RESMI_YAZI]: tk.resmiYazi,
      [ASAMA.KAPANIS]: tk.kapanis,
    };
    for (const [kod, gun] of Object.entries(ASAMA_GUNU)) {
      if (!gun) continue;
      run(
        `UPDATE tasks SET completed_at = ?
          WHERE complaint_id = ? AND code = ? AND completed_at IS NOT NULL`,
        damga(gun, 13), complaintId, kod,
      );
      run(
        "UPDATE attachments SET created_at = ? WHERE complaint_id = ? AND kind = ?",
        damga(gun, 13), complaintId, kod,
      );
    }

    run(
      `UPDATE documents SET created_at = ?,
              approved_at = CASE WHEN approved_at IS NULL THEN NULL ELSE ? END
        WHERE complaint_id = ?`,
      damga(tk.received, 8), damga(tk.received, 8), complaintId,
    );
    run("UPDATE official_letters SET created_at = ? WHERE complaint_id = ?",
        damga(tk.resmiYazi, 11), complaintId);

    // Olay günlüğü ve bildirimler sırayı koruyacak şekilde kayıttan kapanışa yayılır
    const sonGun = tk.kapanis ?? tk.karar ?? tk.received;
    const yay = (table: string, saatBaz: number, extra = "") => {
      const rows = all<{ id: number }>(
        `SELECT id FROM ${table} WHERE complaint_id = ? ORDER BY id`, complaintId,
      );
      rows.forEach((r, idx) => {
        const oran = rows.length > 1 ? idx / (rows.length - 1) : 0;
        const gun = gunSec(tk.received, sonGun, oran);
        run(
          `UPDATE ${table} SET created_at = ?${extra} WHERE id = ?`,
          ...(extra
            ? [damga(gun, saatBaz + (idx % 7)), damga(gun, saatBaz + (idx % 7)), r.id]
            : [damga(gun, saatBaz + (idx % 8)), r.id]),
        );
      });
    };
    yay("complaint_events", 9);
    yay("notifications", 10, ", sent_at = CASE WHEN sent_at IS NULL THEN NULL ELSE ? END");
  });
}

/** İki gün arasında oransal bir gün seçer. */
function gunSec(from: string, to: string, oran: number): string {
  const a = new Date(`${from}T00:00:00Z`).getTime();
  const b = new Date(`${to}T00:00:00Z`).getTime();
  const t = a + (b - a) * Math.max(0, Math.min(1, oran));
  return new Date(t).toISOString().slice(0, 10);
}

/** Tüm şikâyet verisini siler; referans tanımlar ve kullanıcılar kalır. */
export function clearComplaintData(): number {
  const n = scalar<number>("SELECT COUNT(*) FROM complaints") ?? 0;
  tx(() => {
    run("DELETE FROM notifications");
    run("DELETE FROM official_letter_reads");
    run("DELETE FROM official_letters");
    run("DELETE FROM documents");
    run("DELETE FROM attachments");
    run("DELETE FROM tasks");
    run("DELETE FROM team_members");
    run("DELETE FROM complaint_events");
    run("DELETE FROM complaints");
    run("DELETE FROM monthly_reports");
    run("DELETE FROM otp_codes");
    run("DELETE FROM rate_limits");
  });
  return n;
}
