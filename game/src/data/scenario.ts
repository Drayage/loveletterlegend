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
// - 025 「국왕 랜들 3세」의 [등장] "《X 왕》[026]을 덱에 추가" -> engine/cards.ts's
//   "왕" CardName (deck-injected once 025 is revealed, see
//   engine/session.ts's applyRevealSideEffects). Its own [조건] ([실패]
//   1개 이상 -> [027] 공개) is modeled but 027 is outside this v1 slice, so
//   revealIds stays empty (checked off, nothing revealed) -- same pattern
//   as 023's 7 minor branches below.
// - 032 「역사 4」의 [등장]이 033~038 (6장 "게임:정체" 카드 풀)을 공개하고,
//   탈락했지만 정체가 없는 플레이어가 라운드 종료마다 하나씩 골라 영구히
//   갖는다 (engine/session.ts's identityPool/playerIdentities/
//   pendingIdentityChoice, chooseIdentity). 전원이 정체를 보유하면 039
//   공개 + 032 제거 (post-selection 상태가 필요해 bespoke 체크, 050->051과
//   동일 패턴). 6장 모두 실카드 능력 텍스트는 살아있지만, v1에서 실제
//   기계적으로 연결하는 건 이 중 자기 차례 조작이나 리액티브 취소 없이
//   단순 수치 보정/획득 시점 훅만으로 충분한 2장뿐 -- 035(+2 패시브,
//   engine/effects.ts의 순위 비교 지점) 및 038(획득 시 편지 2개 배치, 기존
//   pendingLetterChoice 재사용). 033(손패↔비공개 교환)/034(효과 무효화)/
//   036(플레이 효과 교체)/037(추가 차례)은 각각 새로운 자기 차례 액션이나
//   리액티브 프롬프트가 필요해 flavor 텍스트만 보여주고 미연결로 둔다
//   (056/060/061 등 기존 [지속] 보너스 처리와 동일한 선례).
// - 039 「역사 5」의 "축제 덱"(040~047)은 별도로 구현 (engine/session.ts's
//   festivalDeck/activeFestivalCardId, rules.ts's endRound 승자 결정 로직).
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
// 정체(identity) 카드 6장 -- 실카드는 남/여 변형 각 2장씩 존재하지만
// (성별에 따른 효과 차이 없음), UI는 카드 1장당 초상화 1개만 보여주므로
// 각 쌍 중 하나만 대표로 쓴다.
import farmer from "../assets/cards/extra/정체. 농부.jpg";
import hunter from "../assets/cards/extra/정체. 사냥꾼.jpg";
import squire from "../assets/cards/extra/정체. 견습기사.jpg";
import student from "../assets/cards/extra/정체. 학생.jpg";
import traveler from "../assets/cards/extra/정체. 여행자.jpg";
import baron from "../assets/cards/extra/정체. 남작.jpg";

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
    // 실카드: [등장] 《X 왕》[026]을 덱에 추가 (see engine/session.ts's
    // reveal side-effect handler -- 026 카드 자체는 engine/cards.ts에 "왕"
    // CardName으로 구현됨). [도중] 《왕》 효과로 탈락 + [편지]8개 이상 시
    // 이 카드에 [실패] -- addArchiveToken 호출은 session.ts의
    // kingElimination 이벤트 처리에서. [조건] [실패] 1개 이상 -> [027]
    // 공개인데 027은 이 v1 슬라이스 범위 밖이라 revealIds를 비워 체크만
    // 되고 아무것도 공개하지 않는다 (023의 소소한 7개 분기와 동일 패턴).
    conditionsTitle: "라운드 종료 시 확인",
    conditions: [
      {
        id: "025-fail",
        kind: "sharedToken",
        label: "[실패] 1개 이상",
        token: "실패",
        threshold: 1,
        revealIds: [],
        removeIds: ["025"],
      },
    ],
  },
  "032": {
    id: "032",
    name: "역사 4 러브레터를 보내는 이들",
    category: "scenario",
    flavor:
      "수많은 역사책을 읽어내려 가자, 러브 레터를 보내는 사람들의 신상이 어렴풋이나마 드러납니다. 출신도 나이도 성별도 다양한 그들, 그녀들은 도대체 어떤 사람들이었을까요.",
    conditions: [],
  },
  "033": {
    id: "033",
    name: "농부 / 양치기",
    category: "character",
    art: farmer,
    flavor: "각 라운드 중에 한 번, 자기 차례를 시작할 때 손에 든 카드와 비공개 카드를 서로 바꿀 수 있습니다.",
    conditions: [],
  },
  "034": {
    id: "034",
    name: "사냥꾼 / 약초꾼",
    category: "character",
    art: hunter,
    flavor: "각 라운드 중에 한 번, 다른 플레이어가 자신에게 사용한 효과를 취소할 수 있습니다.",
    conditions: [],
  },
  "035": {
    id: "035",
    name: "견습기사 / 호위",
    category: "character",
    art: squire,
    flavor: "카드의 숫자를 비교할 때와 라운드 종료시에 손에 든 카드의 숫자에 2를 더합니다.",
    conditions: [],
  },
  "036": {
    id: "036",
    name: "학생 / 여학생",
    category: "character",
    art: student,
    flavor:
      "각 라운드 중에 한 번, 플레이한 카드의 「플레이:」효과를 버림 더미에 있는 카드의 「플레이:」효과로 대신할 수 있습니다.",
    conditions: [],
  },
  "037": {
    id: "037",
    name: "여행자 / 순례자",
    category: "character",
    art: traveler,
    flavor: "전체 게임 중에 단 한 번, 차례 종료시에 한 번 더 차례를 가질 수 있습니다.",
    conditions: [],
  },
  "038": {
    id: "038",
    name: "남작 / 여자작",
    category: "character",
    art: baron,
    flavor: "이 카드를 획득할 때, 자신의 [편지] 2개를 원하는 캐릭터에 배치하거나 이동시킬 수 있습니다.",
    conditions: [],
  },
  "039": {
    id: "039",
    name: "역사 5 축제의 나날들",
    category: "scenario",
    flavor: "여름이 끝나면, 수확제를 비롯한 여러 행사가 왕국을 떠들썩하게 합니다. 평소와는 다른 분위기 속에서 사람들의 기분은 몹시 고조되어 갑니다.",
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
