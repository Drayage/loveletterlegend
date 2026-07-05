import { CARD_DEFS, CARD_ORDER } from "./cards";
import type { CardInstance, CardName, GameState } from "./types";

/** How many copies of each card name are still unaccounted for -- i.e. not
 * yet in any discard pile and not publicly removed. Purely derived from
 * public information (discards + face-up removed cards), so it's safe to
 * show to both players. */
export function computeRemainingCounts(state: GameState): Record<CardName, number> {
  const remaining: Record<CardName, number> = {} as Record<CardName, number>;
  for (const name of CARD_ORDER) remaining[name] = CARD_DEFS[name].count;

  const subtract = (card: CardInstance) => {
    // Session-revealed cards outside the base 16 (e.g. 「왕」) aren't in
    // CARD_ORDER, so their count isn't pre-seeded above -- initialize
    // lazily from CARD_DEFS on first sighting instead of assuming 0/undefined.
    if (remaining[card.name] === undefined) remaining[card.name] = CARD_DEFS[card.name].count;
    remaining[card.name] = Math.max(0, remaining[card.name] - 1);
  };
  for (const p of state.players) {
    for (const c of p.discardPile) subtract(c);
  }
  for (const c of state.faceUpRemovedCards) subtract(c);

  return remaining;
}
