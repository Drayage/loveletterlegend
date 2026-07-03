import type { PlayerState } from "../engine/types";
import { Card } from "./Card";
import "./PlayerArea.css";

interface PlayerAreaProps {
  player: PlayerState;
  isCurrentTurn: boolean;
  revealHand: boolean;
  selectableCardIds?: string[];
  onSelectCard?: (instanceId: string) => void;
}

export function PlayerArea({
  player,
  isCurrentTurn,
  revealHand,
  selectableCardIds,
  onSelectCard,
}: PlayerAreaProps) {
  return (
    <section className={`player-area ${player.eliminated ? "player-area--eliminated" : ""}`}>
      <header className="player-area__header">
        <h2>
          {player.displayName}
          {isCurrentTurn && !player.eliminated && <span className="player-area__turn-badge">차례</span>}
        </h2>
        <div className="player-area__status">
          {player.protected && <span className="pill pill--protected">보호중</span>}
          {player.eliminated && <span className="pill pill--eliminated">탈락</span>}
        </div>
      </header>

      <div className="player-area__row">
        <div className="player-area__group">
          <span className="player-area__label">손패</span>
          <div className="player-area__cards">
            {player.hand.map((c) =>
              revealHand ? (
                <Card
                  key={c.instanceId}
                  name={c.name}
                  size="md"
                  onClick={
                    selectableCardIds?.includes(c.instanceId)
                      ? () => onSelectCard?.(c.instanceId)
                      : undefined
                  }
                />
              ) : (
                <Card key={c.instanceId} name={c.name} faceDown size="md" />
              )
            )}
          </div>
        </div>

        <div className="player-area__group">
          <span className="player-area__label">버린 카드 ({player.discardPile.length})</span>
          <div className="player-area__cards player-area__cards--discard">
            {player.discardPile.map((c) => (
              <Card key={c.instanceId} name={c.name} size="sm" />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
