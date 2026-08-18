import { useState } from "react";
import { Link } from "react-router-dom";
import { CheckCircle2, Trash2 } from "lucide-react";
import RecordPhotoGallery from "../../components/common/RecordPhotoGallery";
import { useGardenStore } from "../../stores/gardenStore";
import type { ScheduleReminder, WorkLog } from "../../domain/entities/models";
import { getSheetPlantDisplayName } from "../../domain/services/selectors";

function uniqueByBatch<T extends { id: string; batchId: string | null }>(items: T[]): T[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = item.batchId ? `batch:${item.batchId}` : `single:${item.id}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export default function ScheduleWorkPage() {
  const data = useGardenStore((state) => state.data);
  const completeScheduleReminder = useGardenStore((state) => state.completeScheduleReminder);
  const deleteScheduleReminder = useGardenStore((state) => state.deleteScheduleReminder);
  const deleteWorkLog = useGardenStore((state) => state.deleteWorkLog);
  const [deleteTarget, setDeleteTarget] = useState<ScheduleReminder | null>(null);

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

  function recordsForZone<T extends { managementSheetId: string }>(items: T[], zoneId: string): T[] {
    return items.filter((item) => sheetInfo(item.managementSheetId)?.zoneId === zoneId);
  }

  function batchCount<T extends { batchId: string | null }>(items: T[], item: T): number {
    return item.batchId ? items.filter((candidate) => candidate.batchId === item.batchId && !("isDone" in candidate && candidate.isDone)).length : 1;
  }

  function recordTarget(item: ScheduleReminder | WorkLog, source: Array<ScheduleReminder | WorkLog>): string {
    const info = sheetInfo(item.managementSheetId);
    if (item.batchId) {
      const zone = info ? appData.zones.find((candidate) => candidate.id === info.zoneId) : null;
      return `Z${zone?.zoneNumber ?? ""} 전체 (${batchCount(source, item)}개 관리그룹)`;
    }
    return info?.code ?? "관리표 없음";
  }

  function recordTargetNode(item: ScheduleReminder | WorkLog, source: Array<ScheduleReminder | WorkLog>) {
    if (item.batchId) return <strong>{recordTarget(item, source)}</strong>;
    const info = sheetInfo(item.managementSheetId);
    return info ? <Link className="text-link" to={`/sheets/${info.sheetId}`}>{info.code}</Link> : "관리표 없음";
  }

  function plantName(sheetPlantId: string | null): string {
    return getSheetPlantDisplayName(appData, sheetPlantId);
  }

  function photosForWorkRecord(recordId: string) {
    return appData.photos.filter((photo) => photo.recordType === "WORK" && photo.recordId === recordId);
  }

  async function onCompleteSchedule(id: string) {
    const item = appData.scheduleReminders.find((candidate) => candidate.id === id);
    if (!item) return;
    const targetText = item.batchId ? `${recordTarget(item, appData.scheduleReminders ?? [])}에 적용됩니다.\n` : "";
    if (!window.confirm(`${targetText}이 일정을 완료 처리하고 작업이력에 기록하시겠습니까?`)) return;
    await completeScheduleReminder(id, item.batchId ? "batch" : "single");
  }

  async function onDeleteSchedule(id: string) {
    const item = appData.scheduleReminders.find((candidate) => candidate.id === id);
    if (!item) return;
    if (item.batchId) {
      setDeleteTarget(item);
      return;
    }
    if (!window.confirm("이 일정을 삭제하시겠습니까?")) return;
    await deleteScheduleReminder(id, "single");
  }

  async function runDeleteSchedule(scope: "single" | "batch") {
    if (!deleteTarget) return;
    await deleteScheduleReminder(deleteTarget.id, scope);
    setDeleteTarget(null);
  }

  async function onDeleteWork(id: string) {
    if (!window.confirm("이 작업이력을 삭제하시겠습니까? 같은 묶음 작업도 함께 삭제됩니다.")) return;
    await deleteWorkLog(id);
  }

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <p className="eyebrow">전체 현황</p>
          <h1>일정/작업</h1>
        </div>
      </header>

      {zones.map((zone) => {
        const zoneSchedules = uniqueByBatch(recordsForZone(appData.scheduleReminders ?? [], zone.id).filter((item) => !item.isDone))
          .sort((a, b) => a.dueDate.localeCompare(b.dueDate) || b.createdAt.localeCompare(a.createdAt));
        const zoneWorkLogs = uniqueByBatch(recordsForZone(appData.workLogs, zone.id))
          .sort((a, b) => b.workDate.localeCompare(a.workDate) || b.createdAt.localeCompare(a.createdAt));

        return (
          <section className="panel zone-overview" key={zone.id}>
            <div className="card-title-row">
              <h2>Zone {zone.zoneNumber}</h2>
              <small>{zoneSchedules.length}개 일정 · {zoneWorkLogs.length}개 작업</small>
            </div>

            <div className="dashboard-grid">
              <article className="overview-column">
                <h3>일정/알림</h3>
                <div className="timeline">
                  {zoneSchedules.map((item) => (
                    <div className="timeline-item" key={item.id}>
                      <p>
                        {item.dueDate} · {recordTargetNode(item, appData.scheduleReminders ?? [])} · {plantName(item.managementSheetPlantId)} · {item.category}{item.content ? `: ${item.content}` : ""}
                      </p>
                      <div className="button-row compact">
                        <span className="schedule-badge">예정</span>
                        <button className="secondary-button compact-action" type="button" onClick={() => void onCompleteSchedule(item.id)}>
                          <CheckCircle2 size={16} /> 완료
                        </button>
                        <button className="danger-button compact-action" type="button" onClick={() => void onDeleteSchedule(item.id)}>
                          <Trash2 size={16} /> 삭제
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                {zoneSchedules.length === 0 && <p className="empty-text">등록된 일정이 없습니다.</p>}
              </article>

              <article className="overview-column">
                <h3>작업내용</h3>
                <div className="timeline">
                  {zoneWorkLogs.map((item) => (
                    <div className="timeline-item" key={item.id}>
                      <div>
                        <p>
                          {item.workDate} · {recordTargetNode(item, appData.workLogs)} · {plantName(item.managementSheetPlantId)} · {item.workType}{item.content ? `: ${item.content}` : ""}
                        </p>
                        <RecordPhotoGallery photos={photosForWorkRecord(item.id)} />
                      </div>
                      <button className="danger-button compact-action" type="button" onClick={() => void onDeleteWork(item.id)}>
                        <Trash2 size={16} /> 삭제
                      </button>
                    </div>
                  ))}
                </div>
                {zoneWorkLogs.length === 0 && <p className="empty-text">등록된 작업이력이 없습니다.</p>}
              </article>
            </div>
          </section>
        );
      })}

      {deleteTarget && (
        <div className="modal-backdrop" role="presentation">
          <div className="modal-panel decision-modal" role="dialog" aria-modal="true" aria-labelledby="delete-schedule-title">
            <h2 id="delete-schedule-title">반복일정 삭제 방법을 선택하세요</h2>
            <p className="muted-text">반복일정 전체삭제를 선택해도 이미 완료된 일정은 삭제하지 않습니다.</p>
            <div className="button-row">
              <button className="danger-button" type="button" onClick={() => void runDeleteSchedule("single")}>이 일정만 삭제</button>
              <button className="danger-button" type="button" onClick={() => void runDeleteSchedule("batch")}>반복일정 전체삭제</button>
              <button className="secondary-button" type="button" onClick={() => setDeleteTarget(null)}>취소</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
