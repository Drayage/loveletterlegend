import { useEffect, useRef, useState } from "react";
import type { ArchiveCardState, GameState, PendingDecision, PlayerConfig } from "./engine/types";
import { chooseCardToPlay, chooseTarget, chooseGuess } from "./engine/rules";
import {
  chooseCardToPlayAI,
  chooseGuessAI,
  chooseTargetAI,
  chooseArchiveTokenAI,
  chooseLetterTargetAI,
  chooseRouteAI,
  chooseIdentityAI,
  chooseArchiveChoiceAI,
} from "./engine/ai";
import { computeRemainingCounts } from "./engine/remaining";
import {
  startSession,
  applyToRound,
  beginNextRound,
  placeArchiveToken,
  skipArchivePlacement,
  resolveLetterChoice,
  chooseIdentity,
  resolveArchiveChoice,
  nextRoundLeader,
  ROUTE_SLOT,
} from "./engine/session";
import type { CharacterSlotId, LetterChoice, Route, SessionState } from "./engine/session";
import { LetterTokenChoiceModal } from "./ui/LetterTokenChoiceModal";
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
import { IdentityChoiceModal } from "./ui/IdentityChoiceModal";
import { ArchiveChoiceModal } from "./ui/ArchiveChoiceModal";
import { StoryEventModal } from "./ui/StoryEventModal";
import { ARCHIVE_CARD_SEEDS } from "./data/scenario";
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
  const [pendingStoryEvent, setPendingStoryEvent] = useState<ArchiveCardState[] | null>(null);
  const handledDecisionRef = useRef<PendingDecision | null>(null);
  const handledArchiveRef = useRef<SessionState["pendingArchivePlacement"]>(null);
  const handledLetterChoiceRef = useRef<SessionState["pendingLetterChoice"]>(null);
  const handledIdentityRef = useRef<SessionState["pendingIdentityChoice"]>(null);
  const handledChoiceRef = useRef<SessionState["pendingChoice"]>(null);
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

  // AI's round-win [편지] token placement, when the AI is the round winner.
  useEffect(() => {
    if (!session?.pendingLetterChoice) {
      handledLetterChoiceRef.current = null;
      return;
    }
    const pending = session.pendingLetterChoice;
    // If a reveal/story popup shows up in the same tick this becomes
    // pending, clear the "handled" marker instead of leaving it stuck --
    // otherwise once those popups clear, the dependency-array re-run sees
    // handledLetterChoiceRef already pointing at this exact `pending`
    // object and skips rescheduling forever.
    if (pendingHumanReveal || pendingStoryEvent) {
      handledLetterChoiceRef.current = null;
      return;
    }
    const actor = session.playerConfigs.find((p) => p.id === pending.playerId);
    if (!actor?.isAI) return;
    if (handledLetterChoiceRef.current === pending) return;
    handledLetterChoiceRef.current = pending;

    const timer = setTimeout(() => {
      setSession((prev) => {
        if (!prev || prev.pendingLetterChoice !== pending) return prev;
        const routeSlot = ROUTE_SLOT[prev.currentRoute];
        const choice: LetterChoice = chooseLetterTargetAI(routeSlot, pending.atCap);
        return safely(() => resolveLetterChoice(prev, pending.playerId, choice)) ?? prev;
      });
    }, 700);
    return () => clearTimeout(timer);
  }, [session, pendingHumanReveal, pendingStoryEvent]);

  // AI's story-archive token placement, when it's the AI who was first
  // eliminated this round.
  useEffect(() => {
    if (!session?.pendingArchivePlacement) {
      handledArchiveRef.current = null;
      return;
    }
    const placement = session.pendingArchivePlacement;
    // Same "don't get stuck" fix as the letter-choice effect above: clear
    // the marker rather than leaving it stale while blocked.
    if (pendingHumanReveal || pendingStoryEvent) {
      handledArchiveRef.current = null;
      return;
    }
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
  }, [session, pendingHumanReveal, pendingStoryEvent]);

  // AI's 032 「정체」 card selection, when the AI was eliminated without one.
  useEffect(() => {
    if (!session?.pendingIdentityChoice) {
      handledIdentityRef.current = null;
      return;
    }
    const pending = session.pendingIdentityChoice;
    if (pendingHumanReveal || pendingStoryEvent) {
      handledIdentityRef.current = null;
      return;
    }
    const actor = session.playerConfigs.find((p) => p.id === pending.eligiblePlayerId);
    if (!actor?.isAI) return;
    if (handledIdentityRef.current === pending) return;
    handledIdentityRef.current = pending;

    const timer = setTimeout(() => {
      setSession((prev) => {
        if (!prev || prev.pendingIdentityChoice !== pending) return prev;
        const identityId = chooseIdentityAI(pending.options);
        return safely(() => chooseIdentity(prev, pending.eligiblePlayerId, identityId)) ?? prev;
      });
    }, 700);
    return () => clearTimeout(timer);
  }, [session, pendingHumanReveal, pendingStoryEvent]);

  // AI's 실카드 "선택" 분기 결정, when the eligible player (round winner) is the AI.
  useEffect(() => {
    if (!session?.pendingChoice) {
      handledChoiceRef.current = null;
      return;
    }
    const pending = session.pendingChoice;
    if (pendingHumanReveal || pendingStoryEvent) {
      handledChoiceRef.current = null;
      return;
    }
    const actor = session.playerConfigs.find((p) => p.id === pending.eligiblePlayerId);
    if (!actor?.isAI) return;
    if (handledChoiceRef.current === pending) return;
    handledChoiceRef.current = pending;

    const timer = setTimeout(() => {
      setSession((prev) => {
        if (!prev || prev.pendingChoice !== pending) return prev;
        const optionId = chooseArchiveChoiceAI(pending.options);
        return safely(() => resolveArchiveChoice(prev, pending.eligiblePlayerId, optionId)) ?? prev;
      });
    }, 700);
    return () => clearTimeout(timer);
  }, [session, pendingHumanReveal, pendingStoryEvent]);

  // Show a readable popup (with full flavor text + conditions) whenever new
  // cards appear in the story archive.
  useEffect(() => {
    if (!session) return;
    const currentIds = session.storyArchive.map((c) => c.id);
    const newly = session.storyArchive.filter((c) => !seenArchiveIdsRef.current.has(c.id));
    for (const id of currentIds) seenArchiveIdsRef.current.add(id);
    if (newly.length === 0) return;
    setPendingStoryEvent(newly);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.storyArchive.map((c) => c.id).join(",")]);

  function startGame() {
    handledDecisionRef.current = null;
    handledArchiveRef.current = null;
    handledLetterChoiceRef.current = null;
    handledIdentityRef.current = null;
    handledChoiceRef.current = null;
    seenArchiveIdsRef.current = new Set();
    setDismissedRevealId(null);
    setShowRouteSwitch(false);
    setEndSummaryAcknowledged(false);
    setPendingStoryEvent(null);
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

  function proceedToNextRound(route: Route) {
    setSession((prev) => (prev ? safely(() => beginNextRound(prev, route)) ?? prev : prev));
    setShowRouteSwitch(false);
  }

  function handlePlaceArchiveToken(cardId: string, token: "성공" | "실패") {
    setSession((prev) => (prev ? safely(() => placeArchiveToken(prev, HUMAN_ID, cardId, token)) ?? prev : prev));
  }
  function handleSkipArchivePlacement() {
    setSession((prev) => (prev ? safely(() => skipArchivePlacement(prev, HUMAN_ID)) ?? prev : prev));
  }

  function handleLetterChoice(choice: LetterChoice) {
    setSession((prev) => (prev ? safely(() => resolveLetterChoice(prev, HUMAN_ID, choice)) ?? prev : prev));
  }

  function handleChooseIdentity(identityId: string) {
    setSession((prev) => (prev ? safely(() => chooseIdentity(prev, HUMAN_ID, identityId)) ?? prev : prev));
  }

  function handleChooseArchiveOption(optionId: string) {
    setSession((prev) => (prev ? safely(() => resolveArchiveChoice(prev, HUMAN_ID, optionId)) ?? prev : prev));
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
  const needsLetterChoice = Boolean(session.pendingLetterChoice);
  const humanNeedsLetterChoice = needsLetterChoice && session.pendingLetterChoice!.playerId === HUMAN_ID;
  const needsIdentityChoice = Boolean(session.pendingIdentityChoice);
  const humanNeedsIdentityChoice =
    needsIdentityChoice && session.pendingIdentityChoice!.eligiblePlayerId === HUMAN_ID;
  const needsArchiveChoice = Boolean(session.pendingChoice);
  const humanNeedsArchiveChoice = needsArchiveChoice && session.pendingChoice!.eligiblePlayerId === HUMAN_ID;
  const humanLetterTokens = Object.fromEntries(
    (["잉그리드공주", "아레스왕자", "마술사의도제"] as CharacterSlotId[]).map((slot) => [
      slot,
      session.letterTokens[slot]?.[HUMAN_ID] ?? 0,
    ])
  ) as Record<CharacterSlotId, number>;

  return (
    <div className="app-layout">
      <SessionHeader session={session} humanId={HUMAN_ID} onShowArchive={() => setShowStoryArchive(true)} />

      {/* 스크롤이 필요하면 이 보드 영역 내부에서만 일어난다 -- 로그가
       * 쌓여도 문서 자체는 절대 아래로 자라지 않는다 (100dvh 셸). */}
      <div className="board-region">
      <EffectToast entries={round.log} />

      <div className="removed-row">
        <div className="removed-row__labels">
          <span className="removed-row__label">
            {round.faceUpRemovedCards.length > 0 ? "공개 제거된 카드" : "공개 제거된 카드 없음"}
          </span>
          <span className="removed-row__deck-count">덱 {round.deck.length}장 남음</span>
        </div>
        {round.faceUpRemovedCards.length > 0 && (
          <div className="removed-row__cards">
            {round.faceUpRemovedCards.map((c) => (
              <Card key={c.instanceId} name={c.name} size="sm" remainingCount={remaining[c.name]} />
            ))}
          </div>
        )}
        <button type="button" className="removed-row__reference-btn" onClick={() => setShowCardReference(true)}>
          이번 게임 카드 확인
        </button>
      </div>

      {round.activeFestivalCardId && (
        <div className="festival-banner">
          이번 라운드 축제: <strong>{ARCHIVE_CARD_SEEDS[round.activeFestivalCardId]?.name}</strong> --{" "}
          {ARCHIVE_CARD_SEEDS[round.activeFestivalCardId]?.flavor}
        </div>
      )}

      {showCardReference && (
        <CardReferenceModal session={session} onClose={() => setShowCardReference(false)} />
      )}
      {showStoryArchive && (
        <StoryArchiveModal
          archive={session.storyArchive}
          clockTokens={session.clockTokens}
          onClose={() => setShowStoryArchive(false)}
        />
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
        handSize="sm"
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
      </div>

      {/* Priority when several session-level popups could be true at once:
          pendingHumanReveal (in-round private info from the card that just
          ended the round) must be read first, then pendingStoryEvent (what
          got revealed as a result), then the winner's letter-token choice,
          then archive placement, then the round-transition screens. Each
          gate below explicitly excludes the ones before it so at most one
          full-screen modal is ever mounted at a time. */}
      {!pendingHumanReveal && pendingStoryEvent && (
        <StoryEventModal
          cards={pendingStoryEvent}
          clockTokens={session.clockTokens}
          onNext={() => setPendingStoryEvent((prev) => (prev && prev.length > 1 ? prev.slice(1) : null))}
        />
      )}

      {!pendingHumanReveal && !pendingStoryEvent && humanNeedsLetterChoice && (
        <LetterTokenChoiceModal
          amount={session.pendingLetterChoice!.amount}
          atCap={session.pendingLetterChoice!.atCap}
          tokens={humanLetterTokens}
          onChoose={handleLetterChoice}
        />
      )}

      {!pendingHumanReveal && !pendingStoryEvent && !needsLetterChoice && humanNeedsIdentityChoice && (
        <IdentityChoiceModal options={session.pendingIdentityChoice!.options} onChoose={handleChooseIdentity} />
      )}

      {!pendingHumanReveal &&
        !pendingStoryEvent &&
        !needsLetterChoice &&
        !needsIdentityChoice &&
        humanNeedsArchiveChoice && (
          <ArchiveChoiceModal options={session.pendingChoice!.options} onChoose={handleChooseArchiveOption} />
        )}

      {!pendingHumanReveal &&
        !pendingStoryEvent &&
        !needsLetterChoice &&
        !needsIdentityChoice &&
        !needsArchiveChoice &&
        humanNeedsArchivePlacement && (
          <ArchiveTokenModal
            archive={session.storyArchive}
            onPlace={handlePlaceArchiveToken}
            onSkip={handleSkipArchivePlacement}
          />
        )}

      {!pendingHumanReveal &&
        !pendingStoryEvent &&
        !needsLetterChoice &&
        !needsIdentityChoice &&
        !needsArchiveChoice &&
        roundOver &&
        !needsArchivePlacement &&
        session.lastRoundSummary &&
        !endSummaryAcknowledged &&
        !showRouteSwitch && (
          <RoundEndSummary
            summary={session.lastRoundSummary}
            players={session.playerConfigs}
            ended={session.ended}
            onContinue={() => {
              if (session.ended) {
                setEndSummaryAcknowledged(true);
                return;
              }
              // 다음 라운드의 선플레이어(직전 라운드 승자)만 라우트 전환을
              // 결정한다 -- AI가 이겼다면 사람에게 묻지 않고 바로 진행.
              if (nextRoundLeader(session) === HUMAN_ID) {
                setShowRouteSwitch(true);
              } else {
                proceedToNextRound(chooseRouteAI(session.currentRoute));
              }
            }}
          />
        )}

      {!pendingHumanReveal &&
        !pendingStoryEvent &&
        !needsLetterChoice &&
        !needsIdentityChoice &&
        !needsArchiveChoice &&
        roundOver &&
        !needsArchivePlacement &&
        !session.ended &&
        showRouteSwitch && (
          <RouteSwitchPrompt currentRoute={session.currentRoute} onChoose={proceedToNextRound} />
        )}

      {!pendingHumanReveal && !pendingStoryEvent && roundOver && session.ended && endSummaryAcknowledged && (
        <SessionEndScreen session={session} players={session.playerConfigs} onNewGame={startGame} />
      )}

      <GameLog entries={round.log} />
    </div>
  );
}
