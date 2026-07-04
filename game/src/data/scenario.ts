// Sourced from data/cards.json (corrected version), a small hand-picked
// slice of the 65-card "이야기 보관소" (story archive) chain -- not the
// full graph (see GAME_PLAN.md Phase 3).
//
// Only card 017 "시간" is seeded at session start (it's the origin
// scenario, and its [시계] threshold table below drives every other
// reveal). Everything else -- including 031 "역사 3" (the only source of
// the "첫 탈락자가 성공/실패 토큰을 놓을 수 있습니다" mechanic) and
// "고지식한 병사" (053, the interactive [성공]/[실패] demo) -- is gated
// behind [시계] 1 instead of appearing immediately in round 1. v1
// simplification: the real chain requires 역사 2 (024) to exist AND the
// archive to already hold 2+ conditioned cards before 031 unlocks; here
// they're just bundled into the same first milestone. 053/054 in the real
// cards are split across two physical cards purely for layout reasons --
// 053 has no mechanical content of its own beyond flavor, so they're
// merged into one archive entry here.

export interface ArchiveConditionSeed {
  id: string;
  token: "성공" | "실패";
  threshold: number;
  /** Card ids to reveal when this condition first fires. */
  revealIds: string[];
  /** Card ids to remove from the archive when this condition first fires
   * (may include cards other than the one the condition lives on --
   * 054's condition removes both 053 and 054). */
  removeIds?: string[];
}

export interface ArchiveCardSeed {
  id: string;
  name: string;
  flavor: string;
  conditions: ArchiveConditionSeed[];
  /** Real card text describing what actions move the shared [성공]/[실패]
   * counters -- shown to the player so they can play toward it, WITHOUT
   * revealing what the condition actually unlocks (that stays a surprise). */
  earnRules?: string[];
}

export const ARCHIVE_CARD_SEEDS: Record<string, ArchiveCardSeed> = {
  "017": {
    id: "017",
    name: "시간",
    flavor:
      "시간의 흐름은 누구에게나 공평하며 무자비합니다. 당신은 제한된 시간 내에 마음에 품은 상대의 사랑을 쟁취해 내어야 합니다.",
    conditions: [],
  },
  "024": {
    id: "024",
    name: "역사 2 점차 커지는 소동",
    flavor: "편지를 둘러싼 다툼은 과열되어, 온갖 우연이 생각지도 못한 사람들마저 소동에 끌어들이고 만 것입니다.",
    conditions: [],
  },
  "025": {
    id: "025",
    name: "국왕 랜들 3세",
    flavor: "「무엄하도다!」",
    conditions: [],
  },
  "032": {
    id: "032",
    name: "역사 4 러브레터를 보내는 이들",
    flavor:
      "수많은 역사책을 읽어내려 가자, 러브 레터를 보내는 사람들의 신상이 어렴풋이나마 드러납니다. 출신도 나이도 성별도 다양한 그들, 그녀들은 도대체 어떤 사람들이었을까요.",
    conditions: [],
  },
  "049": {
    id: "049",
    name: "역사 7 가열되는 사랑 싸움",
    flavor:
      "긴 행보의 끝, 러브레터를 둘러싼 싸움은 열기를 더해 갑니다. 세련된 문장과 강한 마음을 담은 내용은 그 편지를 받은 자의 마음을 크게 움직였습니다.",
    conditions: [],
  },
  "050": {
    id: "050",
    name: "역사 8 결말의 시간",
    flavor:
      "다양한 우연과 기연을 통해, 편지를 보낸 이들은 새해를 맞이하는 의례에 참석합니다. 이 기적과도 같은 순간에 자신의 마음과 마주하고 진실한 답을 찾을 수 있을까요.",
    conditions: [],
  },
  "031": {
    id: "031",
    name: "역사 3 운명의 변덕",
    flavor:
      "운명의 여신은 편지를 보낸 이들 편인 듯합니다. 한번 러브레터에 연관된 자들은 알지 못할 인연으로 그 흐름에 휘말려 갑니다. 매 라운드에서 첫 번째로 탈락한 플레이어는 이야기 보관소의 조건이 걸린 카드 1장 위에 「성공」 또는 「실패」 토큰 1개를 놓을 수 있습니다.",
    conditions: [],
  },
  "053": {
    id: "053",
    name: "고지식한 병사",
    flavor:
      "당신은 성문 앞에서 자주 보는 성실한 병사에게 편지를 전해달라고 부탁합니다. 그는 무뚝뚝한 얼굴로 그 편지를 받습니다. 「하는 수 없군. 해보지. 너무 기대는 하지 마시오.」 고지식한 병사가 편지를 전하러 나선 결과가 궁금해집니다.",
    conditions: [
      { id: "053-success", token: "성공", threshold: 2, revealIds: ["055", "056"], removeIds: ["053"] },
      { id: "053-fail", token: "실패", threshold: 4, revealIds: ["062"], removeIds: ["053"] },
    ],
    earnRules: [
      "「경비병」을 손에 들고 라운드 승리: 성공",
      "「경비병」으로 다른 플레이어를 탈락시킴: 성공",
      "「경비병」을 손에 들고 탈락함: 실패",
      "「경비병」으로 지목했으나 추측이 빗나감: 실패",
    ],
  },
  "055": {
    id: "055",
    name: "경비병 알리오스",
    flavor: "「너도 꽤 하는구나. 글쎄, 도울 수 있는 일은 돕도록 하지.」",
    conditions: [],
  },
  "056": {
    id: "056",
    name: "경비병 알리오스",
    // Real ability text (편지 누적 -> 경비병 문구 변경) -- shown as flavor
    // only in v1; not wired into gameplay (see plan's noted asymmetry,
    // only "마술사의도제" got a live mechanical hookup this round).
    flavor:
      "《1 경비병》을 손에 들고 라운드 승리: +[편지] 2개. [편지] 3개 이상이면 「1」 외에 두 숫자를 대는 경비병으로 문구가 바뀝니다.",
    conditions: [],
  },
  "062": {
    id: "062",
    name: "왕의 불호령",
    flavor:
      "병사들이 편지의 전갈을 맡고 있는 것이 왕에게 알려지고 말았습니다. 그들은 왕에게 꾸중을 듣고, 주선을 해 주지 않게 되어 버렸습니다. 다른 수단을 생각하지 않으면....",
    conditions: [],
  },
};

/** [시계] N개 -> reveal these ids. 024/025/032/049/050 are the real
 * flavor-only thresholds from card 017; 031/053 are bundled into the same
 * first milestone as a v1 simplification (see module header) so the
 * [성공]/[실패] mechanic isn't visible from round 1. */
export const CLOCK_MILESTONES: Record<number, string[]> = {
  1: ["024", "031", "053"],
  2: ["025"],
  3: ["032"],
  6: ["049"],
  7: ["050"],
};

export const ENDING_FLAVOR = {
  cardId: "051",
  name: "역사 9 운명의 순간",
  text: "스토리북의 21쪽으로 갑니다.",
};
