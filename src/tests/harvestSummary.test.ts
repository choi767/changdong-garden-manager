import { describe, expect, it } from "vitest";
import { formatHarvestTotals, summarizeHarvests } from "../domain/services/harvestSummary";
import { harvestTestData } from "./fixtures/harvestData";

describe("연도별 식물별 수확량 집계", () => {
  it("관리종료연도와 관계없이 수확일로 집계하고 반복 식재·단위 표기를 통합한다", () => {
    const [potato] = summarizeHarvests(harvestTestData(), 2026);
    expect(potato.name).toBe("감자");
    expect([...potato.totals]).toEqual([["kg", 300], ["개", 200]]);
    expect(potato.sheets.map((sheet) => sheet.group?.displayCode)).toEqual(["Z1-G2", "Z1-G10", "Z2-G1"]);
    expect(potato.sheets.find((sheet) => sheet.sheetId === "sheet_2_1")?.sheet?.status).toBe("CLOSED");
    expect(potato.sheets.flatMap((sheet) => sheet.records)).toHaveLength(5);
  });
  it("연도 경계를 구분하고 없는 연도는 빈 결과를 반환한다", () => {
    const data = harvestTestData();
    expect(summarizeHarvests(data, 2025)[0].totals.get("kg")).toBe(10);
    expect(summarizeHarvests(data, 2027)[0].totals.get("kg")).toBe(30);
    expect(summarizeHarvests(data, 2024)).toEqual([]);
  });
  it("0인 기록과 식물 미선택 기록을 보존하고 상세 기록은 최근 날짜부터 보여준다", () => {
    const summaries = summarizeHarvests(harvestTestData(), 2026);
    expect(summaries[1].name).toBe("식물명 미지정");
    expect(summaries[1].totals.get("개")).toBe(0);
    expect(summaries[0].sheets[0].records.map((record) => record.id)).toEqual(["r5", "r4"]);
  });
  it("무게와 개수는 분리하고 소수점 합계의 부동소수 오차는 표시하지 않는다", () => {
    const totals = new Map([["kg", 0.1 + 0.2], ["개", 2]]);
    const formatted = formatHarvestTotals(totals);
    expect(formatted).toContain("0.3kg");
    expect(formatted).toContain("2개");
    expect(formatted).not.toContain("000000000");
  });
  it("참조가 누락된 기록도 식물명 미지정에 포함한다", () => {
    const data = harvestTestData();
    data.harvestRecords[0].managementSheetPlantId = "missing";
    data.harvestRecords[0].managementSheetId = "missing-sheet";
    const unknown = summarizeHarvests(data, 2026).find((summary) => summary.plantId === null)!;
    expect(unknown.totals.get("kg")).toBe(100);
    expect(unknown.sheets.find((sheet) => sheet.sheetId === "missing-sheet")?.sheet).toBeUndefined();
  });
});
