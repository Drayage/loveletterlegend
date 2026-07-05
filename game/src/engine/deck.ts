import { buildFullDeckDefs, CARD_DEFS } from "./cards";
import type { CardInstance, CardName } from "./types";

let instanceCounter = 0;
function nextInstanceId(): string {
  instanceCounter += 1;
  return `card-${instanceCounter}`;
}

/** `extraCardNames` -- session-revealed cards outside the base 16 (e.g. 025
 * injecting 「왕」) get appended, one instance per name, before the shuffle. */
export function shuffledDeck(extraCardNames: CardName[] = []): CardInstance[] {
  const defs = buildFullDeckDefs();
  const deck: CardInstance[] = [...defs, ...extraCardNames.map((name) => CARD_DEFS[name])].map((def) => ({
    instanceId: nextInstanceId(),
    name: def.name,
  }));
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}
