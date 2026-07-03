import type { CardName, GameState } from "../engine/types";
import { Card } from "./Card";
import "./TablePlay.css";

interface TablePlayProps {
  state: GameState;
  remaining: Record<CardName, number>;
}

export function TablePlay({ state, remaining }: TablePlayProps) {
  const played = state.lastPlayedCard;
  const player = played ? state.players.find((p) => p.id === played.playerId) : undefined;

  return (
    <div className="table-play">
      <span className="table-play__label">진행 중인 카드</span>
      {played && player ? (
        // Re-keying on the instanceId restarts the pop-in animation every
        // time a new card becomes "the card currently in play".
        <div key={played.card.instanceId} className="table-play__pop">
          <span className="table-play__name">{player.displayName}</span>
          <Card name={played.card.name} size="lg" remainingCount={remaining[played.card.name]} />
        </div>
      ) : (
        <div className="table-play__empty">아직 낸 카드 없음</div>
      )}
    </div>
  );
}
