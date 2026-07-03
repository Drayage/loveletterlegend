import type { PlayerState } from "../engine/types";
import { Card } from "./Card";
import "./TablePlay.css";

interface TablePlayProps {
  left: PlayerState;
  right: PlayerState;
}

function LastPlayed({ player }: { player: PlayerState }) {
  const last = player.discardPile[player.discardPile.length - 1];
  return (
    <div className="table-play__slot">
      <span className="table-play__name">{player.displayName}</span>
      {last ? (
        <Card name={last.name} size="lg" />
      ) : (
        <div className="table-play__empty">아직 낸 카드 없음</div>
      )}
    </div>
  );
}

export function TablePlay({ left, right }: TablePlayProps) {
  return (
    <div className="table-play">
      <LastPlayed player={left} />
      <span className="table-play__vs">VS</span>
      <LastPlayed player={right} />
    </div>
  );
}
