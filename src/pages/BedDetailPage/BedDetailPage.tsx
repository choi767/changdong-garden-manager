import { Link, useParams } from "react-router-dom";
import StatusPill from "../../components/common/StatusPill";
import { getActiveGroupForBedId } from "../../domain/services/selectors";
import { useGardenStore } from "../../stores/gardenStore";

export default function BedDetailPage() {
  const { bedId } = useParams();
  const data = useGardenStore((state) => state.data);
  if (!data) return null;
  const bed = data.beds.find((item) => item.id === bedId);
  if (!bed) return <div className="page"><p>존재하지 않는 틀입니다.</p></div>;
  const group = getActiveGroupForBedId(data, bed.id);
  const histories = data.statusHistories.filter((history) => history.targetType === "BED" && history.targetId === bed.id);
  const pastMemberships = data.memberships.filter((item) => item.bedId === bed.id && !item.isCurrent);

  return (
    <div className="page narrow">
      <header className="page-header">
        <div>
          <p className="eyebrow">틀 상세</p>
          <h1>{bed.displayCode}</h1>
        </div>
        <StatusPill status={bed.status} />
      </header>

      <section className="panel">
        <h2>현재 상태</h2>
        <dl className="info-grid">
          <dt>Zone</dt><dd>Zone {bed.zoneNumber}</dd>
          <dt>현재 관리그룹</dt><dd>{group ? group.displayCode : "없음"}</dd>
          <dt>활성 여부</dt><dd>{bed.isActive ? "활성" : "비활성"}</dd>
        </dl>
        {!group && <Link className="primary-button" to={`/groups/new?bedId=${bed.id}`}>이 틀로 관리 시작</Link>}
      </section>

      <section className="panel">
        <h2>과거 소속 관리그룹</h2>
        <div className="timeline">
          {pastMemberships.map((membership) => {
            const pastGroup = data.managementGroups.find((item) => item.id === membership.managementGroupId);
            return <p key={membership.id}>{pastGroup?.displayCode ?? "관리그룹"}: {membership.addedAt.slice(0, 10)} 추가, {membership.removedAt?.slice(0, 10)} 제외</p>;
          })}
          {pastMemberships.length === 0 && <p className="empty-text">과거 소속 이력이 없습니다.</p>}
        </div>
      </section>

      <section className="panel">
        <h2>상태 변경 이력</h2>
        <div className="timeline">
          {histories.map((item) => <p key={item.id}>{item.changedAt.slice(0, 10)}: {item.changeDescription}</p>)}
          {histories.length === 0 && <p className="empty-text">상태 변경 이력이 없습니다.</p>}
        </div>
      </section>
    </div>
  );
}
