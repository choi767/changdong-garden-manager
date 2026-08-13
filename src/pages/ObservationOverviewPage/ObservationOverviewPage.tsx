import { Link } from "react-router-dom";
import { Trash2 } from "lucide-react";
import { useGardenStore } from "../../stores/gardenStore";

export default function ObservationOverviewPage() {
  const data = useGardenStore((state) => state.data);
  const deleteObservationMemo = useGardenStore((state) => state.deleteObservationMemo);

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
    if (!sheetPlantId) return "식물명미지정";
    const sheetPlant = appData.sheetPlants.find((item) => item.id === sheetPlantId);
    const plant = sheetPlant ? appData.plants.find((item) => item.id === sheetPlant.plantId) : null;
    return plant?.name ?? "삭제된 식물";
  }

  async function onDelete(id: string) {
    if (!window.confirm("이 관찰메모를 삭제하시겠습니까?")) return;
    await deleteObservationMemo(id);
  }

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <p className="eyebrow">전체 현황</p>
          <h1>관찰메모</h1>
        </div>
      </header>

      {zones.map((zone) => {
        const records = (appData.observationMemos ?? [])
          .filter((item) => sheetInfo(item.managementSheetId)?.zoneId === zone.id)
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

        return (
          <section className="panel zone-overview" key={zone.id}>
            <div className="card-title-row">
              <h2>Zone {zone.zoneNumber}</h2>
              <small>{records.length}개 메모</small>
            </div>
            <div className="timeline">
              {records.map((item) => {
                const info = sheetInfo(item.managementSheetId);
                return (
                  <div className="timeline-item" key={item.id}>
                    <p>
                      {item.observedDate} · {info ? <Link className="text-link" to={`/sheets/${info.sheetId}`}>{info.code}</Link> : "관리표 없음"} · {plantName(item.managementSheetPlantId)} · {item.content}
                    </p>
                    <button className="danger-button compact-action" type="button" onClick={() => void onDelete(item.id)}>
                      <Trash2 size={16} /> 삭제
                    </button>
                  </div>
                );
              })}
            </div>
            {records.length === 0 && <p className="empty-text">등록된 관찰메모가 없습니다.</p>}
          </section>
        );
      })}
    </div>
  );
}
