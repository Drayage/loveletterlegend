import type { CardName, CharacterUpgradeTier, GameState } from "./types";

export function resolveUpgradeTier(state: GameState, cardName: CardName): CharacterUpgradeTier | undefined {
  return state.activeCardUpgrades?.[cardName];
}
