import { CARD_DEFS } from "../engine/cards";
import { cardRank } from "../engine/effects";
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
    const sortedOptions = [...decision.options].sort((a, b) => {
      const aIsCard = a in CARD_DEFS;
      const bIsCard = b in CARD_DEFS;
      const aRemaining = aIsCard ? (remaining[a as CardName] ?? 0) : 1;
      const bRemaining = bIsCard ? (remaining[b as CardName] ?? 0) : 1;
      if ((aRemaining === 0) !== (bRemaining === 0)) return aRemaining === 0 ? 1 : -1;
      const aRank = aIsCard ? cardRank(a as CardName) : Number(a);
      const bRank = bIsCard ? cardRank(b as CardName) : Number(b);
      if (aRank !== bRank) return aRank - bRank;
      return String(a).localeCompare(String(b), "ko");
    });
    return (
      <Modal title={`「${decision.cardName}」 추측`} onClose={() => {}} dismissible={false}>
        <div className="decision-panel">
          <p className="decision-panel__prompt">
            {isRecruit
              ? "상대가 들고 있을 카드의 숫자를 추측하세요 (0과 1 제외)."
              : decision.maxGuesses && decision.maxGuesses > 1
                ? `${decision.guesses?.length ?? 0}/${decision.maxGuesses} 선택. 상대가 들고 있을 카드 2개를 추측하세요 (「경비병」 제외).`
                : "상대가 들고 있을 카드를 추측하세요 (「경비병」 제외)."}
          </p>
          <div className="decision-panel__guess-grid">
            {sortedOptions.map((guess) => {
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
