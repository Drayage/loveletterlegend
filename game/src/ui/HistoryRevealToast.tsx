import "./HistoryRevealToast.css";

export function HistoryRevealToast({ names }: { names: string[] }) {
  return (
    <div className="history-toast">
      <span className="history-toast__label">이야기 보관소 공개</span>
      <span className="history-toast__names">{names.join(", ")}</span>
    </div>
  );
}
