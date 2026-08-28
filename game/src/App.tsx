import { useEffect, useRef, useState } from "react";
import type { CardName, PendingDecision, PlayerConfig } from "./engine/types";
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
  availableRank8LetterSlots,
} from "./engine/session";
import type { CharacterSlotId, LetterChoice, Route, SessionState } from "./engine/session";
import {
  ackFlowEvent,
  enterRound,
  flowHead,
  isRoundStartLocked,
  pendingAIEvent,
  recomputeFlow,
  routeForSelection,
  setFlowOverlay,
  setRoundStartSelection,
} from "./engine/flow";
import type { FlowEvent, FlowOverlay } from "./engine/flow";
import { runAIStep, safely } from "./engine/flowDriver";
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

/** AI가 "생각하는" 것처럼 보이게 하는 지연 -- 플로우 큐의 머리가 AI
 * 차례일 때 이 시간 뒤에 engine/flowDriver가 한 걸음 진행한다. */
const AI_THINK_DELAY_MS = 700;

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

/** 진행 확인 탭에 보여줄 한 줄 설명 -- 플로우 큐의 이벤트를 그대로
 * 사람이 읽을 수 있는 문장으로 옮긴다 (예전처럼 각 팝업별 조건을 다시
 * 세는 게 아니라, 실제 큐를 그대로 비춘다). */
function flowEventText(
  session: SessionState,
  event: FlowEvent,
  displayNameFor: (playerId: string) => string
): { title: string; detail: string } {
  switch (event.kind) {
    case "reveal":
      return { title: "비공개 공개 팝업", detail: "내가 확인해야 하는 카드 정보가 떠 있습니다." };
    case "guessEffect":
      return { title: "추측 결과 팝업", detail: "경비병/신병 추측 결과를 확인해야 합니다." };
    case "forcedDiscard":
      return { title: "강제 버림 팝업", detail: "마술사 계열 효과로 버려진 카드를 확인해야 합니다." };
    case "effectBlocked":
      return { title: "효과 차단 알림", detail: "보호 등으로 효과가 막힌 내용을 확인해야 합니다." };
    case "elimination":
      return {
        title: "탈락 팝업",
        detail: `${displayNameFor(session.round.lastElimination?.playerId ?? "")} 탈락 결과를 확인해야 합니다.`,
      };
    case "choiceResult":
      return { title: "이벤트 선택 결과", detail: "방금 선택된 시나리오 분기 결과를 확인해야 합니다." };
    case "storyEvent":
      return {
        title: "이야기 이벤트",
        detail: `${event.cardIds?.length ?? 0}개 이벤트 설명을 읽어야 다음 단계로 갑니다.`,
      };
    case "roundSummary":
      return { title: "라운드 결과 확인", detail: "결과 확인 버튼을 눌러야 후속 이벤트와 선택이 진행됩니다." };
    case "roundStartGate":
      return { title: "라운드 시작 확인", detail: "시작 이벤트를 다 읽은 뒤 주차 진행 버튼을 눌러야 패가 공개됩니다." };
    case "sessionEnd":
      return { title: "세션 종료", detail: "엔딩 연출과 결과 화면을 확인합니다." };
    case "letterChoice":
      return {
        title: "편지 토큰 선택",
        detail: `${displayNameFor(event.actorId ?? "")}이(가) 편지 ${session.pendingLetterChoice?.amount ?? 1}개를 받을 대상을 골라야 합니다.`,
      };
    case "identityChoice":
      return {
        title: "정체 선택",
        detail: `${displayNameFor(event.actorId ?? "")}이(가) 정체와 성별을 골라야 합니다.`,
      };
    case "archiveChoice":
      return {
        title: "시나리오 선택",
        detail: `${displayNameFor(event.actorId ?? "")}이(가) 「${
          ARCHIVE_CARD_SEEDS[session.pendingChoice?.cardId ?? ""]?.name ?? "이야기"
        }」 선택지를 골라야 합니다.`,
      };
    case "archivePlacement":
      return {
        title: "이야기 보관소 토큰 배치",
        detail: `${displayNameFor(event.actorId ?? "")}이(가) 성공/실패 토큰을 놓아야 합니다.`,
      };
    case "roundStartSetup":
      return { title: "다음 주차 준비", detail: "공주/왕자 카드와 추가 8번 카드를 선택한 뒤 시작해야 합니다." };
    case "decision":
      return {
        title: `${displayNameFor(event.actorId ?? "")} 턴`,
        detail: session.round.pendingDecision ? decisionLabel(session.round.pendingDecision) : "카드 결정 대기 중",
      };
  }
}

const OVERLAY_TEXT: Record<Exclude<FlowOverlay, null>, { title: string; detail: string }> = {
  cardReference: { title: "카드 확인 창", detail: "카드 목록 창을 닫으면 진행됩니다." },
  storyArchive: { title: "이야기 보관소 창", detail: "보관소 창을 닫으면 진행됩니다." },
  flowStatus: { title: "진행 확인 탭 열림", detail: "이 탭을 닫으면 자동 진행이 다시 움직입니다." },
};

export default function App() {
  const [session, setSession] = useState<SessionState | null>(null);
  const [uiScreen, setUiScreen] = useState<"title" | "setup" | "records">("title");
  // 세션 하나당 기록보관실 저장은 정확히 한 번만 -- 엔딩 연출이 끝난
  // 뒤 리렌더가 여러 번 일어나도 localStorage에 중복 누적되지 않도록.
  const recordedEndingRef = useRef(false);

  /** 세션을 바꾸는 유일한 진입점: 엔진/플로우 호출 뒤 항상 큐를 다시
   * 계산한다. 실패하면(예외) 이전 상태를 그대로 유지한다. */
  function updateSession(fn: (prev: SessionState) => SessionState | null) {
    setSession((prev) => {
      if (!prev) return prev;
      const next = safely(() => fn(prev)) ?? prev;
      return next === prev ? prev : recomputeFlow(next, HUMAN_ID);
    });
  }

  const round = session?.round ?? null;
  const head = session ? flowHead(session) : null;
  const aiEventId = session ? (pendingAIEvent(session)?.id ?? null) : null;

  // 유일한 자동 진행 루프: 큐의 머리가 AI 차례일 때만 한 걸음 굴린다.
  // (예전에는 결정 종류마다 별도의 effect + "이미 처리함" ref가 있었고,
  // 그 조합이 이 저장소의 교착 버그 대부분의 원인이었다.)
  useEffect(() => {
    if (!aiEventId) return;
    const timer = setTimeout(() => {
      setSession((prev) => {
        if (!prev) return prev;
        const pending = pendingAIEvent(prev);
        if (!pending || pending.id !== aiEventId) return prev;
        return runAIStep(prev, HUMAN_ID);
      });
    }, AI_THINK_DELAY_MS);
    return () => clearTimeout(timer);
  }, [session, aiEventId]);

  // 기록보관실 저장은 엔딩씬(EndingSequence)이 끝까지 재생된 뒤 그
  // 결과(진엔딩 성공 여부 포함)를 갖고 정확히 한 번 호출한다.
  function handleEndingSequenceComplete(
    identityName: string | null,
    endingSlot: CharacterSlotId | null,
    wasTrueEnding: boolean
  ) {
    if (!recordedEndingRef.current) {
      recordedEndingRef.current = true;
      recordSessionEnding(identityName, endingSlot, wasTrueEnding);
    }
    updateSession((prev) => ackFlowEvent(prev, HUMAN_ID));
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

  const storyHeadFirstCardId = head?.kind === "storyEvent" ? (head.cardIds?.[0] ?? null) : null;
  useEffect(() => {
    if (!storyHeadFirstCardId) return;
    getSoundEngine().playStoryReveal();
  }, [storyHeadFirstCardId]);

  const sessionEnding = head?.kind === "sessionEnd";
  useEffect(() => {
    if (sessionEnding) getSoundEngine().playSessionEnd();
  }, [sessionEnding]);

  function startGame(players: PlayerConfig[]) {
    recordedEndingRef.current = false;
    setSession(recomputeFlow(startSession(players), HUMAN_ID));
  }

  function openOverlay(overlay: FlowOverlay) {
    updateSession((prev) => setFlowOverlay(prev, overlay, HUMAN_ID));
  }

  /** 모든 팝업의 "확인"은 플로우 큐의 머리를 소비하는 단 하나의 전이다. */
  function acknowledge(count = 1) {
    updateSession((prev) => ackFlowEvent(prev, HUMAN_ID, count));
  }

  function handleSelectCard(instanceId: string) {
    updateSession((prev) => applyToRound(prev, (s) => chooseCardToPlay(s, instanceId)));
  }
  function handleChooseTarget(targetId: string) {
    getSoundEngine().playTargetLock();
    updateSession((prev) => applyToRound(prev, (s) => chooseTarget(s, targetId)));
  }
  function handleChooseGuess(name: Parameters<typeof chooseGuess>[1]) {
    getSoundEngine().playClick();
    updateSession((prev) => applyToRound(prev, (s) => chooseGuess(s, name)));
  }
  function handleIdentitySwap(use: boolean) {
    updateSession((prev) => applyToRound(prev, (s) => chooseIdentitySwap(s, use)));
  }
  function handleIdentityCancel(use: boolean) {
    updateSession((prev) => applyToRound(prev, (s) => chooseIdentityCancel(s, use)));
  }
  function handleIdentityReplacement(instanceId: string | null) {
    updateSession((prev) => applyToRound(prev, (s) => chooseIdentityReplacement(s, instanceId)));
  }
  function handleIdentityExtraTurn(use: boolean) {
    updateSession((prev) => applyToRound(prev, (s) => chooseIdentityExtraTurn(s, use)));
  }
  function handleFortunePath(path: "peek" | "coWin") {
    updateSession((prev) => applyToRound(prev, (s) => chooseFortunePath(s, path)));
  }
  function handleDeckSwap(swap: boolean) {
    updateSession((prev) => applyToRound(prev, (s) => chooseDeckSwap(s, swap)));
  }
  function handleTacticianSwap(swap: boolean) {
    updateSession((prev) => applyToRound(prev, (s) => chooseTacticianSwap(s, swap)));
  }
  function handleReuseCard(instanceId: string) {
    updateSession((prev) => applyToRound(prev, (s) => chooseReuseCard(s, instanceId)));
  }
  function handleHandDiscard(instanceId: string) {
    updateSession((prev) => applyToRound(prev, (s) => chooseHandDiscard(s, instanceId)));
  }
  function handleRegentChoice(choice: "immune" | "eliminate") {
    updateSession((prev) => applyToRound(prev, (s) => chooseRegentChoice(s, choice)));
  }
  function handleWitchAssign(instanceId: string) {
    updateSession((prev) => applyToRound(prev, (s) => chooseWitchAssign(s, instanceId)));
  }

  function proceedToNextRound(route: Route, selectedOptionalCards: CardName[] = []) {
    updateSession((prev) => enterRound(beginNextRound(prev, route, selectedOptionalCards), HUMAN_ID));
  }

  function handlePlaceArchiveToken(cardId: string, token: "성공" | "실패") {
    updateSession((prev) => placeArchiveToken(prev, HUMAN_ID, cardId, token));
  }
  function handleSkipArchivePlacement() {
    updateSession((prev) => skipArchivePlacement(prev, HUMAN_ID));
  }

  function handleLetterChoice(choice: LetterChoice) {
    if (choice.type === "place") getSoundEngine().playLetterGain();
    updateSession((prev) => resolveLetterChoice(prev, HUMAN_ID, choice));
  }

  function handleChooseIdentity(identityId: string, variantId: IdentityVariantId) {
    updateSession((prev) => chooseIdentity(prev, HUMAN_ID, identityId, variantId));
  }

  function handleChooseArchiveOption(optionId: string) {
    updateSession((prev) => resolveArchiveChoice(prev, HUMAN_ID, optionId));
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

  const flow = session.flowState;
  const overlay = flow.overlay;
  const headIs = (kind: FlowEvent["kind"]) => head?.kind === kind;
  const headActorIsHuman = head?.actorId === HUMAN_ID;
  const roundStartLocked = isRoundStartLocked(session);

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

  const concealRoundStart = roundStartLocked;
  // 카드별 강화 배지/설명은 "누구의 편지 진행도인지"에 따라 달라지므로
  // 플레이어별로 따로 계산한다.
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
  // 짧은 문장으로 함께 보여준다.
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
    CHARACTER_SLOTS.map((slot) => [slot, session.letterTokens[slot]?.[HUMAN_ID] ?? 0])
  ) as Record<CharacterSlotId, number>;

  // 진행 확인 탭: 예전엔 팝업 조건을 다시 한 번 세어 만들었지만, 이제는
  // 플로우 큐를 그대로 비춘다 -- 화면에 보이는 것과 어긋날 수가 없다.
  const aiTasks: FlowStatusItem[] = [];
  const playerTasks: FlowStatusItem[] = [];
  const blockers: FlowStatusItem[] = [];
  if (overlay) blockers.push({ ...OVERLAY_TEXT[overlay], tone: "waiting" });
  flow.queue.forEach((event, index) => {
    const text = flowEventText(session, event, displayNameFor);
    const isHead = index === 0 && !overlay;
    const actor = event.actorId ? session.playerConfigs.find((p) => p.id === event.actorId) : null;
    const item: FlowStatusItem = {
      ...text,
      detail: isHead ? text.detail : `${text.detail} - 앞의 단계를 먼저 처리해야 합니다.`,
      tone: isHead ? "ready" : "blocked",
    };
    if (actor?.isAI) aiTasks.push(item);
    else playerTasks.push(item);
    if (!actor?.isAI) blockers.push(item);
  });
  if (flow.stalledEventId) {
    blockers.push({
      title: "자동 진행 실패",
      detail: "AI 처리가 폴백까지 실패해 멈춰 있습니다. 진행 확인 후 다시 시도하세요.",
      tone: "blocked",
    });
  }
  if (aiTasks.length === 0) {
    aiTasks.push({
      title: "AI 자동 처리 없음",
      detail: flow.kind === "awaitingAIDecision" ? "AI 차례를 준비 중입니다." : "AI가 기다리는 결정은 없습니다.",
      tone: "ready",
    });
  }
  if (playerTasks.length === 0) {
    playerTasks.push({ title: "내가 할 일 없음", detail: "현재 필요한 내 선택은 없습니다.", tone: "ready" });
  }
  const blockerItems =
    blockers.length > 0
      ? blockers
      : [{ title: "막는 요소 없음", detail: "자동 진행을 막는 팝업이나 선택창이 없습니다.", tone: "ready" as const }];

  return (
    <div className="app-layout">
      <SessionHeader
        session={session}
        humanId={HUMAN_ID}
        onShowArchive={() => openOverlay("storyArchive")}
        onShowFlowStatus={() => openOverlay("flowStatus")}
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
          <button type="button" className="removed-row__reference-btn" onClick={() => openOverlay("cardReference")}>
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

      {overlay === "cardReference" && (
        <CardReferenceModal session={session} onClose={() => openOverlay(null)} />
      )}
      {overlay === "storyArchive" && (
        <StoryArchiveModal
          archive={session.storyArchive}
          archiveHistory={session.archiveHistory}
          clockTokens={session.clockTokens}
          session={session}
          humanId={HUMAN_ID}
          onClose={() => openOverlay(null)}
        />
      )}
      <EffectRevealModal
        reveal={headIs("reveal") ? round.lastReveal : null}
        onDismiss={() => acknowledge()}
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

      {/* 아래 전체화면 모달들은 전부 "플로우 큐의 머리가 나인가?" 하나만
          본다 -- 예전처럼 앞선 팝업들을 하나씩 부정하는 긴 조건 사슬이
          필요 없고, 정의상 동시에 두 개가 뜰 수 없다. 우선순위는
          engine/flow.ts의 BUILD ORDER 한 곳에만 적혀 있다. */}
      {headIs("guessEffect") && round.lastGuessEffect && (
        <GuessEffectModal
          effect={round.lastGuessEffect}
          actingDisplayName={displayNameFor(round.lastGuessEffect.actingPlayerId)}
          targetDisplayName={displayNameFor(round.lastGuessEffect.targetPlayerId)}
          onDismiss={() => acknowledge()}
        />
      )}

      {headIs("forcedDiscard") && round.lastForcedDiscard && (
        <ForcedDiscardModal
          effect={round.lastForcedDiscard}
          actingDisplayName={displayNameFor(round.lastForcedDiscard.actingPlayerId)}
          targetDisplayName={displayNameFor(round.lastForcedDiscard.targetPlayerId)}
          isSelf={round.lastForcedDiscard.actingPlayerId === round.lastForcedDiscard.targetPlayerId}
          onDismiss={() => acknowledge()}
        />
      )}

      {headIs("effectBlocked") && round.lastEffectBlocked && (
        <EffectBlockedModal
          effect={round.lastEffectBlocked}
          actingDisplayName={displayNameFor(round.lastEffectBlocked.actingPlayerId)}
          onDismiss={() => acknowledge()}
        />
      )}

      {headIs("elimination") && round.lastElimination && (
        <EliminationModal
          playerDisplayName={displayNameFor(round.lastElimination.playerId)}
          reason={round.lastElimination.reason}
          onDismiss={() => acknowledge()}
        />
      )}

      {headIs("choiceResult") && session.lastResolvedChoice && (
        <ChoiceResultModal
          info={session.lastResolvedChoice}
          chooserName={displayNameFor(session.lastResolvedChoice.chosenBy)}
          onDismiss={() => acknowledge()}
        />
      )}

      {headIs("storyEvent") && (
        <StoryEventModal
          cards={(head?.cardIds ?? []).map((id) => session.archiveHistory[id]).filter(Boolean)}
          clockTokens={session.clockTokens}
          onNext={(count = 1) => acknowledge(count)}
        />
      )}

      {headIs("roundStartGate") && (
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
                acknowledge();
              }}
            >
              {session.roundNumber}주차 진행
            </button>
          </div>
        </Modal>
      )}

      {headIs("letterChoice") && headActorIsHuman && session.pendingLetterChoice && (
        <LetterTokenChoiceModal
          amount={session.pendingLetterChoice.amount}
          atCap={session.pendingLetterChoice.atCap}
          tokens={humanLetterTokens}
          availableSlots={availableRank8LetterSlots(session)}
          reason={session.pendingLetterChoice.reason}
          onChoose={handleLetterChoice}
        />
      )}

      {headIs("identityChoice") && headActorIsHuman && session.pendingIdentityChoice && (
        <IdentityChoiceModal options={session.pendingIdentityChoice.options} onChoose={handleChooseIdentity} />
      )}

      {headIs("archiveChoice") && headActorIsHuman && session.pendingChoice && (
        <ArchiveChoiceModal
          cardName={ARCHIVE_CARD_SEEDS[session.pendingChoice.cardId].name}
          flavor={ARCHIVE_CARD_SEEDS[session.pendingChoice.cardId].flavor}
          options={session.pendingChoice.options}
          onChoose={handleChooseArchiveOption}
        />
      )}

      {headIs("archivePlacement") && headActorIsHuman && (
        <ArchiveTokenModal
          archive={session.storyArchive}
          eligibleArchiveIds={session.roundEndEligibleArchiveIds}
          onPlace={handlePlaceArchiveToken}
          onSkip={handleSkipArchivePlacement}
        />
      )}

      {headIs("roundSummary") && session.lastRoundSummary && (
        <RoundEndSummary
          summary={session.lastRoundSummary}
          players={session.playerConfigs}
          ended={session.ended}
          onContinue={() => {
            getSoundEngine().playClick();
            acknowledge();
          }}
        />
      )}

      {headIs("roundStartSetup") && flow.roundStart && (
        <RoundStartGate
          upcomingRoundNumber={session.roundNumber + 1}
          route={flow.roundStart.route}
          chooserName={displayNameFor(flow.roundStart.chooserId)}
          readOnly={flow.roundStart.chooserId !== HUMAN_ID}
          optionalCards={flow.roundStart.optionalCards}
          selectedOptionalCards={flow.roundStart.selectedOptionalCards}
          onToggleOptionalCard={(cardName) =>
            updateSession((prev) => {
              const plan = prev.flowState.roundStart;
              if (!plan) return prev;
              const routeSwapCards = new Set<CardName>(["공주", "왕자", "공주둘째", "공주셋째"]);
              const defaultRank8Card: CardName = plan.route === "왕자" ? "왕자" : "공주";
              const selected = routeSwapCards.has(cardName)
                ? cardName === defaultRank8Card
                  ? plan.selectedOptionalCards.filter((name) => !routeSwapCards.has(name))
                  : [...plan.selectedOptionalCards.filter((name) => !routeSwapCards.has(name)), cardName]
                : plan.selectedOptionalCards.includes(cardName)
                  ? plan.selectedOptionalCards.filter((name) => name !== cardName)
                  : [...plan.selectedOptionalCards, cardName];
              return setRoundStartSelection(prev, selected, HUMAN_ID);
            })
          }
          onStart={() =>
            proceedToNextRound(
              routeForSelection(flow.roundStart!.route, flow.roundStart!.selectedOptionalCards),
              flow.roundStart!.selectedOptionalCards
            )
          }
        />
      )}

      {headIs("sessionEnd") &&
        (flow.acks.endingSceneDone ? (
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

      <button type="button" className="flow-status-fab" onClick={() => openOverlay("flowStatus")}>
        진행 확인
      </button>
      <SoundControls />

      {overlay === "flowStatus" && (
        <FlowStatusModal
          aiTasks={aiTasks}
          playerTasks={playerTasks}
          blockers={blockerItems}
          onClose={() => openOverlay(null)}
        />
      )}
    </div>
  );
}
