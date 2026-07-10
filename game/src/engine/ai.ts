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
  chooseIdentitySwap,
  chooseIdentityCancel,
  chooseIdentityReplacement,
  chooseIdentityExtraTurn,
} from "./rules";
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

function bestAllowedGuess(dist: Record<CardName, number>, options?: GuessOption[]): CardName {
  const allowed = new Set(options?.filter((o): o is CardName => typeof o === "string" && o in dist));
  let best: { name: CardName; p: number } | null = null;
  for (const name of Object.keys(dist) as CardName[]) {
    if (name === "경비병") continue;
    if (options && !allowed.has(name)) continue;
    if (!best || dist[name] > best.p) best = { name, p: dist[name] };
  }
  return best?.name ?? (options?.find((o): o is CardName => typeof o === "string" && o in dist) ?? "광대");
}

export function chooseGuessAI(state: GameState, playerId: string): GuessOption {
  if (state.pendingDecision?.kind === "guessCard" && state.pendingDecision.cardName === "신병") {
    const dist = estimateUnseenDistribution(state, playerId);
    const byRank = new Map<RankGuess, number>();
    let best: { rank: RankGuess; p: number } | null = null;
    for (const name of Object.keys(dist) as CardName[]) {
      const rank = cardRank(name);
      if (rank < 2 || rank > 9) continue;
      const guess = String(rank) as RankGuess;
      const p = (byRank.get(guess) ?? 0) + (dist[name] ?? 0);
      byRank.set(guess, p);
      if (!best || p > best.p) best = { rank: guess, p };
    }
    return best?.rank ?? "2";
  }
  const dist = estimateUnseenDistribution(state, playerId);
  if (state.pendingDecision?.kind === "guessCard") return bestAllowedGuess(dist, state.pendingDecision.options);
  return bestGuess(dist).name;
}

export function chooseTargetAI(
  playerId: string,
  cardName: CardName,
  eligiblePlayerIds: string[]
): string {
  const opponentIds = eligiblePlayerIds.filter((id) => id !== playerId);
  if (cardName === "마술사") {
    // Prefer attacking the opponent (possible kill shot if they might be
    // holding 공주, or at minimum disrupts their hand) unless they're the
    // only non-eligible option, in which case fall back to self.
    if (opponentIds.length > 0) return opponentIds[0];
    return playerId;
  }
  return opponentIds[0] ?? eligiblePlayerIds[0];
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

/** Single entry point for resolving ANY in-round pending decision as the
 * AI -- shared by App.tsx and the engine test drivers so a newly added
 * decision kind only needs wiring here. */
export function applyAiDecision(state: GameState, decision: PendingDecision): GameState {
  switch (decision.kind) {
    case "playCard": {
      const card = chooseCardToPlayAI(state, decision.playerId);
      return chooseCardToPlay(state, card.instanceId);
    }
    case "chooseTarget": {
      const targetId = chooseTargetAI(decision.playerId, decision.cardName, decision.eligiblePlayerIds);
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
