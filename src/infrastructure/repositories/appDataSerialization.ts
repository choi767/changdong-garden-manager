import type { AppData, BackgroundImage, Photo } from "../../domain/entities/models";

export const BACKUP_SCHEMA_VERSION = 1;
export const APP_VERSION = "2.1.0";

export type SerializedPhoto = Omit<Photo, "imageBlob" | "thumbnailBlob"> & {
  imageBlobDataUrl: string;
  thumbnailBlobDataUrl: string;
};

export type SerializedBackgroundImage = Omit<BackgroundImage, "imageBlob" | "thumbnailBlob"> & {
  imageBlobDataUrl: string | null;
  thumbnailBlobDataUrl: string | null;
};

export type SerializedAppData = Omit<AppData, "photos" | "backgroundImages"> & {
  photos: SerializedPhoto[];
  backgroundImages: SerializedBackgroundImage[];
};

export interface BackupPayload {
  schemaVersion: number;
  appVersion: string;
  exportedAt: string;
  data: SerializedAppData;
}

export function blobToDataUrl(blob: Blob | null): Promise<string | null> {
  if (!blob) return Promise.resolve(null);
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : null);
    reader.onerror = () => reject(reader.error ?? new Error("사진 데이터를 백업 파일로 변환하지 못했습니다."));
    reader.readAsDataURL(blob);
  });
}

export function dataUrlToBlob(dataUrl: string | null): Blob | null {
  if (!dataUrl) return null;
  const [meta, base64] = dataUrl.split(",");
  if (!base64) return null;
  const mimeType = meta.match(/data:([^;]+)/)?.[1] ?? "application/octet-stream";
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return new Blob([bytes], { type: mimeType });
}

export async function serializeAppData(data: AppData): Promise<SerializedAppData> {
  return {
    ...data,
    photos: await Promise.all(data.photos.map(async ({ imageBlob, thumbnailBlob, ...photo }) => ({
      ...photo,
      imageBlobDataUrl: (await blobToDataUrl(imageBlob)) ?? "",
      thumbnailBlobDataUrl: (await blobToDataUrl(thumbnailBlob)) ?? ""
    }))),
    backgroundImages: await Promise.all(data.backgroundImages.map(async ({ imageBlob, thumbnailBlob, ...image }) => ({
      ...image,
      imageBlobDataUrl: await blobToDataUrl(imageBlob),
      thumbnailBlobDataUrl: await blobToDataUrl(thumbnailBlob)
    })))
  };
}

export function deserializeAppData(data: SerializedAppData): AppData {
  return {
    ...data,
    photos: data.photos.map(({ imageBlobDataUrl, thumbnailBlobDataUrl, ...photo }) => ({
      ...photo,
      imageBlob: dataUrlToBlob(imageBlobDataUrl) ?? new Blob(),
      thumbnailBlob: dataUrlToBlob(thumbnailBlobDataUrl) ?? new Blob()
    })),
    backgroundImages: data.backgroundImages.map(({ imageBlobDataUrl, thumbnailBlobDataUrl, ...image }) => ({
      ...image,
      imageBlob: dataUrlToBlob(imageBlobDataUrl),
      thumbnailBlob: dataUrlToBlob(thumbnailBlobDataUrl)
    }))
  };
}

export function createBackupPayload(data: SerializedAppData): BackupPayload {
  return {
    schemaVersion: BACKUP_SCHEMA_VERSION,
    appVersion: APP_VERSION,
    exportedAt: new Date().toISOString(),
    data
  };
}

export function parseBackupPayload(json: string): BackupPayload {
  let payload: BackupPayload;
  try {
    payload = JSON.parse(json) as BackupPayload;
  } catch {
    throw new Error("백업 파일 형식이 올바른 JSON이 아닙니다.");
  }
  if (payload.schemaVersion !== BACKUP_SCHEMA_VERSION) {
    throw new Error("지원하지 않는 백업 버전입니다.");
  }
  if (!payload.data?.zones || !payload.data?.beds || !payload.data?.managementGroups) {
    throw new Error("필수 데이터가 누락된 백업 파일입니다.");
  }
  return payload;
}
