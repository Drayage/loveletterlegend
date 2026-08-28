/**
 * 플레이어별 "볼 수 있는 만큼만" 세션 상태를 만드는 검열(redaction) 레이어.
 *
 * 온라인 대전은 **호스트 권한(host authority)** 방식이다: 엔진(과 그 안의
 * Math.random)은 오직 호스트에서만 돌고, 게스트는 의도(intent)만 보내고
 * 호스트가 계산한 결과를 받는다. 그래서 호스트는 자기 상태를 그대로
 * 뿌리면 안 되고, 각 좌석마다 "그 사람이 실제로 알 수 있는" 뷰를 만들어
 * 보내야 한다.
 *
 * 이 게임에서 비공개인 것(engine/types.ts 기준):
 * - 다른 플레이어의 손패 (라운드가 끝나 공개되기 전까지)
 * - 덱의 내용과 순서, 라운드 시작 시 제거된 비공개 카드
 * - `lastReveal` -- 광대/군사/점술사류로 **행위자만** 본 정보
 *   (「기사」의 compare는 양쪽이 함께 공개하므로 예외)
 * - 남의 `pendingDecision`에 들어 있는 카드 목록/엿본 카드
 *   (playCard의 options는 그 사람의 손패 그 자체다)
 *
 * 공개인 것: 로그, 버린 카드, 라운드 결과, 편지/시계 토큰, 이야기 보관소,
 * 정체 얼굴(이 구현에서는 상대에게도 보인다), 진행(플로우) 큐.
 *
 * ### 카드 이름을 "지우지" 않고 "섞는" 이유
 * 손패/덱을 그냥 지우면 `computeRemainingCounts`(공개 정보로 남은 장수를
 * 세는 UI 힌트)가 게스트에게만 틀리게 나온다. 그래서 숨겨진 자리에 있는
 * 카드들의 **이름 다중집합은 그대로 두되**, 실제 배치와 무관한 고정
 * 순서(정렬)로 다시 배분한다. 다중집합 자체는 이미 공개 정보에서 유도할
 * 수 있고, 배치는 진짜와 아무 상관이 없으므로 정보가 새지 않는다.
 * (게스트 UI에서 남의 손패/덱은 항상 뒷면으로만 그려진다.)
 */
import type { CardInstance, CardName, GameState } from "../engine/types";
import type { SessionState } from "../engine/session";

function hiddenZones(round: GameState, viewerId: string): CardInstance[][] {
  const roundOver = Boolean(round.roundResult);
  const zones: CardInstance[][] = [round.deck];
  if (round.hiddenRemovedCard) zones.push([round.hiddenRemovedCard]);
  // 라운드가 끝나면 손패는 공개된다 (UI가 실제로 공개해 보여준다).
  if (!roundOver) {
    for (const player of round.players) {
      if (player.id !== viewerId) zones.push(player.hand);
    }
  }
  return zones;
}

/** 숨겨진 자리들의 이름을 고정된(정렬된) 순서로 재배분한다. */
function shuffleHiddenNames(zones: CardInstance[][]): Map<string, CardName> {
  const names = zones
    .flat()
    .map((card) => card.name)
    .sort();
  const remapped = new Map<string, CardName>();
  let index = 0;
  for (const zone of zones) {
    for (const card of zone) {
      card.name = names[index++];
      remapped.set(card.instanceId, card.name);
    }
  }
  return remapped;
}

function redactCardList(cards: CardInstance[] | undefined, remapped: Map<string, CardName>): void {
  if (!cards) return;
  for (const card of cards) {
    const hidden = remapped.get(card.instanceId);
    if (hidden) card.name = hidden;
  }
}

/**
 * `viewerId`가 볼 수 있는 형태의 세션 상태를 만든다. 호스트만 호출한다.
 *
 * `flowState`는 그대로 실려 가지만(공개 정보), 받는 쪽은 자기 확인(acks)
 * 기록으로 다시 계산한다 -- see net/session sync in net/useOnlineRoom.ts.
 */
export function redactSessionFor(session: SessionState, viewerId: string): SessionState {
  const view: SessionState = structuredClone(session);
  const round = view.round;

  const remapped = shuffleHiddenNames(hiddenZones(round, viewerId));

  // 행위자만 본 비공개 정보 (「기사」의 상호 비교는 양쪽 공개라 예외).
  if (round.lastReveal && round.lastReveal.viewerPlayerId !== viewerId && !round.lastReveal.compare) {
    round.lastReveal = null;
  }

  const decision = round.pendingDecision;
  if (decision && decision.playerId !== viewerId) {
    if (
      decision.kind === "playCard" ||
      decision.kind === "identityReplaceEffect" ||
      decision.kind === "reuseDiscard" ||
      decision.kind === "discardFromHand"
    ) {
      redactCardList(decision.options, remapped);
    }
    if (decision.kind === "witchAssign") redactCardList(decision.pool, remapped);
    if (decision.kind === "deckSwap") {
      // 엿본 덱 맨 위 카드 -> 검열된 덱의 맨 위와 일치시킨다.
      decision.seenCardName = round.deck[0]?.name ?? decision.seenCardName;
    }
    if (decision.kind === "tacticianSwap") {
      const target = round.players.find((p) => p.id === decision.targetId);
      decision.seenCardName = target?.hand[0]?.name ?? decision.seenCardName;
    }
  }

  return view;
}

/** 좌석 전원분의 뷰를 한 번에 만든다 (호스트가 브로드캐스트할 페이로드). */
export function redactedViewsFor(session: SessionState, playerIds: string[]): Record<string, SessionState> {
  return Object.fromEntries(playerIds.map((id) => [id, redactSessionFor(session, id)]));
}
