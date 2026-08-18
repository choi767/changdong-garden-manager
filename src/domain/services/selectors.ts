import type { AppData, Bed, ManagementGroup, ManagementSheet, ManagementSheetPlant, Plant } from "../entities/models";

export type SheetPlantWithPlant = ManagementSheetPlant & { plant: Plant | undefined };

export function getGroupSheet(data: AppData, groupId: string): ManagementSheet | undefined {
  return data.managementSheets.find((sheet) => sheet.managementGroupId === groupId);
}

export function getSheetGroup(data: AppData, sheetId: string): ManagementGroup | undefined {
  const sheet = data.managementSheets.find((item) => item.id === sheetId);
  return sheet ? data.managementGroups.find((group) => group.id === sheet.managementGroupId) : undefined;
}

export function getCurrentBedsForGroup(data: AppData, groupId: string): Bed[] {
  const bedIds = data.memberships.filter((membership) => membership.managementGroupId === groupId && membership.isCurrent && !membership.removedAt).map((membership) => membership.bedId);
  return data.beds.filter((bed) => bedIds.includes(bed.id));
}

export function getPastBedsForGroup(data: AppData, groupId: string): Bed[] {
  const currentIds = new Set(getCurrentBedsForGroup(data, groupId).map((bed) => bed.id));
  const pastIds = data.memberships.filter((membership) => membership.managementGroupId === groupId && !membership.isCurrent).map((membership) => membership.bedId);
  return data.beds.filter((bed) => pastIds.includes(bed.id) && !currentIds.has(bed.id));
}

export function getActiveGroupForBedId(data: AppData, bedId: string): ManagementGroup | undefined {
  const membership = data.memberships.find((item) => item.bedId === bedId && item.isCurrent && !item.removedAt);
  return membership ? data.managementGroups.find((group) => group.id === membership.managementGroupId && group.status === "ACTIVE") : undefined;
}

export function getSheetPlants(data: AppData, sheetId: string): SheetPlantWithPlant[] {
  return data.sheetPlants
    .filter((item) => item.managementSheetId === sheetId && item.isActive)
    .map((item) => ({ ...item, plant: data.plants.find((plant) => plant.id === item.plantId) }));
}

export function makeSheetPlantDisplayNameMap(sheetPlants: SheetPlantWithPlant[]): Map<string, string> {
  const names = new Map<string, string>();
  const byPlantId = new Map<string, SheetPlantWithPlant[]>();
  for (const sheetPlant of sheetPlants) {
    const list = byPlantId.get(sheetPlant.plantId) ?? [];
    list.push(sheetPlant);
    byPlantId.set(sheetPlant.plantId, list);
  }

  for (const list of byPlantId.values()) {
    const ordered = [...list].sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
    ordered.forEach((sheetPlant, index) => {
      const baseName = sheetPlant.plant?.name ?? "삭제된 식물";
      names.set(sheetPlant.id, index === 0 ? baseName : `${baseName}(추가${index})`);
    });
  }
  return names;
}

export function getSheetPlantDisplayName(data: AppData, sheetPlantId: string | null): string {
  if (!sheetPlantId) return "식물명미지정";
  const sheetPlant = data.sheetPlants.find((item) => item.id === sheetPlantId);
  if (!sheetPlant) return "삭제된 식물";
  const sheetPlants = getSheetPlants(data, sheetPlant.managementSheetId);
  return makeSheetPlantDisplayNameMap(sheetPlants).get(sheetPlantId) ?? "삭제된 식물";
}

export function getBedLabelList(beds: Bed[]): string {
  return beds.map((bed) => bed.displayCode).sort((a, b) => a.localeCompare(b, "ko-KR", { numeric: true })).join(", ");
}
