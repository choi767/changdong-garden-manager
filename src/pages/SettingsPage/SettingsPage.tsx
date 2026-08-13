import { ChangeEvent, FormEvent, useMemo, useState } from "react";
import { Download, RefreshCcw, Trash2, Upload } from "lucide-react";
import { useGardenStore } from "../../stores/gardenStore";

export default function SettingsPage() {
  const data = useGardenStore((state) => state.data);
  const updateBedLayout = useGardenStore((state) => state.updateBedLayout);
  const resetData = useGardenStore((state) => state.resetData);
  const deleteAllPlants = useGardenStore((state) => state.deleteAllPlants);
  const exportJson = useGardenStore((state) => state.exportJson);
  const importJson = useGardenStore((state) => state.importJson);
  const [bedId, setBedId] = useState("");
  const [error, setError] = useState("");
  const [showAdminTools, setShowAdminTools] = useState(false);
  const [layout, setLayout] = useState({ positionX: "0", positionY: "0", width: "5", height: "5", rotation: "0" });

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
    a.download = `changdong-garden-v2-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function onImport(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setError("");
    try {
      await importJson(await file.text());
    } catch (err) {
      setError(err instanceof Error ? err.message : "백업 가져오기에 실패했습니다.");
    } finally {
      event.target.value = "";
    }
  }

  async function onResetDevelopmentData() {
    if (!window.confirm("개발용 초기화를 실행하시겠습니까?\n관리그룹, 관리표, 작업/일정/사진/수확 등 기록은 초기화되지만 식물DB는 보존됩니다.")) return;
    await resetData();
  }

  async function onDeleteAllPlants() {
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
            <button className="primary-button" type="button" onClick={() => void onExport()}><Download size={18} /> JSON 백업</button>
            <label className="secondary-button file-button">
              <Upload size={18} /> JSON 복원
              <input type="file" accept="application/json" onChange={(event) => void onImport(event)} />
            </label>
          </div>
          <label className="admin-toggle">
            <input type="checkbox" checked={showAdminTools} onChange={(event) => setShowAdminTools(event.target.checked)} />
            관리자 기능 보기
          </label>
          {showAdminTools && (
            <div className="admin-tools">
              <button className="danger-button" type="button" onClick={() => void onResetDevelopmentData()}><RefreshCcw size={18} /> 개발용 초기화</button>
              <button className="danger-button" type="button" onClick={() => void onDeleteAllPlants()}><Trash2 size={18} /> 식물DB 전체삭제</button>
            </div>
          )}
        </article>
      </section>

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
    </div>
  );
}
