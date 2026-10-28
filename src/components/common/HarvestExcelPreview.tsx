import { useEffect, useMemo, useRef, useState } from "react";
import { Download, X } from "lucide-react";
import type { HarvestPlantSummary } from "../../domain/services/harvestSummary";
import { createHarvestReport } from "../../domain/services/harvestReport";

export interface HarvestPreviewData {
  summaries: HarvestPlantSummary[];
  year: number;
  scope: string;
  singleCrop: boolean;
}

const quantity = new Intl.NumberFormat("ko-KR", { maximumFractionDigits: 10 });

export default function HarvestExcelPreview({ preview, onClose }: { preview: HarvestPreviewData; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [tab, setTab] = useState<"detail" | "summary">(preview.singleCrop ? "detail" : "summary");
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState("");
  const report = useMemo(() => createHarvestReport(preview.summaries), [preview.summaries]);
  const tabs = preview.singleCrop ? ["detail", "summary"] as const : ["summary", "detail"] as const;

  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => element?.close();
  }, []);

  async function download() {
    if (exporting) return;
    setExporting(true);
    setError("");
    try {
      const { downloadHarvestExcel } = await import("../../utils/harvestExcel");
      await downloadHarvestExcel(preview.summaries, preview.year, preview.scope, preview.singleCrop);
    } catch (err) {
      setError(err instanceof Error ? err.message : "엑셀 파일을 만들지 못했습니다.");
    } finally { setExporting(false); }
  }

  return <dialog ref={dialog} className="harvest-excel-preview" aria-labelledby="harvest-preview-title" onCancel={(event) => { event.preventDefault(); if (!exporting) onClose(); }}>
    <header className="harvest-preview-header"><h2 id="harvest-preview-title">엑셀 미리보기</h2><p>{preview.year}년 · {preview.scope}</p></header>
    <div className="harvest-preview-tabs" role="tablist" aria-label="엑셀 시트">
      {tabs.map((name) => <button key={name} id={`harvest-preview-tab-${name}`} role="tab" type="button" aria-selected={tab === name} aria-controls="harvest-preview-table" className={tab === name ? "active" : ""} onClick={() => setTab(name)}>{name === "detail" ? "수확 상세" : "수확량 합계"}</button>)}
    </div>
    <div className="harvest-preview-scroll" id="harvest-preview-table" role="tabpanel" aria-labelledby={`harvest-preview-tab-${tab}`} tabIndex={0} key={tab}>
      {tab === "summary" ? <table className="harvest-preview-summary-table">
        <thead><tr><th scope="col">작물명</th><th scope="col">단위</th><th scope="col">수확량 합계</th></tr></thead>
        <tbody>{report.totals.map((row, index) => <tr key={index}><td>{row.plant}</td><td>{row.unit}</td><td className="quantity-cell">{quantity.format(row.quantity)}</td></tr>)}</tbody>
      </table> : <table className="harvest-preview-detail-table">
        <thead><tr>{["수확일", "작물명", "관리그룹", "관리상태", "수확량", "단위", "품질", "메모"].map((heading) => <th scope="col" key={heading}>{heading}</th>)}</tr></thead>
        <tbody>
          {report.details.map((row, index) => <tr key={index}><td>{row.date}</td><td>{row.plant}</td><td>{row.group}</td><td>{row.status}</td><td className="quantity-cell">{quantity.format(row.quantity)}</td><td>{row.unit}</td><td>{row.quality}</td><td className="preview-notes">{row.notes}</td></tr>)}
          {preview.singleCrop && report.totals.map((row, index) => <tr className="harvest-preview-total" key={`total-${index}`}><th scope="row">합계</th><td>{row.plant}</td><td /><td /><td className="quantity-cell">{quantity.format(row.quantity)}</td><td>{row.unit}</td><td /><td /></tr>)}
        </tbody>
      </table>}
    </div>
    <footer className="harvest-preview-footer">
      {error && <p className="form-error" role="alert">{error}</p>}
      {exporting && <p className="harvest-export-status" role="status">엑셀 파일을 만드는 중입니다...</p>}
      <div className="harvest-preview-buttons"><button className="secondary-button harvest-excel-button" type="button" onClick={() => void download()} disabled={exporting}><Download size={18} /> 다운로드</button><button className="secondary-button" type="button" onClick={onClose} disabled={exporting}><X size={18} /> 종료</button></div>
    </footer>
  </dialog>;
}
