import type { AppData, HarvestRecord, ManagementGroup, ManagementSheet } from "../entities/models";

export interface HarvestSheetSummary {
  sheetId: string;
  sheet: ManagementSheet | undefined;
  group: ManagementGroup | undefined;
  totals: Map<string, number>;
  records: HarvestRecord[];
}

export interface HarvestPlantSummary {
  plantId: string | null;
  name: string;
  totals: Map<string, number>;
  sheets: HarvestSheetSummary[];
}

function addQuantity(totals: Map<string, number>, record: HarvestRecord) {
  const unit = record.unit.trim().replace(/\s+/g, "").toLowerCase() || "단위 미지정";
  totals.set(unit, (totals.get(unit) ?? 0) + record.quantity);
}

export function summarizeHarvests(data: AppData, year: number): HarvestPlantSummary[] {
  const plants = new Map(data.plants.map((plant) => [plant.id, plant]));
  const sheetPlants = new Map(data.sheetPlants.map((plant) => [plant.id, plant]));
  const sheets = new Map(data.managementSheets.map((sheet) => [sheet.id, sheet]));
  const groups = new Map(data.managementGroups.map((group) => [group.id, group]));
  const summaries = new Map<string | null, HarvestPlantSummary>();
  const sheetSummaries = new Map<HarvestPlantSummary, Map<string, HarvestSheetSummary>>();

  for (const record of data.harvestRecords) {
    if (record.harvestDate.slice(0, 4) !== String(year).padStart(4, "0")) continue;
    const sheetPlant = record.managementSheetPlantId ? sheetPlants.get(record.managementSheetPlantId) : undefined;
    const plant = sheetPlant ? plants.get(sheetPlant.plantId) : undefined;
    const plantId = plant?.id ?? null;
    let summary = summaries.get(plantId);
    if (!summary) {
      summary = { plantId, name: plant?.name ?? "식물명 미지정", totals: new Map(), sheets: [] };
      summaries.set(plantId, summary);
      sheetSummaries.set(summary, new Map());
    }
    addQuantity(summary.totals, record);
    const bySheet = sheetSummaries.get(summary)!;
    let sheetSummary = bySheet.get(record.managementSheetId);
    if (!sheetSummary) {
      const sheet = sheets.get(record.managementSheetId);
      sheetSummary = {
        sheetId: record.managementSheetId, sheet,
        group: sheet ? groups.get(sheet.managementGroupId) : undefined,
        totals: new Map(), records: []
      };
      bySheet.set(record.managementSheetId, sheetSummary);
      summary.sheets.push(sheetSummary);
    }
    addQuantity(sheetSummary.totals, record);
    sheetSummary.records.push(record);
  }

  for (const summary of summaries.values()) {
    summary.sheets.sort((a, b) =>
      (a.group?.zoneNumber ?? Infinity) - (b.group?.zoneNumber ?? Infinity)
      || (a.group?.groupNumber ?? Infinity) - (b.group?.groupNumber ?? Infinity)
      || a.sheetId.localeCompare(b.sheetId));
    for (const sheet of summary.sheets) {
      sheet.records.sort((a, b) => b.harvestDate.localeCompare(a.harvestDate) || b.createdAt.localeCompare(a.createdAt));
    }
  }
  return [...summaries.values()].sort((a, b) =>
    Number(a.plantId === null) - Number(b.plantId === null) || a.name.localeCompare(b.name, "ko"));
}

const quantityFormat = new Intl.NumberFormat("ko-KR", { maximumFractionDigits: 10 });

export function formatHarvestTotals(totals: Map<string, number>): string {
  return [...totals.entries()]
    .sort(([a], [b]) => a.localeCompare(b, "ko"))
    .map(([unit, quantity]) => `${quantityFormat.format(quantity)}${unit === "단위 미지정" ? ` (${unit})` : unit}`)
    .join(" + ");
}
