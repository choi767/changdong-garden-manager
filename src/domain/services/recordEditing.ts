import type { AppData } from "../entities/models";

export type EditableRecordKind = "scheduleReminders" | "workLogs" | "observationMemos" | "pestRecords" | "harvestRecords" | "photos" | "materialUsages" | "sheetEvaluations";
export interface RecordField {
  key: string;
  label: string;
  type?: "date" | "number" | "textarea";
  required?: boolean;
  options?: string[];
}
export const recordEditors: Record<EditableRecordKind, { title: string; fields: RecordField[] }> = {
  scheduleReminders: { title: "작업일정", fields: [
    { key: "dueDate", label: "예정 날짜", type: "date", required: true },
    { key: "category", label: "작업 종류", required: true },
    { key: "content", label: "일정 내용", type: "textarea" }
  ] },
  workLogs: { title: "작업이력", fields: [
    { key: "workDate", label: "작업 날짜", type: "date", required: true },
    { key: "workType", label: "작업 종류", required: true },
    { key: "content", label: "작업 내용", type: "textarea" },
    { key: "author", label: "작성자" }
  ] },
  observationMemos: { title: "관찰기록", fields: [
    { key: "observedDate", label: "관찰 날짜", type: "date", required: true },
    { key: "content", label: "관찰 내용", type: "textarea" }
  ] },
  pestRecords: { title: "병해충기록", fields: [
    { key: "detectedDate", label: "발견 날짜", type: "date", required: true },
    { key: "pestType", label: "병해충명" },
    { key: "severity", label: "피해 정도", options: ["낮음", "보통", "높음"] },
    { key: "symptom", label: "증상", type: "textarea" },
    { key: "action", label: "조치 내용", type: "textarea" }
  ] },
  harvestRecords: { title: "수확기록", fields: [
    { key: "harvestDate", label: "수확 날짜", type: "date", required: true },
    { key: "quantity", label: "수확량", type: "number", required: true },
    { key: "unit", label: "단위", required: true, options: ["개", "g", "Kg", "묶음(100개)", "박스"] },
    { key: "quality", label: "품질", options: ["좋음", "보통", "나쁨", "혼합"] },
    { key: "notes", label: "수확 메모", type: "textarea" }
  ] },
  photos: { title: "사진기록", fields: [
    { key: "photoDate", label: "사진 날짜", type: "date", required: true },
    { key: "description", label: "사진 설명", type: "textarea" }
  ] },
  sheetEvaluations: { title: "요약/평가", fields: [
    { key: "evaluatedAt", label: "평가일", type: "date", required: true },
    { key: "rating", label: "평가", options: ["좋음", "보통", "아쉬움", "실패"] },
    { key: "summary", label: "전체 요약", type: "textarea" },
    { key: "improvement", label: "다음 개선점", type: "textarea" }
  ] },
  materialUsages: { title: "비용/자재사용", fields: [
    { key: "usedDate", label: "사용일", type: "date", required: true },
    { key: "itemName", label: "자재명", required: true },
    { key: "quantity", label: "사용량", type: "number", required: true },
    { key: "unit", label: "단위", required: true, options: ["개", "kg", "g", "포", "봉", "m", "원"] },
    { key: "cost", label: "비용", type: "number", required: true },
    { key: "memo", label: "메모", type: "textarea" }
  ] }
};

// Return only editable fields, keeping record identity, batch and photo data intact.
export function makeRecordPatch(data: AppData, kind: EditableRecordKind, sheetId: string, values: Record<string, string>): Record<string, string | number | null> {
  const patch: Record<string, string | number | null> = {};
  for (const field of recordEditors[kind].fields) {
    const value = (values[field.key] ?? "").trim();
    if (field.required && !value) throw new Error(`${field.label}을(를) 입력해 주세요.`);
    if (field.type === "number") {
      const number = Number(value);
      if (!Number.isFinite(number) || number < 0) throw new Error(`${field.label}은(는) 0 이상의 숫자로 입력해 주세요.`);
      patch[field.key] = number;
    } else {
      if (field.type === "date" && (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0, 10) !== value)) {
        throw new Error("올바른 날짜를 입력해 주세요.");
      }
      patch[field.key] = value;
    }
  }
  if (kind !== "materialUsages" && kind !== "sheetEvaluations") {
    const plantId = values.managementSheetPlantId || null;
    if (plantId && !data.sheetPlants.some((plant) => plant.id === plantId && plant.managementSheetId === sheetId)) {
      throw new Error("이 관리표에 속한 식물을 선택해 주세요.");
    }
    patch.managementSheetPlantId = plantId;
  }
  return patch;
}
