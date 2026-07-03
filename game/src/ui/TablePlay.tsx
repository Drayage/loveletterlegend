import type { CardName, PlayerState } from "../engine/types";
import { Card } from "./Card";
import "./TablePlay.css";

interface TablePlayProps {
  left: PlayerState;
  right: PlayerState;
  remaining: Record<CardName, number>;
}

function LastPlayed({ player, remaining }: { player: PlayerState; remaining: Record<CardName, number> }) {
  const last = player.discardPile[player.discardPile.length - 1];
  return (
    <div className="table-play__slot">
      <span className="table-play__name">{player.displayName}</span>
      {last ? (
        // Re-keying on the instanceId restarts the pop-in animation every
        // time a new card becomes "the most recent play" for this player.
        <div key={last.instanceId} className="table-play__pop">
          <Card name={last.name} size="lg" remainingCount={remaining[last.name]} />
        </div>
      ) : (
        <div className="table-play__empty">아직 낸 카드 없음</div>
      )}
    </div>
  );
}

export function TablePlay({ left, right, remaining }: TablePlayProps) {
  return (
    <div className="table-play">
      <LastPlayed player={left} remaining={remaining} />
      <LastPlayed player={right} remaining={remaining} />
    </div>
  );
}
