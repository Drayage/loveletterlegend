/**
 * 세션 진행(플로우)의 단일 상태 기계.
 *
 * 이 저장소에서 가장 많이 반복된 버그는 "스토리 이벤트 x AI 턴 x 라운드
 * 전환" 교착이었다. 원인은 App.tsx가 13개의 useState와 5개의 useEffect로
 * 흐름을 나눠서 들고, 그것들을 OR로 묶은 `flowBlocked` 불리언 하나로 AI를
 * 막던 구조였다 -- 새 팝업이나 새 선택 단계가 생길 때마다 개별 게이트가
 * 하나씩 늘어나고, 그중 하나라도 서로를 기다리면 그대로 교착이었다.
 *
 * 그래서 흐름을 다음 두 가지로만 표현한다:
 *
 * 1. **순서가 있는 이벤트 큐** (`FlowState.queue`) -- "지금 처리해야 하는
 *    것"이 항상 `queue[0]` 하나뿐이다. 팝업/선택 화면은 자기가 큐의 머리일
 *    때만 렌더되고, AI는 큐의 머리가 자기 차례일 때만 움직인다. 따라서
 *    "AI 선택은 사용자의 pending 모달/라운드 결과 확인이 끝날 때까지
 *    블로킹된다"는 규칙이 우선순위 표(BUILD ORDER) 한 곳에 명시적으로
 *    적힌다.
 * 2. **명시적 확인(ack) 기록** (`FlowState.acks`) -- 어떤 팝업을 어디까지
 *    봤는지를 id로 남긴다. 큐는 세션 상태 + acks의 순수 함수라서, 큐가
 *    "고장난 상태"로 남을 수 없다 (다시 계산하면 항상 복구된다).
 *
 * 큐는 전부 JSON 직렬화 가능한 평범한 데이터라 structuredClone과
 * 네트워크 전송(net/)을 그대로 통과한다.
 */
import type { ArchiveCardState, CardName, PendingDecision } from "./types";
// 타입만 가져온다 -- session.ts가 이 모듈의 createInitialFlowState를 값으로
// 임포트하므로, 여기서 값을 가져오면 런타임 순환 의존이 된다.
import type { Route, SessionState } from "./session";

export type FlowEventKind =
  /** 나(뷰어)만 봐야 하는 비공개 공개 정보 */
  | "reveal"
  /** 공개 효과 팝업들 */
  | "guessEffect"
  | "forcedDiscard"
  | "effectBlocked"
  | "elimination"
  /** 시나리오 "선택" 분기의 결과 */
  | "choiceResult"
  /** 라운드 결과 요약 확인 */
  | "roundSummary"
  /** 새로 공개된 이야기 보관소 카드 설명 */
  | "storyEvent"
  /** 라운드 시작 이벤트를 다 읽은 뒤의 "N주차 진행" 게이트 */
  | "roundStartGate"
  /** 세션 종료(엔딩 연출 -> 결과 화면) */
  | "sessionEnd"
  /** 세션 레이어의 선택 단계들 (사람이면 모달, AI면 자동 처리) */
  | "letterChoice"
  | "identityChoice"
  | "archiveChoice"
  | "archivePlacement"
  /** 다음 주차 덱 구성 + 시작 버튼 */
  | "roundStartSetup"
  /** 라운드 중 실제 카드 결정 */
  | "decision";

export interface FlowEvent {
  kind: FlowEventKind;
  /** 중복 확인 방지용 키 (팝업 id 등) -- acks가 이 값을 기록한다. */
  id: string;
  /** 이 이벤트를 처리해야 하는 플레이어. null이면 "로컬 뷰어가 확인" */
  actorId: string | null;
  /** storyEvent 전용: 아직 읽지 않은 보관소 카드 id들 (표시 순서) */
  cardIds?: string[];
}

export type FlowKind =
  /** 큐가 비어 있음 -- 아무도 기다리지 않는다 */
  | "idle"
  /** 로컬 뷰어가 팝업을 확인해야 함 */
  | "awaitingHumanAck"
  /** 새 이야기 이벤트를 읽어야 함 */
  | "awaitingStoryEvent"
  /** 로컬 뷰어(또는 사람 자리)의 선택 입력이 필요함 */
  | "awaitingHumanInput"
  /** AI가 움직일 차례 -- flowDriver가 처리한다 */
  | "awaitingAIDecision"
  /** 세션 종료 화면 */
  | "sessionEnded";

export interface FlowAcks {
  revealId: string | null;
  guessEffectId: string | null;
  forcedDiscardId: string | null;
  effectBlockedId: string | null;
  eliminationId: string | null;
  shownChoiceResultCardId: string | null;
  /** 확인이 끝난 라운드 요약의 roundNumber */
  roundSummaryRound: number | null;
  /** 이미 읽은 보관소 카드 id들 */
  shownArchiveIds: string[];
  /** 이 roundNumber인 동안에는 패를 감추고 시작 게이트를 띄운다 */
  roundStartLockedNumber: number | null;
  /** 엔딩 연출을 끝까지 재생했는지 */
  endingSceneDone: boolean;
}

/** 다음 주차 준비 화면의 편집 가능한 상태 (사용자가 8번 카드를 토글한다). */
export interface RoundStartPlan {
  route: Route;
  chooserId: string;
  optionalCards: CardName[];
  selectedOptionalCards: CardName[];
}

export interface FlowState {
  kind: FlowKind;
  /** 머리(queue[0])만이 "지금 처리 대상"이다. */
  queue: FlowEvent[];
  acks: FlowAcks;
  roundStart: RoundStartPlan | null;
  /** 참고용 오버레이(카드 확인/보관소/진행 확인)가 열려 있는 동안에는
   * 자동 진행(AI)을 멈춘다 -- 예전 flowBlocked의 showXxx 항목들과 동일한
   * 역할이지만, 개별 게이트가 아니라 플로우 상태의 명시적 필드다. */
  overlay: FlowOverlay;
  /** AI 처리가 폴백까지 전부 실패한 이벤트 id -- 같은 이벤트로 무한
   * 재시도하지 않도록 명시적으로 남긴다 (진행 확인 탭에 노출된다). */
  stalledEventId: string | null;
}

export type FlowOverlay = "cardReference" | "storyArchive" | "flowStatus" | null;

export function createInitialAcks(): FlowAcks {
  return {
    revealId: null,
    guessEffectId: null,
    forcedDiscardId: null,
    effectBlockedId: null,
    eliminationId: null,
    shownChoiceResultCardId: null,
    roundSummaryRound: null,
    shownArchiveIds: [],
    // 세션의 첫 라운드는 항상 시작 게이트로 시작한다 (기존 동작 유지).
    roundStartLockedNumber: 1,
    endingSceneDone: false,
  };
}

export function createInitialFlowState(): FlowState {
  return {
    kind: "idle",
    queue: [],
    acks: createInitialAcks(),
    roundStart: null,
    overlay: null,
    stalledEventId: null,
  };
}

function flowStateOf(session: SessionState): FlowState {
  return session.flowState ?? createInitialFlowState();
}

/** 라운드 시작 잠금: 이 라운드의 패를 아직 공개하지 않았다. */
export function isRoundStartLocked(session: SessionState): boolean {
  return flowStateOf(session).acks.roundStartLockedNumber === session.roundNumber;
}

/** AI 결정 이벤트의 안정적인 id -- 같은 결정을 두 번 처리하지 않도록
 * 결정 내용 전체를 키로 쓴다 (예전 App.tsx의 decisionKey와 동일). */
export function decisionKey(decision: PendingDecision): string {
  if (decision.kind === "playCard") {
    return `${decision.kind}:${decision.playerId}:${decision.options.map((c) => c.instanceId).join(",")}`;
  }
  if (decision.kind === "chooseTarget") {
    return `${decision.kind}:${decision.playerId}:${decision.cardInstanceId}:${decision.eligiblePlayerIds.join(",")}`;
  }
  if (decision.kind === "guessCard") {
    return `${decision.kind}:${decision.playerId}:${decision.cardInstanceId}:${decision.targetId}:${decision.guesses?.join(",") ?? ""}`;
  }
  if (decision.kind === "identityReplaceEffect") {
    return `${decision.kind}:${decision.playerId}:${decision.cardInstanceId}:${decision.options.map((c) => c.instanceId).join(",")}`;
  }
  if (decision.kind === "identityCancel") {
    return `${decision.kind}:${decision.playerId}:${decision.cardInstanceId}:${decision.targetId}`;
  }
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

/** AI가 라운드 선(리더)일 때의 라운드 시작 선택: 공주/왕자 카드는 현재
 * 라우트를 유지하고, 스토리로 열린 추가 8번 카드(백작부인/귀족영애 등)는
 * 전부 덱에 넣는다 -- 이야기 진행 조건이 걸린 카드들이라 넣는 쪽이 이야기를
 * 앞으로 굴린다. */
export function chooseRoundStartCardsAI(optionalCards: CardName[]): CardName[] {
  const routeSwapCards = new Set<CardName>(["공주", "왕자", "공주둘째", "공주셋째"]);
  return optionalCards.filter((name) => !routeSwapCards.has(name));
}

/** 라운드 시작 게이트에서 고른 8번 카드가 곧 그 라운드의 라우트다 --
 * 「왕자」를 고르면 currentRoute도 왕자로 전환되어야 편지 배치 기본값과
 * 050 「역사 8」 판정이 덱 구성과 어긋나지 않는다. 공주(둘째/셋째)는
 * 별도 라우트가 아니므로 기존 라우트를 유지한다. */
export function routeForSelection(currentRoute: Route, selected: CardName[]): Route {
  if (selected.includes("왕자")) return "왕자";
  if (selected.includes("공주")) return "공주";
  return currentRoute;
}

function ev(kind: FlowEventKind, id: string, actorId: string | null = null): FlowEvent {
  return { kind, id, actorId };
}

/**
 * 큐 구성 (BUILD ORDER).
 *
 * 이 순서가 곧 "무엇이 무엇을 막는가"의 유일한 정의다. 위에 있을수록 먼저
 * 처리되며, AI 관련 항목(letterChoice/identityChoice/archiveChoice/
 * archivePlacement/decision)이 전부 아래쪽에 있다는 사실이 "AI는 사람의
 * 팝업/라운드 결과 확인이 끝난 뒤에만 움직인다"는 규칙 그 자체다.
 */
function buildQueue(
  session: SessionState,
  viewerId: string,
  acks: FlowAcks,
  roundStart: RoundStartPlan | null
): FlowEvent[] {
  const queue: FlowEvent[] = [];
  const round = session.round;
  const locked = flowLocked(session, acks);

  // 라운드 시작 잠금 중에는 지난 라운드의 효과 팝업을 다시 띄우지 않는다.
  if (!locked) {
    const reveal = round.lastReveal;
    if (reveal && (reveal.viewerPlayerId === viewerId || reveal.compare) && reveal.id !== acks.revealId) {
      queue.push(ev("reveal", reveal.id));
    }
    const guess = round.lastGuessEffect;
    if (guess && guess.id !== acks.guessEffectId) queue.push(ev("guessEffect", guess.id));
    const forced = round.lastForcedDiscard;
    if (forced && forced.id !== acks.forcedDiscardId) queue.push(ev("forcedDiscard", forced.id));
    const blocked = round.lastEffectBlocked;
    if (blocked && blocked.id !== acks.effectBlockedId) queue.push(ev("effectBlocked", blocked.id));
    const elimination = round.lastElimination;
    if (elimination && elimination.id !== acks.eliminationId) queue.push(ev("elimination", elimination.id));
  }

  const choiceResult = session.lastResolvedChoice;
  if (choiceResult && choiceResult.cardId !== acks.shownChoiceResultCardId) {
    queue.push(ev("choiceResult", choiceResult.cardId));
  }

  const summary = session.lastRoundSummary;
  const summaryPending = Boolean(
    round.roundResult && summary && acks.roundSummaryRound !== summary.roundNumber
  );
  const summaryEvent = () => ev("roundSummary", `summary-${summary!.roundNumber}`);
  // 잠금 중이 아니면 요약을 먼저 확인시킨다. 잠금 중(=새 라운드가 배분
  // 직후 패시브로 즉시 끝난 경우)에는 시작 이벤트 -> 시작 게이트 -> 요약
  // 순서여야 한다. 예전에는 이 셋이 서로를 기다려 교착이 났던 지점이다.
  if (summaryPending && !locked) queue.push(summaryEvent());

  const unseenArchive = Object.values(session.archiveHistory)
    .filter((card: ArchiveCardState) => !acks.shownArchiveIds.includes(card.id))
    .map((card: ArchiveCardState) => card.id);
  if (unseenArchive.length > 0) {
    queue.push({ kind: "storyEvent", id: `story-${unseenArchive[0]}`, actorId: null, cardIds: unseenArchive });
  }

  if (locked) queue.push(ev("roundStartGate", `gate-${session.roundNumber}`));
  if (summaryPending && locked) queue.push(summaryEvent());

  if (round.roundResult && session.ended && !summaryPending) {
    queue.push(ev("sessionEnd", `session-end-${session.roundNumber}`));
  }

  const letter = session.pendingLetterChoice;
  if (letter) {
    queue.push(ev("letterChoice", `letter-${letter.playerId}-${letter.amount}-${session.roundNumber}`, letter.playerId));
  }
  const identity = session.pendingIdentityChoice;
  if (identity) {
    queue.push(
      ev("identityChoice", `identity-${identity.eligiblePlayerId}-${session.roundNumber}`, identity.eligiblePlayerId)
    );
  }
  const archiveChoice = session.pendingChoice;
  if (archiveChoice) {
    queue.push(ev("archiveChoice", `choice-${archiveChoice.cardId}`, archiveChoice.eligiblePlayerId));
  }
  const placement = session.pendingArchivePlacement;
  if (placement) {
    queue.push(
      ev("archivePlacement", `archive-${placement.eligiblePlayerId}-${session.roundNumber}`, placement.eligiblePlayerId)
    );
  }

  // 다음 주차 준비 화면은 (AI가 선을 잡았더라도) 로컬 뷰어가 "시작"을
  // 눌러야 넘어간다 -- 그래서 actorId는 항상 null이다.
  if (roundStart) queue.push(ev("roundStartSetup", `round-start-${session.roundNumber}`));

  const decision = round.pendingDecision;
  if (decision && !round.roundResult) {
    queue.push(ev("decision", decisionKey(decision), decision.playerId));
  }

  return queue;
}

function flowLocked(session: SessionState, acks: FlowAcks): boolean {
  return acks.roundStartLockedNumber === session.roundNumber;
}

/** roundStartSetup은 그 앞의 모든 단계가 끝난 뒤 정확히 한 번 만들어진다
 * (기존 useEffect의 긴 조건 목록과 동일하지만, "내 앞의 큐가 비었는가"
 * 하나로 표현된다). */
function shouldPlanNextRound(session: SessionState, queueWithoutPlan: FlowEvent[]): boolean {
  if (!session.round.roundResult || session.ended) return false;
  return queueWithoutPlan.every((event) => event.kind === "decision");
}

function planNextRound(session: SessionState, viewerId: string): RoundStartPlan {
  const optionalCards = session.optionalRoundDeckCardNames ?? [];
  const chooserId = session.lastRoundSummary?.winnerId ?? session.playerConfigs[0]?.id ?? viewerId;
  return {
    route: session.currentRoute,
    chooserId,
    optionalCards,
    selectedOptionalCards:
      chooserId === viewerId
        ? session.activeOptionalRoundDeckCardNames.filter((name) => optionalCards.includes(name))
        : chooseRoundStartCardsAI(optionalCards),
  };
}

function kindFor(session: SessionState, head: FlowEvent | undefined): FlowKind {
  if (!head) return session.ended ? "sessionEnded" : "idle";
  if (head.kind === "storyEvent") return "awaitingStoryEvent";
  if (head.kind === "sessionEnd") return "sessionEnded";
  if (head.actorId === null) return head.kind === "roundStartSetup" ? "awaitingHumanInput" : "awaitingHumanAck";
  const actor = session.playerConfigs.find((p) => p.id === head.actorId);
  return actor?.isAI ? "awaitingAIDecision" : "awaitingHumanInput";
}

/**
 * 엔진/세션 상태가 바뀔 때마다 정확히 한 번 호출되는 단일 진입점 --
 * 큐와 kind를 세션 상태로부터 다시 계산한다. 순수 함수이므로 언제 몇 번을
 * 호출하든 같은 결과가 나오고, 큐가 잘못된 상태로 "굳는" 일이 없다.
 */
export function recomputeFlow(session: SessionState, viewerId: string): SessionState {
  const base = flowStateOf(session);
  let roundStart = base.roundStart;
  let queue = buildQueue(session, viewerId, base.acks, roundStart);
  if (!roundStart && shouldPlanNextRound(session, queue)) {
    roundStart = planNextRound(session, viewerId);
    queue = buildQueue(session, viewerId, base.acks, roundStart);
  }
  const stalledEventId =
    base.stalledEventId && queue.some((event) => event.id === base.stalledEventId) ? base.stalledEventId : null;
  return {
    ...session,
    flowState: { ...base, queue, roundStart, stalledEventId, kind: kindFor(session, queue[0]) },
  };
}

export function flowHead(session: SessionState): FlowEvent | null {
  return flowStateOf(session).queue[0] ?? null;
}

/** 큐의 머리가 이 종류일 때만 참 -- 렌더 조건은 전부 이걸 쓴다. */
export function isFlowHead(session: SessionState, kind: FlowEventKind): boolean {
  return flowHead(session)?.kind === kind;
}

function withFlow(session: SessionState, patch: Partial<FlowState>): SessionState {
  return { ...session, flowState: { ...flowStateOf(session), ...patch } };
}

function withAcks(session: SessionState, patch: Partial<FlowAcks>): SessionState {
  const flow = flowStateOf(session);
  return { ...session, flowState: { ...flow, acks: { ...flow.acks, ...patch } } };
}

/**
 * 큐의 머리를 "확인했다"고 표시하고 다음 상태로 넘어간다 -- 팝업의 모든
 * onDismiss/onNext가 이 하나의 전이를 쓴다.
 *
 * `count`는 storyEvent 전용(한 번에 넘길 카드 수).
 */
export function ackFlowEvent(session: SessionState, viewerId: string, count = 1): SessionState {
  const head = flowHead(session);
  if (!head) return session;
  let next = session;
  switch (head.kind) {
    case "reveal":
      next = withAcks(session, { revealId: head.id });
      break;
    case "guessEffect": {
      const guess = session.round.lastGuessEffect;
      // 추측 적중은 그 자체로 탈락까지 설명하므로, 뒤따르는 일반
      // 탈락 팝업은 같이 확인 처리해 중복 안내를 막는다.
      const alsoElimination = guess?.hit && session.round.lastElimination
        ? { eliminationId: session.round.lastElimination.id }
        : {};
      next = withAcks(session, { guessEffectId: head.id, ...alsoElimination });
      break;
    }
    case "forcedDiscard":
      next = withAcks(session, { forcedDiscardId: head.id });
      break;
    case "effectBlocked":
      next = withAcks(session, { effectBlockedId: head.id });
      break;
    case "elimination":
      next = withAcks(session, { eliminationId: head.id });
      break;
    case "choiceResult":
      next = withAcks(session, { shownChoiceResultCardId: head.id });
      break;
    case "roundSummary":
      next = withAcks(session, { roundSummaryRound: session.lastRoundSummary?.roundNumber ?? null });
      break;
    case "storyEvent": {
      const ids = head.cardIds ?? [];
      const flow = flowStateOf(session);
      next = withAcks(session, {
        shownArchiveIds: [...flow.acks.shownArchiveIds, ...ids.slice(0, Math.max(1, count))],
      });
      break;
    }
    case "roundStartGate":
      next = withAcks(session, { roundStartLockedNumber: null });
      break;
    case "sessionEnd":
      next = withAcks(session, { endingSceneDone: true });
      break;
    default:
      // 행동이 필요한 이벤트(letterChoice/decision 등)는 ack로 지워지지
      // 않는다 -- 엔진 액션이 해소해야 한다.
      return session;
  }
  return recomputeFlow(next, viewerId);
}

/** 참고용 오버레이 열기/닫기 (열려 있는 동안 AI 자동 진행 정지). */
export function setFlowOverlay(session: SessionState, overlay: FlowOverlay, viewerId: string): SessionState {
  return recomputeFlow(withFlow(session, { overlay }), viewerId);
}

/** 다음 주차 준비 화면에서 추가 8번 카드를 토글한다. */
export function setRoundStartSelection(
  session: SessionState,
  selectedOptionalCards: CardName[],
  viewerId: string
): SessionState {
  const flow = flowStateOf(session);
  if (!flow.roundStart) return session;
  return recomputeFlow(withFlow(session, { roundStart: { ...flow.roundStart, selectedOptionalCards } }), viewerId);
}

/** 다음 라운드가 실제로 시작될 때의 플로우 전이: 준비 화면을 비우고 새
 * 라운드를 다시 시작 잠금 상태로 둔다. */
export function enterRound(session: SessionState, viewerId: string): SessionState {
  const flow = flowStateOf(session);
  return recomputeFlow(
    {
      ...session,
      flowState: {
        ...flow,
        roundStart: null,
        stalledEventId: null,
        acks: { ...flow.acks, roundStartLockedNumber: session.roundNumber },
      },
    },
    viewerId
  );
}

/** AI 처리가 폴백까지 전부 실패했을 때의 명시적 전이 -- 같은 이벤트를
 * 무한히 재시도하는 대신 한 번 멈췄다고 기록한다. */
export function markFlowStalled(session: SessionState, eventId: string, viewerId: string): SessionState {
  return recomputeFlow(withFlow(session, { stalledEventId: eventId }), viewerId);
}

/** AI가 지금 움직여도 되는가 -- 큐의 머리가 그 AI의 차례이고, 참고용
 * 오버레이가 열려 있지 않고, 이미 실패로 멈춘 이벤트가 아닐 때만. */
export function pendingAIEvent(session: SessionState): FlowEvent | null {
  const flow = flowStateOf(session);
  if (flow.kind !== "awaitingAIDecision") return null;
  if (flow.overlay) return null;
  const head = flow.queue[0];
  if (!head || head.id === flow.stalledEventId) return null;
  return head;
}
