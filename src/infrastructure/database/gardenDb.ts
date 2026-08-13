import type { AppData } from "../../domain/entities/models";
import { createInitialData } from "../../domain/services/seedData";

const DB_NAME = "changdong-garden-v1";
const DB_VERSION = 1;
const STORE_NAME = "snapshots";
const DATA_KEY = "appData";
const EMBEDDED_BACKUP_SETTING_KEY = "embeddedBackupId";

interface SnapshotRecord {
  id: string;
  data: AppData;
  updatedAt: string;
}

type SerializedAppData = Omit<AppData, "photos" | "backgroundImages"> & {
  photos: Array<Omit<AppData["photos"][number], "imageBlob" | "thumbnailBlob"> & {
    imageBlobDataUrl: string | null;
    thumbnailBlobDataUrl: string | null;
  }>;
  backgroundImages: Array<Omit<AppData["backgroundImages"][number], "imageBlob" | "thumbnailBlob"> & {
    imageBlobDataUrl: string | null;
    thumbnailBlobDataUrl: string | null;
  }>;
};

interface EmbeddedBackupPayload {
  schemaVersion: number;
  appVersion: string;
  exportedAt: string;
  data: SerializedAppData;
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB 요청에 실패했습니다."));
  });
}

export function openGardenDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB를 열 수 없습니다."));
  });
}

export async function readSnapshot(): Promise<AppData> {
  const db = await openGardenDb();
  const transaction = db.transaction(STORE_NAME, "readonly");
  const store = transaction.objectStore(STORE_NAME);
  const record = await requestToPromise<SnapshotRecord | undefined>(store.get(DATA_KEY));
  db.close();
  const embeddedPayload = await loadEmbeddedBackupPayload();
  const embedded = deserializeEmbeddedBackup(embeddedPayload);
  if (record) {
    if (embedded && shouldApplyEmbeddedBackup(record.data, embeddedPayload)) {
      const markedEmbedded = markEmbeddedBackupApplied(embedded, embeddedPayload);
      await writeSnapshot(markedEmbedded);
      return markedEmbedded;
    }
    return record.data;
  }
  if (embedded) {
    const markedEmbedded = markEmbeddedBackupApplied(embedded, embeddedPayload);
    await writeSnapshot(markedEmbedded);
    return markedEmbedded;
  }
  const initial = createInitialData();
  await writeSnapshot(initial);
  return initial;
}

async function loadEmbeddedBackupPayload(): Promise<EmbeddedBackupPayload | undefined> {
  const globalPayload = (globalThis as { __CHANGDONG_EMBEDDED_BACKUP__?: EmbeddedBackupPayload }).__CHANGDONG_EMBEDDED_BACKUP__;
  if (globalPayload?.data) return globalPayload;
  if (typeof fetch !== "function" || !["http:", "https:"].includes(globalThis.location?.protocol ?? "")) return undefined;
  try {
    const response = await fetch("/portable-current-data.json", { cache: "no-store" });
    if (!response.ok) return undefined;
    const payload = (await response.json()) as EmbeddedBackupPayload;
    return payload?.data ? payload : undefined;
  } catch {
    return undefined;
  }
}

export async function writeSnapshot(data: AppData): Promise<void> {
  const db = await openGardenDb();
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readwrite");
    transaction.objectStore(STORE_NAME).put({ id: DATA_KEY, data, updatedAt: new Date().toISOString() } satisfies SnapshotRecord);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error("데이터베이스 저장에 실패했습니다."));
    transaction.onabort = () => reject(transaction.error ?? new Error("데이터베이스 트랜잭션이 중단되었습니다."));
  });
  db.close();
}

export async function markCurrentEmbeddedBackupSeen(data: AppData): Promise<AppData> {
  const embeddedPayload = await loadEmbeddedBackupPayload();
  return markEmbeddedBackupApplied(data, embeddedPayload);
}

function deserializeEmbeddedBackup(payload: EmbeddedBackupPayload | undefined): AppData | null {
  if (!payload?.data || payload.schemaVersion !== 1) return null;
  return {
    ...payload.data,
    photos: payload.data.photos.map(({ imageBlobDataUrl, thumbnailBlobDataUrl, ...photo }) => ({
      ...photo,
      imageBlob: dataUrlToBlob(imageBlobDataUrl) ?? new Blob(),
      thumbnailBlob: dataUrlToBlob(thumbnailBlobDataUrl) ?? new Blob()
    })),
    backgroundImages: payload.data.backgroundImages.map(({ imageBlobDataUrl, thumbnailBlobDataUrl, ...image }) => ({
      ...image,
      imageBlob: dataUrlToBlob(imageBlobDataUrl),
      thumbnailBlob: dataUrlToBlob(thumbnailBlobDataUrl)
    }))
  };
}

function shouldApplyEmbeddedBackup(currentData: AppData, payload: EmbeddedBackupPayload | undefined): boolean {
  if (!payload?.data) return false;
  const backupId = getEmbeddedBackupId(payload);
  return currentData.appSettings.find((setting) => setting.key === EMBEDDED_BACKUP_SETTING_KEY)?.value !== backupId;
}

function markEmbeddedBackupApplied(data: AppData, payload: EmbeddedBackupPayload | undefined): AppData {
  if (!payload?.data) return data;
  const backupId = getEmbeddedBackupId(payload);
  const timestamp = new Date().toISOString();
  return {
    ...data,
    appSettings: [
      ...data.appSettings.filter((setting) => setting.key !== EMBEDDED_BACKUP_SETTING_KEY),
      {
        id: "setting_embedded_backup_id",
        key: EMBEDDED_BACKUP_SETTING_KEY,
        value: backupId,
        updatedAt: timestamp
      }
    ]
  };
}

function getEmbeddedBackupId(payload: EmbeddedBackupPayload): string {
  return `${payload.appVersion}:${payload.exportedAt}`;
}

function dataUrlToBlob(dataUrl: string | null): Blob | null {
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
