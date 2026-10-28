import { FormEvent, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronDown, ChevronUp, Download, Search, Trash2 } from "lucide-react";
import RecordPhotoGallery from "../../components/common/RecordPhotoGallery";
import HarvestExcelPreview, { type HarvestPreviewData } from "../../components/common/HarvestExcelPreview";
import { formatHarvestTotals, summarizeHarvests, type HarvestPlantSummary } from "../../domain/services/harvestSummary";
import { useGardenStore } from "../../stores/gardenStore";

export default function HarvestOverviewPage() {
  const data = useGardenStore((state) => state.data);
  const deleteHarvestRecord = useGardenStore((state) => state.deleteHarvestRecord);
  const deletePhoto = useGardenStore((state) => state.deletePhoto);
  const [year, setYear] = useState(new Date().getFullYear());
  const [yearInput, setYearInput] = useState(String(year));
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [error, setError] = useState("");
  const [yearError, setYearError] = useState("");
  const [preview, setPreview] = useState<HarvestPreviewData | null>(null);
  const summaries = useMemo(() => data ? summarizeHarvests(data, year) : [], [data, year]);

  if (!data) return null;
  const appData = data;

  function onSearch(event: FormEvent) {
    event.preventDefault();
    const nextYear = Number(yearInput);
    if (!Number.isInteger(nextYear) || nextYear < 1 || nextYear > 9999) {
      setYearError("조회할 연도를 입력하세요.");
      return;
    }
    setYearError("");
    setYear(nextYear);
    setExpanded(new Set());
  }

  async function onDelete(id: string, photoOnly = false) {
    if (!window.confirm(photoOnly ? "이 사진을 삭제하시겠습니까?" : "이 수확기록을 삭제하시겠습니까?")) return;
    try {
      setError("");
      await (photoOnly ? deletePhoto(id) : deleteHarvestRecord(id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "삭제하지 못했습니다.");
    }
  }

  function onExport(plant?: HarvestPlantSummary) {
    setError("");
    setPreview({ summaries: structuredClone(plant ? [plant] : summaries), year, scope: plant?.name ?? "전체", singleCrop: Boolean(plant) });
  }

  return (
    <div className="page">
      <header className="page-header">
        <div><p className="eyebrow">전체 현황</p><h1>수확량 집계</h1></div>
      </header>
      <form className="harvest-year-search" onSubmit={onSearch}>
        <label>조회 연도
          <input type="number" min="1" max="9999" step="1" inputMode="numeric" value={yearInput} onChange={(event) => setYearInput(event.target.value)} required />
        </label>
        <button className="primary-button" type="submit"><Search size={18} /> 조회하기</button>
      </form>
      {yearError && <p className="form-error" role="alert">{yearError}</p>}
      {error && <p className="form-error" role="alert">{error}</p>}
      <section className="harvest-summary" aria-label={`${year}년 식물별 수확량`}>
        <div className="card-title-row harvest-summary-heading harvest-export-heading">
          <h2>{year}년 수확량</h2><small>{summaries.length}개 품목</small>
          <button className="secondary-button compact-action harvest-excel-button" type="button" onClick={() => onExport()} disabled={summaries.length === 0}><Download size={16} /> 전체 엑셀 내보내기</button>
        </div>
        {summaries.map((summary) => {
          const key = summary.plantId ?? "unassigned";
          const isExpanded = expanded.has(key);
          const detailsId = `harvest-details-${key}`;
          return (
            <article className="harvest-summary-item" key={key}>
              <div className="harvest-summary-row">
                <div className="harvest-summary-title"><h3>{summary.name}</h3><p>{formatHarvestTotals(summary.totals)}</p></div>
                <div className="harvest-summary-actions">
                <button className="secondary-button compact-action" type="button" aria-expanded={isExpanded} aria-controls={detailsId} aria-label={`${summary.name} ${isExpanded ? "접기" : "상세보기"}`} onClick={() => {
                  setExpanded((current) => {
                    const next = new Set(current);
                    if (next.has(key)) next.delete(key); else next.add(key);
                    return next;
                  });
                }}>
                  {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}{isExpanded ? "접기" : "상세보기"}
                </button>
                <button className="secondary-button compact-action harvest-excel-button" type="button" onClick={() => onExport(summary)} aria-label={`${summary.name} 엑셀 내보내기`} title={`${summary.name} 엑셀 내보내기`}><Download size={16} /> 엑셀</button>
                </div>
              </div>
              {isExpanded && (
                <div id={detailsId} className="harvest-summary-details">
                  {summary.sheets.map((info) => (
                    <section className="harvest-sheet-summary" key={info.sheetId}>
                      <div className="harvest-summary-row">
                        <div>
                          <h4>{info.group?.displayCode ?? "관리표 없음"} {info.sheet && <span className={`harvest-sheet-status ${info.sheet.status === "CLOSED" ? "closed" : ""}`}>{info.sheet.status === "CLOSED" ? "종료" : "관리중"}</span>}</h4>
                          <p>{formatHarvestTotals(info.totals)}</p>
                        </div>
                        {info.sheet && <Link className="text-link harvest-sheet-link" to={`/sheets/${info.sheetId}`}>관리표 보기</Link>}
                      </div>
                      <div className="timeline">
                        {info.records.map((item) => (
                          <div className="timeline-item" key={item.id}>
                            <div>
                              <p>{item.harvestDate} · {item.quantity}{item.unit} {item.quality}{item.notes ? `: ${item.notes}` : ""}</p>
                              <RecordPhotoGallery target={{ recordType: "HARVEST", recordId: item.id }} photos={appData.photos.filter((photo) => photo.recordType === "HARVEST" && photo.recordId === item.id)} onDeletePhoto={(id) => void onDelete(id, true)} />
                            </div>
                            <button className="danger-button compact-action" type="button" onClick={() => void onDelete(item.id)}><Trash2 size={16} /> 삭제</button>
                          </div>
                        ))}
                      </div>
                    </section>
                  ))}
                </div>
              )}
            </article>
          );
        })}
        {summaries.length === 0 && <p className="empty-text">{year}년 수확기록이 없습니다.</p>}
      </section>
      {preview && <HarvestExcelPreview preview={preview} onClose={() => setPreview(null)} />}
    </div>
  );
}
