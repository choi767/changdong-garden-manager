import { describe, expect, it } from "vitest";
import ExcelJS from "exceljs";
import { createHarvestWorkbook, harvestExportFilename } from "../utils/harvestExcel";
import { summarizeHarvests } from "../domain/services/harvestSummary";
import { harvestTestData } from "./fixtures/harvestData";

describe("수확량 엑셀 내보내기", () => {
  it("조회 연도의 전체 합계를 작물·단위별 행에 숫자로 저장하고 상세를 날짜순으로 보존한다", () => {
    const workbook = createHarvestWorkbook(summarizeHarvests(harvestTestData(), 2026), 2026);
    expect(workbook.worksheets.map((sheet) => sheet.name)).toEqual(["수확량 합계", "수확 상세"]);
    const summary = workbook.getWorksheet("수확량 합계")!;
    const rows = [5, 6, 7].map((row) => summary.getRow(row).values);
    expect(rows).toContainEqual([, "감자", "kg", 300]);
    expect(rows).toContainEqual([, "감자", "개", 200]);
    expect(rows).toContainEqual([, "식물명 미지정", "개", 0]);
    const detail = workbook.getWorksheet("수확 상세")!;
    expect(detail.rowCount).toBe(10);
    expect(detail.getCell("A5").value).toEqual(new Date("2026-12-31T00:00:00Z"));
    expect(detail.getCell("A10").value).toEqual(new Date("2026-01-01T00:00:00Z"));
    expect(detail.getCell("A5").numFmt).toBe("yyyy-mm-dd");
    expect([5, 6, 7, 8, 9, 10].map((row) => detail.getCell(`D${row}`).value)).toContain("종료");
    expect(detail.views[0]).toMatchObject({ state: "frozen", ySplit: 4 });
    expect(detail.autoFilter).toBeTruthy();
  });

  it("특정 작물만 선택하면 다른 작물과 미지정 기록을 내보내지 않는다", () => {
    const potato = summarizeHarvests(harvestTestData(), 2026).find((plant) => plant.plantId === "potato")!;
    const workbook = createHarvestWorkbook([potato], 2026, potato.name, true);
    expect(workbook.worksheets[0].name).toBe("수확 상세");
    expect(workbook.getWorksheet("수확량 합계")!.rowCount).toBe(6);
    const detail = workbook.getWorksheet("수확 상세")!;
    expect(detail.rowCount).toBe(12);
    for (let row = 5; row <= 9; row++) expect(detail.getCell(`B${row}`).value).toBe("감자");
    expect(detail.getCell("A11").value).toBe("합계");
    expect(detail.getCell("E11").value).toEqual({ formula: 'SUMIFS(E5:E9,B5:B9,"감자",F5:F9,"개")', result: 200 });
    expect(detail.getCell("E12").value).toEqual({ formula: 'SUMIFS(E5:E9,B5:B9,"감자",F5:F9,"kg")', result: 300 });
    expect(workbook.getWorksheet("수확량 합계")!.getCell("C6").value).toEqual({ formula: "'수확 상세'!E12", result: 300 });
    expect(detail.autoFilter).toMatchObject({ to: { row: 9 } });
    expect(workbook.getWorksheet("수확량 합계")!.getCell("A2").value).toBe("2026년 · 감자");
  });

  it("실제 XLSX로 저장하고 다시 읽어도 한글·수량 0·날짜·메모가 유지된다", async () => {
    const data = harvestTestData();
    data.harvestRecords[1].notes = '=1+1\n두 번째 줄 메모';
    const workbook = createHarvestWorkbook(summarizeHarvests(data, 2026), 2026);
    const bytes = await workbook.xlsx.writeBuffer();
    expect(new Uint8Array(bytes).slice(0, 2)).toEqual(new Uint8Array([80, 75]));
    const restored = new ExcelJS.Workbook();
    await restored.xlsx.load(bytes);
    const detail = restored.getWorksheet("수확 상세")!;
    expect(detail.getCell("H5").value).toBe('=1+1\n두 번째 줄 메모');
    expect(detail.getCell("H5").type).toBe(ExcelJS.ValueType.String);
    expect(detail.getCell("E6").value).toBe(0);
    expect(detail.getCell("A5").value).toEqual(new Date("2026-12-31T00:00:00Z"));
  });

  it("빈 결과는 내보내지 않고 파일명에 조회연도와 작물명을 넣는다", () => {
    expect(() => createHarvestWorkbook([], 2024)).toThrow("내보낼 수확기록이 없습니다.");
    expect(harvestExportFilename(2026, "전체")).toBe("수확량집계_2026년_전체.xlsx");
    expect(harvestExportFilename(2025, "고추/풋고추")).toBe("수확량집계_2025년_고추_풋고추.xlsx");
  });
});
