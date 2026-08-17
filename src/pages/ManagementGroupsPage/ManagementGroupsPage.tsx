import { useNavigate } from "react-router-dom";
import StatusPill from "../../components/common/StatusPill";
import { getBedLabelList, getCurrentBedsForGroup, getGroupSheet } from "../../domain/services/selectors";
import { useGardenStore } from "../../stores/gardenStore";

export default function ManagementGroupsPage() {
  const data = useGardenStore((state) => state.data);
  const navigate = useNavigate();

  if (!data) return null;
  const appData = data;

  const activeGroups = appData.managementGroups
    .filter((group) => group.status === "ACTIVE")
    .sort((a, b) => a.zoneNumber - b.zoneNumber || a.groupNumber - b.groupNumber);

  function groupPlantNames(groupId: string): string {
    const sheet = getGroupSheet(appData, groupId);
    if (!sheet) return "등록 식물 없음";
    const names = appData.sheetPlants
      .filter((item) => item.managementSheetId === sheet.id && item.isActive)
      .map((item) => appData.plants.find((plant) => plant.id === item.plantId)?.name)
      .filter((name): name is string => Boolean(name))
      .sort((a, b) => a.localeCompare(b, "ko-KR"));
    return names.length ? names.join(", ") : "등록 식물 없음";
  }

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <p className="eyebrow">전체 현황</p>
          <h1>활성관리그룹</h1>
        </div>
        <span className="status-pill">{activeGroups.length}개 관리중</span>
      </header>

      <section className="panel">
        <div className="card-title-row">
          <small>현재 관리중인 그룹만 표시합니다.</small>
        </div>
        <div className="home-group-list">
          {activeGroups.map((group) => {
            const beds = getCurrentBedsForGroup(appData, group.id);
            const sheet = getGroupSheet(appData, group.id);
            return (
              <article className="home-group-row" key={group.id} onClick={() => sheet && navigate(`/sheets/${sheet.id}`)}>
                <div className="home-group-main">
                  <strong>{group.displayCode}</strong>
                  <span>{getBedLabelList(beds)}</span>
                </div>
                <small>관리시작 {group.startDate} <span className="group-plant-names">({groupPlantNames(group.id)})</span></small>
                <StatusPill status={group.status} />
              </article>
            );
          })}
          {activeGroups.length === 0 && <p className="empty-text">현재 관리중인 그룹이 없습니다.</p>}
        </div>
      </section>
    </div>
  );
}
