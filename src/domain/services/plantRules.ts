import type { ManagementSheetPlant, Plant } from "../entities/models";

export const MAX_PLANTS = 200;
export const MAX_SHEET_PLANTS = 5;

export function normalizePlantName(name: string): string {
  return name.trim().replace(/\s+/g, "").toLocaleLowerCase("ko-KR");
}

export function validateNewPlantName(plants: Plant[], name: string): string | null {
  const normalizedName = normalizePlantName(name);
  if (!normalizedName) return "식물명은 필수입니다.";
  if (plants.length >= MAX_PLANTS) {
    return "등록 가능한 식물 수 200개에 도달했습니다.";
  }
  if (plants.some((plant) => plant.normalizedName === normalizedName)) {
    return "동일한 식물명이 이미 등록되어 있습니다.";
  }
  return null;
}

export function validateAddSheetPlant(sheetPlants: ManagementSheetPlant[], managementSheetId: string, plantId: string): string | null {
  const activePlants = sheetPlants.filter((item) => item.managementSheetId === managementSheetId && item.isActive);
  if (activePlants.length >= MAX_SHEET_PLANTS) {
    return "관리표 하나에는 식물을 최대 5종까지 등록할 수 있습니다.";
  }
  if (activePlants.some((item) => item.plantId === plantId)) {
    return "같은 식물을 동일 관리표에 중복 등록할 수 없습니다.";
  }
  return null;
}
