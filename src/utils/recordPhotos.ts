import type { Photo } from "../domain/entities/models";
import { assertPhotoLimit } from "../domain/services/photoRules";

export const PHOTO_ACCEPT = "image/*,.jpg,.jpeg,.png,.webp,.heic,.heif";
export type PreparedPhoto = Pick<Photo, "imageBlob" | "thumbnailBlob" | "mimeType" | "fileSize" | "photoDate" | "description">;

export function validatePhotoFiles(files: File[], existing = 0) {
  assertPhotoLimit(existing, files.length);
  if (files.some((file) => !file.type.startsWith("image/"))) throw new Error("사진 파일만 선택해 주세요.");
}

async function resize(image: HTMLImageElement, maxSide: number, quality: number): Promise<Blob> {
  const scale = Math.min(1, maxSide / Math.max(image.naturalWidth, image.naturalHeight));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
  const context = canvas.getContext("2d");
  if (!context) throw new Error("사진 처리 기능을 사용할 수 없습니다.");
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("사진 압축에 실패했습니다.")), "image/jpeg", quality));
}

export async function prepareRecordPhotos(files: File[], metadata: { photoDate: string; description: string }): Promise<PreparedPhoto[]> {
  validatePhotoFiles(files);
  const prepared: PreparedPhoto[] = [];
  for (const file of files) {
    const url = URL.createObjectURL(file);
    try {
      const image = await new Promise<HTMLImageElement>((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = () => reject(new Error("사진 파일을 읽지 못했습니다."));
        image.src = url;
      });
      const imageBlob = await resize(image, 1280, 0.72);
      const thumbnailBlob = await resize(image, 360, 0.6);
      prepared.push({ ...metadata, imageBlob, thumbnailBlob, mimeType: "image/jpeg", fileSize: imageBlob.size + thumbnailBlob.size });
    } finally { URL.revokeObjectURL(url); }
  }
  return prepared;
}
