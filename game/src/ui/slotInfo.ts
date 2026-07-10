// 캐릭터 슬롯 id -> 화면 표시용 이름/초상. LetterTokenChoiceModal(배치 선택),
// RoundEndSummary(획득 내역), SessionHeader 등 슬롯 id를 사람이 읽는 이름으로
// 보여줘야 하는 모든 UI가 공유한다.
import type { CharacterSlotId } from "../engine/session";
import { ROUTE_DEFS } from "../data/routes";
import { WIZARD_APPRENTICE } from "../data/characters";
import princessSecond from "../assets/cards/extra/8. 공주(둘째).jpg";
import princessThird from "../assets/cards/extra/8. 공주(셋째).jpg";

export const SLOT_INFO: Record<CharacterSlotId, { name: string; art?: string }> = {
  잉그리드공주: { name: ROUTE_DEFS.공주.displayName, art: ROUTE_DEFS.공주.art },
  아레스왕자: { name: ROUTE_DEFS.왕자.displayName, art: ROUTE_DEFS.왕자.art },
  루나공주: { name: "루나 공주", art: princessSecond },
  마가렛공주: { name: "마가렛 공주", art: princessThird },
  경비병알리오스: { name: "경비병 알리오스" },
  신병아니스: { name: "신병 아니스" },
  마을소녀미란다: { name: "간판 점원 미란다" },
  시종트래비스: { name: "시종 트래비스" },
  시녀메이블: { name: "시녀 메이블" },
  광대제자리카드: { name: "광대의 제자 리카드" },
  광대제자피오: { name: "광대의 제자 피오" },
  점술사그리셀다: { name: "점술사 그리셀다" },
  배우파비오: { name: "배우 파비오" },
  무희미나: { name: "무희 미나" },
  기사라이언: { name: "기사 라이언" },
  여기사캐리: { name: "여기사 캐리" },
  여상인수잔나: { name: "여상인 수잔나" },
  승려올리비아: { name: "승려 올리비아" },
  수사알베르트: { name: "수사 알베르트" },
  수녀로베리아: { name: "수녀 로베리아" },
  집사세바스티안: { name: "집사 세바스티안" },
  마술사의도제: { name: WIZARD_APPRENTICE.name },
  마녀베아트릭스: { name: "마녀 베아트릭스" },
  대마도사15알비스: { name: "대마도사 알비스(15세)" },
  대마도사20알비스: { name: "대마도사 알비스(20세)" },
  여장군아즈사: { name: "여장군 아즈사" },
  군사시어도어: { name: "군사 시어도어" },
  정무관오즈릭: { name: "정무관 오즈릭" },
  정무관오즈리나: { name: "정무관 오즈리나" },
  여후작엘마: { name: "여후작 엘마" },
  백작부인카밀라: { name: "백작부인 카밀라" },
  귀족영애아나스타샤: { name: "공작의 영애 아나스타샤" },
};

export function slotDisplayName(slot: CharacterSlotId): string {
  return SLOT_INFO[slot]?.name ?? slot;
}
