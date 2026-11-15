import { useEffect, useRef, useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import { recordEditors, type EditableRecordKind } from "../../domain/services/recordEditing";
import { useGardenStore } from "../../stores/gardenStore";

export interface RecordEditTarget { kind: EditableRecordKind; id: string }

export default function RecordEditDialog({ target, plants, onClose }: {
  target: RecordEditTarget;
  plants: Array<{ id: string; name: string }>;
  onClose: () => void;
}) {
  const data = useGardenStore((state) => state.data);
  const update = useGardenStore((state) => state.updateSheetRecord);
  const record = data?.[target.kind].find((item) => item.id === target.id);
  const isZoneWork = target.kind === "workLogs" && Boolean(data?.workLogs.find((item) => item.id === target.id)?.batchId);
  const editor = recordEditors[target.kind];
  const [values, setValues] = useState<Record<string, string>>(() => Object.fromEntries(
    Object.entries(record ?? {}).map(([key, value]) => [key, value == null ? "" : String(value)])
  ));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    dialogRef.current?.querySelector<HTMLElement>("input, select, textarea, button")?.focus();
    return () => previous?.focus();
  }, []);

  async function save(event: FormEvent) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setError("");
    try {
      await update(target.kind, target.id, values);
      closeRef.current();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "수정 내용을 저장하지 못했습니다.");
      setSaving(false);
    }
  }

  return createPortal(
    <div className="modal-backdrop record-edit-backdrop">
      <div ref={dialogRef} className="modal-panel record-edit-dialog" role="dialog" aria-modal="true" aria-labelledby="record-edit-title"
        onKeyDown={(event) => {
          if (event.key === "Escape" && !saving) { event.stopPropagation(); onClose(); }
          if (event.key !== "Tab") return;
          const controls = dialogRef.current?.querySelectorAll<HTMLElement>("input:not(:disabled), select:not(:disabled), textarea:not(:disabled), button:not(:disabled)");
          if (!controls?.length) { event.preventDefault(); return; }
          const first = controls[0];
          const last = controls[controls.length - 1];
          if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
          else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
        }}>
        <h2 id="record-edit-title">{editor.title} 수정</h2>
        <p className="hint">{isZoneWork
          ? "존 전체에 적용한 작업입니다. 수정하면 같은 묶음의 모든 관리표 작업기록에 반영됩니다. 각 관리표의 연결 식물과 첨부 사진은 유지됩니다."
          : "선택한 기록만 수정합니다. 첨부 사진은 유지됩니다."}</p>
        <form className="form-stack" onSubmit={save}>
          <fieldset disabled={saving} className="record-edit-fields">
            {!isZoneWork && target.kind !== "materialUsages" && target.kind !== "sheetEvaluations" && <label>연결 식물
              <select value={values.managementSheetPlantId ?? ""} onChange={(event) => setValues({ ...values, managementSheetPlantId: event.target.value })}>
                <option value="">지정안함</option>
                {plants.map((plant) => <option key={plant.id} value={plant.id}>{plant.name}</option>)}
              </select>
            </label>}
            {editor.fields.map((field) => {
              const value = values[field.key] ?? "";
              const change = (next: string) => setValues((current) => ({ ...current, [field.key]: next }));
              return <label key={field.key}>{field.label}
                {field.type === "textarea" ? <textarea value={value} onChange={(event) => change(event.target.value)} />
                  : field.options ? <select value={value} required={field.required} onChange={(event) => change(event.target.value)}>
                    {[...new Set([value, ...field.options])].map((option) => <option key={option} value={option}>{option || "지정안함"}</option>)}
                  </select>
                  : <input type={field.type ?? "text"} value={value} required={field.required} min={field.type === "number" ? 0 : undefined}
                    step={field.type === "number" ? "any" : undefined} onChange={(event) => change(event.target.value)} />}
              </label>;
            })}
          </fieldset>
          {error && <p className="form-error" role="alert">{error}</p>}
          {!record && <p className="form-error" role="alert">수정할 기록을 찾을 수 없습니다.</p>}
          <div className="button-row">
            <button className="primary-button" type="submit" disabled={saving || !record}>{saving ? "저장 중..." : "수정 저장"}</button>
            <button className="secondary-button" type="button" disabled={saving} onClick={onClose}>취소</button>
          </div>
        </form>
      </div>
    </div>, document.body
  );
}
