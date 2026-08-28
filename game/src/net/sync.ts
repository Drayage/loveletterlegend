/**
 * 호스트가 보낸 상태를 로컬 화면 상태와 합치는 규칙.
 *
 * 플로우 큐(engine/flow.ts)는 "세션 상태 + 내 확인(acks)"의 순수 함수다.
 * 그래서 게스트는 호스트가 계산한 큐를 그대로 쓰지 않고, **자기 확인 기록을
 * 유지한 채 다시 계산한다**. 팝업 확인은 각자 자기 화면에서 하는 것이고,
 * 「비공개 공개」처럼 보는 사람마다 다른 이벤트도 있기 때문이다.
 */
import { createInitialAcks, recomputeFlow } from "../engine/flow";
import type { SessionState } from "../engine/session";
import { redactSessionFor } from "./redact";

export function mergeIncomingState(
  local: SessionState | null,
  incoming: SessionState,
  viewerId: string
): SessionState {
  const localFlow = local?.flowState;
  const acks = localFlow?.acks ?? createInitialAcks();
  // 호스트가 새 라운드를 시작했으면 나도 다시 "시작 게이트" 상태로 -- 게스트도
  // 라운드 시작 이벤트를 읽고 패 공개를 확인한 뒤 진행한다.
  const enteredNewRound = Boolean(local && incoming.roundNumber > local.roundNumber);
  return recomputeFlow(
    {
      ...incoming,
      flowState: {
        ...incoming.flowState,
        overlay: localFlow?.overlay ?? null,
        stalledEventId: null,
        acks: enteredNewRound ? { ...acks, roundStartLockedNumber: incoming.roundNumber } : acks,
      },
    },
    viewerId
  );
}

/** 호스트가 브로드캐스트할 좌석별 뷰 (AI 좌석은 볼 사람이 없으므로 제외). */
export function broadcastViews(session: SessionState): Record<string, SessionState> {
  const seats = session.playerConfigs.filter((config) => !config.isAI);
  return Object.fromEntries(seats.map((seat) => [seat.id, redactSessionFor(session, seat.id)]));
}
