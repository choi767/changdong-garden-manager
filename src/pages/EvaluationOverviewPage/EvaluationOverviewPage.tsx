import { Link } from "react-router-dom";
import { useGardenStore } from "../../stores/gardenStore";

export default function EvaluationOverviewPage() {
  const data = useGardenStore((state) => state.data);

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

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <p className="eyebrow">전체 현황</p>
          <h1>평가</h1>
        </div>
      </header>

      {zones.map((zone) => {
        const records = appData.sheetEvaluations
          .filter((item) => sheetInfo(item.managementSheetId)?.zoneId === zone.id)
          .sort((a, b) => b.evaluatedAt.localeCompare(a.evaluatedAt) || b.updatedAt.localeCompare(a.updatedAt));

        return (
          <section className="panel zone-overview" key={zone.id}>
            <div className="card-title-row">
              <h2>Zone {zone.zoneNumber}</h2>
              <small>{records.length}개 평가</small>
            </div>
            <div className="timeline">
              {records.map((item) => {
                const info = sheetInfo(item.managementSheetId);
                return (
                  <div className="timeline-item" key={item.id}>
                    <p>
                      {item.evaluatedAt} · {info ? <Link className="text-link" to={`/sheets/${info.sheetId}`}>{info.code}</Link> : "관리표 없음"} · {item.rating}
                      {item.summary ? ` · ${item.summary}` : ""}
                      {item.improvement ? ` · 개선: ${item.improvement}` : ""}
                    </p>
                  </div>
                );
              })}
            </div>
            {records.length === 0 && <p className="empty-text">등록된 평가가 없습니다.</p>}
          </section>
        );
      })}
    </div>
  );
}
