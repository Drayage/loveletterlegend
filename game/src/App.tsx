import { useEffect, useRef, useState } from "react";
import type { ArchiveCardState, CardName, PendingDecision, PlayerConfig } from "./engine/types";
import {
  chooseCardToPlay,
  chooseTarget,
  chooseGuess,
  chooseFortunePath,
  chooseDeckSwap,
  chooseTacticianSwap,
  chooseReuseCard,
  chooseHandDiscard,
  chooseRegentChoice,
  chooseWitchAssign,
  chooseIdentitySwap,
  chooseIdentityCancel,
  chooseIdentityReplacement,
  chooseIdentityExtraTurn,
} from "./engine/rules";
import {
  applyAiDecision,
  chooseArchiveTokenAI,
  chooseLetterTargetAI,
  chooseIdentityAI,
  chooseArchiveChoiceAI,
} from "./engine/ai";
import { computeRemainingCounts } from "./engine/remaining";
import { UPGRADE_ABILITY_TEXT } from "./engine/upgrades";
import {
  startSession,
  applyToRound,
  beginNextRound,
  placeArchiveToken,
  skipArchivePlacement,
  resolveLetterChoice,
  chooseIdentity,
  resolveArchiveChoice,
  ROUTE_SLOT,
  availableRank8LetterSlots,
} from "./engine/session";
import type { CharacterSlotId, LetterChoice, ResolvedChoiceInfo, Route, SessionState } from "./engine/session";
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
import { RoundEndSummary } from "./ui/RoundEndSummary";
import { SessionEndScreen } from "./ui/SessionEndScreen";
import { EndingSequence } from "./ui/EndingSequence";
import { StoryArchiveModal } from "./ui/StoryArchiveModal";
import { ArchiveTokenModal } from "./ui/ArchiveTokenModal";
import { IdentityChoiceModal } from "./ui/IdentityChoiceModal";
import { ArchiveChoiceModal } from "./ui/ArchiveChoiceModal";
import { ChoiceResultModal } from "./ui/ChoiceResultModal";
import { StoryEventModal } from "./ui/StoryEventModal";
import { RoundStartGate } from "./ui/RoundStartGate";
import { EliminationModal } from "./ui/EliminationModal";
import { GuessEffectModal } from "./ui/GuessEffectModal";
import { ForcedDiscardModal } from "./ui/ForcedDiscardModal";
import { EffectBlockedModal } from "./ui/EffectBlockedModal";
import { Modal } from "./ui/Modal";
import { FlowStatusModal, type FlowStatusItem } from "./ui/FlowStatusModal";
import { ARCHIVE_CARD_SEEDS } from "./data/scenario";
import type { IdentityVariantId } from "./data/identityVariants";
import { SetupScreen } from "./ui/SetupScreen";
import { RecordsScreen } from "./ui/RecordsScreen";
import { SoundControls } from "./ui/SoundControls";
import { recordSessionEnding } from "./persistence/records";
import { getSoundEngine } from "./audio/soundEngine";
import "./App.css";

/** 사람 자리는 항상 이 id 하나로 고정 -- 몇 인용이든(2~4인) 사람은 항상
 * 정확히 1자리이므로 이 상수만으로 "사람 vs 나머지 전부 AI" 구분이
 * 충분하다. AI 자리는 SetupScreen이 "ai-1".."ai-3"로 동적으로 만든다. */
const HUMAN_ID = "human";

const IDENTITY_USAGE_TEXT: Record<string, string> = {
  "033": "수동 능력: 차례 시작 시 비공개 카드와 손패 교환 선택 필요",
  "034": "수동 능력: 자신을 대상으로 한 효과 취소 선택 필요",
  "035": "자동 적용 중: 카드 숫자 비교/라운드 종료 숫자 +2",
  "036": "수동 능력: 플레이 효과를 버림 더미 효과로 대체 선택 필요",
  "037": "수동 능력: 게임 중 1회 추가 차례 선택 필요",
  "038": "획득 즉시 적용: 편지 2개 배치/이동",
};

const CHARACTER_SLOTS: CharacterSlotId[] = [
  "잉그리드공주",
  "아레스왕자",
  "경비병알리오스",
  "신병아니스",
  "기사라이언",
  "승려올리비아",
  "마술사의도제",
  "여장군아즈사",
  "군사시어도어",
  "여후작엘마",
  "백작부인카밀라",
  "귀족영애아나스타샤",
];

function decisionKey(decision: PendingDecision): string {
  if (decision.kind === "playCard") {
    return `${decision.kind}:${decision.playerId}:${decision.options.map((c) => c.instanceId).join(",")}`;
  }
  if (decision.kind === "chooseTarget") {
    return `${decision.kind}:${decision.playerId}:${decision.cardInstanceId}:${decision.eligiblePlayerIds.join(",")}`;
  }
  if (decision.kind === "guessCard") return `${decision.kind}:${decision.playerId}:${decision.cardInstanceId}:${decision.targetId}:${decision.guesses?.join(",") ?? ""}`;
  if (decision.kind === "identityReplaceEffect") return `${decision.kind}:${decision.playerId}:${decision.cardInstanceId}:${decision.options.map((c) => c.instanceId).join(",")}`;
  if (decision.kind === "identityCancel") return `${decision.kind}:${decision.playerId}:${decision.cardInstanceId}:${decision.targetId}`;
  if (decision.kind === "reuseDiscard" || decision.kind === "discardFromHand") {
    return `${decision.kind}:${decision.playerId}:${decision.cardInstanceId}:${decision.options.map((c) => c.instanceId).join(",")}`;
  }
  if (decision.kind === "witchAssign") {
    return `${decision.kind}:${decision.playerId}:${decision.cardInstanceId}:${decision.pool.map((c) => c.instanceId).join(",")}`;
  }
  if (
    decision.kind === "fortunePath" ||
    decision.kind === "deckSwap" ||
    decision.kind === "tacticianSwap" ||
    decision.kind === "regentChoice"
  ) {
    return `${decision.kind}:${decision.playerId}:${decision.cardInstanceId}`;
  }
  return `${decision.kind}:${decision.playerId}`;
}

function safely<T>(fn: () => T): T | null {
  try {
    return fn();
  } catch (err) {
    console.error(err);
    return null;
  }
}

function decisionLabel(decision: PendingDecision): string {
  if (decision.kind === "playCard") return `카드 선택: ${decision.options.map((c) => `「${c.name}」`).join(" / ")}`;
  if (decision.kind === "chooseTarget") return `대상 선택: 「${decision.cardName}」`;
  if (decision.kind === "guessCard") return `카드 추측: 「${decision.cardName}」`;
  if (decision.kind === "fortunePath") return "점술사: 선택지 결정";
  if (decision.kind === "deckSwap") return "점술사: 덱 카드 교환 여부";
  if (decision.kind === "tacticianSwap") return "군사: 손패 교환 여부";
  if (decision.kind === "reuseDiscard") return `${decision.cardName}: 재사용할 카드 선택`;
  if (decision.kind === "discardFromHand") return "대마도사: 버릴 카드 선택";
  if (decision.kind === "regentChoice") return "정무관: 면역/상대 탈락 선택";
  if (decision.kind === "witchAssign") return "마녀: 가질 카드 선택";
  if (decision.kind === "identitySwap") return "정체 능력: 비공개 카드 교환";
  if (decision.kind === "identityCancel") return "정체 능력: 효과 취소";
  if (decision.kind === "identityReplaceEffect") return "정체 능력: 효과 대체";
  return "정체 능력: 추가 차례";
}

/** AI가 라운드 선(리더)일 때의 라운드 시작 선택: 공주/왕자 카드는 현재
 * 라우트를 유지하고, 스토리로 열린 추가 8번 카드(백작부인/귀족영애 등)는
 * 전부 덱에 넣는다 -- 이야기 진행 조건이 걸린 카드들이라 넣는 쪽이 이야기를
 * 앞으로 굴린다. */
function chooseRoundStartCardsAI(optionalCards: CardName[]): CardName[] {
  const routeSwapCards = new Set<CardName>(["공주", "왕자", "공주둘째", "공주셋째"]);
  return optionalCards.filter((name) => !routeSwapCards.has(name));
}

/** 라운드 시작 게이트에서 고른 8번 카드가 곧 그 라운드의 라우트다 --
 * 「왕자」를 고르면 currentRoute도 왕자로 전환되어야 편지 배치 기본값과
 * 050 「역사 8」 판정이 덱 구성과 어긋나지 않는다. 공주(둘째/셋째)는
 * 별도 라우트가 아니므로 기존 라우트를 유지한다. */
function routeForSelection(currentRoute: Route, selected: CardName[]): Route {
  if (selected.includes("왕자")) return "왕자";
  if (selected.includes("공주")) return "공주";
  return currentRoute;
}

export default function App() {
  const [session, setSession] = useState<SessionState | null>(null);
  const [uiScreen, setUiScreen] = useState<"title" | "setup" | "records">("title");
  const [showCardReference, setShowCardReference] = useState(false);
  const [showStoryArchive, setShowStoryArchive] = useState(false);
  const [showFlowStatus, setShowFlowStatus] = useState(false);
  const [dismissedRevealId, setDismissedRevealId] = useState<string | null>(null);
  const [dismissedEliminationId, setDismissedEliminationId] = useState<string | null>(null);
  const [dismissedGuessEffectId, setDismissedGuessEffectId] = useState<string | null>(null);
  const [dismissedForcedDiscardId, setDismissedForcedDiscardId] = useState<string | null>(null);
  const [dismissedEffectBlockedId, setDismissedEffectBlockedId] = useState<string | null>(null);
  const [endSummaryAcknowledged, setEndSummaryAcknowledged] = useState(false);
  const [endingSceneDone, setEndingSceneDone] = useState(false);
  const [pendingStoryEvent, setPendingStoryEvent] = useState<ArchiveCardState[] | null>(null);
  const [pendingChoiceResult, setPendingChoiceResult] = useState<ResolvedChoiceInfo | null>(null);
  const [pendingRoundStart, setPendingRoundStart] = useState<{ route: Route; chooserId: string; optionalCards: CardName[]; selectedOptionalCards: CardName[] } | null>(null);
  const [roundStartLockedNumber, setRoundStartLockedNumber] = useState<number | null>(null);
  const handledDecisionRef = useRef<string | null>(null);
  const handledArchiveRef = useRef<SessionState["pendingArchivePlacement"]>(null);
  const handledLetterChoiceRef = useRef<SessionState["pendingLetterChoice"]>(null);
  const handledIdentityRef = useRef<SessionState["pendingIdentityChoice"]>(null);
  const handledChoiceRef = useRef<SessionState["pendingChoice"]>(null);
  const seenArchiveIdsRef = useRef<Set<string>>(new Set());
  // Tracks the cardId (not object reference -- SessionState gets
  // structuredClone'd on every later round end, which mints a fresh
  // lastResolvedChoice object with the SAME data, so reference equality
  // would make this popup reappear on every subsequent round end).
  const shownChoiceResultCardIdRef = useRef<string | null>(null);
  // 세션 하나당 기록보관실 저장은 정확히 한 번만 -- session.ended이 계속
  // true인 상태에서 리렌더가 여러 번 일어나도 localStorage에 중복 누적되지
  // 않도록 막는다.
  const recordedEndingRef = useRef(false);

  const round = session?.round ?? null;
  const roundStartLocked = Boolean(session && roundStartLockedNumber === session.roundNumber);
  const canShowRoundEffects = !roundStartLocked;

  const pendingHumanReveal =
    canShowRoundEffects &&
    round?.lastReveal &&
    (round.lastReveal.viewerPlayerId === HUMAN_ID || round.lastReveal.compare) &&
    round.lastReveal.id !== dismissedRevealId
      ? round.lastReveal
      : null;
  // Public (not viewer-specific) -- shown regardless of who caused the
  // elimination, right after any private reveal the actor needed to see
  // first (see EliminationModal's doc comment).
  const pendingElimination =
    canShowRoundEffects && round?.lastElimination && round.lastElimination.id !== dismissedEliminationId
      ? round.lastElimination
      : null;
  // Public effect popups (both players see these, unlike pendingHumanReveal)
  // -- 경비병/신병's guess flip, 마술사 계열의 forced discard, and a fizzled
  // effect blocked by 승려 protection. All three can occur mid-round (the
  // round doesn't necessarily end), unlike pendingElimination which in this
  // 2P game always coincides with round.roundResult being set.
  const pendingGuessEffect =
    canShowRoundEffects && round?.lastGuessEffect && round.lastGuessEffect.id !== dismissedGuessEffectId
      ? round.lastGuessEffect
      : null;
  const pendingForcedDiscard =
    canShowRoundEffects && round?.lastForcedDiscard && round.lastForcedDiscard.id !== dismissedForcedDiscardId
      ? round.lastForcedDiscard
      : null;
  const pendingEffectBlocked =
    canShowRoundEffects && round?.lastEffectBlocked && round.lastEffectBlocked.id !== dismissedEffectBlockedId
      ? round.lastEffectBlocked
      : null;
  const roundResultAwaitingAcknowledgement = Boolean(round?.roundResult && session?.lastRoundSummary && !endSummaryAcknowledged);
  const flowBlocked =
    Boolean(pendingHumanReveal) ||
    Boolean(pendingGuessEffect) ||
    Boolean(pendingForcedDiscard) ||
    Boolean(pendingEffectBlocked) ||
    Boolean(pendingElimination) ||
    Boolean(pendingChoiceResult) ||
    Boolean(pendingStoryEvent) ||
    roundResultAwaitingAcknowledgement ||
    Boolean(pendingRoundStart) ||
    roundStartLocked ||
    Boolean(showCardReference) ||
    Boolean(showStoryArchive) ||
    Boolean(showFlowStatus) ||
    Boolean(session?.pendingLetterChoice?.playerId === HUMAN_ID) ||
    Boolean(session?.pendingArchivePlacement?.eligiblePlayerId === HUMAN_ID) ||
    Boolean(session?.pendingIdentityChoice?.eligiblePlayerId === HUMAN_ID) ||
    Boolean(session?.pendingChoice?.eligiblePlayerId === HUMAN_ID);

  // AI's normal in-round turn.
  useEffect(() => {
    if (!round || round.roundResult || !round.pendingDecision) {
      handledDecisionRef.current = null;
      return;
    }
    if (flowBlocked) {
      handledDecisionRef.current = null;
      return;
    }
    const decision = round.pendingDecision;
    const actor = round.players.find((p) => p.id === decision.playerId);
    if (!actor?.isAI) return;
    const key = decisionKey(decision);
    if (handledDecisionRef.current === key) return;
    handledDecisionRef.current = key;

    const timer = setTimeout(() => {
      setSession((prev) => {
        const currentDecision = prev?.round.pendingDecision;
        if (!prev || !currentDecision || decisionKey(currentDecision) !== key) return prev;
        const currentActor = prev.round.players.find((p) => p.id === currentDecision.playerId);
        if (!currentActor?.isAI) return prev;
        return (
          safely(() =>
            applyToRound(prev, (s) => applyAiDecision(s, currentDecision, { letterTokens: prev.letterTokens }))
          ) ?? prev
        );
      });
    }, 700);
    return () => clearTimeout(timer);
  }, [round, flowBlocked]);

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
    if (flowBlocked) {
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
        // 1차 선택이 거부되면 항상 유효한 기본 배치(공개된 첫 공주/왕자
        // 슬롯) 또는 "이동하지 않음"으로 폴백 -- AI 차례가 소모되지 않으면
        // 진행이 영구히 멈춘다 (교착 방지의 마지막 안전망).
        const fallback: LetterChoice = pending.atCap
          ? { type: "decline" }
          : { type: "place", slot: availableRank8LetterSlots(prev)[0] ?? routeSlot };
        return (
          safely(() => resolveLetterChoice(prev, pending.playerId, choice)) ??
          safely(() => resolveLetterChoice(prev, pending.playerId, fallback)) ??
          prev
        );
      });
    }, 700);
    return () => clearTimeout(timer);
  }, [
    session,
    flowBlocked,
    pendingStoryEvent,
  ]);

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
    if (flowBlocked) {
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
        const choice = chooseArchiveTokenAI(prev.storyArchive, prev.roundEndEligibleArchiveIds);
        // 실패 시 반드시 "놓지 않기"로라도 차례를 소모한다 -- AI 액션이
        // 엔진에서 거부됐는데 세션이 그대로면 이 effect가 다시 돌 계기가
        // 없어 진행이 영구히 멈춘다 (교착 방지의 마지막 안전망).
        return (
          safely(() =>
            choice
              ? placeArchiveToken(prev, placement.eligiblePlayerId, choice.cardId, choice.token)
              : skipArchivePlacement(prev, placement.eligiblePlayerId)
          ) ??
          safely(() => skipArchivePlacement(prev, placement.eligiblePlayerId)) ??
          prev
        );
      });
    }, 700);
    return () => clearTimeout(timer);
  }, [
    session,
    flowBlocked,
    pendingStoryEvent,
  ]);

  // AI's 032 「정체」 card selection, when the AI was eliminated without one.
  useEffect(() => {
    if (!session?.pendingIdentityChoice) {
      handledIdentityRef.current = null;
      return;
    }
    const pending = session.pendingIdentityChoice;
    if (flowBlocked) {
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
        return safely(() => chooseIdentity(prev, pending.eligiblePlayerId, identityId, "male")) ?? prev;
      });
    }, 700);
    return () => clearTimeout(timer);
  }, [
    session,
    flowBlocked,
    pendingStoryEvent,
  ]);

  // AI's 실카드 "선택" 분기 결정, when the eligible player (round winner) is the AI.
  useEffect(() => {
    if (!session?.pendingChoice) {
      handledChoiceRef.current = null;
      return;
    }
    const pending = session.pendingChoice;
    if (flowBlocked) {
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
  }, [
    session,
    flowBlocked,
    pendingStoryEvent,
  ]);

  // Show a readable popup (with full flavor text + conditions) whenever new
  // cards are revealed. Use archiveHistory instead of only the live archive
  // so auto-revealed cards that are immediately consumed/removed still get
  // their story beat before the next card appears.
  useEffect(() => {
    if (!session) return;
    const historyCards = Object.values(session.archiveHistory);
    const currentIds = historyCards.map((c) => c.id);
    const newly = historyCards.filter((c) => !seenArchiveIdsRef.current.has(c.id));
    for (const id of currentIds) seenArchiveIdsRef.current.add(id);
    if (newly.length === 0) return;
    setPendingStoryEvent(newly);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [Object.keys(session?.archiveHistory ?? {}).join(",")]);

  // Show which option was picked (and what the alternatives were) whenever
  // a 실카드 "선택" 분기 resolves -- before the resulting reveals' own
  // StoryEventModal pops up (see the render priority chain below).
  useEffect(() => {
    if (!session?.lastResolvedChoice) return;
    if (shownChoiceResultCardIdRef.current === session.lastResolvedChoice.cardId) return;
    shownChoiceResultCardIdRef.current = session.lastResolvedChoice.cardId;
    setPendingChoiceResult(session.lastResolvedChoice);
  }, [session?.lastResolvedChoice]);

  // Queue the next-round setup only after every round-end event and
  // required token/choice step has cleared. That keeps the 공주/왕자 card
  // selection as the last screen before the next hand is dealt.
  useEffect(() => {
    if (
      !session?.round.roundResult ||
      session.ended ||
      !endSummaryAcknowledged ||
      pendingRoundStart ||
      pendingHumanReveal ||
      pendingGuessEffect ||
      pendingForcedDiscard ||
      pendingEffectBlocked ||
      pendingElimination ||
      pendingChoiceResult ||
      pendingStoryEvent
    ) {
      return;
    }
    if (session.pendingLetterChoice || session.pendingArchivePlacement || session.pendingIdentityChoice || session.pendingChoice) {
      return;
    }
    const optionalCards = session.optionalRoundDeckCardNames ?? [];
    const chooserId = session.lastRoundSummary?.winnerId ?? session.playerConfigs[0]?.id ?? HUMAN_ID;
    setPendingRoundStart({
      route: session.currentRoute,
      chooserId,
      optionalCards,
      selectedOptionalCards:
        chooserId === HUMAN_ID
          ? session.activeOptionalRoundDeckCardNames.filter((name) => optionalCards.includes(name))
          : chooseRoundStartCardsAI(optionalCards),
    });
  }, [
    endSummaryAcknowledged,
    pendingRoundStart,
    pendingHumanReveal,
    pendingGuessEffect,
    pendingForcedDiscard,
    pendingEffectBlocked,
    pendingElimination,
    pendingChoiceResult,
    pendingStoryEvent,
    session,
  ]);

  // 기록보관실 저장은 이제 엔딩씬(EndingSequence)이 끝까지 재생된 뒤
  // 그 결과(진엔딩 성공 여부 포함)를 갖고 정확히 한 번 호출한다 -- see
  // handleEndingSequenceComplete below.
  function handleEndingSequenceComplete(
    identityName: string | null,
    endingSlot: CharacterSlotId | null,
    wasTrueEnding: boolean
  ) {
    if (recordedEndingRef.current) {
      setEndingSceneDone(true);
      return;
    }
    recordedEndingRef.current = true;
    recordSessionEnding(identityName, endingSlot, wasTrueEnding);
    setEndingSceneDone(true);
  }

  // 효과음: 상태가 실제로 "새로" 바뀐 시점에만 울리도록 각 이벤트의 id에
  // 걸어 둔다 -- 사람/AI 누가 일으켰든 동일하게 반응하므로 여기 한 곳에서
  // 전부 처리하면 각 모달 컴포넌트를 건드릴 필요가 없다.
  useEffect(() => {
    if (!round?.lastPlayedCard) return;
    getSoundEngine().playCardPlay();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [round?.lastPlayedCard?.card.instanceId]);

  useEffect(() => {
    if (!round?.lastGuessEffect) return;
    if (round.lastGuessEffect.hit) getSoundEngine().playGuessHit();
    else getSoundEngine().playGuessMiss();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [round?.lastGuessEffect?.id]);

  useEffect(() => {
    if (!round?.lastElimination) return;
    getSoundEngine().playElimination();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [round?.lastElimination?.id]);

  useEffect(() => {
    if (!round?.lastEffectBlocked) return;
    getSoundEngine().playBlocked();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [round?.lastEffectBlocked?.id]);

  useEffect(() => {
    if (!session?.lastRoundSummary) return;
    getSoundEngine().playRoundWin();
  }, [session?.lastRoundSummary]);

  useEffect(() => {
    if (!pendingStoryEvent || pendingStoryEvent.length === 0) return;
    getSoundEngine().playStoryReveal();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingStoryEvent?.[0]?.id]);

  useEffect(() => {
    if (session?.ended && endSummaryAcknowledged) getSoundEngine().playSessionEnd();
  }, [session?.ended, endSummaryAcknowledged]);

  function startGame(players: PlayerConfig[]) {
    handledDecisionRef.current = null;
    handledArchiveRef.current = null;
    handledLetterChoiceRef.current = null;
    handledIdentityRef.current = null;
    handledChoiceRef.current = null;
    seenArchiveIdsRef.current = new Set();
    shownChoiceResultCardIdRef.current = null;
    recordedEndingRef.current = false;
    setDismissedRevealId(null);
    setDismissedEliminationId(null);
    setDismissedGuessEffectId(null);
    setDismissedForcedDiscardId(null);
    setDismissedEffectBlockedId(null);
    setEndSummaryAcknowledged(false);
    setEndingSceneDone(false);
    setPendingStoryEvent(null);
    setPendingChoiceResult(null);
    setPendingRoundStart(null);
    setRoundStartLockedNumber(1);
    setSession(startSession(players));
  }

  function handleSelectCard(instanceId: string) {
    setSession((prev) => (prev ? safely(() => applyToRound(prev, (s) => chooseCardToPlay(s, instanceId))) ?? prev : prev));
  }
  function handleChooseTarget(targetId: string) {
    getSoundEngine().playTargetLock();
    setSession((prev) => (prev ? safely(() => applyToRound(prev, (s) => chooseTarget(s, targetId))) ?? prev : prev));
  }
  function handleChooseGuess(name: Parameters<typeof chooseGuess>[1]) {
    getSoundEngine().playClick();
    setSession((prev) => (prev ? safely(() => applyToRound(prev, (s) => chooseGuess(s, name))) ?? prev : prev));
  }
  function handleIdentitySwap(use: boolean) {
    setSession((prev) => (prev ? safely(() => applyToRound(prev, (s) => chooseIdentitySwap(s, use))) ?? prev : prev));
  }
  function handleIdentityCancel(use: boolean) {
    setSession((prev) => (prev ? safely(() => applyToRound(prev, (s) => chooseIdentityCancel(s, use))) ?? prev : prev));
  }
  function handleIdentityReplacement(instanceId: string | null) {
    setSession((prev) => (prev ? safely(() => applyToRound(prev, (s) => chooseIdentityReplacement(s, instanceId))) ?? prev : prev));
  }
  function handleIdentityExtraTurn(use: boolean) {
    setSession((prev) => (prev ? safely(() => applyToRound(prev, (s) => chooseIdentityExtraTurn(s, use))) ?? prev : prev));
  }
  function handleFortunePath(path: "peek" | "coWin") {
    setSession((prev) => (prev ? safely(() => applyToRound(prev, (s) => chooseFortunePath(s, path))) ?? prev : prev));
  }
  function handleDeckSwap(swap: boolean) {
    setSession((prev) => (prev ? safely(() => applyToRound(prev, (s) => chooseDeckSwap(s, swap))) ?? prev : prev));
  }
  function handleTacticianSwap(swap: boolean) {
    setSession((prev) => (prev ? safely(() => applyToRound(prev, (s) => chooseTacticianSwap(s, swap))) ?? prev : prev));
  }
  function handleReuseCard(instanceId: string) {
    setSession((prev) => (prev ? safely(() => applyToRound(prev, (s) => chooseReuseCard(s, instanceId))) ?? prev : prev));
  }
  function handleHandDiscard(instanceId: string) {
    setSession((prev) => (prev ? safely(() => applyToRound(prev, (s) => chooseHandDiscard(s, instanceId))) ?? prev : prev));
  }
  function handleRegentChoice(choice: "immune" | "eliminate") {
    setSession((prev) => (prev ? safely(() => applyToRound(prev, (s) => chooseRegentChoice(s, choice))) ?? prev : prev));
  }
  function handleWitchAssign(instanceId: string) {
    setSession((prev) => (prev ? safely(() => applyToRound(prev, (s) => chooseWitchAssign(s, instanceId))) ?? prev : prev));
  }

  function proceedToNextRound(route: Route, selectedOptionalCards: CardName[] = []) {
    handledDecisionRef.current = null;
    handledArchiveRef.current = null;
    handledLetterChoiceRef.current = null;
    handledIdentityRef.current = null;
    handledChoiceRef.current = null;
    setEndSummaryAcknowledged(false);
    setRoundStartLockedNumber(session ? session.roundNumber + 1 : null);
    setSession((prev) => (prev ? safely(() => beginNextRound(prev, route, selectedOptionalCards)) ?? prev : prev));
    setPendingRoundStart(null);
  }

  function handlePlaceArchiveToken(cardId: string, token: "성공" | "실패") {
    setSession((prev) => (prev ? safely(() => placeArchiveToken(prev, HUMAN_ID, cardId, token)) ?? prev : prev));
  }
  function handleSkipArchivePlacement() {
    setSession((prev) => (prev ? safely(() => skipArchivePlacement(prev, HUMAN_ID)) ?? prev : prev));
  }

  function handleLetterChoice(choice: LetterChoice) {
    if (choice.type === "place") getSoundEngine().playLetterGain();
    setSession((prev) => (prev ? safely(() => resolveLetterChoice(prev, HUMAN_ID, choice)) ?? prev : prev));
  }

  function handleChooseIdentity(identityId: string, variantId: IdentityVariantId) {
    setSession((prev) => (prev ? safely(() => chooseIdentity(prev, HUMAN_ID, identityId, variantId)) ?? prev : prev));
  }

  function handleChooseArchiveOption(optionId: string) {
    setSession((prev) => (prev ? safely(() => resolveArchiveChoice(prev, HUMAN_ID, optionId)) ?? prev : prev));
  }

  function handleStoryEventNext(count = 1) {
    const isLastStoryCard = !pendingStoryEvent || pendingStoryEvent.length <= count;
    setPendingStoryEvent((prev) => (prev && prev.length > count ? prev.slice(count) : null));
    if (!isLastStoryCard) return;
    setSession((prev) => {
      if (!prev?.pendingChoice) return prev;
      const pending = prev.pendingChoice;
      const actor = prev.playerConfigs.find((p) => p.id === pending.eligiblePlayerId);
      if (!actor?.isAI) return prev;
      const optionId = chooseArchiveChoiceAI(pending.options);
      return safely(() => resolveArchiveChoice(prev, pending.eligiblePlayerId, optionId)) ?? prev;
    });
  }

  if (!session || !round) {
    if (uiScreen === "setup") {
      return (
        <>
          <SetupScreen onStart={startGame} onBack={() => setUiScreen("title")} />
          <SoundControls />
        </>
      );
    }
    if (uiScreen === "records") {
      return (
        <>
          <RecordsScreen onBack={() => setUiScreen("title")} />
          <SoundControls />
        </>
      );
    }
    return (
      <div className="start-screen">
        <h1>Love Letter Legend</h1>
        <p>8라운드에 걸쳐 캐릭터와 편지를 주고받는 AI 대전 러브레터입니다. 2~4인이 함께할 수 있습니다.</p>
        <button
          type="button"
          className="primary-btn"
          onClick={() => {
            // 브라우저 자동재생 정책상 AudioContext는 실제 클릭 안에서만
            // 만들 수 있다 -- 여기가 세션에서 가장 먼저 일어나는 클릭.
            getSoundEngine().unlock();
            getSoundEngine().startBgm();
            setUiScreen("setup");
          }}
        >
          게임 시작
        </button>
        <button type="button" className="start-screen__secondary-btn" onClick={() => setUiScreen("records")}>
          기록보관실
        </button>
        <SoundControls />
      </div>
    );
  }

  const human = round.players.find((p) => p.id === HUMAN_ID)!;
  const otherPlayers = round.players.filter((p) => p.id !== HUMAN_ID);
  const displayNameFor = (playerId: string) =>
    session.playerIdentityFaces[playerId]?.name ??
    round.players.find((p) => p.id === playerId)?.displayName ??
    playerId;
  const identityAbilityFor = (playerId: string) => {
    const identityId = session.playerIdentities[playerId];
    if (!identityId) return null;
    const flavor = ARCHIVE_CARD_SEEDS[identityId]?.flavor;
    const usage = IDENTITY_USAGE_TEXT[identityId];
    return [flavor, usage].filter(Boolean).join("\n");
  };
  const decision = round.pendingDecision;
  const isHumanDecision = decision?.playerId === HUMAN_ID;
  const remaining = computeRemainingCounts(round);

  const roundOver = Boolean(round.roundResult);
  const concealRoundStart = roundStartLocked;
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
  // 카드별 강화 배지/설명은 "누구의 편지 진행도인지"에 따라 달라지므로
  // 플레이어별로 따로 계산한다 -- 이전엔 사람 쪽 진행도(round.activeCardUpgrades)
  // 하나만 계산해 AI의 카드에도 그대로 갖다 붙였는데, 두 플레이어의 편지
  // 진행도가 다르면 AI 카드에 잘못된(사람 기준) 강화 정보가 뜨는 문제가
  // 있었다.
  const upgradesByPlayer = round.activeCardUpgradesByPlayer ?? {};
  function upgradeBadgesFor(playerId: string): Partial<Record<CardName, string>> {
    return Object.fromEntries(
      Object.entries(upgradesByPlayer[playerId] ?? {}).map(([name, tier]) => [
        name,
        tier === "tier2" ? "효과 변경 2단계" : "효과 변경 1단계",
      ])
    ) as Partial<Record<CardName, string>>;
  }
  // 배지가 "뭔가 바뀌었다"는 것 이상을 말해주도록, 실제로 무엇이 바뀌었는지
  // 짧은 문장으로 함께 보여준다 (없으면 배지 자체가 안 뜨므로 fallback
  // 불필요 -- see engine/upgrades.ts's UPGRADE_ABILITY_TEXT).
  function upgradeAbilityTextsFor(playerId: string): Partial<Record<CardName, string>> {
    return Object.fromEntries(
      Object.entries(upgradesByPlayer[playerId] ?? {}).flatMap(([name, tier]) => {
        const text = UPGRADE_ABILITY_TEXT[name as CardName]?.[tier as "tier1" | "tier2"];
        return text ? [[name, text]] : [];
      })
    ) as Partial<Record<CardName, string>>;
  }
  const humanCardUpgradeBadges = upgradeBadgesFor(HUMAN_ID);
  const humanCardUpgradeAbilityTexts = upgradeAbilityTextsFor(HUMAN_ID);
  // 상대는 몇 명이든(1~3명) 각자 자기 진행도 기준으로 따로 계산한다.
  const otherCardUpgradeBadges = Object.fromEntries(
    otherPlayers.map((p) => [p.id, upgradeBadgesFor(p.id)])
  ) as Record<string, Partial<Record<CardName, string>>>;
  const otherCardUpgradeAbilityTexts = Object.fromEntries(
    otherPlayers.map((p) => [p.id, upgradeAbilityTextsFor(p.id)])
  ) as Record<string, Partial<Record<CardName, string>>>;
  const tableUpgradeBadgesByPlayer: Record<string, Partial<Record<CardName, string>>> = {
    [HUMAN_ID]: humanCardUpgradeBadges,
    ...otherCardUpgradeBadges,
  };
  const tableUpgradeAbilityTextsByPlayer: Record<string, Partial<Record<CardName, string>>> = {
    [HUMAN_ID]: humanCardUpgradeAbilityTexts,
    ...otherCardUpgradeAbilityTexts,
  };
  const humanLetterTokens = Object.fromEntries(
    CHARACTER_SLOTS.map((slot) => [
      slot,
      session.letterTokens[slot]?.[HUMAN_ID] ?? 0,
    ])
  ) as Record<CharacterSlotId, number>;
  const storyEventBlocking = Boolean(pendingStoryEvent);
  const activeBlockers: FlowStatusItem[] = [
    ...(showFlowStatus ? [{ title: "진행 확인 탭 열림", detail: "이 탭을 닫으면 자동 진행이 다시 움직입니다.", tone: "waiting" as const }] : []),
    ...(pendingHumanReveal ? [{ title: "비공개 공개 팝업", detail: "내가 확인해야 하는 카드 정보가 떠 있습니다.", tone: "blocked" as const }] : []),
    ...(pendingGuessEffect ? [{ title: "추측 결과 팝업", detail: "경비병/신병 추측 결과를 확인해야 합니다.", tone: "blocked" as const }] : []),
    ...(pendingForcedDiscard ? [{ title: "강제 버림 팝업", detail: "마술사 계열 효과로 버려진 카드를 확인해야 합니다.", tone: "blocked" as const }] : []),
    ...(pendingEffectBlocked ? [{ title: "효과 차단 알림", detail: "보호 등으로 효과가 막힌 내용을 확인해야 합니다.", tone: "blocked" as const }] : []),
    ...(pendingElimination ? [{ title: "탈락 팝업", detail: `${displayNameFor(pendingElimination.playerId)} 탈락 결과를 확인해야 합니다.`, tone: "blocked" as const }] : []),
    ...(pendingChoiceResult ? [{ title: "이벤트 선택 결과", detail: "방금 선택된 시나리오 분기 결과를 확인해야 합니다.", tone: "blocked" as const }] : []),
    ...(pendingStoryEvent ? [{ title: "이야기 이벤트", detail: `${pendingStoryEvent.length}개 이벤트 설명을 읽어야 다음 단계로 갑니다.`, tone: "blocked" as const }] : []),
    ...(roundResultAwaitingAcknowledgement && !storyEventBlocking ? [{ title: "라운드 결과 확인", detail: "결과 확인 버튼을 눌러야 후속 이벤트와 선택이 진행됩니다.", tone: "blocked" as const }] : []),
    ...(roundStartLocked && !storyEventBlocking ? [{ title: "라운드 시작 확인", detail: "시작 이벤트를 다 읽은 뒤 주차 진행 버튼을 눌러야 패가 공개됩니다.", tone: "blocked" as const }] : []),
    ...(pendingRoundStart && !storyEventBlocking ? [{ title: "다음 주차 준비", detail: "공주/왕자 카드와 추가 8번 카드를 선택한 뒤 시작해야 합니다.", tone: "blocked" as const }] : []),
    ...(showCardReference ? [{ title: "카드 확인 창", detail: "카드 목록 창을 닫으면 진행됩니다.", tone: "waiting" as const }] : []),
    ...(showStoryArchive ? [{ title: "이야기 보관소 창", detail: "보관소 창을 닫으면 진행됩니다.", tone: "waiting" as const }] : []),
  ];
  const aiTasks: FlowStatusItem[] = [];
  const playerTasks: FlowStatusItem[] = [];
  if (decision) {
    const actorName = displayNameFor(decision.playerId);
    const item = {
      title: `${actorName} 턴`,
      detail: `${decisionLabel(decision)}${flowBlocked ? " - 먼저 막는 팝업/선택을 처리해야 합니다." : ""}`,
      tone: flowBlocked ? "blocked" as const : "ready" as const,
    };
    if (decision.playerId === HUMAN_ID) playerTasks.push(item);
    else aiTasks.push(item);
  }
  if (session.pendingLetterChoice && !storyEventBlocking) {
    const item = {
      title: "편지 토큰 선택",
      detail: `${displayNameFor(session.pendingLetterChoice.playerId)}이(가) 편지 ${session.pendingLetterChoice.amount}개를 받을 대상을 골라야 합니다.`,
      tone: flowBlocked ? "blocked" as const : "ready" as const,
    };
    if (session.pendingLetterChoice.playerId === HUMAN_ID) playerTasks.push(item);
    else aiTasks.push(item);
  }
  if (session.pendingArchivePlacement && !storyEventBlocking) {
    const item = {
      title: "이야기 보관소 토큰 배치",
      detail: `${displayNameFor(session.pendingArchivePlacement.eligiblePlayerId)}이(가) 성공/실패 토큰을 놓아야 합니다.`,
      tone: flowBlocked ? "blocked" as const : "ready" as const,
    };
    if (session.pendingArchivePlacement.eligiblePlayerId === HUMAN_ID) playerTasks.push(item);
    else aiTasks.push(item);
  }
  if (session.pendingIdentityChoice && !storyEventBlocking) {
    const item = {
      title: "정체 선택",
      detail: `${displayNameFor(session.pendingIdentityChoice.eligiblePlayerId)}이(가) 정체와 성별을 골라야 합니다.`,
      tone: flowBlocked ? "blocked" as const : "ready" as const,
    };
    if (session.pendingIdentityChoice.eligiblePlayerId === HUMAN_ID) playerTasks.push(item);
    else aiTasks.push(item);
  }
  if (session.pendingChoice && !storyEventBlocking) {
    const item = {
      title: "시나리오 선택",
      detail: `${displayNameFor(session.pendingChoice.eligiblePlayerId)}이(가) 「${ARCHIVE_CARD_SEEDS[session.pendingChoice.cardId].name}」 선택지를 골라야 합니다.`,
      tone: flowBlocked ? "blocked" as const : "ready" as const,
    };
    if (session.pendingChoice.eligiblePlayerId === HUMAN_ID) playerTasks.push(item);
    else aiTasks.push(item);
  }
  if (roundOver && session.lastRoundSummary && !endSummaryAcknowledged && !storyEventBlocking) {
    playerTasks.push({
      title: "라운드 결과 확인",
      detail: "결과 확인 버튼을 눌러 다음 이벤트/주차 준비로 넘어가야 합니다.",
      tone: "blocked",
    });
  }
  if (roundStartLocked && !storyEventBlocking) {
    playerTasks.push({ title: "주차 시작 확인", detail: "주차 진행 버튼을 눌러 이번 라운드를 시작해야 합니다.", tone: "blocked" });
  }
  if (pendingRoundStart && !storyEventBlocking) {
    playerTasks.push({ title: "다음 주차 시작", detail: "카드 선택을 확인하고 시작 버튼을 눌러야 합니다.", tone: "blocked" });
  }
  if (aiTasks.length === 0) {
    aiTasks.push({
      title: "AI 자동 처리 없음",
      detail: flowBlocked ? "현재는 플레이어 확인이나 팝업이 먼저입니다." : "AI가 기다리는 결정은 없습니다.",
      tone: flowBlocked ? "waiting" : "ready",
    });
  }
  if (playerTasks.length === 0) {
    playerTasks.push({
      title: "내가 할 일 없음",
      detail: flowBlocked ? "팝업이나 확인창이 흐름을 잡고 있는지 막는 것 탭을 확인하세요." : "현재 필요한 내 선택은 없습니다.",
      tone: flowBlocked ? "waiting" : "ready",
    });
  }
  const blockerItems =
    activeBlockers.length > 0
      ? activeBlockers
      : [{ title: "막는 요소 없음", detail: "자동 진행을 막는 팝업이나 선택창이 없습니다.", tone: "ready" as const }];

  return (
    <div className="app-layout">
      <SessionHeader
        session={session}
        humanId={HUMAN_ID}
        onShowArchive={() => setShowStoryArchive(true)}
        onShowFlowStatus={() => setShowFlowStatus(true)}
      />

      {/* 스크롤이 필요하면 이 보드 영역 내부에서만 일어난다 -- 로그가
       * 쌓여도 문서 자체는 절대 아래로 자라지 않는다 (100dvh 셸). */}
      <div className="board-region">
      {!concealRoundStart && <EffectToast entries={round.log} />}

      <div className="board-topline">
        <div className="removed-row">
          <div className="removed-row__labels">
            <span className="removed-row__label">
              {round.faceUpRemovedCards.length > 0 ? "공개 제거된 카드" : "공개 제거된 카드 없음"}
            </span>
            <span
              className={`removed-row__deck-count${
                round.deck.length === 0 ? " removed-row__deck-count--empty" : ""
              }`}
            >
              {round.deck.length === 0 ? "덱 0장: 숫자 비교" : `덱 ${round.deck.length}장 남음`}
            </span>
          </div>
          {round.faceUpRemovedCards.length > 0 && (
            <div className="removed-row__cards">
              {round.faceUpRemovedCards.map((c) => (
                <Card
                  key={c.instanceId}
                  name={c.name}
                  size="sm"
                  remainingCount={remaining[c.name]}
                />
              ))}
            </div>
          )}
          <button type="button" className="removed-row__reference-btn" onClick={() => setShowCardReference(true)}>
            카드 확인
          </button>
        </div>
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
          archiveHistory={session.archiveHistory}
          clockTokens={session.clockTokens}
          session={session}
          humanId={HUMAN_ID}
          onClose={() => setShowStoryArchive(false)}
        />
      )}
      <EffectRevealModal
        reveal={pendingHumanReveal}
        onDismiss={() => setDismissedRevealId(pendingHumanReveal?.id ?? null)}
      />

      <div className={`opponents-row opponents-row--count-${otherPlayers.length}`}>
        {otherPlayers.map((opponent) => (
          <PlayerArea
            key={opponent.id}
            player={opponent}
            displayName={displayNameFor(opponent.id)}
            identityFace={session.playerIdentityFaces[opponent.id]}
            identityAbility={identityAbilityFor(opponent.id)}
            isCurrentTurn={round.pendingDecision?.playerId === opponent.id}
            revealHand={Boolean(round.roundResult) && !concealRoundStart}
            remaining={remaining}
            handSize="sm"
            compact
            upgradeBadges={otherCardUpgradeBadges[opponent.id]}
            upgradeAbilityTexts={otherCardUpgradeAbilityTexts[opponent.id]}
            concealStatus={concealRoundStart}
          />
        ))}
      </div>

      <TablePlay
        state={round}
        remaining={remaining}
        upgradeBadgesByPlayer={tableUpgradeBadgesByPlayer}
        upgradeAbilityTextsByPlayer={tableUpgradeAbilityTextsByPlayer}
        hidden={concealRoundStart}
      />

      <PlayerArea
        player={human}
        displayName={displayNameFor(HUMAN_ID)}
        identityFace={session.playerIdentityFaces[HUMAN_ID]}
        identityAbility={identityAbilityFor(HUMAN_ID)}
        isCurrentTurn={round.pendingDecision?.playerId === HUMAN_ID}
        revealHand={!concealRoundStart}
        selectableCardIds={
          isHumanDecision && decision?.kind === "playCard" && !concealRoundStart
            ? decision.options.map((c) => c.instanceId)
            : undefined
        }
        onSelectCard={handleSelectCard}
        remaining={remaining}
        upgradeBadges={humanCardUpgradeBadges}
        upgradeAbilityTexts={humanCardUpgradeAbilityTexts}
        concealStatus={concealRoundStart}
      />

      {isHumanDecision && decision && decision.kind !== "playCard" && !concealRoundStart && (
        <DecisionPanel
          state={round}
          decision={decision}
          remaining={remaining}
          onChooseTarget={handleChooseTarget}
          onChooseGuess={handleChooseGuess}
          onFortunePath={handleFortunePath}
          onDeckSwap={handleDeckSwap}
          onTacticianSwap={handleTacticianSwap}
          onReuseCard={handleReuseCard}
          onHandDiscard={handleHandDiscard}
          onRegentChoice={handleRegentChoice}
          onWitchAssign={handleWitchAssign}
          onIdentitySwap={handleIdentitySwap}
          onIdentityCancel={handleIdentityCancel}
          onIdentityReplacement={handleIdentityReplacement}
          onIdentityExtraTurn={handleIdentityExtraTurn}
        />
      )}

      {!isHumanDecision && decision && !concealRoundStart && <div className="thinking-banner">AI가 생각하는 중...</div>}

      <GameLog entries={concealRoundStart ? [] : round.log} />
      </div>

      {/* Priority when several session-level popups could be true at once:
          pendingHumanReveal (in-round private info from the card that just
          ended the round) must be read first. Next come the three PUBLIC
          effect popups that narrate what a just-played card actually did
          (pendingGuessEffect's card-flip, pendingForcedDiscard's discard
          reveal) -- these explain
          the mechanism before pendingElimination confirms its consequence.
          Then pendingChoiceResult (which 선택 옵션 was just picked, and by
          whom), then pendingStoryEvent (what got revealed as a result of
          that pick or any other condition), then the winner's letter-token
          choice, then archive placement, then the round-transition screens
          -- ending with an explicit RoundStartGate breather before the next
          round's hands are actually dealt. Each gate below explicitly
          excludes the ones before it so at most one full-screen modal is
          ever mounted at a time. */}
      {!pendingHumanReveal && pendingGuessEffect && (
        <GuessEffectModal
          effect={pendingGuessEffect}
          actingDisplayName={displayNameFor(pendingGuessEffect.actingPlayerId)}
          targetDisplayName={displayNameFor(pendingGuessEffect.targetPlayerId)}
          onDismiss={() => {
            setDismissedGuessEffectId(pendingGuessEffect.id);
            // A hit already conveys the resulting elimination -- suppress
            // the otherwise-redundant generic EliminationModal for it.
            if (pendingGuessEffect.hit && round.lastElimination) {
              setDismissedEliminationId(round.lastElimination.id);
            }
          }}
        />
      )}

      {!pendingHumanReveal && !pendingGuessEffect && pendingForcedDiscard && (
        <ForcedDiscardModal
          effect={pendingForcedDiscard}
          actingDisplayName={displayNameFor(pendingForcedDiscard.actingPlayerId)}
          targetDisplayName={displayNameFor(pendingForcedDiscard.targetPlayerId)}
          isSelf={pendingForcedDiscard.actingPlayerId === pendingForcedDiscard.targetPlayerId}
          onDismiss={() => setDismissedForcedDiscardId(pendingForcedDiscard.id)}
        />
      )}

      {!pendingHumanReveal && !pendingGuessEffect && !pendingForcedDiscard && pendingEffectBlocked && (
        <EffectBlockedModal
          effect={pendingEffectBlocked}
          actingDisplayName={displayNameFor(pendingEffectBlocked.actingPlayerId)}
          onDismiss={() => setDismissedEffectBlockedId(pendingEffectBlocked.id)}
        />
      )}

      {!pendingHumanReveal &&
        !pendingGuessEffect &&
        !pendingForcedDiscard &&
        !pendingEffectBlocked &&
        pendingElimination && (
          <EliminationModal
            playerDisplayName={displayNameFor(pendingElimination.playerId)}
            reason={pendingElimination.reason}
            onDismiss={() => setDismissedEliminationId(pendingElimination.id)}
          />
        )}

      {!pendingHumanReveal &&
        !pendingGuessEffect &&
        !pendingForcedDiscard &&
        !pendingEffectBlocked &&
        !pendingElimination &&
        pendingChoiceResult && (
          <ChoiceResultModal
            info={pendingChoiceResult}
            chooserName={displayNameFor(pendingChoiceResult.chosenBy)}
            onDismiss={() => setPendingChoiceResult(null)}
          />
        )}

      {!pendingHumanReveal &&
        !pendingGuessEffect &&
        !pendingForcedDiscard &&
        !pendingEffectBlocked &&
        !pendingElimination &&
        !pendingChoiceResult &&
        pendingStoryEvent && (
        // 라운드 종료 후에는 결과 요약을 먼저 확인시키지만(!roundOver ||
        // acknowledged), 라운드 시작 잠금 중에는 시작 시점 공개 이벤트를
        // 즉시 보여준다 -- 새 라운드가 배분 직후 패시브(왕/대신)로 곧바로
        // 끝나는 경우, 이 분기가 없으면 스토리 이벤트(잠금 게이트를 막음)/
        // 잠금 게이트(요약을 막음)/요약(스토리 이벤트를 기다림)이 서로를
        // 기다리는 교착이 생긴다.
        (!roundOver || endSummaryAcknowledged || roundStartLocked) && (
          <StoryEventModal
            cards={pendingStoryEvent}
            clockTokens={session.clockTokens}
            onNext={handleStoryEventNext}
          />
        ))}

      {!pendingHumanReveal &&
        !pendingGuessEffect &&
        !pendingForcedDiscard &&
        !pendingEffectBlocked &&
        !pendingElimination &&
        !pendingChoiceResult &&
        !pendingStoryEvent &&
        roundStartLocked && (
          <Modal title={`${session.roundNumber}주차 시작`} onClose={() => {}} dismissible={false}>
            <div className="round-start-gate">
              <p className="round-start-gate__prompt">
                라운드 시작 이벤트를 모두 확인했습니다. 이제 패를 공개하고 진행을 시작합니다.
              </p>
              <button
                type="button"
                className="round-start-gate__start-btn"
                onClick={() => {
                  getSoundEngine().playClick();
                  setRoundStartLockedNumber(null);
                }}
              >
                {session.roundNumber}주차 진행
              </button>
            </div>
          </Modal>
        )}

      {!pendingHumanReveal &&
        !pendingGuessEffect &&
        !pendingForcedDiscard &&
        !pendingEffectBlocked &&
        !pendingElimination &&
        !pendingChoiceResult &&
        !pendingStoryEvent &&
        !roundStartLocked &&
        humanNeedsLetterChoice && (
          <LetterTokenChoiceModal
            amount={session.pendingLetterChoice!.amount}
            atCap={session.pendingLetterChoice!.atCap}
            tokens={humanLetterTokens}
            availableSlots={availableRank8LetterSlots(session)}
            reason={session.pendingLetterChoice!.reason}
            onChoose={handleLetterChoice}
          />
        )}

      {!pendingHumanReveal &&
        !pendingGuessEffect &&
        !pendingForcedDiscard &&
        !pendingEffectBlocked &&
        !pendingElimination &&
        !pendingChoiceResult &&
        !pendingStoryEvent &&
        !roundStartLocked &&
        !humanNeedsLetterChoice &&
        humanNeedsIdentityChoice && (
          <IdentityChoiceModal options={session.pendingIdentityChoice!.options} onChoose={handleChooseIdentity} />
        )}

      {!pendingHumanReveal &&
        !pendingGuessEffect &&
        !pendingForcedDiscard &&
        !pendingEffectBlocked &&
        !pendingElimination &&
        !pendingChoiceResult &&
        !pendingStoryEvent &&
        !roundStartLocked &&
        !humanNeedsLetterChoice &&
        !humanNeedsIdentityChoice &&
        humanNeedsArchiveChoice && (
          <ArchiveChoiceModal
            cardName={ARCHIVE_CARD_SEEDS[session.pendingChoice!.cardId].name}
            flavor={ARCHIVE_CARD_SEEDS[session.pendingChoice!.cardId].flavor}
            options={session.pendingChoice!.options}
            onChoose={handleChooseArchiveOption}
          />
        )}

      {!pendingHumanReveal &&
        !pendingGuessEffect &&
        !pendingForcedDiscard &&
        !pendingEffectBlocked &&
        !pendingElimination &&
        !pendingChoiceResult &&
        !pendingStoryEvent &&
        !roundStartLocked &&
        !humanNeedsLetterChoice &&
        !humanNeedsIdentityChoice &&
        !humanNeedsArchiveChoice &&
        humanNeedsArchivePlacement && (
          <ArchiveTokenModal
            archive={session.storyArchive}
            eligibleArchiveIds={session.roundEndEligibleArchiveIds}
            onPlace={handlePlaceArchiveToken}
            onSkip={handleSkipArchivePlacement}
          />
        )}

      {!pendingHumanReveal &&
        !pendingGuessEffect &&
        !pendingForcedDiscard &&
        !pendingEffectBlocked &&
        !pendingElimination &&
        !pendingChoiceResult &&
        !roundStartLocked &&
        roundOver &&
        session.lastRoundSummary &&
        !endSummaryAcknowledged && (
          <RoundEndSummary
            summary={session.lastRoundSummary}
            players={session.playerConfigs}
            ended={session.ended}
            onContinue={() => {
              getSoundEngine().playClick();
              setEndSummaryAcknowledged(true);
              if (session.ended) {
                return;
              }
            }}
          />
        )}

      {!pendingHumanReveal &&
        !pendingGuessEffect &&
        !pendingForcedDiscard &&
        !pendingEffectBlocked &&
        !pendingElimination &&
        !pendingChoiceResult &&
        !pendingStoryEvent &&
        !roundStartLocked &&
        !needsLetterChoice &&
        !needsIdentityChoice &&
        !needsArchiveChoice &&
        !needsArchivePlacement &&
        roundOver &&
        !session.ended &&
        pendingRoundStart && (
          <RoundStartGate
            upcomingRoundNumber={session.roundNumber + 1}
            route={pendingRoundStart.route}
            chooserName={displayNameFor(pendingRoundStart.chooserId)}
            readOnly={pendingRoundStart.chooserId !== HUMAN_ID}
            optionalCards={pendingRoundStart.optionalCards}
            selectedOptionalCards={pendingRoundStart.selectedOptionalCards}
            onToggleOptionalCard={(cardName) =>
              setPendingRoundStart((prev) => {
                if (!prev) return prev;
                const routeSwapCards = new Set<CardName>(["공주", "왕자", "공주둘째", "공주셋째"]);
                const defaultRank8Card: CardName = prev.route === "왕자" ? "왕자" : "공주";
                const selected = routeSwapCards.has(cardName)
                  ? cardName === defaultRank8Card
                    ? prev.selectedOptionalCards.filter((name) => !routeSwapCards.has(name))
                    : [...prev.selectedOptionalCards.filter((name) => !routeSwapCards.has(name)), cardName]
                  : prev.selectedOptionalCards.includes(cardName)
                    ? prev.selectedOptionalCards.filter((name) => name !== cardName)
                    : [...prev.selectedOptionalCards, cardName];
                return { ...prev, selectedOptionalCards: selected };
              })
            }
            onStart={() =>
              proceedToNextRound(
                routeForSelection(pendingRoundStart.route, pendingRoundStart.selectedOptionalCards),
                pendingRoundStart.selectedOptionalCards
              )
            }
          />
        )}

      {!pendingHumanReveal &&
        !pendingGuessEffect &&
        !pendingForcedDiscard &&
        !pendingEffectBlocked &&
        !pendingElimination &&
        !pendingChoiceResult &&
        !pendingStoryEvent &&
        !roundStartLocked &&
        roundOver &&
        session.ended &&
        endSummaryAcknowledged &&
        (endingSceneDone ? (
          <SessionEndScreen
            session={session}
            players={session.playerConfigs}
            onNewGame={() => {
              setSession(null);
              setUiScreen("setup");
            }}
          />
        ) : (
          <EndingSequence session={session} humanId={HUMAN_ID} onComplete={handleEndingSequenceComplete} />
        ))}

      <button type="button" className="flow-status-fab" onClick={() => setShowFlowStatus(true)}>
        진행 확인
      </button>
      <SoundControls />

      {showFlowStatus && (
        <FlowStatusModal
          aiTasks={aiTasks}
          playerTasks={playerTasks}
          blockers={blockerItems}
          onClose={() => setShowFlowStatus(false)}
        />
      )}
    </div>
  );
}
