import { buildFullDeckDefs, CARD_DEFS } from "./cards";
import type { CardInstance, CardName } from "./types";

let instanceCounter = 0;
function nextInstanceId(): string {
  instanceCounter += 1;
  return `card-${instanceCounter}`;
}

/** `extraCardNames` -- session-revealed cards outside the base 16 (e.g. 025
 * injecting 「왕」) get appended, one instance per name, before the shuffle.
 * `removedBaseCardNames` -- one entry per copy of a base CARD_ORDER card
 * that's been permanently swapped out (e.g. 080 removing one 「광대」 to
 * make room for 「광대의 제자」). Each entry removes exactly one matching
 * copy from the freshly-built base defs. */
export function shuffledDeck(extraCardNames: CardName[] = [], removedBaseCardNames: CardName[] = []): CardInstance[] {
  let defs = buildFullDeckDefs();
  const toRemove = [...removedBaseCardNames];
  defs = defs.filter((def) => {
    const idx = toRemove.indexOf(def.name);
    if (idx === -1) return true;
    toRemove.splice(idx, 1);
    return false;
  });
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
