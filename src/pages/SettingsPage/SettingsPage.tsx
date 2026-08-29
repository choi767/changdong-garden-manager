import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";
import { Download, RefreshCcw, Trash2, Upload } from "lucide-react";
import type { Plant, PlantCategory } from "../../domain/entities/models";
import { sunlightLabel, type Sunlight } from "../../domain/enums/status";
import { getSupabaseClient } from "../../infrastructure/supabaseClient";
import { useGardenStore } from "../../stores/gardenStore";

const ADMIN_EMAILS = ["wchoi58@gmail.com"];

function normalizeEmail(value: string | undefined): string {
  return (value ?? "").trim().toLocaleLowerCase("en-US");
}

const PLANT_EXCEL_COLUMNS = [
  "식물ID",
  "식물명",
  "분류",
  "파종시기(남부)",
  "묘종식재시기(남부)",
  "예상수확시기",
  "일조조건",
  "물주기",
  "꽃피는시기",
  "꽃색깔",
  "키(cm)",
  "덩굴식물여부",
  "밑거름",
  "추비",
  "기타(특이사항)",
  "최초등록일",
  "최종수정일",
  "등록자/수정자",
  "사진데이터",
  "사진형식",
  "사진크기"
] as const;

const plantCategoryLabel: Record<PlantCategory, string> = {
  CROP: "농작물",
  FLOWER: "화초",
  TREE: "나무"
};

function csvCell(value: string | number | boolean | null | undefined): string {
  const text = String(value ?? "");
  return `"${text.replace(/"/g, '""')}"`;
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  const source = text.replace(/^\uFEFF/, "");
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    const next = source[index + 1];
    if (quoted) {
      if (char === '"' && next === '"') {
        cell += '"';
        index += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        cell += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      row.push(cell);
      cell = "";
    } else if (char === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else if (char !== "\r") {
      cell += char;
    }
  }
  row.push(cell);
  if (row.some((value) => value.trim())) rows.push(row);
  return rows;
}

function exportPlantsCsv(plants: Plant[]): string {
  const rows = [
    PLANT_EXCEL_COLUMNS.join(","),
    ...plants.map((plant) => [
      plant.id,
      plant.name,
      plantCategoryLabel[plant.category ?? "CROP"],
      plant.plantingPeriod,
      plant.seedlingPlantingPeriod ?? "",
      plant.harvestPeriod,
      plant.sunlight ? sunlightLabel[plant.sunlight] : "미지정",
      plant.watering,
      plant.floweringPeriod,
      plant.flowerColor,
      plant.plantHeight,
      plant.isVine ? "덩굴" : "아님",
      plant.compoundFertilizer,
      plant.topDressing,
      plant.notes,
      plant.createdAt,
      plant.updatedAt,
      plant.author,
      plant.imageDataUrl,
      plant.imageMimeType,
      plant.imageFileSize
    ].map(csvCell).join(","))
  ];
  return `\uFEFF${rows.join("\r\n")}`;
}

function categoryFromCsv(value: string): PlantCategory {
  const text = value.trim().toLocaleLowerCase("ko-KR");
  if (text === "flower" || text === "화초") return "FLOWER";
  if (text === "tree" || text === "나무") return "TREE";
  return "CROP";
}

function sunlightFromCsv(value: string): Sunlight {
  const text = value.trim().toLocaleLowerCase("ko-KR");
  if (text === "full" || text === "양지") return "FULL";
  if (text === "partial" || text === "반양지") return "PARTIAL";
  if (text === "shade" || text === "음지") return "SHADE";
  return "UNKNOWN";
}

function parsePlantsCsv(text: string): Plant[] {
  const rows = parseCsv(text);
  if (rows.length < 2) throw new Error("식물DB 엑셀 백업 파일에 데이터가 없습니다.");
  const headers = rows[0].map((value) => value.trim());
  const get = (row: string[], name: typeof PLANT_EXCEL_COLUMNS[number]) => row[headers.indexOf(name)] ?? "";
  return rows.slice(1).filter((row) => row.some((value) => value.trim())).map((row) => ({
    id: get(row, "식물ID"),
    name: get(row, "식물명"),
    normalizedName: "",
    category: categoryFromCsv(get(row, "분류")),
    plantingPeriod: get(row, "파종시기(남부)"),
    seedlingPlantingPeriod: get(row, "묘종식재시기(남부)"),
    harvestPeriod: get(row, "예상수확시기"),
    floweringPeriod: get(row, "꽃피는시기"),
    flowerColor: get(row, "꽃색깔"),
    plantHeight: get(row, "키(cm)"),
    isVine: ["덩굴", "예", "yes", "true", "1"].includes(get(row, "덩굴식물여부").trim().toLocaleLowerCase("ko-KR")),
    compoundFertilizer: get(row, "밑거름"),
    oilCakeFertilizer: "",
    specializedFertilizer: "",
    topDressing: get(row, "추비"),
    watering: get(row, "물주기"),
    sunlight: sunlightFromCsv(get(row, "일조조건")),
    notes: get(row, "기타(특이사항)"),
    imageDataUrl: get(row, "사진데이터"),
    imageMimeType: get(row, "사진형식"),
    imageFileSize: Number(get(row, "사진크기")) || 0,
    author: get(row, "등록자/수정자") || "사용자",
    createdAt: get(row, "최초등록일"),
    updatedAt: get(row, "최종수정일")
  }));
}

export default function SettingsPage() {
  const data = useGardenStore((state) => state.data);
  const updateBedLayout = useGardenStore((state) => state.updateBedLayout);
  const resetData = useGardenStore((state) => state.resetData);
  const deleteAllPlants = useGardenStore((state) => state.deleteAllPlants);
  const replacePlants = useGardenStore((state) => state.replacePlants);
  const mergePlants = useGardenStore((state) => state.mergePlants);
  const exportJson = useGardenStore((state) => state.exportJson);
  const importJson = useGardenStore((state) => state.importJson);
  const [bedId, setBedId] = useState("");
  const [error, setError] = useState("");
  const [showAdminTools, setShowAdminTools] = useState(false);
  const [userEmail, setUserEmail] = useState("");
  const [layout, setLayout] = useState({ positionX: "0", positionY: "0", width: "5", height: "5", rotation: "0" });
  const isAdmin = ADMIN_EMAILS.includes(normalizeEmail(userEmail));

  useEffect(() => {
    const client = getSupabaseClient();
    if (!client) {
      setUserEmail(ADMIN_EMAILS[0]);
      return;
    }
    let mounted = true;
    void client.auth.getUser().then(({ data }) => {
      if (mounted) setUserEmail(data.user?.email ?? "");
    });
    const { data: listener } = client.auth.onAuthStateChange((_event, session) => {
      setUserEmail(session?.user.email ?? "");
    });
    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  const zoneRows = useMemo(() => {
    if (!data) return [];
    return [...data.zones]
      .sort((a, b) => a.zoneNumber - b.zoneNumber)
      .map((zone) => ({
        zone,
        bedCount: data.beds.filter((bed) => bed.zoneId === zone.id).length,
        activeBedCount: data.beds.filter((bed) => bed.zoneId === zone.id && bed.status === "ACTIVE").length
      }));
  }, [data]);

  if (!data) return null;
  const appData = data;
  const bed = appData.beds.find((item) => item.id === bedId);
  const bedSummary = zoneRows.map((row) => `Zone${row.zone.zoneNumber} ${row.bedCount}개`).join(", ");

  function selectBed(id: string) {
    const selected = appData.beds.find((item) => item.id === id);
    setBedId(id);
    if (selected) {
      setLayout({
        positionX: String(selected.positionX),
        positionY: String(selected.positionY),
        width: String(selected.width),
        height: String(selected.height),
        rotation: String(selected.rotation)
      });
    }
  }

  async function onSaveLayout(event: FormEvent) {
    event.preventDefault();
    if (!window.confirm("틀 좌표를 수정하시겠습니까?")) return;
    setError("");
    try {
      await updateBedLayout(bedId, {
        positionX: Number(layout.positionX),
        positionY: Number(layout.positionY),
        width: Number(layout.width),
        height: Number(layout.height),
        rotation: Number(layout.rotation)
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "좌표 저장에 실패했습니다.");
    }
  }

  async function onExport() {
    const json = await exportJson();
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `changdong-garden-v2.2-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function onExportPlantsExcel() {
    const csv = exportPlantsCsv(appData.plants);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `changdong-plant-db-v2.2-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function onImport(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setError("");
    if (!isAdmin) {
      setError("관리자만 JSON 복원을 실행할 수 있습니다.");
      event.target.value = "";
      return;
    }
    try {
      await importJson(await file.text());
    } catch (err) {
      setError(err instanceof Error ? err.message : "백업 가져오기에 실패했습니다.");
    } finally {
      event.target.value = "";
    }
  }

  async function onImportPlantsExcel(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setError("");
    if (!isAdmin) {
      setError("관리자만 엑셀복원(식물DB)을 실행할 수 있습니다.");
      event.target.value = "";
      return;
    }
    if (!window.confirm("식물DB를 엑셀 백업 파일 내용으로 복원하시겠습니까?\n기존 식물DB가 백업 파일 내용으로 교체됩니다.")) {
      event.target.value = "";
      return;
    }
    try {
      await replacePlants(parsePlantsCsv(await file.text()));
    } catch (err) {
      setError(err instanceof Error ? err.message : "식물DB 엑셀 복원에 실패했습니다.");
    } finally {
      event.target.value = "";
    }
  }

  async function onImportPlantsExcelPartial(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setError("");
    if (!isAdmin) {
      setError("관리자만 엑셀 부분복원(식물DB)을 실행할 수 있습니다.");
      event.target.value = "";
      return;
    }
    if (!window.confirm("CSV 파일에 들어있는 식물만 현재 식물DB에 부분 반영하시겠습니까?\n나머지 식물은 그대로 유지됩니다.")) {
      event.target.value = "";
      return;
    }
    try {
      await mergePlants(parsePlantsCsv(await file.text()));
    } catch (err) {
      setError(err instanceof Error ? err.message : "식물DB 엑셀 부분복원에 실패했습니다.");
    } finally {
      event.target.value = "";
    }
  }

  async function onResetDevelopmentData() {
    if (!isAdmin) {
      setError("관리자만 개발용 초기화를 실행할 수 있습니다.");
      return;
    }
    if (!window.confirm("개발용 초기화를 실행하시겠습니까?\n관리그룹, 관리표, 작업/일정/사진/수확 등 기록은 초기화되지만 식물DB는 보존됩니다.")) return;
    await resetData();
  }

  async function onDeleteAllPlants() {
    if (!isAdmin) {
      setError("관리자만 식물DB 전체삭제를 실행할 수 있습니다.");
      return;
    }
    if (!window.confirm("식물DB 전체를 삭제하시겠습니까?\n등록된 식물과 관리표의 식물 연결 정보가 삭제됩니다.")) return;
    if (!window.confirm("정말 삭제하시겠습니까? 이 작업은 JSON 백업 없이는 되돌릴 수 없습니다.")) return;
    await deleteAllPlants();
  }

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <p className="eyebrow">설정</p>
          <h1>데이터 및 배치 좌표 관리</h1>
        </div>
      </header>
      {error && <p className="form-error">{error}</p>}

      <section className="dashboard-grid">
        <article className="panel">
          <h2>Zone / 틀 현황</h2>
          <dl className="info-grid">
            <dt>Zone</dt><dd>{data.zones.length}개</dd>
            <dt>전체 틀</dt><dd>{data.beds.length}개 ({bedSummary})</dd>
            <dt>활성 관리그룹</dt><dd>{data.managementGroups.filter((group) => group.status === "ACTIVE").length}개</dd>
            <dt>식물DB</dt><dd>{data.plants.length}개</dd>
          </dl>
          <div className="timeline compact-list">
            {zoneRows.map((row) => (
              <p key={row.zone.id}>
                Zone {row.zone.zoneNumber}: 전체 {row.bedCount}개 · 경작중 {row.activeBedCount}개 · 휴경 {row.bedCount - row.activeBedCount}개
              </p>
            ))}
          </div>
        </article>

        <article className="panel">
          <h2>백업 / 복원</h2>
          <div className="button-row">
            <button className="primary-button" type="button" onClick={() => void onExport()}><Download size={18} /> JSON 백업(전체)</button>
            <button className="secondary-button" type="button" onClick={onExportPlantsExcel}><Download size={18} /> 엑셀백업(식물DB)</button>
          </div>
          <label className="admin-toggle">
            <input type="checkbox" checked={showAdminTools && isAdmin} disabled={!isAdmin} onChange={(event) => setShowAdminTools(event.target.checked)} />
            관리자 기능 보기
          </label>
          <p className={isAdmin ? "hint" : "admin-warning"}>{isAdmin ? `관리자 계정: ${userEmail}` : "관리자 계정으로 로그인해야 복원/초기화/전체삭제를 실행할 수 있습니다."}</p>
          {showAdminTools && isAdmin && (
            <div className="admin-tools">
              <label className="secondary-button file-button">
                <Upload size={18} /> JSON 복원(전체)
                <input type="file" accept="application/json" onChange={(event) => void onImport(event)} />
              </label>
              <label className="secondary-button file-button">
                <Upload size={18} /> 엑셀복원(식물DB 전체교체)
                <input type="file" accept=".csv,text/csv" onChange={(event) => void onImportPlantsExcel(event)} />
              </label>
              <label className="secondary-button file-button">
                <Upload size={18} /> 엑셀 부분복원(식물DB)
                <input type="file" accept=".csv,text/csv" onChange={(event) => void onImportPlantsExcelPartial(event)} />
              </label>
              <button className="danger-button" type="button" onClick={() => void onDeleteAllPlants()}><Trash2 size={18} /> 식물DB 전체삭제</button>
              <button className="danger-button" type="button" onClick={() => void onResetDevelopmentData()}><RefreshCcw size={18} /> 개발용 초기화</button>
            </div>
          )}
        </article>
      </section>

      {isAdmin && showAdminTools && (
        <section className="panel">
          <h2>틀 배치 좌표 편집</h2>
          <form className="layout-editor" onSubmit={onSaveLayout}>
            <label>
              틀 선택
              <select value={bedId} onChange={(event) => selectBed(event.target.value)}>
                <option value="">선택</option>
                {data.beds.map((item) => <option key={item.id} value={item.id}>{item.displayCode}</option>)}
              </select>
            </label>
            {Object.keys(layout).map((key) => (
              <label key={key}>
                {key}
                <input value={layout[key as keyof typeof layout]} onChange={(event) => setLayout({ ...layout, [key]: event.target.value })} />
              </label>
            ))}
            <button className="primary-button" type="submit" disabled={!bed}>좌표 저장</button>
          </form>
          <div className="preview-box">
            {bed && <div className="preview-bed" style={{ left: `${Number(layout.positionX)}%`, top: `${Number(layout.positionY)}%`, width: `${Number(layout.width)}%`, height: `${Number(layout.height)}%`, rotate: `${Number(layout.rotation)}deg` }}>{bed.displayCode}</div>}
          </div>
        </section>
      )}
    </div>
  );
}
