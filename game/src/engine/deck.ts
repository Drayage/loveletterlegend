import { buildFullDeckDefs } from "./cards";
import type { CardInstance } from "./types";

let instanceCounter = 0;
function nextInstanceId(): string {
  instanceCounter += 1;
  return `card-${instanceCounter}`;
}

export function shuffledDeck(): CardInstance[] {
  const defs = buildFullDeckDefs();
  const deck: CardInstance[] = defs.map((def) => ({
    instanceId: nextInstanceId(),
    name: def.name,
  }));
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}
