import { useEffect } from "react";
import { X } from "lucide-react";
import { useGardenStore } from "../../stores/gardenStore";

export default function Notice() {
  const notice = useGardenStore((state) => state.notice);
  const clearNotice = useGardenStore((state) => state.clearNotice);

  useEffect(() => {
    if (!notice || notice.type === "error") return;
    const timer = window.setTimeout(() => {
      clearNotice();
    }, 1800);
    return () => window.clearTimeout(timer);
  }, [clearNotice, notice]);

  if (!notice) return null;
  return (
    <div className={`notice ${notice.type}`} role="status">
      <span>{notice.message}</span>
      <button type="button" aria-label="알림 닫기" onClick={clearNotice}>
        <X size={18} />
      </button>
    </div>
  );
}
