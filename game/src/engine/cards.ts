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
  왕자: {
    name: "왕자",
    rank: 8,
    count: 1,
    englishAlias: "Prince",
    shortAbility: "버리게 되면 즉시 탈락",
    ability: "이 카드를 버려야 하는 상황이 생기면, 당신은 즉시 라운드에서 탈락합니다.",
  },
  왕: {
    name: "왕",
    // 실카드는 숫자 대신 "X" -- 순위 비교에 참여하지 않으므로 임의로 0.
    rank: 0,
    count: 1,
    englishAlias: "King",
    shortAbility: "손에 들고 있으면 즉시 탈락 (패시브)",
    ability: "당신은 라운드에서 탈락합니다.",
  },
  마을소녀: {
    name: "마을소녀",
    rank: 0,
    count: 1,
    englishAlias: "Village Girl",
    shortAbility: "라운드 종료 시 숫자 7로 계산",
    ability: "라운드 종료시, 이 카드의 숫자는 7이 됩니다.",
  },
  // 023의 나머지 분기들이 실카드의 [등장] 태그로 기존 base 카드 일부를
  // 대체/추가하는 새 카드들 (see data/scenario.ts's deckEffect, engine/
  // session.ts's applyDeckEffect). CARD_ORDER에는 포함되지 않으며, 세션의
  // extraDeckCardNames/removedBaseCardNames를 통해 조건부로만 덱에 들어간다.
  신병: {
    name: "신병",
    rank: 1,
    count: 1,
    englishAlias: "Recruit",
    shortAbility: "0과 1을 제외한 숫자 하나 추측, 적중하면 상대 탈락",
    ability:
      "다른 플레이어를 지목한 뒤, 0과 1을 제외한 숫자 하나를 댑니다. 만약 지목된 플레이어가 그 숫자 카드를 갖고 있다면 라운드에서 탈락합니다.",
  },
  시종: {
    name: "시종",
    rank: 1,
    count: 5,
    englishAlias: "Servant",
    shortAbility: "두 플레이어의 손패 교환",
    ability: "플레이어 두 명을 선택합니다(자신 포함). 그 플레이어들은 손에 든 카드를 서로 바꿉니다.",
  },
  시녀: {
    name: "시녀",
    rank: 1,
    count: 5,
    englishAlias: "Maid",
    shortAbility: "두 플레이어의 손패 교환",
    ability: "플레이어 두 명을 선택합니다(자신 포함). 그 플레이어들은 손에 든 카드를 서로 바꿉니다.",
  },
  광대의제자: {
    name: "광대의제자",
    rank: 2,
    count: 1,
    englishAlias: "Clown's Apprentice",
    shortAbility: "상대 한 명의 손패를 확인 (광대와 동일)",
    ability: "다른 플레이어 한 명을 지목하여 그 플레이어가 손에 든 카드를 봅니다.",
  },
  광대의제자여: {
    name: "광대의제자여",
    rank: 2,
    count: 1,
    englishAlias: "Clown's Apprentice (F)",
    shortAbility: "비공개 제거 카드를 확인",
    ability: "비공개 카드를 봅니다.",
  },
  점술사: {
    name: "점술사",
    rank: 2,
    count: 1,
    englishAlias: "Fortune Teller",
    shortAbility: "덱 맨 위 확인 후 교환, 또는 상대 승리에 편승(공동 승리)",
    ability:
      "플레이: 아래에서 하나를 선택합니다.\n1. 덱 맨 위 카드를 봅니다. 당신은 손에 든 카드와 그 카드를 바꿀 수 있습니다.\n2. 다른 플레이어 한 명을 지목합니다. 그 플레이어가 라운드에서 승리하면 당신도 같이 승리합니다.",
  },
  배우: {
    name: "배우",
    rank: 9,
    count: 1,
    englishAlias: "Actor",
    shortAbility: "라운드 종료 시 숫자 0으로 계산",
    ability: "라운드 종료시, 이 카드의 숫자는 0이 됩니다.",
  },
  무희: {
    name: "무희",
    rank: 0,
    count: 1,
    englishAlias: "Dancer",
    shortAbility: "라운드 종료 시 숫자 9로 계산",
    ability: "라운드 종료시, 이 카드의 숫자는 9가 됩니다.",
  },
  복면기사: {
    name: "복면기사",
    rank: 3,
    count: 1,
    englishAlias: "Masked Knight",
    shortAbility: "상대와 카드 숫자 비교, 높으면 탈락 (기사와 반대)",
    ability:
      "당신은 다른 플레이어 한 명과 손에 든 카드의 숫자를 서로 비밀리에 비교합니다. 이때 숫자가 더 큰 카드를 가진 플레이어는 라운드에서 탈락합니다.",
  },
  여기사: {
    name: "여기사",
    rank: 3,
    count: 1,
    englishAlias: "Lady Knight",
    shortAbility: "상대와 카드 숫자 비교, 높으면 탈락",
    ability:
      "당신은 다른 플레이어 한 명과 손에 든 카드의 숫자를 서로 비밀리에 비교합니다. 이때 숫자가 더 큰 카드를 가진 플레이어는 라운드에서 탈락합니다.",
  },
  상인: {
    name: "상인",
    rank: 3,
    count: 2,
    englishAlias: "Merchant",
    shortAbility: "상대 지목, 손패 숫자 3 이하면 탈락",
    ability: "다른 플레이어 한 명을 지목합니다. 그 플레이어가 손에 든 카드의 숫자가 3 이하라면 라운드에서 탈락합니다.",
  },
  수사: {
    name: "수사",
    rank: 4,
    count: 2,
    englishAlias: "Friar",
    shortAbility: "버림 더미에서 고른 카드 1장의 「플레이:」 효과 재사용",
    ability: "플레이: 버림 더미에 있는 카드 1장을 선택합니다. 그 카드의 「플레이:」효과를 사용합니다.",
  },
  수녀: {
    name: "수녀",
    rank: 4,
    count: 2,
    englishAlias: "Nun",
    shortAbility: "버림 더미에서 고른 카드 1장의 「플레이:」 효과 재사용",
    ability: "플레이: 버림 더미에 있는 카드 1장을 선택합니다. 그 카드의 「플레이:」효과를 사용합니다.",
  },
  집사: {
    name: "집사",
    rank: 4,
    count: 2,
    englishAlias: "Butler",
    shortAbility: "버림 더미에 있으면 비교/라운드 종료 숫자 +2",
    ability: "이 카드가 버림 더미에 있을 경우, 카드의 숫자를 비교할 때와 라운드 종료시에 손에 든 카드의 숫자에 2를 더합니다.",
  },
  마녀: {
    name: "마녀",
    rank: 5,
    count: 1,
    englishAlias: "Witch",
    shortAbility: "모든 손패를 모아 무작위 재분배",
    ability: "모든 플레이어가 들고 있는 카드를 뒷면으로 모아서, 무작위로 다시 나누어 줍니다.",
  },
  대마도사15: {
    name: "대마도사15",
    rank: 5,
    count: 1,
    englishAlias: "Archmage (15)",
    shortAbility: "상대 손패를 버리고 쥐를 줌",
    ability: "다른 플레이어 한 명을 지목합니다. 그 플레이어는 손에 든 카드를 버리고 게임 밖에서 「쥐」 1장을 가져와 손에 듭니다.",
  },
  쥐: {
    name: "쥐",
    rank: 0,
    count: 1,
    englishAlias: "Mouse",
    shortAbility: "플레이하면 탈락, 덱 밖 카드",
    ability: "플레이: 당신은 라운드에서 탈락합니다. 이 카드는 덱에 넣지 않고 옆으로 빼놓습니다. 대마도사(20세)의 편지 조건이 달성된 상태라면, 대마도사(20세)가 건넨 「쥐」는 손에 든 즉시 탈락하는 패시브 카드가 됩니다.",
  },
  대마도사20: {
    name: "대마도사20",
    rank: 5,
    count: 1,
    englishAlias: "Archmage (20)",
    shortAbility: "상대 손패를 받고 상대에게 쥐를 줌",
    ability:
      "다른 플레이어 한 명을 지목합니다. 그 플레이어는 손에 든 카드를 당신에게 건네주고, 게임 밖에서 「쥐」 1장을 가져와 손에 듭니다. 그 후, 당신은 손에 든 카드 중 1장을 버립니다.",
  },
  여장군: {
    name: "여장군",
    rank: 6,
    count: 1,
    englishAlias: "Lady General",
    shortAbility: "이 카드는 스스로 낼 수 없음 (패시브)",
    ability: "이 카드는 내려놓을 수 없습니다.",
  },
  군사: {
    name: "군사",
    rank: 6,
    count: 1,
    englishAlias: "Tactician",
    shortAbility: "상대 손패 확인 후 교환 여부 선택",
    ability:
      "플레이: 다른 플레이어 한 명을 지목합니다. 그 플레이어가 손에 든 카드를 봅니다. 그 카드와 당신의 카드를 교환할 수 있습니다.",
  },
  정무관남: {
    name: "정무관남",
    rank: 7,
    count: 1,
    englishAlias: "Regent (Male)",
    shortAbility: "플레이하면 이번 라운드 동안 탈락하지 않음",
    ability: "플레이: 당신은 이번 라운드에서 탈락하지 않습니다.",
  },
  정무관여: {
    name: "정무관여",
    rank: 7,
    count: 1,
    englishAlias: "Regent (Female)",
    shortAbility: "플레이하면 이번 라운드 동안 탈락하지 않음",
    ability: "플레이: 당신은 이번 라운드에서 탈락하지 않습니다.",
  },
  여후작: {
    name: "여후작",
    rank: 7,
    count: 1,
    englishAlias: "Marchioness",
    shortAbility: "손패 합계 12 이상이면 이 카드를 반드시 냄 (패시브)",
    ability: "당신이 손에 든 카드 숫자의 합이 12 이상이라면 반드시 이 카드를 내려놓아야 합니다.",
  },
  마술사의도제: {
    name: "마술사의도제",
    rank: 5,
    count: 1,
    englishAlias: "Wizard's Apprentice",
    shortAbility: "덱 맨 위 확인 후, 다른 플레이어를 지목해 손패 교체시킴",
    ability:
      "덱 맨 위의 카드를 봅니다. 그 후, 다른 플레이어 한 명을 지목합니다. 그 플레이어는 손에 든 카드를 버리고 덱에서 새로 카드를 뽑습니다.",
  },
  공주둘째: {
    name: "공주둘째",
    rank: 8,
    count: 1,
    englishAlias: "Second Princess",
    shortAbility: "탈락하면 덱에서 1장 뽑고 복귀",
    ability: "당신이 라운드에서 탈락했다면, 덱에서 카드 한 장을 뽑아 손에 들고 게임에 복귀합니다.",
  },
  공주셋째: {
    name: "공주셋째",
    rank: 8,
    count: 1,
    englishAlias: "Third Princess",
    shortAbility: "버리면 즉시 탈락하고 라운드 종료",
    ability: "이 카드를 버려야 하는 상황이 생기면, 당신은 즉시 라운드에서 탈락합니다. 즉시 라운드를 종료합니다.",
  },
  백작부인: {
    name: "백작부인",
    rank: 8,
    count: 1,
    englishAlias: "Countess",
    shortAbility: "내려놓을 수 없음, 들고 라운드 승리 시 백작부인 이야기 진행",
    ability:
      "이 카드는 내려놓을 수 없습니다. 「나른한 백작부인」이 이야기 보관소에 있다면, 이 카드를 손에 들고 라운드 승리 시 다음 백작부인 이야기가 공개됩니다.",
  },
  귀족영애: {
    name: "귀족영애",
    rank: 8,
    count: 1,
    englishAlias: "Noble Lady",
    shortAbility: "버리게 되면 즉시 탈락 (탈락 후 덱에 복귀)",
    ability:
      "이 카드를 버려야 하는 상황이 생기면, 당신은 즉시 라운드에서 탈락합니다. 그 후, 덱에 카드가 1장 이상 남아 있다면 이 카드를 덱에 넣고 섞습니다.",
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

export const ALL_CARD_NAMES = Object.keys(CARD_DEFS) as CardName[];

export function buildFullDeckDefs(): CardDef[] {
  return CARD_ORDER.flatMap((name) => {
    const def = CARD_DEFS[name];
    return Array.from({ length: def.count }, () => def);
  });
}
