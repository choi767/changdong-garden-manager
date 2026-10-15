import type { AppData, Bed, Zone } from "../entities/models";
import { nowIso } from "../../utils/id";

// Percent coordinates traced from the supplied Zone 6 plan.
export const zone6MapLayout: Record<string, { left: number; top: number; width: number; height: number }> = {
  1: { left: 24.8, top: 3.7, width: 6.5, height: 44.4 },
  2: { left: 33.5, top: 3.7, width: 6.5, height: 44.4 },
  3: { left: 42.6, top: 3.7, width: 6.7, height: 75.6 },
  4: { left: 51.8, top: 3.7, width: 6.5, height: 92.7 },
  5: { left: 60.9, top: 3.7, width: 6.5, height: 92.7 },
  6: { left: 69.9, top: 3.7, width: 6.5, height: 83.4 },
  7: { left: 79, top: 3.7, width: 6.5, height: 76.8 },
  8: { left: 88.9, top: 3.7, width: 6.5, height: 71.5 },
  9: { left: 3.3, top: 55.9, width: 21.6, height: 10 },
  10: { left: 3.3, top: 71.2, width: 21.6, height: 10.2 }
};

export function ensureZone6(data: AppData): AppData {
  const timestamp = nowIso();
  const existingZone = data.zones.find((zone) => zone.zoneNumber === 6);
  const zone: Zone = existingZone ?? {
    id: "zone_6", zoneNumber: 6, name: "Zone 6 (염호리)", description: "염호리 틀밭 구역",
    isActive: true, createdAt: timestamp, updatedAt: timestamp
  };
  const additions: Bed[] = Object.entries(zone6MapLayout).flatMap(([number, position]) => {
    const bedNumber = Number(number);
    if (data.beds.some((bed) => bed.zoneNumber === 6 && bed.bedNumber === bedNumber)) return [];
    return [{
      id: `bed_6_${bedNumber}`, zoneId: zone.id, zoneNumber: 6, bedNumber,
      displayCode: `6-${bedNumber}`, status: "FALLOW" as const,
      positionX: position.left, positionY: position.top, width: position.width, height: position.height,
      rotation: 0, zIndex: bedNumber, isActive: true, createdAt: timestamp, updatedAt: timestamp
    }];
  });
  return { ...data, zones: existingZone ? data.zones : [...data.zones, zone], beds: [...data.beds, ...additions] };
}
