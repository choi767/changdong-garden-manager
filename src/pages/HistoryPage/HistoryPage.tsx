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
      <p className="hint history-filter-hint">5가지 값중 1가지 이상 입력하세요. 입력한 조건을 모두 만족하는 결과만 보여줍니다. 틀번호와 식물명은 관리표에 포함된 항목 중 하나라도 일치하면 검색됩니다.</p>

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
    </div>
  );
}
