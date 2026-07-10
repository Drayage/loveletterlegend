import { CARD_DEFS } from "../engine/cards";
import type { RoundSummary } from "../engine/session";
import type { PlayerConfig } from "../engine/types";
import { slotDisplayName } from "./slotInfo";
import { Modal } from "./Modal";
import "./RoundEndSummary.css";

interface RoundEndSummaryProps {
  summary: RoundSummary;
  players: PlayerConfig[];
  ended: boolean;
  onContinue: () => void;
}

function uniqueArchiveReveals(reveals: RoundSummary["archiveCardsRevealed"]) {
  const byName = new Map<string, RoundSummary["archiveCardsRevealed"][number]>();
  for (const reveal of reveals) {
    if (!byName.has(reveal.cardName)) byName.set(reveal.cardName, reveal);
  }
  return Array.from(byName.values());
}

export function RoundEndSummary({ summary, players, ended, onContinue }: RoundEndSummaryProps) {
  const displayName = (id: string) => players.find((p) => p.id === id)?.displayName ?? id;
  const handLabel = (cardName: RoundSummary["revealedHands"][number]["cardName"]) =>
    cardName ? `${cardName === "왕" ? "X" : CARD_DEFS[cardName].rank}. ${cardName}` : "없음";

  const archiveReveals = uniqueArchiveReveals(summary.archiveCardsRevealed);

  return (
    <Modal title={`${summary.roundNumber}주차 결과`} onClose={() => {}} dismissible={false}>
      <div className="round-end-summary">
        {summary.roundEndReason === "deckExhausted" && (
          <div className="round-end-summary__deck-exhausted">
            <p>덱이 0장이 되어 남은 손패 숫자로 승부합니다.</p>
            <ul>
              {summary.revealedHands.map((hand) => (
                <li key={hand.playerId}>
                  <span>{displayName(hand.playerId)}</span>
                  <strong>{handLabel(hand.cardName)}</strong>
                </li>
              ))}
            </ul>
          </div>
        )}
        <p className="round-end-summary__winner">
          {summary.winnerId
            ? summary.roundEndReason === "deckExhausted"
              ? `${displayName(summary.winnerId)} 높은 숫자로 승리!`
              : `${displayName(summary.winnerId)} 승리!`
            : "이번 라운드는 무승부입니다."}
        </p>
        {(summary.coWinnerIds?.length ?? 0) > 0 && (
          <p className="round-end-summary__co-winner">
            「점술사」의 예언 적중: {summary.coWinnerIds!.map(displayName).join(", ")}도 함께 승리!
          </p>
        )}
        <p className="round-end-summary__clock">{summary.roundNumber}주가 지났습니다 (남은 시간 {Math.max(0, 8 - summary.roundNumber)}주)</p>
        {summary.letterTokensGained.length > 0 && (
          <ul className="round-end-summary__letters">
            {summary.letterTokensGained.map((g, i) => (
              <li key={i}>
                {displayName(g.playerId)}: {slotDisplayName(g.slot)} 편지 {g.amount > 0 ? `+${g.amount}` : g.amount}
                {g.reason ? <span> - {g.reason}</span> : null}
              </li>
            ))}
          </ul>
        )}
        {summary.archiveTokensGained.length > 0 && (
          <ul className="round-end-summary__archive">
            {summary.archiveTokensGained.map((g, i) => (
              <li key={`${g.cardId}-${i}`}>
                {g.cardName}: {g.token} +{g.amount} - {g.reason}
              </li>
            ))}
          </ul>
        )}
        {archiveReveals.length > 0 && (
          <ul className="round-end-summary__reveals">
            {archiveReveals.map((g, i) => (
              <li key={`${g.cardId}-${i}`}>
                새 이야기 공개: {g.cardName} ({g.sourceName}: {g.reason})
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
