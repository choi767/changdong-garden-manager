import type { AppData, Bed, ManagementGroup, ManagementSheet, ManagementSheetPlant, Plant } from "../entities/models";

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

export function getSheetPlants(data: AppData, sheetId: string): Array<ManagementSheetPlant & { plant: Plant | undefined }> {
  return data.sheetPlants
    .filter((item) => item.managementSheetId === sheetId && item.isActive)
    .map((item) => ({ ...item, plant: data.plants.find((plant) => plant.id === item.plantId) }));
}

export function getBedLabelList(beds: Bed[]): string {
  return beds.map((bed) => bed.displayCode).sort((a, b) => a.localeCompare(b, "ko-KR", { numeric: true })).join(", ");
}
