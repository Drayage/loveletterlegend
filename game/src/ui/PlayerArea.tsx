import { useEffect, useRef, useState } from "react";
import type { CardName, PlayerState } from "../engine/types";
import { Card } from "./Card";
import { Modal } from "./Modal";
import "./PlayerArea.css";

interface PlayerAreaProps {
  player: PlayerState;
  isCurrentTurn: boolean;
  revealHand: boolean;
  selectableCardIds?: string[];
  onSelectCard?: (instanceId: string) => void;
  remaining: Record<CardName, number>;
  /** 상대(AI) 손패는 "sm"으로 줄여 화면 중앙 보드 공간을 확보한다. */
  handSize?: "sm" | "md";
  compact?: boolean;
  upgradeBadges?: Partial<Record<CardName, string>>;
}

export function PlayerArea({
  player,
  isCurrentTurn,
  revealHand,
  selectableCardIds,
  onSelectCard,
  remaining,
  handSize = "md",
  compact,
  upgradeBadges = {},
}: PlayerAreaProps) {
  const [showDiscards, setShowDiscards] = useState(false);
  const [justEliminated, setJustEliminated] = useState(false);
  const wasEliminated = useRef(player.eliminated);

  useEffect(() => {
    if (player.eliminated && !wasEliminated.current) {
      setJustEliminated(true);
      const timer = setTimeout(() => setJustEliminated(false), 1200);
      wasEliminated.current = true;
      return () => clearTimeout(timer);
    }
    wasEliminated.current = player.eliminated;
  }, [player.eliminated]);

  return (
    <section
      className={[
        "player-area",
        compact ? "player-area--compact" : "",
        player.protected ? "player-area--protected" : "",
        player.immuneThisRound ? "player-area--immune" : "",
        player.eliminated ? "player-area--eliminated" : "",
        justEliminated ? "player-area--flash" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <header className="player-area__header">
        <h2>
          {player.displayName}
          {isCurrentTurn && !player.eliminated && <span className="player-area__turn-badge">차례</span>}
        </h2>
        <div className="player-area__status">
          {player.protected && (
            <span className="pill pill--protected" title="다음 차례까지 카드 효과의 대상이 되지 않습니다.">
              <span className="pill__icon" aria-hidden="true">◇</span>
              보호중
            </span>
          )}
          {player.immuneThisRound && (
            <span className="pill pill--immune" title="이번 라운드에는 탈락하지 않습니다.">
              <span className="pill__icon" aria-hidden="true">◆</span>
              탈락 면역
            </span>
          )}
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
                  size={handSize}
                  remainingCount={remaining[c.name]}
                  upgradeBadge={upgradeBadges[c.name]}
                  onClick={
                    selectableCardIds?.includes(c.instanceId)
                      ? () => onSelectCard?.(c.instanceId)
                      : undefined
                  }
                />
              ) : (
                <Card key={c.instanceId} name={c.name} faceDown size={handSize} />
              )
            )}
          </div>
        </div>

        <div className="player-area__group">
          <span className="player-area__label">버린 카드</span>
          {player.discardPile.length === 0 ? (
            <span className="player-area__discard-empty">없음</span>
          ) : (
            <button
              type="button"
              className="player-area__discard-btn"
              onClick={() => setShowDiscards(true)}
            >
              {player.discardPile.length}장 보기
            </button>
          )}
        </div>
      </div>

      {showDiscards && (
        <Modal title={`${player.displayName}의 버린 카드`} onClose={() => setShowDiscards(false)}>
          {player.discardPile.map((c) => (
            <Card key={c.instanceId} name={c.name} size="sm" upgradeBadge={upgradeBadges[c.name]} />
          ))}
        </Modal>
      )}
    </section>
  );
}
