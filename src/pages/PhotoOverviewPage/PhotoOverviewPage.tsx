import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Trash2 } from "lucide-react";
import type { Photo } from "../../domain/entities/models";
import { getSheetPlantDisplayName } from "../../domain/services/selectors";
import { useGardenStore } from "../../stores/gardenStore";

function PhotoThumb({ photo, onPreview }: { photo: Photo; onPreview: (photo: Photo, url: string) => void }) {
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
    <button className="overview-photo-thumb-button" type="button" onClick={() => onPreview(photo, imageUrl)} aria-label="사진 크게 보기">
      {thumbnailUrl && <img className="overview-photo-thumb" src={thumbnailUrl} alt={photo.description || `${photo.photoDate} 사진`} />}
    </button>
  );
}

export default function PhotoOverviewPage() {
  const data = useGardenStore((state) => state.data);
  const deletePhoto = useGardenStore((state) => state.deletePhoto);
  const [previewPhoto, setPreviewPhoto] = useState<{ photo: Photo; url: string } | null>(null);

  if (!data) return null;
  const appData = data;
  const zones = appData.zones.filter((zone) => zone.isActive).sort((a, b) => a.zoneNumber - b.zoneNumber);

  function sheetInfo(sheetId: string): { code: string; zoneId: string; sheetId: string } | null {
    const sheet = appData.managementSheets.find((item) => item.id === sheetId);
    if (!sheet) return null;
    const group = appData.managementGroups.find((item) => item.id === sheet.managementGroupId);
    if (!group) return null;
    return { code: group.displayCode, zoneId: group.zoneId, sheetId: sheet.id };
  }

  function plantName(sheetPlantId: string | null): string {
    return getSheetPlantDisplayName(appData, sheetPlantId);
  }

  async function onDelete(photoId: string) {
    if (!window.confirm("이 사진을 삭제하시겠습니까?")) return;
    await deletePhoto(photoId);
  }

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
    <div className="page">
      <header className="page-header">
        <div>
          <p className="eyebrow">전체 현황</p>
          <h1>사진</h1>
        </div>
      </header>

      {zones.map((zone) => {
        const records = appData.photos
          .filter((item) => sheetInfo(item.managementSheetId)?.zoneId === zone.id)
          .sort((a, b) => b.photoDate.localeCompare(a.photoDate) || b.createdAt.localeCompare(a.createdAt));

        return (
          <section className="panel zone-overview" key={zone.id}>
            <div className="card-title-row">
              <h2>Zone {zone.zoneNumber}</h2>
              <small>{records.length}개 사진</small>
            </div>
            <div className="timeline">
              {records.map((item) => {
                const info = sheetInfo(item.managementSheetId);
                return (
                  <div className="timeline-item overview-photo-item" key={item.id}>
                    <PhotoThumb photo={item} onPreview={(photo, url) => setPreviewPhoto({ photo, url })} />
                    <p>
                      {item.photoDate} · {info ? <Link className="text-link" to={`/sheets/${info.sheetId}`}>{info.code}</Link> : "관리표 없음"} · {plantName(item.managementSheetPlantId)}
                      {item.description ? ` · ${item.description}` : ""}
                    </p>
                    <button className="danger-button compact-action" type="button" onClick={() => void onDelete(item.id)}>
                      <Trash2 size={16} /> 삭제
                    </button>
                  </div>
                );
              })}
            </div>
            {records.length === 0 && <p className="empty-text">등록된 사진이 없습니다.</p>}
          </section>
        );
      })}

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
    </div>
  );
}
