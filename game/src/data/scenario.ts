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
//   "라운드 종료시, 승자가 든 카드 확인" branch -- 《1 경비병》. All 8
//   branches (광대/기사/승려/마술사/장군/대신/공주 too, revealing
//   [079]/[103]/[119]/[142]/[162]/[172]/[188]) are wired all the way down
//   each real card's own further "선택"/조건 chain, with ONE exception: 188
//   「공주님들」의 3개 분기 중 2개(루나공주/마가렛공주, ids 189-194)는
//   실카드가 "매 라운드 시작시 되돌릴
//   수 있는 선택적 토글"로 대응 rank8 카드를 덱에 넣었다 뺐다 하는데, 이건
//   v1 엔진에 없는 새 "라운드 시작 시점 결정" 메커니즘이 필요해 캐릭터
//   리프까지만 공개하고 실제 덱 주입은 하지 않는다 (see comment on
//   ARCHIVE_CARD_SEEDS["188"] below). 195's own 백작부인 분기(196-199)는
//   196/199가 활성화된 동안 매 라운드 「백작부인」을 덱에 넣는 방식으로
//   구현한다. 142(마술사)와 188의 3번째 분기
//   (195 -> 200 「귀족 영애」)도 평범한 1회성 [등장] 태그라 끝까지
//   구현했다. Every deck-effect card the live branches introduce (신병/
//   광대의제자/점술사/복면기사/상인/수사/수녀/여장군/군사/정무관남/
//   정무관여/여후작/마술사의도제/백작부인/귀족영애) is a fully playable CardName
//   (engine/cards.ts) wired into effects.ts. Where a branch's own further
//   reveal target sits outside this v1 slice (e.g. 027, 082, 091/092,
//   110-112, 117/118, 126/127, 129, 134-136, 149/150, 155-161, 176/177,
//   180/181, 198/199), the condition is still modeled (checklist ✓ +
//   self-removal) with an empty revealIds, exactly like 025's own [조건]
//   below -- except for a few one-shot "종료 X들고승리 -> reveal" leaves
//   (080/089/174/196) whose real text has no [조건] token-accumulation at
//   all, which are left with an empty conditions array instead (nothing to
//   check off).
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
import clown from "../assets/cards/clown.jpg";
import knight from "../assets/cards/knight.jpg";
import priestess from "../assets/cards/priestess.jpg";
import wizard from "../assets/cards/wizard.jpg";
import general from "../assets/cards/general.jpg";
import minister from "../assets/cards/minister.jpg";
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
import villageGirl from "../assets/cards/extra/0. 마을소녀.jpg";
import servant from "../assets/cards/extra/1. 시종.jpg";
import maid from "../assets/cards/extra/1. 시녀.jpg";
import clownApprentice from "../assets/cards/extra/2. 광대의 제자(남).jpg";
import clownApprenticeFemale from "../assets/cards/extra/2. 광대의 제자(여).jpg";
import fortuneTeller from "../assets/cards/extra/2. 점술사.jpg";
import maskedKnight from "../assets/cards/extra/3. 복면기사.jpg";
import actor from "../assets/cards/extra/9. 배우.jpg";
import dancer from "../assets/cards/extra/0. 무희.jpg";
import ladyKnight from "../assets/cards/extra/3. 여기사.jpg";
import merchant from "../assets/cards/extra/3. 상인.jpg";
import friar from "../assets/cards/extra/4. 수사.jpg";
import nun from "../assets/cards/extra/4. 수녀.jpg";
import butler from "../assets/cards/extra/4. 집사.jpg";
import witch from "../assets/cards/extra/5. 마녀.jpg";
import archmage15 from "../assets/cards/extra/5. 대마도사(15세).jpg";
import archmage20 from "../assets/cards/extra/5. 대마도사(20세).jpg";
import ladyGeneral from "../assets/cards/extra/6. 여장군.jpg";
import tactician from "../assets/cards/extra/6. 군사.jpg";
import regentMale from "../assets/cards/extra/7. 정무관(남자).jpg";
import regentFemale from "../assets/cards/extra/7. 정무관(여자).jpg";
import marchioness from "../assets/cards/extra/7. 여후작.jpg";
import wizardApprentice from "../assets/cards/extra/5. 마술사의 도제.jpg";
import princessSecond from "../assets/cards/extra/8. 공주(둘째).jpg";
import princessThird from "../assets/cards/extra/8. 공주(셋째).jpg";
import countess from "../assets/cards/extra/8. 백작부인.jpg";
import nobleLady from "../assets/cards/extra/8. 귀족영애.jpg";
import king from "../assets/cards/extra/X. 왕.jpg";
import queen from "../assets/cards/extra/왕비.jpg";

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
  | { id: string; kind: "winnerHeldCard"; label: string; cardName: CardName; revealIds: string[]; removeIds?: string[] }
  | { id: string; kind: "archiveCardCount"; label: string; minCount: number; revealIds: string[]; removeIds?: string[] }
  | { id: string; kind: "clockThreshold"; label: string; threshold: number; revealIds: string[]; removeIds?: string[] };

export interface ArchiveCardSeed {
  id: string;
  name: string;
  /** Matches the real card's data/cards.json "category" -- drives the
   * 캐릭터/정체/시나리오 split in the story archive UI (see types.ts's
   * ArchiveCardState.category). Cards with art show a portrait alongside
   * their text, including character-like scenario cards such as 025/027. */
  category: "character" | "scenario" | "identity";
  /** Portrait shown next to character/identity cards. */
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
    // Real card: 8 winner-held-card branches, each firing once, all wired
    // all the way down to their real terminal leaves (see module header
    // above for the one recurring exception: 188's reversible per-round
    // deck-toggle sub-branches).
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
      { id: "023-princess", kind: "winnerHeldCard", label: "《공주》", cardName: "공주", revealIds: ["188"] },
      { id: "023-prince", kind: "winnerHeldCard", label: "《왕자》", cardName: "왕자", revealIds: ["188"] },
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
    art: king,
    flavor: "「무엄하도다!」",
    // 실카드: [등장] 《X 왕》[026]을 덱에 추가 -- deckEffect로 모델링
    // (026 카드 자체는 engine/cards.ts에 "왕" CardName으로 구현됨). [도중]
    // 《왕》 효과로 탈락 + [편지]8개 이상 시 이 카드에 [실패] --
    // addArchiveToken 호출은 session.ts의 kingElimination 이벤트 처리에서.
    // [조건] [실패] 1개 이상 -> [027] 공개. [조건] 태그가 있으므로
    // conditionTag:true.
    deckEffect: { kind: "add", cardName: "왕" },
    conditionTag: true,
    conditionsTitle: "라운드 종료 시 확인",
    earnRules: ["「왕」 효과로 탈락한 플레이어가 편지 8개 이상 보유: 실패"],
    conditions: [
      {
        id: "025-fail",
        kind: "sharedToken",
        label: "[실패] 1개 이상",
        token: "실패",
        threshold: 1,
        revealIds: ["027"],
        removeIds: ["025"],
      },
    ],
  },
  "027": {
    id: "027",
    name: "왕비 릴리안",
    category: "scenario",
    art: queen,
    flavor: "「여보, 그만두시지요」",
    deckEffect: { kind: "revert", removedName: "왕", restoreName: "왕" },
    conditionsTitle: "라운드 종료 시",
    conditions: [],
  },
  "028": {
    id: "028",
    name: "간판 점원 미란다",
    category: "character",
    art: villageGirl,
    flavor: "「어서 오세요. 오늘도 그분께 드릴 편지를 맡기러 오셨나요?」",
    conditions: [],
  },
  "029": {
    id: "029",
    name: "간판 점원 미란다",
    category: "character",
    art: villageGirl,
    flavor:
      "러브레터가 전해져 들떠 있는 자도 있고, 소식이 없어 슬퍼하는 자도 있습니다. 술로 달래고 싶은 사람은 성 아래 술집 점원에게 말을 걸곤 합니다.",
    deckEffect: { kind: "add", cardName: "마을소녀" },
    conditionsTitle: "라운드 종료 시 확인",
    earnRules: [
      "「마을소녀」를 손에 들고 라운드 승리: +편지 1",
      "「마을소녀」가 버림 더미에 놓인 채 라운드 종료: 편지 1 감소",
      "[편지] 3개 이상: 「마을소녀」의 종료 숫자가 9로 변경",
    ],
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
  "033": {
    id: "033",
    name: "농부 / 양치기",
    category: "identity",
    art: farmer,
    flavor: "각 라운드 중에 한 번, 자기 차례를 시작할 때 손에 든 카드와 비공개 카드를 서로 바꿀 수 있습니다.",
    conditions: [],
  },
  "034": {
    id: "034",
    name: "사냥꾼 / 약초꾼",
    category: "identity",
    art: hunter,
    flavor: "각 라운드 중에 한 번, 다른 플레이어가 자신에게 사용한 효과를 취소할 수 있습니다.",
    conditions: [],
  },
  "035": {
    id: "035",
    name: "견습기사 / 호위",
    category: "identity",
    art: squire,
    flavor: "카드의 숫자를 비교할 때와 라운드 종료시에 손에 든 카드의 숫자에 2를 더합니다.",
    conditions: [],
  },
  "036": {
    id: "036",
    name: "학생 / 여학생",
    category: "identity",
    art: student,
    flavor:
      "각 라운드 중에 한 번, 플레이한 카드의 「플레이:」효과를 버림 더미에 있는 카드의 「플레이:」효과로 대신할 수 있습니다.",
    conditions: [],
  },
  "037": {
    id: "037",
    name: "여행자 / 순례자",
    category: "identity",
    art: traveler,
    flavor: "전체 게임 중에 단 한 번, 차례 종료시에 한 번 더 차례를 가질 수 있습니다.",
    conditions: [],
  },
  "038": {
    id: "038",
    name: "남작 / 여자작",
    category: "identity",
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
  "048": {
    id: "048",
    name: "역사 6 천재일우의 기회",
    category: "scenario",
    flavor:
      "열렬한 러브레터가 공주들과 왕국 사람들 사이에서 화제가 된 것 같습니다. 지금이라면, 이제까지 전할 수 없던 상대에게도 마음을 전할 수 있을지 모릅니다.",
    conditions: [],
    choices: [
      { id: "048-luna", label: "차분한 둘째 공주 루나", revealIds: ["189", "190"] },
      { id: "048-margaret", label: "활기찬 셋째 공주 마가렛", revealIds: ["192", "193"] },
      { id: "048-countess", label: "마차를 타고 외출하는 요염한 귀부인", revealIds: ["196"] },
      { id: "048-noble", label: "쇼핑할 생각에 들뜬 수행원을 거느린 소녀", revealIds: ["200"] },
    ],
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
    art: guard,
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
    art: king,
    flavor:
      "병사들이 편지의 전갈을 맡고 있는 것이 왕에게 알려지고 말았습니다. 그들은 왕에게 꾸중을 듣고, 주선을 해 주지 않게 되어 버렸습니다. 다른 수단을 생각하지 않으면....",
    conditions: [],
    choices: [
      { id: "062-servant", label: "의욕 없어 보이는 시종에게 부탁합니다", revealIds: ["063"] },
      { id: "062-maid", label: "퉁명스러운 시녀에게 부탁합니다", revealIds: ["071"] },
    ],
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
    art: guard,
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
    art: recruit,
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
  "063": {
    id: "063",
    name: "의욕 없는 시종",
    category: "scenario",
    art: servant,
    flavor: "「아, 상관없는데요. 그렇게 근무 태도가 좋아 보이지는 않는데 괜찮을까요....」",
    deckEffect: {
      kind: "batch",
      remove: [
        { cardName: "경비병", count: 5 },
        { cardName: "신병" },
      ],
      add: [{ cardName: "시종", count: 5 }],
    },
    conditionsTitle: "라운드 종료 시 확인",
    earnRules: ["「시종」이 버림 더미에 있는 채로 라운드 승리: 성공"],
    conditions: [
      {
        id: "063-win",
        kind: "sharedToken",
        label: "「시종」이 버림 더미에 있는 채로 라운드 승리",
        token: "성공",
        threshold: 1,
        revealIds: ["069", "070"],
        removeIds: ["063"],
      },
    ],
  },
  "069": {
    id: "069",
    name: "시종 트래비스",
    category: "character",
    art: servant,
    flavor: "「네, 네. 전하겠습니다. 이번에는 정말입니다.」",
    conditions: [],
  },
  "070": {
    id: "070",
    name: "시종 트래비스",
    category: "character",
    art: servant,
    flavor: "《1 시종》이 버림 더미에 놓인 채로 라운드 승리: +[편지] 2개.",
    conditions: [],
  },
  "071": {
    id: "071",
    name: "퉁명스러운 시녀",
    category: "scenario",
    art: maid,
    flavor: "「하, 하지 않으면 안 되니까. 이런 사람에게 편지를 맡겨도 괜찮은 걸까?」",
    deckEffect: {
      kind: "batch",
      remove: [
        { cardName: "경비병", count: 5 },
        { cardName: "신병" },
      ],
      add: [{ cardName: "시녀", count: 5 }],
    },
    conditionsTitle: "라운드 종료 시 확인",
    earnRules: ["「시녀」가 버림 더미에 있는 채로 라운드 승리: 성공"],
    conditions: [
      {
        id: "071-win",
        kind: "sharedToken",
        label: "「시녀」가 버림 더미에 있는 채로 라운드 승리",
        token: "성공",
        threshold: 1,
        revealIds: ["077", "078"],
        removeIds: ["071"],
      },
    ],
  },
  "077": {
    id: "077",
    name: "시녀 메이블",
    category: "character",
    art: maid,
    flavor: "「제대로 전할 테니까, 너무 빤히 보지 마세요.」",
    conditions: [],
  },
  "078": {
    id: "078",
    name: "시녀 메이블",
    category: "character",
    art: maid,
    flavor: "《1 시녀》가 버림 더미에 놓인 채로 라운드 승리: +[편지] 2개.",
    conditions: [],
  },

  // ---- 023의 《2 광대》 분기: 079 선택 -> 080/089/093 ----
  "079": {
    id: "079",
    name: "광대의 초대",
    category: "scenario",
    art: clown,
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
    art: clownApprentice,
    flavor:
      "공연 중인 광대처럼 제대로 분장한 인물이 당신에게 인사합니다. 아무래도 말을 멈춘 채 팬터마임 연습 중인 것 같습니다.",
    deckEffect: { kind: "replace", removeName: "광대", addName: "광대의제자" },
    conditionsTitle: "라운드 종료 시 확인",
    conditions: [
      {
        id: "080-win",
        kind: "sharedToken",
        label: "「광대/광대의 제자」가 버림 더미에 있는 채로 라운드 승리",
        token: "성공",
        threshold: 1,
        revealIds: ["082"],
        removeIds: ["080"],
      },
    ],
  },
  "089": {
    id: "089",
    name: "수수께끼의 점술사",
    category: "scenario",
    art: fortuneTeller,
    flavor:
      "점을 치는 텐트는 어둡고, 알 수 없는 향 냄새에 휩싸여 있습니다. 이국적인 의상을 입은 미녀가 수정구슬을 앞에 두고 신비로운 미소를 짓고 있습니다.「무슨 일이신가요?」",
    deckEffect: { kind: "replace", removeName: "광대", addName: "점술사" },
    conditionsTitle: "라운드 종료 시 확인",
    conditions: [
      {
        id: "089-win",
        kind: "sharedToken",
        label: "「점술사」를 손에 들거나 버린 채로 라운드 승리",
        token: "성공",
        threshold: 1,
        revealIds: ["091", "092"],
        removeIds: ["089"],
      },
    ],
  },
  "093": {
    id: "093",
    name: "무대에 빠져들다",
    category: "scenario",
    art: actor,
    flavor:
      "커다란 환성에 이끌려, 행사의 한가운데 있는 무대를 방문합니다. 당신은 거기에서 공연 중인 연극의 주역에 눈길을 빼앗깁니다. 아, 정말 멋진 연기에 빼어난 외모입니다!",
    conditions: [],
    choices: [
      { id: "093-actor", label: "잘생긴 간판배우에게 마음을 빼앗깁니다", revealIds: ["094"] },
      { id: "093-dancer", label: "매혹적인 무희에게 눈길이 갑니다", revealIds: ["098"] },
    ],
  },
  "082": {
    id: "082",
    name: "분장 속 맨얼굴",
    category: "scenario",
    art: clownApprentice,
    flavor:
      "어느 날, 낯선 사람이 당신에게 말을 걸어옵니다. 얼굴을 유심히 들여다보니, 얼마 전 만났던 광대의 제자가 아니겠습니까. 몰라봤던 그 모습은....",
    conditions: [],
    choices: [
      { id: "082-boy", label: "정말 개구쟁이 같은 소년입니다", revealIds: ["083", "084"] },
      { id: "082-girl", label: "상상할 수 없었던 소녀입니다", revealIds: ["086", "087"] },
    ],
  },
  "083": {
    id: "083",
    name: "광대의 제자 리카드",
    category: "character",
    art: clownApprentice,
    flavor: "「쉿, 지금은 연습 중이야. 그래도 네 부탁이라면 도와줄게.」",
    conditions: [],
  },
  "084": {
    id: "084",
    name: "광대의 제자 리카드",
    category: "character",
    art: clownApprentice,
    deckEffect: { kind: "batch", remove: [{ cardName: "광대의제자" }], add: [{ cardName: "광대의제자" }] },
    flavor: "《2 광대의 제자(남)》를 손에 들거나 버린 채로 라운드 승리: +[편지] 2개.",
    conditions: [],
  },
  "086": {
    id: "086",
    name: "광대의 제자 피오",
    category: "character",
    art: clownApprenticeFemale,
    flavor: "「이번에는 들켰네요. 그래도 무대 뒤의 길은 제가 잘 알아요.」",
    conditions: [],
  },
  "087": {
    id: "087",
    name: "광대의 제자 피오",
    category: "character",
    art: clownApprenticeFemale,
    deckEffect: { kind: "batch", remove: [{ cardName: "광대의제자" }], add: [{ cardName: "광대의제자여" }] },
    flavor: "《2 광대의 제자(여)》를 손에 들거나 버린 채로 라운드 승리: +[편지] 2개.",
    conditions: [],
  },
  "091": {
    id: "091",
    name: "점술사 그리셀다",
    category: "character",
    art: fortuneTeller,
    flavor: "「카드가 말하고 있군요. 당신의 마음은 아직 끝나지 않았다고.」",
    conditions: [],
  },
  "092": {
    id: "092",
    name: "점술사 그리셀다",
    category: "character",
    art: fortuneTeller,
    flavor: "《2 점술사》를 손에 들거나 버린 채로 라운드 승리: +[편지] 2개.",
    conditions: [],
  },
  "094": {
    id: "094",
    name: "잘생긴 간판배우",
    category: "scenario",
    art: actor,
    deckEffect: { kind: "add", cardName: "배우" },
    flavor: "「이 무대의 주역을 알아보는 눈이 있군요.」",
    conditionsTitle: "[조건] 라운드 종료 시 확인",
    earnRules: ["「배우」를 손에 들고 라운드 승리: 성공", "「배우」를 손에 들고 탈락: 실패"],
    conditions: [
      {
        id: "094-success",
        kind: "sharedToken",
        label: "[성공] 1개 이상 (우선 적용)",
        token: "성공",
        threshold: 1,
        revealIds: ["096", "097"],
        removeIds: ["094"],
      },
      {
        id: "094-fail",
        kind: "sharedToken",
        label: "[실패] 1개 이상",
        token: "실패",
        threshold: 1,
        revealIds: ["102"],
        removeIds: ["094"],
      },
    ],
  },
  "096": {
    id: "096",
    name: "배우 파비오",
    category: "character",
    art: actor,
    flavor: "「당신이 객석에 있다면, 오늘의 연기는 더 뜨거워지겠군요.」",
    conditions: [],
  },
  "097": {
    id: "097",
    name: "배우 파비오",
    category: "character",
    art: actor,
    flavor: "《9 배우》를 손에 들고 라운드 승리: +[편지] 2개. [편지] 3개 이상이면 「배우」의 종료 숫자가 2가 됩니다.",
    conditions: [],
  },
  "098": {
    id: "098",
    name: "매혹적인 무희",
    category: "scenario",
    art: dancer,
    deckEffect: { kind: "add", cardName: "무희" },
    flavor: "「후후. 원하는 만큼 보셔도 좋아요.」",
    conditionsTitle: "[조건] 라운드 종료 시 확인",
    earnRules: ["「무희」를 손에 들고 라운드 승리: 성공", "「무희」를 손에 들고 탈락: 실패"],
    conditions: [
      {
        id: "098-success",
        kind: "sharedToken",
        label: "[성공] 1개 이상 (우선 적용)",
        token: "성공",
        threshold: 1,
        revealIds: ["100", "101"],
        removeIds: ["098"],
      },
      {
        id: "098-fail",
        kind: "sharedToken",
        label: "[실패] 2개 이상",
        token: "실패",
        threshold: 2,
        revealIds: ["102"],
        removeIds: ["098"],
      },
    ],
  },
  "100": {
    id: "100",
    name: "무희 미나",
    category: "character",
    art: dancer,
    flavor: "「무대 위에서도, 편지 속에서도, 마음은 숨길 수 없답니다.」",
    conditions: [],
  },
  "101": {
    id: "101",
    name: "무희 미나",
    category: "character",
    art: dancer,
    flavor: "《0 무희》를 손에 들고 라운드 승리: +[편지] 2개. [편지] 3개 이상이면 「무희」의 종료 숫자가 7이 됩니다.",
    conditions: [],
  },
  "102": {
    id: "102",
    name: "극단의 출발",
    category: "scenario",
    art: actor,
    flavor: "인기를 얻은 배우와 무희는 갑작스러운 행사 의뢰로 성을 떠나 버렸습니다.",
    deckEffect: {
      kind: "batch",
      remove: [{ cardName: "배우" }, { cardName: "무희" }],
      add: [{ cardName: "광대의제자" }],
    },
    conditions: [],
  },

  // ---- 023의 《3 기사》 분기: 103(+104) -> 105 선택 -> 106/107 또는 108 / -> 113 자동 -> 114 ----
  "103": {
    id: "103",
    name: "성실한 기사",
    category: "scenario",
    art: knight,
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
    art: knight,
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
    art: maskedKnight,
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
        revealIds: ["110", "111"],
        removeIds: ["108"],
      },
    ],
    earnRules: ["「복면기사」를 손에 들고 라운드 승리: 성공", "「복면기사」로 다른 플레이어를 탈락시킴: 성공"],
  },
  "110": {
    id: "110",
    name: "여기사 캐리",
    category: "character",
    art: ladyKnight,
    flavor: "「보세요, 이 몸의 실력을! 반드시 전해 보이겠습니다.」",
    conditions: [],
  },
  "111": {
    id: "111",
    name: "여기사 캐리",
    category: "character",
    art: ladyKnight,
    deckEffect: { kind: "replace", removeName: "복면기사", addName: "여기사" },
    flavor:
      "《3 여기사》를 손에 들고 라운드 승리: +[편지] 2개. 「여기사」로 다른 플레이어를 탈락시킴: +[편지] 2개.",
    conditions: [],
  },
  "113": {
    id: "113",
    name: "혹독한 훈련",
    category: "scenario",
    art: knight,
    flavor:
      "기사가 러브레터를 가져온 것이 왕의 귀에 들어가 버렸고, 틈을 낼 수 없을 정도로 혹독한 훈련을 받게 된 것 같습니다. 어쩔 수 없이 다른 사람을 찾아볼 수 밖에....",
    conditions: [],
    autoRevealIds: ["114"],
  },
  "114": {
    id: "114",
    name: "수완 좋은 여상인",
    category: "scenario",
    art: merchant,
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
        revealIds: ["117", "118"],
        removeIds: ["114"],
      },
    ],
    earnRules: ["「상인」을 손에 들고 라운드 승리: 성공"],
  },
  "117": {
    id: "117",
    name: "여상인 수잔나",
    category: "character",
    art: merchant,
    flavor: "「인자 내한테 맡기라. 장사는 신용이 생명이다!」",
    conditions: [],
  },
  "118": {
    id: "118",
    name: "여상인 수잔나",
    category: "character",
    art: merchant,
    flavor:
      "《3 상인》을 손에 들고 라운드 승리: +[편지] 2개. 「상인」으로 다른 플레이어를 탈락시킴: +[편지] 1개. [편지] 3개 이상이면 탈락 기준이 5 이하로 바뀝니다.",
    conditions: [],
  },

  // ---- 023의 《4 승려》 분기: 119 -> 120/121 또는 122 선택 -> 123(+124) 또는 130(+131) ----
  "119": {
    id: "119",
    name: "경건한 여승려",
    category: "scenario",
    art: priestess,
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
    art: priestess,
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
    art: friar,
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
        revealIds: ["126", "127"],
        removeIds: ["123"],
      },
      {
        id: "123-fail",
        kind: "sharedToken",
        label: "[실패] 1개 이상",
        token: "실패",
        threshold: 1,
        revealIds: ["129"],
        removeIds: ["123"],
      },
    ],
    earnRules: ["「수사」를 손에 들거나 버린 채로 라운드 승리: 성공", "「수사」를 손에 들고 탈락함: 실패"],
  },
  "126": {
    id: "126",
    name: "수사 알베르트",
    category: "character",
    art: friar,
    flavor: "「제가 할 수 있는 것은 기도뿐입니다. 그래도 해보겠습니다.」",
    conditions: [],
  },
  "127": {
    id: "127",
    name: "수사 알베르트",
    category: "character",
    art: friar,
    deckEffect: { kind: "replace", removeName: "승려", addName: "수사" },
    flavor:
      "《4 수사》를 손에 들거나 버림 더미에 놓은 채로 라운드 승리: +[편지] 2개. [편지] 2개 이상이면 승려 1장을 수사 1장으로 교체합니다.",
    conditions: [],
  },
  "129": {
    id: "129",
    name: "역부족",
    category: "scenario",
    art: friar,
    flavor:
      "「아아, 나는 정말.... 성 안에 의지할 수 있는 분이 계시니 그분을 소개해 드리겠습니다.」",
    conditions: [],
    autoRevealIds: ["137"],
  },
  "130": {
    id: "130",
    name: "참회실에서",
    category: "scenario",
    art: nun,
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
        revealIds: ["134", "135"],
        removeIds: ["130"],
      },
      {
        id: "130-fail",
        kind: "sharedToken",
        label: "[실패] 2개 이상",
        token: "실패",
        threshold: 2,
        revealIds: ["136"],
        removeIds: ["130"],
      },
    ],
    // 실카드의 "수녀로 탈락시킴:+성공" 조항은 수사/수녀의 효과가 버린
    // 카드 무작위 재사용이라 원인 추적이 어려워 v1에서는 생략한다 (이
    // 카드의 목표 자체가 v1 슬라이스 밖이라 실질적으로 문제 없음).
    earnRules: ["「수녀」를 손에 들고 탈락함: 실패"],
  },
  "134": {
    id: "134",
    name: "수녀 로베리아",
    category: "character",
    art: nun,
    flavor: "「역시 기도만으로는 부족하겠지요. 제가 직접 움직이겠습니다.」",
    conditions: [],
  },
  "135": {
    id: "135",
    name: "수녀 로베리아",
    category: "character",
    art: nun,
    flavor:
      "《4 수녀》를 손에 들거나 버림 더미에 놓은 채로 라운드 승리: +[편지] 2개. [편지] 3개 이상이면 사용 후 다음 차례까지 보호됩니다.",
    conditions: [],
  },
  "136": {
    id: "136",
    name: "수녀의 참회",
    category: "scenario",
    art: nun,
    flavor: "「역시 나로선 잘 안 되네!」 수녀는 깊이 참회하고, 다시 승려에게 길을 터 줍니다.",
    deckEffect: {
      kind: "batch",
      remove: [{ cardName: "수녀", count: 2 }],
      add: [{ cardName: "승려", count: 2 }],
    },
    conditions: [],
  },
  "137": {
    id: "137",
    name: "온화한 노신사",
    category: "scenario",
    art: butler,
    flavor:
      "성 안에서 여러 가지 일을 맡아보는 노신사는 온화한 미소를 지으며 부탁을 흔쾌히 들어 줍니다.",
    deckEffect: {
      kind: "batch",
      remove: [{ cardName: "승려", count: 2 }],
      add: [{ cardName: "집사", count: 2 }],
    },
    conditions: [],
    autoRevealIds: ["140", "141"],
  },
  "140": {
    id: "140",
    name: "집사 세바스티안",
    category: "character",
    art: butler,
    flavor: "「당신의 마음이 닿기를, 늙은이도 바라고 있습니다.」",
    conditions: [],
  },
  "141": {
    id: "141",
    name: "집사 세바스티안",
    category: "character",
    art: butler,
    flavor: "《4 집사》를 손에 들거나 버림 더미에 놓은 채로 라운드 승리: +[편지] 2개.",
    conditions: [],
  },

  // ---- 023의 《5 마술사》 분기: 142 -> 143(+144) -> 146/147 또는 148 / -> 153 -> 154 ----
  "142": {
    id: "142",
    name: "몹시 바쁜 마술사",
    category: "scenario",
    art: wizard,
    flavor:
      "당신은 일찍이 도움을 받았던 마술사에게 다시 의지하려 성 밖의 탑을 방문합니다. 하지만 지금 그는 중요한 연구와 대대적인 의식으로 도무지 손을 뗄 수 없는 듯합니다. 어떻게 할까요...",
    conditions: [],
    choices: [
      { id: "142-apprentice", label: "구석에 있는, 할일 없어 보이는 마술사의 제자에게 물어봅니다", revealIds: ["143"] },
      { id: "142-child", label: "어라, 이런 곳에 아이가?", revealIds: ["153"] },
    ],
  },
  "143": {
    id: "143",
    name: "어둠을 걸친 자",
    category: "scenario",
    art: wizardApprentice,
    conditionTag: true,
    conditionsTitle: "[조건] 라운드 종료 시 확인",
    flavor:
      "「하아.... 싫어요... 귀찮게... 왜 내가 그런...」밑져야 본전이라는 심정으로 그 제자에게 부탁해 봤지만, 의지가 되지 않습니다. 모자를 푹 눌러쓰고 고개를 숙인 탓에 남자인지 여자인지도 분명하지 않았지만, 목소리는 여성의 것입니다. 포기하려고 돌아가려고 했지만, 좀 찔린 모양인지 편지를 맡기는 했습니다.",
    deckEffect: { kind: "replace", removeName: "마술사", addName: "마술사의도제" },
    conditions: [
      {
        id: "143-success",
        kind: "sharedToken",
        label: "[성공] 1개 이상 (우선 적용)",
        token: "성공",
        threshold: 1,
        revealIds: ["146", "147"],
        removeIds: ["143"],
      },
      {
        id: "143-fail",
        kind: "sharedToken",
        label: "[실패] 1개 이상",
        token: "실패",
        threshold: 1,
        revealIds: ["148"],
        removeIds: ["143"],
      },
    ],
    earnRules: ["「마술사의 도제」로 5 이상 숫자 카드를 버리게 함: 성공", "「마술사의 도제」를 손에 들고 탈락함: 실패"],
  },
  "146": {
    id: "146",
    name: "마술사의 도제 지나",
    category: "character",
    art: wizardApprentice,
    flavor: "「.....」",
    conditions: [],
  },
  "147": {
    id: "147",
    name: "마술사의 도제 지나",
    category: "character",
    art: wizardApprentice,
    flavor:
      "《5 마술사의 도제》를 손에 들거나 버림더미에 놓은 채로 라운드 승리: +[편지] 2개. 「마술사의 도제」로 5 이상 숫자 카드를 버리게 함: +[편지] 1개.",
    conditions: [],
  },
  "148": {
    id: "148",
    name: "감감무소식",
    category: "scenario",
    art: wizardApprentice,
    flavor:
      "편지를 맡겨 보긴 했지만 그 제자조차 만날 수 없게 되고 말았습니다. 곤란해진 당신은 마술사와 관계가 있는 것 같은 성 아래 마법약 공방을 찾아가 보기로 합니다.",
    conditions: [],
    autoRevealIds: ["149"],
  },
  "149": {
    id: "149",
    name: "요염한 마녀",
    category: "scenario",
    art: witch,
    flavor: "「어서 오세요. 무슨 문제가 있으신가요?」 속을 짐작할 수 없는 미녀가 당신을 맞이합니다.",
    deckEffect: { kind: "batch", remove: [{ cardName: "마술사의도제" }], add: [{ cardName: "마녀" }] },
    conditionsTitle: "라운드 종료 시 확인",
    earnRules: ["「마녀」를 버림 더미에 놓은 채로 라운드 승리: 성공"],
    conditions: [
      {
        id: "149-win",
        kind: "sharedToken",
        label: "「마녀」를 버림 더미에 놓은 채로 라운드 승리",
        token: "성공",
        threshold: 1,
        revealIds: ["151", "152"],
        removeIds: ["149"],
      },
    ],
  },
  "151": {
    id: "151",
    name: "마녀 베아트릭스",
    category: "character",
    art: witch,
    flavor: "「좋아요, 내 마법의 힘을 빌려드리죠.」",
    conditions: [],
  },
  "152": {
    id: "152",
    name: "마녀 베아트릭스",
    category: "character",
    art: witch,
    flavor:
      "《5 마녀》를 손에 들거나 버림 더미에 놓은 채로 라운드 승리: +[편지] 2개. 「마녀」를 플레이함: +[편지] 1개. [편지] 3개 이상이면 원하는 대로 다시 나눕니다.",
    conditions: [],
  },
  "153": {
    id: "153",
    name: "수수께끼의 아이",
    category: "scenario",
    art: archmage15,
    flavor:
      "이상한 아이에게 말을 걸어보니 상상도 못했던 어조의 대답이 돌아왔습니다.「흠, 흥미로운 이야기다. 하지만 이 모습으로는 그다지 도움이 될 수 없다.」 도대체, 이 아이는 누구일까요.",
    conditionsTitle: "라운드 종료 시 확인",
    conditions: [
      {
        id: "153-win",
        kind: "sharedToken",
        label: "「마술사」를 손에 들거나 버린 채로 라운드 승리",
        token: "성공",
        threshold: 1,
        revealIds: ["154"],
        removeIds: ["153"],
      },
    ],
  },
  "154": {
    id: "154",
    name: "수수께끼의 소년",
    category: "scenario",
    art: archmage15,
    flavor: "「이런 건 어때?」",
    conditions: [],
    choices: [
      { id: "154-15", label: "어린 대마도사에게 부탁합니다", revealIds: ["157", "158"] },
      { id: "154-20", label: "성장한 대마도사에게 부탁합니다", revealIds: ["160", "161"] },
    ],
  },
  "157": {
    id: "157",
    name: "대마도사 알비스(15세)",
    category: "character",
    art: archmage15,
    flavor: "「하하하! 쥐라니, 멋지구나!」",
    conditions: [],
  },
  "158": {
    id: "158",
    name: "대마도사 알비스(15세)",
    category: "character",
    art: archmage15,
    deckEffect: { kind: "replace", removeName: "마술사", addName: "대마도사15" },
    flavor:
      "《5 대마도사(15세)》를 손에 들거나 버림 더미에 놓은 채로 라운드 승리: +[편지] 2개. 「대마도사(15세)」를 플레이함: +[편지] 1개.",
    conditions: [],
  },
  "160": {
    id: "160",
    name: "대마도사 알비스(20세)",
    category: "character",
    art: archmage20,
    flavor: "「그하하하! 지금 이 몸이 못할 일은 없다!」",
    conditions: [],
  },
  "161": {
    id: "161",
    name: "대마도사 알비스(20세)",
    category: "character",
    art: archmage20,
    deckEffect: { kind: "replace", removeName: "마술사", addName: "대마도사20" },
    flavor:
      "《5 대마도사(20세)》를 손에 들거나 버림 더미에 놓은 채로 라운드 승리: +[편지] 2개. 「대마도사(20세)」를 플레이함: +[편지] 1개. [편지] 3개 이상이면 문구가 「당신은 탈락합니다」로 변경됩니다.",
    conditions: [],
  },

  // ---- 023의 《6 장군》 분기: 162(+163) -> 164 -> 166/167 / -> 168 -> 170/171 ----
  "162": {
    id: "162",
    name: "고민하는 장군",
    category: "scenario",
    art: general,
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
    art: ladyGeneral,
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
    art: tactician,
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
    art: minister,
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
    art: minister,
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
    art: regentMale,
    flavor:
      "「아무래도 아버지가 폐를 끼친 것 같네. 이 왕국에 러브레터를 보내면 안된다는 법은 없으니...」 갑자기 사근사근한 언행의 남성이 비밀리에 당신을 찾아옵니다. 그는 그렇게 말하며 당신의 편지에 쓱쓱 서명했습니다. 아무래도 무언가 인정받은 것 같아 당신의 가슴이 기대로 두근거립니다.",
    deckEffect: { kind: "replace", removeName: "대신", addName: "정무관남" },
    conditionsTitle: "라운드 종료 시 확인",
    earnRules: ["「정무관(남자)」를 손에 들거나 버린 채로 라운드 승리: 성공"],
    conditions: [
      {
        id: "174-win",
        kind: "sharedToken",
        label: "「정무관(남자)」를 손에 들거나 버린 채로 라운드 승리",
        token: "성공",
        threshold: 1,
        revealIds: ["176", "177"],
        removeIds: ["174"],
      },
    ],
  },
  "176": {
    id: "176",
    name: "정무관 오즈릭",
    category: "character",
    art: ROUTE_DEFS.왕자.art,
    flavor: "「무모한 도전이지만, 그 마음은 고귀하군요.」",
    conditions: [],
  },
  "177": {
    id: "177",
    name: "정무관 오즈릭",
    category: "character",
    art: ROUTE_DEFS.왕자.art,
    flavor:
      "《7 정무관(남자)》를 손에 들거나 버림 더미에 놓은 채로 라운드 승리: +[편지] 2개. [편지] 3개 이상이면 탈락하지 않기와 상대 탈락 중 하나를 고릅니다.",
    conditions: [],
  },
  "178": {
    id: "178",
    name: "너그러운 정무관",
    category: "scenario",
    art: regentFemale,
    conditionTag: true,
    conditionsTitle: "[조건] 라운드 종료 시 확인",
    flavor:
      "「어머어머, 또 아버지가 뭘 시키셨구나. 정말 어쩔 수가 없다니까....」 느닷없이 묘령의 여성이 비밀리에 당신을 찾아옵니다. 그녀는 그렇게 말하며 당신의 편지에 사각사각 서명했습니다. 「네게도 곤란한 일이겠지. 좋아, 내가 도와줄게」",
    deckEffect: { kind: "replace", removeName: "대신", addName: "정무관여" },
    conditions: [
      {
        id: "178-success",
        kind: "sharedToken",
        label: "「정무관(여자)」를 들거나 버린 채로 승리하지 않고 라운드 종료",
        token: "성공",
        threshold: 1,
        revealIds: ["180", "181"],
        removeIds: ["178"],
      },
      {
        id: "178-fail",
        kind: "sharedToken",
        label: "[실패] 1개 이상",
        token: "실패",
        threshold: 1,
        revealIds: ["180", "181"],
        removeIds: ["178"],
      },
    ],
    earnRules: ["「정무관(여자)」를 손에 들거나 버린 채로 패배함: 실패"],
  },
  "180": {
    id: "180",
    name: "정무관 오즈리나",
    category: "character",
    art: ROUTE_DEFS.공주.art,
    flavor: "「조금 더 제게 의지해도 좋답니다.」",
    conditions: [],
  },
  "181": {
    id: "181",
    name: "정무관 오즈리나",
    category: "character",
    art: ROUTE_DEFS.공주.art,
    flavor:
      "《7 정무관(여자)》를 손에 들거나 버림 더미에 놓은 채로 탈락: +[편지] 1개. 승리하지 않고 라운드 종료: +[편지] 2개. [편지] 3개 이상이면 다른 플레이어가 당신을 효과 대상으로 골라야 합니다.",
    conditions: [],
  },
  "182": {
    id: "182",
    name: "분주한 여후작",
    category: "scenario",
    art: marchioness,
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
    art: marchioness,
    flavor:
      "편지를 전해 주던 중 대신의 눈총을 받은 여후작은, 지금까지보다 더 많은 정무를 맡게 된 것 같습니다. 「힘이 되어주지 못해 미안하다」는 짧은 전언과 함께 여후작과의 연락은 끊어지고 말았습니다.",
    deckEffect: { kind: "revert", removedName: "여후작", restoreName: "대신" },
    conditions: [],
  },

  // ---- 023의 《8 공주/왕자》 분기: 188 -> (189/190 루나공주) 또는
  // (192/193 마가렛공주) 또는 (195 -> 196 백작부인 또는 200 -> 202/203
  // 귀족영애) ----
  // 루나공주/마가렛공주/백작부인(189/190, 192/193, 196) 세 캐릭터는 실카드가
  // "매 라운드 시작시, 대응하는 rank8 카드를 덱에 넣었다 뺐다 할 수
  // 있습니다"라는 되돌릴 수 있는 매 라운드 선택적 토글로 서로 다른 rank8
  // 정체성 카드를 교체하는데, 이는 v1 엔진에 없는 새 "라운드 시작 시점
  // 선택" 메커니즘이 필요해 각 캐릭터는 flavor 리프로만 공개하고 실제
  // 덱 주입/추가 rank8 CardName은 만들지 않는다 (토글이 없어도 190/193의
  // "편지 10개 -> 즉시 종료, [051] 공개" 조항은 018/020 「잉그리드공주/
  // 아레스왕자」에 이미 있는 RANK8_SLOTS 얼리엔딩 체크로 동일하게 적용되어
  // 별도 처리가 필요 없다). 3번째 분기(195 -> 200 -> 202/203 「귀족 영애」)는
  // 실카드가 평범한 1회성 [등장] 태그를 쓰므로 끝까지 구현한다.
  "188": {
    id: "188",
    name: "공주님들",
    category: "scenario",
    art: ROUTE_DEFS.공주.art,
    flavor:
      "공주님이라고 한마디로 말하지만, 이 왕국에는 여러 명의 공주가 있습니다. 물론 자주 입에 오르내리는 것은 맏이인 잉그리드 공주입니다. 하지만 다른 공주들도 저마다 인기가 있습니다. 당신이 좋아하는 사람은 사실....",
    conditions: [],
    choices: [
      { id: "188-luna", label: "차분한 둘째 공주 루나입니다", revealIds: ["189", "190"] },
      { id: "188-margaret", label: "활기찬 셋째 공주 마가렛입니다", revealIds: ["192", "193"] },
      { id: "188-other", label: "사실은 공주님이 아니라 다른 귀족에게 마음을 주고 있습니다", revealIds: ["195"] },
    ],
  },
  "189": {
    id: "189",
    name: "루나 공주",
    category: "character",
    art: princessSecond,
    flavor: "「저도 책 속에 나오는 것 같은 사랑을 해보고 싶어요.」",
    conditions: [],
  },
  "190": {
    id: "190",
    name: "루나 공주",
    category: "character",
    art: princessSecond,
    deckEffect: { kind: "optionalRound", cardName: "공주둘째" },
    flavor:
      "당신은 지적인 분위기를 풍기는 루나 공주를 마음에 두고 있습니다. 매 라운드 시작시 「공주(둘째)」를 이번 라운드 덱에 넣을 수 있습니다.",
    conditions: [],
  },
  "192": {
    id: "192",
    name: "마가렛 공주",
    category: "character",
    art: princessThird,
    flavor: "「역시 백마 탄 왕자님이지! 빨리 데리러 와주었으면!」",
    conditions: [],
  },
  "193": {
    id: "193",
    name: "마가렛 공주",
    category: "character",
    art: princessThird,
    deckEffect: { kind: "optionalRound", cardName: "공주셋째" },
    flavor:
      "말괄량이로 유명한 마가렛 공주는 가끔 성 아래를 방문해서는 사람들과 다양한 교류를 하고 있습니다. 매 라운드 시작시 「공주(셋째)」를 이번 라운드 덱에 넣을 수 있습니다.",
    conditions: [],
  },
  "195": {
    id: "195",
    name: "높은 산 위에 핀 꽃",
    category: "scenario",
    art: countess,
    flavor: "당신의 마음을 사로잡은 사람은 공주님과 마찬가지로 성 안에 들어가지 않으면 좀처럼 볼 수 없는 사람 중 하나입니다. 그 사람은....",
    conditions: [],
    choices: [
      { id: "195-countess", label: "마차를 타고 외출하는 요염한 귀부인입니다", revealIds: ["196"] },
      { id: "195-noble", label: "쇼핑할 생각에 들뜬, 수행원을 거느린 소녀입니다", revealIds: ["200"] },
    ],
  },
  "196": {
    id: "196",
    name: "나른한 백작부인",
    category: "scenario",
    art: countess,
    flavor:
      "「어머, 귀여운 아이네...」마차의 창으로 나온 백작부인이 투명할 만큼 흰 손가락이 당신의 얼굴을 쓰다듬습니다. 그 오싹한 감각은 마치 사신에게 닿은 것처럼 느껴졌지만, 당신은 그녀에게 매료되어 움직일 수 없었습니다. 정말로, 이 사랑을 좇아도 되는 것일까요...",
    conditionsTitle: "라운드 시작/종료 시 확인",
    earnRules: [
      "매 라운드 시작시 「백작부인」을 이번 라운드 덱에 추가할 수 있음",
      "「백작부인」을 손에 들고 라운드 승리: 성공",
    ],
    deckEffect: { kind: "optionalRound", cardName: "백작부인" },
    conditions: [
      {
        id: "196-win",
        kind: "winnerHeldCard",
        label: "「백작부인」을 손에 들고 라운드 승리",
        cardName: "백작부인",
        revealIds: ["198", "199"],
        removeIds: ["196"],
      },
    ],
  },
  "198": {
    id: "198",
    name: "백작부인 카밀라",
    category: "character",
    art: countess,
    flavor: "「이제는 아무래도 좋아요. 모든 게 다 괜찮아요.」",
    conditions: [],
  },
  "199": {
    id: "199",
    name: "백작부인 카밀라",
    category: "character",
    art: countess,
    flavor:
      "당신을 저택에 초대한 그녀의 언사는 공허하며, 말끝마다 기력을 잃어가는 것을 볼 수 있습니다. 아마도 남편이었던 백작을 잃은 슬픔으로 자포자기하고 있는 듯 합니다. 사랑을 말하기 전에, 당신은 우선 그녀가 삶의 의욕을 되찾을 수 있게 해주어야 합니다.",
    earnRules: ["「백작부인」을 손에 들고 라운드 승리: 성공"],
    conditions: [],
  },
  "200": {
    id: "200",
    name: "거만한 귀족 영애",
    category: "scenario",
    art: nobleLady,
    flavor:
      "「오호홋! 이 몸의 매력을 알아채다니! 안목이 있네요! 그래요! 공주보다 내가 더 말이죠!」요란한 웃음소리를 내며 당신에게 손가락질하는 영애, 이 상황을 보면 당신이 그녀에게 단단히 빠진 것은 분명합니다. 그녀의 종이 되는 것은 어렵지 않을 겁니다. 허나 과연 그녀의 진정한 사랑을 손에 넣을 수 있겠습니까?",
    deckEffect: { kind: "optionalRound", cardName: "귀족영애" },
    conditionsTitle: "라운드 종료 시 확인",
    conditions: [
      {
        id: "200-win",
        kind: "sharedToken",
        label: "「귀족영애」를 손에 들고 라운드 승리",
        token: "성공",
        threshold: 1,
        revealIds: ["202", "203"],
        removeIds: ["200"],
      },
    ],
  },
  "202": {
    id: "202",
    name: "공작의 영애 아나스타샤",
    category: "character",
    art: nobleLady,
    flavor: "「당신의 헌신은 정말 대단하네요! 알겠죠, 앞으로도 저를 잘 모셔야 해요!」",
    conditions: [],
  },
  "203": {
    id: "203",
    name: "공작의 영애 아나스타샤",
    category: "character",
    art: nobleLady,
    flavor: "《8 귀족 영애》를 손에 들고 라운드 승리: +[편지] 4개.",
    conditions: [],
  },
};

export const ENDING_FLAVOR = {
  cardId: "051",
  name: "역사 9 운명의 순간",
  text: "스토리북의 21쪽으로 갑니다.",
};
