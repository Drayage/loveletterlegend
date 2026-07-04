import { useEffect, useRef, useState } from "react";
import type { GameState, PendingDecision, PlayerConfig } from "./engine/types";
import { chooseCardToPlay, chooseTarget, chooseGuess } from "./engine/rules";
import { chooseCardToPlayAI, chooseGuessAI, chooseTargetAI, chooseRouteAI, chooseArchiveTokenAI } from "./engine/ai";
import { computeRemainingCounts } from "./engine/remaining";
import {
  startSession,
  applyToRound,
  beginNextRound,
  placeArchiveToken,
  skipArchivePlacement,
} from "./engine/session";
import type { Route, SessionState } from "./engine/session";
import { Card } from "./ui/Card";
import { PlayerArea } from "./ui/PlayerArea";
import { TablePlay } from "./ui/TablePlay";
import { DecisionPanel } from "./ui/DecisionPanel";
import { GameLog } from "./ui/GameLog";
import { EffectToast } from "./ui/EffectToast";
import { EffectRevealModal } from "./ui/EffectRevealModal";
import { CardReferenceModal } from "./ui/CardReferenceModal";
import { SessionHeader } from "./ui/SessionHeader";
import { RouteSwitchPrompt } from "./ui/RouteSwitchPrompt";
import { RoundEndSummary } from "./ui/RoundEndSummary";
import { SessionEndScreen } from "./ui/SessionEndScreen";
import { StoryArchiveModal } from "./ui/StoryArchiveModal";
import { ArchiveTokenModal } from "./ui/ArchiveTokenModal";
import { HistoryRevealToast } from "./ui/HistoryRevealToast";
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
  const [session, setSession] = useState<SessionState | null>(null);
  const [showCardReference, setShowCardReference] = useState(false);
  const [showStoryArchive, setShowStoryArchive] = useState(false);
  const [dismissedRevealId, setDismissedRevealId] = useState<string | null>(null);
  const [showRouteSwitch, setShowRouteSwitch] = useState(false);
  const [endSummaryAcknowledged, setEndSummaryAcknowledged] = useState(false);
  const [historyToast, setHistoryToast] = useState<{ id: string; names: string[] } | null>(null);
  const handledDecisionRef = useRef<PendingDecision | null>(null);
  const handledArchiveRef = useRef<SessionState["pendingArchivePlacement"]>(null);
  const seenArchiveIdsRef = useRef<Set<string>>(new Set());

  const round = session?.round ?? null;

  const pendingHumanReveal =
    round?.lastReveal && round.lastReveal.viewerPlayerId === HUMAN_ID && round.lastReveal.id !== dismissedRevealId
      ? round.lastReveal
      : null;

  // AI's normal in-round turn.
  useEffect(() => {
    if (!round || round.roundResult || !round.pendingDecision) return;
    if (pendingHumanReveal) return;
    const decision = round.pendingDecision;
    const actor = round.players.find((p) => p.id === decision.playerId);
    if (!actor?.isAI) return;
    if (handledDecisionRef.current === decision) return;
    handledDecisionRef.current = decision;

    const timer = setTimeout(() => {
      setSession((prev) => {
        if (!prev || prev.round.pendingDecision !== decision) return prev;
        return safely(() => applyToRound(prev, (s) => applyAiDecision(s, decision))) ?? prev;
      });
    }, 700);
    return () => clearTimeout(timer);
  }, [round, pendingHumanReveal]);

  // AI's story-archive token placement, when it's the AI who was first
  // eliminated this round.
  useEffect(() => {
    if (!session?.pendingArchivePlacement) {
      handledArchiveRef.current = null;
      return;
    }
    if (pendingHumanReveal) return;
    const placement = session.pendingArchivePlacement;
    const actor = session.playerConfigs.find((p) => p.id === placement.eligiblePlayerId);
    if (!actor?.isAI) return;
    if (handledArchiveRef.current === placement) return;
    handledArchiveRef.current = placement;

    const timer = setTimeout(() => {
      setSession((prev) => {
        if (!prev || prev.pendingArchivePlacement !== placement) return prev;
        const choice = chooseArchiveTokenAI(prev.storyArchive);
        return (
          safely(() =>
            choice
              ? placeArchiveToken(prev, placement.eligiblePlayerId, choice.cardId, choice.token)
              : skipArchivePlacement(prev, placement.eligiblePlayerId)
          ) ?? prev
        );
      });
    }, 700);
    return () => clearTimeout(timer);
  }, [session, pendingHumanReveal]);

  // Show a brief toast whenever new cards appear in the story archive.
  useEffect(() => {
    if (!session) return;
    const currentIds = session.storyArchive.map((c) => c.id);
    const newly = session.storyArchive.filter((c) => !seenArchiveIdsRef.current.has(c.id));
    for (const id of currentIds) seenArchiveIdsRef.current.add(id);
    if (newly.length === 0) return;
    setHistoryToast({ id: currentIds.join(","), names: newly.map((c) => c.name) });
    const timer = setTimeout(() => setHistoryToast(null), 4000);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.storyArchive.map((c) => c.id).join(",")]);

  function startGame() {
    handledDecisionRef.current = null;
    handledArchiveRef.current = null;
    seenArchiveIdsRef.current = new Set();
    setDismissedRevealId(null);
    setShowRouteSwitch(false);
    setEndSummaryAcknowledged(false);
    setSession(startSession(PLAYERS));
  }

  function handleSelectCard(instanceId: string) {
    setSession((prev) => (prev ? safely(() => applyToRound(prev, (s) => chooseCardToPlay(s, instanceId))) ?? prev : prev));
  }
  function handleChooseTarget(targetId: string) {
    setSession((prev) => (prev ? safely(() => applyToRound(prev, (s) => chooseTarget(s, targetId))) ?? prev : prev));
  }
  function handleChooseGuess(name: Parameters<typeof chooseGuess>[1]) {
    setSession((prev) => (prev ? safely(() => applyToRound(prev, (s) => chooseGuess(s, name))) ?? prev : prev));
  }

  function proceedToNextRound(humanRoute: Route) {
    setSession((prev) => {
      if (!prev) return prev;
      const routeChoices: Record<string, Route> = { [HUMAN_ID]: humanRoute };
      const aiId = prev.playerConfigs.find((p) => p.isAI)?.id;
      if (aiId) routeChoices[aiId] = chooseRouteAI(prev.currentRoute[aiId]);
      return safely(() => beginNextRound(prev, routeChoices)) ?? prev;
    });
    setShowRouteSwitch(false);
  }

  function handlePlaceArchiveToken(cardId: string, token: "성공" | "실패") {
    setSession((prev) => (prev ? safely(() => placeArchiveToken(prev, HUMAN_ID, cardId, token)) ?? prev : prev));
  }
  function handleSkipArchivePlacement() {
    setSession((prev) => (prev ? safely(() => skipArchivePlacement(prev, HUMAN_ID)) ?? prev : prev));
  }

  if (!session || !round) {
    return (
      <div className="start-screen">
        <h1>Love Letter Legend</h1>
        <p>8라운드에 걸쳐 캐릭터와 편지를 주고받는 AI 대전 러브레터입니다.</p>
        <button type="button" className="primary-btn" onClick={startGame}>
          게임 시작
        </button>
      </div>
    );
  }

  const human = round.players.find((p) => p.id === HUMAN_ID)!;
  const ai = round.players.find((p) => p.id === AI_ID)!;
  const decision = round.pendingDecision;
  const isHumanDecision = decision?.playerId === HUMAN_ID;
  const remaining = computeRemainingCounts(round);

  const roundOver = Boolean(round.roundResult);
  const needsArchivePlacement = Boolean(session.pendingArchivePlacement);
  const humanNeedsArchivePlacement =
    needsArchivePlacement && session.pendingArchivePlacement!.eligiblePlayerId === HUMAN_ID;

  return (
    <div className="app-layout">
      <header className="app-header">
        <h1>Love Letter Legend</h1>
        <div className="app-header__meta">
          <span>덱 {round.deck.length}장 남음</span>
          <span>공개된 카드 {round.faceUpRemovedCards.length}장</span>
        </div>
      </header>

      <SessionHeader session={session} humanId={HUMAN_ID} onShowArchive={() => setShowStoryArchive(true)} />

      <EffectToast entries={round.log} />
      {historyToast && <HistoryRevealToast names={historyToast.names} />}

      <div className="removed-row">
        {round.faceUpRemovedCards.length > 0 ? (
          <>
            <span className="removed-row__label">공개 제거된 카드</span>
            <div className="removed-row__cards">
              {round.faceUpRemovedCards.map((c) => (
                <Card key={c.instanceId} name={c.name} size="md" remainingCount={remaining[c.name]} />
              ))}
            </div>
          </>
        ) : (
          <span className="removed-row__label">공개 제거된 카드 없음</span>
        )}
        <button type="button" className="removed-row__reference-btn" onClick={() => setShowCardReference(true)}>
          이번 게임 카드 확인
        </button>
      </div>

      {showCardReference && (
        <CardReferenceModal session={session} onClose={() => setShowCardReference(false)} />
      )}
      {showStoryArchive && (
        <StoryArchiveModal archive={session.storyArchive} onClose={() => setShowStoryArchive(false)} />
      )}

      <EffectRevealModal
        reveal={pendingHumanReveal}
        onDismiss={() => setDismissedRevealId(pendingHumanReveal?.id ?? null)}
      />

      <PlayerArea
        player={ai}
        isCurrentTurn={round.pendingDecision?.playerId === AI_ID}
        revealHand={Boolean(round.roundResult)}
        remaining={remaining}
      />

      <TablePlay state={round} remaining={remaining} />

      <PlayerArea
        player={human}
        isCurrentTurn={round.pendingDecision?.playerId === HUMAN_ID}
        revealHand
        selectableCardIds={
          isHumanDecision && decision?.kind === "playCard" ? decision.options.map((c) => c.instanceId) : undefined
        }
        onSelectCard={handleSelectCard}
        remaining={remaining}
      />

      {isHumanDecision && decision && decision.kind !== "playCard" && (
        <DecisionPanel
          state={round}
          decision={decision}
          onChooseTarget={handleChooseTarget}
          onChooseGuess={handleChooseGuess}
        />
      )}

      {!isHumanDecision && decision && <div className="thinking-banner">AI가 생각하는 중...</div>}

      {humanNeedsArchivePlacement && (
        <ArchiveTokenModal
          archive={session.storyArchive}
          onPlace={handlePlaceArchiveToken}
          onSkip={handleSkipArchivePlacement}
        />
      )}

      {roundOver &&
        !needsArchivePlacement &&
        session.lastRoundSummary &&
        !endSummaryAcknowledged &&
        !showRouteSwitch && (
          <RoundEndSummary
            summary={session.lastRoundSummary}
            players={session.playerConfigs}
            ended={session.ended}
            onContinue={() => (session.ended ? setEndSummaryAcknowledged(true) : setShowRouteSwitch(true))}
          />
        )}

      {roundOver && !needsArchivePlacement && !session.ended && showRouteSwitch && (
        <RouteSwitchPrompt currentRoute={session.currentRoute[HUMAN_ID]} onChoose={proceedToNextRound} />
      )}

      {roundOver && session.ended && endSummaryAcknowledged && (
        <SessionEndScreen session={session} players={session.playerConfigs} onNewGame={startGame} />
      )}

      <GameLog entries={round.log} />
    </div>
  );
}
