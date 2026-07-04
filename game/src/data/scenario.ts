// Sourced from data/cards.json (corrected version), a small hand-picked
// slice of the 65-card "이야기 보관소" (story archive) chain -- not the
// full graph (see GAME_PLAN.md Phase 3).
//
// Session start seeds exactly what the rulebook's worked example shows:
// 017 「시간」, the 잉그리드 공주/아레스 왕자 character cards, and 023
// 「역사 1 이야기의 시작」. Everything else is unlocked by an actual
// round-end/round-start condition, not bundled together:
// - 024/025/032/049/050 are revealed by 017's own real "시작" tag table
//   ([시계] N개 -> 공개), modeled as `clockThreshold` conditions living on
//   017 itself (see ArchiveConditionSeed below) instead of a separate
//   CLOCK_MILESTONES table.
// - 053 「고지식한 병사」 (merged with the real 054, which has no content of
//   its own beyond the reveal condition) is revealed by 023's real
//   "라운드 종료시, 승자가 든 카드 확인" branch -- v1 only wires up the
//   《1 경비병》 branch (the other 7 branches -- 광대/기사/승려/마술사/장군/
//   대신/공주 -- reveal cards [079]/[103]/[119]/[142]/[162]/[172]/[188]
//   that are outside this v1 slice, so they're left unmodeled).
// - 031 「역사 3」 is revealed by 024's real condition ("이야기 보관소에
//   「조건」을 가진 카드가 2장 이상 있다면"). 「조건」 is a specific tag on
//   the real cards (053/054's threshold branches carry it; 017/023's
//   시작/종료 reveal tables do NOT) -- modeled as `conditionTag` on the
//   card seed. With only one [조건] card (053) ever present in this v1
//   slice, that threshold in practice won't be reached and 031 won't
//   appear -- which is the CORRECT behavior; the mechanism stays faithful
//   so Phase 3 can add more [조건] cards without touching the engine.
// - 시나리오 cards themselves expire: real 종료 tags "[시계] N개: 이 카드를
//   제거합니다." (023: 4, 024: 5, 031: 6) -- modeled as `expiresAtClock`,
//   processed at round end after that round's reveal conditions.
// - 025/032/039 (「국왕 랜들 3세」/「역사 4」/「역사 5」) each gate a real NEW
//   base-game mechanic (025 adds a playable 「왕」 card to the deck; 032
//   hands out a persistent per-player "정체" identity card with its own
//   passive ability; 039 adds a "축제" sub-deck) that this v1 slice doesn't
//   implement -- so 025 stays a flavor-only leaf (no further reveals wired
//   up), and 032/039 aren't seeded here at all yet (Phase 3 follow-up).
// - 049/050 (「역사 7」/「역사 8」) don't gate new mechanics -- their real
//   "중요" tags are optional bonus [편지] grants layered on top of 017's
//   own round-win award, applied automatically once revealed (see
//   engine/session.ts's applySessionRoundEnd). 050's own "종료" tag
//   (winning with the rank-8 card while leading its route) reveals 051,
//   modeled as a bespoke check in finalizeRoundEndDecisions since it needs
//   the post-placement letter-token state that the generic checker doesn't
//   have access to.

import type { CardName } from "../engine/types";
import { ROUTE_DEFS } from "./routes";
import guard from "../assets/cards/guard.jpg";

export type ArchiveConditionSeed =
  | {
      id: string;
      kind: "sharedToken";
      /** Checklist row shown in the archive UI -- hypothesis only, never
       * the reveal targets (those stay a surprise). */
      label: string;
      token: "성공" | "실패";
      threshold: number;
      /** Card ids to reveal when this condition first fires. */
      revealIds: string[];
      /** Card ids to remove from the archive when this condition first fires
       * (may include cards other than the one the condition lives on --
       * 054's condition removes both 053 and 054). */
      removeIds?: string[];
    }
  | { id: string; kind: "winnerHeldCard"; label: string; cardName: CardName; revealIds: string[] }
  | { id: string; kind: "archiveCardCount"; label: string; minCount: number; revealIds: string[] }
  | { id: string; kind: "clockThreshold"; label: string; threshold: number; revealIds: string[] };

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
  /** Real [조건] tag holder (053) -- see types.ts ArchiveCardState. */
  conditionTag?: boolean;
  /** "[시계] N개: 이 카드를 제거합니다." -- see types.ts ArchiveCardState. */
  expiresAtClock?: number;
  /** Checklist heading shown above the conditions in the archive UI. */
  conditionsTitle?: string;
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
    conditionsTitle: "라운드 시작 시, 지나간 시간([시계]) 확인",
    conditions: [
      { id: "017-clock-1", kind: "clockThreshold", label: "[시계] 1개", threshold: 1, revealIds: ["024"] },
      { id: "017-clock-2", kind: "clockThreshold", label: "[시계] 2개", threshold: 2, revealIds: ["025"] },
      { id: "017-clock-3", kind: "clockThreshold", label: "[시계] 3개", threshold: 3, revealIds: ["032"] },
      { id: "017-clock-6", kind: "clockThreshold", label: "[시계] 6개", threshold: 6, revealIds: ["049"] },
      { id: "017-clock-7", kind: "clockThreshold", label: "[시계] 7개", threshold: 7, revealIds: ["050"] },
    ],
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
    // Real card: 8 winner-held-card branches, each firing once. Only the
    // 경비병 branch reveals anything inside this v1 slice (052→merged 053);
    // the others ([079]/[103][104]/[119]/[142]/[162][163]/[172]/[188]) are
    // outside it, so those branches just get checked off with no reveal.
    // Real card also expires: "[시계] 4개: 이 카드를 제거합니다."
    expiresAtClock: 4,
    conditionsTitle: "라운드 종료 시, 승자가 든 카드 확인 (각 1회)",
    conditions: [
      { id: "023-guard", kind: "winnerHeldCard", label: "《1 경비병》", cardName: "경비병", revealIds: ["053"] },
      { id: "023-clown", kind: "winnerHeldCard", label: "《2 광대》", cardName: "광대", revealIds: [] },
      { id: "023-knight", kind: "winnerHeldCard", label: "《3 기사》", cardName: "기사", revealIds: [] },
      { id: "023-priest", kind: "winnerHeldCard", label: "《4 승려》", cardName: "승려", revealIds: [] },
      { id: "023-wizard", kind: "winnerHeldCard", label: "《5 마술사》", cardName: "마술사", revealIds: [] },
      { id: "023-general", kind: "winnerHeldCard", label: "《6 장군》", cardName: "장군", revealIds: [] },
      { id: "023-minister", kind: "winnerHeldCard", label: "《7 대신》", cardName: "대신", revealIds: [] },
      { id: "023-royal", kind: "winnerHeldCard", label: "《8 공주/왕자》", cardName: "공주", revealIds: [] },
    ],
  },
  "024": {
    id: "024",
    name: "역사 2 점차 커지는 소동",
    category: "scenario",
    flavor: "편지를 둘러싼 다툼은 과열되어, 온갖 우연이 생각지도 못한 사람들마저 소동에 끌어들이고 만 것입니다.",
    // Real card's other 종료 branches ([편지] 7개/3개 이하 -> [028]~[030]/
    // [048] 공개) reveal cards entirely outside this v1 slice AND would be
    // trivially satisfied on round 1 (everyone starts at 0 letters), so
    // they're omitted rather than shown as instantly-checked noise.
    // Real card also expires: "[시계] 5개: 이 카드를 제거합니다."
    expiresAtClock: 5,
    conditionsTitle: "라운드 종료 시 확인",
    conditions: [
      {
        id: "024-count",
        kind: "archiveCardCount",
        label: "이야기 보관소에 「조건」을 가진 카드가 2장 이상",
        minCount: 2,
        revealIds: ["031"],
      },
    ],
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
      "운명의 여신은 편지를 보낸 이들 편인 듯합니다. 한번 러브레터에 연관된 자들은 알지 못할 인연으로 그 흐름에 휘말려 갑니다. 매 라운드에서 첫 번째로 탈락한 플레이어는 이야기 보관소의 [조건]을 가진 카드 1장 위에 [성공] 또는 [실패] 토큰 1개를 놓을 수 있습니다.",
    // Real card expires: "[시계] 6개: 이 카드를 제거합니다."
    expiresAtClock: 6,
    conditions: [],
  },
  "053": {
    id: "053",
    name: "고지식한 병사",
    category: "scenario",
    flavor:
      "당신은 성문 앞에서 자주 보는 성실한 병사에게 편지를 전해달라고 부탁합니다. 그는 무뚝뚝한 얼굴로 그 편지를 받습니다. 「하는 수 없군. 해보지. 너무 기대는 하지 마시오.」 고지식한 병사가 편지를 전하러 나선 결과가 궁금해집니다.",
    // Real 054's threshold branches carry the [조건] tag -- this is what
    // 024's "「조건」을 가진 카드" count and 031's token placement look for.
    conditionTag: true,
    conditionsTitle: "[조건] 라운드 종료 시 확인",
    conditions: [
      {
        id: "053-success",
        kind: "sharedToken",
        label: "[성공] 2개 이상 (우선 적용)",
        token: "성공",
        threshold: 2,
        revealIds: ["055", "056"],
        removeIds: ["053"],
      },
      {
        id: "053-fail",
        kind: "sharedToken",
        label: "[실패] 4개 이상",
        token: "실패",
        threshold: 4,
        revealIds: ["062"],
        removeIds: ["053"],
      },
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
  "051": {
    id: "051",
    name: "역사 9 운명의 순간",
    category: "scenario",
    flavor: "스토리북의 21쪽으로 갑니다.",
    conditions: [],
  },
};

export const ENDING_FLAVOR = {
  cardId: "051",
  name: "역사 9 운명의 순간",
  text: "스토리북의 21쪽으로 갑니다.",
};
