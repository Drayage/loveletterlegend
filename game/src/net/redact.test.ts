import { describe, expect, it } from "vitest";
import { startSession } from "../engine/session";
import type { SessionState } from "../engine/session";
import { recomputeFlow } from "../engine/flow";
import { computeRemainingCounts } from "../engine/remaining";
import type { PlayerConfig } from "../engine/types";
import { redactSessionFor } from "./redact";
import { isIntentAllowed } from "./intents";
import { mergeIncomingState } from "./sync";

const PLAYERS: PlayerConfig[] = [
  { id: "human", displayName: "방장", isAI: false },
  { id: "online-1", displayName: "게스트", isAI: false },
];

function hostSession(): SessionState {
  return recomputeFlow(startSession(PLAYERS), "human");
}

function handNames(session: SessionState, playerId: string): string[] {
  return session.round.players.find((p) => p.id === playerId)!.hand.map((c) => c.name);
}

describe("온라인 검열(redaction)", () => {
  it("상대 손패와 덱 내용은 실제 값 그대로 나가지 않는다", () => {
    const host = hostSession();
    const guestView = redactSessionFor(host, "online-1");

    // 내 손패는 그대로.
    expect(handNames(guestView, "online-1")).toEqual(handNames(host, "online-1"));
    // 카드 장수와 instanceId는 유지되지만(UI가 뒷면을 그려야 하므로)
    // 덱 순서/상대 손패의 실제 이름은 진짜와 일치할 이유가 없다.
    expect(guestView.round.deck).toHaveLength(host.round.deck.length);
    expect(guestView.round.deck.map((c) => c.instanceId)).toEqual(host.round.deck.map((c) => c.instanceId));
    // 숨긴 자리(덱 -> 비공개 제거 카드 -> 상대 손패)의 이름은 실제 배치와
    // 무관한 고정(정렬) 순서로 다시 채워진다 -- 진짜 순서가 새지 않는다.
    const hiddenNames = [
      ...guestView.round.deck.map((c) => c.name),
      ...(guestView.round.hiddenRemovedCard ? [guestView.round.hiddenRemovedCard.name] : []),
      ...handNames(guestView, "human"),
    ];
    expect(hiddenNames).toEqual([...hiddenNames].sort());
  });

  it("숨긴 카드의 다중집합은 보존되어 '남은 장수' 힌트가 어긋나지 않는다", () => {
    const host = hostSession();
    const guestView = redactSessionFor(host, "online-1");
    expect(computeRemainingCounts(guestView.round)).toEqual(computeRemainingCounts(host.round));
  });

  it("행위자만 본 비공개 공개 정보는 다른 사람 뷰에서 지워진다", () => {
    const host = hostSession();
    host.round.lastReveal = {
      id: "r-1",
      viewerPlayerId: "human",
      cardName: "광대",
      targetDisplayName: "게스트",
      targetCard: "공주",
    };
    expect(redactSessionFor(host, "online-1").round.lastReveal).toBeNull();
    expect(redactSessionFor(host, "human").round.lastReveal).not.toBeNull();
  });

  it("「기사」의 상호 비교는 양쪽 모두에게 남는다", () => {
    const host = hostSession();
    host.round.lastReveal = {
      id: "r-2",
      viewerPlayerId: "human",
      cardName: "기사",
      targetDisplayName: "게스트",
      compare: { actorCard: "기사", targetCard: "공주", result: "lose" },
    };
    expect(redactSessionFor(host, "online-1").round.lastReveal).not.toBeNull();
  });

  it("남의 차례에 들어온 의도는 거부된다 (자격 판단은 플로우 큐가 한다)", () => {
    const host = hostSession();
    const intent = { type: "selectCard", instanceId: "card-1" } as const;
    // 세션 시작 직후 큐의 머리는 이야기 이벤트다 -- 아무도 카드를 낼 수 없다.
    expect(isIntentAllowed(host, "human", intent)).toBe(false);
    expect(isIntentAllowed(host, "online-1", intent)).toBe(false);
  });

  it("게스트는 받은 상태에 자기 확인 기록을 유지한 채 큐를 다시 계산한다", () => {
    const host = hostSession();
    const guest = mergeIncomingState(null, redactSessionFor(host, "online-1"), "online-1");
    expect(guest.flowState.queue.length).toBeGreaterThan(0);
    // 확인을 진행한 뒤 새 브로드캐스트가 와도 이미 읽은 이벤트로 되돌아가지 않는다.
    const acked = { ...guest, flowState: { ...guest.flowState, acks: { ...guest.flowState.acks, shownArchiveIds: ["017", "018", "020", "023"] } } };
    const next = mergeIncomingState(acked, redactSessionFor(host, "online-1"), "online-1");
    expect(next.flowState.acks.shownArchiveIds).toEqual(["017", "018", "020", "023"]);
  });
});
