/**
 * 게스트가 호스트에게 보내는 "의도(intent)"와, 호스트가 그것을 실제
 * 엔진 호출로 옮기는 곳.
 *
 * 호스트 권한 방식의 핵심: 게스트는 엔진을 절대 돌리지 않는다. 카드 셔플과
 * AI의 난수는 호스트에서만 일어나므로 RNG 발산(divergence) 문제 자체가
 * 생기지 않는다. 게스트는 "나는 이 카드를 내겠다"는 의도만 보내고, 호스트가
 * 그것을 **플로우 큐(engine/flow.ts)** 로 검증한 뒤 적용한다.
 *
 * 검증 규칙은 하나뿐이다: **큐의 머리가 그 사람 차례일 때만 받아준다.**
 * (라운드 중 카드 결정은 pendingDecision의 주인인지도 함께 본다.)
 * 팝업 확인(ack)과 다음 주차 시작은 의도로 보내지 않는다 -- 팝업은 각자
 * 자기 화면에서 확인하는 로컬 상태이고, 라운드 전환은 방장이 진행한다.
 */
import type { GuessOption } from "../engine/types";
import {
  applyToRound,
  chooseIdentity,
  placeArchiveToken,
  resolveArchiveChoice,
  resolveLetterChoice,
  skipArchivePlacement,
} from "../engine/session";
import type { LetterChoice, SessionState } from "../engine/session";
import {
  chooseCardToPlay,
  chooseDeckSwap,
  chooseFortunePath,
  chooseGuess,
  chooseHandDiscard,
  chooseIdentityCancel,
  chooseIdentityExtraTurn,
  chooseIdentityReplacement,
  chooseIdentitySwap,
  chooseRegentChoice,
  chooseReuseCard,
  chooseTacticianSwap,
  chooseTarget,
  chooseWitchAssign,
} from "../engine/rules";
import { flowHead, recomputeFlow } from "../engine/flow";
import type { IdentityVariantId } from "../data/identityVariants";

/** 라운드 중 카드 결정 (pendingDecision을 소비한다). */
export type RoundIntent =
  | { type: "selectCard"; instanceId: string }
  | { type: "chooseTarget"; targetId: string }
  | { type: "chooseGuess"; guess: GuessOption }
  | { type: "fortunePath"; path: "peek" | "coWin" }
  | { type: "deckSwap"; swap: boolean }
  | { type: "tacticianSwap"; swap: boolean }
  | { type: "reuseCard"; instanceId: string }
  | { type: "handDiscard"; instanceId: string }
  | { type: "regentChoice"; choice: "immune" | "eliminate" }
  | { type: "witchAssign"; instanceId: string }
  | { type: "identitySwap"; use: boolean }
  | { type: "identityCancel"; use: boolean }
  | { type: "identityReplacement"; instanceId: string | null }
  | { type: "identityExtraTurn"; use: boolean };

/** 세션 레이어(라운드 종료 후)의 선택들. */
export type SessionIntent =
  | { type: "letterChoice"; choice: LetterChoice }
  | { type: "chooseIdentity"; identityId: string; variantId: IdentityVariantId }
  | { type: "archiveChoice"; optionId: string }
  | { type: "placeArchiveToken"; cardId: string; token: "성공" | "실패" }
  | { type: "skipArchivePlacement" };

export type PlayerIntent = RoundIntent | SessionIntent;

export interface IntentEnvelope {
  playerId: string;
  intent: PlayerIntent;
  at: number;
}

const ROUND_INTENT_TYPES = new Set<PlayerIntent["type"]>([
  "selectCard",
  "chooseTarget",
  "chooseGuess",
  "fortunePath",
  "deckSwap",
  "tacticianSwap",
  "reuseCard",
  "handDiscard",
  "regentChoice",
  "witchAssign",
  "identitySwap",
  "identityCancel",
  "identityReplacement",
  "identityExtraTurn",
]);

/** 지금 이 사람이 이 의도를 보낼 자격이 있는가 -- 판단 근거는 플로우 큐뿐. */
export function isIntentAllowed(session: SessionState, playerId: string, intent: PlayerIntent): boolean {
  const head = flowHead(session);
  if (!head) return false;
  if (ROUND_INTENT_TYPES.has(intent.type)) {
    return (
      head.kind === "decision" &&
      head.actorId === playerId &&
      session.round.pendingDecision?.playerId === playerId
    );
  }
  switch (intent.type) {
    case "letterChoice":
      return head.kind === "letterChoice" && head.actorId === playerId;
    case "chooseIdentity":
      return head.kind === "identityChoice" && head.actorId === playerId;
    case "archiveChoice":
      return head.kind === "archiveChoice" && head.actorId === playerId;
    case "placeArchiveToken":
    case "skipArchivePlacement":
      return head.kind === "archivePlacement" && head.actorId === playerId;
    default:
      return false;
  }
}

function applyRoundIntent(session: SessionState, intent: RoundIntent): SessionState {
  switch (intent.type) {
    case "selectCard":
      return applyToRound(session, (s) => chooseCardToPlay(s, intent.instanceId));
    case "chooseTarget":
      return applyToRound(session, (s) => chooseTarget(s, intent.targetId));
    case "chooseGuess":
      return applyToRound(session, (s) => chooseGuess(s, intent.guess));
    case "fortunePath":
      return applyToRound(session, (s) => chooseFortunePath(s, intent.path));
    case "deckSwap":
      return applyToRound(session, (s) => chooseDeckSwap(s, intent.swap));
    case "tacticianSwap":
      return applyToRound(session, (s) => chooseTacticianSwap(s, intent.swap));
    case "reuseCard":
      return applyToRound(session, (s) => chooseReuseCard(s, intent.instanceId));
    case "handDiscard":
      return applyToRound(session, (s) => chooseHandDiscard(s, intent.instanceId));
    case "regentChoice":
      return applyToRound(session, (s) => chooseRegentChoice(s, intent.choice));
    case "witchAssign":
      return applyToRound(session, (s) => chooseWitchAssign(s, intent.instanceId));
    case "identitySwap":
      return applyToRound(session, (s) => chooseIdentitySwap(s, intent.use));
    case "identityCancel":
      return applyToRound(session, (s) => chooseIdentityCancel(s, intent.use));
    case "identityReplacement":
      return applyToRound(session, (s) => chooseIdentityReplacement(s, intent.instanceId));
    case "identityExtraTurn":
      return applyToRound(session, (s) => chooseIdentityExtraTurn(s, intent.use));
  }
}

/**
 * 호스트에서만 호출된다. 자격이 없거나 엔진이 거부하면 `null`을 돌려주고
 * 세션은 건드리지 않는다 (게스트의 잘못된/늦은 의도가 판을 망치지 않는다).
 *
 * `viewerId`는 호스트 자신의 좌석 -- 적용 후 호스트 화면 기준으로 플로우를
 * 다시 계산한다. 게스트는 브로드캐스트를 받은 뒤 자기 기준으로 다시 계산한다.
 */
export function applyIntent(
  session: SessionState,
  playerId: string,
  intent: PlayerIntent,
  viewerId: string
): SessionState | null {
  if (!isIntentAllowed(session, playerId, intent)) return null;
  try {
    const next = ROUND_INTENT_TYPES.has(intent.type)
      ? applyRoundIntent(session, intent as RoundIntent)
      : applySessionIntent(session, playerId, intent as SessionIntent);
    return recomputeFlow(next, viewerId);
  } catch (err) {
    console.error("의도 적용 실패", intent, err);
    return null;
  }
}

function applySessionIntent(session: SessionState, playerId: string, intent: SessionIntent): SessionState {
  switch (intent.type) {
    case "letterChoice":
      return resolveLetterChoice(session, playerId, intent.choice);
    case "chooseIdentity":
      return chooseIdentity(session, playerId, intent.identityId, intent.variantId);
    case "archiveChoice":
      return resolveArchiveChoice(session, playerId, intent.optionId);
    case "placeArchiveToken":
      return placeArchiveToken(session, playerId, intent.cardId, intent.token);
    case "skipArchivePlacement":
      return skipArchivePlacement(session, playerId);
  }
}
