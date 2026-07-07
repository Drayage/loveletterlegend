import type { CardName, CharacterUpgradeTier, GameState } from "./types";

export function resolveUpgradeTier(
  state: GameState,
  cardName: CardName,
  playerId?: string
): CharacterUpgradeTier | undefined {
  if (playerId) return state.activeCardUpgradesByPlayer?.[playerId]?.[cardName] ?? state.activeCardUpgrades?.[cardName];
  return state.activeCardUpgrades?.[cardName];
}
