import type { GameState } from "./types";

// State is plain JSON-serializable data, so a deep clone via structuredClone
// is simple and correct; the state is tiny (a handful of cards) so this is
// not a performance concern.
export function cloneState(state: GameState): GameState {
  return structuredClone(state);
}

let logCounter = 0;
export function nextLogId(): string {
  logCounter += 1;
  return `log-${logCounter}`;
}
