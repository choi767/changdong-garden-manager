import type { Photo, PlantImage } from "../entities/models";

export const MAX_RECORD_PHOTOS = 3;
export type PhotoTarget = { recordType: Photo["recordType"]; recordId: string };

export function assertPhotoLimit(existing: number, added: number) {
  if (added < 1 || existing + added > MAX_RECORD_PHOTOS) {
    throw new Error(`사진은 최대 ${MAX_RECORD_PHOTOS}장까지 등록할 수 있습니다. 현재 ${existing}장, 추가 가능 ${Math.max(0, MAX_RECORD_PHOTOS - existing)}장입니다.`);
  }
}

export function photosForTarget(photos: Photo[], target: PhotoTarget): Photo[] {
  return photos.filter((photo) => target.recordType
    ? photo.recordType === target.recordType && photo.recordId === target.recordId
    : !photo.recordType && (photo.albumId ?? photo.id) === target.recordId);
}

export function getPlantImages(plant: PlantImage & { additionalImages?: PlantImage[] }): PlantImage[] {
  return [...(plant.imageDataUrl ? [{ imageDataUrl: plant.imageDataUrl, imageMimeType: plant.imageMimeType, imageFileSize: plant.imageFileSize }] : []), ...(plant.additionalImages ?? [])];
}

export function plantImageFields(images: PlantImage[]) {
  return {
    imageDataUrl: images[0]?.imageDataUrl ?? "", imageMimeType: images[0]?.imageMimeType ?? "",
    imageFileSize: images[0]?.imageFileSize ?? 0, additionalImages: images.slice(1)
  };
}
