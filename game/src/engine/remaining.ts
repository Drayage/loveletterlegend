import type { CardInstance, CardName, GameState } from "./types";

/** How many copies of each card name are still unaccounted for -- i.e. not
 * yet in any discard pile and not publicly removed. Purely derived from
 * public information (discards + face-up removed cards), so it's safe to
 * show to both players. */
export function computeRemainingCounts(state: GameState): Record<CardName, number> {
  const remaining: Record<CardName, number> = {} as Record<CardName, number>;

  const add = (card: CardInstance | null | undefined) => {
    if (!card) return;
    remaining[card.name] = (remaining[card.name] ?? 0) + 1;
  };

  for (const c of state.deck) add(c);
  add(state.hiddenRemovedCard);
  for (const c of state.faceUpRemovedCards) add(c);
  for (const p of state.players) {
    for (const c of p.hand) add(c);
    for (const c of p.discardPile) add(c);
  }

  const subtract = (card: CardInstance) => {
    remaining[card.name] = Math.max(0, remaining[card.name] - 1);
  };
  for (const p of state.players) {
    for (const c of p.discardPile) subtract(c);
  }
  for (const c of state.faceUpRemovedCards) subtract(c);

  return remaining;
}
