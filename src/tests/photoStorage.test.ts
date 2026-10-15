import { beforeEach, describe, expect, it, vi } from "vitest";
import { harvestTestData } from "./fixtures/harvestData";
import { getPlantImages, photosForTarget } from "../domain/services/photoRules";

const repository = vi.hoisted(() => ({ save: vi.fn(), load: vi.fn() }));
vi.mock("../infrastructure/repositories/gardenRepositoryFactory", () => ({ createGardenRepository: () => repository }));
vi.mock("../infrastructure/database/gardenDb", () => ({ readStoredSnapshot: vi.fn(), writeSnapshot: vi.fn(async () => {}) }));
import { useGardenStore } from "../stores/gardenStore";

function photo(value = "photo") {
  return { imageBlob: new Blob([value]), thumbnailBlob: new Blob([value]), mimeType: "image/jpeg", fileSize: 10, photoDate: "2026-10-16", description: "사진" };
}
const work = { managementSheetId: "sheet_1_10", managementSheetPlantId: null, workDate: "2026-10-16", workType: "물주기", content: "", author: "테스트" };

beforeEach(() => {
  repository.save.mockReset().mockResolvedValue(undefined);
  repository.load.mockReset();
  useGardenStore.setState({ data: harvestTestData(), notice: null });
});

describe("사진 3장 등록과 추가·개별삭제", () => {
  it("4장 등록은 저장 전에 거절하고 사진 없는 기록에도 나중에 추가할 수 있다", async () => {
    const store = useGardenStore.getState();
    await expect(store.addWorkLog(work, [photo(), photo(), photo(), photo()])).rejects.toThrow("최대 3장");
    expect(repository.save).not.toHaveBeenCalled();
    const record = await store.addWorkLog(work);
    await store.addPhoto({ ...photo(), managementSheetId: work.managementSheetId, managementSheetPlantId: null, recordType: "WORK", recordId: record.id });
    expect(photosForTarget(useGardenStore.getState().data!.photos, { recordType: "WORK", recordId: record.id })).toHaveLength(1);
  });
  it("작업·관찰·병충·수확 기록마다 3장을 한 번의 저장으로 등록한다", async () => {
    const store = useGardenStore.getState();
    const files = [photo("1"), photo("2"), photo("3")];
    const records = [
      ["WORK", await store.addWorkLog(work, files)],
      ["OBSERVATION", await store.addObservationMemo({ managementSheetId: work.managementSheetId, managementSheetPlantId: null, observedDate: work.workDate, content: "관찰" }, files)],
      ["PEST", await store.addPestRecord({ managementSheetId: work.managementSheetId, managementSheetPlantId: null, detectedDate: work.workDate, pestType: "진딧물", symptom: "발생", severity: "보통", action: "방제" }, files)],
      ["HARVEST", await store.addHarvestRecord({ managementSheetId: work.managementSheetId, managementSheetPlantId: null, harvestDate: work.workDate, quantity: 0, unit: "개", quality: "보통", notes: "" }, files)]
    ] as const;
    expect(repository.save).toHaveBeenCalledTimes(4);
    for (const [recordType, record] of records) expect(photosForTarget(useGardenStore.getState().data!.photos, { recordType, recordId: record.id })).toHaveLength(3);
  });

  it("1장 뒤에 2장을 추가하고 4번째를 거절하며 사진 하나만 삭제한다", async () => {
    const store = useGardenStore.getState();
    const record = await store.addWorkLog(work, photo());
    const target = { recordType: "WORK" as const, recordId: record.id };
    await store.appendRecordPhotos(target, [photo("2"), photo("3")]);
    const photos = photosForTarget(useGardenStore.getState().data!.photos, target);
    await expect(store.appendRecordPhotos(target, [photo("4")])).rejects.toThrow("최대 3장");
    expect(repository.save).toHaveBeenCalledTimes(2);
    await store.deletePhoto(photos[1].id);
    expect(photosForTarget(useGardenStore.getState().data!.photos, target).map((item) => item.id)).toEqual([photos[0].id, photos[2].id]);
    expect(useGardenStore.getState().data!.workLogs).toHaveLength(1);
    await store.appendRecordPhotos(target, [photo("new")]);
    expect(photosForTarget(useGardenStore.getState().data!.photos, target)).toHaveLength(3);
  });

  it("동시수정 충돌 후 최신 장수를 다시 검사해 3장을 넘기지 않는다", async () => {
    const store = useGardenStore.getState();
    const record = await store.addWorkLog(work, photo());
    const target = { recordType: "WORK" as const, recordId: record.id };
    const latest = structuredClone(useGardenStore.getState().data!);
    const first = latest.photos[0];
    latest.photos.push({ ...first, id: "other-2" }, { ...first, id: "other-3" });
    repository.save.mockRejectedValueOnce(Object.assign(new Error("conflict"), { name: "CloudConflictError" }));
    repository.load.mockResolvedValue(latest);
    await expect(store.appendRecordPhotos(target, [photo("another")])).rejects.toThrow("최대 3장");
    expect(repository.save).toHaveBeenCalledTimes(2);
  });

  it("기존 독립 사진에도 2장을 추가할 수 있고 새 사진기록마다 별도 한도를 갖는다", async () => {
    const store = useGardenStore.getState();
    const first = await store.addPhoto({ ...photo(), managementSheetId: work.managementSheetId, managementSheetPlantId: null });
    const data = useGardenStore.getState().data!;
    delete data.photos[0].albumId;
    await store.appendRecordPhotos({ recordType: null, recordId: first.id }, [photo("2"), photo("3")]);
    expect(photosForTarget(useGardenStore.getState().data!.photos, { recordType: null, recordId: first.id })).toHaveLength(3);
    await store.addPhotos([1, 2, 3].map((value) => ({ ...photo(String(value)), managementSheetId: work.managementSheetId, managementSheetPlantId: null })));
    expect(useGardenStore.getState().data!.photos).toHaveLength(6);
  });

  it("식물 사진은 기존 1장을 보존하고 2장을 추가·개별삭제할 수 있다", async () => {
    const store = useGardenStore.getState();
    const plant = store.data!.plants[0];
    const image = (value: string) => ({ imageDataUrl: `data:image/jpeg;base64,${value}`, imageMimeType: "image/jpeg", imageFileSize: 1 });
    await store.updatePlant(plant.id, { ...plant, ...image("AQ==") });
    await store.appendPlantImages(plant.id, [image("Ag=="), image("Aw==")]);
    expect(getPlantImages(useGardenStore.getState().data!.plants[0])).toHaveLength(3);
    await expect(store.appendPlantImages(plant.id, [image("BA==")])).rejects.toThrow("최대 3장");
    await store.deletePlantImage(plant.id, image("AQ==").imageDataUrl);
    expect(getPlantImages(useGardenStore.getState().data!.plants[0]).map((item) => item.imageDataUrl)).toEqual([image("Ag==").imageDataUrl, image("Aw==").imageDataUrl]);
  });
});
