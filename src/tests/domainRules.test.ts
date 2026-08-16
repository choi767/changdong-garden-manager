import { describe, expect, it } from "vitest";
import { createInitialData } from "../domain/services/seedData";
import { validateAddSheetPlant, validateNewPlantName } from "../domain/services/plantRules";
import { getNextGroupNumber, validateGroupBedSelection, validateRemoveBedsFromGroup } from "../domain/services/groupRules";

describe("창동 틀밭관리 V2.1 업무 규칙", () => {
  it("초기 데이터는 Zone1 24개, Zone2 43개, Zone3 10개 틀을 만든다", () => {
    const data = createInitialData();
    expect(data.beds.filter((bed) => bed.zoneNumber === 1)).toHaveLength(24);
    expect(data.beds.filter((bed) => bed.zoneNumber === 2)).toHaveLength(53);
    expect(data.beds.filter((bed) => bed.zoneNumber === 3)).toHaveLength(10);
    expect(data.beds.some((bed) => bed.displayCode === "2-43-a")).toBe(true);
    expect(data.beds.some((bed) => bed.displayCode === "2-49")).toBe(true);
    expect(data.beds.every((bed) => bed.status === "FALLOW")).toBe(true);
  });

  it("관리그룹은 서로 다른 Zone의 틀을 함께 선택할 수 없다", () => {
    const data = createInitialData();
    const beds = [data.beds.find((bed) => bed.displayCode === "1-1")!, data.beds.find((bed) => bed.displayCode === "2-1")!];
    expect(validateGroupBedSelection(beds)).toBe("관리그룹에는 같은 Zone의 틀만 선택할 수 있습니다.");
  });

  it("관리표 식물은 최대 5종까지만 허용한다", () => {
    const sheetId = "sheet_1";
    const sheetPlants = [1, 2, 3, 4, 5].map((index) => ({ id: `sp_${index}`, managementSheetId: sheetId, plantId: `p_${index}`, plantedDate: "", plantingMethod: "SEEDLING" as const, expectedHarvestPeriod: "", finalHarvestDate: "", cultivationStatus: "GROWING" as const, notes: "", isActive: true, createdAt: "", updatedAt: "" }));
    expect(validateAddSheetPlant(sheetPlants, sheetId, "p_6")).toBe("관리표 하나에는 식물을 최대 5종까지 등록할 수 있습니다.");
  });

  it("식물명은 공백 차이를 무시하고 중복을 막는다", () => {
    const data = createInitialData();
    data.plants.push({ id: "plant_1", name: "상추", normalizedName: "상추", category: "CROP", plantingPeriod: "", harvestPeriod: "", floweringPeriod: "", flowerColor: "", plantHeight: "", compoundFertilizer: "", oilCakeFertilizer: "", specializedFertilizer: "", topDressing: "", watering: "", sunlight: "UNKNOWN", notes: "", imageDataUrl: "", imageMimeType: "", imageFileSize: 0, author: "사용자", createdAt: "", updatedAt: "" });
    expect(validateNewPlantName(data.plants, "상 추")).toBe("동일한 식물명이 이미 등록되어 있습니다.");
  });

  it("관리그룹 번호는 종료 번호를 재사용하지 않고 증가한다", () => {
    const data = createInitialData();
    data.managementGroups.push({ id: "g1", zoneId: "zone_1", zoneNumber: 1, groupNumber: 1, displayCode: "Z1-G1", status: "CLOSED", startDate: "", endDate: "", lastRestoredAt: null, createdAt: "", updatedAt: "" });
    expect(getNextGroupNumber(data.managementGroups, "zone_1")).toBe(2);
  });

  it("마지막 틀은 관리그룹에서 삭제할 수 없다", () => {
    const data = createInitialData();
    data.memberships.push({ id: "m1", managementGroupId: "g1", bedId: "bed_1_1", addedAt: "", removedAt: null, isCurrent: true, addedReason: "", removedReason: "", author: "", createdAt: "", updatedAt: "" });
    expect(validateRemoveBedsFromGroup(data, "g1", ["bed_1_1"])).toContain("마지막 틀은 삭제할 수 없습니다");
  });
});
