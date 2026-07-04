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
    <Modal title={`${summary.roundNumber}라운드 결과`} onClose={() => {}} dismissible={false}>
      <div className="round-end-summary">
        <p className="round-end-summary__winner">
          {summary.winnerId ? `${displayName(summary.winnerId)} 승리!` : "이번 라운드는 무승부입니다."}
        </p>
        <p className="round-end-summary__clock">시계 토큰 +{summary.clockTokensGained}</p>
        {summary.letterTokensGained.length > 0 && (
          <ul className="round-end-summary__letters">
            {summary.letterTokensGained.map((g, i) => (
              <li key={i}>
                {displayName(g.playerId)}: {g.slot} 편지 +{g.amount}
              </li>
            ))}
          </ul>
        )}
        <button type="button" className="primary-btn" onClick={onContinue}>
          {ended ? "결과 보기" : "다음 라운드"}
        </button>
      </div>
    </Modal>
  );
}
