import { useEffect, useRef, useState } from "react";
import type { GameState, PendingDecision, PlayerConfig } from "./engine/types";
import { setupRound, chooseCardToPlay, chooseTarget, chooseGuess } from "./engine/rules";
import { chooseCardToPlayAI, chooseGuessAI, chooseTargetAI } from "./engine/ai";
import { computeRemainingCounts } from "./engine/remaining";
import { Card } from "./ui/Card";
import { PlayerArea } from "./ui/PlayerArea";
import { TablePlay } from "./ui/TablePlay";
import { DecisionPanel } from "./ui/DecisionPanel";
import { GameLog } from "./ui/GameLog";
import { EffectToast } from "./ui/EffectToast";
import { EffectRevealModal } from "./ui/EffectRevealModal";
import { CardReferenceModal } from "./ui/CardReferenceModal";
import "./App.css";

const HUMAN_ID = "human";
const AI_ID = "ai";

const PLAYERS: PlayerConfig[] = [
  { id: HUMAN_ID, displayName: "나", isAI: false },
  { id: AI_ID, displayName: "AI", isAI: true },
];

function applyAiDecision(state: GameState, decision: PendingDecision): GameState {
  if (decision.kind === "playCard") {
    const card = chooseCardToPlayAI(state, decision.playerId);
    return chooseCardToPlay(state, card.instanceId);
  }
  if (decision.kind === "chooseTarget") {
    const targetId = chooseTargetAI(decision.playerId, decision.cardName, decision.eligiblePlayerIds);
    return chooseTarget(state, targetId);
  }
  return chooseGuess(state, chooseGuessAI(state, decision.playerId));
}

function safely<T>(fn: () => T): T | null {
  try {
    return fn();
  } catch (err) {
    console.error(err);
    return null;
  }
}

export default function App() {
  const [state, setState] = useState<GameState | null>(null);
  const [showCardReference, setShowCardReference] = useState(false);
  const [dismissedRevealId, setDismissedRevealId] = useState<string | null>(null);
  const handledDecisionRef = useRef<PendingDecision | null>(null);

  const pendingHumanReveal =
    state?.lastReveal && state.lastReveal.viewerPlayerId === HUMAN_ID && state.lastReveal.id !== dismissedRevealId
      ? state.lastReveal
      : null;

  useEffect(() => {
    if (!state || state.roundResult || !state.pendingDecision) return;
    // Don't let the AI take its next turn while the human still has an
    // unread private reveal on screen (광대/기사) -- otherwise the AI's own
    // reveal could silently overwrite and hide it before it's been read.
    if (pendingHumanReveal) return;
    const decision = state.pendingDecision;
    const actor = state.players.find((p) => p.id === decision.playerId);
    if (!actor?.isAI) return;
    if (handledDecisionRef.current === decision) return;
    handledDecisionRef.current = decision;

    const timer = setTimeout(() => {
      setState((prev) => {
        if (!prev || prev.pendingDecision !== decision) return prev;
        return safely(() => applyAiDecision(prev, decision)) ?? prev;
      });
    }, 700);
    return () => clearTimeout(timer);
  }, [state, pendingHumanReveal]);

  function startGame() {
    handledDecisionRef.current = null;
    setState(setupRound(PLAYERS));
  }

  function handleSelectCard(instanceId: string) {
    setState((prev) => (prev ? safely(() => chooseCardToPlay(prev, instanceId)) ?? prev : prev));
  }
  function handleChooseTarget(targetId: string) {
    setState((prev) => (prev ? safely(() => chooseTarget(prev, targetId)) ?? prev : prev));
  }
  function handleChooseGuess(name: Parameters<typeof chooseGuess>[1]) {
    setState((prev) => (prev ? safely(() => chooseGuess(prev, name)) ?? prev : prev));
  }

  if (!state) {
    return (
      <div className="start-screen">
        <h1>Love Letter Legend</h1>
        <p>기본 16장 카드로 AI와 한 라운드를 플레이합니다.</p>
        <button type="button" className="primary-btn" onClick={startGame}>
          게임 시작
        </button>
      </div>
    );
  }

  const human = state.players.find((p) => p.id === HUMAN_ID)!;
  const ai = state.players.find((p) => p.id === AI_ID)!;
  const decision = state.pendingDecision;
  const isHumanDecision = decision?.playerId === HUMAN_ID;
  const remaining = computeRemainingCounts(state);

  return (
    <div className="app-layout">
      <header className="app-header">
        <h1>Love Letter Legend</h1>
        <div className="app-header__meta">
          <span>덱 {state.deck.length}장 남음</span>
          <span>공개된 카드 {state.faceUpRemovedCards.length}장</span>
        </div>
      </header>

      <EffectToast entries={state.log} />

      <div className="removed-row">
        {state.faceUpRemovedCards.length > 0 ? (
          <>
            <span className="removed-row__label">공개 제거된 카드</span>
            <div className="removed-row__cards">
              {state.faceUpRemovedCards.map((c) => (
                <Card key={c.instanceId} name={c.name} size="md" remainingCount={remaining[c.name]} />
              ))}
            </div>
          </>
        ) : (
          <span className="removed-row__label">공개 제거된 카드 없음</span>
        )}
        <button
          type="button"
          className="removed-row__reference-btn"
          onClick={() => setShowCardReference(true)}
        >
          이번 게임 카드 확인
        </button>
      </div>

      {showCardReference && <CardReferenceModal onClose={() => setShowCardReference(false)} />}

      <EffectRevealModal
        reveal={pendingHumanReveal}
        onDismiss={() => setDismissedRevealId(pendingHumanReveal?.id ?? null)}
      />

      <PlayerArea
        player={ai}
        isCurrentTurn={state.pendingDecision?.playerId === AI_ID}
        revealHand={Boolean(state.roundResult)}
        remaining={remaining}
      />

      <TablePlay state={state} remaining={remaining} />

      <PlayerArea
        player={human}
        isCurrentTurn={state.pendingDecision?.playerId === HUMAN_ID}
        revealHand
        selectableCardIds={
          isHumanDecision && decision?.kind === "playCard"
            ? decision.options.map((c) => c.instanceId)
            : undefined
        }
        onSelectCard={handleSelectCard}
        remaining={remaining}
      />

      {isHumanDecision && decision && decision.kind !== "playCard" && (
        <DecisionPanel
          state={state}
          decision={decision}
          onChooseTarget={handleChooseTarget}
          onChooseGuess={handleChooseGuess}
        />
      )}

      {!isHumanDecision && decision && <div className="thinking-banner">AI가 생각하는 중...</div>}

      {state.roundResult && (
        <div className="round-result">
          <h2>
            {state.roundResult.winnerId
              ? `${state.players.find((p) => p.id === state.roundResult!.winnerId)!.displayName} 승리!`
              : "무승부"}
          </h2>
          <button type="button" className="primary-btn" onClick={startGame}>
            다시 시작
          </button>
        </div>
      )}

      <GameLog entries={state.log} />
    </div>
  );
}
