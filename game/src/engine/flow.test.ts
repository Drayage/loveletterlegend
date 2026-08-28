import { describe, expect, it } from "vitest";
import { applyAiDecision } from "./ai";
import {
  ROUTE_SLOT,
  applyToRound,
  availableRank8LetterSlots,
  beginNextRound,
  chooseIdentity,
  resolveArchiveChoice,
  resolveLetterChoice,
  skipArchivePlacement,
  startSession,
} from "./session";
import type { SessionState } from "./session";
import {
  ackFlowEvent,
  enterRound,
  flowHead,
  isRoundStartLocked,
  pendingAIEvent,
  recomputeFlow,
  setFlowOverlay,
} from "./flow";
import type { FlowEventKind } from "./flow";
import { runAIStep } from "./flowDriver";
import type { PlayerConfig } from "./types";

const PLAYERS: PlayerConfig[] = [
  { id: "p1", displayName: "플레이어", isAI: false },
  { id: "p2", displayName: "AI", isAI: true },
];
const VIEWER = "p1";

function freshSession(): SessionState {
  return recomputeFlow(startSession(PLAYERS), VIEWER);
}

/** App.tsx의 루프를 헤드리스로 재현한다: 큐의 머리가 AI면 flowDriver에게
 * 넘기고, 사람이면 확인/합법적인 기본 선택으로 소비한다. 실제 UI와 같은
 * 단일 진입점(플로우 큐)만 사용하므로, 이 루프가 멈추지 않고 돌아간다는
 * 것은 곧 "라운드 종료 -> 스토리 이벤트 -> 다음 라운드 시작" 사이클에
 * 교착이 없다는 뜻이다. */
function step(session: SessionState): SessionState {
  const head = flowHead(session);
  if (!head) return session;
  if (pendingAIEvent(session)) return runAIStep(session, VIEWER);

  switch (head.kind) {
    case "reveal":
    case "guessEffect":
    case "forcedDiscard":
    case "effectBlocked":
    case "elimination":
    case "choiceResult":
    case "roundSummary":
    case "storyEvent":
    case "roundStartGate":
    case "sessionEnd":
      return ackFlowEvent(session, VIEWER);
    case "letterChoice": {
      const pending = session.pendingLetterChoice!;
      const choice = pending.atCap
        ? ({ type: "decline" } as const)
        : ({ type: "place", slot: availableRank8LetterSlots(session)[0] ?? ROUTE_SLOT[session.currentRoute] } as const);
      return recomputeFlow(resolveLetterChoice(session, head.actorId!, choice), VIEWER);
    }
    case "identityChoice":
      return recomputeFlow(
        chooseIdentity(session, head.actorId!, session.pendingIdentityChoice!.options[0], "male"),
        VIEWER
      );
    case "archiveChoice":
      return recomputeFlow(resolveArchiveChoice(session, head.actorId!, session.pendingChoice!.options[0].id), VIEWER);
    case "archivePlacement":
      return recomputeFlow(skipArchivePlacement(session, head.actorId!), VIEWER);
    case "roundStartSetup": {
      const plan = session.flowState.roundStart!;
      return enterRound(beginNextRound(session, plan.route, plan.selectedOptionalCards), VIEWER);
    }
    case "decision":
      return recomputeFlow(
        applyToRound(session, (state) =>
          applyAiDecision(state, state.pendingDecision!, { letterTokens: session.letterTokens })
        ),
        VIEWER
      );
  }
}

/** 큐가 비거나(대기 없음) 엔딩 화면에 도달할 때까지, 또는 목표 라운드에
 * 도달할 때까지 굴린다. 진행하는 동안 본 이벤트 종류를 모두 기록한다. */
function drive(
  session: SessionState,
  options: { untilRound?: number; maxSteps?: number } = {}
): { session: SessionState; seen: FlowEventKind[] } {
  const { untilRound = Infinity, maxSteps = 4000 } = options;
  const seen: FlowEventKind[] = [];
  let current = session;
  for (let i = 0; i < maxSteps; i++) {
    if (current.roundNumber >= untilRound && !isRoundStartLocked(current)) break;
    const head = flowHead(current);
    if (!head) break;
    if (head.kind === "sessionEnd" && current.flowState.acks.endingSceneDone) break;
    seen.push(head.kind);
    const next = step(current);
    // 같은 상태로 되돌아오면 교착이다 -- 진행하지 못했다는 뜻.
    expect(next).not.toBe(current);
    current = next;
  }
  return { session: current, seen };
}

describe("flow state machine", () => {
  it("세션은 시작 이벤트와 시작 게이트로 시작한다", () => {
    const session = freshSession();
    expect(session.flowState.kind).toBe("awaitingStoryEvent");
    expect(isRoundStartLocked(session)).toBe(true);
    // 017/018/020/023 -- 세션 시작 시드 4장을 먼저 읽어야 한다 (배분 직후
    // 패시브로 라운드가 즉시 끝나면 그 결과로 열린 카드가 뒤에 더 붙는다).
    expect(flowHead(session)?.cardIds?.slice(0, 4)).toEqual(["017", "018", "020", "023"]);
  });

  it("시작 이벤트를 모두 읽으면 시작 게이트가 큐의 머리가 된다", () => {
    let session = freshSession();
    // 배분 직후 패시브(대신/왕)로 라운드가 즉시 끝나면 시작 이벤트가 더
    // 늘어날 수 있으므로, 이야기 이벤트가 남아 있는 동안 계속 읽는다.
    for (let i = 0; i < 30 && flowHead(session)?.kind === "storyEvent"; i++) {
      session = ackFlowEvent(session, VIEWER);
    }
    expect(flowHead(session)?.kind).toBe("roundStartGate");
    session = ackFlowEvent(session, VIEWER);
    expect(isRoundStartLocked(session)).toBe(false);
    expect(["awaitingHumanInput", "awaitingAIDecision"]).toContain(session.flowState.kind);
  });

  it("라운드 종료 -> 스토리 이벤트 -> 다음 라운드 시작 사이클을 교착 없이 통과한다", () => {
    const { session, seen } = drive(freshSession(), { untilRound: 3 });
    expect(seen).toContain("storyEvent");
    expect(seen).toContain("roundSummary");
    expect(seen).toContain("roundStartSetup");
    expect(seen).toContain("decision");
    expect(session.roundNumber).toBeGreaterThanOrEqual(3);
    // 폴백까지 실패해 멈춘 이벤트 없이 여기까지 왔어야 한다.
    expect(session.flowState.stalledEventId).toBeNull();
  });

  it("세션이 끝까지(엔딩 화면) 진행된다", () => {
    const { session } = drive(freshSession());
    expect(session.ended).toBe(true);
    expect(flowHead(session)?.kind).toBe("sessionEnd");
    expect(session.flowState.acks.endingSceneDone).toBe(true);
  });

  it("AI는 사람이 확인해야 할 팝업/라운드 결과가 큐 앞에 있는 동안 움직이지 않는다", () => {
    let session = freshSession();
    // 라운드가 실제로 끝날 때까지 굴린 뒤, 확인 대기 상태를 만든다.
    for (let i = 0; i < 4000 && !session.round.roundResult; i++) {
      const next = step(session);
      if (next === session) break;
      session = next;
    }
    expect(session.round.roundResult).not.toBeNull();

    // 라운드 결과/팝업 확인이 남아 있는 동안에는 AI 차례가 큐의 머리가
    // 될 수 없고, 드라이버도 아무 것도 하지 않는다.
    let guard = 0;
    while (flowHead(session) && flowHead(session)!.actorId === null && guard++ < 50) {
      expect(pendingAIEvent(session)).toBeNull();
      expect(runAIStep(session, VIEWER)).toBe(session);
      const aiQueued = session.flowState.queue.filter((e) => e.actorId === "p2");
      // AI가 할 일이 큐에 있더라도 사람 확인보다 뒤에 있어야 한다.
      for (const aiEvent of aiQueued) {
        expect(session.flowState.queue.indexOf(aiEvent)).toBeGreaterThan(0);
      }
      session = ackFlowEvent(session, VIEWER);
    }
  });

  it("참고용 오버레이가 열려 있으면 AI 자동 진행이 멈춘다", () => {
    let session = freshSession();
    for (let i = 0; i < 4000; i++) {
      if (pendingAIEvent(session)) break;
      const next = step(session);
      if (next === session) break;
      session = next;
    }
    expect(pendingAIEvent(session)).not.toBeNull();
    const paused = setFlowOverlay(session, "cardReference", VIEWER);
    expect(pendingAIEvent(paused)).toBeNull();
    expect(runAIStep(paused, VIEWER)).toBe(paused);
    const resumed = setFlowOverlay(paused, null, VIEWER);
    expect(pendingAIEvent(resumed)).not.toBeNull();
  });

  it("큐는 세션 상태의 순수 함수라 몇 번을 다시 계산해도 같다", () => {
    const { session } = drive(freshSession(), { untilRound: 2 });
    const again = recomputeFlow(recomputeFlow(session, VIEWER), VIEWER);
    expect(again.flowState.queue).toEqual(session.flowState.queue);
    expect(again.flowState.kind).toBe(session.flowState.kind);
  });

  it("이야기 이벤트는 읽은 만큼만 큐에서 빠진다", () => {
    let session = freshSession();
    const before = flowHead(session)!.cardIds!.length;
    session = ackFlowEvent(session, VIEWER, 2);
    expect(flowHead(session)?.cardIds).toHaveLength(before - 2);
  });
});
