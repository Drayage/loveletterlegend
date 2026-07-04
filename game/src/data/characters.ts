// Sourced from data/cards.json id 147 (corrected version) -- the one sample
// regular-character [편지]-threshold ability upgrade wired into gameplay
// for v1 (see engine/upgrades.ts, effects.ts's "마술사" case). This is a
// session-driven display/behavior override on the base "마술사" card, not a
// new CardName.

export const WIZARD_APPRENTICE = {
  characterId: "147",
  name: "마술사의 도제 지나",
  tier1: {
    threshold: 3,
    abilityText:
      "플레이: 덱 맨 위의 카드를 최대 2장까지 봅니다. 그 후, 플레이어 한 명을 지목합니다. 그 플레이어는 손에 든 카드를 버리고 덱에서 새로 카드를 뽑습니다.",
  },
  tier2: {
    threshold: 5,
    abilityText: "플레이: 당신은 손에 든 카드를 버리고 덱에서 새로 카드를 뽑습니다.",
  },
};
