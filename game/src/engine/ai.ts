import { cardRank } from "./effects";
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
} from "./rules";
import { ALL_SLOTS } from "./session";
import type {
  ArchiveCardState,
  CardInstance,
  CardName,
  CharacterSlotId,
  GameState,
  GuessOption,
  PendingDecision,
  RankGuess,
} from "./types";
import type { Route } from "../data/routes";

/** AI 타겟 선정에 필요한 세션 정보의 최소 구조 -- session.ts의
 * `SessionState`를 그대로 받아도 되지만, ai.ts는 letterTokens만 알면
 * 되므로 구조적으로 필요한 최소 타입만 요구한다(테스트에서 세션 전체를
 * 만들지 않고도 간단히 목킹할 수 있도록). */
export interface AiThreatContext {
  letterTokens: Record<CharacterSlotId, Record<string, number>>;
}

/**
 * Heuristic (non-cheating) probability estimate of what a given "unseen"
 * card slot holds, from the point of view of `forPlayerId`: uniform over
 * the remaining copies of each name that aren't already visible in that
 * player's own hand/discard, the opponent's discard pile, or the face-up
 * removed cards (all public information in a 2-player game).
 */
export function estimateUnseenDistribution(
  state: GameState,
  forPlayerId: string
): Record<CardName, number> {
  const remaining: Record<CardName, number> = {} as Record<CardName, number>;
  const possibleNames = new Set<CardName>();

  const subtract = (card: CardInstance) => {
    possibleNames.add(card.name);
    if (remaining[card.name] === undefined) remaining[card.name] = 0;
    remaining[card.name] = Math.max(0, remaining[card.name] - 1);
  };

  const addRoundCard = (card: CardInstance | null | undefined) => {
    if (!card) return;
    possibleNames.add(card.name);
    if (remaining[card.name] === undefined) remaining[card.name] = 0;
    remaining[card.name] += 1;
  };

  for (const c of state.deck) addRoundCard(c);
  addRoundCard(state.hiddenRemovedCard);
  for (const c of state.faceUpRemovedCards) addRoundCard(c);
  for (const p of state.players) {
    for (const c of p.hand) addRoundCard(c);
    for (const c of p.discardPile) addRoundCard(c);
  }

  for (const p of state.players) {
    for (const c of p.discardPile) subtract(c);
    if (p.id === forPlayerId) {
      for (const c of p.hand) subtract(c);
    }
  }
  for (const c of state.faceUpRemovedCards) subtract(c);

  const total = Object.values(remaining).reduce((a, b) => a + b, 0);
  const dist: Record<CardName, number> = {} as Record<CardName, number>;
  for (const name of possibleNames) {
    dist[name] = total > 0 ? remaining[name] / total : 0;
  }
  return dist;
}

function bestGuess(dist: Record<CardName, number>): { name: CardName; p: number } {
  let best: { name: CardName; p: number } | null = null;
  for (const name of Object.keys(dist) as CardName[]) {
    if (name === "경비병") continue;
    if (!best || dist[name] > best.p) best = { name, p: dist[name] };
  }
  return best ?? { name: "광대", p: 0 };
}

/** `tried`(같은 라운드에서 이 상대에게 이미 틀렸던 추측들)에 없는 후보
 * 중 확률이 가장 높은 것을 우선한다 -- 모든 후보를 이미 다 시도해봤을
 * 때만(정보가 소진됐을 때만) tried 여부와 무관하게 최선의 추측으로
 * fallback한다. */
function bestAllowedGuess(
  dist: Record<CardName, number>,
  options?: GuessOption[],
  tried?: ReadonlySet<GuessOption>
): CardName {
  const allowed = new Set(options?.filter((o): o is CardName => typeof o === "string" && o in dist));
  let best: { name: CardName; p: number } | null = null;
  let bestUntried: { name: CardName; p: number } | null = null;
  for (const name of Object.keys(dist) as CardName[]) {
    if (name === "경비병") continue;
    if (options && !allowed.has(name)) continue;
    if (!best || dist[name] > best.p) best = { name, p: dist[name] };
    if (!tried?.has(name) && (!bestUntried || dist[name] > bestUntried.p)) bestUntried = { name, p: dist[name] };
  }
  const chosen = bestUntried ?? best;
  return chosen?.name ?? (options?.find((o): o is CardName => typeof o === "string" && o in dist) ?? "광대");
}

export function chooseGuessAI(state: GameState, playerId: string): GuessOption {
  const decision = state.pendingDecision;
  const targetId = decision?.kind === "guessCard" ? decision.targetId : undefined;
  // 이번 판에서 이미 시도한 값(같은 카드의 2연속 추측) + 이번 라운드에
  // 이 상대에게 이미 틀렸던 값(다른 카드/다른 플레이어의 이전 차례 포함)을
  // 함께 피한다 -- 이게 "다 같이 같은 상대를 같은 값으로 계속 찌르는" 버그의
  // 핵심 원인이었다 (see GameState.guessHistory, effects.ts's 경비병/신병 case).
  const tried = new Set<GuessOption>([
    ...(decision?.kind === "guessCard" ? decision.guesses ?? [] : []),
    ...(targetId ? state.guessHistory?.[targetId] ?? [] : []),
  ]);

  if (decision?.kind === "guessCard" && decision.cardName === "신병") {
    const dist = estimateUnseenDistribution(state, playerId);
    const byRank = new Map<RankGuess, number>();
    let best: { rank: RankGuess; p: number } | null = null;
    let bestUntried: { rank: RankGuess; p: number } | null = null;
    for (const name of Object.keys(dist) as CardName[]) {
      const rank = cardRank(name);
      if (rank < 2 || rank > 9) continue;
      const guess = String(rank) as RankGuess;
      const p = (byRank.get(guess) ?? 0) + (dist[name] ?? 0);
      byRank.set(guess, p);
      if (!best || p > best.p) best = { rank: guess, p };
      if (!tried.has(guess) && (!bestUntried || p > bestUntried.p)) bestUntried = { rank: guess, p };
    }
    return (bestUntried ?? best)?.rank ?? "2";
  }
  const dist = estimateUnseenDistribution(state, playerId);
  if (decision?.kind === "guessCard") return bestAllowedGuess(dist, decision.options, tried);
  return bestGuess(dist).name;
}

/** AI 타겟팅용 최소 세션 컨텍스트가 있으면(App.tsx의 실제 게임 진행 중)
 * "이기고 있는" 상대(편지 누적 총량이 많은 쪽)와, 나와 같은 캐릭터를
 * 노리는 "라이벌"(가장 많이 투자한 슬롯이 겹치는 쪽)을 우선 공격하도록
 * opponentIds를 재정렬한다. ctx가 없으면(세션 정보가 없는 단독 엔진
 * 호출, 기존 rules.test.ts/session.test.ts 드라이버 등) 원래 순서를 그대로
 * 유지해 기존 동작과 호환된다. */
export function rankOpponentsByThreat(
  opponentIds: string[],
  actingPlayerId: string,
  ctx?: AiThreatContext
): string[] {
  if (!ctx || opponentIds.length <= 1) return opponentIds;
  const totalLetterTokens = (playerId: string) =>
    ALL_SLOTS.reduce((sum, slot) => sum + (ctx.letterTokens[slot]?.[playerId] ?? 0), 0);
  const primaryPursuedSlot = (playerId: string): CharacterSlotId | null => {
    let best: { slot: CharacterSlotId; amount: number } | null = null;
    for (const slot of ALL_SLOTS) {
      const amount = ctx.letterTokens[slot]?.[playerId] ?? 0;
      if (amount > 0 && (!best || amount > best.amount)) best = { slot, amount };
    }
    return best?.slot ?? null;
  };
  const mySlot = primaryPursuedSlot(actingPlayerId);
  return opponentIds
    .map((id, index) => {
      const rivalBonus = mySlot && primaryPursuedSlot(id) === mySlot ? 6 : 0;
      return { id, index, score: totalLetterTokens(id) * 2 + rivalBonus };
    })
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map((entry) => entry.id);
}

export function chooseTargetAI(
  playerId: string,
  cardName: CardName,
  eligiblePlayerIds: string[],
  ctx?: AiThreatContext
): string {
  const opponentIds = eligiblePlayerIds.filter((id) => id !== playerId);
  if (cardName === "마술사") {
    // Prefer attacking the opponent (possible kill shot if they might be
    // holding 공주, or at minimum disrupts their hand) unless they're the
    // only non-eligible option, in which case fall back to self.
    if (opponentIds.length > 0) return rankOpponentsByThreat(opponentIds, playerId, ctx)[0];
    return playerId;
  }
  const ranked = rankOpponentsByThreat(opponentIds, playerId, ctx);
  return ranked[0] ?? eligiblePlayerIds[0];
}

/** 내는 즉시(또는 버려지는 즉시) 자기 자신이 탈락하는 카드들 -- AI가 다른
 * 선택지가 있는 한 절대 내지 않는다. 공주만 걸러내던 초기 구현은 왕자
 * 라우트에서 AI가 「왕자」를 스스로 내고 탈락하는 버그가 있었다. */
const SELF_LETHAL_PLAYS: ReadonlySet<CardName> = new Set<CardName>(["공주", "왕자", "공주셋째", "귀족영애", "쥐"]);

function scoreCardToPlay(
  play: CardInstance,
  keep: CardInstance,
  dist: Record<CardName, number>
): number {
  if (SELF_LETHAL_PLAYS.has(play.name)) return -1000;
  // 공주(둘째)는 버려도 즉시 탈락하지는 않지만 라운드 종료 비교에서 가장
  // 강한 카드(8)라 내는 건 거의 항상 손해다.
  if (play.name === "공주둘째") return -500;

  const base = 10 - cardRank(play.name); // mild bias toward playing low cards early
  switch (play.name) {
    case "경비병": {
      const guess = bestGuess(dist);
      return base + guess.p * 20;
    }
    case "마술사": {
      const princessRisk = dist["공주"] ?? 0;
      return base + princessRisk * 25 + 3;
    }
    case "기사": {
      // Playing 기사 compares `keep` against the opponent's unknown card.
      const winProb = (Object.keys(dist) as CardName[]).filter((n) => cardRank(n) < cardRank(keep.name)).reduce(
        (acc, n) => acc + (dist[n] ?? 0),
        0
      );
      return base + (winProb - 0.5) * 20;
    }
    case "장군": {
      const myRank = cardRank(keep.name);
      const expectedOpponentRank = (Object.keys(dist) as CardName[]).reduce(
        (acc, n) => acc + cardRank(n) * (dist[n] ?? 0),
        0
      );
      return base + (expectedOpponentRank - myRank) * 4;
    }
    case "승려":
      return base + 2;
    case "대신":
      return base + 4; // no active effect, safe to shed early
    default:
      return base;
  }
}

// v1: no strategic route preference -- the AI just stays on its current
// route each round. A richer policy (e.g. chasing whichever route it has
// more [편지] progress on) is a natural place to extend later.
export function chooseRouteAI(currentRoute: Route): Route {
  return currentRoute;
}

// v1: the AI always places its round-win [편지] on the slot matching
// `routeSlot` (the character tied to the session's current shared route)
// and never bothers reallocating once its pool is full. A richer policy
// (chasing whichever slot it's closest to winning, or reallocating to
// consolidate) is future work -- see engine/session.ts's resolveLetterChoice
// for the move/decline shape this would need to return.
export function chooseLetterTargetAI(
  routeSlot: CharacterSlotId,
  atCap: boolean
): { type: "place"; slot: CharacterSlotId } | { type: "decline" } {
  if (atCap) return { type: "decline" };
  return { type: "place", slot: routeSlot };
}

// v1: simple policy for the "이야기 보관소" token-placement decision (see
// engine/session.ts) -- pick uniformly among [조건]-tagged cards with an
// unfired condition (031's real rule only allows those as targets), and a
// coin-flip for success vs failure. A more strategic AI (e.g. deliberately
// sabotaging outcomes it doesn't want) is future work.
export function chooseArchiveTokenAI(
  archive: ArchiveCardState[],
  eligibleArchiveIds?: string[] | null
): { cardId: string; token: "성공" | "실패" } | null {
  const eligible = eligibleArchiveIds ? new Set(eligibleArchiveIds) : null;
  const candidates = archive.filter(
    (c) => (!eligible || eligible.has(c.id)) && c.conditionTag && c.conditions.some((cond) => !cond.fired)
  );
  if (candidates.length === 0) return null;
  const card = candidates[Math.floor(Math.random() * candidates.length)];
  const token: "성공" | "실패" = Math.random() < 0.5 ? "성공" : "실패";
  return { cardId: card.id, token };
}

// v1: no strategic preference among a "선택" 카드의 옵션들 -- pick uniformly.
export function chooseArchiveChoiceAI(options: Array<{ id: string }>): string {
  return options[Math.floor(Math.random() * options.length)].id;
}

// v1: no strategic preference among 정체 cards -- pick uniformly among
// whatever's still unclaimed in the pool. A richer policy (e.g. favoring
// 038's immediate [편지] bonus) is future work.
export function chooseIdentityAI(options: string[]): string {
  return options[Math.floor(Math.random() * options.length)];
}

/** 「점술사」 선택지: 기본은 덱 확인(peek). 손패가 아주 약하고 덱도 거의
 * 소진돼 스스로 이기기 어려운 형세면 상대 승리에 편승(coWin)을 노린다. */
export function chooseFortunePathAI(state: GameState, playerId: string): "peek" | "coWin" {
  const me = state.players.find((p) => p.id === playerId);
  const myCard = me?.hand[0];
  if (myCard && cardRank(myCard.name) <= 2 && state.deck.length <= 2) return "coWin";
  return "peek";
}

/** 확인한 카드가 지금 든 카드보다 높으면 교환 (점술사 peek / 군사 공용
 * 휴리스틱). */
export function shouldSwapForSeenAI(state: GameState, playerId: string, seenCardName: CardName): boolean {
  const me = state.players.find((p) => p.id === playerId);
  const myCard = me?.hand[0];
  if (!myCard) return false;
  return cardRank(seenCardName) > cardRank(myCard.name);
}

/** 수사/수녀의 재사용 대상 선택: 효과 가치가 높은 순서의 고정 선호도. */
const REUSE_PREFERENCE: CardName[] = [
  "마술사",
  "대마도사15",
  "대마도사20",
  "경비병",
  "신병",
  "마술사의도제",
  "기사",
  "여기사",
  "복면기사",
  "상인",
  "광대",
  "광대의제자",
  "군사",
  "장군",
  "시종",
  "시녀",
  "점술사",
  "광대의제자여",
  "승려",
  "정무관남",
  "정무관여",
  "마녀",
];

export function chooseReuseCardAI(options: CardInstance[]): CardInstance {
  for (const name of REUSE_PREFERENCE) {
    const found = options.find((c) => c.name === name);
    if (found) return found;
  }
  return options[0];
}

/** 대마도사(20세)의 "1장 버리기": 버리면 즉시 탈락하는 카드는 피하고,
 * 남기는 손패가 가장 강해지도록 낮은 카드부터 버린다. */
export function chooseHandDiscardAI(options: CardInstance[]): CardInstance {
  const lethalDiscards = new Set<CardName>(["공주", "왕자", "공주셋째", "귀족영애"]);
  const sorted = [...options].sort((a, b) => {
    const aLethal = lethalDiscards.has(a.name) ? 1 : 0;
    const bLethal = lethalDiscards.has(b.name) ? 1 : 0;
    if (aLethal !== bLethal) return aLethal - bLethal;
    return cardRank(a.name) - cardRank(b.name);
  });
  return sorted[0];
}

/** 강화된 「정무관(남자)」: 탈락시킬 합법적인 상대가 있으면 공격적으로
 * "상대 탈락"을, 없으면(대상 전원 승려 보호 등) "탈락하지 않기"를 고른다. */
export function chooseRegentChoiceAI(state: GameState, playerId: string): "immune" | "eliminate" {
  const hasTarget = state.players.some(
    (p) => p.id !== playerId && !p.eliminated && !p.protected
  );
  return hasTarget ? "eliminate" : "immune";
}

/** 강화된 「마녀」: 손에 들고 있는 것만으로는 위험하지 않으므로(discard 시
 * 탈락하는 공주류도 포함) 숫자가 가장 높은 카드를 자신이 갖는다. */
export function chooseWitchAssignAI(pool: CardInstance[]): CardInstance {
  const sorted = [...pool].sort((a, b) => cardRank(b.name) - cardRank(a.name));
  return sorted[0];
}

/** Single entry point for resolving ANY in-round pending decision as the
 * AI -- shared by App.tsx and the engine test drivers so a newly added
 * decision kind only needs wiring here. */
export function applyAiDecision(state: GameState, decision: PendingDecision, ctx?: AiThreatContext): GameState {
  switch (decision.kind) {
    case "playCard": {
      const card = chooseCardToPlayAI(state, decision.playerId);
      return chooseCardToPlay(state, card.instanceId);
    }
    case "chooseTarget": {
      const targetId = chooseTargetAI(decision.playerId, decision.cardName, decision.eligiblePlayerIds, ctx);
      return chooseTarget(state, targetId);
    }
    case "guessCard":
      return chooseGuess(state, chooseGuessAI(state, decision.playerId));
    case "fortunePath":
      return chooseFortunePath(state, chooseFortunePathAI(state, decision.playerId));
    case "deckSwap":
      return chooseDeckSwap(state, shouldSwapForSeenAI(state, decision.playerId, decision.seenCardName));
    case "tacticianSwap":
      return chooseTacticianSwap(state, shouldSwapForSeenAI(state, decision.playerId, decision.seenCardName));
    case "reuseDiscard":
      return chooseReuseCard(state, chooseReuseCardAI(decision.options).instanceId);
    case "discardFromHand":
      return chooseHandDiscard(state, chooseHandDiscardAI(decision.options).instanceId);
    case "regentChoice":
      return chooseRegentChoice(state, chooseRegentChoiceAI(state, decision.playerId));
    case "witchAssign":
      return chooseWitchAssign(state, chooseWitchAssignAI(decision.pool).instanceId);
    case "identitySwap": {
      const p = state.players.find((player) => player.id === decision.playerId);
      return chooseIdentitySwap(
        state,
        Boolean(
          state.hiddenRemovedCard &&
            p?.hand[0] &&
            cardRank(state.hiddenRemovedCard.name) > cardRank(p.hand[0].name)
        )
      );
    }
    case "identityCancel":
      return chooseIdentityCancel(state, true);
    case "identityReplaceEffect":
      return chooseIdentityReplacement(state, decision.options[0]?.instanceId ?? null);
    case "identityExtraTurn":
      return chooseIdentityExtraTurn(state, state.deck.length > 0);
  }
}

export function chooseCardToPlayAI(state: GameState, playerId: string): CardInstance {
  const player = state.players.find((p) => p.id === playerId);
  if (!player) {
    throw new Error("AI 플레이어를 찾을 수 없습니다.");
  }
  const decisionOptions =
    state.pendingDecision?.kind === "playCard" && state.pendingDecision.playerId === playerId
      ? state.pendingDecision.options
      : player.hand;
  const playableCards = decisionOptions
    .map((option) => player.hand.find((card) => card.instanceId === option.instanceId))
    .filter((card): card is CardInstance => Boolean(card));
  if (playableCards.length === 0) {
    throw new Error("AI가 낼 수 있는 카드가 없습니다.");
  }
  if (playableCards.length === 1 || player.hand.length < 2) {
    return playableCards[0];
  }
  const dist = estimateUnseenDistribution(state, playerId);
  const [a, b] = playableCards;
  const scoreA = scoreCardToPlay(a, b, dist);
  const scoreB = scoreCardToPlay(b, a, dist);
  return scoreA >= scoreB ? a : b;
}
