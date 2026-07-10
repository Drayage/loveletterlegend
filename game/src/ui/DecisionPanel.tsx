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
  onFortunePath: (path: "peek" | "coWin") => void;
  onDeckSwap: (swap: boolean) => void;
  onTacticianSwap: (swap: boolean) => void;
  onReuseCard: (instanceId: string) => void;
  onHandDiscard: (instanceId: string) => void;
  onIdentitySwap: (use: boolean) => void;
  onIdentityCancel: (use: boolean) => void;
  onIdentityReplacement: (instanceId: string | null) => void;
  onIdentityExtraTurn: (use: boolean) => void;
}

export function DecisionPanel({
  state,
  decision,
  remaining,
  onChooseTarget,
  onChooseGuess,
  onFortunePath,
  onDeckSwap,
  onTacticianSwap,
  onReuseCard,
  onHandDiscard,
  onIdentitySwap,
  onIdentityCancel,
  onIdentityReplacement,
  onIdentityExtraTurn,
}: DecisionPanelProps) {
  if (decision.kind === "fortunePath") {
    return (
      <Modal title="「점술사」 예언" onClose={() => {}} dismissible={false}>
        <div className="decision-panel">
          <p className="decision-panel__prompt">점술사에게 무엇을 부탁하시겠습니까?</p>
          <div className="decision-panel__options decision-panel__options--column">
            <button type="button" className="decision-panel__btn" onClick={() => onFortunePath("peek")}>
              덱 맨 위 카드를 봅니다 (손패와 교환 가능)
            </button>
            <button type="button" className="decision-panel__btn" onClick={() => onFortunePath("coWin")}>
              상대를 지목합니다 (그가 이번 라운드에서 승리하면 나도 함께 승리)
            </button>
          </div>
        </div>
      </Modal>
    );
  }

  if (decision.kind === "deckSwap") {
    const myCard = state.players.find((p) => p.id === decision.playerId)?.hand[0];
    return (
      <Modal title="「점술사」 덱 맨 위 카드" onClose={() => {}} dismissible={false}>
        <div className="decision-panel">
          <div className="decision-panel__card-compare">
            <div className="decision-panel__card-col">
              <p className="decision-panel__caption">덱 맨 위 카드</p>
              <Card name={decision.seenCardName} size="md" />
            </div>
            {myCard && (
              <div className="decision-panel__card-col">
                <p className="decision-panel__caption">내 손패</p>
                <Card name={myCard.name} size="md" />
              </div>
            )}
          </div>
          <p className="decision-panel__prompt">손에 든 카드와 교환하시겠습니까?</p>
          <div className="decision-panel__options">
            <button type="button" className="decision-panel__btn" onClick={() => onDeckSwap(true)}>교환</button>
            <button type="button" className="decision-panel__btn" onClick={() => onDeckSwap(false)}>그대로 두기</button>
          </div>
        </div>
      </Modal>
    );
  }

  if (decision.kind === "tacticianSwap") {
    const myCard = state.players.find((p) => p.id === decision.playerId)?.hand[0];
    const targetName = state.players.find((p) => p.id === decision.targetId)?.displayName ?? "상대";
    return (
      <Modal title="「군사」 손패 확인" onClose={() => {}} dismissible={false}>
        <div className="decision-panel">
          <div className="decision-panel__card-compare">
            <div className="decision-panel__card-col">
              <p className="decision-panel__caption">{targetName}의 손패</p>
              <Card name={decision.seenCardName} size="md" />
            </div>
            {myCard && (
              <div className="decision-panel__card-col">
                <p className="decision-panel__caption">내 손패</p>
                <Card name={myCard.name} size="md" />
              </div>
            )}
          </div>
          <p className="decision-panel__prompt">확인한 카드와 내 손패를 교환하시겠습니까?</p>
          <div className="decision-panel__options">
            <button type="button" className="decision-panel__btn" onClick={() => onTacticianSwap(true)}>교환</button>
            <button type="button" className="decision-panel__btn" onClick={() => onTacticianSwap(false)}>교환하지 않기</button>
          </div>
        </div>
      </Modal>
    );
  }

  if (decision.kind === "reuseDiscard") {
    return (
      <Modal title={`「${decision.cardName}」 효과 재사용`} onClose={() => {}} dismissible={false}>
        <div className="decision-panel">
          <p className="decision-panel__prompt">버림 더미에서 「플레이:」 효과를 다시 사용할 카드를 고르세요.</p>
          <div className="decision-panel__guess-grid">
            {decision.options.map((card) => (
              <button
                key={card.instanceId}
                type="button"
                className="decision-panel__guess-btn"
                onClick={() => onReuseCard(card.instanceId)}
              >
                <span className="decision-panel__guess-card">
                  <Card name={card.name} size="sm" />
                  <span className="decision-panel__guess-count">「{card.name}」</span>
                </span>
              </button>
            ))}
          </div>
        </div>
      </Modal>
    );
  }

  if (decision.kind === "discardFromHand") {
    const actor = state.players.find((p) => p.id === decision.playerId);
    const handOptions = decision.options.filter((c) =>
      actor?.hand.some((h) => h.instanceId === c.instanceId)
    );
    return (
      <Modal title="「대마도사(20세)」 카드 버리기" onClose={() => {}} dismissible={false}>
        <div className="decision-panel">
          <p className="decision-panel__prompt">
            상대의 카드를 받았습니다. 손에 든 카드 중 1장을 골라 버리세요 (공주 계열을 버리면 탈락합니다).
          </p>
          <div className="decision-panel__guess-grid">
            {handOptions.map((card) => (
              <button
                key={card.instanceId}
                type="button"
                className="decision-panel__guess-btn"
                onClick={() => onHandDiscard(card.instanceId)}
              >
                <span className="decision-panel__guess-card">
                  <Card name={card.name} size="sm" />
                  <span className="decision-panel__guess-count">「{card.name}」 버리기</span>
                </span>
              </button>
            ))}
          </div>
        </div>
      </Modal>
    );
  }

  if (decision.kind === "identitySwap") {
    return (
      <Modal title="「농부/양치기」 정체 능력" onClose={() => {}} dismissible={false}>
        <div className="decision-panel">
          <p className="decision-panel__prompt">비공개 카드와 현재 손패를 교환할 수 있습니다.</p>
          <div className="decision-panel__options">
            <button type="button" className="decision-panel__btn" onClick={() => onIdentitySwap(true)}>교환</button>
            <button type="button" className="decision-panel__btn" onClick={() => onIdentitySwap(false)}>그대로</button>
          </div>
        </div>
      </Modal>
    );
  }

  if (decision.kind === "identityCancel") {
    return (
      <Modal title="「사냥꾼/약초꾼」 정체 능력" onClose={() => {}} dismissible={false}>
        <div className="decision-panel">
          <p className="decision-panel__prompt">당신을 대상으로 한 「{decision.cardName}」 효과를 취소할 수 있습니다.</p>
          <div className="decision-panel__options">
            <button type="button" className="decision-panel__btn" onClick={() => onIdentityCancel(true)}>취소</button>
            <button type="button" className="decision-panel__btn" onClick={() => onIdentityCancel(false)}>받기</button>
          </div>
        </div>
      </Modal>
    );
  }

  if (decision.kind === "identityReplaceEffect") {
    return (
      <Modal title="「학생/여학생」 정체 능력" onClose={() => {}} dismissible={false}>
        <div className="decision-panel">
          <p className="decision-panel__prompt">방금 낸 「{decision.cardName}」 대신 버림 더미 카드 효과를 사용할 수 있습니다.</p>
          <div className="decision-panel__options">
            {decision.options.map((card) => (
              <button key={card.instanceId} type="button" className="decision-panel__btn" onClick={() => onIdentityReplacement(card.instanceId)}>
                「{card.name}」
              </button>
            ))}
            <button type="button" className="decision-panel__btn" onClick={() => onIdentityReplacement(null)}>그대로 사용</button>
          </div>
        </div>
      </Modal>
    );
  }

  if (decision.kind === "identityExtraTurn") {
    return (
      <Modal title="「여행자/순례자」 정체 능력" onClose={() => {}} dismissible={false}>
        <div className="decision-panel">
          <p className="decision-panel__prompt">게임 중 한 번, 차례를 한 번 더 가질 수 있습니다.</p>
          <div className="decision-panel__options">
            <button type="button" className="decision-panel__btn" onClick={() => onIdentityExtraTurn(true)}>한 번 더</button>
            <button type="button" className="decision-panel__btn" onClick={() => onIdentityExtraTurn(false)}>넘기기</button>
          </div>
        </div>
      </Modal>
    );
  }

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
