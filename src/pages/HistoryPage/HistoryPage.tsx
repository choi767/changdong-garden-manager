import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { getBedLabelList, getCurrentBedsForGroup, getPastBedsForGroup, getSheetPlants } from "../../domain/services/selectors";
import { useGardenStore } from "../../stores/gardenStore";

function normalizeSearchText(value: string): string {
  return value.trim().replace(/\s+/g, "").toLocaleLowerCase("ko-KR");
}

export default function HistoryPage() {
  const data = useGardenStore((state) => state.data);
  const [year, setYear] = useState("");
  const [month, setMonth] = useState("");
  const [zone, setZone] = useState("");
  const [bedNo, setBedNo] = useState("");
  const [plantQuery, setPlantQuery] = useState("");
  const [bedHistoryZone, setBedHistoryZone] = useState("");
  const [bedHistoryNo, setBedHistoryNo] = useState("");

  const rows = useMemo(() => {
    if (!data) return [];
    return data.managementSheets
      .filter((sheet) => sheet.status === "CLOSED")
      .map((sheet) => {
        const group = data.managementGroups.find((item) => item.id === sheet.managementGroupId);
        const currentBeds = group ? getCurrentBedsForGroup(data, group.id) : [];
        const pastBeds = group ? getPastBedsForGroup(data, group.id) : [];
        const allBeds = [...currentBeds, ...pastBeds];
        const plants = getSheetPlants(data, sheet.id).map((item) => item.plant?.name ?? "");
        return { sheet, group, beds: allBeds, plants };
      })
      .filter((row) => !year || row.sheet.startDate.startsWith(year))
      .filter((row) => !month || row.sheet.startDate.slice(5, 7) === month.padStart(2, "0"))
      .filter((row) => !zone || row.group?.zoneNumber === Number(zone))
      .filter((row) => !bedNo || row.beds.some((bed) => bed.bedNumber === Number(bedNo)))
      .filter((row) => {
        const normalizedPlantQuery = normalizeSearchText(plantQuery);
        return !normalizedPlantQuery || row.plants.some((plant) => normalizeSearchText(plant).includes(normalizedPlantQuery));
      });
  }, [bedNo, data, month, plantQuery, year, zone]);

  const bedHistory = useMemo(() => {
    if (!data || !bedHistoryZone || !bedHistoryNo) return null;
    const bed = data.beds.find((item) => item.zoneNumber === Number(bedHistoryZone) && item.bedNumber === Number(bedHistoryNo));
    if (!bed) return { bed: null, rows: [] };
    const rows = data.memberships
      .filter((membership) => membership.bedId === bed.id)
      .map((membership) => {
        const group = data.managementGroups.find((item) => item.id === membership.managementGroupId);
        const sheet = group ? data.managementSheets.find((item) => item.managementGroupId === group.id) : undefined;
        const sheetPlants = sheet ? data.sheetPlants.filter((item) => item.managementSheetId === sheet.id) : [];
        const plantNames = sheetPlants
          .map((item) => data.plants.find((plant) => plant.id === item.plantId)?.name)
          .filter((name): name is string => Boolean(name));
        const workCount = sheet ? data.workLogs.filter((item) => item.managementSheetId === sheet.id).length : 0;
        const harvestCount = sheet ? data.harvestRecords.filter((item) => item.managementSheetId === sheet.id).length : 0;
        const photoCount = sheet ? data.photos.filter((item) => item.managementSheetId === sheet.id).length : 0;
        return { membership, group, sheet, plantNames, workCount, harvestCount, photoCount };
      })
      .filter((row) => row.group && row.sheet)
      .sort((a, b) => (b.sheet?.startDate ?? "").localeCompare(a.sheet?.startDate ?? ""));
    return { bed, rows };
  }, [bedHistoryNo, bedHistoryZone, data]);

  if (!data) return null;

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <p className="eyebrow">과거 관리표</p>
          <h1>종료된 관리이력검색</h1>
        </div>
      </header>

      <section className="toolbar filters">
        <input value={year} onChange={(event) => setYear(event.target.value)} placeholder="연도 예: 2026" />
        <input value={month} onChange={(event) => setMonth(event.target.value)} placeholder="월 예: 8" />
        <input value={zone} onChange={(event) => setZone(event.target.value)} placeholder="Zone" />
        <input value={bedNo} onChange={(event) => setBedNo(event.target.value)} placeholder="틀 번호" />
        <input value={plantQuery} onChange={(event) => setPlantQuery(event.target.value)} placeholder="식물명" />
      </section>
      <p className="hint">입력값 모두 동시에 만족되는 결과만 보여줍니다. 틀번호와 식물명은 관리표에 포함된 항목 중 하나라도 일치하면 검색됩니다.</p>

      <section className="card-list">
        {rows.map((row) => (
          <article className="card" key={row.sheet.id}>
            <div className="card-title-row">
              <strong>{row.group?.displayCode}</strong>
              <Link to={`/sheets/${row.sheet.id}`}>상세</Link>
            </div>
            <p>{getBedLabelList(row.beds)}</p>
            <small>{row.sheet.startDate} ~ {row.sheet.endDate ?? ""}</small>
          </article>
        ))}
        {rows.length === 0 && <p className="empty-text">검색 결과가 없습니다.</p>}
      </section>

      <section className="panel form-stack">
        <div className="card-title-row">
          <h2>틀별 관리 이력검색</h2>
          <small>특정 틀의 현재/과거 재배 식물을 확인합니다.</small>
        </div>
        <div className="toolbar filters">
          <input value={bedHistoryZone} onChange={(event) => setBedHistoryZone(event.target.value)} placeholder="Zone 번호" />
          <input value={bedHistoryNo} onChange={(event) => setBedHistoryNo(event.target.value)} placeholder="틀 번호" />
        </div>

        {bedHistory?.bed && (
          <div className="card-list">
            <article className="card">
              <div className="card-title-row">
                <strong>{bedHistory.bed.displayCode}</strong>
                <span className="status-pill">{bedHistory.rows.some((row) => row.group?.status === "ACTIVE" && row.membership.isCurrent) ? "현재 재배중" : "현재 휴경"}</span>
              </div>
              <p>현재/과거 관리 이력 {bedHistory.rows.length}건</p>
            </article>
            {bedHistory.rows.map((row) => (
              <article className="card" key={row.membership.id}>
                <div className="card-title-row">
                  <strong>{row.group?.displayCode}</strong>
                  {row.sheet && <Link to={`/sheets/${row.sheet.id}`}>상세</Link>}
                </div>
                <dl className="info-grid small">
                  <dt>구분</dt><dd>{row.group?.status === "ACTIVE" && row.membership.isCurrent ? "현재 재배중" : "과거 재배"}</dd>
                  <dt>관리기간</dt><dd>{row.sheet?.startDate} ~ {row.sheet?.endDate ?? "관리중"}</dd>
                  <dt>재배 식물</dt><dd>{row.plantNames.length > 0 ? row.plantNames.join(", ") : "식물명미지정"}</dd>
                  <dt>작업이력</dt><dd>{row.workCount}건</dd>
                  <dt>수확기록</dt><dd>{row.harvestCount}건</dd>
                  <dt>사진기록</dt><dd>{row.photoCount}건</dd>
                </dl>
              </article>
            ))}
            {bedHistory.rows.length === 0 && <p className="empty-text">이 틀의 관리 이력이 없습니다.</p>}
          </div>
        )}
        {bedHistory && !bedHistory.bed && <p className="empty-text">해당 Zone/틀 번호를 찾을 수 없습니다.</p>}
      </section>
    </div>
  );
}
