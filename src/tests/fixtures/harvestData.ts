import type { HarvestRecord, ManagementSheetPlant, Plant } from "../../domain/entities/models";
import { createInitialData } from "../../domain/services/seedData";

export function harvestTestData() {
  const data = createInitialData();
  const timestamp = "2026-01-01T00:00:00.000Z";
  function plant(id: string, name: string): Plant {
    return {
      id, name, normalizedName: name, category: "CROP", plantingPeriod: "", seedlingPlantingPeriod: "",
      harvestPeriod: "", floweringPeriod: "", flowerColor: "", plantHeight: "", isVine: false,
      compoundFertilizer: "", oilCakeFertilizer: "", specializedFertilizer: "", topDressing: "",
      watering: "", sunlight: "UNKNOWN", notes: "", imageDataUrl: "", imageMimeType: "",
      imageFileSize: 0, author: "테스트", createdAt: timestamp, updatedAt: timestamp
    };
  }
  data.plants = [plant("potato", "감자"), plant("cabbage", "배추")];
  for (const [zoneNumber, groupNumber, closed] of [[2, 1, true], [1, 10, false], [1, 2, true]] as const) {
    const id = `group_${zoneNumber}_${groupNumber}`;
    const sheetId = `sheet_${zoneNumber}_${groupNumber}`;
    data.managementGroups.push({
      id, zoneId: `zone_${zoneNumber}`, zoneNumber, groupNumber, displayCode: `Z${zoneNumber}-G${groupNumber}`,
      status: closed ? "CLOSED" : "ACTIVE", startDate: "2025-03-01", endDate: closed ? "2027-02-01" : null,
      lastRestoredAt: null, createdAt: timestamp, updatedAt: timestamp
    });
    data.managementSheets.push({
      id: sheetId, managementGroupId: id, status: closed ? "CLOSED" : "ACTIVE", startDate: "2025-03-01",
      endDate: closed ? "2027-02-01" : null, lastRestoredAt: null, createdAt: timestamp, updatedAt: timestamp
    });
    for (const suffix of ["a", "b"]) {
      const sheetPlant: ManagementSheetPlant = {
        id: `${sheetId}_${suffix}`, managementSheetId: sheetId, plantId: "potato", plantedDate: "2026-03-01",
        plantingMethod: "SEEDLING", expectedHarvestPeriod: "", finalHarvestDate: "", cultivationStatus: "GROWING",
        notes: "", isActive: true, createdAt: timestamp, updatedAt: timestamp
      };
      data.sheetPlants.push(sheetPlant);
    }
  }
  function record(id: string, sheetId: string, plantSuffix: string | null, harvestDate: string, quantity: number, unit: string): HarvestRecord {
    return {
      id, managementSheetId: sheetId, managementSheetPlantId: plantSuffix ? `${sheetId}_${plantSuffix}` : null,
      harvestDate, quantity, unit, quality: "보통", notes: "", createdAt: timestamp, updatedAt: timestamp
    };
  }
  data.harvestRecords = [
    record("r1", "sheet_2_1", "a", "2026-01-01", 100, "Kg"),
    record("r2", "sheet_1_10", "a", "2026-12-31", 180, "kg"),
    record("r3", "sheet_1_10", "b", "2026-06-01", 20, " KG "),
    record("r4", "sheet_1_2", "a", "2026-06-02", 200, "개"),
    record("r5", "sheet_1_2", "b", "2026-06-03", 0, "kg"),
    record("r6", "sheet_1_10", null, "2026-10-15", 0, "개"),
    record("previous", "sheet_2_1", "a", "2025-12-31", 10, "kg"),
    record("next", "sheet_1_10", "a", "2027-01-01", 30, "kg")
  ];
  return data;
}
