import type { HarvestPlantSummary } from "./harvestSummary";

export function createHarvestReport(summaries: HarvestPlantSummary[]) {
  const totals = summaries.flatMap((plant) => [...plant.totals]
    .sort(([a], [b]) => a.localeCompare(b, "ko"))
    .map(([unit, quantity]) => ({ plant: plant.name, unit, quantity: Number(quantity.toFixed(10)) })));
  const details = summaries.flatMap((plant) => plant.sheets.flatMap((info) => info.records.map((record) => ({
    date: record.harvestDate, plant: plant.name, group: info.group?.displayCode ?? "관리표 없음",
    status: info.sheet ? (info.sheet.status === "CLOSED" ? "종료" : "관리중") : "관리표 없음",
    quantity: record.quantity, unit: record.unit.trim().replace(/\s+/g, "").toLowerCase() || "단위 미지정",
    quality: record.quality, notes: record.notes,
    zoneNumber: info.group?.zoneNumber ?? Infinity, groupNumber: info.group?.groupNumber ?? Infinity
  }))));
  details.sort((a, b) => b.date.localeCompare(a.date) || a.plant.localeCompare(b.plant, "ko") || a.zoneNumber - b.zoneNumber || a.groupNumber - b.groupNumber);
  return { totals, details };
}
