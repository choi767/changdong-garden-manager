import { type FormEvent, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { getBedLabelList, getCurrentBedsForGroup, getPastBedsForGroup, getSheetPlants } from "../../domain/services/selectors";
import { useGardenStore } from "../../stores/gardenStore";

function normalizeSearchText(value: string): string {
  return value.trim().replace(/\s+/g, "").toLocaleLowerCase("ko-KR");
}

interface HistoryFilters {
  year: string;
  month: string;
  zone: string;
  bedNo: string;
  plantQuery: string;
}

export default function HistoryPage() {
  const data = useGardenStore((state) => state.data);
  const [year, setYear] = useState("");
  const [month, setMonth] = useState("");
  const [zone, setZone] = useState("");
  const [bedNo, setBedNo] = useState("");
  const [plantQuery, setPlantQuery] = useState("");
  const [appliedFilters, setAppliedFilters] = useState<HistoryFilters | null>(null);
  const [searchMessage, setSearchMessage] = useState("");

  const rows = useMemo(() => {
    if (!data || !appliedFilters) return [];
    const filters = appliedFilters;
    const normalizedPlantQuery = normalizeSearchText(filters.plantQuery);
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
      .filter((row) => !filters.year || row.sheet.startDate.startsWith(filters.year))
      .filter((row) => !filters.month || row.sheet.startDate.slice(5, 7) === filters.month.padStart(2, "0"))
      .filter((row) => !filters.zone || row.group?.zoneNumber === Number(filters.zone))
      .filter((row) => !filters.bedNo || row.beds.some((bed) => bed.bedNumber === Number(filters.bedNo)))
      .filter((row) => !normalizedPlantQuery || row.plants.some((plant) => normalizeSearchText(plant).includes(normalizedPlantQuery)));
  }, [appliedFilters, data]);

  function onSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextFilters = {
      year: year.trim(),
      month: month.trim(),
      zone: zone.trim(),
      bedNo: bedNo.trim(),
      plantQuery: plantQuery.trim()
    };
    if (Object.values(nextFilters).every((value) => !value)) {
      setAppliedFilters(null);
      setSearchMessage("5가지 값중 1가지 이상 입력한 뒤 검색하기를 눌러주세요.");
      return;
    }
    setAppliedFilters(nextFilters);
    setSearchMessage("");
  }

  if (!data) return null;

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <p className="eyebrow">과거 관리표</p>
          <h1>종료된 관리이력검색</h1>
        </div>
      </header>

      <form className="toolbar filters" onSubmit={onSearch}>
        <input value={year} onChange={(event) => setYear(event.target.value)} placeholder="연도 예: 2026" />
        <input value={month} onChange={(event) => setMonth(event.target.value)} placeholder="월 예: 8" />
        <input value={zone} onChange={(event) => setZone(event.target.value)} placeholder="Zone 번호" />
        <input value={bedNo} onChange={(event) => setBedNo(event.target.value)} placeholder="틀 번호" />
        <input value={plantQuery} onChange={(event) => setPlantQuery(event.target.value)} placeholder="식물명" />
        <button className="primary-button" type="submit">검색하기</button>
      </form>
      <p className="hint history-filter-hint">5가지 값중 1가지 이상 입력하세요. 입력한 조건을 모두 만족하는 결과만 보여줍니다. 틀번호와 식물명은 관리표에 포함된 항목 중 하나라도 일치하면 검색됩니다.</p>
      {searchMessage && <p className="form-error">{searchMessage}</p>}

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
        {!appliedFilters && !searchMessage && <p className="empty-text">검색 조건을 입력하고 검색하기를 눌러주세요.</p>}
        {appliedFilters && rows.length === 0 && <p className="empty-text">검색 결과가 없습니다.</p>}
      </section>
    </div>
  );
}
