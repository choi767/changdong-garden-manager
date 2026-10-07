import { beforeEach, describe, expect, it, vi } from "vitest";
import { createInitialData } from "../domain/services/seedData";
import { serializeAppData } from "../infrastructure/repositories/appDataSerialization";
import { CloudConflictError, SupabaseGardenRepository } from "../infrastructure/repositories/SupabaseGardenRepository";

const mocks = vi.hoisted(() => ({ row: vi.fn(), rpc: vi.fn(), upload: vi.fn() }));
vi.mock("../infrastructure/supabaseClient", () => ({ getSupabaseClient: () => ({
  from: () => ({ select: () => ({ eq: () => ({ maybeSingle: mocks.row }) }) }),
  rpc: mocks.rpc,
  storage: { from: () => ({ upload: mocks.upload }) }
}) }));

beforeEach(() => vi.clearAllMocks());

async function setup() {
  const data = createInitialData();
  const snapshot = { ...await serializeAppData(data), _cloudStorageVersion: 3 };
  mocks.row.mockResolvedValue({ data: { id: "main", data: snapshot, revision: 20 }, error: null });
  const repository = new SupabaseGardenRepository({ url: "https://example.supabase.co", anonKey: "test", snapshotId: "main" });
  await repository.load();
  return { data, repository };
}

describe("Supabase incremental saves", () => {
  it("preserves the last confirmed revision and changes after a failed save", async () => {
    const { data, repository } = await setup();
    data.workLogs.push({ id: "new", managementSheetId: "sheet", managementSheetPlantId: null,
      workDate: "", workType: "", content: "new", author: "", batchId: null, createdAt: "", updatedAt: "" });
    mocks.rpc.mockResolvedValueOnce({ data: null, error: { message: "offline" } });
    await expect(repository.save(data)).rejects.toThrow("offline");
    mocks.rpc.mockResolvedValueOnce({ data: [{ revision: 21 }], error: null });
    await repository.save(data);
    expect(mocks.rpc).toHaveBeenLastCalledWith("save_garden_changes_v3", {
      p_id: "main", p_expected_revision: 20,
      p_changes: { workLogs: { upserts: data.workLogs, deleteIds: [] } }
    });
    expect(mocks.upload).not.toHaveBeenCalled();
    await repository.save(data);
    expect(mocks.rpc).toHaveBeenCalledTimes(2);
  });

  it("reports conflicts without falling back to a whole-snapshot overwrite", async () => {
    const { data, repository } = await setup();
    data.appSettings.push({ id: "setting", key: "test", value: "changed", updatedAt: "" });
    mocks.rpc.mockResolvedValue({ data: null, error: { message: "GARDEN_SNAPSHOT_CONFLICT" } });
    await expect(repository.save(data)).rejects.toBeInstanceOf(CloudConflictError);
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
    expect(mocks.rpc.mock.calls[0][0]).toBe("save_garden_changes_v3");
  });
});
