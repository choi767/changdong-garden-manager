import { useEffect, useRef, useState } from "react";
import { ImagePlus, X } from "lucide-react";
import { MAX_RECORD_PHOTOS, photosForTarget, type PhotoTarget } from "../../domain/services/photoRules";
import { useGardenStore } from "../../stores/gardenStore";
import { PHOTO_ACCEPT, prepareRecordPhotos, validatePhotoFiles } from "../../utils/recordPhotos";
import { todayIsoDate } from "../../utils/id";

function SelectedPhoto({ file, onRemove, disabled }: { file: File; onRemove: () => void; disabled?: boolean }) {
  const [url, setUrl] = useState("");
  useEffect(() => {
    const url = URL.createObjectURL(file);
    setUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  return <div className="selected-photo"><img src={url} alt={file.name} /><button type="button" className="secondary-button compact-action" onClick={onRemove} disabled={disabled} aria-label={`${file.name} 선택 취소`}><X size={14} /> 제외</button></div>;
}

export function PendingPhotoList({ files, onChange, disabled }: { files: File[]; onChange: (files: File[]) => void; disabled?: boolean }) {
  return <div className="selected-photo-list">{files.map((file, index) => <SelectedPhoto key={`${file.name}-${file.lastModified}-${index}`} file={file} disabled={disabled} onRemove={() => onChange(files.filter((_, current) => current !== index))} />)}</div>;
}

export default function PhotoAttachmentButton({ target }: { target: PhotoTarget }) {
  const data = useGardenStore((state) => state.data);
  const appendRecordPhotos = useGardenStore((state) => state.appendRecordPhotos);
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const photos = data ? photosForTarget(data.photos, target) : [];

  async function save() {
    if (saving) return;
    setSaving(true);
    setError("");
    try {
      validatePhotoFiles(files, photos.length);
      const record = target.recordType === "WORK" ? data?.workLogs.find((item) => item.id === target.recordId)
        : target.recordType === "OBSERVATION" ? data?.observationMemos.find((item) => item.id === target.recordId)
        : target.recordType === "PEST" ? data?.pestRecords.find((item) => item.id === target.recordId)
        : target.recordType === "HARVEST" ? data?.harvestRecords.find((item) => item.id === target.recordId) : undefined;
      const date = record && ("workDate" in record ? record.workDate : "observedDate" in record ? record.observedDate : "detectedDate" in record ? record.detectedDate : record.harvestDate);
      const prepared = await prepareRecordPhotos(files, { photoDate: date || photos[0]?.photoDate || todayIsoDate(), description: photos[0]?.description ?? "" });
      await appendRecordPhotos(target, prepared);
      setFiles([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "사진을 추가하지 못했습니다.");
    } finally { setSaving(false); }
  }

  return <div className="photo-attachment-control">
    {photos.length < MAX_RECORD_PHOTOS
      ? <button className="secondary-button compact-action" type="button" onClick={() => input.current?.click()}><ImagePlus size={16} /> 사진추가 ({photos.length}/3)</button>
      : <small>사진 {photos.length}/3</small>}
    <input className="visually-hidden-file" ref={input} type="file" multiple accept={PHOTO_ACCEPT} aria-label="추가할 사진 선택" onChange={(event) => {
      const selected = Array.from(event.target.files ?? []);
      event.target.value = "";
      if (!selected.length) return;
      try { validatePhotoFiles(selected, photos.length); setFiles(selected); setError(""); }
      catch (err) { setError(err instanceof Error ? err.message : "사진 선택에 실패했습니다."); }
    }} />
    {error && files.length === 0 && <p className="form-error" role="alert">{error}</p>}
    {files.length > 0 && <div className="modal-backdrop photo-attachment-backdrop"><div className="modal-panel" role="dialog" aria-modal="true" aria-label="사진 추가">
      <h2>사진 추가 ({photos.length + files.length}/3)</h2>
      <PendingPhotoList files={files} onChange={setFiles} disabled={saving} />
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="button-row"><button className="primary-button" type="button" onClick={() => void save()} disabled={saving}>{saving ? "사진 저장 중입니다..." : "사진 저장"}</button><button className="secondary-button" type="button" onClick={() => { setFiles([]); setError(""); }} disabled={saving}>취소</button></div>
    </div></div>}
  </div>;
}
