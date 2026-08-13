export type BedStatus = "FALLOW" | "ACTIVE";
export type GroupStatus = "ACTIVE" | "CLOSED";
export type SheetStatus = "ACTIVE" | "CLOSED";
export type Sunlight = "FULL" | "PARTIAL" | "SHADE" | "UNKNOWN";
export type PlantingMethod = "SEED" | "SEEDLING" | "OTHER";
export type CultivationStatus = "PLANNED" | "GROWING" | "HARVESTED" | "STOPPED";

export const bedStatusLabel: Record<BedStatus, string> = {
  FALLOW: "휴경",
  ACTIVE: "경작중"
};

export const groupStatusLabel: Record<GroupStatus, string> = {
  ACTIVE: "관리중",
  CLOSED: "관리종료"
};

export const sunlightLabel: Record<Sunlight, string> = {
  FULL: "양지",
  PARTIAL: "반양지",
  SHADE: "음지",
  UNKNOWN: "미지정"
};

export const plantingMethodLabel: Record<PlantingMethod, string> = {
  SEED: "파종",
  SEEDLING: "묘종",
  OTHER: "기타"
};

export const cultivationStatusLabel: Record<CultivationStatus, string> = {
  PLANNED: "재배 예정",
  GROWING: "재배중",
  HARVESTED: "수확 완료",
  STOPPED: "재배 중단"
};
