import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { harvestTestData } from "./fixtures/harvestData";
import { recordEditors, type EditableRecordKind } from "../domain/services/recordEditing";
import RecordEditDialog from "../components/common/RecordEditDialog";

const repository = vi.hoisted(() => ({ save: vi.fn(), load: vi.fn() }));
vi.mock("../infrastructure/repositories/gardenRepositoryFactory", () => ({ createGardenRepository: () => repository }));
vi.mock("../infrastructure/database/gardenDb", () => ({ readStoredSnapshot: vi.fn(), writeSnapshot: vi.fn(async () => {}) }));
import { useGardenStore } from "../stores/gardenStore";

const sheetId = "sheet_1_10";
const photoInput = { imageBlob: new Blob(["image"]), thumbnailBlob: new Blob(["thumb"]), mimeType: "image/jpeg", fileSize: 5, photoDate: "2026-10-16", description: "사진" };
beforeEach(() => {
  repository.save.mockReset().mockResolvedValue(undefined);
  repository.load.mockReset();
  useGardenStore.setState({ data: harvestTestData(), notice: null });
});
afterEach(cleanup);

function valuesFor(kind: EditableRecordKind, record: object) {
  const values = Object.fromEntries(Object.entries(record).map(([key, value]) => [key, value == null ? "" : String(value)]));
  const field = recordEditors[kind].fields.find((item) => item.type === "textarea")!;
  values[field.key] = "수정 내용";
  return values;
}

describe("관리표 기록 수정", () => {
  it("모든 기록 종류를 같은 ID로 저장하고 사진과 완료 상태를 유지한다", async () => {
    const store = useGardenStore.getState();
    await store.addWorkLog({ managementSheetId: sheetId, managementSheetPlantId: null, workDate: "2026-10-16", workType: "물주기", content: "작업", author: "사용자" }, photoInput);
    await store.addObservationMemo({ managementSheetId: sheetId, managementSheetPlantId: null, observedDate: "2026-10-16", content: "관찰" }, photoInput);
    await store.addPestRecord({ managementSheetId: sheetId, managementSheetPlantId: null, detectedDate: "2026-10-16", pestType: "진딧물", severity: "높음", symptom: "증상", action: "조치" }, photoInput);
    await store.addScheduleReminder({ managementSheetId: sheetId, managementSheetPlantId: null, dueDate: "2026-10-16", category: "물주기", content: "일정" });
    await store.addMaterialUsage({ managementSheetId: sheetId, usedDate: "2026-10-16", itemName: "끈", quantity: 1, unit: "개", cost: 200, memo: "자재" });
    await store.upsertSheetEvaluation({ managementSheetId: sheetId, evaluatedAt: "2026-10-16", rating: "좋음", summary: "요약", improvement: "개선" });
    const schedule = useGardenStore.getState().data!.scheduleReminders[0];
    await store.completeScheduleReminder(schedule.id, "single");

    for (const kind of Object.keys(recordEditors) as EditableRecordKind[]) {
      const original = useGardenStore.getState().data![kind][0];
      const count = useGardenStore.getState().data![kind].length;
      const values = valuesFor(kind, original);
      await store.updateSheetRecord(kind, original.id, values);
      const saved = useGardenStore.getState().data![kind].find((item) => item.id === original.id)!;
      expect(saved).toMatchObject({ id: original.id, createdAt: original.createdAt });
      expect(useGardenStore.getState().data![kind]).toHaveLength(count);
      const field = recordEditors[kind].fields.find((item) => item.type === "textarea")!;
      expect(saved).toHaveProperty(field.key, "수정 내용");
    }
    expect(useGardenStore.getState().data!.scheduleReminders[0]).toMatchObject({ isDone: true, completedAt: expect.any(String) });
    expect(useGardenStore.getState().data!.photos).toHaveLength(3);
    expect(useGardenStore.getState().data!.photos[0].imageBlob).toBe(photoInput.imageBlob);
  });

  it("존 전체 작업의 수정은 같은 묶음에 모두 반영하고 식물과 사진 연결은 유지한다", async () => {
    const store = useGardenStore.getState();
    await store.addZoneWorkLog("zone_1", "2026-10-16", "물주기", "original", photoInput);
    const original = useGardenStore.getState().data!.workLogs.find((item) => item.managementSheetId === sheetId)!;
    const current = useGardenStore.getState().data!;
    useGardenStore.setState({ data: { ...current, workLogs: [...current.workLogs,
      { ...original, id: "batch-peer", managementSheetId: "sheet_2_1", managementSheetPlantId: "sheet_2_1_a" },
      { ...original, id: "unrelated", batchId: "different-batch" },
      { ...original, id: "single-work", batchId: null }
    ] } });
    const before = useGardenStore.getState().data!;
    await store.updateSheetRecord("workLogs", original.id, { ...valuesFor("workLogs", original), workDate: "2026-10-20", workType: "비료(추비)", author: "수정자" });
    const after = useGardenStore.getState().data!;
    expect(before.workLogs.find((item) => item.id === original.id)?.content).toBe("original");
    for (const record of after.workLogs.filter((item) => item.batchId === original.batchId)) {
      expect(record).toMatchObject({ workDate: "2026-10-20", workType: "비료(추비)", content: "수정 내용", author: "수정자" });
      const previous = before.workLogs.find((item) => item.id === record.id)!;
      expect(record.managementSheetPlantId).toBe(previous.managementSheetPlantId);
      expect(record.createdAt).toBe(previous.createdAt);
    }
    expect(after.workLogs.filter((item) => item.batchId !== original.batchId)).toEqual(before.workLogs.filter((item) => item.batchId !== original.batchId));
    expect(after.photos).toEqual(before.photos);
    expect(after.workLogs).toHaveLength(before.workLogs.length);
  });

  it("개별 작업은 선택한 기록과 해당 사진의 연결 식물만 수정한다", async () => {
    const store = useGardenStore.getState();
    const input = { managementSheetId: sheetId, managementSheetPlantId: null, workDate: "2026-10-16", workType: "물주기", content: "원본", author: "사용자" };
    const first = await store.addWorkLog(input, photoInput);
    const second = await store.addWorkLog(input);
    await store.updateSheetRecord("workLogs", first.id, { ...valuesFor("workLogs", first), managementSheetPlantId: `${sheetId}_a` });
    const data = useGardenStore.getState().data!;
    expect(data.workLogs.find((item) => item.id === first.id)?.content).toBe("수정 내용");
    expect(data.workLogs.find((item) => item.id === second.id)).toEqual(second);
    expect(data.photos.find((item) => item.recordId === first.id)?.managementSheetPlantId).toBe(`${sheetId}_a`);
  });

  it("존 전체 작업의 저장 실패 시 묶음 전체 원본을 유지한다", async () => {
    const store = useGardenStore.getState();
    const [work] = await store.addZoneWorkLog("zone_1", "2026-10-16", "물주기", "원본");
    const current = useGardenStore.getState().data!;
    useGardenStore.setState({ data: { ...current, workLogs: [...current.workLogs, { ...work, id: "batch-peer" }] } });
    const before = useGardenStore.getState().data!;
    repository.save.mockRejectedValueOnce(new Error("연결 실패"));
    await expect(store.updateSheetRecord("workLogs", work.id, valuesFor("workLogs", work))).rejects.toThrow("연결 실패");
    expect(useGardenStore.getState().data).toEqual(before);
  });

  it("존 전체 작업 수정창에 적용 범위를 안내하고 관리표별 연결 식물 변경은 표시하지 않는다", async () => {
    const [work] = await useGardenStore.getState().addZoneWorkLog("zone_1", "2026-10-16", "물주기", "원본");
    render(<RecordEditDialog target={{ kind: "workLogs", id: work.id }} plants={[]} onClose={vi.fn()} />);
    expect(screen.getByText(/같은 묶음의 모든 관리표 작업기록에 반영/)).toBeInTheDocument();
    expect(screen.queryByLabelText("연결 식물")).not.toBeInTheDocument();
    expect(screen.getByLabelText("작업 내용")).toHaveValue("원본");
  });

  it("잘못된 수량과 다른 관리표의 식물을 거절하고 저장 실패 시 원본을 유지한다", async () => {
    const original = useGardenStore.getState().data!.harvestRecords[1];
    const values = valuesFor("harvestRecords", original);
    const update = useGardenStore.getState().updateSheetRecord;
    await expect(update("harvestRecords", original.id, { ...values, quantity: "-1" })).rejects.toThrow("0 이상");
    await expect(update("harvestRecords", original.id, { ...values, managementSheetPlantId: "sheet_2_1_a" })).rejects.toThrow("이 관리표");
    expect(repository.save).not.toHaveBeenCalled();
    repository.save.mockRejectedValueOnce(new Error("저장 실패"));
    await expect(update("harvestRecords", original.id, values)).rejects.toThrow("저장 실패");
    expect(useGardenStore.getState().data!.harvestRecords[1]).toEqual(original);
  });

  it("수정창에 기존 내용을 불러오고 취소 시 저장하지 않는다", () => {
    const close = vi.fn();
    render(<RecordEditDialog target={{ kind: "harvestRecords", id: "r2" }} plants={[{ id: `${sheetId}_a`, name: "감자" }]} onClose={close} />);
    expect(screen.getByLabelText("수확량")).toHaveValue(180);
    fireEvent.change(screen.getByLabelText("수확 메모"), { target: { value: "취소할 수정" } });
    fireEvent.click(screen.getByRole("button", { name: "취소" }));
    expect(close).toHaveBeenCalledOnce();
    expect(repository.save).not.toHaveBeenCalled();
  });

  it("수정창의 저장은 새 기록을 만들지 않고 기존 기록을 바꾸며 실패하면 입력을 유지한다", async () => {
    const close = vi.fn();
    repository.save.mockRejectedValueOnce(new Error("연결 실패"));
    render(<RecordEditDialog target={{ kind: "harvestRecords", id: "r2" }} plants={[{ id: `${sheetId}_a`, name: "감자" }]} onClose={close} />);
    fireEvent.change(screen.getByLabelText("수확량"), { target: { value: "240" } });
    fireEvent.click(screen.getByRole("button", { name: "수정 저장" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("연결 실패");
    expect(screen.getByLabelText("수확량")).toHaveValue(240);
    expect(close).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "수정 저장" }));
    await waitFor(() => expect(close).toHaveBeenCalledOnce());
    expect(useGardenStore.getState().data!.harvestRecords.find((item) => item.id === "r2")?.quantity).toBe(240);
  });
});
