import ExcelJS from "exceljs";
import { NextResponse } from "next/server";
import { isGmRole } from "@/lib/roles";
import { today } from "@/lib/dates";
import { currentUser } from "@/server/auth";
import { MONTHLY_HEADERS, buildMonthlyReport, monthlyCells } from "@/server/monthly";
import { getSetting } from "@/server/settings";

/**
 * FR PASAT 005 Aylık Müşteri Şikâyetleri Tablosunu Excel olarak üretir.
 * Formdaki yerleşim korunur: başlık bloğu, künye satırı, kullanım notları,
 * 17 kolonlu tablo, aylık işlem toplamı, gönderim dağıtımı ve imza alanı.
 */
export async function GET(req: Request) {
  const user = await currentUser();
  if (!user) return new NextResponse("Yetkisiz erişim.", { status: 401 });

  const url = new URL(req.url);
  const gm = isGmRole(user.role) || user.role === "SISTEM_YONETICISI";
  const factoryId = gm
    ? Number(url.searchParams.get("fabrika") ?? 0)
    : (user.factory_id ?? 0);
  const year = Number(url.searchParams.get("y") ?? today().slice(0, 4));
  const month = Number(url.searchParams.get("a") ?? today().slice(5, 7));

  if (!factoryId) return new NextResponse("Fabrika seçilmedi.", { status: 400 });
  if (!gm && user.factory_id !== factoryId) {
    return new NextResponse("Bu fabrikanın raporuna erişim yetkiniz yok.", { status: 403 });
  }

  const rep = buildMonthlyReport(factoryId, year, month);
  const kurum = getSetting("kurum_adi", "Türkiye Şeker Fabrikaları A.Ş.");

  const wb = new ExcelJS.Workbook();
  wb.creator = kurum;
  wb.created = new Date();
  const ws = wb.addWorksheet("Aylık Şikâyet Tablosu", {
    pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1, paperSize: 9 },
    views: [{ state: "frozen", ySplit: 9 }],
  });

  const COLS = MONTHLY_HEADERS.length; // 17
  const lastCol = String.fromCharCode(64 + COLS); // Q

  const thin = { style: "thin" as const, color: { argb: "FF9AA5B1" } };
  const border = { top: thin, left: thin, bottom: thin, right: thin };

  /* --- Başlık bloğu (form yerleşimi) --- */
  ws.mergeCells("A1:C2");
  ws.getCell("A1").value = `${kurum.toLocaleUpperCase("tr-TR")}\nGENEL MÜDÜRLÜĞÜ`;
  ws.getCell("A1").alignment = { vertical: "middle", horizontal: "center", wrapText: true };
  ws.getCell("A1").font = { bold: true, size: 10 };

  ws.mergeCells(`D1:${lastCol}2`);
  ws.getCell("D1").value = "AYLIK MÜŞTERİ ŞİKAYETLERİ TABLOSU";
  ws.getCell("D1").alignment = { vertical: "middle", horizontal: "center" };
  ws.getCell("D1").font = { bold: true, size: 14 };

  /* --- Künye satırı --- */
  ws.getCell("A4").value = "Fabrika adı:";
  ws.getCell("A4").font = { bold: true };
  ws.getCell("B4").value = rep.factoryName;
  ws.getCell("F4").value = "Rapor dönemi (Ay / Yıl):";
  ws.getCell("F4").font = { bold: true };
  ws.getCell("H4").value = rep.periodLabel;
  ws.getCell("J4").value = "Düzenleme tarihi:";
  ws.getCell("J4").font = { bold: true };
  ws.getCell("L4").value = today();

  /* --- Kullanım notları --- */
  ws.getCell("A6").value =
    "Her satıra bir şikâyet yazınız. Önceki aydan devreden açık dosyalar aynı şikâyet numarasıyla izlenir.";
  ws.getCell("A7").value =
    "Miktarlar kg, bedeller TL olarak girilir. Mali alanlara yalnızca rapor ayında gerçekleşen işlemler yazılır.";
  for (const r of [6, 7]) {
    ws.getCell(`A${r}`).font = { italic: true, size: 9, color: { argb: "FF52514E" } };
  }

  /* --- Tablo başlıkları (satır 9) --- */
  const headerRow = ws.getRow(9);
  MONTHLY_HEADERS.forEach((h, i) => {
    const cell = headerRow.getCell(i + 1);
    cell.value = h;
    cell.font = { bold: true, size: 9, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1A3F72" } };
    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    cell.border = border;
  });
  headerRow.height = 42;

  /* --- Veri satırları --- */
  let r = 10;
  for (const row of rep.rows) {
    const cells = monthlyCells(row);
    const xl = ws.getRow(r);
    cells.forEach((v, i) => {
      const cell = xl.getCell(i + 1);
      cell.value = v as ExcelJS.CellValue;
      cell.border = border;
      cell.alignment = { vertical: "top", wrapText: i >= 7 && i !== 8 };
      cell.font = { size: 9 };
      // Miktar kolonları (9, 12, 13) ve bedel kolonları (14, 15)
      if ([9, 12, 13].includes(i + 1)) cell.numFmt = "#,##0.##";
      if ([14, 15].includes(i + 1)) cell.numFmt = "#,##0.00";
    });
    if (row.carried_over) {
      xl.eachCell((cell) => {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFF8E1" } };
      });
    }
    r++;
  }

  if (rep.rows.length === 0) {
    ws.mergeCells(`A${r}:${lastCol}${r}`);
    ws.getCell(`A${r}`).value = rep.emptyNote ?? "Bu ay yeni müşteri şikâyeti alınmamıştır.";
    ws.getCell(`A${r}`).alignment = { horizontal: "center" };
    ws.getCell(`A${r}`).font = { italic: true };
    ws.getCell(`A${r}`).border = border;
    r++;
  }

  /* --- Aylık işlem toplamı --- */
  const totalRow = r + 1;
  ws.getCell(`A${totalRow}`).value = "AYLIK İŞLEM TOPLAMI";
  ws.getCell(`A${totalRow}`).font = { bold: true };
  ws.getCell(`L${totalRow}`).value = rep.totals.returned_kg || 0;
  ws.getCell(`M${totalRow}`).value = rep.totals.exchanged_kg || 0;
  ws.getCell(`N${totalRow}`).value = rep.totals.refund_amount || 0;
  ws.getCell(`O${totalRow}`).value = rep.totals.freight_amount || 0;
  for (const col of ["L", "M", "N", "O"]) {
    const cell = ws.getCell(`${col}${totalRow}`);
    cell.font = { bold: true };
    cell.border = border;
    cell.numFmt = col === "N" || col === "O" ? "#,##0.00" : "#,##0.##";
  }

  /* --- Gönderim dağıtımı --- */
  let d = totalRow + 2;
  ws.getCell(`A${d}`).value = "GÖNDERİM DAĞITIMI";
  ws.getCell(`A${d}`).font = { bold: true };
  d++;
  for (const name of rep.recipients) {
    ws.getCell(`A${d}`).value = `• ${name}`;
    ws.getCell(`A${d}`).font = { size: 9 };
    d++;
  }
  ws.getCell(`A${d}`).value =
    "Dayanak: TL PASAT 004 “Müşteri Şikâyetlerinde Uygulamalar” md. 8. " +
    "Paketli şekerlerde Perakende Satışlar ve Lojistik, diğer ürünlerde Pazarlama ve Satış Daire Başkanlığı.";
  ws.getCell(`A${d}`).font = { italic: true, size: 9, color: { argb: "FF52514E" } };
  d += 2;

  /* --- İmza alanı --- */
  ws.getCell(`A${d}`).value = "Hazırlayan (Ad / Unvan):";
  ws.getCell(`A${d}`).font = { bold: true };
  ws.getCell(`F${d}`).value = "Kontrol / Onay:";
  ws.getCell(`F${d}`).font = { bold: true };
  d += 2;
  ws.getCell(`N${d}`).value = "FR PASAT 005/00/24.09.2026";
  ws.getCell(`N${d}`).font = { size: 8, color: { argb: "FF52514E" } };

  /* --- Kolon genişlikleri --- */
  const widths = [15, 13, 12, 26, 24, 16, 13, 34, 13, 38, 32, 12, 13, 15, 16, 12, 26];
  widths.forEach((w, i) => { ws.getColumn(i + 1).width = w; });

  const buf = await wb.xlsx.writeBuffer();
  const fileName =
    `FR-PASAT-005_Aylik_Musteri_Sikayetleri_${rep.factoryName.replace(/[^\p{L}\p{N}]+/gu, "-")}` +
    `_${year}-${String(month).padStart(2, "0")}.xlsx`;

  return new NextResponse(new Uint8Array(buf as ArrayBuffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`,
      "Cache-Control": "no-store",
    },
  });
}
