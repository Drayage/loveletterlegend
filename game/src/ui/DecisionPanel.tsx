import { CARD_DEFS } from "../engine/cards";
import type { CardName, GameState, GuessOption, PendingDecision } from "../engine/types";
import { Card } from "./Card";
import { Modal } from "./Modal";
import "./DecisionPanel.css";

interface DecisionPanelProps {
  state: GameState;
  decision: PendingDecision;
  remaining: Partial<Record<CardName, number>>;
  onChooseTarget: (targetId: string) => void;
  onChooseGuess: (name: GuessOption) => void;
}

export function DecisionPanel({ state, decision, remaining, onChooseTarget, onChooseGuess }: DecisionPanelProps) {
  if (decision.kind === "chooseTarget") {
    return (
      <Modal title={`「${decision.cardName}」 대상 선택`} onClose={() => {}} dismissible={false}>
        <div className="decision-panel">
          <p className="decision-panel__prompt">효과를 사용할 대상을 고르세요.</p>
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
      </Modal>
    );
  }

  if (decision.kind === "guessCard") {
    const isRecruit = decision.cardName === "신병";
    return (
      <Modal title={`「${decision.cardName}」 추측`} onClose={() => {}} dismissible={false}>
        <div className="decision-panel">
          <p className="decision-panel__prompt">
            {isRecruit
              ? "상대가 들고 있을 카드의 숫자가 「1을 제외한 홀수」인지 「짝수」인지 추측하세요."
              : "상대가 들고 있을 카드를 추측하세요 (「경비병」 제외)."}
          </p>
          <div className="decision-panel__guess-grid">
            {decision.options.map((guess) => {
              const isCardName = guess in CARD_DEFS;
              const remainingCount = isCardName ? (remaining[guess as CardName] ?? 0) : null;
              return (
                <button
                  key={guess}
                  type="button"
                  className="decision-panel__guess-btn"
                  onClick={() => onChooseGuess(guess)}
                >
                  {isCardName ? (
                    <span className="decision-panel__guess-card">
                      <Card name={guess as CardName} size="sm" remainingCount={remainingCount ?? undefined} />
                      <span className="decision-panel__guess-count">남은 {remainingCount}장</span>
                    </span>
                  ) : (
                    <span>{guess}</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </Modal>
    );
  }

  return null;
}
