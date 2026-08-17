import { FormEvent, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useRef } from "react";
import { Calendar, ImagePlus, Sprout } from "lucide-react";
import StatusPill from "../../components/common/StatusPill";
import type { Photo, PlantCategory, ScheduleReminder } from "../../domain/entities/models";
import { cultivationStatusLabel, plantingMethodLabel, sunlightLabel, type CultivationStatus, type PlantingMethod } from "../../domain/enums/status";
import { getBedLabelList, getCurrentBedsForGroup, getPastBedsForGroup, getSheetPlants } from "../../domain/services/selectors";
import { MAX_SHEET_PLANTS } from "../../domain/services/plantRules";
import { todayIsoDate } from "../../utils/id";
import { useGardenStore } from "../../stores/gardenStore";

const WORK_TYPE_OPTIONS = ["정식전 비료/거름", "정식후 추비", "심기(정식)", "잡초제거", "방제", "물주기", "지지대 설치", "줄로묶어주기", "가지치기", "솎아내기", "흙 보충", "직접입력", "기타"];
const PHOTO_MAX_SIDE = 1280;
type WorkRepeatUnit = "NONE" | "DAYS" | "WEEKS";
const plantCategoryLabel: Record<PlantCategory, string> = {
  CROP: "농작물",
  FLOWER: "화초",
  TREE: "나무"
};
const THUMBNAIL_MAX_SIDE = 360;
const PHOTO_QUALITY = 0.72;
const THUMBNAIL_QUALITY = 0.6;
const PHOTO_ACCEPT = "image/*,.jpg,.jpeg,.png,.webp,.heic,.heif";
type RecordPhotoKind = "work" | "observation" | "pest" | "harvest";
type RecordPhotoType = NonNullable<Photo["recordType"]>;

function canvasToBlob(canvas: HTMLCanvasElement, mimeType: string, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("사진 압축에 실패했습니다."));
    }, mimeType, quality);
  });
}

async function resizeImage(file: File, maxSide: number, quality: number): Promise<Blob> {
  const imageUrl = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("사진 파일을 읽지 못했습니다."));
      img.src = imageUrl;
    });
    const scale = Math.min(1, maxSide / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("사진 처리 기능을 사용할 수 없습니다.");
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvasToBlob(canvas, "image/jpeg", quality);
  } finally {
    URL.revokeObjectURL(imageUrl);
  }
}

async function compressPhoto(file: File): Promise<{ imageBlob: Blob; thumbnailBlob: Blob; mimeType: string; fileSize: number }> {
  const imageBlob = await resizeImage(file, PHOTO_MAX_SIDE, PHOTO_QUALITY);
  const thumbnailBlob = await resizeImage(file, THUMBNAIL_MAX_SIDE, THUMBNAIL_QUALITY);
  return {
    imageBlob,
    thumbnailBlob,
    mimeType: "image/jpeg",
    fileSize: imageBlob.size + thumbnailBlob.size
  };
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)}KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
}

function parseIsoDate(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function toIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addDaysIso(value: string, days: number): string {
  const date = parseIsoDate(value);
  date.setDate(date.getDate() + days);
  return toIsoDate(date);
}

function buildWorkDates(startDate: string, repeatUnit: WorkRepeatUnit, repeatEveryText: string, repeatEndDate: string): string[] {
  if (repeatUnit === "NONE") return [startDate];
  const repeatEvery = Number(repeatEveryText);
  if (!Number.isInteger(repeatEvery) || repeatEvery <= 0) throw new Error("반복 간격은 1 이상의 숫자로 입력해 주세요.");
  if (!repeatEndDate) throw new Error("반복 종료날짜를 지정해 주세요.");
  if (repeatEndDate < startDate) throw new Error("반복 종료날짜는 작업 날짜 이후로 지정해 주세요.");

  const stepDays = repeatUnit === "DAYS" ? repeatEvery : repeatEvery * 7;
  const dates = [startDate];
  let cursor = startDate;
  while (true) {
    cursor = addDaysIso(cursor, stepDays);
    if (cursor > repeatEndDate) break;
    dates.push(cursor);
    if (dates.length >= 60) throw new Error("반복 작업은 한 번에 최대 60개까지 저장할 수 있습니다.");
  }
  return dates;
}

function PhotoCard({ photo, plantName, onDelete, onPreview }: { photo: Photo; plantName: string; onDelete: () => void; onPreview: (photo: Photo, url: string) => void }) {
  const [imageUrl, setImageUrl] = useState("");
  const [thumbnailUrl, setThumbnailUrl] = useState("");

  useEffect(() => {
    const nextImageUrl = URL.createObjectURL(photo.imageBlob);
    const nextThumbnailUrl = URL.createObjectURL(photo.thumbnailBlob);
    setImageUrl(nextImageUrl);
    setThumbnailUrl(nextThumbnailUrl);
    return () => {
      URL.revokeObjectURL(nextImageUrl);
      URL.revokeObjectURL(nextThumbnailUrl);
    };
  }, [photo.imageBlob, photo.thumbnailBlob]);

  return (
    <article className="photo-card">
      <button className="photo-thumb-button" type="button" onClick={() => onPreview(photo, imageUrl)} aria-label="사진 크게 보기">
        {thumbnailUrl && <img src={thumbnailUrl} alt={photo.description || `${photo.photoDate} 사진`} />}
      </button>
      <div>
        <div className="card-title-row">
          <strong>{photo.photoDate}</strong>
          <button className="danger-button compact-action" type="button" onClick={onDelete}>삭제</button>
        </div>
        <p>{plantName}</p>
        {photo.description && <p className="photo-description">{photo.description}</p>}
        <small>{formatFileSize(photo.fileSize)}</small>
      </div>
    </article>
  );
}

function RecordPhotoThumb({ photo, onPreview }: { photo: Photo; onPreview: (photo: Photo, url: string) => void }) {
  const [imageUrl, setImageUrl] = useState("");
  const [thumbnailUrl, setThumbnailUrl] = useState("");

  useEffect(() => {
    const nextImageUrl = URL.createObjectURL(photo.imageBlob);
    const nextThumbnailUrl = URL.createObjectURL(photo.thumbnailBlob);
    setImageUrl(nextImageUrl);
    setThumbnailUrl(nextThumbnailUrl);
    return () => {
      URL.revokeObjectURL(nextImageUrl);
      URL.revokeObjectURL(nextThumbnailUrl);
    };
  }, [photo.imageBlob, photo.thumbnailBlob]);

  return (
    <button className="record-photo-thumb-button" type="button" onClick={() => onPreview(photo, imageUrl)} aria-label="사진 크게 보기">
      {thumbnailUrl && <img src={thumbnailUrl} alt={photo.description || `${photo.photoDate} 사진`} />}
    </button>
  );
}

function RecordPhotoList({ photos, onPreview }: { photos: Photo[]; onPreview: (photo: Photo, url: string) => void }) {
  if (photos.length === 0) return null;
  return (
    <div className="record-photo-list">
      {photos.map((photo) => <RecordPhotoThumb key={photo.id} photo={photo} onPreview={onPreview} />)}
    </div>
  );
}

export default function ManagementSheetPage() {
  const { sheetId } = useParams();
  const data = useGardenStore((state) => state.data);
  const addBedsToGroup = useGardenStore((state) => state.addBedsToGroup);
  const removeBedsFromGroup = useGardenStore((state) => state.removeBedsFromGroup);
  const addPlantToSheet = useGardenStore((state) => state.addPlantToSheet);
  const updateSheetPlant = useGardenStore((state) => state.updateSheetPlant);
  const stopSheetPlant = useGardenStore((state) => state.stopSheetPlant);
  const addWorkLog = useGardenStore((state) => state.addWorkLog);
  const deleteWorkLog = useGardenStore((state) => state.deleteWorkLog);
  const addZoneWorkLog = useGardenStore((state) => state.addZoneWorkLog);
  const addHarvestRecord = useGardenStore((state) => state.addHarvestRecord);
  const deleteHarvestRecord = useGardenStore((state) => state.deleteHarvestRecord);
  const addPhoto = useGardenStore((state) => state.addPhoto);
  const deletePhoto = useGardenStore((state) => state.deletePhoto);
  const addScheduleReminder = useGardenStore((state) => state.addScheduleReminder);
  const addZoneScheduleReminder = useGardenStore((state) => state.addZoneScheduleReminder);
  const completeScheduleReminder = useGardenStore((state) => state.completeScheduleReminder);
  const deleteScheduleReminder = useGardenStore((state) => state.deleteScheduleReminder);
  const addObservationMemo = useGardenStore((state) => state.addObservationMemo);
  const deleteObservationMemo = useGardenStore((state) => state.deleteObservationMemo);
  const addPestRecord = useGardenStore((state) => state.addPestRecord);
  const deletePestRecord = useGardenStore((state) => state.deletePestRecord);
  const addMaterialUsage = useGardenStore((state) => state.addMaterialUsage);
  const deleteMaterialUsage = useGardenStore((state) => state.deleteMaterialUsage);
  const upsertSheetEvaluation = useGardenStore((state) => state.upsertSheetEvaluation);
  const closeManagement = useGardenStore((state) => state.closeManagement);
  const deleteManagement = useGardenStore((state) => state.deleteManagement);
  const navigate = useNavigate();
  const [selectedAddBeds, setSelectedAddBeds] = useState<string[]>([]);
  const [selectedRemoveBeds, setSelectedRemoveBeds] = useState<string[]>([]);
  const [plantId, setPlantId] = useState("");
  const [workDate, setWorkDate] = useState(todayIsoDate());
  const [workPlantId, setWorkPlantId] = useState("");
  const [workType, setWorkType] = useState("물주기");
  const [customWorkType, setCustomWorkType] = useState("");
  const [workContent, setWorkContent] = useState("");
  const [workRepeatUnit, setWorkRepeatUnit] = useState<WorkRepeatUnit>("NONE");
  const [workRepeatEvery, setWorkRepeatEvery] = useState("0");
  const [workRepeatEndDate, setWorkRepeatEndDate] = useState("");
  const [scheduleDate, setScheduleDate] = useState(todayIsoDate());
  const [schedulePlantId, setSchedulePlantId] = useState("");
  const [scheduleCategory, setScheduleCategory] = useState("물주기");
  const [scheduleContent, setScheduleContent] = useState("");
  const [observationDate, setObservationDate] = useState(todayIsoDate());
  const [observationPlantId, setObservationPlantId] = useState("");
  const [observationContent, setObservationContent] = useState("");
  const [pestDate, setPestDate] = useState(todayIsoDate());
  const [pestPlantId, setPestPlantId] = useState("");
  const [pestType, setPestType] = useState("");
  const [pestSeverity, setPestSeverity] = useState("보통");
  const [pestSymptom, setPestSymptom] = useState("");
  const [pestAction, setPestAction] = useState("");
  const [harvestDate, setHarvestDate] = useState(todayIsoDate());
  const [harvestPlantId, setHarvestPlantId] = useState("");
  const [harvestQty, setHarvestQty] = useState("1");
  const [harvestUnit, setHarvestUnit] = useState("개");
  const [harvestQuality, setHarvestQuality] = useState("보통");
  const [harvestNotes, setHarvestNotes] = useState("");
  const [photoDate, setPhotoDate] = useState(todayIsoDate());
  const [photoPlantId, setPhotoPlantId] = useState("");
  const [photoDescription, setPhotoDescription] = useState("");
  const [photoSaving, setPhotoSaving] = useState(false);
  const [photoSaved, setPhotoSaved] = useState(false);
  const [photoInputKey, setPhotoInputKey] = useState(0);
  const photoFileInputRef = useRef<HTMLInputElement | null>(null);
  const workPhotoFileInputRef = useRef<HTMLInputElement | null>(null);
  const observationPhotoFileInputRef = useRef<HTMLInputElement | null>(null);
  const pestPhotoFileInputRef = useRef<HTMLInputElement | null>(null);
  const harvestPhotoFileInputRef = useRef<HTMLInputElement | null>(null);
  const [recordPhotoFiles, setRecordPhotoFiles] = useState<Record<RecordPhotoKind, File | null>>({ work: null, observation: null, pest: null, harvest: null });
  const [recordPhotoSaving, setRecordPhotoSaving] = useState<RecordPhotoKind | "">("");
  const [recordPhotoInputKeys, setRecordPhotoInputKeys] = useState({ work: 0, observation: 0, pest: 0, harvest: 0 });
  const [previewPhoto, setPreviewPhoto] = useState<{ photo: Photo; url: string } | null>(null);
  const [materialDate, setMaterialDate] = useState(todayIsoDate());
  const [materialName, setMaterialName] = useState("");
  const [materialQty, setMaterialQty] = useState("1");
  const [materialUnit, setMaterialUnit] = useState("개");
  const [materialCost, setMaterialCost] = useState("0");
  const [materialMemo, setMaterialMemo] = useState("");
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [frameModal, setFrameModal] = useState<"add" | "remove" | null>(null);
  const [closeModalOpen, setCloseModalOpen] = useState(false);
  const [closeEndDate, setCloseEndDate] = useState(todayIsoDate());
  const [showAllScheduleReminders, setShowAllScheduleReminders] = useState(false);
  const [showAllWorkLogs, setShowAllWorkLogs] = useState(false);
  const [showAllHarvestRecords, setShowAllHarvestRecords] = useState(false);
  const [pendingSchedule, setPendingSchedule] = useState<{ dueDate: string; category: string; content: string; managementSheetPlantId: string | null } | null>(null);
  const [pendingWorkLog, setPendingWorkLog] = useState<{ workDates: string[]; workType: string; content: string; managementSheetPlantId: string | null; isRepeating: boolean } | null>(null);
  const [completeScheduleTarget, setCompleteScheduleTarget] = useState<ScheduleReminder | null>(null);
  const [deleteScheduleTarget, setDeleteScheduleTarget] = useState<ScheduleReminder | null>(null);
  const [dirtyCultivationIds, setDirtyCultivationIds] = useState<string[]>([]);
  const [cultivationRequiredMessageId, setCultivationRequiredMessageId] = useState("");
  const [cultivationBlockMessage, setCultivationBlockMessage] = useState("");
  const sheetScrollAreaRef = useRef<HTMLDivElement | null>(null);
  const cultivationSaveRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const pendingCultivationIdForScroll = (() => {
    if (!data || !sheetId) return "";
    const sheetForScroll = data.managementSheets.find((item) => item.id === sheetId);
    if (!sheetForScroll || sheetForScroll.status !== "ACTIVE") return "";
    return getSheetPlants(data, sheetForScroll.id)
      .find((item) => needsCultivationSave(item) || dirtyCultivationIds.includes(item.id))?.id ?? "";
  })();

  useEffect(() => {
    if (!photoSaved) return;
    const timer = window.setTimeout(() => setPhotoSaved(false), 2500);
    return () => window.clearTimeout(timer);
  }, [photoSaved]);

  useEffect(() => {
    if (!pendingCultivationIdForScroll) return;
    const scrollArea = sheetScrollAreaRef.current;
    const target = cultivationSaveRefs.current[pendingCultivationIdForScroll];
    if (!scrollArea || !target) return;
    const targetElement = target;

    function keepSaveButtonReachable() {
      const currentScrollArea = sheetScrollAreaRef.current;
      if (!currentScrollArea) return;
      const areaRect = currentScrollArea.getBoundingClientRect();
      const targetRect = targetElement.getBoundingClientRect();
      const topLimit = areaRect.top + areaRect.height * 0.5;
      if (targetRect.top >= topLimit) return;
      currentScrollArea.scrollTop += targetRect.top - topLimit;
    }

    keepSaveButtonReachable();
    scrollArea.addEventListener("scroll", keepSaveButtonReachable, { passive: true });
    window.addEventListener("resize", keepSaveButtonReachable);
    return () => {
      scrollArea.removeEventListener("scroll", keepSaveButtonReachable);
      window.removeEventListener("resize", keepSaveButtonReachable);
    };
  }, [pendingCultivationIdForScroll]);

  if (!data) return null;
  const sheet = data.managementSheets.find((item) => item.id === sheetId);
  if (!sheet) return <div className="page"><p>존재하지 않는 관리표입니다.</p></div>;
  const activeSheet = sheet;
  const group = data.managementGroups.find((item) => item.id === sheet.managementGroupId)!;
  const isClosedSheet = sheet.status !== "ACTIVE";
  const currentBeds = getCurrentBedsForGroup(data, group.id);
  const pastBeds = getPastBedsForGroup(data, group.id);
  const sheetPlants = getSheetPlants(data, sheet.id);
  const currentPlantNames = sheetPlants
    .map((item) => item.plant?.name)
    .filter((name): name is string => Boolean(name))
    .sort((a, b) => a.localeCompare(b, "ko-KR"));
  const addableBeds = data.beds.filter((bed) => bed.zoneId === group.zoneId && bed.status === "FALLOW" && bed.isActive);
  const activePlants = data.plants.filter((plant) => !sheetPlants.some((item) => item.plantId === plant.id)).sort((a, b) => a.name.localeCompare(b.name, "ko-KR"));
  const plantAddDisabled = sheetPlants.length >= MAX_SHEET_PLANTS || sheet.status !== "ACTIVE";
  const workLogs = data.workLogs.filter((log) => log.managementSheetId === sheet.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const harvestRecords = data.harvestRecords.filter((record) => record.managementSheetId === sheet.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const visibleHarvestRecords = showAllHarvestRecords ? harvestRecords : harvestRecords.slice(0, 5);
  const photos = data.photos.filter((photo) => photo.managementSheetId === sheet.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const defaultLinkedPlantId = sheetPlants.length === 1 ? sheetPlants[0].id : "";
  const scheduleReminders = (data.scheduleReminders ?? []).filter((item) => item.managementSheetId === sheet.id).sort((a, b) => Number(a.isDone) - Number(b.isDone) || a.dueDate.localeCompare(b.dueDate) || b.createdAt.localeCompare(a.createdAt));
  const pendingScheduleReminders = scheduleReminders.filter((item) => !item.isDone);
  const visibleScheduleReminders = showAllScheduleReminders ? pendingScheduleReminders : pendingScheduleReminders.slice(0, 5);
  const visibleWorkLogs = showAllWorkLogs ? workLogs : workLogs.slice(0, 5);
  const observationMemos = (data.observationMemos ?? []).filter((item) => item.managementSheetId === sheet.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 5);
  const pestRecords = (data.pestRecords ?? []).filter((item) => item.managementSheetId === sheet.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 5);
  const photosForRecord = (recordType: RecordPhotoType, recordId: string) => photos.filter((photo) => photo.recordType === recordType && photo.recordId === recordId);
  const materialUsages = (data.materialUsages ?? []).filter((item) => item.managementSheetId === sheet.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 5);
  const evaluation = (data.sheetEvaluations ?? []).find((item) => item.managementSheetId === sheet.id);
  const membershipEvents = data.memberships.filter((item) => item.managementGroupId === group.id);
  const pendingCultivation = sheet.status === "ACTIVE"
    ? sheetPlants.find((item) => needsCultivationSave(item) || dirtyCultivationIds.includes(item.id)) ?? null
    : null;
  const cultivationBlocksOtherActions = Boolean(pendingCultivation);

  function toggle(list: string[], setList: (ids: string[]) => void, id: string) {
    setList(list.includes(id) ? list.filter((item) => item !== id) : [...list, id]);
  }

  async function run(action: () => Promise<void>) {
    setError("");
    setIsSaving(true);
    try {
      await action();
    } catch (err) {
      setError(err instanceof Error ? err.message : "작업에 실패했습니다.");
    } finally {
      setIsSaving(false);
    }
  }

  async function runConfirmed(message: string, action: () => Promise<void>) {
    if (!window.confirm(message)) return;
    await run(action);
  }

  function dateInputValue(value: string): string {
    return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : "";
  }

  function cultivationSummary(item: { plantingMethod: PlantingMethod | ""; cultivationStatus: CultivationStatus | "" }): string {
    if (!item.plantingMethod && !item.cultivationStatus) return "재배 정보 저장 필요";
    return [
      item.cultivationStatus ? cultivationStatusLabel[item.cultivationStatus] : "",
      item.plantingMethod ? plantingMethodLabel[item.plantingMethod] : ""
    ].filter(Boolean).join(" · ");
  }

  function needsCultivationSave(item: { plantedDate: string; plantingMethod: PlantingMethod | ""; cultivationStatus: CultivationStatus | "" }): boolean {
    return !item.plantedDate || !item.plantingMethod || !item.cultivationStatus;
  }

  function markCultivationDirty(sheetPlantId: string) {
    setDirtyCultivationIds((ids) => ids.includes(sheetPlantId) ? ids : [...ids, sheetPlantId]);
    if (cultivationRequiredMessageId === sheetPlantId) setCultivationRequiredMessageId("");
  }

  function sheetPlantName(sheetPlantId: string | null): string {
    if (!sheetPlantId) return "식물명미지정";
    const sheetPlant = sheetPlants.find((item) => item.id === sheetPlantId);
    return sheetPlant?.plant?.name ?? "삭제된 식물";
  }

  function optionalLinkedPlantId(value: string): string {
    return value || defaultLinkedPlantId;
  }

  function focusCultivationSave(sheetPlantId: string) {
    const target = cultivationSaveRefs.current[sheetPlantId];
    if (!target) return;
    target.scrollIntoView({ behavior: "smooth", block: "nearest" });
    window.setTimeout(() => target.focus({ preventScroll: true }), 120);
  }

  function registerCultivationSaveButton(sheetPlantId: string, element: HTMLButtonElement | null) {
    cultivationSaveRefs.current[sheetPlantId] = element;
  }

  function requireCultivationSaved(): boolean {
    if (!pendingCultivation) return true;
    const plantName = pendingCultivation.plant?.name ?? "새 식물";
    setCultivationBlockMessage(`${plantName} 재배정보를 먼저 저장해 주세요.`);
    focusCultivationSave(pendingCultivation.id);
    return false;
  }

  async function onUpdateSheetPlant(event: FormEvent<HTMLFormElement>, sheetPlantId: string) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const plantedDate = String(formData.get("plantedDate") || "");
    const plantingMethod = String(formData.get("plantingMethod") || "") as PlantingMethod | "";
    if (!plantedDate || !plantingMethod) {
      setCultivationRequiredMessageId(sheetPlantId);
      return;
    }
    if (!window.confirm("재배 정보를 수정하시겠습니까?")) return;
    await run(() => updateSheetPlant(sheetPlantId, {
      plantedDate,
      plantingMethod,
      expectedHarvestPeriod: String(formData.get("expectedHarvestPeriod") || ""),
      finalHarvestDate: String(formData.get("finalHarvestDate") || ""),
      cultivationStatus: String(formData.get("cultivationStatus") || "GROWING") as CultivationStatus,
      notes: String(formData.get("notes") || "")
    }));
    setDirtyCultivationIds((ids) => ids.filter((id) => id !== sheetPlantId));
    setCultivationRequiredMessageId("");
    setCultivationBlockMessage("");
  }

  async function onAddBeds(event: FormEvent) {
    event.preventDefault();
    await run(async () => {
      await addBedsToGroup(group.id, selectedAddBeds);
      setSelectedAddBeds([]);
      setFrameModal(null);
    });
  }

  async function onRemoveBeds(event: FormEvent) {
    event.preventDefault();
    if (!window.confirm("선택한 틀을 관리그룹에서 삭제하시겠습니까?")) return;
    await run(async () => {
      await removeBedsFromGroup(group.id, selectedRemoveBeds);
      setSelectedRemoveBeds([]);
      setFrameModal(null);
    });
  }

  async function onAddPlant(event: FormEvent) {
    event.preventDefault();
    if (!requireCultivationSaved()) return;
    await run(async () => {
      await addPlantToSheet(activeSheet.id, plantId);
      setPlantId("");
    });
  }

  function openCloseManagementModal() {
    setError("");
    setCloseEndDate(todayIsoDate());
    setCloseModalOpen(true);
  }

  async function onCloseManagement(event: FormEvent) {
    event.preventDefault();
    if (!dateInputValue(closeEndDate)) {
      setError("관리 종료일을 선택해 주세요.");
      return;
    }
    if (!window.confirm(`${closeEndDate} 날짜로 관리 종료하시겠습니까?`)) return;
    await run(async () => {
      await closeManagement(activeSheet.id, closeEndDate);
      setCloseModalOpen(false);
    });
  }

  async function onAddSchedule(event: FormEvent) {
    event.preventDefault();
    if (!requireCultivationSaved()) return;
    setPendingSchedule({
      dueDate: scheduleDate,
      category: scheduleCategory,
      content: scheduleContent.trim(),
      managementSheetPlantId: optionalLinkedPlantId(schedulePlantId) || null
    });
  }

  async function savePendingSchedule(scope: "zone" | "current") {
    if (!pendingSchedule) return;
    if (!requireCultivationSaved()) return;
    await run(async () => {
      if (scope === "zone") {
        await addZoneScheduleReminder(group.zoneId, pendingSchedule.dueDate, pendingSchedule.category, pendingSchedule.content);
      } else {
        await addScheduleReminder({
          managementSheetId: activeSheet.id,
          managementSheetPlantId: pendingSchedule.managementSheetPlantId,
          dueDate: pendingSchedule.dueDate,
          category: pendingSchedule.category,
          content: pendingSchedule.content
        });
      }
      setPendingSchedule(null);
      setScheduleDate(todayIsoDate());
      setSchedulePlantId("");
      setScheduleCategory("물주기");
      setScheduleContent("");
    });
  }

  async function onDeleteSchedule(reminderId: string) {
    const reminder = scheduleReminders.find((item) => item.id === reminderId);
    if (!reminder) return;
    if (reminder.batchId) {
      setDeleteScheduleTarget(reminder);
      return;
    }
    await runConfirmed("이 일정을 삭제하시겠습니까?", () => deleteScheduleReminder(reminderId, "single"));
  }

  async function runDeleteSchedule(scope: "single" | "batch") {
    if (!deleteScheduleTarget) return;
    await run(() => deleteScheduleReminder(deleteScheduleTarget.id, scope));
    setDeleteScheduleTarget(null);
  }

  async function onAddObservation(event: FormEvent) {
    event.preventDefault();
    if (!requireCultivationSaved()) return;
    const resolvedContent = observationContent.trim() || (recordPhotoFiles.observation ? "사진 관찰기록" : "");
    if (!resolvedContent) {
      setError("관찰 내용을 입력해 주세요.");
      return;
    }
    await run(async () => {
      const managementSheetPlantId = optionalLinkedPlantId(observationPlantId) || null;
      const memo = await addObservationMemo({
        managementSheetId: activeSheet.id,
        managementSheetPlantId,
        observedDate: observationDate,
        content: resolvedContent
      });
      if (recordPhotoFiles.observation) {
        setRecordPhotoSaving("observation");
        try {
          await savePhotoFile(recordPhotoFiles.observation, {
            managementSheetPlantId,
            photoDate: observationDate,
            description: `관찰기록: ${resolvedContent}`,
            recordType: "OBSERVATION",
            recordId: memo.id
          });
        } catch (err) {
          setError(err instanceof Error ? `관찰기록은 저장됐지만 사진 저장에 실패했습니다: ${err.message}` : "관찰기록은 저장됐지만 사진 저장에 실패했습니다.");
        } finally {
          setRecordPhotoSaving("");
        }
      }
      setObservationDate(todayIsoDate());
      setObservationPlantId("");
      setObservationContent("");
      clearRecordPhoto("observation");
      setRecordPhotoSaving("");
    });
  }

  async function onDeleteObservation(memoId: string) {
    await runConfirmed("이 관찰기록을 삭제하시겠습니까?", () => deleteObservationMemo(memoId));
  }

  async function onAddPestRecord(event: FormEvent) {
    event.preventDefault();
    if (!requireCultivationSaved()) return;
    const resolvedPestType = pestType.trim() || (recordPhotoFiles.pest ? "사진기록" : "");
    const resolvedPestSymptom = pestSymptom.trim() || (recordPhotoFiles.pest ? "사진으로 기록" : "");
    if (!resolvedPestType && !resolvedPestSymptom) {
      setError("병해충명 또는 증상을 입력해 주세요.");
      return;
    }
    await run(async () => {
      const managementSheetPlantId = optionalLinkedPlantId(pestPlantId) || null;
      const record = await addPestRecord({
        managementSheetId: activeSheet.id,
        managementSheetPlantId,
        detectedDate: pestDate,
        pestType: resolvedPestType || "미지정",
        severity: pestSeverity,
        symptom: resolvedPestSymptom,
        action: pestAction
      });
      if (recordPhotoFiles.pest) {
        setRecordPhotoSaving("pest");
        try {
          await savePhotoFile(recordPhotoFiles.pest, {
            managementSheetPlantId,
            photoDate: pestDate,
            description: ["병해충기록", resolvedPestType || "미지정", resolvedPestSymptom, pestAction.trim()].filter(Boolean).join(": "),
            recordType: "PEST",
            recordId: record.id
          });
        } catch (err) {
          setError(err instanceof Error ? `병해충기록은 저장됐지만 사진 저장에 실패했습니다: ${err.message}` : "병해충기록은 저장됐지만 사진 저장에 실패했습니다.");
        } finally {
          setRecordPhotoSaving("");
        }
      }
      setPestDate(todayIsoDate());
      setPestPlantId("");
      setPestType("");
      setPestSeverity("보통");
      setPestSymptom("");
      setPestAction("");
      clearRecordPhoto("pest");
      setRecordPhotoSaving("");
    });
  }

  async function onDeletePestRecord(pestRecordId: string) {
    await runConfirmed("이 병해충기록을 삭제하시겠습니까?", () => deletePestRecord(pestRecordId));
  }

  async function onAddWork(event: FormEvent) {
    event.preventDefault();
    if (!requireCultivationSaved()) return;
    const resolvedWorkType = workType === "직접입력" ? customWorkType.trim() : workType;
    if (!resolvedWorkType) {
      setError("직접입력 작업 종류를 입력해 주세요.");
      return;
    }
    try {
      const workDates = buildWorkDates(workDate, workRepeatUnit, workRepeatEvery, workRepeatEndDate);
      setError("");
      setPendingWorkLog({ workDates, workType: resolvedWorkType, content: workContent, managementSheetPlantId: workPlantId || null, isRepeating: workRepeatUnit !== "NONE" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "반복 작업 설정을 확인해 주세요.");
    }
  }

  async function savePendingWorkLog(scope: "zone" | "current") {
    if (!pendingWorkLog) return;
    if (!requireCultivationSaved()) return;
    await run(async () => {
      const today = todayIsoDate();
      if (recordPhotoFiles.work) setRecordPhotoSaving("work");
      try {
        const attachedPhoto = recordPhotoFiles.work
          ? await prepareAttachedPhoto(recordPhotoFiles.work, {
            photoDate: pendingWorkLog.workDates[0],
            description: ["작업기록", pendingWorkLog.workType, pendingWorkLog.content.trim()].filter(Boolean).join(": ")
          })
          : undefined;
        for (const targetDate of pendingWorkLog.workDates) {
          const isFuturePlan = targetDate > today || pendingWorkLog.isRepeating;
          if (scope === "zone" && isFuturePlan) {
            await addZoneScheduleReminder(group.zoneId, targetDate, pendingWorkLog.workType, pendingWorkLog.content);
          } else if (scope === "zone") {
            await addZoneWorkLog(group.zoneId, targetDate, pendingWorkLog.workType, pendingWorkLog.content, attachedPhoto ? { ...attachedPhoto, photoDate: targetDate } : undefined);
          } else if (isFuturePlan) {
            await addScheduleReminder({
              managementSheetId: activeSheet.id,
              managementSheetPlantId: pendingWorkLog.managementSheetPlantId,
              dueDate: targetDate,
              category: pendingWorkLog.workType,
              content: pendingWorkLog.content
            });
          } else {
            await addWorkLog({ managementSheetId: activeSheet.id, managementSheetPlantId: pendingWorkLog.managementSheetPlantId, workDate: targetDate, workType: pendingWorkLog.workType, content: pendingWorkLog.content, author: "사용자" }, attachedPhoto ? { ...attachedPhoto, photoDate: targetDate } : undefined);
          }
        }
      } finally {
        setRecordPhotoSaving("");
      }
      setPendingWorkLog(null);
      setWorkPlantId("");
      setWorkContent("");
      if (workType === "직접입력") setCustomWorkType("");
      setWorkRepeatUnit("NONE");
      setWorkRepeatEvery("0");
      setWorkRepeatEndDate("");
      clearRecordPhoto("work");
    });
  }

  async function onDeleteWorkLog(workLogId: string) {
    await runConfirmed("이 작업이력을 삭제하시겠습니까?", () => deleteWorkLog(workLogId));
  }

  async function onCompleteSchedule(scheduleId: string) {
    const reminder = scheduleReminders.find((item) => item.id === scheduleId);
    if (!reminder) return;
    if (reminder.batchId) {
      setCompleteScheduleTarget(reminder);
      return;
    }
    await runConfirmed("이 일정을 완료 처리하고 작업이력에 기록하시겠습니까?", () => completeScheduleReminder(scheduleId, "single"));
  }

  async function runCompleteSchedule(scope: "single" | "batch") {
    if (!completeScheduleTarget) return;
    await run(() => completeScheduleReminder(completeScheduleTarget.id, scope));
    setCompleteScheduleTarget(null);
  }

  async function onAddHarvest(event: FormEvent) {
    event.preventDefault();
    if (!requireCultivationSaved()) return;
    const quantity = Number(harvestQty);
    if (!harvestPlantId) {
      setError("수확한 식물을 선택해 주세요.");
      return;
    }
    if (!Number.isFinite(quantity) || quantity <= 0) {
      setError("수확량은 0보다 큰 숫자로 입력해 주세요.");
      return;
    }
    await run(async () => {
      const record = await addHarvestRecord({
        managementSheetId: activeSheet.id,
        managementSheetPlantId: harvestPlantId,
        harvestDate,
        quantity,
        unit: harvestUnit,
        quality: harvestQuality,
        notes: harvestNotes
      });
      if (recordPhotoFiles.harvest) {
        setRecordPhotoSaving("harvest");
        try {
          await savePhotoFile(recordPhotoFiles.harvest, {
            managementSheetPlantId: harvestPlantId,
            photoDate: harvestDate,
            description: ["수확기록", sheetPlantName(harvestPlantId), `${harvestQty}${harvestUnit}`, harvestQuality, harvestNotes.trim()].filter(Boolean).join(" · "),
            recordType: "HARVEST",
            recordId: record.id
          });
        } catch (err) {
          setError(err instanceof Error ? `수확기록은 저장됐지만 사진 저장에 실패했습니다: ${err.message}` : "수확기록은 저장됐지만 사진 저장에 실패했습니다.");
        } finally {
          setRecordPhotoSaving("");
        }
      }
      setHarvestDate(todayIsoDate());
      setHarvestPlantId("");
      setHarvestQty("1");
      setHarvestUnit("개");
      setHarvestQuality("보통");
      setHarvestNotes("");
      clearRecordPhoto("harvest");
      setRecordPhotoSaving("");
    });
  }

  async function onDeleteHarvestRecord(harvestRecordId: string) {
    await runConfirmed("이 수확기록을 삭제하시겠습니까?", () => deleteHarvestRecord(harvestRecordId));
  }

  async function prepareAttachedPhoto(file: File | undefined, input: { photoDate: string; description: string }) {
    if (!file) {
      throw new Error("업로드할 사진을 선택해 주세요.");
    }
    if (!file.type.startsWith("image/")) {
      throw new Error("사진 파일만 업로드할 수 있습니다.");
    }
    setError("");
    const compressed = await compressPhoto(file);
    return {
      imageBlob: compressed.imageBlob,
      thumbnailBlob: compressed.thumbnailBlob,
      mimeType: compressed.mimeType,
      fileSize: compressed.fileSize,
      description: input.description,
      photoDate: input.photoDate
    };
  }

  async function savePhotoFile(file: File | undefined, input: { managementSheetPlantId: string | null; photoDate: string; description: string; recordType?: RecordPhotoType; recordId?: string }) {
    const prepared = await prepareAttachedPhoto(file, input);
    await addPhoto({
      managementSheetId: activeSheet.id,
      managementSheetPlantId: input.managementSheetPlantId,
      ...prepared,
      recordType: input.recordType ?? null,
      recordId: input.recordId ?? null
    });
  }

  async function onPhotoFileChange(file: File | undefined) {
    if (!requireCultivationSaved()) {
      setPhotoInputKey((prev) => prev + 1);
      return;
    }
    setPhotoSaving(true);
    setPhotoSaved(false);
    try {
      await savePhotoFile(file, {
        managementSheetPlantId: optionalLinkedPlantId(photoPlantId) || null,
        photoDate,
        description: photoDescription
      });
      setPhotoDate(todayIsoDate());
      setPhotoPlantId("");
      setPhotoDescription("");
      setPhotoSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "사진 저장에 실패했습니다.");
    } finally {
      setPhotoInputKey((prev) => prev + 1);
      setPhotoSaving(false);
    }
  }

  function recordPhotoLabel(kind: RecordPhotoKind): string {
    if (recordPhotoSaving === kind) return "압축 저장 중...";
    if (recordPhotoFiles[kind]) return "사진 선택됨";
    return "사진 선택";
  }

  function recordPhotoButtonClass(kind: RecordPhotoKind): string {
    return `secondary-button photo-file-button ${recordPhotoFiles[kind] ? "upload-done" : ""}`;
  }

  function onRecordPhotoFileChange(kind: RecordPhotoKind, file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("사진 파일만 업로드할 수 있습니다.");
      clearRecordPhoto(kind);
      return;
    }
    setError("");
    setRecordPhotoFiles((files) => ({ ...files, [kind]: file }));
  }

  function clearRecordPhoto(kind: RecordPhotoKind) {
    setRecordPhotoFiles((files) => ({ ...files, [kind]: null }));
    setRecordPhotoInputKeys((keys) => ({ ...keys, [kind]: keys[kind] + 1 }));
  }

  async function onDeletePhoto(photoId: string) {
    await runConfirmed("이 사진을 삭제하시겠습니까?", () => deletePhoto(photoId));
  }

  function onDownloadPreviewPhoto() {
    if (!previewPhoto) return;
    const link = document.createElement("a");
    link.href = previewPhoto.url;
    link.download = `${group.displayCode}_${previewPhoto.photo.photoDate}_사진.jpg`;
    document.body.appendChild(link);
    link.click();
    link.remove();
  }

  async function onAddMaterialUsage(event: FormEvent) {
    event.preventDefault();
    if (!requireCultivationSaved()) return;
    const quantity = Number(materialQty);
    const cost = Number(materialCost);
    if (!materialName.trim()) {
      setError("자재명을 입력해 주세요.");
      return;
    }
    if (!Number.isFinite(quantity) || quantity <= 0) {
      setError("사용량은 0보다 큰 숫자로 입력해 주세요.");
      return;
    }
    if (!Number.isFinite(cost) || cost < 0) {
      setError("비용은 0 이상의 숫자로 입력해 주세요.");
      return;
    }
    await run(async () => {
      await addMaterialUsage({
        managementSheetId: activeSheet.id,
        usedDate: materialDate,
        itemName: materialName.trim(),
        quantity,
        unit: materialUnit,
        cost,
        memo: materialMemo
      });
      setMaterialDate(todayIsoDate());
      setMaterialName("");
      setMaterialQty("1");
      setMaterialUnit("개");
      setMaterialCost("0");
      setMaterialMemo("");
    });
  }

  async function onDeleteMaterialUsage(materialUsageId: string) {
    await runConfirmed("이 비용/자재사용 기록을 삭제하시겠습니까?", () => deleteMaterialUsage(materialUsageId));
  }

  async function onSaveEvaluation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!requireCultivationSaved()) return;
    const formData = new FormData(event.currentTarget);
    await run(() => upsertSheetEvaluation({
      managementSheetId: activeSheet.id,
      evaluatedAt: String(formData.get("evaluatedAt") || todayIsoDate()),
      rating: String(formData.get("rating") || "보통"),
      summary: String(formData.get("summary") || ""),
      improvement: String(formData.get("improvement") || "")
    }));
  }

  return (
    <div className="page sheet-page">
      <header className="page-header sheet-fixed-top">
        <div>
          <p className="eyebrow">관리표 상세</p>
          <div className="closed-sheet-title-row">
            <h1 className={isClosedSheet ? "closed-sheet-title" : ""}>{group.displayCode}{isClosedSheet ? ` (${sheet.startDate})` : ""}</h1>
            {isClosedSheet && <strong className="closed-sheet-warning">이미 관리종료 되었습니다. 꼭필요한 내용만 수정하세요</strong>}
          </div>
          <div className="sheet-status-line">
            <StatusPill status={sheet.status} />
            {currentPlantNames.length > 0 && <span className="sheet-status-plants">({currentPlantNames.join(", ")})</span>}
          </div>
        </div>
      </header>
      <div className="sheet-scroll-area" ref={sheetScrollAreaRef}>
        {isSaving && <div className="saving-popup" role="status" aria-live="assertive">저장 중입니다... 잠시 기다려 주세요</div>}
        {cultivationBlockMessage && <div className="cultivation-lock-popup" role="alert">{cultivationBlockMessage}</div>}
        {error && <p className="form-error">{error}</p>}

      <section className="dashboard-grid">
        <article className="panel">
          <h2>관리 기본정보</h2>
          <dl className="info-grid">
            <dt>Zone</dt><dd>Zone {group.zoneNumber}</dd>
            <dt>관리 시작일</dt><dd>{sheet.startDate}</dd>
            <dt>관리 종료일</dt><dd>{sheet.endDate ?? "- -"}</dd>
            <dt>현재 포함 틀</dt><dd>{getBedLabelList(currentBeds)}</dd>
            <dt>과거 포함 틀</dt><dd>{pastBeds.length ? getBedLabelList(pastBeds) : "없음"}</dd>
          </dl>
          {sheet.status === "ACTIVE" ? (
            <div className="button-row">
              <button className="secondary-button" type="button" onClick={() => setFrameModal("add")}>틀추가</button>
              <button className="secondary-button" type="button" onClick={() => setFrameModal("remove")}>틀삭제</button>
              <button className="danger-button" type="button" onClick={openCloseManagementModal}>관리 종료</button>
              <button className="danger-button" type="button" onClick={() => void runConfirmed("이 관리표를 완전삭제하시겠습니까?\n삭제하면 관리표, 관리그룹, 식물 연결, 작업이력, 수확기록이 함께 삭제됩니다.", async () => {
                await deleteManagement(sheet.id);
                navigate("/");
              })}>삭제</button>
            </div>
          ) : (
            <div className="button-row">
              <button className="danger-button" type="button" onClick={() => void runConfirmed("이 관리표를 완전삭제하시겠습니까?\n삭제하면 관리표, 관리그룹, 식물 연결, 작업이력, 수확기록이 함께 삭제됩니다.", async () => {
                await deleteManagement(sheet.id);
                navigate("/");
              })}>삭제</button>
            </div>
          )}
        </article>
      </section>

      <section className="dashboard-grid">
        <article className="panel">
          <h2>식물 목록 (현재 {sheetPlants.length}종 재배중)</h2>
          {pendingCultivation && (
            <p className="cultivation-required-hint">
              {pendingCultivation.plant?.name ?? "새 식물"} 재배정보를 저장해야 다른 기록을 입력할 수 있습니다.
            </p>
          )}
          <div className="card-list compact">
            {sheetPlants.map((item) => {
              const cultivationNeedsSave = needsCultivationSave(item) || dirtyCultivationIds.includes(item.id);
              return (
              <div className={`plant-card ${pendingCultivation?.id === item.id ? "cultivation-card-locked" : ""}`} key={item.id}>
                <div className="card-title-row">
                  <div>
                    <strong>{item.plant ? `${item.plant.name}/${plantCategoryLabel[item.plant.category ?? "CROP"]}` : "삭제된 식물"}</strong>
                    <p className={needsCultivationSave(item) ? "pending-text" : ""}>{cultivationSummary(item)}</p>
                  </div>
                  {sheet.status === "ACTIVE" && <button className="danger-button compact-action" type="button" onClick={() => void runConfirmed("이 식물을 관리표에서 해제하시겠습니까?", () => stopSheetPlant(item.id))}>삭제</button>}
                </div>
                <details className="db-details">
                  <summary className="secondary-button db-toggle">기본정보 보기</summary>
                  {item.plant ? (
                    <dl className="plant-db-info">
                      <dt>식물명</dt><dd>{item.plant.name}</dd>
                      <dt>분류</dt><dd>{plantCategoryLabel[item.plant.category ?? "CROP"]}</dd>
                      <dt>파종 시기</dt><dd>{item.plant.plantingPeriod || "미지정"}</dd>
                      <dt>수확 시기</dt><dd>{item.plant.harvestPeriod || "미지정"}</dd>
                      <dt>일조 조건</dt><dd>{sunlightLabel[item.plant.sunlight]}</dd>
                      <dt>꽃피는 시기</dt><dd>{item.plant.floweringPeriod || "미지정"}</dd>
                      <dt>꽃 색깔</dt><dd>{item.plant.flowerColor || "미지정"}</dd>
                      <dt>키</dt><dd>{item.plant.plantHeight || "미지정"}</dd>
                      <dt>거름/복합비료</dt><dd>{item.plant.compoundFertilizer || "미지정"}</dd>
                      <dt>거름/유박</dt><dd>{item.plant.oilCakeFertilizer || "미지정"}</dd>
                      <dt>거름/특화비료</dt><dd>{item.plant.specializedFertilizer || "미지정"}</dd>
                      <dt>추비</dt><dd>{item.plant.topDressing || "미지정"}</dd>
                      <dt>물주기</dt><dd>{item.plant.watering || "미지정"}</dd>
                      <dt>기타</dt><dd>{item.plant.notes || "미지정"}</dd>
                      <dt>최종 수정자</dt><dd>{item.plant.author || "사용자"}</dd>
                      <dt>최초 등록일</dt><dd>{item.plant.createdAt.slice(0, 10)}</dd>
                      <dt>최종 수정일</dt><dd>{item.plant.updatedAt.slice(0, 10)}</dd>
                    </dl>
                  ) : (
                    <p className="plant-db-info missing">식물 DB에서 삭제된 식물입니다.</p>
                  )}
                </details>
                <form className="cultivation-info" onChange={() => markCultivationDirty(item.id)} onSubmit={(event) => void onUpdateSheetPlant(event, item.id)}>
                  <h3>재배 정보</h3>
                  <label>
                    심은날짜(필수)
                    <input name="plantedDate" type="date" defaultValue={dateInputValue(item.plantedDate) || todayIsoDate()} />
                  </label>
                  <label>
                    심은방식(필수)
                    <select name="plantingMethod" defaultValue={item.plantingMethod}>
                      <option value="">선택 필요</option>
                      <option value="SEED">파종</option>
                      <option value="SEEDLING">묘종</option>
                      <option value="OTHER">기타</option>
                    </select>
                  </label>
                  <label>
                    예상수확 날짜
                    <input name="expectedHarvestPeriod" type="date" defaultValue={dateInputValue(item.expectedHarvestPeriod)} />
                  </label>
                  <label>
                    실제수확날짜
                    <input name="finalHarvestDate" type="date" defaultValue={dateInputValue(item.finalHarvestDate)} />
                  </label>
                  <label>
                    재배상태
                    <select name="cultivationStatus" defaultValue={item.cultivationStatus || "GROWING"}>
                      <option value="">선택 필요</option>
                      <option value="PLANNED">재배 예정</option>
                      <option value="GROWING">재배중</option>
                      <option value="HARVESTED">수확 완료</option>
                      <option value="STOPPED">재배 중단</option>
                    </select>
                  </label>
                  <label className="span-2">
                    식물별 메모
                    <textarea name="notes" defaultValue={item.notes} />
                  </label>
                  {cultivationRequiredMessageId === item.id && <p className="form-error span-2">필수항목 입력하세요</p>}
                  <button
                    ref={(element) => registerCultivationSaveButton(item.id, element)}
                    className={`primary-button span-2 ${cultivationNeedsSave ? "attention-button cultivation-save-focus" : "saved-button"}`}
                    type="submit"
                    disabled={!cultivationNeedsSave}
                  >
                    {cultivationNeedsSave ? "재배 정보 저장" : "재배 정보 저장됨"}
                  </button>
                </form>
              </div>
              );
            })}
          </div>
          <form className="inline-form sheet-plant-add-form" onSubmit={onAddPlant}>
            <select value={plantId} onChange={(event) => setPlantId(event.target.value)} disabled={plantAddDisabled || activePlants.length === 0 || cultivationBlocksOtherActions}>
              <option value="">식물 선택</option>
              {activePlants.map((plant) => <option key={plant.id} value={plant.id}>{plant.name}</option>)}
            </select>
            <button className="primary-button" type="submit" disabled={!plantId || plantAddDisabled || cultivationBlocksOtherActions}><Sprout size={18} /> 추가</button>
          </form>
          <p className="hint sheet-plant-add-hint">식물DB에서 관리그룹당 최대 5개까지 추가할수 있습니다. 원하는 식물이 없으면 하단의 DB메뉴에서 식물을 추가하시고 다시 하십시오</p>
        </article>
      </section>

      <section className="dashboard-grid">
        <form className="panel form-stack" onSubmit={onAddWork}>
          <h2>작업이력 및 일정</h2>
          <div className="work-log-grid">
            <label>
              작업 날짜
              <input type="date" value={workDate} onChange={(event) => setWorkDate(event.target.value)} />
            </label>
            <label>
              대상식물
              <select value={workPlantId} onChange={(event) => setWorkPlantId(event.target.value)}>
                <option value="">지정안함</option>
                {sheetPlants.map((item) => <option key={item.id} value={item.id}>{item.plant?.name ?? "삭제된 식물"}</option>)}
              </select>
            </label>
            <label>
              작업 종류
              <select value={workType} onChange={(event) => setWorkType(event.target.value)}>
                {WORK_TYPE_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
            </label>
            {workType === "직접입력" && (
              <label className="span-2">
                직접입력
                <input value={customWorkType} onChange={(event) => setCustomWorkType(event.target.value)} placeholder="작업 종류를 직접 입력" />
              </label>
            )}
            <div className="repeat-row span-2">
              <label>
                반복주기
                <select value={workRepeatUnit} onChange={(event) => {
                  const nextUnit = event.target.value as WorkRepeatUnit;
                  setWorkRepeatUnit(nextUnit);
                  if (nextUnit === "NONE") setWorkRepeatEndDate("");
                }}>
                  <option value="NONE">없음</option>
                  <option value="DAYS">며칠마다</option>
                  <option value="WEEKS">몇주마다</option>
                </select>
              </label>
              <label>
                반복간격
                <input
                  type="number"
                  min="0"
                  inputMode="numeric"
                  value={workRepeatEvery}
                  onChange={(event) => setWorkRepeatEvery(event.target.value)}
                  disabled={workRepeatUnit === "NONE"}
                  placeholder="예: 2"
                />
              </label>
              <label>
                반복종료날짜
                <input
                  type="date"
                  value={workRepeatEndDate}
                  min={workDate}
                  onChange={(event) => setWorkRepeatEndDate(event.target.value)}
                  disabled={workRepeatUnit === "NONE"}
                />
              </label>
            </div>
            <label className="span-2">
              작업 내용
              <textarea value={workContent} onChange={(event) => setWorkContent(event.target.value)} placeholder="필요시 구체내용을 기록하세요" />
            </label>
          </div>
          <div className="record-action-row">
            <button
              className={recordPhotoButtonClass("work")}
              type="button"
              onClick={() => workPhotoFileInputRef.current?.click()}
              disabled={recordPhotoSaving === "work" || sheet.status !== "ACTIVE" || cultivationBlocksOtherActions}
            >
              <ImagePlus size={18} /> {recordPhotoLabel("work")}
            </button>
            <input
              key={recordPhotoInputKeys.work}
              ref={workPhotoFileInputRef}
              className="visually-hidden-file"
              type="file"
              accept={PHOTO_ACCEPT}
              onChange={(event) => onRecordPhotoFileChange("work", event.target.files?.[0])}
              disabled={recordPhotoSaving === "work" || sheet.status !== "ACTIVE" || cultivationBlocksOtherActions}
            />
          </div>
          <button className="primary-button wide" type="submit" disabled={sheet.status !== "ACTIVE" || cultivationBlocksOtherActions || (workType === "직접입력" && !customWorkType.trim())}>
            <Calendar size={18} /> 작업/일정 저장
          </button>
          <div className="dashboard-grid task-history-grid">
            <article className="overview-column">
              <h3>일정/알림</h3>
              <div className="timeline">
                {visibleScheduleReminders.map((item) => (
                  <div className="timeline-item" key={item.id}>
                    <p>
                      {item.dueDate} · <strong>{group.displayCode}</strong> · {sheetPlantName(item.managementSheetPlantId)} · {item.category}{item.content ? `: ${item.content}` : ""}
                    </p>
                    <div className="button-row compact">
                      <span className="schedule-badge">예정</span>
                      <button className="secondary-button compact-action" type="button" onClick={() => void onCompleteSchedule(item.id)}>완료</button>
                      <button className="danger-button compact-action" type="button" onClick={() => void onDeleteSchedule(item.id)}>삭제</button>
                    </div>
                  </div>
                ))}
              </div>
              {pendingScheduleReminders.length === 0 && <p className="empty-text">등록된 일정/알림이 없습니다.</p>}
              {pendingScheduleReminders.length > 5 && (
                <button className="secondary-button wide" type="button" onClick={() => setShowAllScheduleReminders((value) => !value)}>
                  {showAllScheduleReminders ? "접기" : `더보기 (${pendingScheduleReminders.length - 5}개)`}
                </button>
              )}
            </article>

            <article className="overview-column">
              <h3>작업내용</h3>
              <div className="timeline">
                {visibleWorkLogs.map((item) => (
                  <div className="timeline-item" key={item.id}>
                    <div>
                      <p>
                        {item.workDate} · <strong>{group.displayCode}</strong> · {sheetPlantName(item.managementSheetPlantId)} · {item.workType}{item.content ? `: ${item.content}` : ""}
                      </p>
                      <RecordPhotoList photos={photosForRecord("WORK", item.id)} onPreview={(photo, url) => setPreviewPhoto({ photo, url })} />
                    </div>
                    <button className="danger-button compact-action" type="button" onClick={() => void onDeleteWorkLog(item.id)}>삭제</button>
                  </div>
                ))}
              </div>
              {workLogs.length === 0 && <p className="empty-text">등록된 작업내용이 없습니다.</p>}
              {workLogs.length > 5 && (
                <button className="secondary-button wide" type="button" onClick={() => setShowAllWorkLogs((value) => !value)}>
                  {showAllWorkLogs ? "접기" : `더보기 (${workLogs.length - 5}개)`}
                </button>
              )}
            </article>
          </div>
        </form>

        <form className="panel form-stack" onSubmit={onAddObservation}>
          <h2>관찰기록</h2>
          <div className="record-grid">
            <label>
              관찰일
              <input type="date" value={observationDate} onChange={(event) => setObservationDate(event.target.value)} />
            </label>
            <label>
              연결 식물
              <select value={optionalLinkedPlantId(observationPlantId)} onChange={(event) => setObservationPlantId(event.target.value)}>
                <option value="">지정안함</option>
                {sheetPlants.map((item) => <option key={item.id} value={item.id}>{item.plant?.name ?? "삭제된 식물"}</option>)}
              </select>
            </label>
            <label className="span-2">
              관찰 내용
              <textarea value={observationContent} onChange={(event) => setObservationContent(event.target.value)} placeholder="생육 상태, 색 변화, 특이사항 등을 기록하세요" />
            </label>
          </div>
          <div className="record-action-row">
            <button
              className={recordPhotoButtonClass("observation")}
              type="button"
              onClick={() => observationPhotoFileInputRef.current?.click()}
              disabled={recordPhotoSaving === "observation" || sheet.status !== "ACTIVE" || cultivationBlocksOtherActions}
            >
              <ImagePlus size={18} /> {recordPhotoLabel("observation")}
            </button>
            <input
              key={recordPhotoInputKeys.observation}
              ref={observationPhotoFileInputRef}
              className="visually-hidden-file"
              type="file"
              accept={PHOTO_ACCEPT}
              onChange={(event) => onRecordPhotoFileChange("observation", event.target.files?.[0])}
              disabled={recordPhotoSaving === "observation" || sheet.status !== "ACTIVE" || cultivationBlocksOtherActions}
            />
            <button className="primary-button" type="submit" disabled={recordPhotoSaving === "observation" || sheet.status !== "ACTIVE" || cultivationBlocksOtherActions}>관찰기록 저장</button>
          </div>
          <div className="timeline">
            {observationMemos.map((item) => (
              <div className="timeline-item" key={item.id}>
                <div>
                  <p>{item.observedDate} · {sheetPlantName(item.managementSheetPlantId)}: {item.content}</p>
                  <RecordPhotoList photos={photosForRecord("OBSERVATION", item.id)} onPreview={(photo, url) => setPreviewPhoto({ photo, url })} />
                </div>
                <button className="danger-button compact-action" type="button" onClick={() => void onDeleteObservation(item.id)}>삭제</button>
              </div>
            ))}
          </div>
          {observationMemos.length === 0 && <p className="empty-text">등록된 관찰기록이 없습니다.</p>}
        </form>

        <form className="panel form-stack" onSubmit={onAddPestRecord}>
          <h2>병해충기록</h2>
          <div className="record-grid">
            <label>
              발견일
              <input type="date" value={pestDate} onChange={(event) => setPestDate(event.target.value)} />
            </label>
            <label>
              연결 식물
              <select value={optionalLinkedPlantId(pestPlantId)} onChange={(event) => setPestPlantId(event.target.value)}>
                <option value="">지정안함</option>
                {sheetPlants.map((item) => <option key={item.id} value={item.id}>{item.plant?.name ?? "삭제된 식물"}</option>)}
              </select>
            </label>
            <label>
              병해충명
              <input value={pestType} onChange={(event) => setPestType(event.target.value)} placeholder="예: 진딧물, 배추좀나방" />
            </label>
            <label>
              심각도
              <select value={pestSeverity} onChange={(event) => setPestSeverity(event.target.value)}>
                <option value="낮음">낮음</option>
                <option value="보통">보통</option>
                <option value="높음">높음</option>
              </select>
            </label>
            <label className="span-2">
              증상
              <textarea className="compact-textarea" value={pestSymptom} onChange={(event) => setPestSymptom(event.target.value)} placeholder="잎 구멍, 변색, 벌레 확인 등" />
            </label>
            <label className="span-2">
              조치내용
              <textarea className="compact-textarea" value={pestAction} onChange={(event) => setPestAction(event.target.value)} placeholder="방제, 제거, 관찰 유지 등" />
            </label>
          </div>
          <div className="record-action-row">
            <button
              className={recordPhotoButtonClass("pest")}
              type="button"
              onClick={() => pestPhotoFileInputRef.current?.click()}
              disabled={recordPhotoSaving === "pest" || sheet.status !== "ACTIVE" || cultivationBlocksOtherActions}
            >
              <ImagePlus size={18} /> {recordPhotoLabel("pest")}
            </button>
            <input
              key={recordPhotoInputKeys.pest}
              ref={pestPhotoFileInputRef}
              className="visually-hidden-file"
              type="file"
              accept={PHOTO_ACCEPT}
              onChange={(event) => onRecordPhotoFileChange("pest", event.target.files?.[0])}
              disabled={recordPhotoSaving === "pest" || sheet.status !== "ACTIVE" || cultivationBlocksOtherActions}
            />
            <button className="primary-button" type="submit" disabled={recordPhotoSaving === "pest" || sheet.status !== "ACTIVE" || cultivationBlocksOtherActions}>병해충기록 저장</button>
          </div>
          <div className="timeline">
            {pestRecords.map((item) => (
              <div className="timeline-item" key={item.id}>
                <div>
                  <p>{item.detectedDate} · {sheetPlantName(item.managementSheetPlantId)} · {item.pestType}({item.severity}): {item.symptom}{item.action ? ` / ${item.action}` : ""}</p>
                  <RecordPhotoList photos={photosForRecord("PEST", item.id)} onPreview={(photo, url) => setPreviewPhoto({ photo, url })} />
                </div>
                <button className="danger-button compact-action" type="button" onClick={() => void onDeletePestRecord(item.id)}>삭제</button>
              </div>
            ))}
          </div>
          {pestRecords.length === 0 && <p className="empty-text">등록된 병해충기록이 없습니다.</p>}
        </form>
      </section>

      {sheet.status === "ACTIVE" && frameModal && (
        <div className="modal-backdrop" role="presentation" onClick={() => setFrameModal(null)}>
          <div className="modal-panel" role="dialog" aria-modal="true" aria-labelledby="frame-modal-title" onClick={(event) => event.stopPropagation()}>
            {frameModal === "add" ? (
              <form className="form-stack" onSubmit={onAddBeds}>
                <div className="card-title-row">
                  <h2 id="frame-modal-title">틀추가</h2>
                  <button className="secondary-button" type="button" onClick={() => setFrameModal(null)}>닫기</button>
                </div>
                <div className="selection-grid small">
                  {addableBeds.map((bed) => <button type="button" key={bed.id} className={`choice-tile ${selectedAddBeds.includes(bed.id) ? "selected" : ""}`} onClick={() => toggle(selectedAddBeds, setSelectedAddBeds, bed.id)}>{bed.displayCode}</button>)}
                </div>
                {addableBeds.length === 0 && <p className="empty-text">추가할 수 있는 휴경 틀이 없습니다.</p>}
                <button className="primary-button wide" type="submit">선택 틀 추가</button>
              </form>
            ) : (
              <form className="form-stack" onSubmit={onRemoveBeds}>
                <div className="card-title-row">
                  <h2 id="frame-modal-title">틀삭제</h2>
                  <button className="secondary-button" type="button" onClick={() => setFrameModal(null)}>닫기</button>
                </div>
                <div className="selection-grid small">
                  {currentBeds.map((bed) => <button type="button" key={bed.id} className={`choice-tile ${selectedRemoveBeds.includes(bed.id) ? "selected" : ""}`} onClick={() => toggle(selectedRemoveBeds, setSelectedRemoveBeds, bed.id)}>{bed.displayCode}</button>)}
                </div>
                <button className="danger-button wide" type="submit">선택 틀 삭제</button>
              </form>
            )}
          </div>
        </div>
      )}

      {sheet.status === "ACTIVE" && closeModalOpen && (
        <div className="modal-backdrop" role="presentation">
          <form className="modal-panel decision-modal form-stack" role="dialog" aria-modal="true" aria-labelledby="close-management-title" onSubmit={onCloseManagement}>
            <h2 id="close-management-title">관리 종료일 선택</h2>
            <p className="muted-text">과거에 이미 끝난 관리그룹은 실제 종료된 날짜를 선택하세요. 시작일보다 이전 날짜도 입력할 수 있습니다.</p>
            <label>
              관리 종료일
              <input type="date" value={closeEndDate} onChange={(event) => setCloseEndDate(event.target.value)} />
            </label>
            <p className="hint">관리 시작일: {sheet.startDate}</p>
            <div className="button-row">
              <button className="danger-button" type="submit">선택한 날짜로 종료</button>
              <button className="secondary-button" type="button" onClick={() => setCloseModalOpen(false)}>취소</button>
            </div>
          </form>
        </div>
      )}

      {pendingSchedule && (
        <div className="modal-backdrop" role="presentation">
          <div className="modal-panel decision-modal" role="dialog" aria-modal="true" aria-labelledby="schedule-scope-title">
            <h2 id="schedule-scope-title">Zone {group.zoneNumber} 내 모든 활성화 관리표에 같은 일정을 올릴까요?</h2>
            <p>{pendingSchedule.dueDate} · {pendingSchedule.category}</p>
            {pendingSchedule.content && <p className="muted-text">{pendingSchedule.content}</p>}
            <div className="button-row">
              <button className="primary-button" type="button" onClick={() => void savePendingSchedule("zone")}>예</button>
              <button className="secondary-button" type="button" onClick={() => void savePendingSchedule("current")}>아니오(현재 관리표에만 저장)</button>
              <button className="danger-button" type="button" onClick={() => setPendingSchedule(null)}>취소(저장하지 않음)</button>
            </div>
          </div>
        </div>
      )}

      {pendingWorkLog && (
        <div className="modal-backdrop" role="presentation">
          <div className="modal-panel decision-modal" role="dialog" aria-modal="true" aria-labelledby="work-scope-title">
            <h2 id="work-scope-title">Zone {group.zoneNumber} 내 모든 관리표에 같은 내용을 올릴까요?</h2>
            <p>
              {pendingWorkLog.workDates[0]}
              {pendingWorkLog.workDates.length > 1 ? ` ~ ${pendingWorkLog.workDates[pendingWorkLog.workDates.length - 1]}` : ""}
              {" · "}
              {pendingWorkLog.workType}
              {" · "}
              {pendingWorkLog.workDates.length}회 저장
            </p>
            {pendingWorkLog.content && <p className="muted-text">{pendingWorkLog.content}</p>}
            <div className="button-row">
              <button className="primary-button" type="button" onClick={() => void savePendingWorkLog("zone")}>예</button>
              <button className="secondary-button" type="button" onClick={() => void savePendingWorkLog("current")}>아니오(현재 관리표에만 저장)</button>
              <button className="danger-button" type="button" onClick={() => setPendingWorkLog(null)}>취소(저장하지 않음)</button>
            </div>
          </div>
        </div>
      )}

      {deleteScheduleTarget && (
        <div className="modal-backdrop" role="presentation">
          <div className="modal-panel decision-modal" role="dialog" aria-modal="true" aria-labelledby="delete-schedule-title">
            <h2 id="delete-schedule-title">반복일정 삭제 방법을 선택하세요</h2>
            <p>{deleteScheduleTarget.dueDate} · {deleteScheduleTarget.category}</p>
            <p className="muted-text">반복일정 전체삭제를 선택해도 이미 완료된 일정은 삭제하지 않습니다.</p>
            <div className="button-row">
              <button className="danger-button" type="button" onClick={() => void runDeleteSchedule("single")}>이 일정만 삭제</button>
              <button className="danger-button" type="button" onClick={() => void runDeleteSchedule("batch")}>반복일정 전체삭제</button>
              <button className="secondary-button" type="button" onClick={() => setDeleteScheduleTarget(null)}>취소</button>
            </div>
          </div>
        </div>
      )}

      {completeScheduleTarget && (
        <div className="modal-backdrop" role="presentation">
          <div className="modal-panel decision-modal" role="dialog" aria-modal="true" aria-labelledby="complete-schedule-title">
            <h2 id="complete-schedule-title">Z{group.zoneNumber} 전체 그룹에 적용된 묶음 작업입니다</h2>
            <p>{completeScheduleTarget.dueDate} · {completeScheduleTarget.category}</p>
            <p className="muted-text">전체완료 또는 현재 관리그룹만 완료 중 선택하세요.</p>
            <div className="button-row">
              <button className="primary-button" type="button" onClick={() => void runCompleteSchedule("batch")}>전체완료</button>
              <button className="secondary-button" type="button" onClick={() => void runCompleteSchedule("single")}>현재 관리그룹만 완료</button>
              <button className="danger-button" type="button" onClick={() => setCompleteScheduleTarget(null)}>취소</button>
            </div>
          </div>
        </div>
      )}

      <section className="dashboard-grid">
        <form className="panel form-stack" onSubmit={onAddHarvest}>
          <h2>수확기록</h2>
          <div className="harvest-grid">
            <label>
              수확 날짜
              <input type="date" value={harvestDate} onChange={(event) => setHarvestDate(event.target.value)} />
            </label>
            <label>
              수확 식물
              <select value={harvestPlantId} onChange={(event) => setHarvestPlantId(event.target.value)}>
                <option value="">식물 선택</option>
                {sheetPlants.map((item) => <option key={item.id} value={item.id}>{item.plant?.name ?? "삭제된 식물"}</option>)}
              </select>
            </label>
            <label>
              수확량
              <input value={harvestQty} inputMode="decimal" onChange={(event) => setHarvestQty(event.target.value)} />
            </label>
            <label>
              단위
              <select value={harvestUnit} onChange={(event) => setHarvestUnit(event.target.value)}>
                <option value="개">개</option>
                <option value="g">g</option>
                <option value="Kg">Kg</option>
                <option value="묶음(100개)">묶음(100개)</option>
                <option value="박스">박스</option>
              </select>
            </label>
            <label>
              품질
              <select value={harvestQuality} onChange={(event) => setHarvestQuality(event.target.value)}>
                <option value="좋음">좋음</option>
                <option value="보통">보통</option>
                <option value="나쁨">나쁨</option>
                <option value="혼합">혼합</option>
              </select>
            </label>
            <label className="span-2">
              수확 메모
              <textarea className="compact-textarea" value={harvestNotes} onChange={(event) => setHarvestNotes(event.target.value)} placeholder="필요시 수확 상태나 사용처를 기록하세요" />
            </label>
          </div>
          <div className="record-action-row">
            <button
              className={recordPhotoButtonClass("harvest")}
              type="button"
              onClick={() => harvestPhotoFileInputRef.current?.click()}
              disabled={!harvestPlantId || recordPhotoSaving === "harvest" || sheet.status !== "ACTIVE" || cultivationBlocksOtherActions}
            >
              <ImagePlus size={18} /> {recordPhotoLabel("harvest")}
            </button>
            <input
              key={recordPhotoInputKeys.harvest}
              ref={harvestPhotoFileInputRef}
              className="visually-hidden-file"
              type="file"
              accept={PHOTO_ACCEPT}
              onChange={(event) => onRecordPhotoFileChange("harvest", event.target.files?.[0])}
              disabled={!harvestPlantId || recordPhotoSaving === "harvest" || sheet.status !== "ACTIVE" || cultivationBlocksOtherActions}
            />
            <button className="primary-button" type="submit" disabled={!harvestPlantId || recordPhotoSaving === "harvest" || sheet.status !== "ACTIVE" || cultivationBlocksOtherActions}>수확 저장</button>
          </div>
          <div className="timeline">
            {visibleHarvestRecords.map((record) => {
              const sheetPlant = sheetPlants.find((item) => item.id === record.managementSheetPlantId);
              return (
                <div className="timeline-item" key={record.id}>
                  <div>
                    <p>
                      {record.harvestDate} · {sheetPlant?.plant?.name ?? "삭제된 식물"} · {record.quantity}{record.unit} · {record.quality}
                      {record.notes ? `: ${record.notes}` : ""}
                    </p>
                    <RecordPhotoList photos={photosForRecord("HARVEST", record.id)} onPreview={(photo, url) => setPreviewPhoto({ photo, url })} />
                  </div>
                  <button className="danger-button compact-action" type="button" onClick={() => void onDeleteHarvestRecord(record.id)}>삭제</button>
                </div>
              );
            })}
          </div>
          {harvestRecords.length > 5 && (
            <button className="secondary-button wide" type="button" onClick={() => setShowAllHarvestRecords((value) => !value)}>
              {showAllHarvestRecords ? "접기" : `더보기 (${harvestRecords.length - 5}개)`}
            </button>
          )}
        </form>
      </section>

      <section className="panel photo-panel">
        <h2>사진기록</h2>
        <div className="photo-form">
          <label>
            사진 날짜
            <input type="date" value={photoDate} onChange={(event) => setPhotoDate(event.target.value)} />
          </label>
          <label>
            연결 식물
            <select value={optionalLinkedPlantId(photoPlantId)} onChange={(event) => setPhotoPlantId(event.target.value)}>
              <option value="">지정안함</option>
              {sheetPlants.map((item) => <option key={item.id} value={item.id}>{item.plant?.name ?? "삭제된 식물"}</option>)}
            </select>
          </label>
          <label className="span-2">
            사진 설명
            <textarea className="compact-textarea" value={photoDescription} onChange={(event) => setPhotoDescription(event.target.value)} placeholder="필요시 사진 내용을 기록하세요" />
          </label>
          <button
            className={`secondary-button photo-file-button ${photoSaved ? "upload-done" : ""}`}
            type="button"
            onClick={() => photoFileInputRef.current?.click()}
            disabled={photoSaving || sheet.status !== "ACTIVE" || cultivationBlocksOtherActions}
          >
            <ImagePlus size={18} /> {photoSaving ? "압축 저장 중..." : photoSaved ? "저장했습니다" : "파일/갤러리/구글포토 선택"}
          </button>
          <input
            key={photoInputKey}
            ref={photoFileInputRef}
            className="visually-hidden-file"
            name="photoFile"
            type="file"
            accept={PHOTO_ACCEPT}
            onChange={(event) => void onPhotoFileChange(event.target.files?.[0])}
            disabled={photoSaving || sheet.status !== "ACTIVE" || cultivationBlocksOtherActions}
          />
        </div>
        <p className="hint">PC에서는 파일을, 휴대폰에서는 갤러리 또는 구글포토를 선택하세요. 휴대폰 파일 선택 화면에 갤러리가 바로 안 보이면 오른쪽 위 ... 메뉴에서 찾아보기를 누르세요. 업로드한 사진은 저장 전에 긴 변 {PHOTO_MAX_SIDE}px 이하로 줄이고 JPEG로 압축합니다.</p>
        <div className="photo-grid">
          {photos.map((photo) => {
            const sheetPlant = sheetPlants.find((item) => item.id === photo.managementSheetPlantId);
            return (
              <PhotoCard
                key={photo.id}
                photo={photo}
                plantName={sheetPlant?.plant?.name ?? "식물명미지정"}
                onPreview={(photo, url) => setPreviewPhoto({ photo, url })}
                onDelete={() => void onDeletePhoto(photo.id)}
              />
            );
          })}
        </div>
        {photos.length === 0 && <p className="empty-text">등록된 사진이 없습니다.</p>}
      </section>

      {previewPhoto && (
        <div className="modal-backdrop photo-preview-backdrop" role="presentation" onClick={() => setPreviewPhoto(null)}>
          <div className="photo-preview-panel" role="dialog" aria-modal="true" aria-label="사진 크게 보기" onClick={(event) => event.stopPropagation()}>
            <div className="photo-preview-actions">
              <button className="secondary-button compact-action" type="button" onClick={onDownloadPreviewPhoto}>다운로드</button>
              <button className="secondary-button compact-action" type="button" onClick={() => setPreviewPhoto(null)}>닫기</button>
            </div>
            <img src={previewPhoto.url} alt="사진 크게 보기" />
          </div>
        </div>
      )}

      <section className="dashboard-grid">
        <form className="panel form-stack" onSubmit={onAddMaterialUsage}>
          <h2>비용/자재사용</h2>
          <div className="record-grid">
            <label>
              사용일
              <input type="date" value={materialDate} onChange={(event) => setMaterialDate(event.target.value)} />
            </label>
            <label>
              자재명
              <input value={materialName} onChange={(event) => setMaterialName(event.target.value)} placeholder="예: 유박, 끈, 모종" />
            </label>
            <label>
              사용량
              <input value={materialQty} inputMode="decimal" onChange={(event) => setMaterialQty(event.target.value)} />
            </label>
            <label>
              단위
              <select value={materialUnit} onChange={(event) => setMaterialUnit(event.target.value)}>
                <option value="개">개</option>
                <option value="kg">kg</option>
                <option value="g">g</option>
                <option value="포">포</option>
                <option value="봉">봉</option>
                <option value="m">m</option>
                <option value="원">원</option>
              </select>
            </label>
            <label>
              비용
              <input value={materialCost} inputMode="numeric" onChange={(event) => setMaterialCost(event.target.value)} />
            </label>
            <label className="span-2">
              메모
              <textarea className="compact-textarea" value={materialMemo} onChange={(event) => setMaterialMemo(event.target.value)} placeholder="구입처, 사용 이유 등을 기록하세요" />
            </label>
          </div>
          <button className="primary-button wide" type="submit" disabled={sheet.status !== "ACTIVE" || cultivationBlocksOtherActions}>비용/자재 저장</button>
          <div className="timeline">
            {materialUsages.map((item) => (
              <div className="timeline-item" key={item.id}>
                <p>{item.usedDate} · {item.itemName} · {item.quantity}{item.unit} · {item.cost.toLocaleString()}원{item.memo ? `: ${item.memo}` : ""}</p>
                <button className="danger-button compact-action" type="button" onClick={() => void onDeleteMaterialUsage(item.id)}>삭제</button>
              </div>
            ))}
          </div>
          {materialUsages.length === 0 && <p className="empty-text">등록된 비용/자재사용 기록이 없습니다.</p>}
        </form>

        <form className="panel form-stack" onSubmit={onSaveEvaluation}>
          <h2>요약/평가</h2>
          <div className="record-grid">
            <label>
              평가일
              <input name="evaluatedAt" type="date" defaultValue={dateInputValue(evaluation?.evaluatedAt ?? todayIsoDate())} />
            </label>
            <label>
              평가
              <select name="rating" defaultValue={evaluation?.rating ?? "보통"}>
                <option value="좋음">좋음</option>
                <option value="보통">보통</option>
                <option value="아쉬움">아쉬움</option>
                <option value="실패">실패</option>
              </select>
            </label>
            <label className="span-2">
              전체 요약
              <textarea name="summary" defaultValue={evaluation?.summary ?? ""} placeholder="이번 관리표의 전체 결과를 기록하세요" />
            </label>
            <label className="span-2">
              다음 개선점
              <textarea name="improvement" defaultValue={evaluation?.improvement ?? ""} placeholder="다음 재배 때 바꿀 점을 기록하세요" />
            </label>
          </div>
          <button className="primary-button wide" type="submit" disabled={cultivationBlocksOtherActions}>요약/평가 저장</button>
          {evaluation && <p className="hint">마지막 저장: {evaluation.updatedAt.slice(0, 10)}</p>}
        </form>
      </section>

      <section className="panel">
        <h2>구성 변경 이력</h2>
        <div className="timeline">
          {membershipEvents.map((item) => {
            const bed = data.beds.find((candidate) => candidate.id === item.bedId);
            return <p key={item.id}>{bed?.displayCode}: {item.addedAt.slice(0, 10)} 추가 {item.removedAt ? `/ ${item.removedAt.slice(0, 10)} 제외` : "/ 현재 포함"}</p>;
          })}
        </div>
      </section>
      </div>
    </div>
  );
}

