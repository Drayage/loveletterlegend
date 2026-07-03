import type { CardDef, CardName } from "./types";

// Base 16-card deck, sourced from data/cards.json ids 001-016 (rulebook p.9).
export const CARD_DEFS: Record<CardName, CardDef> = {
  경비병: {
    name: "경비병",
    rank: 1,
    count: 5,
    englishAlias: "Guard",
    shortAbility: "상대 지목 후 카드 추측, 적중하면 상대 탈락",
    ability:
      "다른 플레이어를 지목한 뒤, 「경비병」을 제외한 카드의 이름을 하나 댑니다. 만약 지목된 플레이어가 그 카드를 갖고 있다면 라운드에서 탈락합니다.",
  },
  광대: {
    name: "광대",
    rank: 2,
    count: 2,
    englishAlias: "Clown",
    shortAbility: "상대 한 명의 손패를 확인",
    ability: "다른 플레이어 한 명을 지목하여 그 플레이어가 손에 든 카드를 봅니다.",
  },
  기사: {
    name: "기사",
    rank: 3,
    count: 2,
    englishAlias: "Knight",
    shortAbility: "상대와 카드 숫자 비교, 낮으면 탈락",
    ability:
      "당신은 다른 플레이어 한 명과 손에 든 카드의 숫자를 서로 비밀리에 비교합니다. 이때 숫자가 더 작은 카드를 가진 플레이어는 라운드에서 탈락합니다.",
  },
  승려: {
    name: "승려",
    rank: 4,
    count: 2,
    englishAlias: "Priestess",
    shortAbility: "다음 차례까지 효과로부터 보호",
    ability: "당신의 다음 차례가 올 때까지 당신은 다른 카드의 「플레이:」효과를 받지 않습니다.",
  },
  마술사: {
    name: "마술사",
    rank: 5,
    count: 2,
    englishAlias: "Wizard",
    shortAbility: "지목한 플레이어가 손패를 버리고 새로 드로우",
    ability:
      "당신 혹은 다른 플레이어 한 명을 지목합니다. 그 플레이어는 손에 든 카드를 버리고 덱에서 새로 카드를 뽑습니다.",
  },
  장군: {
    name: "장군",
    rank: 6,
    count: 1,
    englishAlias: "General",
    shortAbility: "상대와 손패를 서로 교환",
    ability: "다른 플레이어 한 명과 손에 든 카드를 서로 교환합니다.",
  },
  대신: {
    name: "대신",
    rank: 7,
    count: 1,
    englishAlias: "Minister",
    shortAbility: "손패 합계 12 이상이면 자동 탈락 (패시브)",
    ability: "당신이 손에 든 카드 숫자의 합이 12 이상이라면, 당신은 탈락합니다.",
  },
  공주: {
    name: "공주",
    rank: 8,
    count: 1,
    englishAlias: "Princess",
    shortAbility: "버리게 되면 즉시 탈락",
    ability: "이 카드를 버려야 하는 상황이 생기면, 당신은 즉시 라운드에서 탈락합니다.",
  },
};

export const CARD_ORDER: CardName[] = [
  "경비병",
  "광대",
  "기사",
  "승려",
  "마술사",
  "장군",
  "대신",
  "공주",
];

export function buildFullDeckDefs(): CardDef[] {
  return CARD_ORDER.flatMap((name) => {
    const def = CARD_DEFS[name];
    return Array.from({ length: def.count }, () => def);
  });
}
