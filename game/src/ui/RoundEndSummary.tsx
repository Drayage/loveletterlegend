import type { RoundSummary } from "../engine/session";
import type { PlayerConfig } from "../engine/types";
import { Modal } from "./Modal";
import "./RoundEndSummary.css";

interface RoundEndSummaryProps {
  summary: RoundSummary;
  players: PlayerConfig[];
  ended: boolean;
  onContinue: () => void;
}

export function RoundEndSummary({ summary, players, ended, onContinue }: RoundEndSummaryProps) {
  const displayName = (id: string) => players.find((p) => p.id === id)?.displayName ?? id;

  return (
    <Modal title={`${summary.roundNumber}주차 결과`} onClose={() => {}} dismissible={false}>
      <div className="round-end-summary">
        <p className="round-end-summary__winner">
          {summary.winnerId ? `${displayName(summary.winnerId)} 승리!` : "이번 라운드는 무승부입니다."}
        </p>
        <p className="round-end-summary__clock">{summary.roundNumber}주가 지났습니다 (남은 시간 {Math.max(0, 8 - summary.roundNumber)}주)</p>
        {summary.letterTokensGained.length > 0 && (
          <ul className="round-end-summary__letters">
            {summary.letterTokensGained.map((g, i) => (
              <li key={i}>
                {displayName(g.playerId)}: {g.slot} 편지 +{g.amount}
              </li>
            ))}
          </ul>
        )}
        {summary.expiredCards.length > 0 && (
          <p className="round-end-summary__expired">
            {summary.expiredCards.map((n) => `『${n}』`).join(", ")}의 시간이 다 되어 이야기 보관소에서
            사라졌습니다.
          </p>
        )}
        <button type="button" className="primary-btn" onClick={onContinue}>
          {ended ? "결과 보기" : "다음 라운드"}
        </button>
      </div>
    </Modal>
  );
}
