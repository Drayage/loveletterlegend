import type { CardName, CharacterUpgradeTier, GameState } from "./types";
import { WIZARD_APPRENTICE } from "../data/characters";

export function resolveUpgradeTier(
  state: GameState,
  cardName: CardName,
  playerId?: string
): CharacterUpgradeTier | undefined {
  if (playerId) return state.activeCardUpgradesByPlayer?.[playerId]?.[cardName] ?? state.activeCardUpgrades?.[cardName];
  return state.activeCardUpgrades?.[cardName];
}

/** 실제로 무엇이 바뀌었는지 보여주는 짧은 설명 -- 카드 위 "효과 변경" 배지가
 * 그냥 "1단계"라고만 말하고 끝나면 뭐가 달라졌는지 알 길이 없어서, Card.tsx가
 * 이 텍스트로 배지 툴팁과 능력 설명 오버레이를 함께 갱신한다 (see
 * cardUpgradeDescriptions in App.tsx). session.ts's upgradesForPlayer가
 * 실제로 걸어주는 tier와 1:1로 맞춰 둘 것 -- 새 강화 카드를 추가할 때
 * 여기도 같이 채워야 배지가 뜻 있는 정보를 보여준다. */
export const UPGRADE_ABILITY_TEXT: Partial<Record<CardName, Partial<Record<CharacterUpgradeTier, string>>>> = {
  경비병: { tier1: "「1」 외에 숫자 2개를 동시에 추측합니다 (하나만 맞아도 적중)." },
  마을소녀: { tier1: "라운드 종료시, 이 카드의 숫자는 9가 됩니다." },
  배우: { tier1: "라운드 종료시, 이 카드의 숫자는 2가 됩니다." },
  무희: { tier1: "라운드 종료시, 이 카드의 숫자는 7이 됩니다." },
  상인: { tier1: "지목한 플레이어의 손패 숫자가 5 이하라면 탈락시킵니다." },
  수녀: { tier1: "효과 사용 후, 다음 차례까지 보호받습니다." },
  마녀: { tier1: "모은 카드를 확인하고, 자신이 가질 카드를 직접 고릅니다." },
  대마도사20: { tier1: "건넨 「쥐」를 손에 들면 그 즉시 탈락하는 패시브 카드가 됩니다." },
  정무관남: { tier1: "「탈락하지 않기」와 「상대 탈락」 중 하나를 고릅니다." },
  정무관여: { tier1: "다른 플레이어는 대상이 필요한 효과를 낼 때 당신을 지목해야 합니다." },
  마술사: { tier1: WIZARD_APPRENTICE.tier1.abilityText, tier2: WIZARD_APPRENTICE.tier2.abilityText },
};
