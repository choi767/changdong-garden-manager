import type { SupabaseClient } from "@supabase/supabase-js";
import type { AppData } from "../../domain/entities/models";
import { blobToDataUrl, dataUrlToBlob, type SerializedAppData } from "./appDataSerialization";

export const PHOTO_BUCKET = "garden-images";
export type CloudSnapshot = Omit<SerializedAppData, "photos" | "backgroundImages" | "plants"> & {
  _cloudStorageVersion?: number;
  photos: (SerializedAppData["photos"][number] & { imagePath?: string; thumbnailPath?: string })[];
  backgroundImages: (SerializedAppData["backgroundImages"][number] & { imagePath?: string | null; thumbnailPath?: string | null })[];
  plants: (SerializedAppData["plants"][number] & { imagePath?: string })[];
};

export interface CollectionChange {
  upserts: { id: string }[];
  deleteIds: string[];
}

export function diffSnapshots(previous: CloudSnapshot | null, next: CloudSnapshot): Record<string, CollectionChange> {
  const changes: Record<string, CollectionChange> = {};
  for (const key of Object.keys(next) as (keyof SerializedAppData)[]) {
    if (!Array.isArray(next[key])) continue;
    const previousRows = (previous?.[key] ?? []) as { id: string }[];
    const oldRows = new Map(previousRows.map((row) => [row.id, JSON.stringify(row)]));
    const rows = next[key] as { id: string }[];
    const ids = new Set(rows.map((row) => row.id));
    const upserts = rows.filter((row) => oldRows.get(row.id) !== JSON.stringify(row));
    const deleteIds = [...oldRows.keys()].filter((id) => !ids.has(id));
    if (!previous || upserts.length || deleteIds.length) changes[key] = { upserts, deleteIds };
  }
  return changes;
}

async function mapImages<T, R>(items: T[], convert: (item: T) => Promise<R>): Promise<R[]> {
  const result = new Array<R>(items.length);
  let index = 0;
  await Promise.all(Array.from({ length: Math.min(4, items.length) }, async () => {
    while (index < items.length) {
      const current = index++;
      result[current] = await convert(items[current]);
    }
  }));
  return result;
}

export class CloudImages {
  private readonly paths = new WeakMap<Blob, string>();
  private readonly blobs = new Map<string, Blob>();
  private readonly plantPaths = new Map<string, string>();

  constructor(private readonly client: SupabaseClient, private readonly snapshotId: string) {}

  private async upload(blob: Blob | null): Promise<string | null> {
    if (!blob) return null;
    const known = this.paths.get(blob);
    if (known) return known;
    const digest = await crypto.subtle.digest("SHA-256", await blob.arrayBuffer());
    const hash = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
    const path = `${encodeURIComponent(this.snapshotId)}/${hash}`;
    if (!this.blobs.has(path)) {
      const { error } = await this.client.storage.from(PHOTO_BUCKET).upload(path, blob, {
        contentType: blob.type || "application/octet-stream", upsert: false
      });
      // Content-addressed files are immutable; another client may have uploaded the same file.
      if (error && String(error.statusCode) !== "409" && !error.message.toLowerCase().includes("already exists")) {
        throw new Error(`사진을 저장하지 못했습니다: ${error.message}`);
      }
    }
    this.paths.set(blob, path);
    this.blobs.set(path, blob);
    return path;
  }

  private async download(path: string): Promise<Blob> {
    const known = this.blobs.get(path);
    if (known) return known;
    const { data, error } = await this.client.storage.from(PHOTO_BUCKET).download(path);
    if (error || !data) throw new Error(`사진을 불러오지 못했습니다: ${error?.message ?? path}`);
    this.paths.set(data, path);
    this.blobs.set(path, data);
    return data;
  }

  async serialize(data: AppData): Promise<CloudSnapshot> {
    const photos = await mapImages(data.photos, async ({ imageBlob, thumbnailBlob, ...photo }) => ({
      ...photo, imageBlobDataUrl: "", thumbnailBlobDataUrl: "",
      imagePath: (await this.upload(imageBlob))!, thumbnailPath: (await this.upload(thumbnailBlob))!
    }));
    const backgroundImages = await mapImages(data.backgroundImages, async ({ imageBlob, thumbnailBlob, ...image }) => ({
      ...image, imageBlobDataUrl: null, thumbnailBlobDataUrl: null,
      imagePath: await this.upload(imageBlob), thumbnailPath: await this.upload(thumbnailBlob)
    }));
    const plants = await mapImages(data.plants, async (plant) => {
      if (!plant.imageDataUrl) return { ...plant };
      let path = this.plantPaths.get(plant.imageDataUrl);
      if (!path) {
        const blob = dataUrlToBlob(plant.imageDataUrl);
        if (!blob) throw new Error("식물 사진 형식이 올바르지 않습니다.");
        path = (await this.upload(blob))!;
        this.plantPaths.set(plant.imageDataUrl, path);
      }
      return { ...plant, imageDataUrl: "", imagePath: path };
    });
    return { ...data, photos, backgroundImages, plants, _cloudStorageVersion: 3 };
  }

  async deserialize(snapshot: CloudSnapshot): Promise<AppData> {
    const { _cloudStorageVersion: _version, ...data } = snapshot;
    const photos = await mapImages(data.photos, async ({ imageBlobDataUrl, thumbnailBlobDataUrl, imagePath, thumbnailPath, ...photo }) => ({
      ...photo,
      imageBlob: imagePath ? await this.download(imagePath) : dataUrlToBlob(imageBlobDataUrl) ?? new Blob(),
      thumbnailBlob: thumbnailPath ? await this.download(thumbnailPath) : dataUrlToBlob(thumbnailBlobDataUrl) ?? new Blob()
    }));
    const backgroundImages = await mapImages(data.backgroundImages, async ({ imageBlobDataUrl, thumbnailBlobDataUrl, imagePath, thumbnailPath, ...image }) => ({
      ...image,
      imageBlob: imagePath ? await this.download(imagePath) : dataUrlToBlob(imageBlobDataUrl),
      thumbnailBlob: thumbnailPath ? await this.download(thumbnailPath) : dataUrlToBlob(thumbnailBlobDataUrl)
    }));
    const plants = await mapImages(data.plants, async ({ imagePath, ...plant }) => {
      if (!imagePath) return plant;
      const imageDataUrl = (await blobToDataUrl(await this.download(imagePath)))!;
      this.plantPaths.set(imageDataUrl, imagePath);
      return { ...plant, imageDataUrl };
    });
    return { ...data, photos, backgroundImages, plants };
  }
}
