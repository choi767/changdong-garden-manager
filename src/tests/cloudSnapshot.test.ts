import { afterEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createInitialData } from "../domain/services/seedData";
import { CloudImages, diffSnapshots, type CloudSnapshot } from "../infrastructure/repositories/cloudSnapshot";
import { serializeAppData } from "../infrastructure/repositories/appDataSerialization";

afterEach(() => vi.unstubAllGlobals());

function image(content: number): Blob {
  const blob = new Blob([new Uint8Array([content])], { type: "image/jpeg" });
  Object.defineProperty(blob, "arrayBuffer", { value: async () => new Uint8Array([content]).buffer });
  return blob;
}

function setupStorage() {
  vi.stubGlobal("crypto", { subtle: { digest: async (_algorithm: string, bytes: ArrayBuffer) => bytes } });
  const upload = vi.fn(async () => ({ data: {}, error: null as { statusCode: string; message: string } | null }));
  const download = vi.fn(async () => ({ data: image(4), error: null }));
  const client = { storage: { from: vi.fn(() => ({ upload, download })) } } as unknown as SupabaseClient;
  return { images: new CloudImages(client, "changdong-main"), upload, download };
}

function addPhoto(data: ReturnType<typeof createInitialData>, id: string, value: number) {
  data.photos.push({ id, imageBlob: image(value), thumbnailBlob: image(value + 1),
    managementSheetId: "sheet", managementSheetPlantId: null, recordId: "harvest",
    recordType: "HARVEST", mimeType: "image/jpeg", fileSize: 1,
    description: "", photoDate: "2026-10-07", createdAt: "2026-10-07" });
}

describe("incremental cloud storage", () => {
  it("sends only added, edited and deleted records", async () => {
    const before = await serializeAppData(createInitialData());
    const after = structuredClone(before);
    after.beds[0].status = "CULTIVATING" as typeof after.beds[0]["status"];
    const removed = after.beds.pop()!;
    after.workLogs.push({ id: "new-work", managementSheetId: "sheet", managementSheetPlantId: null,
      workDate: "", workType: "", content: "new", author: "", batchId: null, createdAt: "", updatedAt: "" });
    const changes = diffSnapshots(before, after);
    expect(Object.keys(changes).sort()).toEqual(["beds", "workLogs"]);
    expect(changes.beds.upserts).toHaveLength(1);
    expect(changes.beds.deleteIds).toEqual([removed.id]);
    expect(changes.workLogs.upserts).toEqual(after.workLogs);
    expect(diffSnapshots(before, before)).toEqual({});
  });

  it("uploads existing photos only once, and sends no old photos for a new record", async () => {
    const { images, upload } = setupStorage();
    const data = createInitialData();
    addPhoto(data, "photo-1", 1);
    const first = await images.serialize(data);
    expect(upload).toHaveBeenCalledTimes(2);
    expect(first.photos[0].imageBlobDataUrl).toBe("");
    expect(first.photos[0].imagePath).toBe("changdong-main/01");
    const second = await images.serialize(data);
    expect(upload).toHaveBeenCalledTimes(2);
    expect(diffSnapshots(first, second)).toEqual({});
    addPhoto(data, "photo-2", 3);
    const third = await images.serialize(data);
    expect(upload).toHaveBeenCalledTimes(4);
    expect(diffSnapshots(second, third).photos.upserts.map((row) => row.id)).toEqual(["photo-2"]);
  });

  it("reads legacy embedded photos and preserves bytes for migration", async () => {
    const { images, download } = setupStorage();
    const data = createInitialData();
    addPhoto(data, "legacy", 1);
    const embedded = await serializeAppData(data);
    const restored = await images.deserialize(embedded);
    expect(download).not.toHaveBeenCalled();
    expect(restored.photos[0].imageBlob.size).toBe(1);
    expect(restored.photos[0].imageBlob.type).toBe("image/jpeg");
  });

  it("reuses downloaded files on subsequent saves and keeps backup data free of paths", async () => {
    const { images, upload, download } = setupStorage();
    const data = createInitialData();
    addPhoto(data, "photo", 1);
    const snapshot = await serializeAppData(data) as CloudSnapshot;
    snapshot.photos[0] = { ...snapshot.photos[0], imageBlobDataUrl: "", thumbnailBlobDataUrl: "",
      imagePath: "changdong-main/image", thumbnailPath: "changdong-main/thumb" };
    const restored = await images.deserialize(snapshot);
    expect(download).toHaveBeenCalledTimes(2);
    const next = await images.serialize(restored);
    expect(upload).not.toHaveBeenCalled();
    expect(next.photos[0].imagePath).toBe(snapshot.photos[0].imagePath);
    const backup = await serializeAppData(restored);
    expect(backup.photos[0].imageBlobDataUrl).toContain("data:image/jpeg;base64,");
    expect(backup.photos[0]).not.toHaveProperty("imagePath");
  });

  it("fails on upload errors, retries safely, and tolerates identical concurrent uploads", async () => {
    const { images, upload } = setupStorage();
    const data = createInitialData();
    addPhoto(data, "photo", 1);
    upload.mockResolvedValueOnce({ data: {}, error: { statusCode: "503", message: "offline" } });
    await expect(images.serialize(data)).rejects.toThrow("offline");
    upload.mockResolvedValueOnce({ data: {}, error: { statusCode: "400", message: "Asset already exists" } });
    await expect(images.serialize(data)).resolves.toMatchObject({ _cloudStorageVersion: 3 });
  });
});
