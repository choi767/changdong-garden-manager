import { useEffect, useState } from "react";
import type { Photo } from "../../domain/entities/models";

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

export default function RecordPhotoGallery({ photos }: { photos: Photo[] }) {
  const [previewPhoto, setPreviewPhoto] = useState<{ photo: Photo; url: string } | null>(null);

  if (photos.length === 0) return null;

  function onDownloadPreviewPhoto() {
    if (!previewPhoto) return;
    const link = document.createElement("a");
    link.href = previewPhoto.url;
    link.download = `${previewPhoto.photo.photoDate}_사진.jpg`;
    document.body.appendChild(link);
    link.click();
    link.remove();
  }

  return (
    <>
      <div className="record-photo-list">
        {photos.map((photo) => <RecordPhotoThumb key={photo.id} photo={photo} onPreview={(photo, url) => setPreviewPhoto({ photo, url })} />)}
      </div>
      {previewPhoto && (
        <div className="modal-backdrop photo-preview-backdrop" role="presentation" onClick={() => setPreviewPhoto(null)}>
          <div className="photo-preview-panel" role="dialog" aria-modal="true" aria-label="사진 크게 보기" onClick={(event) => event.stopPropagation()}>
            <div className="photo-preview-actions">
              <button className="secondary-button compact-action" type="button" onClick={onDownloadPreviewPhoto}>다운로드</button>
              <button className="secondary-button compact-action" type="button" onClick={() => setPreviewPhoto(null)}>닫기</button>
            </div>
            <img src={previewPhoto.url} alt={previewPhoto.photo.description || "사진 크게 보기"} />
          </div>
        </div>
      )}
    </>
  );
}
