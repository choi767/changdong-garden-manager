import { FormEvent, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { getNextGroupNumber } from "../../domain/services/groupRules";
import { useGardenStore } from "../../stores/gardenStore";

type MapPosition = {
  left: number;
  top: number;
  width: number;
  height: number;
};

const zone2ShapePaths: Record<string, string> = {
  4: "M1 1 H99 V61 H66 V99 H1 Z",
  14: "M1 1 H78 V35 H99 V99 H1 Z",
  24: "M42 1 H99 V99 H1 V40 H42 Z"
};

const zoneMapLayouts: Record<number, Record<string, MapPosition>> = {
  1: {
    1: { left: 3, top: 30, width: 10.5, height: 12.5 },
    2: { left: 13.5, top: 17.5, width: 10.5, height: 12.5 },
    3: { left: 24, top: 5, width: 10.5, height: 12.5 },
    4: { left: 34.5, top: 5, width: 10.5, height: 12.5 },
    5: { left: 55, top: 5, width: 10.5, height: 12.5 },
    6: { left: 65.5, top: 5, width: 10.5, height: 12.5 },
    7: { left: 76, top: 17.5, width: 10.5, height: 12.5 },
    8: { left: 86.5, top: 30, width: 10.5, height: 12.5 },
    9: { left: 24, top: 42.5, width: 10.5, height: 12.5 },
    10: { left: 34.5, top: 42.5, width: 10.5, height: 12.5 },
    11: { left: 34.5, top: 30, width: 10.5, height: 12.5 },
    12: { left: 55, top: 30, width: 10.5, height: 12.5 },
    13: { left: 55, top: 42.5, width: 10.5, height: 12.5 },
    14: { left: 65.5, top: 42.5, width: 10.5, height: 12.5 },
    15: { left: 3, top: 60, width: 10.5, height: 12.5 },
    16: { left: 3, top: 72.5, width: 10.5, height: 12.5 },
    17: { left: 13.5, top: 72.5, width: 10.5, height: 12.5 },
    18: { left: 24, top: 72.5, width: 10.5, height: 12.5 },
    19: { left: 34.5, top: 72.5, width: 10.5, height: 12.5 },
    20: { left: 55, top: 72.5, width: 10.5, height: 12.5 },
    21: { left: 65.5, top: 72.5, width: 10.5, height: 12.5 },
    22: { left: 76, top: 72.5, width: 10.5, height: 12.5 },
    23: { left: 86.5, top: 72.5, width: 10.5, height: 12.5 },
    24: { left: 86.5, top: 60, width: 10.5, height: 12.5 }
  },
  2: {
    1: { left: 0, top: 35.1, width: 9.2, height: 11 },
    2: { left: 0, top: 23.9, width: 9.2, height: 11.1 },
    3: { left: 0, top: 12.7, width: 9.2, height: 11.1 },
    4: { left: 0, top: 0, width: 13.8, height: 12.7 },
    5: { left: 13.5, top: 0, width: 10, height: 7.8 },
    6: { left: 23.5, top: 0, width: 10, height: 7.8 },
    7: { left: 33.4, top: 0, width: 10.1, height: 7.8 },
    8: { left: 33.6, top: 13.6, width: 9.8, height: 12 },
    9: { left: 16, top: 13.6, width: 10, height: 12 },
    10: { left: 15.7, top: 33.2, width: 10.4, height: 13 },
    11: { left: 0, top: 55.1, width: 9.2, height: 10 },
    12: { left: 0, top: 65, width: 9.2, height: 11.3 },
    13: { left: 0, top: 76.3, width: 9.2, height: 12.2 },
    14: { left: 0, top: 88.4, width: 11.8, height: 11.4 },
    15: { left: 11.4, top: 92.4, width: 10.1, height: 7.5 },
    16: { left: 21.5, top: 92.4, width: 10, height: 7.5 },
    17: { left: 31.5, top: 92.4, width: 10.1, height: 7.5 },
    18: { left: 31.2, top: 75.3, width: 10.1, height: 13.3 },
    19: { left: 15.1, top: 75.5, width: 10, height: 13 },
    20: { left: 15.2, top: 56.1, width: 10.1, height: 12 },
    21: { left: 90.8, top: 53.9, width: 9.2, height: 11.1 },
    22: { left: 90.8, top: 65, width: 9.2, height: 11.1 },
    23: { left: 90.8, top: 76.1, width: 9.2, height: 11.1 },
    24: { left: 84.2, top: 87.3, width: 15.8, height: 12.6 },
    25: { left: 76.5, top: 92.4, width: 10, height: 7.5 },
    26: { left: 66.6, top: 92.4, width: 10, height: 7.5 },
    27: { left: 56.6, top: 92.4, width: 10, height: 7.5 },
    28: { left: 56.6, top: 75.1, width: 10, height: 13 },
    29: { left: 75.6, top: 74.8, width: 10, height: 13 },
    30: { left: 75.6, top: 54.3, width: 10, height: 11.1 },
    31: { left: 90.8, top: 36, width: 9.2, height: 9.4 },
    32: { left: 90.8, top: 26.6, width: 9.2, height: 9.4 },
    33: { left: 90.8, top: 17.3, width: 9.2, height: 9.4 },
    34: { left: 90.8, top: 7.9, width: 9.2, height: 9.4 },
    35: { left: 90.8, top: 0.3, width: 9.2, height: 7.6 },
    36: { left: 82.5, top: 0.1, width: 8.3, height: 7.6 },
    37: { left: 74.4, top: 0.1, width: 8.1, height: 7.6 },
    38: { left: 65.6, top: 0.1, width: 8.8, height: 7.6 },
    39: { left: 56.7, top: 0.1, width: 8.9, height: 7.6 },
    40: { left: 57.9, top: 12.7, width: 10, height: 12.2 },
    41: { left: 75.4, top: 12.7, width: 10, height: 12.2 },
    42: { left: 76.1, top: 33.7, width: 9.8, height: 12.2 },
    43: { left: 47, top: 39.1, width: 9, height: 10.5 },
    "43-a": { left: 38.5, top: 31.8, width: 13.2, height: 12.4 },
    "43-b": { left: 51.7, top: 31.8, width: 13.2, height: 12.4 },
    "43-c": { left: 38.5, top: 44.2, width: 13.2, height: 12.4 },
    "43-d": { left: 51.7, top: 44.2, width: 13.2, height: 12.4 },
    44: { left: 0, top: 86, width: 9.2, height: 7 },
    45: { left: 0, top: 93, width: 9.2, height: 7 },
    46: { left: 31.5, top: 86, width: 10.1, height: 8.3 },
    47: { left: 56.6, top: 86, width: 10, height: 8.3 },
    48: { left: 90.8, top: 86, width: 9.2, height: 6.8 },
    49: { left: 90.8, top: 95, width: 9.2, height: 6.8 }
  },
  3: {
    1: { left: 14.5, top: 11, width: 8.5, height: 34 },
    2: { left: 14.5, top: 56, width: 8.5, height: 34 },
    3: { left: 30.3, top: 11, width: 8.5, height: 34 },
    4: { left: 30.3, top: 56, width: 8.5, height: 34 },
    5: { left: 46.1, top: 11, width: 8.5, height: 34 },
    6: { left: 46.1, top: 56, width: 8.5, height: 34 },
    7: { left: 61.9, top: 11, width: 8.5, height: 34 },
    8: { left: 61.9, top: 56, width: 8.5, height: 34 },
    9: { left: 77.7, top: 11, width: 8.5, height: 34 },
    10: { left: 77.7, top: 56, width: 8.5, height: 34 }
  }
};

function fallbackMapPosition(bedNumber: number, zoneNumber: number): MapPosition {
  const cols = zoneNumber === 2 ? 7 : 6;
  const row = Math.floor((bedNumber - 1) / cols);
  const col = (bedNumber - 1) % cols;
  return { left: 3 + col * (94 / cols), top: 16 + row * 12.5, width: 86 / cols, height: 10.5 };
}

function bedMapLabel(displayCode: string, zoneNumber: number, bedNumber: number): string {
  const prefix = `${zoneNumber}-`;
  return displayCode.startsWith(prefix) ? displayCode.slice(prefix.length) : String(bedNumber);
}

function displayOrder(label: string): number {
  const match = label.match(/^(\d+)(?:-([a-d]))?$/);
  if (!match) return Number.MAX_SAFE_INTEGER;
  return Number(match[1]) * 10 + (match[2] ? match[2].charCodeAt(0) - 96 : 0);
}

function mapPositionFor(zoneNumber: number, key: string, position: MapPosition): MapPosition {
  if (zoneNumber !== 2 || key === "43" || Number(key) > 43 || key.includes("-")) return position;
  return { ...position, top: position.top * 0.86, height: position.height * 0.86 };
}

export default function CreateManagementGroupPage() {
  const data = useGardenStore((state) => state.data);
  const createGroup = useGardenStore((state) => state.createGroup);
  const [params] = useSearchParams();
  const preselectedBedId = params.get("bedId");
  const [zoneId, setZoneId] = useState("zone_1");
  const [selectedBedIds, setSelectedBedIds] = useState<string[]>([]);
  const [startDate, setStartDate] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    if (!data || !preselectedBedId) return;
    const bed = data.beds.find((item) => item.id === preselectedBedId);
    if (!bed) {
      setError("선택한 틀을 찾을 수 없습니다.");
      return;
    }
    setZoneId(bed.zoneId);
    setSelectedBedIds([bed.id]);
  }, [data, preselectedBedId]);

  const fallowBeds = useMemo(
    () => data?.beds.filter((bed) => bed.zoneId === zoneId && bed.status === "FALLOW" && bed.isActive) ?? [],
    [data, zoneId]
  );

  if (!data) return null;
  const zone = data.zones.find((item) => item.id === zoneId);
  const nextNumber = zone ? getNextGroupNumber(data.managementGroups, zone.id) : 1;
  const zoneBeds = zone
    ? data.beds
        .filter((bed) => bed.zoneId === zone.id)
        .sort((a, b) => displayOrder(bedMapLabel(a.displayCode, zone.zoneNumber, a.bedNumber)) - displayOrder(bedMapLabel(b.displayCode, zone.zoneNumber, b.bedNumber)))
    : [];
  const zoneLayout = zone ? zoneMapLayouts[zone.zoneNumber] : undefined;

  function toggleBed(id: string) {
    setSelectedBedIds((prev) => prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]);
  }

  function onZoneChange(nextZoneId: string) {
    setZoneId(nextZoneId);
    setSelectedBedIds([]);
    setError("");
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");
    if (!startDate) {
      setError("관리 시작일을 입력해 주세요.");
      return;
    }
    try {
      const sheet = await createGroup(selectedBedIds, startDate);
      navigate(`/sheets/${sheet.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "관리그룹 생성에 실패했습니다.");
    }
  }

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <p className="eyebrow">관리그룹 생성</p>
          <h1>{zone ? `Z${zone.zoneNumber}-G${nextNumber}` : "새 관리그룹"}</h1>
        </div>
      </header>
      <form className="panel form-stack" onSubmit={onSubmit}>
        <label>
          Zone
          <select value={zoneId} onChange={(event) => onZoneChange(event.target.value)}>
            {data.zones.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </label>
        <label>
          관리 시작일
          <input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
          {!startDate && <small className="field-placeholder-hint">- - -</small>}
        </label>
        <div className="create-map-section">
          <div className="card-title-row">
            <div>
              <h2>지도에서 휴경 틀 선택</h2>
              <small>{selectedBedIds.length}개 틀 선택</small>
            </div>
            <div className="zone-map-legend">
              <span><i className="legend-box fallow" />선택 가능</span>
              <span><i className="legend-box active" />경작중</span>
              <span><i className="legend-box selected" />선택됨</span>
            </div>
          </div>
          {zone && (
            <article className={`zone-map-board create-zone-map ${zoneLayout ? "zone-map-drawn" : "zone-map-fallback"}`}>
              <div className="zone-map-heading">
                <h3>Zone {zone.zoneNumber}</h3>
              </div>
              <div className={`zone-map-canvas zone-map-canvas-z${zone.zoneNumber}`}>
                {zoneBeds.map((bed) => {
                  const label = bedMapLabel(bed.displayCode, zone.zoneNumber, bed.bedNumber);
                  const position = mapPositionFor(zone.zoneNumber, label, zoneLayout?.[label] ?? fallbackMapPosition(bed.bedNumber, zone.zoneNumber));
                  const shapePath = zone.zoneNumber === 2 ? zone2ShapePaths[label] : undefined;
                  const isZone2Sector = zone.zoneNumber === 2 && label.startsWith("43-");
                  const isSelectable = fallowBeds.some((item) => item.id === bed.id);
                  const isSelected = selectedBedIds.includes(bed.id);
                  return (
                    <button
                      key={bed.id}
                      type="button"
                      className={`bed-overlay zone-bed-overlay ${shapePath ? `zone-bed-shape zone-bed-shape-${label}` : ""} ${isZone2Sector ? `zone-bed-sector zone-bed-sector-${label.slice(-1)}` : ""} ${zone.zoneNumber === 2 && label === "24" ? "zone-bed-wide-center" : ""} ${zone.zoneNumber === 2 && label === "43" ? "zone-bed-round" : ""} ${isSelectable ? "fallow" : "active"} ${isSelected ? "selected" : ""}`}
                      style={{
                        left: `${position.left}%`,
                        top: `${position.top}%`,
                        width: `${position.width}%`,
                        height: `${position.height}%`,
                        zIndex: zone.zoneNumber === 2 && label === "43" ? 600 : bed.zIndex
                      }}
                      title={`${bed.displayCode} ${isSelectable ? "선택 가능" : "경작중"}`}
                      onClick={() => isSelectable && toggleBed(bed.id)}
                      disabled={!isSelectable}
                    >
                      {shapePath && (
                        <svg aria-hidden="true" className="zone-bed-shape-svg" preserveAspectRatio="none" viewBox="0 0 100 100">
                          <path d={shapePath} />
                        </svg>
                      )}
                      <strong>{label}</strong>
                    </button>
                  );
                })}
              </div>
            </article>
          )}
          {fallowBeds.length === 0 && <p className="empty-text">이 Zone에는 선택 가능한 휴경 틀이 없습니다.</p>}
        </div>
        {error && <p className="form-error">{error}</p>}
        <button className="primary-button wide" type="submit" disabled={selectedBedIds.length === 0}>관리그룹 및 관리표 생성</button>
      </form>
    </div>
  );
}
