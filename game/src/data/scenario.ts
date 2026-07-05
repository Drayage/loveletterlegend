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
//   "라운드 종료시, 승자가 든 카드 확인" branch -- 《1 경비병》. The other 7
//   branches (광대/기사/승려/마술사/장군/대신/공주, revealing
//   [079]/[103]/[119]/[142]/[162]/[172]/[188]) are ALSO wired, all the way
//   down each real card's own further "선택"/조건 chain, EXCEPT 마술사
//   (142) and 공주/왕자 (188) which stay terminal flavor-only leaves (see
//   comment on ARCHIVE_CARD_SEEDS["023"] below for why). Every deck-effect
//   card those 6 live branches introduce (신병/광대의제자/점술사/복면기사/
//   상인/수사/수녀/여장군/군사/정무관남/정무관여/여후작) is a fully
//   playable CardName (engine/cards.ts) wired into effects.ts. Where a
//   branch's own further reveal target sits outside this v1 slice (e.g.
//   027, 082, 091/092, 110-112, 117/118, 126/127, 129, 134-136, 176/177,
//   180/181), the condition is still modeled (checklist ✓ + self-removal)
//   with an empty revealIds, exactly like 025's own [조건] below -- except
//   for a few one-shot "종료 X들고승리 -> reveal" leaves (080/089/174) whose
//   real text has no [조건] token-accumulation at all, which are left with
//   an empty conditions array instead (nothing to check off).
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

import type { CardName, DeckEffect } from "../engine/types";
import { ROUTE_DEFS } from "./routes";
import guard from "../assets/cards/guard.jpg";
import knight from "../assets/cards/knight.jpg";
import priestess from "../assets/cards/priestess.jpg";
// 정체(identity) 카드 6장 -- 실카드는 남/여 변형 각 2장씩 존재하지만
// (성별에 따른 효과 차이 없음), UI는 카드 1장당 초상화 1개만 보여주므로
// 각 쌍 중 하나만 대표로 쓴다.
import farmer from "../assets/cards/extra/정체. 농부.jpg";
import hunter from "../assets/cards/extra/정체. 사냥꾼.jpg";
import squire from "../assets/cards/extra/정체. 견습기사.jpg";
import student from "../assets/cards/extra/정체. 학생.jpg";
import traveler from "../assets/cards/extra/정체. 여행자.jpg";
import baron from "../assets/cards/extra/정체. 남작.jpg";
// 023의 나머지 분기 아래에서 새로 등장하는 캐릭터들의 초상화.
import recruit from "../assets/cards/extra/1. 신병.jpg";
import ladyGeneral from "../assets/cards/extra/6. 여장군.jpg";
import tactician from "../assets/cards/extra/6. 군사.jpg";
import marchioness from "../assets/cards/extra/7. 여후작.jpg";

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
  /** 실카드의 [등장] "《X》[ID]를 덱에 추가/제거" -- 이 카드가 처음
   * 공개되는 순간 (조건 충족을 통해서든 선택을 통해서든) 적용된다. See
   * engine/session.ts's applyDeckEffect. */
  deckEffect?: DeckEffect;
  /** 실카드의 "선택" 분기 -- 이 카드가 공개되면 그 라운드 승자가 옵션 중
   * 하나를 고르고, 그 옵션이 가리키는 카드들이 공개된다. 고른 뒤 이 카드
   * 자신은 보관소에서 제거된다 (실카드 "선택을 마친 후에 이 카드를
   * 제거합니다."). See engine/session.ts's resolveArchiveChoice. */
  choices?: Array<{ id: string; label: string; revealIds: string[] }>;
  /** 실카드가 조건도 선택도 없이 [등장]하자마자 곧바로 다른 카드들을
   * 공개하고 스스로 제거되는 경우 (e.g. 113 「혹독한 훈련」). */
  autoRevealIds?: string[];
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
    // Real card: 8 winner-held-card branches, each firing once. 마술사(142)
    // 와 공주/왕자(188) 두 분기는 자기 자신까지는 공개하되, 그 아래의 실제
    // 「선택」 하위 분기는 구현하지 않는다 -- 142는 이미 구현된
    // engine/upgrades.ts's 마술사의도제 시스템과 개념이 겹치고(별개의
    // CardName으로 다시 만들면 혼란), 188은 라운드마다 다시 고를 수 있는
    // 토글형 캐릭터 교체라 이 v1 엔진에 없는 새 메커니즘이 필요하기
    // 때문이다. 나머지 6개 분기는 끝까지 실제로 연결되어 있다.
    // Real card also expires: "[시계] 4개: 이 카드를 제거합니다."
    expiresAtClock: 4,
    conditionsTitle: "라운드 종료 시, 승자가 든 카드 확인 (각 1회)",
    conditions: [
      { id: "023-guard", kind: "winnerHeldCard", label: "《1 경비병》", cardName: "경비병", revealIds: ["052"] },
      { id: "023-clown", kind: "winnerHeldCard", label: "《2 광대》", cardName: "광대", revealIds: ["079"] },
      { id: "023-knight", kind: "winnerHeldCard", label: "《3 기사》", cardName: "기사", revealIds: ["103"] },
      { id: "023-priest", kind: "winnerHeldCard", label: "《4 승려》", cardName: "승려", revealIds: ["119"] },
      { id: "023-wizard", kind: "winnerHeldCard", label: "《5 마술사》", cardName: "마술사", revealIds: ["142"] },
      { id: "023-general", kind: "winnerHeldCard", label: "《6 장군》", cardName: "장군", revealIds: ["162"] },
      { id: "023-minister", kind: "winnerHeldCard", label: "《7 대신》", cardName: "대신", revealIds: ["172"] },
      { id: "023-royal", kind: "winnerHeldCard", label: "《8 공주/왕자》", cardName: "공주", revealIds: ["188"] },
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
    // 실카드: [등장] 《X 왕》[026]을 덱에 추가 -- deckEffect로 모델링
    // (026 카드 자체는 engine/cards.ts에 "왕" CardName으로 구현됨). [도중]
    // 《왕》 효과로 탈락 + [편지]8개 이상 시 이 카드에 [실패] --
    // addArchiveToken 호출은 session.ts의 kingElimination 이벤트 처리에서.
    // [조건] [실패] 1개 이상 -> [027] 공개인데 027은 이 v1 슬라이스 범위
    // 밖이라 revealIds를 비워 체크만 되고 아무것도 공개하지 않는다 (023의
    // 소소한 분기들과 동일 패턴). [조건] 태그가 있으므로 conditionTag:true.
    deckEffect: { kind: "add", cardName: "왕" },
    conditionTag: true,
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

  // ---- 023 「역사 1」의 《1 경비병》 분기 계속: 052 선택 -> 057 (053은 위에서 이미 정의됨) ----
  "052": {
    id: "052",
    name: "성문 앞에서",
    category: "scenario",
    flavor: "이런저런 사정으로 성에 들어갈 수 없는 당신이 편지를 맡겨야 한다면, 역시 성문 앞에 있는 병사들이겠지요.",
    conditions: [],
    choices: [
      { id: "052-familiar", label: "낯익은 남자 병사에게 건네줍니다", revealIds: ["053"] },
      { id: "052-stranger", label: "낯선 여자 병사에게 건네줍니다", revealIds: ["057"] },
    ],
  },
  "057": {
    id: "057",
    name: "풋풋한 신병",
    category: "scenario",
    flavor:
      "당신은 처음 보는 젋은 여자 병사에게 편지를 부탁합니다. 그녀는 건강한 미소로 부탁을 받아줍니다. 「알겠습니다! 해볼게요!」",
    conditionTag: true,
    deckEffect: { kind: "add", cardName: "신병" },
    conditionsTitle: "[조건] 라운드 종료 시 확인",
    conditions: [
      {
        id: "057-success",
        kind: "sharedToken",
        label: "[성공] 1개 이상 (우선 적용)",
        token: "성공",
        threshold: 1,
        revealIds: ["060", "061"],
        removeIds: ["057"],
      },
      {
        id: "057-fail",
        kind: "sharedToken",
        label: "[실패] 2개 이상",
        token: "실패",
        threshold: 2,
        revealIds: ["062"],
        removeIds: ["057"],
      },
    ],
    earnRules: [
      "「신병」을 손에 들고 라운드 승리: 성공",
      "「신병」으로 다른 플레이어를 탈락시킴: 성공",
      "「신병」을 손에 들고 탈락함: 실패",
      "「신병」으로 지목했으나 추측이 빗나감: 실패",
    ],
  },
  "060": {
    id: "060",
    name: "신병 아니스",
    category: "character",
    art: recruit,
    flavor: "「느낌이 좋은걸요, 저도 힘내 볼게요!」",
    conditions: [],
  },
  "061": {
    id: "061",
    name: "신병 아니스",
    category: "character",
    art: recruit,
    // 실카드의 [편지] 누적 문구 변경 보너스는 056과 동일하게 v1에서 자동
    // 연결하지 않고 flavor로만 보여준다.
    flavor:
      "《1 신병》을 손에 들고 라운드 승리: +[편지] 3개. 「신병」으로 다른 플레이어를 탈락시킬 경우, 탈락시킨 인원 1명당 +[편지] 2개.",
    conditions: [],
  },

  // ---- 023의 《2 광대》 분기: 079 선택 -> 080/089/093 ----
  "079": {
    id: "079",
    name: "광대의 초대",
    category: "scenario",
    flavor:
      "편지의 전갈을 부탁하는 중에 광대와 친해진 당신은 그와 함께 성 안의 행사를 구경하러 왔습니다. 광대의 말에 따르면 성 안으로 자주 초대되는 지인들이 있다고 합니다.",
    conditions: [],
    choices: [
      { id: "079-apprentice", label: "광대의 제자를 소개받습니다", revealIds: ["080"] },
      { id: "079-fortune", label: "점집 텐트에 가 봅니다", revealIds: ["089"] },
      { id: "079-stage", label: "가장 붐비는 무대로 갑니다", revealIds: ["093"] },
    ],
  },
  "080": {
    id: "080",
    name: "광대의 제자",
    category: "scenario",
    flavor:
      "공연 중인 광대처럼 제대로 분장한 인물이 당신에게 인사합니다. 아무래도 말을 멈춘 채 팬터마임 연습 중인 것 같습니다.",
    deckEffect: { kind: "replace", removeName: "광대", addName: "광대의제자" },
    // 실카드의 "종료" 조건("광대/광대의 제자가 버림더미에 있는 채로 승리"
    // -> [082] 공개)은 대상이 v1 슬라이스 밖이라 생략한다.
    conditions: [],
  },
  "089": {
    id: "089",
    name: "수수께끼의 점술사",
    category: "scenario",
    flavor:
      "점을 치는 텐트는 어둡고, 알 수 없는 향 냄새에 휩싸여 있습니다. 이국적인 의상을 입은 미녀가 수정구슬을 앞에 두고 신비로운 미소를 짓고 있습니다.「무슨 일이신가요?」",
    deckEffect: { kind: "replace", removeName: "광대", addName: "점술사" },
    // 실카드의 "종료" 조건(점술사 관련 승리 -> [091][092] 공개)은 대상이
    // v1 슬라이스 밖이라 생략한다.
    conditions: [],
  },
  "093": {
    id: "093",
    name: "무대에 빠져들다",
    category: "scenario",
    flavor:
      "커다란 환성에 이끌려, 행사의 한가운데 있는 무대를 방문합니다. 당신은 거기에서 공연 중인 연극의 주역에 눈길을 빼앗깁니다. 아, 정말 멋진 연기에 빼어난 외모입니다!",
    // 실카드는 자체 "선택" 분기(094/098)를 갖지만 둘 다 v1 슬라이스 밖이라
    // choices 없이 flavor만 표시하는 종결 카드로 둔다.
    conditions: [],
  },

  // ---- 023의 《3 기사》 분기: 103(+104) -> 105 선택 -> 106/107 또는 108 / -> 113 자동 -> 114 ----
  "103": {
    id: "103",
    name: "성실한 기사",
    category: "scenario",
    conditionTag: true,
    conditionsTitle: "[조건] 라운드 종료 시 확인",
    flavor: "당신은 전부터 친분이 있던 기사 한 사람에게 편지를 맡기기로 했습니다.",
    conditions: [
      {
        id: "103-success",
        kind: "sharedToken",
        label: "[성공] 2개 이상 (선택 적용)",
        token: "성공",
        threshold: 2,
        revealIds: ["105"],
      },
      {
        id: "103-fail",
        kind: "sharedToken",
        label: "[실패] 2개 이상 (선택 적용)",
        token: "실패",
        threshold: 2,
        revealIds: ["113"],
      },
    ],
    earnRules: [
      "「기사」를 손에 들고 라운드 승리: 성공",
      "「기사」로 다른 플레이어를 탈락시킴: 성공",
      "「기사」를 손에 들고 탈락함: 실패",
      "「기사」로 대결하여 스스로 탈락함: 실패",
    ],
  },
  "105": {
    id: "105",
    name: "자리를 비운 기사",
    category: "scenario",
    flavor:
      "당신은 오늘 기사에게 다시 편지를 맡기기로 약속했지만, 시간이 되었는데도 나타나지 않습니다. 장소를 잘못 찾은 걸까요....",
    conditions: [],
    choices: [
      { id: "105-wait", label: "얌전히 기사 라이언을 기다립니다", revealIds: ["106", "107"] },
      { id: "105-passerby", label: "지나가는 기사에게 말을 겁니다", revealIds: ["108"] },
    ],
  },
  "106": {
    id: "106",
    name: "기사 라이언",
    category: "character",
    art: knight,
    flavor: "「알겠다. 기사의 명예를 걸고 이 편지를 반드시 전달하도록 하지.」",
    conditions: [],
  },
  "107": {
    id: "107",
    name: "기사 라이언",
    category: "character",
    art: knight,
    flavor:
      "《3 기사》를 손에 들고 라운드 승리: +[편지] 2개. 「기사」로 다른 플레이어를 탈락시킴: 탈락시킨 인원 1명당 +[편지] 2개.",
    conditions: [],
  },
  "108": {
    id: "108",
    name: "전신 갑옷 기사",
    category: "scenario",
    conditionTag: true,
    conditionsTitle: "[조건] 라운드 종료 시 확인",
    flavor:
      "당신은 지나가던 중장갑옷의 기사에게 라이언에 대해 물어봅니다. 투구 때문인지 우물거리는 음석을 한 그 인물은 라이언에게 편지를 건네 달라는 부탁을 들어 주었습니다.",
    deckEffect: { kind: "replace", removeName: "기사", addName: "복면기사" },
    conditions: [
      {
        id: "108-success",
        kind: "sharedToken",
        label: "[성공] 1개 이상",
        token: "성공",
        threshold: 1,
        revealIds: [],
        removeIds: ["108"],
      },
    ],
    earnRules: ["「복면기사」를 손에 들고 라운드 승리: 성공", "「복면기사」로 다른 플레이어를 탈락시킴: 성공"],
  },
  "113": {
    id: "113",
    name: "혹독한 훈련",
    category: "scenario",
    flavor:
      "기사가 러브레터를 가져온 것이 왕의 귀에 들어가 버렸고, 틈을 낼 수 없을 정도로 혹독한 훈련을 받게 된 것 같습니다. 어쩔 수 없이 다른 사람을 찾아볼 수 밖에....",
    conditions: [],
    autoRevealIds: ["114"],
  },
  "114": {
    id: "114",
    name: "수완 좋은 여상인",
    category: "scenario",
    conditionTag: true,
    conditionsTitle: "[조건] 라운드 종료 시 확인",
    flavor:
      "「머고! 참말이가! 인자 내한테 맡기라.」 지방 사투리가 심한 여자 상인이 흔쾌히 편지의 반입을 맡아 주었습니다.",
    deckEffect: { kind: "replace", removeName: "기사", addName: "상인", count: 2 },
    conditions: [
      {
        id: "114-success",
        kind: "sharedToken",
        label: "[성공] 2개 이상",
        token: "성공",
        threshold: 2,
        revealIds: [],
        removeIds: ["114"],
      },
    ],
    earnRules: ["「상인」을 손에 들고 라운드 승리: 성공"],
  },

  // ---- 023의 《4 승려》 분기: 119 -> 120/121 또는 122 선택 -> 123(+124) 또는 130(+131) ----
  "119": {
    id: "119",
    name: "경건한 여승려",
    category: "scenario",
    conditionTag: true,
    conditionsTitle: "[조건] 라운드 종료 시 확인",
    flavor:
      "성에서 봉사하고 있는 여자 승려는 경건함을 갖춘 것은 물론이고, 친절하며 입이 무거운 것으로 알려져 있습니다. 그녀에게 편지를 부탁할 수 있다면, 반드시 잘될 겁니다.",
    conditions: [
      {
        id: "119-success",
        kind: "sharedToken",
        label: "[성공] 1개 이상 (우선 적용)",
        token: "성공",
        threshold: 1,
        revealIds: ["120", "121"],
        removeIds: ["119"],
      },
      {
        id: "119-fail",
        kind: "sharedToken",
        label: "[실패] 1개 이상",
        token: "실패",
        threshold: 1,
        revealIds: ["122"],
        removeIds: ["119"],
      },
    ],
    earnRules: ["「승려」를 손에 들거나 버린 채로 라운드 승리: 성공", "「승려」를 손에 들고 탈락함: 실패"],
  },
  "120": {
    id: "120",
    name: "승려 올리비아",
    category: "character",
    art: priestess,
    flavor: "「그대의 마음은 잘 알겠습니다. 이 편지는 제가 꼭 전해 드리도록 하겠습니다.」",
    conditions: [],
  },
  "121": {
    id: "121",
    name: "승려 올리비아",
    category: "character",
    art: priestess,
    flavor: "《4 승려》를 손에 들고 라운드 승리: +[편지] 2개. 「승려」를 버림더미에 남긴 채로 승리: +[편지] 1개.",
    conditions: [],
  },
  "122": {
    id: "122",
    name: "참으로 불미스러운 일",
    category: "scenario",
    flavor:
      "편지 주선에서 좋은 결과를 얻지 못한 승려는 자신의 부족함이 부끄러워 참회실에 틀어박혀 버렸다고 합니다. 어떻게든 그녀가 기운을 되찾기를 빌며, 당신은 주선을 부탁하기 위해 성 아래의 성당에 방문해 보았습니다.",
    conditions: [],
    choices: [
      { id: "122-friar", label: "성당 앞을 청소하고 있는 수사에게 말을 겁니다", revealIds: ["123"] },
      { id: "122-confession", label: "참회실에서 고해를 합니다", revealIds: ["130"] },
    ],
  },
  "123": {
    id: "123",
    name: "안색이 나쁜 수사",
    category: "scenario",
    conditionTag: true,
    conditionsTitle: "[조건] 라운드 종료 시 확인",
    flavor: "「하아.... 사정은 알겠으나 제가 할 수 있는 것은 기도하는 일 정도라고나 할까요…….」",
    deckEffect: { kind: "replace", removeName: "승려", addName: "수사" },
    conditions: [
      {
        id: "123-success",
        kind: "sharedToken",
        label: "[성공] 1개 이상 (우선 적용)",
        token: "성공",
        threshold: 1,
        revealIds: [],
        removeIds: ["123"],
      },
      {
        id: "123-fail",
        kind: "sharedToken",
        label: "[실패] 1개 이상",
        token: "실패",
        threshold: 1,
        revealIds: [],
        removeIds: ["123"],
      },
    ],
    earnRules: ["「수사」를 손에 들거나 버린 채로 라운드 승리: 성공", "「수사」를 손에 들고 탈락함: 실패"],
  },
  "130": {
    id: "130",
    name: "참회실에서",
    category: "scenario",
    conditionTag: true,
    conditionsTitle: "[조건] 라운드 종료 시 확인",
    flavor:
      "「아아? 뭐라고? 잘 안 들려요!」 고해를 해 보았지만 아무래도 잘 들어주기는 하는 건지 미심쩍습니다. 게다가, 은은하게 풍기는 술냄새라니... 설마 이 성직자, 여기에 숨어서 술 마시고 있던 것은 아니겠지.",
    deckEffect: { kind: "replace", removeName: "승려", addName: "수녀", count: 2 },
    conditions: [
      {
        id: "130-success",
        kind: "sharedToken",
        label: "[성공] 1개 이상 (우선 적용)",
        token: "성공",
        threshold: 1,
        revealIds: [],
        removeIds: ["130"],
      },
      {
        id: "130-fail",
        kind: "sharedToken",
        label: "[실패] 2개 이상",
        token: "실패",
        threshold: 2,
        revealIds: [],
        removeIds: ["130"],
      },
    ],
    // 실카드의 "수녀로 탈락시킴:+성공" 조항은 수사/수녀의 효과가 버린
    // 카드 무작위 재사용이라 원인 추적이 어려워 v1에서는 생략한다 (이
    // 카드의 목표 자체가 v1 슬라이스 밖이라 실질적으로 문제 없음).
    earnRules: ["「수녀」를 손에 들고 탈락함: 실패"],
  },

  // ---- 023의 《5 마술사》 분기: 142 (flavor-only 종결, 위 모듈 헤더 참고) ----
  "142": {
    id: "142",
    name: "몹시 바쁜 마술사",
    category: "scenario",
    flavor:
      "당신은 일찍이 도움을 받았던 마술사에게 다시 의지하려 성 밖의 탑을 방문합니다. 하지만 지금 그는 중요한 연구와 대대적인 의식으로 도무지 손을 뗄 수 없는 듯합니다. 어떻게 할까요...",
    conditions: [],
  },

  // ---- 023의 《6 장군》 분기: 162(+163) -> 164 -> 166/167 / -> 168 -> 170/171 ----
  "162": {
    id: "162",
    name: "고민하는 장군",
    category: "scenario",
    conditionTag: true,
    conditionsTitle: "[조건] 라운드 종료 시 확인",
    flavor: "「나에게는 무리다...」 아무래도 장군에게 러브레터를 전달한다는 임무는 부담이 큰 것 같습니다.",
    conditions: [
      {
        id: "162-success",
        kind: "sharedToken",
        label: "[성공] 1개 이상 (선택 적용)",
        token: "성공",
        threshold: 1,
        revealIds: ["164"],
      },
      {
        id: "162-fail",
        kind: "sharedToken",
        label: "[실패] 1개 이상 (선택 적용)",
        token: "실패",
        threshold: 1,
        revealIds: ["168"],
      },
    ],
    earnRules: ["「장군」을 버림더미에 남긴 채로 라운드 승리: 성공", "「장군」을 버림더미에 남긴 채로 탈락함: 실패"],
  },
  "164": {
    id: "164",
    name: "떠넘기기",
    category: "scenario",
    flavor:
      "「이, 이런 것을 건네받으면 나도 곤란해!」 아무래도 장군이 임무를 부하인 여장군에게 떠넘겨 버린 것 같은데, 이 여장군도 일을 제대로 해낼 것 같아 보이지는 않습니다.....",
    deckEffect: { kind: "replace", removeName: "장군", addName: "여장군" },
    conditionsTitle: "라운드 종료 시 확인",
    conditions: [
      {
        id: "164-win",
        kind: "sharedToken",
        label: "「여장군」을 손에 들고 라운드 승리",
        token: "성공",
        threshold: 1,
        revealIds: ["166", "167"],
        removeIds: ["164"],
      },
    ],
  },
  "166": {
    id: "166",
    name: "여장군 아즈사",
    category: "character",
    art: ladyGeneral,
    flavor: "「미안하군... 이런 것에 익숙치 않아서 말야... 도움이 되었다면 좋았을 텐데....」",
    conditions: [],
  },
  "167": {
    id: "167",
    name: "여장군 아즈사",
    category: "character",
    art: ladyGeneral,
    flavor: "《6 여장군》을 손에 들거나 버린 채로 라운드 승리: +[편지] 3개.",
    conditions: [],
  },
  "168": {
    id: "168",
    name: "표표한 군사",
    category: "scenario",
    flavor: "「이런이런, 오르테가 장군도 야무지지 못하네요. 보고 있을 수만은 없겠는데요.」",
    deckEffect: { kind: "replace", removeName: "장군", addName: "군사" },
    conditionsTitle: "라운드 종료 시 확인",
    conditions: [
      {
        id: "168-win",
        kind: "sharedToken",
        label: "「군사」를 손에 들거나 버린 채로 라운드 승리",
        token: "성공",
        threshold: 1,
        revealIds: ["170", "171"],
        removeIds: ["168"],
      },
    ],
  },
  "170": {
    id: "170",
    name: "군사 시어도어",
    category: "character",
    art: tactician,
    flavor: "「후후, 이 정도의 일로 모두가 정신을 못차리다니, 꽤나 별난 일이군요.」",
    conditions: [],
  },
  "171": {
    id: "171",
    name: "군사 시어도어",
    category: "character",
    art: tactician,
    flavor: "《6 군사》를 손에 들거나 버린 채로 라운드 승리: +[편지] 2개. 「군사」를 플레이함: +[편지] 1개.",
    conditions: [],
  },

  // ---- 023의 《7 대신》 분기: 172 -> 173 선택 -> 174 또는 178 / -> 182(+183) -> 185/186 또는 187 ----
  "172": {
    id: "172",
    name: "우려하는 대신",
    category: "scenario",
    conditionTag: true,
    conditionsTitle: "[조건] 라운드 종료 시 확인",
    flavor: "「러브레터 따위.... 개탄스럽구나!」",
    conditions: [
      {
        id: "172-success",
        kind: "sharedToken",
        label: "[성공] 1개 이상",
        token: "성공",
        threshold: 1,
        revealIds: ["173"],
        removeIds: ["172"],
      },
      {
        id: "172-fail",
        kind: "sharedToken",
        label: "[실패] 1개 이상 (우선 적용)",
        token: "실패",
        threshold: 1,
        revealIds: ["182"],
        removeIds: ["172"],
      },
    ],
    earnRules: ["「대신」을 손에 들거나 버린 채로 라운드 승리: 성공", "「대신」을 손에 들고 탈락함: 실패"],
  },
  "173": {
    id: "173",
    name: "대신의 심복들",
    category: "scenario",
    flavor:
      "「안돼! 역시 이몸은 러브레터에 반대다. 이제는 모른다!」 익히 알았듯이 대신은 편지의 전달에 납득이 가지 않았던 모양입니다. 자신을 보좌하는 아들과 딸 쌍둥이에게 떠넘기기로 결정하였습니다. 그 대상은....",
    conditions: [],
    choices: [
      { id: "173-son", label: "아들 오즈릭입니다", revealIds: ["174"] },
      { id: "173-daughter", label: "딸 오즈리나입니다", revealIds: ["178"] },
    ],
  },
  "174": {
    id: "174",
    name: "우수한 정무관",
    category: "scenario",
    flavor:
      "「아무래도 아버지가 폐를 끼친 것 같네. 이 왕국에 러브레터를 보내면 안된다는 법은 없으니...」 갑자기 사근사근한 언행의 남성이 비밀리에 당신을 찾아옵니다. 그는 그렇게 말하며 당신의 편지에 쓱쓱 서명했습니다. 아무래도 무언가 인정받은 것 같아 당신의 가슴이 기대로 두근거립니다.",
    deckEffect: { kind: "replace", removeName: "대신", addName: "정무관남" },
    // 실카드의 "종료" 조건(정무관남 관련 승리 -> [176][177] 공개)은 대상이
    // v1 슬라이스 밖이라 생략한다.
    conditions: [],
  },
  "178": {
    id: "178",
    name: "너그러운 정무관",
    category: "scenario",
    conditionTag: true,
    conditionsTitle: "[조건] 라운드 종료 시 확인",
    flavor:
      "「어머어머, 또 아버지가 뭘 시키셨구나. 정말 어쩔 수가 없다니까....」 느닷없이 묘령의 여성이 비밀리에 당신을 찾아옵니다. 그녀는 그렇게 말하며 당신의 편지에 사각사각 서명했습니다. 「네게도 곤란한 일이겠지. 좋아, 내가 도와줄게」",
    deckEffect: { kind: "replace", removeName: "대신", addName: "정무관여" },
    conditions: [
      {
        id: "178-fail",
        kind: "sharedToken",
        label: "[실패] 1개 이상",
        token: "실패",
        threshold: 1,
        revealIds: [],
        removeIds: ["178"],
      },
    ],
    earnRules: ["「정무관(여자)」를 손에 들거나 버린 채로 패배함: 실패"],
  },
  "182": {
    id: "182",
    name: "분주한 여후작",
    category: "scenario",
    conditionTag: true,
    conditionsTitle: "[조건] 라운드 종료 시 확인",
    flavor:
      "「그분께 부탁드려봤자 아무것도 되지 않을거다. 내가 맡지.」 바쁜 정무 사이에 틈을 내어 성 밖으로 나온 여후작은, 그렇게 말하며 당신의 편지를 품속에 넣고 곧장 성 안으로 돌아갑니다. 당신은 그 뒷모습에 감사를 전합니다.",
    deckEffect: { kind: "replace", removeName: "대신", addName: "여후작" },
    conditions: [
      {
        id: "182-success",
        kind: "sharedToken",
        label: "[성공] 1개 이상",
        token: "성공",
        threshold: 1,
        revealIds: ["185", "186"],
        removeIds: ["182"],
      },
      {
        id: "182-fail",
        kind: "sharedToken",
        label: "[실패] 2개 이상 (우선 적용)",
        token: "실패",
        threshold: 2,
        revealIds: ["187"],
        removeIds: ["182"],
      },
    ],
    earnRules: [
      "「여후작」을 손에 들거나 버린 채로 라운드 승리: 성공",
      "「여후작」을 손에 들거나 버린 채로 탈락함: 실패",
    ],
  },
  "185": {
    id: "185",
    name: "여후작 엘마",
    category: "character",
    art: marchioness,
    flavor: "「편지 건이라면 염려하지 말도록, 귀하의 성실함은 충분히 잘 알고 있으니.」",
    conditions: [],
  },
  "186": {
    id: "186",
    name: "여후작 엘마",
    category: "character",
    art: marchioness,
    flavor: "《7 여후작》을 손에 들거나 버린 채로 라운드 승리: +[편지] 3개.",
    conditions: [],
  },
  "187": {
    id: "187",
    name: "여후작의 실책",
    category: "scenario",
    flavor:
      "편지를 전해 주던 중 대신의 눈총을 받은 여후작은, 지금까지보다 더 많은 정무를 맡게 된 것 같습니다. 「힘이 되어주지 못해 미안하다」는 짧은 전언과 함께 여후작과의 연락은 끊어지고 말았습니다.",
    deckEffect: { kind: "revert", removedName: "여후작", restoreName: "대신" },
    conditions: [],
  },

  // ---- 023의 《8 공주/왕자》 분기: 188 (flavor-only 종결, 위 모듈 헤더 참고) ----
  "188": {
    id: "188",
    name: "공주님들",
    category: "scenario",
    flavor:
      "공주님이라고 한마디로 말하지만, 이 왕국에는 여러 명의 공주가 있습니다. 물론 자주 입에 오르내리는 것은 맏이인 잉그리드 공주입니다. 하지만 다른 공주들도 저마다 인기가 있습니다. 당신이 좋아하는 사람은 사실....",
    conditions: [],
  },
};

export const ENDING_FLAVOR = {
  cardId: "051",
  name: "역사 9 운명의 순간",
  text: "스토리북의 21쪽으로 갑니다.",
};
