/**
 * 플로우 큐의 머리가 AI 차례일 때 실제로 엔진을 한 걸음 굴리는 곳.
 *
 * 예전에는 AI 결정 종류마다 별도의 useEffect + "이미 처리했다" ref가 있었고,
 * 그 조합에서 교착이 반복해서 났다. 이제 진입점은 이 함수 하나뿐이며,
 * "무엇을 할 차례인가"는 engine/flow.ts의 큐가 결정한다. 각 폴백(항상
 * 합법적인 수로라도 차례를 소모한다)은 그대로 유지하되, 폴백까지 실패하면
 * 조용히 멈추는 대신 flowState.stalledEventId로 명시적으로 기록한다.
 */
import { applyAiDecision, chooseArchiveChoiceAI, chooseArchiveTokenAI, chooseIdentityAI, chooseLetterTargetAI } from "./ai";
import {
  ROUTE_SLOT,
  applyToRound,
  availableRank8LetterSlots,
  chooseIdentity,
  placeArchiveToken,
  resolveArchiveChoice,
  resolveLetterChoice,
  skipArchivePlacement,
} from "./session";
import type { LetterChoice, SessionState } from "./session";
import { markFlowStalled, pendingAIEvent, recomputeFlow } from "./flow";

/** 엔진 호출이 예외를 던져도 앱 전체가 멈추지 않도록 감싼다. */
export function safely<T>(fn: () => T): T | null {
  try {
    return fn();
  } catch (err) {
    console.error(err);
    return null;
  }
}

/**
 * AI가 큐의 머리를 처리한 다음 세션을 돌려준다. 처리할 것이 없으면 같은
 * 참조를 그대로 돌려준다 (React가 리렌더를 건너뛴다).
 */
export function runAIStep(session: SessionState, viewerId: string): SessionState {
  const event = pendingAIEvent(session);
  if (!event) return session;
  const next = applyAIEvent(session, event.actorId!, event.kind);
  if (!next) return markFlowStalled(session, event.id, viewerId);
  return recomputeFlow(next, viewerId);
}

function applyAIEvent(session: SessionState, actorId: string, kind: string): SessionState | null {
  switch (kind) {
    case "decision": {
      const decision = session.round.pendingDecision;
      if (!decision) return null;
      return safely(() =>
        applyToRound(session, (state) => applyAiDecision(state, decision, { letterTokens: session.letterTokens }))
      );
    }
    case "letterChoice": {
      const pending = session.pendingLetterChoice;
      if (!pending) return null;
      const routeSlot = ROUTE_SLOT[session.currentRoute];
      const choice: LetterChoice = chooseLetterTargetAI(routeSlot, pending.atCap);
      // 1차 선택이 거부되면 항상 유효한 기본 배치(공개된 첫 공주/왕자
      // 슬롯) 또는 "이동하지 않음"으로 폴백 -- AI 차례가 소모되지 않으면
      // 진행이 영구히 멈춘다 (교착 방지의 마지막 안전망).
      const fallback: LetterChoice = pending.atCap
        ? { type: "decline" }
        : { type: "place", slot: availableRank8LetterSlots(session)[0] ?? routeSlot };
      return (
        safely(() => resolveLetterChoice(session, actorId, choice)) ??
        safely(() => resolveLetterChoice(session, actorId, fallback))
      );
    }
    case "archivePlacement": {
      const choice = chooseArchiveTokenAI(session.storyArchive, session.roundEndEligibleArchiveIds);
      // 실패 시 반드시 "놓지 않기"로라도 차례를 소모한다.
      return (
        safely(() =>
          choice
            ? placeArchiveToken(session, actorId, choice.cardId, choice.token)
            : skipArchivePlacement(session, actorId)
        ) ?? safely(() => skipArchivePlacement(session, actorId))
      );
    }
    case "identityChoice": {
      const pending = session.pendingIdentityChoice;
      if (!pending) return null;
      return safely(() => chooseIdentity(session, actorId, chooseIdentityAI(pending.options), "male"));
    }
    case "archiveChoice": {
      const pending = session.pendingChoice;
      if (!pending) return null;
      return safely(() => resolveArchiveChoice(session, actorId, chooseArchiveChoiceAI(pending.options)));
    }
    default:
      return null;
  }
}
