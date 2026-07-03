import { CARD_DEFS, CARD_ORDER } from "./cards";
import { cardRank } from "./effects";
import type { CardInstance, CardName, GameState } from "./types";

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
  for (const name of CARD_ORDER) remaining[name] = CARD_DEFS[name].count;

  const subtract = (card: CardInstance) => {
    remaining[card.name] = Math.max(0, remaining[card.name] - 1);
  };

  for (const p of state.players) {
    for (const c of p.discardPile) subtract(c);
    if (p.id === forPlayerId) {
      for (const c of p.hand) subtract(c);
    }
  }
  for (const c of state.faceUpRemovedCards) subtract(c);

  const total = Object.values(remaining).reduce((a, b) => a + b, 0);
  const dist: Record<CardName, number> = {} as Record<CardName, number>;
  for (const name of CARD_ORDER) {
    dist[name] = total > 0 ? remaining[name] / total : 0;
  }
  return dist;
}

function bestGuess(dist: Record<CardName, number>): { name: CardName; p: number } {
  let best: { name: CardName; p: number } | null = null;
  for (const name of CARD_ORDER) {
    if (name === "경비병") continue;
    if (!best || dist[name] > best.p) best = { name, p: dist[name] };
  }
  return best ?? { name: "광대", p: 0 };
}

export function chooseGuessAI(state: GameState, playerId: string): CardName {
  const dist = estimateUnseenDistribution(state, playerId);
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

function scoreCardToPlay(
  play: CardInstance,
  keep: CardInstance,
  dist: Record<CardName, number>
): number {
  if (play.name === "공주") return -1000;

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
      const winProb = CARD_ORDER.filter((n) => cardRank(n) < cardRank(keep.name)).reduce(
        (acc, n) => acc + (dist[n] ?? 0),
        0
      );
      return base + (winProb - 0.5) * 20;
    }
    case "장군": {
      const myRank = cardRank(keep.name);
      const expectedOpponentRank = CARD_ORDER.reduce(
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

export function chooseCardToPlayAI(state: GameState, playerId: string): CardInstance {
  const player = state.players.find((p) => p.id === playerId);
  if (!player || player.hand.length !== 2) {
    throw new Error("AI는 카드 2장을 들고 있어야 합니다.");
  }
  const dist = estimateUnseenDistribution(state, playerId);
  const [a, b] = player.hand;
  const scoreA = scoreCardToPlay(a, b, dist);
  const scoreB = scoreCardToPlay(b, a, dist);
  return scoreA >= scoreB ? a : b;
}
