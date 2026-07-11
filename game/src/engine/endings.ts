// 세션 종료 후 "누가 누구와 맺어졌는가"(SessionState.playerEndings, 이미
// session.ts의 resolveEnding이 룰북대로 계산)를 실제 엔딩 텍스트로
// 변환하는 순수 로직. UI(App.tsx/EndingScene 등)가 이 모듈을 통해 데이터를
// 가져다 쓰고, localStorage 기록(persistence/records.ts) 조회는 호출부가
// 파라미터로 넘긴다 -- 이 파일 자체는 브라우저 API에 의존하지 않는다.
import { RANK8_SLOTS } from "./session";
import type { CharacterSlotId } from "./types";
import { CHARACTER_ENDINGS, NO_MATCH_ENDINGS, SAME_SEX_ENDINGS } from "../data/endings";

/** IDENTITY_VARIANTS(identityVariants.ts)의 "male" 변형 이름들 -- 이
 * 정체들은 data/endings.ts 추출 결과 전부 "여성향" 캐릭터 상대의 엔딩만
 * 갖고 있다. 나머지("female" 변형: 양치기/약초꾼/호위/여학생/순례자/
 * 여자작)는 "남성향" 캐릭터 상대의 엔딩만 갖는다. */
const MALE_PRESENTING_IDENTITIES = new Set(["농부", "사냥꾼", "견습기사", "학생", "여행자", "남작"]);

/** identityVariants.ts's IDENTITY_VARIANTS 두 갈래를 순서대로 편 이름
 * 목록 -- 기록보관실(RecordsScreen)이 정체별 섹션을 만들 때 쓴다. */
export const ALL_IDENTITY_NAMES: readonly string[] = [
  "농부",
  "양치기",
  "사냥꾼",
  "약초꾼",
  "견습기사",
  "호위",
  "학생",
  "여학생",
  "여행자",
  "순례자",
  "남작",
  "여자작",
];

/** 이 정체가 만날 수 있는 캐릭터 슬롯 전체 목록(=CHARACTER_ENDINGS에
 * 텍스트가 있는 슬롯들) -- 기록보관실이 정체별 "수집 대상" 칸을 전부
 * 나열할 때 쓴다. */
export function targetSlotsForIdentity(identityName: string): CharacterSlotId[] {
  return Object.keys(CHARACTER_ENDINGS[identityName] ?? {}) as CharacterSlotId[];
}

/** data/endings.ts 추출 시 확정된 "남성향" 캐릭터 슬롯(=여성 정체가 만나는
 * 목록) 12개 -- 나머지 20개 슬롯은 전부 "여성향"이다. */
const MALE_ORIENTED_SLOTS = new Set<CharacterSlotId>([
  "아레스왕자",
  "경비병알리오스",
  "시종트래비스",
  "광대제자리카드",
  "배우파비오",
  "기사라이언",
  "수사알베르트",
  "집사세바스티안",
  "대마도사15알비스",
  "대마도사20알비스",
  "군사시어도어",
  "정무관오즈릭",
]);

export type EndingKind = "noMatch" | "sameSex" | "character";

export interface ResolvedEnding {
  kind: EndingKind;
  text: string;
  /** kind가 "character"이고 slot이 8번 캐릭터(RANK8_SLOTS)에 속할 때만
   * true -- 성공/실패 카드를 뽑아 진엔딩에 도전할 수 있는 경우. */
  trueEndingEligible: boolean;
  slot: CharacterSlotId | null;
}

function slotIsMaleOriented(slot: CharacterSlotId): boolean {
  return MALE_ORIENTED_SLOTS.has(slot);
}

function identityIsMalePresenting(identityName: string): boolean {
  return MALE_PRESENTING_IDENTITIES.has(identityName);
}

/** 정체 표시 이름(예: "농부", identityVariants.ts/playerIdentityFaces의
 * `.name`과 동일)과 맺어진 슬롯(없으면 null)으로 어떤 엔딩을 보여줄지
 * 정한다. 슬롯이 정체의 "기본 상대방 성별 그룹"과 다른 그룹(원작에 해당
 * 조합 전용 텍스트가 없는 경우)이면 공용 "동성" 엔딩으로 대체한다. */
export function resolveEndingForPlayer(identityName: string, slot: CharacterSlotId | null): ResolvedEnding {
  if (!slot) {
    return { kind: "noMatch", text: NO_MATCH_ENDINGS[identityName] ?? "", trueEndingEligible: false, slot: null };
  }
  const mismatchedGroup = identityIsMalePresenting(identityName) === slotIsMaleOriented(slot);
  if (mismatchedGroup) {
    return { kind: "sameSex", text: SAME_SEX_ENDINGS[identityName] ?? "", trueEndingEligible: false, slot };
  }
  return {
    kind: "character",
    text: CHARACTER_ENDINGS[identityName]?.[slot] ?? "",
    trueEndingEligible: (RANK8_SLOTS as readonly CharacterSlotId[]).includes(slot),
    slot,
  };
}

export const TRUE_ENDING_DECK_SIZE = 5;

/** 성공/실패 카드 5장 중 성공 카드 개수. 원작 룰의 "얼마나 빨리 편지를
 * 전달했는가"는 물리 게임의 실제 진행 시간을 재는 방식이라 디지털 구현에
 * 그대로 옮길 측정치가 없다 -- 세션이 끝난 시점의 라운드 번호를 "속도"의
 * 근사치로 쓴다(낮을수록 빠름). 임계값은 v1 근사이며 플레이 데이터를 보고
 * 조정하면 된다. */
export function trueEndingSuccessCardCount(
  roundNumberAtEnd: number,
  hasSeenTrueEndingBefore: boolean,
  hasSeenNormalEndingOnlyBefore: boolean
): number {
  let count = roundNumberAtEnd <= 3 ? 4 : roundNumberAtEnd <= 5 ? 3 : roundNumberAtEnd <= 7 ? 2 : 1;
  if (hasSeenTrueEndingBefore) {
    count = 1;
  } else if (hasSeenNormalEndingOnlyBefore) {
    count += 2;
  }
  return Math.max(1, Math.min(TRUE_ENDING_DECK_SIZE - 1, count));
}

export type TrueEndingCard = "성공" | "실패";

/** 성공/실패 카드를 섞어 뒷면으로 나열할 순서를 만든다. */
export function shuffleTrueEndingDeck(successCount: number): TrueEndingCard[] {
  const clamped = Math.max(0, Math.min(TRUE_ENDING_DECK_SIZE, successCount));
  const cards: TrueEndingCard[] = [
    ...Array<TrueEndingCard>(clamped).fill("성공"),
    ...Array<TrueEndingCard>(TRUE_ENDING_DECK_SIZE - clamped).fill("실패"),
  ];
  for (let i = cards.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [cards[i], cards[j]] = [cards[j], cards[i]];
  }
  return cards;
}
