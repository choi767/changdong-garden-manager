import ExcelJS from "exceljs";
import type { HarvestPlantSummary } from "../domain/services/harvestSummary";

const quantityFormat = '#,##0.##########';

function reportSheet(workbook: ExcelJS.Workbook, name: string, title: string, year: number, scope: string, headers: string[], widths: number[]) {
  const sheet = workbook.addWorksheet(name, { views: [{ state: "frozen", ySplit: 4 }] });
  widths.forEach((width, index) => { sheet.getColumn(index + 1).width = width; });
  sheet.mergeCells(1, 1, 1, headers.length);
  sheet.getCell("A1").value = title;
  sheet.getCell("A1").font = { name: "맑은 고딕", size: 18, bold: true, color: { argb: "FF226B45" } };
  sheet.getRow(1).height = 32;
  sheet.mergeCells(2, 1, 2, headers.length);
  sheet.getCell("A2").value = `${year}년 · ${scope}`;
  sheet.getCell("A2").font = { name: "맑은 고딕", size: 11, color: { argb: "FF5A6860" } };
  sheet.getRow(4).values = headers;
  sheet.getRow(4).height = 26;
  sheet.getRow(4).eachCell((cell) => {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF226B45" } };
    cell.font = { name: "맑은 고딕", size: 11, bold: true, color: { argb: "FFFFFFFF" } };
    cell.alignment = { vertical: "middle", wrapText: true };
  });
  sheet.pageSetup = { paperSize: 9, orientation: headers.length > 3 ? "landscape" : "portrait", fitToPage: true, fitToWidth: 1, fitToHeight: 0, printTitlesRow: "1:4" };
  return sheet;
}

export function harvestExportFilename(year: number, scope: string): string {
  const safeScope = scope.replace(/[<>:"/\\|?*\u0000-\u001f]/g, "_").trim() || "작물";
  return `수확량집계_${year}년_${safeScope}.xlsx`;
}

export function createHarvestWorkbook(summaries: HarvestPlantSummary[], year: number, scope = "전체"): ExcelJS.Workbook {
  if (!summaries.length) throw new Error("내보낼 수확기록이 없습니다.");
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "틀밭 농장 관리";
  const summary = reportSheet(workbook, "수확량 합계", "수확량 집계", year, scope, ["작물명", "단위", "수확량 합계"], [26, 18, 22]);
  const detail = reportSheet(workbook, "수확 상세", "수확 상세 기록", year, scope, ["수확일", "작물명", "관리그룹", "관리상태", "수확량", "단위", "품질", "메모"], [16, 24, 18, 14, 16, 18, 14, 55]);
  const details: { date: string; name: string; zone: number; group: number; values: ExcelJS.CellValue[] }[] = [];
  for (const plant of summaries) {
    for (const [unit, quantity] of [...plant.totals].sort(([a], [b]) => a.localeCompare(b, "ko"))) {
      summary.addRow([plant.name, unit, Number(quantity.toFixed(10))]);
    }
    for (const info of plant.sheets) {
      for (const record of info.records) {
        details.push({
          date: record.harvestDate, name: plant.name, zone: info.group?.zoneNumber ?? Infinity, group: info.group?.groupNumber ?? Infinity,
          values: [new Date(`${record.harvestDate}T00:00:00Z`), plant.name, info.group?.displayCode ?? "관리표 없음", info.sheet ? (info.sheet.status === "CLOSED" ? "종료" : "관리중") : "관리표 없음", record.quantity, record.unit.trim().replace(/\s+/g, "").toLowerCase() || "단위 미지정", record.quality, record.notes]
        });
      }
    }
  }
  details.sort((a, b) => b.date.localeCompare(a.date) || a.name.localeCompare(b.name, "ko") || a.zone - b.zone || a.group - b.group);
  for (const record of details) detail.addRow(record.values);
  for (const sheet of [summary, detail]) {
    sheet.autoFilter = { from: { row: 4, column: 1 }, to: { row: sheet.rowCount, column: sheet.columnCount } };
    for (let index = 5; index <= sheet.rowCount; index++) {
      const row = sheet.getRow(index);
      row.height = sheet === detail ? 34 : 24;
      row.eachCell((cell) => {
        cell.font = { name: "맑은 고딕", size: 11 };
        cell.alignment = { vertical: "middle", wrapText: true };
        if (index % 2 === 1) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF0F5F1" } };
        if (typeof cell.value === "string") {
          const width = (sheet.getColumn(cell.col).width ?? 15) - 2;
          const lines = cell.value.split("\n").reduce((count, line) => count + Math.max(1, Math.ceil([...line].reduce((size, char) => size + (char.charCodeAt(0) > 255 ? 2 : 1), 0) / width)), 0);
          row.height = Math.max(row.height ?? 24, Math.min(409, lines * 16 + 8));
        }
      });
    }
  }
  detail.getColumn(1).numFmt = "yyyy-mm-dd";
  for (const [sheet, column] of [[summary, 3], [detail, 5]] as const) {
    for (let index = 5; index <= sheet.rowCount; index++) {
      const cell = sheet.getCell(index, column);
      cell.numFmt = Number.isInteger(cell.value) ? "#,##0" : quantityFormat;
    }
  }
  return workbook;
}

export async function downloadHarvestExcel(summaries: HarvestPlantSummary[], year: number, scope = "전체") {
  const workbook = createHarvestWorkbook(summaries, year, scope);
  const bytes = await workbook.xlsx.writeBuffer();
  const blob = new Blob([new Uint8Array(bytes)], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = harvestExportFilename(year, scope);
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 60000);
}
