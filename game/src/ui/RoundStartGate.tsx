import type { Route } from "../engine/session";
import type { CardName } from "../engine/types";
import { Modal } from "./Modal";
import "./RoundStartGate.css";

interface RoundStartGateProps {
  upcomingRoundNumber: number;
  route: Route;
  chooserName: string;
  readOnly?: boolean;
  optionalCards?: CardName[];
  selectedOptionalCards?: CardName[];
  onToggleOptionalCard?: (cardName: CardName) => void;
  onStart: () => void;
}

const rank8DisplayNames: Partial<Record<CardName, string>> = {
  공주둘째: "공주(둘째)",
  공주셋째: "공주(셋째)",
};

/** A deliberate breather between "이전 라운드 결과 확인 완료" and the next
 * round actually starting (hands dealt, 「시작」태그 조건 재확인 등) -- the
 * player has to click to proceed, so the two never blur into one instant
 * cascade. */
export function RoundStartGate({
  upcomingRoundNumber,
  route,
  chooserName,
  readOnly = false,
  optionalCards = [],
  selectedOptionalCards = [],
  onToggleOptionalCard,
  onStart,
}: RoundStartGateProps) {
  const routeSwapCardNames = new Set<CardName>(["공주", "왕자", "공주둘째", "공주셋째"]);
  const routeSwapCards: CardName[] = [
    "공주",
    "왕자",
    ...optionalCards.filter((name) => name === "공주둘째" || name === "공주셋째"),
  ];
  const additionalCards = optionalCards.filter((name) => !routeSwapCardNames.has(name));
  const selectedRouteSwap =
    selectedOptionalCards.find((name) => routeSwapCards.includes(name)) ?? (route === "왕자" ? "왕자" : "공주");

  return (
    <Modal title={`${upcomingRoundNumber}주차 준비`} onClose={() => {}} dismissible={false}>
      <div className="round-start-gate">
        <p className="round-start-gate__prompt">
          {chooserName}이(가) 이번 라운드의 공주/왕자 카드를 선택합니다.
        </p>
        <div className="round-start-gate__optional">
          <p className="round-start-gate__optional-title">공주/왕자 카드 선택 (택1)</p>
          <p className="round-start-gate__optional-hint">
            고른 8번 카드가 이번 라운드 덱에 들어갑니다. 공주 ↔ 왕자를 바꾸면 추구하는 상대도 함께 전환됩니다.
          </p>
          <div className="round-start-gate__optional-list">
            {routeSwapCards.map((cardName) => (
              <label key={cardName} className="round-start-gate__optional-item">
                <input
                  type="radio"
                  name="route-rank8-card"
                  checked={selectedRouteSwap === cardName}
                  disabled={readOnly}
                  onChange={() => {
                    if (!readOnly && selectedRouteSwap !== cardName) onToggleOptionalCard?.(cardName);
                  }}
                />
                <span>「{rank8DisplayNames[cardName] ?? cardName}」</span>
              </label>
            ))}
          </div>
        </div>
        {additionalCards.length > 0 && (
          <div className="round-start-gate__optional">
            <p className="round-start-gate__optional-title">추가 8번 카드 선택</p>
            <div className="round-start-gate__optional-list">
              {additionalCards.map((cardName) => (
                <label key={cardName} className="round-start-gate__optional-item">
                  <input
                    type="checkbox"
                    checked={selectedOptionalCards.includes(cardName)}
                    disabled={readOnly}
                    onChange={() => {
                      if (!readOnly) onToggleOptionalCard?.(cardName);
                    }}
                  />
                  <span>「{rank8DisplayNames[cardName] ?? cardName}」</span>
                </label>
              ))}
            </div>
          </div>
        )}
        <button type="button" className="round-start-gate__start-btn" onClick={onStart}>
          {upcomingRoundNumber}주차 시작
        </button>
      </div>
    </Modal>
  );
}
