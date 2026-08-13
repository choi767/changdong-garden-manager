import type { AppData, Bed, Zone } from "../entities/models";
import { nowIso } from "../../utils/id";

interface BedSpec {
  bedNumber: number;
  displayCode?: string;
}

const zone2BedSpecs: BedSpec[] = [
  ...Array.from({ length: 43 }, (_, index) => ({ bedNumber: index + 1 })),
  { bedNumber: 431, displayCode: "2-43-a" },
  { bedNumber: 432, displayCode: "2-43-b" },
  { bedNumber: 433, displayCode: "2-43-c" },
  { bedNumber: 434, displayCode: "2-43-d" },
  ...Array.from({ length: 6 }, (_, index) => ({ bedNumber: 44 + index }))
];

function createZone(zoneNumber: number): Zone {
  const timestamp = nowIso();
  return {
    id: `zone_${zoneNumber}`,
    zoneNumber,
    name: `Zone ${zoneNumber}`,
    description: zoneNumber <= 3 ? "초기 등록 틀밭 구역" : "향후 틀 개수 확정 예정",
    isActive: true,
    createdAt: timestamp,
    updatedAt: timestamp
  };
}

function bedLayout(zoneNumber: number, bedNumber: number, count: number): Pick<Bed, "positionX" | "positionY" | "width" | "height" | "rotation" | "zIndex"> {
  const cols = zoneNumber === 1 ? 6 : zoneNumber === 2 ? 7 : zoneNumber === 3 ? 5 : 4;
  const row = Math.floor((bedNumber - 1) / cols);
  const col = (bedNumber - 1) % cols;
  const zoneTop = zoneNumber === 1 ? 8 : zoneNumber === 2 ? 48 : zoneNumber === 3 ? 8 : 48;
  const zoneLeft = zoneNumber === 1 || zoneNumber === 2 ? 5 : 62;
  const width = Math.min(8.5, 42 / cols);
  const height = Math.min(6, 28 / Math.max(1, Math.ceil(count / cols)));
  return {
    positionX: zoneLeft + col * (width + 1),
    positionY: zoneTop + row * (height + 1.1),
    width,
    height,
    rotation: 0,
    zIndex: bedNumber
  };
}

function createBeds(zone: Zone, count: number): Bed[] {
  const timestamp = nowIso();
  return createBedsFromSpecs(
    zone,
    Array.from({ length: count }, (_, index) => ({ bedNumber: index + 1 })),
    timestamp
  );
}

function createBedsFromSpecs(zone: Zone, specs: BedSpec[], timestamp = nowIso()): Bed[] {
  return specs.map((spec) => {
    const bedNumber = spec.bedNumber;
    const displayCode = spec.displayCode ?? `${zone.zoneNumber}-${bedNumber}`;
    return {
      id: `bed_${zone.zoneNumber}_${bedNumber}`,
      zoneId: zone.id,
      zoneNumber: zone.zoneNumber,
      bedNumber,
      displayCode,
      status: "FALLOW",
      ...bedLayout(zone.zoneNumber, bedNumber, specs.length),
      isActive: true,
      createdAt: timestamp,
      updatedAt: timestamp
    };
  });
}

export function createInitialData(): AppData {
  const zones = [1, 2, 3, 4].map(createZone);
  const beds = [
    ...createBeds(zones[0], 24),
    ...createBedsFromSpecs(zones[1], zone2BedSpecs),
    ...createBeds(zones[2], 10)
  ];

  return {
    zones,
    beds,
    managementGroups: [],
    memberships: [],
    plants: [],
    managementSheets: [],
    sheetPlants: [],
    workLogs: [],
    harvestRecords: [],
    photos: [],
    scheduleReminders: [],
    observationMemos: [],
    pestRecords: [],
    materialUsages: [],
    sheetEvaluations: [],
    statusHistories: [],
    appSettings: [
      { id: "setting_map_title", key: "mapTitle", value: "창동 틀밭 전체 배치도", updatedAt: nowIso() }
    ],
    backgroundImages: []
  };
}
