/* ===========================================================================
   Demo verisi üreticisi.
   Üretilen her kayıt GERÇEK iş kuralları motorundan geçer: ekip oluşturma,
   numune, analiz, tutanak imza zinciri, itiraz, iade/değişim, resmî yazı ve
   kapanış adımları süreç fonksiyonlarıyla yürütülür; böylece demo veri gerçek
   veriyle aynı yapıya sahip olur.

   Tek istisna zaman damgalarıdır: adımlar anlık çalıştığı için, üretim
   bittikten sonra tüm zaman damgaları geçmişe yayılmış gerçekçi bir takvime
   yazılır (bkz. retime). Bu yalnızca demo verisi içindir.
   =========================================================================== */

import { all, one, run, scalar, tx } from "@/lib/db";
import { addBusinessDays, addDays, today } from "@/lib/dates";
import { ROLES } from "@/lib/roles";
import { CHANNEL, DEMAND, SLA, VERDICT } from "@/lib/domain";
import { TASK, checkEscalation } from "@/lib/workflow";
import { currentUser, runAs, runAsRole } from "./auth";
import { createComplaint } from "./complaints";
import { formTeam, prepareTutanak, recordFreightPayment, recordInspection,
         recordTransaction, redirectComplaint,
         sendCustomerInfo, sendOfficialLetter, startCapa, closeComplaint, escalateComplaint,
         decideEscalation, onTutanakApproved } from "./process";
import { addAnalysis, addSample, type AnalysisResultInput } from "./lab";
import { getDocument, pendingSignature, signDocument } from "./documents";
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

interface Timeline {
  received: string;
  team: string;
  visit: string;
  sample: string;
  analysis: string;
  tutanak: string;
  signed: string;
  capa: string;
  transaction: string | null;
  letter: string | null;
  informed: string | null;
  closed: string | null;
  escalated: string | null;
  escDecided: string | null;
}

/** Bir dosyanın bütün adımları için gerçekçi tarih dizisi üretir. */
function buildTimeline(received: string, late: boolean, holidays: Set<string>): Timeline {
  const bd = (n: number) => addBusinessDays(received, n, holidays);
  return {
    received,
    team: bd(late ? 2 : 1),
    visit: bd(late ? 4 : 2),
    sample: bd(late ? 4 : 2),
    analysis: bd(late ? 5 : 3),
    tutanak: bd(late ? 5 : 3),
    signed: bd(late ? 6 : 3),
    capa: bd(late ? 7 : 4),
    transaction: bd(late ? 8 : 5),
    letter: null,
    informed: null,
    closed: null,
    escalated: null,
    escDecided: null,
  };
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
  const labParams = Object.fromEntries(
    all<{ id: number; code: string; name: string; unit: string | null; spec_text: string | null }>(
      "SELECT id, code, name, unit, spec_text FROM lab_parameters",
    ).map((p) => [p.code, p]),
  );

  const result: DemoResult = {
    created: 0, closed: 0, rejected: 0, escalated: 0, open: 0, redirected: 0, log: [],
  };

  const ref = today();
  const startDay = addDays(ref, -Math.round(months * 30.4));
  const span = Math.round(months * 30.4);

  for (let i = 0; i < count; i++) {
    const factory = factories[i % factories.length]!;
    const scenario = SENARYOLAR[Math.floor(rnd() * SENARYOLAR.length)]!;
    const category = categories.find((c) => c.name === scenario.kategori) ?? categories[0]!;
    const [company, title] = FIRMALAR[Math.floor(rnd() * FIRMALAR.length)]!;
    const contact = YETKILILER[Math.floor(rnd() * YETKILILER.length)]!;

    // Senaryoya uygun ürün grubu seçimi
    const wantGroup =
      scenario.kategori.includes("küspe") || scenario.konu.includes("küspe") || scenario.konu.includes("Pelet")
        ? "POSA"
        : scenario.konu.includes("Melas") || scenario.konu.includes("melas")
          ? "MELAS"
          : scenario.konu.includes("paket") || scenario.konu.includes("Paketli") || scenario.konu.includes("Küp")
            ? "PAKETLI_SEKER"
            : "DOKME_SEKER";
    const pool = products.filter((p) => p.product_group === wantGroup);
    const product = (pool.length ? pool : products)[Math.floor(rnd() * (pool.length || products.length))]!;

    const province = provinces[Math.floor(rnd() * provinces.length)]!;

    // Sürecin hangi aşamasında duracağı önce belirlenir: açık kalacak dosyalar
    // yakın tarihli seçilir, yoksa aylar öncesinden kalan her dosya ağır
    // gecikmede görünür ve SLA raporları gerçeği yansıtmaz.
    const stage = rnd();
    const stopAt = stage < 0.08 ? "YENI" : stage < 0.16 ? "INCELEME" : stage < 0.24 ? "IMZA" : "TAM";
    const openFile = stopAt !== "TAM";

    let received = openFile
      ? addDays(ref, -(1 + Math.floor(rnd() * 12)))
      : addDays(startDay, Math.floor(rnd() * Math.max(1, span - 20)));
    while (holidays.has(received) || [0, 6].includes(new Date(`${received}T00:00:00Z`).getUTCDay())) {
      received = addDays(received, -1);
    }
    if (received > ref) received = ref;

    // Miktar: bazı dosyalar itiraz eşiğini aşsın
    const big = rnd() < 0.4;
    const quantityKg =
      wantGroup === "MELAS" ? (big ? 32_000 + Math.floor(rnd() * 20_000) : 8_000 + Math.floor(rnd() * 15_000))
      : wantGroup === "POSA" ? (big ? 1_050_000 + Math.floor(rnd() * 400_000) : 40_000 + Math.floor(rnd() * 300_000))
      : big ? 52_000 + Math.floor(rnd() * 80_000) : 2_000 + Math.floor(rnd() * 40_000);

    const freight = rnd() < 0.45;
    const exchange = rnd() < 0.5;
    const demand = freight
      ? exchange ? DEMAND.DEGISIM_NAKLIYE : DEMAND.IADE_NAKLIYE
      : exchange ? DEMAND.DEGISIM : DEMAND.IADE;

    const channel = [CHANNEL.WEB, CHANNEL.WEB, CHANNEL.WEB, CHANNEL.TELEFON, CHANNEL.EPOSTA, CHANNEL.YAZILI][
      Math.floor(rnd() * 6)
    ]!;

    const kalite = one<{ id: number }>(
      "SELECT id FROM users WHERE factory_id = ? AND role = ? LIMIT 1",
      factory.id, ROLES.KALITE_SORUMLUSU,
    );

    // 1) Kayıt
    const created = await runAs(kalite!.id, () =>
      createComplaint({
        channel,
        originFactoryId: factory.id,
        factoryId: factory.id,
        receivedAt: received,
        receivedById: channel === CHANNEL.WEB ? null : kalite!.id,
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
        subject: scenario.konu,
        description: scenario.aciklama,
        demand,
        kvkkConsent: true,
        phoneVerified: channel === CHANNEL.WEB,
      }),
    );
    result.created++;
    const cid = created.id;

    const late = rnd() < 0.18;
    const tl = buildTimeline(received, late, holidays);

    // 2) Yönlendirme (bazı dosyalarda)
    if (created.nearerFactory && rnd() < 0.25) {
      await runAsRole(factory.id, ROLES.FABRIKA_MUDURU, () =>
        redirectComplaint(
          cid, created.nearerFactory!.id,
          `Şikâyetçi firmanın adresi ${created.nearerFactory!.name}'na daha yakın olduğundan ` +
          "dosya bu fabrikaya yönlendirilmiştir.",
        ),
      );
      result.redirected++;
    }
    const cur = one<{ factory_id: number }>("SELECT factory_id FROM complaints WHERE id = ?", cid)!;
    const fid = cur.factory_id;

    if (stopAt === "YENI") { result.open++; retime(cid, { ...tl, team: "", visit: "" }); continue; }

    // 3) Ekip
    const staff = all<{ id: number; role: string }>(
      `SELECT id, role FROM users WHERE factory_id = ? AND is_active = 1
        AND role IN ('KALITE_SORUMLUSU','TEKNIK_ISLETME','MUHASEBE','ZIRAAT')`,
      fid,
    );
    const unitOf: Record<string, string> = {
      KALITE_SORUMLUSU: "KALITE_ISLETME_KONTROL",
      TEKNIK_ISLETME: "TEKNIK_ISLETME",
      MUHASEBE: "MUHASEBE",
      ZIRAAT: "ZIRAAT",
    };
    // Ekip lideri daima Kalite Sorumlusudur: yerinde inceleme ve numune görevleri
    // formTeam tarafından lidere devredildiği için sorumlu tek kişi olarak belirlenir.
    const members = staff
      .filter((s) => s.role === "KALITE_SORUMLUSU" || rnd() < 0.7)
      .map((s) => ({ userId: s.id, unit: unitOf[s.role]!, isLead: s.role === "KALITE_SORUMLUSU" }));

    await runAsRole(fid, ROLES.FABRIKA_MUDURU, () =>
      formTeam(cid, members, "Şikâyetin mahiyetine göre ekip görevlendirilmiştir."),
    );

    // 4) İnceleme
    const needsLab = category.needs_lab === 1;
    const remote = !needsLab && rnd() < 0.5;
    await runAsRole(fid, ROLES.KALITE_SORUMLUSU, () =>
      recordInspection(cid, {
        visitedAt: tl.visit,
        note: remote
          ? "Firmaya gidilemediğinden şikâyet, firma tarafından iletilen ürün görselleri ve " +
            "sevk belgeleri üzerinden incelenmiştir."
          : "Şikâyetçi firma deposunda yerinde inceleme yapılmış; ürün istif düzeni, ambalaj " +
            "bütünlüğü ve depo koşulları kayda alınmıştır.",
        remoteOnly: remote,
        labRequired: needsLab,
        labSkipReason: needsLab
          ? null
          : "Şikâyet ürünün iç kalitesine ilişkin olmadığından laboratuvar analizi gerekmemiştir.",
      }),
    );

    if (stopAt === "INCELEME") { result.open++; retime(cid, tl); continue; }

    // Karar: eşik aşan dosyalarda haksız oranı yükseltilir ki itiraz dalı da oluşsun
    const esc = checkEscalation(product.product_group, quantityKg);
    const haksiz = esc.required ? rnd() < 0.5 : rnd() < 0.22;
    const verdict = haksiz ? VERDICT.HAKSIZ : VERDICT.HAKLI;

    // 5) Numune ve analiz
    if (needsLab) {
      await runAsRole(fid, ROLES.KALITE_SORUMLUSU, () =>
        addSample(cid, {
          takenAt: tl.sample,
          takenPlace: remote ? "Fabrika ambarı (aynı parti şahit numune)" : "Şikâyetçi firma deposu",
          lotNo: `${received.slice(0, 4)}-${factory.code}`,
          quantity: "2 x 500 g",
          sealNo: `M-${String(10000 + Math.floor(rnd() * 80000))}`,
          note: "Numune mühürlenerek laboratuvara teslim edilmiştir.",
        }),
      );
      const sample = one<{ id: number }>(
        "SELECT id FROM samples WHERE complaint_id = ? ORDER BY id DESC LIMIT 1", cid,
      );
      const sp = scenario.analiz ? labParams[scenario.analiz.kod] : undefined;
      const results: AnalysisResultInput[] = [];
      if (sp) {
        results.push({
          parameterId: sp.id, parameter: sp.name,
          value: haksiz ? scenario.analiz!.iyi : scenario.analiz!.kotu,
          unit: sp.unit, specText: sp.spec_text,
          conforms: haksiz,
        });
      }
      // Birkaç uygun referans parametresi
      for (const code of ["POL", "GORUNUM"]) {
        const p = labParams[code];
        if (!p || p.id === sp?.id) continue;
        results.push({
          parameterId: p.id, parameter: p.name,
          value: code === "POL" ? "99,82" : "Beyaz, homojen",
          unit: p.unit, specText: p.spec_text, conforms: true,
        });
      }
      if (results.length > 0) {
        await runAsRole(fid, ROLES.LABORATUVAR, () =>
          addAnalysis(cid, {
            sampleId: sample?.id ?? null,
            reportNo: `LAB-${received.slice(0, 4)}-${String(1000 + i)}`,
            analyzedAt: tl.analysis,
            labName: "Kalite ve İşletme Kontrol Laboratuvarı",
            summary: haksiz
              ? "Ölçülen tüm parametreler standart ve sözleşme sınırları içindedir."
              : "Ölçülen parametrelerden en az biri standart sınırların dışındadır.",
            results,
          }),
        );
      }
    }

    // 6) Tutanak ve imza zinciri
    await runAsRole(fid, ROLES.KALITE_SORUMLUSU, () =>
      prepareTutanak(cid, {
        verdict,
        verdictReason: haksiz ? scenario.haksizGerekce : scenario.hakliGerekce,
        decision: haksiz
          ? "Şikâyet haklı bulunmadığından iade veya değişim yapılmamasına karar verilmiştir."
          : exchange
            ? `Şikâyete konu ${(quantityKg / 1000).toFixed(1)} ton ürünün değişiminin yapılması` +
              `${freight ? " ve geliş-gidiş nakliye bedelinin fabrikamızca ödenmesi" : ""} uygun görülmüştür.`
            : `Şikâyete konu ${(quantityKg / 1000).toFixed(1)} ton ürünün iadesinin alınması` +
              `${freight ? " ve geliş-gidiş nakliye bedelinin fabrikamızca ödenmesi" : ""} uygun görülmüştür.`,
      }),
    );

    const docId = scalar<number>(
      `SELECT id FROM documents WHERE complaint_id = ?
        AND type IN ('FR_PASAT_004','FR_PASAT_005','INCELEME_TUTANAGI')
        ORDER BY id DESC LIMIT 1`,
      cid,
    )!;

    if (stopAt === "IMZA") {
      // Zincirin bir kısmını imzala, kalanı beklemede bıraksın
      await signChain(docId, fid, 2 + Math.floor(rnd() * 2));
      result.open++;
      retime(cid, tl);
      continue;
    }

    await signChain(docId, fid);
    // Zincir tamamlanınca karar kesinleşir
    const mudur = one<{ id: number }>(
      "SELECT id FROM users WHERE factory_id = ? AND role = ? LIMIT 1", fid, ROLES.FABRIKA_MUDURU,
    )!;
    await runAs(mudur.id, async () => {
      const me = (await currentUser())!;
      await onTutanakApproved(cid, me);
    });

    // 7) Düzeltici faaliyet
    const needsCapa = !haksiz || category.is_critical === 1;
    if (needsCapa) {
      await runAsRole(fid, ROLES.KALITE_SORUMLUSU, () =>
        startCapa(
          cid,
          `DF-${received.slice(0, 4)}-${String(100 + i)}`,
          category.is_critical === 1
            ? "Gıda güvenliği ekibi toplanmış, kök neden analizi yapılmış ve hat üzerinde " +
              "ek kontrol noktası tanımlanmıştır."
            : "Kök neden analizi yapılmış, ilgili proses parametresi için kontrol sıklığı artırılmıştır.",
        ),
      );
    }

    // 8) İtiraz dalı
    if (haksiz && esc.required) {
      await runAsRole(fid, ROLES.FABRIKA_MUDURU, () => escalateComplaint(cid, esc.reason));
      result.escalated++;
      tl.escalated = tl.signed;
      tl.escDecided = addBusinessDays(tl.signed, 4, holidays);

      // Dairelerin bir kısmı itirazı kabul etsin
      const dept = scalar<number>("SELECT escalated_dept_id FROM complaints WHERE id = ?", cid)!;
      // createTasks ile aynı seçim: görevin sorumlusu dairenin ilk etkin kullanıcısıdır.
      const deptUser = one<{ id: number }>(
        "SELECT id FROM users WHERE department_id = ? AND is_active = 1 ORDER BY id LIMIT 1", dept,
      );
      if (deptUser && rnd() < 0.7) {
        const kabul = rnd() < 0.35;
        await runAs(deptUser.id, () =>
          decideEscalation(
            cid,
            kabul ? "SIKAYET_HAKLI" : "SIKAYET_HAKSIZ",
            kabul
              ? "Dosya ve analiz raporları incelenmiş; satış sözleşmesinin kalite taahhütleri " +
                "çerçevesinde müşteri memnuniyeti gözetilerek şikâyetin haklı kabul edilmesine karar verilmiştir."
              : "Dosya, analiz raporları ve tutanak incelenmiş; fabrika kararının standartlara ve " +
                "satış sözleşmesine uygun olduğu değerlendirilerek itirazın reddine karar verilmiştir.",
          ),
        );
        if (kabul) {
          // İtiraz kabul edildi: fabrika iade/değişim tutanağını (FR PASAT 004/005)
          // yeniden düzenler, imza zinciri tamamlanır, sonra işlem yapılır.
          await runAsRole(fid, ROLES.KALITE_SORUMLUSU, () =>
            prepareTutanak(cid, {
              verdict: VERDICT.HAKLI,
              verdictReason:
                "Daire Başkanlığı kararı doğrultusunda şikâyet haklı kabul edilmiştir.",
              decision: exchange
                ? "Daire Başkanlığı kararı gereği ürünün değişiminin yapılması" +
                  `${freight ? " ve nakliye bedelinin ödenmesi" : ""} uygun görülmüştür.`
                : "Daire Başkanlığı kararı gereği ürünün iadesinin alınması" +
                  `${freight ? " ve nakliye bedelinin ödenmesi" : ""} uygun görülmüştür.`,
            }),
          );
          const newDocId = scalar<number>(
            `SELECT id FROM documents WHERE complaint_id = ?
              AND type IN ('FR_PASAT_004','FR_PASAT_005') ORDER BY id DESC LIMIT 1`,
            cid,
          )!;
          await signChain(newDocId, fid);
          await runAs(mudur.id, async () => {
            const me = (await currentUser())!;
            await onTutanakApproved(cid, me);
          });

          tl.transaction = addBusinessDays(tl.escDecided!, 3, holidays);
          await finishJustified(cid, fid, tl, quantityKg, exchange, freight, rnd);
          result.closed++;
          retime(cid, tl);
          continue;
        }
      } else {
        // Daire kararı henüz verilmedi — açık dosya. Karar süresi hâlâ işlediği
        // için itiraz tarihi yakın geçmişe çekilir, aksi halde her bekleyen
        // itiraz aylarca gecikmiş görünür.
        const recentEsc = addDays(ref, -(1 + Math.floor(rnd() * 6)));
        const escDue = addBusinessDays(recentEsc, SLA.ITIRAZ, holidays);
        run(
          "UPDATE complaints SET escalation_due_at = ? WHERE id = ?", escDue, cid,
        );
        run(
          "UPDATE tasks SET due_at = ? WHERE complaint_id = ? AND code = ?",
          escDue, cid, TASK.DAIRE_KARAR,
        );
        tl.escalated = recentEsc;
        tl.escDecided = null;
        result.open++;
        retime(cid, tl);
        continue;
      }
    }

    if (haksiz) {
      // Haksız ve kesinleşti: bilgilendirme + kapanış
      tl.transaction = null;
      await runAsRole(fid, ROLES.KALITE_SORUMLUSU, () =>
        sendCustomerInfo(
          cid,
          "Şikâyetiniz kapsamında yerinde inceleme ve laboratuvar analizi yapılmış, ürünün " +
          "ilgili kalite standartlarına ve satış sözleşmesine uygun olduğu tespit edilmiştir. " +
          "İnceleme sonucu ve gerekçesi ekteki tutanakta ayrıntılı olarak yer almaktadır.",
        ),
      );
      tl.informed = addBusinessDays(tl.signed, 1, holidays);
      await signChain(
        scalar<number>(
          "SELECT id FROM documents WHERE complaint_id = ? AND type = 'MUSTERI_BILGILENDIRME' ORDER BY id DESC LIMIT 1",
          cid,
        )!, fid,
      );
      await runAsRole(fid, ROLES.FABRIKA_MUDURU, () =>
        closeComplaint(cid, "İnceleme sonucu müşteriye bildirilmiş, dosya kapatılmıştır."),
      );
      tl.closed = addBusinessDays(tl.informed, 1, holidays);
      result.rejected++;
      retime(cid, tl);
      continue;
    }

    await finishJustified(cid, fid, tl, quantityKg, exchange, freight, rnd);
    result.closed++;
    retime(cid, tl);
  }

  result.log.push(
    `${result.created} şikâyet üretildi: ${result.closed} kapandı, ${result.rejected} haklı ` +
    `bulunmadı, ${result.escalated} itiraza gitti, ${result.open} açık, ${result.redirected} yönlendirildi.`,
  );
  return result;
}

/* --- Yardımcılar ---------------------------------------------------------- */

/** Haklı bulunan dosyayı işlem, resmî yazı, bilgilendirme ve kapanışla bitirir. */
async function finishJustified(
  cid: number, fid: number, tl: Timeline, quantityKg: number,
  exchange: boolean, freight: boolean, rnd: () => number,
): Promise<void> {
  const holidays = holidaySet();
  const affected = Math.round(quantityKg * (0.25 + rnd() * 0.7));

  // Karar HAKLI'ya döndüğünde (örneğin daire itirazı kabul ettiğinde) düzeltici
  // faaliyet görevi sonradan açılır; dosya kapatılabilmesi için tamamlanmalıdır.
  const capaOpen = scalar<number>(
    `SELECT COUNT(*) FROM tasks
      WHERE complaint_id = ? AND code = ? AND status IN ('BEKLEMEDE','DEVAM_EDIYOR')`,
    cid, TASK.CAPA_BASLAT,
  ) ?? 0;
  if (capaOpen > 0) {
    await runAsRole(fid, ROLES.KALITE_SORUMLUSU, () =>
      startCapa(
        cid,
        `DF-${tl.received.slice(0, 4)}-${String(500 + (cid % 400))}`,
        "Daire Başkanlığı kararı doğrultusunda kök neden analizi yapılmış ve ilgili proses " +
        "parametresi için kontrol sıklığı artırılmıştır.",
      ),
    );
  }

  await runAsRole(fid, ROLES.AMBAR_SEFI, () =>
    recordTransaction(cid, {
      transactionDate: tl.transaction!,
      returnedKg: exchange ? 0 : affected,
      exchangedKg: exchange ? affected : 0,
      refundAmount: exchange ? 0 : Math.round(affected * (18 + rnd() * 10)),
      note: exchange
        ? "Ürün değişimi tamamlanmış, yeni parti firma deposuna teslim edilmiştir."
        : "Ürün iadesi alınmış, fatura mahsuplaştırılmıştır.",
    }),
  );

  // Nakliye bedelinin ödenmesi Muhasebe'nin kendi adımıdır (md. 6-b).
  if (freight) {
    await runAsRole(fid, ROLES.MUHASEBE, () =>
      recordFreightPayment(cid, {
        amount: Math.round(3500 + rnd() * 14000),
        paidAt: tl.transaction!,
        note: "Firmanın geliş-gidiş nakliye masrafı banka havalesiyle ödenmiştir.",
      }),
    );
  }

  tl.letter = addBusinessDays(tl.transaction!, 2, holidays);
  await runAsRole(fid, ROLES.KALITE_SORUMLUSU, () =>
    sendOfficialLetter(
      cid,
      `${tl.transaction!.slice(0, 4)}/${String(1000 + Math.floor(rnd() * 9000))}`,
      "Şikâyet formu, analiz raporu, tutanak ve yapılan işlemlerin sonucu ekte gönderilmiştir.",
    ),
  );

  await runAsRole(fid, ROLES.KALITE_SORUMLUSU, () =>
    sendCustomerInfo(
      cid,
      "Şikâyetiniz kapsamında yerinde inceleme ve laboratuvar analizi yapılmış, şikâyetiniz " +
      "haklı bulunmuştur. " +
      (exchange ? "Ürün değişimi gerçekleştirilmiştir. " : "Ürün iadesi alınmıştır. ") +
      (freight ? "Geliş-gidiş nakliye bedeli tarafınıza ödenmiştir. " : "") +
      "Benzer durumun yeniden yaşanmaması için düzeltici faaliyet başlatılmıştır.",
    ),
  );
  tl.informed = tl.letter;
  await signChain(
    scalar<number>(
      "SELECT id FROM documents WHERE complaint_id = ? AND type = 'MUSTERI_BILGILENDIRME' ORDER BY id DESC LIMIT 1",
      cid,
    )!, fid,
  );

  await runAsRole(fid, ROLES.FABRIKA_MUDURU, () =>
    closeComplaint(
      cid,
      "İade/değişim işlemi tamamlanmış, resmî yazı daire başkanlıklarına gönderilmiş, " +
      "müşteri bilgilendirilmiş ve dosya kapatılmıştır.",
    ),
  );
  tl.closed = addBusinessDays(tl.informed!, 1, holidays);
}

/** Belgenin imza zincirini (ya da ilk N sırasını) tamamlar. */
async function signChain(documentId: number, factoryId: number, maxSteps?: number): Promise<void> {
  let steps = 0;
  for (;;) {
    const p = pendingSignature(documentId);
    if (!p) break;
    if (maxSteps != null && steps >= maxSteps) break;
    const doc = getDocument(documentId);
    if (!doc || doc.status !== "IMZADA") break;

    const signer = p.user_id
      ? one<{ id: number }>("SELECT id FROM users WHERE id = ?", p.user_id)
      : one<{ id: number }>(
          "SELECT id FROM users WHERE factory_id = ? AND role = ? AND is_active = 1 LIMIT 1",
          factoryId, p.expected_role,
        );
    if (!signer) break;

    await runAs(signer.id, async () => {
      const me = (await currentUser())!;
      signDocument(documentId, me, "ONAY", null);
    });
    steps++;
  }
}

/**
 * Zaman damgalarını geçmişe yayılmış gerçekçi takvime yazar.
 * Yalnızca demo verisi için kullanılır; gerçek kayıtlar dokunulmaz.
 */
function retime(complaintId: number, tl: Timeline): void {
  const stamp = (day: string | null, hour = 10) =>
    day ? `${day} ${String(hour).padStart(2, "0")}:${String(5 + (complaintId % 50)).padStart(2, "0")}:00` : null;

  tx(() => {
    // Yalnızca gerçekten gerçekleşmiş adımların damgaları yeniden yazılır;
    // NULL olan alanlar (henüz yapılmamış adımlar) NULL kalır.
    const keep = (col: string) => `${col} = CASE WHEN ${col} IS NULL THEN NULL ELSE ? END`;
    run(
      `UPDATE complaints SET
         ${keep("team_formed_at")}, ${keep("visited_at")}, ${keep("verdict_at")},
         ${keep("capa_started_at")}, ${keep("letter_sent_at")}, ${keep("customer_informed_at")},
         ${keep("closed_at")}, ${keep("escalated_at")}, ${keep("escalation_decided_at")},
         created_at = ?, updated_at = ?
       WHERE id = ?`,
      stamp(tl.team || null, 9), tl.visit || null, stamp(tl.signed, 16), stamp(tl.capa, 11),
      tl.letter, stamp(tl.informed, 14), stamp(tl.closed, 17),
      stamp(tl.escalated, 15), stamp(tl.escDecided, 12),
      stamp(tl.received, 8), stamp(tl.closed ?? tl.signed, 17),
      complaintId,
    );

    // Görev tamamlanma tarihleri
    const TASK_DAY: Record<string, string | null> = {
      [TASK.EKIP_KUR]: tl.team || null,
      [TASK.YERINDE_INCELEME]: tl.visit,
      [TASK.NUMUNE_AL]: tl.sample,
      [TASK.ANALIZ_GIR]: tl.analysis,
      [TASK.TUTANAK_HAZIRLA]: tl.tutanak,
      [TASK.TUTANAK_IMZA]: tl.signed,
      [TASK.CAPA_BASLAT]: tl.capa,
      [TASK.ITIRAZ_GONDER]: tl.escalated,
      [TASK.DAIRE_KARAR]: tl.escDecided,
      [TASK.IADE_DEGISIM]: tl.transaction,
      [TASK.NAKLIYE_ODEME]: tl.transaction,
      [TASK.RESMI_YAZI]: tl.letter,
      [TASK.MUSTERI_BILGI]: tl.informed,
      [TASK.DOSYA_KAPAT]: tl.closed,
    };
    for (const [code, day] of Object.entries(TASK_DAY)) {
      if (!day) continue;
      run(
        `UPDATE tasks SET completed_at = ? WHERE complaint_id = ? AND code = ? AND completed_at IS NOT NULL`,
        stamp(day, 13), complaintId, code,
      );
    }

    run("UPDATE samples SET created_at = ? WHERE complaint_id = ?", stamp(tl.sample, 11), complaintId);
    run("UPDATE analyses SET created_at = ? WHERE complaint_id = ?", stamp(tl.analysis, 15), complaintId);
    run(
      `UPDATE documents SET created_at = ?, submitted_at = ?,
              approved_at = CASE WHEN approved_at IS NULL THEN NULL ELSE ? END
        WHERE complaint_id = ?`,
      stamp(tl.tutanak, 12), stamp(tl.tutanak, 12), stamp(tl.signed, 16), complaintId,
    );
    run(
      `UPDATE document_signatures SET decided_at = ?
        WHERE decided_at IS NOT NULL
          AND document_id IN (SELECT id FROM documents WHERE complaint_id = ?)`,
      stamp(tl.signed, 15), complaintId,
    );
    run(
      "UPDATE official_letters SET created_at = ? WHERE complaint_id = ?",
      stamp(tl.letter, 11), complaintId,
    );

    // Olay günlüğü ve bildirimler sırayı koruyacak şekilde kayıt tarihinden kapanışa yayılır
    const events = all<{ id: number }>(
      "SELECT id FROM complaint_events WHERE complaint_id = ? ORDER BY id", complaintId,
    );
    const lastDay = tl.closed ?? tl.signed ?? tl.received;
    events.forEach((e, idx) => {
      const ratio = events.length > 1 ? idx / (events.length - 1) : 0;
      const day = pickDay(tl.received, lastDay, ratio);
      run("UPDATE complaint_events SET created_at = ? WHERE id = ?", stamp(day, 9 + (idx % 8)), e.id);
    });
    const notes = all<{ id: number }>(
      "SELECT id FROM notifications WHERE complaint_id = ? ORDER BY id", complaintId,
    );
    notes.forEach((n, idx) => {
      const ratio = notes.length > 1 ? idx / (notes.length - 1) : 0;
      const day = pickDay(tl.received, lastDay, ratio);
      run(
        "UPDATE notifications SET created_at = ?, sent_at = CASE WHEN sent_at IS NULL THEN NULL ELSE ? END WHERE id = ?",
        stamp(day, 10 + (idx % 7)), stamp(day, 10 + (idx % 7)), n.id,
      );
    });
  });
}

/** İki gün arasında oransal bir gün seçer. */
function pickDay(from: string, to: string, ratio: number): string {
  const a = new Date(`${from}T00:00:00Z`).getTime();
  const b = new Date(`${to}T00:00:00Z`).getTime();
  const t = a + (b - a) * Math.max(0, Math.min(1, ratio));
  return new Date(t).toISOString().slice(0, 10);
}

/** Tüm şikâyet verisini siler; referans tanımlar ve kullanıcılar kalır. */
export function clearComplaintData(): number {
  const n = scalar<number>("SELECT COUNT(*) FROM complaints") ?? 0;
  tx(() => {
    run("DELETE FROM notifications");
    run("DELETE FROM official_letters");
    run("DELETE FROM document_signatures");
    run("DELETE FROM documents");
    run("DELETE FROM analysis_results");
    run("DELETE FROM analyses");
    run("DELETE FROM samples");
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
