import { FormEvent, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import StatusPill from "../../components/common/StatusPill";
import { bedStatusLabel } from "../../domain/enums/status";
import { getActiveGroupForBedId, getBedLabelList, getCurrentBedsForGroup, getGroupSheet } from "../../domain/services/selectors";
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
  },
  4: {
    1: { left: 8, top: 8, width: 14, height: 18.7 },
    2: { left: 32, top: 8, width: 14, height: 18.7 },
    3: { left: 56, top: 8, width: 14, height: 18.7 },
    4: { left: 80, top: 8, width: 14, height: 18.7 },
    5: { left: 8, top: 40.5, width: 14, height: 18.7 },
    6: { left: 32, top: 40.5, width: 14, height: 18.7 },
    7: { left: 56, top: 40.5, width: 14, height: 18.7 },
    8: { left: 80, top: 40.5, width: 14, height: 18.7 },
    9: { left: 8, top: 73, width: 14, height: 18.7 },
    10: { left: 32, top: 73, width: 14, height: 18.7 },
    11: { left: 56, top: 73, width: 14, height: 18.7 },
    12: { left: 80, top: 73, width: 14, height: 18.7 }
  }
};

function fallbackMapPosition(bedNumber: number, zoneNumber: number): MapPosition {
  const cols = zoneNumber === 2 ? 7 : 6;
  const row = Math.floor((bedNumber - 1) / cols);
  const col = (bedNumber - 1) % cols;
  return {
    left: 3 + col * (94 / cols),
    top: 16 + row * 12.5,
    width: 86 / cols,
    height: 10.5
  };
}

function bedMapKey(displayCode: string, zoneNumber: number, bedNumber: number): string {
  const prefix = `${zoneNumber}-`;
  return displayCode.startsWith(prefix) ? displayCode.slice(prefix.length) : String(bedNumber);
}

function bedMapLabel(displayCode: string, zoneNumber: number, bedNumber: number): string {
  return bedMapKey(displayCode, zoneNumber, bedNumber);
}

function displayOrder(label: string): number {
  const match = label.match(/^(\d+)(?:-([a-d]))?$/);
  if (!match) return Number.MAX_SAFE_INTEGER;
  const base = Number(match[1]);
  const suffixOrder = match[2] ? match[2].charCodeAt(0) - 96 : 0;
  return base * 10 + suffixOrder;
}

function mapPositionFor(zoneNumber: number, key: string, position: MapPosition): MapPosition {
  if (zoneNumber !== 2 || key === "43" || Number(key) > 43 || key.includes("-")) return position;
  return {
    ...position,
    top: position.top * 0.86,
    height: position.height * 0.86
  };
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

export default function HomePage() {
  const data = useGardenStore((state) => state.data);
  const navigate = useNavigate();
  const [highlightGroupId, setHighlightGroupId] = useState<string | null>(null);
  const [searchZone, setSearchZone] = useState("");
  const [searchGroup, setSearchGroup] = useState("");
  const [searchMessage, setSearchMessage] = useState("");
  const bedButtonRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  if (!data) return <div className="page"><p>데이터를 준비하고 있습니다.</p></div>;

  const appData = data;
  const activeGroups = appData.managementGroups
    .filter((group) => group.status === "ACTIVE")
    .sort((a, b) => a.zoneNumber - b.zoneNumber || a.groupNumber - b.groupNumber);
  const mapZones = appData.zones.filter((zone) => appData.beds.some((bed) => bed.zoneId === zone.id));

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

  async function onFindGroup(event: FormEvent) {
    event.preventDefault();
    const zoneNumber = Number(searchZone);
    const groupNumber = Number(searchGroup);

    if (!zoneNumber || !groupNumber) {
      setSearchMessage("존번호와 그룹번호를 입력하세요.");
      return;
    }

    const group = activeGroups.find((item) => item.zoneNumber === zoneNumber && item.groupNumber === groupNumber);
    if (!group) {
      setHighlightGroupId(null);
      setSearchMessage(`Z${zoneNumber}-G${groupNumber} 활성 관리그룹이 없습니다.`);
      return;
    }

    const beds = getCurrentBedsForGroup(appData, group.id);
    const firstBed = beds[0];
    setSearchMessage(`${group.displayCode} 찾았습니다.`);
    setHighlightGroupId(group.id);
    window.setTimeout(() => {
      if (firstBed) {
        bedButtonRefs.current[firstBed.id]?.scrollIntoView({ behavior: "smooth", block: "start", inline: "nearest" });
      }
    }, 40);
    await wait(2500);
    setHighlightGroupId((current) => (current === group.id ? null : current));
  }

  async function onMapBedClick(bedId: string) {
    const bed = appData.beds.find((item) => item.id === bedId);
    if (!bed) return;
    const activeGroup = getActiveGroupForBedId(appData, bed.id);
    if (!activeGroup) {
      navigate(`/beds/${bed.id}`);
      return;
    }

    const sheet = getGroupSheet(appData, activeGroup.id);
    const groupBeds = getCurrentBedsForGroup(appData, activeGroup.id);
    setHighlightGroupId(activeGroup.id);
    await wait(2000);
    const shouldMove = window.confirm(`${activeGroup.displayCode} (${getBedLabelList(groupBeds)}) 관리표 상세보기로 이동할까요?`);
    setHighlightGroupId(null);
    if (shouldMove && sheet) navigate(`/sheets/${sheet.id}`);
  }

  return (
    <div className="page home-page">
      <div className="home-fixed-top">
        <header className="home-header">
          <p className="home-welcome">정원에 오신 느낌으로...</p>
          <h1>창동 틀밭 농장</h1>
          <p className="home-subtitle">당신의 경작틀, 식물과 작업내용을 관리합니다</p>
          <p className="home-version">틀밭관리 v2.1</p>
        </header>

        <form className="home-find-form" onSubmit={(event) => void onFindGroup(event)}>
          <label>
            <input
              type="number"
              min="1"
              inputMode="numeric"
              value={searchZone}
              onChange={(event) => setSearchZone(event.target.value)}
              aria-label="존번호"
              placeholder="존"
            />
          </label>
          <label>
            <input
              type="number"
              min="1"
              inputMode="numeric"
              value={searchGroup}
              onChange={(event) => setSearchGroup(event.target.value)}
              aria-label="그룹번호"
              placeholder="그룹"
            />
          </label>
          <button type="submit" className="primary-button">찾기</button>
          {searchMessage && <p className="home-find-message">{searchMessage}</p>}
        </form>
      </div>

      <div className="home-scroll-area">
        <section className="home-map-section">
          <div className="garden-map zone-map-shell" aria-label="틀밭 배치도">
            <div className="zone-map-list">
              {mapZones.map((zone) => {
                const zoneBeds = appData.beds
                  .filter((bed) => bed.zoneId === zone.id)
                  .sort((a, b) => displayOrder(bedMapLabel(a.displayCode, zone.zoneNumber, a.bedNumber)) - displayOrder(bedMapLabel(b.displayCode, zone.zoneNumber, b.bedNumber)));
                const zoneLayout = zoneMapLayouts[zone.zoneNumber];

                return (
                  <article className={`zone-map-board ${zoneLayout ? "zone-map-drawn" : "zone-map-fallback"}`} key={zone.id}>
                    <div className="zone-map-heading">
                      <h3>Zone {zone.zoneNumber}</h3>
                      <div className="zone-map-legend" aria-label="범례">
                        <span><i className="legend-box active" />경작</span>
                        <span><i className="legend-box fallow" />휴경</span>
                      </div>
                    </div>
                    <div className={`zone-map-canvas zone-map-canvas-z${zone.zoneNumber}`}>
                      {zoneBeds.map((bed) => {
                        const activeGroup = getActiveGroupForBedId(appData, bed.id);
                        const isHighlighted = activeGroup?.id === highlightGroupId;
                        const label = bedMapLabel(bed.displayCode, zone.zoneNumber, bed.bedNumber);
                        const mapStatus = activeGroup ? "ACTIVE" : bed.status;
                        const position = mapPositionFor(zone.zoneNumber, label, zoneLayout?.[label] ?? fallbackMapPosition(bed.bedNumber, zone.zoneNumber));
                        const shapePath = zone.zoneNumber === 2 ? zone2ShapePaths[label] : undefined;
                        const isZone2Sector = zone.zoneNumber === 2 && label.startsWith("43-");
                        return (
                          <button
                            key={bed.id}
                            ref={(element) => {
                              bedButtonRefs.current[bed.id] = element;
                            }}
                            type="button"
                            className={`bed-overlay zone-bed-overlay ${shapePath ? `zone-bed-shape zone-bed-shape-${label}` : ""} ${isZone2Sector ? `zone-bed-sector zone-bed-sector-${label.slice(-1)}` : ""} ${zone.zoneNumber === 2 && label === "24" ? "zone-bed-wide-center" : ""} ${zone.zoneNumber === 2 && label === "43" ? "zone-bed-round" : ""} ${mapStatus.toLowerCase()} ${isHighlighted ? "highlight pulse" : ""}`}
                            style={{
                              left: `${position.left}%`,
                              top: `${position.top}%`,
                              width: `${position.width}%`,
                              height: `${position.height}%`,
                              zIndex: zone.zoneNumber === 2 && label === "43" ? 6 : zone.zoneNumber === 2 && label.startsWith("43-") ? 5 : Math.min(bed.zIndex, 50)
                            }}
                            title={`${bed.displayCode} ${bedStatusLabel[mapStatus]}`}
                            onClick={() => void onMapBedClick(bed.id)}
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
                    {zone.zoneNumber === 4 && <p className="zone-training-note">연습용 구역 입니다</p>}
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        <section className="home-summary-section">
          <aside className="summary-panel">
            <h2>활성 관리그룹</h2>
            <div className="home-group-list">
              {activeGroups.map((group) => {
                const beds = getCurrentBedsForGroup(appData, group.id);
                const sheet = getGroupSheet(appData, group.id);
                return (
                  <article className="home-group-row" key={group.id} onMouseEnter={() => setHighlightGroupId(group.id)} onMouseLeave={() => setHighlightGroupId(null)} onClick={() => sheet && navigate(`/sheets/${sheet.id}`)}>
                    <div className="home-group-main">
                      <strong>{group.displayCode}</strong>
                      <span>{getBedLabelList(beds)}</span>
                    </div>
                    <small>관리시작 {group.startDate} <span className="group-plant-names">({groupPlantNames(group.id)})</span></small>
                    <StatusPill status={group.status} />
                  </article>
                );
              })}
              {activeGroups.length === 0 && <p className="empty-text">현재 관리 중인 그룹이 없습니다.</p>}
            </div>
          </aside>
        </section>
      </div>
    </div>
  );
}


