import { CARD_ORDER } from "../engine/cards";
import type { GameState, PendingDecision } from "../engine/types";
import "./DecisionPanel.css";

interface DecisionPanelProps {
  state: GameState;
  decision: PendingDecision;
  onChooseTarget: (targetId: string) => void;
  onChooseGuess: (name: (typeof CARD_ORDER)[number]) => void;
}

export function DecisionPanel({ state, decision, onChooseTarget, onChooseGuess }: DecisionPanelProps) {
  if (decision.kind === "chooseTarget") {
    return (
      <div className="decision-panel">
        <p className="decision-panel__prompt">
          「{decision.cardName}」 효과를 사용할 대상을 고르세요.
        </p>
        <div className="decision-panel__options">
          {decision.eligiblePlayerIds.map((id) => {
            const p = state.players.find((pl) => pl.id === id)!;
            const isSelf = id === decision.playerId;
            return (
              <button key={id} type="button" className="decision-panel__btn" onClick={() => onChooseTarget(id)}>
                {isSelf ? `${p.displayName} (자신)` : p.displayName}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  if (decision.kind === "guessCard") {
    return (
      <div className="decision-panel">
        <p className="decision-panel__prompt">상대가 들고 있을 카드를 추측하세요 (「경비병」 제외).</p>
        <div className="decision-panel__options">
          {decision.options.map((name) => (
            <button key={name} type="button" className="decision-panel__btn" onClick={() => onChooseGuess(name)}>
              {name}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return null;
}
