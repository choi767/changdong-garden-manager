import type { BedStatus, CultivationStatus, GroupStatus, PlantingMethod, SheetStatus, Sunlight } from "../enums/status";

export type PlantCategory = "CROP" | "FLOWER" | "TREE";

export interface Zone {
  id: string;
  zoneNumber: number;
  name: string;
  description: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Bed {
  id: string;
  zoneId: string;
  zoneNumber: number;
  bedNumber: number;
  displayCode: string;
  status: BedStatus;
  positionX: number;
  positionY: number;
  width: number;
  height: number;
  rotation: number;
  zIndex: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ManagementGroup {
  id: string;
  zoneId: string;
  zoneNumber: number;
  groupNumber: number;
  displayCode: string;
  status: GroupStatus;
  startDate: string;
  endDate: string | null;
  lastRestoredAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ManagementGroupBedMembership {
  id: string;
  managementGroupId: string;
  bedId: string;
  addedAt: string;
  removedAt: string | null;
  isCurrent: boolean;
  addedReason: string;
  removedReason: string;
  author: string;
  createdAt: string;
  updatedAt: string;
}

export interface Plant {
  id: string;
  name: string;
  normalizedName: string;
  category: PlantCategory;
  plantingPeriod: string;
  harvestPeriod: string;
  floweringPeriod: string;
  flowerColor: string;
  plantHeight: string;
  isVine: boolean;
  compoundFertilizer: string;
  oilCakeFertilizer: string;
  specializedFertilizer: string;
  topDressing: string;
  watering: string;
  sunlight: Sunlight;
  notes: string;
  imageDataUrl: string;
  imageMimeType: string;
  imageFileSize: number;
  author: string;
  createdAt: string;
  updatedAt: string;
}

export interface ManagementSheet {
  id: string;
  managementGroupId: string;
  status: SheetStatus;
  startDate: string;
  endDate: string | null;
  lastRestoredAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ManagementSheetPlant {
  id: string;
  managementSheetId: string;
  plantId: string;
  plantedDate: string;
  plantingMethod: PlantingMethod | "";
  expectedHarvestPeriod: string;
  finalHarvestDate: string;
  cultivationStatus: CultivationStatus | "";
  notes: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface WorkLog {
  id: string;
  managementSheetId: string;
  managementSheetPlantId: string | null;
  workDate: string;
  workType: string;
  content: string;
  author: string;
  batchId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface HarvestRecord {
  id: string;
  managementSheetId: string;
  managementSheetPlantId: string;
  harvestDate: string;
  quantity: number;
  unit: string;
  quality: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface Photo {
  id: string;
  managementSheetId: string;
  managementSheetPlantId: string | null;
  recordType: "WORK" | "OBSERVATION" | "PEST" | "HARVEST" | null;
  recordId: string | null;
  imageBlob: Blob;
  thumbnailBlob: Blob;
  mimeType: string;
  fileSize: number;
  description: string;
  photoDate: string;
  createdAt: string;
}

export interface ScheduleReminder {
  id: string;
  managementSheetId: string;
  managementSheetPlantId: string | null;
  dueDate: string;
  category: string;
  content: string;
  isDone: boolean;
  completedAt: string | null;
  batchId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ObservationMemo {
  id: string;
  managementSheetId: string;
  managementSheetPlantId: string | null;
  observedDate: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

export interface PestRecord {
  id: string;
  managementSheetId: string;
  managementSheetPlantId: string | null;
  detectedDate: string;
  pestType: string;
  severity: string;
  symptom: string;
  action: string;
  createdAt: string;
  updatedAt: string;
}

export interface MaterialUsage {
  id: string;
  managementSheetId: string;
  usedDate: string;
  itemName: string;
  quantity: number;
  unit: string;
  cost: number;
  memo: string;
  createdAt: string;
  updatedAt: string;
}

export interface SheetEvaluation {
  id: string;
  managementSheetId: string;
  rating: string;
  summary: string;
  improvement: string;
  evaluatedAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface StatusHistory {
  id: string;
  targetType: "BED" | "GROUP" | "SHEET" | "PLANT";
  targetId: string;
  changedAt: string;
  previousStatus: string;
  newStatus: string;
  changeDescription: string;
  reason: string;
  author: string;
}

export interface AppSetting {
  id: string;
  key: string;
  value: string;
  updatedAt: string;
}

export interface BackgroundImage {
  id: string;
  imageBlob: Blob | null;
  thumbnailBlob: Blob | null;
  mimeType: string;
  fileName: string;
  width: number;
  height: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AppData {
  zones: Zone[];
  beds: Bed[];
  managementGroups: ManagementGroup[];
  memberships: ManagementGroupBedMembership[];
  plants: Plant[];
  managementSheets: ManagementSheet[];
  sheetPlants: ManagementSheetPlant[];
  workLogs: WorkLog[];
  harvestRecords: HarvestRecord[];
  photos: Photo[];
  scheduleReminders: ScheduleReminder[];
  observationMemos: ObservationMemo[];
  pestRecords: PestRecord[];
  materialUsages: MaterialUsage[];
  sheetEvaluations: SheetEvaluation[];
  statusHistories: StatusHistory[];
  appSettings: AppSetting[];
  backgroundImages: BackgroundImage[];
}
