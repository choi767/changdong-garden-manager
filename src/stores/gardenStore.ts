import { create } from "zustand";
import type { AppData, Bed, HarvestRecord, ManagementGroup, ManagementSheet, ManagementSheetPlant, MaterialUsage, ObservationMemo, PestRecord, Photo, Plant, ScheduleReminder, SheetEvaluation, StatusHistory, WorkLog } from "../domain/entities/models";
import { createGardenRepository } from "../infrastructure/repositories/gardenRepositoryFactory";
import { createInitialData } from "../domain/services/seedData";
import { getActiveGroupForBed, getCurrentMemberships, getNextGroupNumber, validateAddBedsToGroup, validateGroupBedSelection, validateRemoveBedsFromGroup } from "../domain/services/groupRules";
import { normalizePlantName, validateAddSheetPlant, validateNewPlantName } from "../domain/services/plantRules";
import { makeId, nowIso, todayIsoDate } from "../utils/id";

const repository = createGardenRepository();
let unsubscribeRemoteData: (() => void) | null = null;

interface RequiredBedSpec {
  bedNumber: number;
  displayCode?: string;
}

const requiredBedSpecsByZone: Record<number, RequiredBedSpec[]> = {
  2: [
    ...Array.from({ length: 43 }, (_, index) => ({ bedNumber: index + 1 })),
    { bedNumber: 431, displayCode: "2-43-a" },
    { bedNumber: 432, displayCode: "2-43-b" },
    { bedNumber: 433, displayCode: "2-43-c" },
    { bedNumber: 434, displayCode: "2-43-d" },
    ...Array.from({ length: 6 }, (_, index) => ({ bedNumber: 44 + index }))
  ],
  3: Array.from({ length: 10 }, (_, index) => ({ bedNumber: index + 1 }))
};

type PlantFormInput = Pick<
  Plant,
  | "name"
  | "category"
  | "plantingPeriod"
  | "harvestPeriod"
  | "floweringPeriod"
  | "flowerColor"
  | "plantHeight"
  | "compoundFertilizer"
  | "oilCakeFertilizer"
  | "specializedFertilizer"
  | "topDressing"
  | "watering"
  | "sunlight"
  | "notes"
  | "imageDataUrl"
  | "imageMimeType"
  | "imageFileSize"
  | "author"
>;

type SheetPlantFormInput = Pick<
  ManagementSheetPlant,
  "plantedDate" | "plantingMethod" | "expectedHarvestPeriod" | "finalHarvestDate" | "cultivationStatus" | "notes"
>;

type ScheduleReminderInput = Pick<ScheduleReminder, "managementSheetId" | "managementSheetPlantId" | "dueDate" | "category" | "content">;
type ObservationMemoInput = Pick<ObservationMemo, "managementSheetId" | "managementSheetPlantId" | "observedDate" | "content">;
type PestRecordInput = Pick<PestRecord, "managementSheetId" | "managementSheetPlantId" | "detectedDate" | "pestType" | "severity" | "symptom" | "action">;
type MaterialUsageInput = Pick<MaterialUsage, "managementSheetId" | "usedDate" | "itemName" | "quantity" | "unit" | "cost" | "memo">;
type SheetEvaluationInput = Pick<SheetEvaluation, "managementSheetId" | "rating" | "summary" | "improvement" | "evaluatedAt">;

interface Notice {
  type: "success" | "error" | "info";
  message: string;
}

interface GardenState {
  data: AppData | null;
  notice: Notice | null;
  loading: boolean;
  load: () => Promise<void>;
  clearNotice: () => void;
  createGroup: (bedIds: string[], startDate: string) => Promise<ManagementSheet>;
  addBedsToGroup: (groupId: string, bedIds: string[]) => Promise<void>;
  removeBedsFromGroup: (groupId: string, bedIds: string[]) => Promise<void>;
  closeManagement: (sheetId: string) => Promise<void>;
  deleteManagement: (sheetId: string) => Promise<void>;
  restoreManagement: (sheetId: string) => Promise<void>;
  addPlant: (input: PlantFormInput) => Promise<void>;
  updatePlant: (plantId: string, input: PlantFormInput) => Promise<void>;
  deletePlant: (plantId: string) => Promise<void>;
  addPlantToSheet: (sheetId: string, plantId: string) => Promise<void>;
  updateSheetPlant: (sheetPlantId: string, input: SheetPlantFormInput) => Promise<void>;
  stopSheetPlant: (sheetPlantId: string) => Promise<void>;
  addWorkLog: (input: Pick<WorkLog, "managementSheetId" | "managementSheetPlantId" | "workDate" | "workType" | "content" | "author">) => Promise<void>;
  deleteWorkLog: (workLogId: string) => Promise<void>;
  addZoneWorkLog: (zoneId: string, workDate: string, workType: string, content: string) => Promise<void>;
  addHarvestRecord: (input: Pick<HarvestRecord, "managementSheetId" | "managementSheetPlantId" | "harvestDate" | "quantity" | "unit" | "quality" | "notes">) => Promise<void>;
  deleteHarvestRecord: (harvestRecordId: string) => Promise<void>;
  addPhoto: (input: Pick<Photo, "managementSheetId" | "managementSheetPlantId" | "imageBlob" | "thumbnailBlob" | "mimeType" | "fileSize" | "description" | "photoDate">) => Promise<void>;
  deletePhoto: (photoId: string) => Promise<void>;
  addScheduleReminder: (input: ScheduleReminderInput) => Promise<void>;
  addZoneScheduleReminder: (zoneId: string, dueDate: string, category: string, content: string) => Promise<void>;
  completeScheduleReminder: (reminderId: string, scope?: "single" | "batch") => Promise<void>;
  toggleScheduleReminder: (reminderId: string) => Promise<void>;
  deleteScheduleReminder: (reminderId: string, scope?: "single" | "batch") => Promise<void>;
  addObservationMemo: (input: ObservationMemoInput) => Promise<void>;
  deleteObservationMemo: (memoId: string) => Promise<void>;
  addPestRecord: (input: PestRecordInput) => Promise<void>;
  deletePestRecord: (pestRecordId: string) => Promise<void>;
  addMaterialUsage: (input: MaterialUsageInput) => Promise<void>;
  deleteMaterialUsage: (materialUsageId: string) => Promise<void>;
  upsertSheetEvaluation: (input: SheetEvaluationInput) => Promise<void>;
  updateBedLayout: (bedId: string, patch: Partial<Pick<Bed, "positionX" | "positionY" | "width" | "height" | "rotation">>) => Promise<void>;
  resetData: () => Promise<void>;
  deleteAllPlants: () => Promise<void>;
  exportJson: () => Promise<string>;
  importJson: (json: string) => Promise<void>;
}

function withDefaults(data: AppData): AppData {
  const beds = [...data.beds];
  const plants = (data.plants ?? []).map((plant) => ({
    ...plant,
    category: plant.category ?? "CROP",
    floweringPeriod: plant.floweringPeriod ?? "",
    flowerColor: plant.flowerColor ?? "",
    plantHeight: plant.plantHeight ?? "",
    imageDataUrl: plant.imageDataUrl ?? "",
    imageMimeType: plant.imageMimeType ?? "",
    imageFileSize: plant.imageFileSize ?? 0
  }));
  for (const [zoneNumberText, requiredSpecs] of Object.entries(requiredBedSpecsByZone)) {
    const zoneNumber = Number(zoneNumberText);
    const zone = data.zones.find((item) => item.zoneNumber === zoneNumber);
    if (!zone) continue;
    for (const spec of requiredSpecs) {
      const displayCode = spec.displayCode ?? `${zoneNumber}-${spec.bedNumber}`;
      if (beds.some((bed) => bed.zoneNumber === zoneNumber && (bed.bedNumber === spec.bedNumber || bed.displayCode === displayCode))) continue;
      const timestamp = nowIso();
      beds.push({
        id: `bed_${zoneNumber}_${spec.bedNumber}`,
        zoneId: zone.id,
        zoneNumber,
        bedNumber: spec.bedNumber,
        displayCode,
        status: "FALLOW",
        positionX: 0,
        positionY: 0,
        width: 0,
        height: 0,
        rotation: 0,
        zIndex: spec.bedNumber,
        isActive: true,
        createdAt: timestamp,
        updatedAt: timestamp
      });
    }
  }
  return {
    ...data,
    beds,
    plants,
    scheduleReminders: (data.scheduleReminders ?? []).map((item) => ({ ...item, batchId: item.batchId ?? null })),
    observationMemos: data.observationMemos ?? [],
    pestRecords: data.pestRecords ?? [],
    materialUsages: data.materialUsages ?? [],
    sheetEvaluations: data.sheetEvaluations ?? []
  };
}

function cloneData(data: AppData): AppData {
  const normalized = withDefaults(data);
  return {
    ...normalized,
    zones: [...normalized.zones],
    beds: [...normalized.beds],
    managementGroups: [...normalized.managementGroups],
    memberships: [...normalized.memberships],
    plants: [...normalized.plants],
    managementSheets: [...normalized.managementSheets],
    sheetPlants: [...normalized.sheetPlants],
    workLogs: [...normalized.workLogs],
    harvestRecords: [...normalized.harvestRecords],
    photos: [...normalized.photos],
    scheduleReminders: [...normalized.scheduleReminders],
    observationMemos: [...normalized.observationMemos],
    pestRecords: [...normalized.pestRecords],
    materialUsages: [...normalized.materialUsages],
    sheetEvaluations: [...normalized.sheetEvaluations],
    statusHistories: [...normalized.statusHistories],
    appSettings: [...normalized.appSettings],
    backgroundImages: [...normalized.backgroundImages]
  };
}

function history(targetType: StatusHistory["targetType"], targetId: string, previousStatus: string, newStatus: string, description: string, reason = "", author = "사용자"): StatusHistory {
  return {
    id: makeId("history"),
    targetType,
    targetId,
    changedAt: nowIso(),
    previousStatus,
    newStatus,
    changeDescription: description,
    reason,
    author
  };
}

async function persist(set: (partial: Partial<GardenState>) => void, data: AppData, message: string): Promise<void> {
  await repository.save(data);
  set({ data, notice: { type: "success", message } });
}

function requireData(data: AppData | null): AppData {
  if (!data) throw new Error("데이터를 불러오는 중입니다.");
  return cloneData(data);
}

export const useGardenStore = create<GardenState>((set, get) => ({
  data: null,
  notice: null,
  loading: false,

  async load() {
    set({ loading: true });
    try {
      const data = await repository.load();
      const normalized = withDefaults(data);
      if (normalized.beds.length !== data.beds.length) {
        await repository.save(normalized);
      }
      if (!unsubscribeRemoteData && repository.subscribe) {
        unsubscribeRemoteData = repository.subscribe((remoteData) => {
          set({
            data: withDefaults(remoteData),
            notice: { type: "info", message: "다른 사용자의 변경사항을 반영했습니다." }
          });
        });
      }
      set({ data: normalized, loading: false });
    } catch (error) {
      set({ loading: false, notice: { type: "error", message: error instanceof Error ? error.message : "데이터를 불러오지 못했습니다." } });
    }
  },

  clearNotice() {
    set({ notice: null });
  },

  async createGroup(bedIds, startDate) {
    const data = requireData(get().data);
    const selectedBeds = data.beds.filter((bed) => bedIds.includes(bed.id));
    const validation = validateGroupBedSelection(selectedBeds) ?? (selectedBeds.some((bed) => getActiveGroupForBed(data, bed.id)) ? "다른 활성 관리그룹에서 사용 중인 틀은 선택할 수 없습니다." : null);
    if (validation) throw new Error(validation);
    const firstBed = selectedBeds[0];
    const groupNumber = getNextGroupNumber(data.managementGroups, firstBed.zoneId);
    const timestamp = nowIso();
    const group: ManagementGroup = {
      id: makeId("group"),
      zoneId: firstBed.zoneId,
      zoneNumber: firstBed.zoneNumber,
      groupNumber,
      displayCode: `Z${firstBed.zoneNumber}-G${groupNumber}`,
      status: "ACTIVE",
      startDate,
      endDate: null,
      lastRestoredAt: null,
      createdAt: timestamp,
      updatedAt: timestamp
    };
    const sheet: ManagementSheet = {
      id: makeId("sheet"),
      managementGroupId: group.id,
      status: "ACTIVE",
      startDate,
      endDate: null,
      lastRestoredAt: null,
      createdAt: timestamp,
      updatedAt: timestamp
    };
    data.managementGroups.push(group);
    data.managementSheets.push(sheet);
    for (const bed of selectedBeds) {
      data.memberships.push({
        id: makeId("membership"),
        managementGroupId: group.id,
        bedId: bed.id,
        addedAt: timestamp,
        removedAt: null,
        isCurrent: true,
        addedReason: "관리그룹 생성",
        removedReason: "",
        author: "사용자",
        createdAt: timestamp,
        updatedAt: timestamp
      });
      bed.status = "ACTIVE";
      bed.updatedAt = timestamp;
      data.statusHistories.push(history("BED", bed.id, "FALLOW", "ACTIVE", `${group.displayCode} 관리 시작`));
    }
    await persist(set, data, `${group.displayCode} 관리그룹을 생성했습니다.`);
    return sheet;
  },

  async addBedsToGroup(groupId, bedIds) {
    const data = requireData(get().data);
    const group = data.managementGroups.find((item) => item.id === groupId);
    if (!group) throw new Error("존재하지 않는 관리그룹입니다.");
    const beds = data.beds.filter((bed) => bedIds.includes(bed.id));
    const validation = validateAddBedsToGroup(data, group, beds);
    if (validation) throw new Error(validation);
    const timestamp = nowIso();
    for (const bed of beds) {
      data.memberships.push({
        id: makeId("membership"),
        managementGroupId: group.id,
        bedId: bed.id,
        addedAt: timestamp,
        removedAt: null,
        isCurrent: true,
        addedReason: "관리 중 틀 추가",
        removedReason: "",
        author: "사용자",
        createdAt: timestamp,
        updatedAt: timestamp
      });
      bed.status = "ACTIVE";
      bed.updatedAt = timestamp;
      data.statusHistories.push(history("BED", bed.id, "FALLOW", "ACTIVE", `${group.displayCode}에 추가`));
    }
    group.updatedAt = timestamp;
    await persist(set, data, "선택한 틀을 관리그룹에 추가했습니다.");
  },

  async removeBedsFromGroup(groupId, bedIds) {
    const data = requireData(get().data);
    const validation = validateRemoveBedsFromGroup(data, groupId, bedIds);
    if (validation) throw new Error(validation);
    const timestamp = nowIso();
    const group = data.managementGroups.find((item) => item.id === groupId);
    for (const membership of data.memberships.filter((item) => item.managementGroupId === groupId && bedIds.includes(item.bedId) && item.isCurrent)) {
      membership.isCurrent = false;
      membership.removedAt = timestamp;
      membership.removedReason = "관리 중 틀 삭제";
      membership.updatedAt = timestamp;
      const bed = data.beds.find((item) => item.id === membership.bedId);
      if (bed) {
        bed.status = "FALLOW";
        bed.updatedAt = timestamp;
        data.statusHistories.push(history("BED", bed.id, "ACTIVE", "FALLOW", `${group?.displayCode ?? "관리그룹"}에서 제외`));
      }
    }
    await persist(set, data, "선택한 틀을 관리그룹에서 삭제했습니다.");
  },

  async closeManagement(sheetId) {
    const data = requireData(get().data);
    const sheet = data.managementSheets.find((item) => item.id === sheetId);
    if (!sheet) throw new Error("존재하지 않는 관리표입니다.");
    const group = data.managementGroups.find((item) => item.id === sheet.managementGroupId);
    if (!group) throw new Error("관리그룹을 찾을 수 없습니다.");
    const timestamp = nowIso();
    sheet.status = "CLOSED";
    sheet.endDate = todayIsoDate();
    sheet.updatedAt = timestamp;
    group.status = "CLOSED";
    group.endDate = todayIsoDate();
    group.updatedAt = timestamp;
    for (const membership of getCurrentMemberships(data, group.id)) {
      membership.isCurrent = false;
      membership.removedAt = timestamp;
      membership.removedReason = "관리 종료";
      membership.updatedAt = timestamp;
      const bed = data.beds.find((item) => item.id === membership.bedId);
      if (bed) {
        bed.status = "FALLOW";
        bed.updatedAt = timestamp;
        data.statusHistories.push(history("BED", bed.id, "ACTIVE", "FALLOW", "관리 종료"));
      }
    }
    data.statusHistories.push(history("SHEET", sheet.id, "ACTIVE", "CLOSED", "관리 종료"));
    await persist(set, data, "관리 종료했습니다.");
  },

  async deleteManagement(sheetId) {
    const data = requireData(get().data);
    const sheet = data.managementSheets.find((item) => item.id === sheetId);
    if (!sheet) throw new Error("존재하지 않는 관리표입니다.");
    const group = data.managementGroups.find((item) => item.id === sheet.managementGroupId);
    if (!group) throw new Error("관리그룹을 찾을 수 없습니다.");
    const timestamp = nowIso();
    for (const membership of data.memberships.filter((item) => item.managementGroupId === group.id && item.isCurrent)) {
      const bed = data.beds.find((item) => item.id === membership.bedId);
      if (bed) {
        bed.status = "FALLOW";
        bed.updatedAt = timestamp;
      }
    }
    const sheetPlantIds = new Set(data.sheetPlants.filter((item) => item.managementSheetId === sheet.id).map((item) => item.id));
    data.managementSheets = data.managementSheets.filter((item) => item.id !== sheet.id);
    data.managementGroups = data.managementGroups.filter((item) => item.id !== group.id);
    data.memberships = data.memberships.filter((item) => item.managementGroupId !== group.id);
    data.sheetPlants = data.sheetPlants.filter((item) => item.managementSheetId !== sheet.id);
    data.workLogs = data.workLogs.filter((item) => item.managementSheetId !== sheet.id && (!item.managementSheetPlantId || !sheetPlantIds.has(item.managementSheetPlantId)));
    data.harvestRecords = data.harvestRecords.filter((item) => item.managementSheetId !== sheet.id && !sheetPlantIds.has(item.managementSheetPlantId));
    data.photos = data.photos.filter((item) => item.managementSheetId !== sheet.id && (!item.managementSheetPlantId || !sheetPlantIds.has(item.managementSheetPlantId)));
    data.scheduleReminders = data.scheduleReminders.filter((item) => item.managementSheetId !== sheet.id && (!item.managementSheetPlantId || !sheetPlantIds.has(item.managementSheetPlantId)));
    data.observationMemos = data.observationMemos.filter((item) => item.managementSheetId !== sheet.id && (!item.managementSheetPlantId || !sheetPlantIds.has(item.managementSheetPlantId)));
    data.pestRecords = data.pestRecords.filter((item) => item.managementSheetId !== sheet.id && (!item.managementSheetPlantId || !sheetPlantIds.has(item.managementSheetPlantId)));
    data.materialUsages = data.materialUsages.filter((item) => item.managementSheetId !== sheet.id);
    data.sheetEvaluations = data.sheetEvaluations.filter((item) => item.managementSheetId !== sheet.id);
    data.statusHistories = data.statusHistories.filter((item) => item.targetId !== sheet.id && item.targetId !== group.id);
    await persist(set, data, "삭제했습니다");
  },

  async restoreManagement(sheetId) {
    void sheetId;
    throw new Error("관리종료된 관리표는 복원할 수 없습니다. 필요한 내용만 수정하거나 관리표를 삭제해 주세요.");
  },

  async addPlant(input) {
    const data = requireData(get().data);
    const validation = validateNewPlantName(data.plants, input.name);
    if (validation) throw new Error(validation);
    const timestamp = nowIso();
    data.plants.push({
      id: makeId("plant"),
      name: input.name.trim(),
      normalizedName: normalizePlantName(input.name),
      category: input.category,
      plantingPeriod: input.plantingPeriod,
      harvestPeriod: input.harvestPeriod,
      floweringPeriod: input.floweringPeriod,
      flowerColor: input.flowerColor,
      plantHeight: input.plantHeight,
      compoundFertilizer: input.compoundFertilizer,
      oilCakeFertilizer: input.oilCakeFertilizer,
      specializedFertilizer: input.specializedFertilizer,
      topDressing: input.topDressing,
      watering: input.watering,
      sunlight: input.sunlight,
      notes: input.notes,
      imageDataUrl: input.imageDataUrl,
      imageMimeType: input.imageMimeType,
      imageFileSize: input.imageFileSize,
      author: input.author.trim() || "사용자",
      createdAt: timestamp,
      updatedAt: timestamp
    });
    await persist(set, data, "식물을 등록했습니다.");
  },

  async updatePlant(plantId, input) {
    const data = requireData(get().data);
    const plant = data.plants.find((item) => item.id === plantId);
    if (!plant) throw new Error("존재하지 않는 식물입니다.");
    const normalizedName = normalizePlantName(input.name);
    if (!normalizedName) throw new Error("식물명은 필수입니다.");
    if (data.plants.some((item) => item.id !== plantId && item.normalizedName === normalizedName)) {
      throw new Error("동일한 식물명이 이미 등록되어 있습니다.");
    }
    Object.assign(plant, {
      ...input,
      name: input.name.trim(),
      normalizedName,
      author: input.author.trim() || "사용자",
      updatedAt: nowIso()
    });
    await persist(set, data, "수정했습니다.");
  },

  async deletePlant(plantId) {
    const data = requireData(get().data);
    const plant = data.plants.find((item) => item.id === plantId);
    if (!plant) throw new Error("존재하지 않는 식물입니다.");
    data.plants = data.plants.filter((item) => item.id !== plantId);
    await persist(set, data, "삭제했습니다");
  },

  async addPlantToSheet(sheetId, plantId) {
    const data = requireData(get().data);
    const sheet = data.managementSheets.find((item) => item.id === sheetId);
    if (!sheet || sheet.status !== "ACTIVE") throw new Error("활성 관리표에만 식물을 등록할 수 있습니다.");
    const plant = data.plants.find((item) => item.id === plantId);
    if (!plant) throw new Error("존재하지 않는 식물입니다.");
    const validation = validateAddSheetPlant(data.sheetPlants, sheetId, plantId);
    if (validation) throw new Error(validation);
    const timestamp = nowIso();
    data.sheetPlants.push({
      id: makeId("sheetPlant"),
      managementSheetId: sheetId,
      plantId,
      plantedDate: "",
      plantingMethod: "",
      expectedHarvestPeriod: "",
      finalHarvestDate: "",
      cultivationStatus: "",
      notes: "",
      isActive: true,
      createdAt: timestamp,
      updatedAt: timestamp
    });
    await persist(set, data, "관리표에 식물을 추가했습니다.");
  },

  async updateSheetPlant(sheetPlantId, input) {
    const data = requireData(get().data);
    const item = data.sheetPlants.find((sheetPlant) => sheetPlant.id === sheetPlantId);
    if (!item) throw new Error("관리표 식물을 찾을 수 없습니다.");
    Object.assign(item, input, { updatedAt: nowIso() });
    await persist(set, data, "수정했습니다.");
  },

  async stopSheetPlant(sheetPlantId) {
    const data = requireData(get().data);
    const item = data.sheetPlants.find((sheetPlant) => sheetPlant.id === sheetPlantId);
    if (!item) throw new Error("관리표 식물을 찾을 수 없습니다.");
    item.isActive = false;
    item.cultivationStatus = "STOPPED";
    item.updatedAt = nowIso();
    await persist(set, data, "해제했습니다.");
  },

  async addWorkLog(input) {
    const data = requireData(get().data);
    const timestamp = nowIso();
    data.workLogs.push({ ...input, id: makeId("work"), batchId: null, createdAt: timestamp, updatedAt: timestamp });
    await persist(set, data, "작업이력을 저장했습니다.");
  },

  async deleteWorkLog(workLogId) {
    const data = requireData(get().data);
    const workLog = data.workLogs.find((item) => item.id === workLogId);
    if (!workLog) throw new Error("존재하지 않는 작업이력입니다.");
    data.workLogs = data.workLogs.filter((item) => workLog.batchId ? item.batchId !== workLog.batchId : item.id !== workLogId);
    await persist(set, data, "삭제했습니다");
  },

  async addZoneWorkLog(zoneId, workDate, workType, content) {
    const data = requireData(get().data);
    const activeGroups = data.managementGroups.filter((group) => group.zoneId === zoneId && group.status === "ACTIVE");
    const activeSheets = data.managementSheets.filter((sheet) => activeGroups.some((group) => group.id === sheet.managementGroupId) && sheet.status === "ACTIVE");
    if (activeSheets.length === 0) throw new Error("해당 Zone에 활성 관리표가 없습니다.");
    const timestamp = nowIso();
    const batchId = makeId("batch");
    for (const sheet of activeSheets) {
      data.workLogs.push({
        id: makeId("work"),
        managementSheetId: sheet.id,
        managementSheetPlantId: null,
        workDate,
        workType,
        content,
        author: "사용자",
        batchId,
        createdAt: timestamp,
        updatedAt: timestamp
      });
    }
    await persist(set, data, "Zone 전체 작업이력을 저장했습니다.");
  },

  async addHarvestRecord(input) {
    const data = requireData(get().data);
    if (!input.managementSheetPlantId) throw new Error("수확기록은 반드시 관리표의 식물과 연결되어야 합니다.");
    const timestamp = nowIso();
    data.harvestRecords.push({ ...input, id: makeId("harvest"), createdAt: timestamp, updatedAt: timestamp });
    await persist(set, data, "수확기록을 저장했습니다.");
  },

  async deleteHarvestRecord(harvestRecordId) {
    const data = requireData(get().data);
    const exists = data.harvestRecords.some((item) => item.id === harvestRecordId);
    if (!exists) throw new Error("존재하지 않는 수확기록입니다.");
    data.harvestRecords = data.harvestRecords.filter((item) => item.id !== harvestRecordId);
    await persist(set, data, "삭제했습니다");
  },

  async addPhoto(input) {
    const data = requireData(get().data);
    const sheet = data.managementSheets.find((item) => item.id === input.managementSheetId);
    if (!sheet) throw new Error("존재하지 않는 관리표입니다.");
    if (input.managementSheetPlantId && !data.sheetPlants.some((item) => item.id === input.managementSheetPlantId && item.managementSheetId === input.managementSheetId)) {
      throw new Error("관리표에 연결된 식물을 찾을 수 없습니다.");
    }
    data.photos.push({ ...input, id: makeId("photo"), createdAt: nowIso() });
    await persist(set, data, "사진을 저장했습니다.");
  },

  async deletePhoto(photoId) {
    const data = requireData(get().data);
    const exists = data.photos.some((item) => item.id === photoId);
    if (!exists) throw new Error("존재하지 않는 사진입니다.");
    data.photos = data.photos.filter((item) => item.id !== photoId);
    await persist(set, data, "삭제했습니다");
  },

  async addScheduleReminder(input) {
    const data = requireData(get().data);
    const timestamp = nowIso();
    data.scheduleReminders.push({ ...input, id: makeId("schedule"), isDone: false, completedAt: null, batchId: null, createdAt: timestamp, updatedAt: timestamp });
    await persist(set, data, "다음일정을 저장했습니다.");
  },

  async addZoneScheduleReminder(zoneId, dueDate, category, content) {
    const data = requireData(get().data);
    const activeGroups = data.managementGroups.filter((group) => group.zoneId === zoneId && group.status === "ACTIVE");
    const activeSheets = data.managementSheets.filter((sheet) => activeGroups.some((group) => group.id === sheet.managementGroupId) && sheet.status === "ACTIVE");
    if (activeSheets.length === 0) throw new Error("해당 Zone에 활성 관리표가 없습니다.");
    const timestamp = nowIso();
    const batchId = makeId("scheduleBatch");
    for (const sheet of activeSheets) {
      data.scheduleReminders.push({
        id: makeId("schedule"),
        managementSheetId: sheet.id,
        managementSheetPlantId: null,
        dueDate,
        category,
        content,
        isDone: false,
        completedAt: null,
        batchId,
        createdAt: timestamp,
        updatedAt: timestamp
      });
    }
    await persist(set, data, "Zone 전체 다음일정을 저장했습니다.");
  },

  async completeScheduleReminder(reminderId, scope = "batch") {
    const data = requireData(get().data);
    const reminder = data.scheduleReminders.find((item) => item.id === reminderId);
    if (!reminder) throw new Error("존재하지 않는 일정입니다.");
    if (reminder.isDone) throw new Error("이미 완료 처리된 일정입니다.");
    const timestamp = nowIso();
    const targets = scope === "batch" && reminder.batchId
      ? data.scheduleReminders.filter((item) => item.batchId === reminder.batchId && !item.isDone)
      : [reminder];
    const workBatchId = targets.length > 1 ? makeId("batch") : null;
    for (const target of targets) {
      target.isDone = true;
      target.completedAt = timestamp;
      target.updatedAt = timestamp;
      data.workLogs.push({
        id: makeId("work"),
        managementSheetId: target.managementSheetId,
        managementSheetPlantId: target.managementSheetPlantId,
        workDate: todayIsoDate(),
        workType: target.category,
        content: target.content,
        author: "사용자",
        batchId: workBatchId,
        createdAt: timestamp,
        updatedAt: timestamp
      });
    }
    await persist(set, data, "완료 처리하고 작업이력에 기록했습니다.");
  },

  async toggleScheduleReminder(reminderId) {
    const data = requireData(get().data);
    const reminder = data.scheduleReminders.find((item) => item.id === reminderId);
    if (!reminder) throw new Error("존재하지 않는 일정입니다.");
    const nextDone = !reminder.isDone;
    const timestamp = nowIso();
    const targets = reminder.batchId ? data.scheduleReminders.filter((item) => item.batchId === reminder.batchId) : [reminder];
    for (const target of targets) {
      target.isDone = nextDone;
      target.completedAt = nextDone ? timestamp : null;
      target.updatedAt = timestamp;
    }
    await persist(set, data, nextDone ? "완료 처리했습니다." : "완료를 해제했습니다.");
  },

  async deleteScheduleReminder(reminderId, scope = "single") {
    const data = requireData(get().data);
    const reminder = data.scheduleReminders.find((item) => item.id === reminderId);
    if (!reminder) throw new Error("존재하지 않는 일정입니다.");
    data.scheduleReminders = data.scheduleReminders.filter((item) => {
      if (scope === "batch" && reminder.batchId) {
        return item.batchId !== reminder.batchId || item.isDone;
      }
      return item.id !== reminderId;
    });
    await persist(set, data, "삭제했습니다");
  },

  async addObservationMemo(input) {
    const data = requireData(get().data);
    const timestamp = nowIso();
    data.observationMemos.push({ ...input, id: makeId("observation"), createdAt: timestamp, updatedAt: timestamp });
    await persist(set, data, "관찰메모를 저장했습니다.");
  },

  async deleteObservationMemo(memoId) {
    const data = requireData(get().data);
    const exists = data.observationMemos.some((item) => item.id === memoId);
    if (!exists) throw new Error("존재하지 않는 관찰메모입니다.");
    data.observationMemos = data.observationMemos.filter((item) => item.id !== memoId);
    await persist(set, data, "삭제했습니다");
  },

  async addPestRecord(input) {
    const data = requireData(get().data);
    const timestamp = nowIso();
    data.pestRecords.push({ ...input, id: makeId("pest"), createdAt: timestamp, updatedAt: timestamp });
    await persist(set, data, "병해충기록을 저장했습니다.");
  },

  async deletePestRecord(pestRecordId) {
    const data = requireData(get().data);
    const exists = data.pestRecords.some((item) => item.id === pestRecordId);
    if (!exists) throw new Error("존재하지 않는 병해충기록입니다.");
    data.pestRecords = data.pestRecords.filter((item) => item.id !== pestRecordId);
    await persist(set, data, "삭제했습니다");
  },

  async addMaterialUsage(input) {
    const data = requireData(get().data);
    const timestamp = nowIso();
    data.materialUsages.push({ ...input, id: makeId("material"), createdAt: timestamp, updatedAt: timestamp });
    await persist(set, data, "비용/자재사용을 저장했습니다.");
  },

  async deleteMaterialUsage(materialUsageId) {
    const data = requireData(get().data);
    const exists = data.materialUsages.some((item) => item.id === materialUsageId);
    if (!exists) throw new Error("존재하지 않는 비용/자재사용 기록입니다.");
    data.materialUsages = data.materialUsages.filter((item) => item.id !== materialUsageId);
    await persist(set, data, "삭제했습니다");
  },

  async upsertSheetEvaluation(input) {
    const data = requireData(get().data);
    const timestamp = nowIso();
    const evaluation = data.sheetEvaluations.find((item) => item.managementSheetId === input.managementSheetId);
    if (evaluation) {
      Object.assign(evaluation, input, { updatedAt: timestamp });
    } else {
      data.sheetEvaluations.push({ ...input, id: makeId("evaluation"), createdAt: timestamp, updatedAt: timestamp });
    }
    await persist(set, data, "요약/평가를 저장했습니다.");
  },

  async updateBedLayout(bedId, patch) {
    const data = requireData(get().data);
    const bed = data.beds.find((item) => item.id === bedId);
    if (!bed) throw new Error("존재하지 않는 틀입니다.");
    Object.assign(bed, patch, { updatedAt: nowIso() });
    await persist(set, data, "수정했습니다.");
  },

  async resetData() {
    const currentData = get().data;
    const data = createInitialData();
    data.plants = currentData?.plants ?? [];
    await repository.reset(data);
    set({ data, notice: { type: "success", message: "개발용 초기화를 완료했습니다. 식물DB는 보존했습니다." } });
  },

  async deleteAllPlants() {
    const data = requireData(get().data);
    data.plants = [];
    data.sheetPlants = [];
    for (const item of data.workLogs) item.managementSheetPlantId = null;
    for (const item of data.photos) item.managementSheetPlantId = null;
    for (const item of data.scheduleReminders) item.managementSheetPlantId = null;
    for (const item of data.observationMemos) item.managementSheetPlantId = null;
    for (const item of data.pestRecords) item.managementSheetPlantId = null;
    data.harvestRecords = [];
    data.statusHistories = data.statusHistories.filter((item) => item.targetType !== "PLANT");
    await persist(set, data, "식물DB를 전체 삭제했습니다.");
  },

  async exportJson() {
    return repository.exportJson();
  },

  async importJson(json) {
    const data = await repository.importJson(json);
    set({ data: withDefaults(data), notice: { type: "success", message: "백업 데이터를 가져왔습니다." } });
  }
}));
