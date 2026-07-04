// Sourced from data/cards.json (corrected version), a small hand-picked
// slice of the 65-card "이야기 보관소" (story archive) chain -- not the
// full graph (see GAME_PLAN.md Phase 3).
//
// Session start seeds exactly what the rulebook's worked example shows:
// 017 「시간」, the 잉그리드 공주/아레스 왕자 character cards, and 023
// 「역사 1 이야기의 시작」. Everything else is unlocked by an actual
// round-end/round-start condition, not bundled together:
// - 024 「역사 2」 is revealed by 017's own [시계] 1개 milestone (checked at
//   the next round's start).
// - 053 「고지식한 병사」 (merged with the real 054, which has no content of
//   its own beyond the reveal condition) is revealed by 023's real
//   "라운드 종료시, 승자가 든 카드 확인" branch -- v1 only wires up the
//   《1 경비병》 branch (the other 7 branches -- 광대/기사/승려/마술사/장군/
//   대신/공주 -- reveal cards [079]/[103]/[119]/[142]/[162]/[172]/[188]
//   that are outside this v1 slice, so they're left unmodeled).
// - 031 「역사 3」 is revealed by 024's real condition ("이야기 보관소에
//   「조건」을 가진 카드가 2장 이상 있다면") -- with only one conditioned
//   card (053) ever present in this v1 slice, that threshold in practice
//   won't be reached; the mechanism is still implemented faithfully so
//   Phase 3 can add more conditioned cards without touching the engine.

import type { CardName } from "../engine/types";
import { ROUTE_DEFS } from "./routes";
import guard from "../assets/cards/guard.jpg";

export type ArchiveConditionSeed =
  | {
      id: string;
      kind: "sharedToken";
      token: "성공" | "실패";
      threshold: number;
      /** Card ids to reveal when this condition first fires. */
      revealIds: string[];
      /** Card ids to remove from the archive when this condition first fires
       * (may include cards other than the one the condition lives on --
       * 054's condition removes both 053 and 054). */
      removeIds?: string[];
    }
  | { id: string; kind: "winnerHeldCard"; cardName: CardName; revealIds: string[] }
  | { id: string; kind: "archiveCardCount"; minCount: number; revealIds: string[] };

export interface ArchiveCardSeed {
  id: string;
  name: string;
  /** Matches the real card's data/cards.json "category" -- drives the
   * 캐릭터/시나리오 split in the story archive UI. Character cards show a
   * portrait alongside their text; scenario cards don't. */
  category: "character" | "scenario";
  /** Portrait shown next to character cards (character-only). */
  art?: string;
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
    category: "scenario",
    flavor:
      "시간의 흐름은 누구에게나 공평하며 무자비합니다. 당신은 제한된 시간 내에 마음에 품은 상대의 사랑을 쟁취해 내어야 합니다.",
    conditions: [],
  },
  "018": {
    id: "018",
    name: "잉그리드 공주",
    category: "character",
    art: ROUTE_DEFS.공주.art,
    flavor: "「언젠가 제게도 사랑하는 분이 생길까요?」",
    conditions: [],
  },
  "020": {
    id: "020",
    name: "아레스 왕자",
    category: "character",
    art: ROUTE_DEFS.왕자.art,
    flavor: "「운명의 상대가 어디엔가 있으리라고 믿고 있습니다」",
    conditions: [],
  },
  "023": {
    id: "023",
    name: "역사 1 이야기의 시작",
    category: "scenario",
    flavor: "당신은 성 안의 귀인을 사랑하게 되고 말았습니다. 마음을 담은 러브 레터는 바라는 곳에 닿을 수 있을까요.",
    conditions: [{ id: "023-guard", kind: "winnerHeldCard", cardName: "경비병", revealIds: ["053"] }],
  },
  "024": {
    id: "024",
    name: "역사 2 점차 커지는 소동",
    category: "scenario",
    flavor: "편지를 둘러싼 다툼은 과열되어, 온갖 우연이 생각지도 못한 사람들마저 소동에 끌어들이고 만 것입니다.",
    conditions: [{ id: "024-count", kind: "archiveCardCount", minCount: 2, revealIds: ["031"] }],
  },
  "025": {
    id: "025",
    name: "국왕 랜들 3세",
    category: "scenario",
    flavor: "「무엄하도다!」",
    conditions: [],
  },
  "032": {
    id: "032",
    name: "역사 4 러브레터를 보내는 이들",
    category: "scenario",
    flavor:
      "수많은 역사책을 읽어내려 가자, 러브 레터를 보내는 사람들의 신상이 어렴풋이나마 드러납니다. 출신도 나이도 성별도 다양한 그들, 그녀들은 도대체 어떤 사람들이었을까요.",
    conditions: [],
  },
  "049": {
    id: "049",
    name: "역사 7 가열되는 사랑 싸움",
    category: "scenario",
    flavor:
      "긴 행보의 끝, 러브레터를 둘러싼 싸움은 열기를 더해 갑니다. 세련된 문장과 강한 마음을 담은 내용은 그 편지를 받은 자의 마음을 크게 움직였습니다.",
    conditions: [],
  },
  "050": {
    id: "050",
    name: "역사 8 결말의 시간",
    category: "scenario",
    flavor:
      "다양한 우연과 기연을 통해, 편지를 보낸 이들은 새해를 맞이하는 의례에 참석합니다. 이 기적과도 같은 순간에 자신의 마음과 마주하고 진실한 답을 찾을 수 있을까요.",
    conditions: [],
  },
  "031": {
    id: "031",
    name: "역사 3 운명의 변덕",
    category: "scenario",
    flavor:
      "운명의 여신은 편지를 보낸 이들 편인 듯합니다. 한번 러브레터에 연관된 자들은 알지 못할 인연으로 그 흐름에 휘말려 갑니다. 매 라운드에서 첫 번째로 탈락한 플레이어는 이야기 보관소의 조건이 걸린 카드 1장 위에 「성공」 또는 「실패」 토큰 1개를 놓을 수 있습니다.",
    conditions: [],
  },
  "053": {
    id: "053",
    name: "고지식한 병사",
    category: "scenario",
    flavor:
      "당신은 성문 앞에서 자주 보는 성실한 병사에게 편지를 전해달라고 부탁합니다. 그는 무뚝뚝한 얼굴로 그 편지를 받습니다. 「하는 수 없군. 해보지. 너무 기대는 하지 마시오.」 고지식한 병사가 편지를 전하러 나선 결과가 궁금해집니다.",
    conditions: [
      { id: "053-success", kind: "sharedToken", token: "성공", threshold: 2, revealIds: ["055", "056"], removeIds: ["053"] },
      { id: "053-fail", kind: "sharedToken", token: "실패", threshold: 4, revealIds: ["062"], removeIds: ["053"] },
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
    category: "character",
    art: guard,
    flavor: "「너도 꽤 하는구나. 글쎄, 도울 수 있는 일은 돕도록 하지.」",
    conditions: [],
  },
  "056": {
    id: "056",
    name: "경비병 알리오스",
    category: "character",
    art: guard,
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
    category: "scenario",
    flavor:
      "병사들이 편지의 전갈을 맡고 있는 것이 왕에게 알려지고 말았습니다. 그들은 왕에게 꾸중을 듣고, 주선을 해 주지 않게 되어 버렸습니다. 다른 수단을 생각하지 않으면....",
    conditions: [],
  },
};

/** [시계] N개 -> reveal these ids, checked at the next round's start (017's
 * own "시작" tag). 024 is the only one reachable from this v1 slice's
 * starting content; 025/032/049/050 are further down the real 017 table
 * and stay reachable for completeness even though nothing else in this
 * slice reacts to them yet. */
export const CLOCK_MILESTONES: Record<number, string[]> = {
  1: ["024"],
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
