// Sourced from data/cards.json ids 018-021 (corrected version) -- the two
// starting "공주/왕자" romance routes the human can pursue and switch
// between each round (see engine/session.ts).

export type Route = "공주" | "왕자";

export interface RouteDef {
  displayName: string;
  flavor: string;
  /** Real "시작" tag wording from the even-numbered card (018/021), shown in
   * the card reference / route-switch UI. */
  swapAbilityText: string;
  oddCardId: string;
  evenCardId: string;
}

export const ROUTE_DEFS: Record<Route, RouteDef> = {
  공주: {
    displayName: "잉그리드 공주",
    flavor: "「언젠가 제게도 사랑하는 분이 생길까요?」",
    swapAbilityText:
      "매 라운드 시작시, 다른 「공주/왕자」를 덱의 대응하는 캐릭터 카드 아래로 되돌리고 「공주」를 덱에 추가해도 됩니다.",
    oddCardId: "018",
    evenCardId: "019",
  },
  왕자: {
    displayName: "아레스 왕자",
    flavor: "「운명의 상대가 어디엔가 있으리라고 믿고 있습니다」",
    swapAbilityText:
      "매 라운드 시작시, 다른 「공주/왕자」를 덱의 대응하는 캐릭터 카드 아래로 되돌리고 「왕자」를 덱에 추가해도 됩니다.",
    oddCardId: "020",
    evenCardId: "021",
  },
};
