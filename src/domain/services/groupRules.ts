import type { AppData, Bed, ManagementGroup, ManagementGroupBedMembership } from "../entities/models";

export function getCurrentMemberships(data: AppData, groupId: string): ManagementGroupBedMembership[] {
  return data.memberships.filter((membership) => membership.managementGroupId === groupId && membership.isCurrent && !membership.removedAt);
}

export function getActiveGroupForBed(data: AppData, bedId: string): ManagementGroup | null {
  const current = data.memberships.find((membership) => membership.bedId === bedId && membership.isCurrent && !membership.removedAt);
  if (!current) return null;
  return data.managementGroups.find((group) => group.id === current.managementGroupId && group.status === "ACTIVE") ?? null;
}

export function getNextGroupNumber(groups: ManagementGroup[], zoneId: string): number {
  const used = groups.filter((group) => group.zoneId === zoneId).map((group) => group.groupNumber);
  return used.length === 0 ? 1 : Math.max(...used) + 1;
}

export function validateGroupBedSelection(beds: Bed[]): string | null {
  if (beds.length === 0) return "관리그룹에는 최소 하나 이상의 틀이 필요합니다.";
  const firstZoneId = beds[0].zoneId;
  if (beds.some((bed) => bed.zoneId !== firstZoneId)) return "관리그룹에는 같은 Zone의 틀만 선택할 수 있습니다.";
  if (beds.some((bed) => !bed.isActive)) return "비활성 틀은 선택할 수 없습니다.";
  if (beds.some((bed) => bed.status !== "FALLOW")) return "휴경 틀만 선택할 수 있습니다.";
  return null;
}

export function validateAddBedsToGroup(data: AppData, group: ManagementGroup, beds: Bed[]): string | null {
  if (group.status !== "ACTIVE") return "종료된 관리그룹에는 틀을 추가할 수 없습니다.";
  if (beds.length === 0) return "추가할 틀을 선택해 주세요.";
  if (beds.some((bed) => bed.zoneId !== group.zoneId)) return "다른 Zone의 틀은 추가할 수 없습니다.";
  if (beds.some((bed) => bed.status !== "FALLOW")) return "휴경 틀만 추가할 수 있습니다.";
  if (beds.some((bed) => getActiveGroupForBed(data, bed.id))) return "다른 활성 관리그룹에서 사용 중인 틀은 추가할 수 없습니다.";
  return null;
}

export function validateRemoveBedsFromGroup(data: AppData, groupId: string, bedIds: string[]): string | null {
  const current = getCurrentMemberships(data, groupId);
  if (bedIds.length === 0) return "삭제할 틀을 선택해 주세요.";
  if (current.length - bedIds.length < 1) {
    return "관리그룹에는 최소 하나 이상의 틀이 필요합니다. 마지막 틀은 삭제할 수 없습니다.";
  }
  return null;
}
