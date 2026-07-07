import type { Route } from "../engine/session";
import type { CardName } from "../engine/types";
import { ROUTE_DEFS } from "../data/routes";
import { Modal } from "./Modal";
import "./RoundStartGate.css";

interface RoundStartGateProps {
  upcomingRoundNumber: number;
  route: Route;
  chooserName: string;
  optionalCards?: CardName[];
  selectedOptionalCards?: CardName[];
  onToggleOptionalCard?: (cardName: CardName) => void;
  onStart: () => void;
}

/** A deliberate breather between "이전 라운드 결과 확인 완료" and the next
 * round actually starting (hands dealt, 「시작」태그 조건 재확인 등) -- the
 * player has to click to proceed, so the two never blur into one instant
 * cascade. */
export function RoundStartGate({
  upcomingRoundNumber,
  route,
  chooserName,
  optionalCards = [],
  selectedOptionalCards = [],
  onToggleOptionalCard,
  onStart,
}: RoundStartGateProps) {
  const routeSwapCardNames = new Set<CardName>(["공주둘째", "공주셋째"]);
  const routeSwapCards = optionalCards.filter((name) => routeSwapCardNames.has(name));
  const additionalCards = optionalCards.filter((name) => !routeSwapCardNames.has(name));
  const selectedRouteSwap = selectedOptionalCards.find((name) => routeSwapCards.includes(name)) ?? null;

  return (
    <Modal title={`${upcomingRoundNumber}주차 준비`} onClose={() => {}} dismissible={false}>
      <div className="round-start-gate">
        <p className="round-start-gate__prompt">
          {chooserName}이(가) 「{ROUTE_DEFS[route].displayName}」을(를) 추구하기로 했습니다.
        </p>
        {routeSwapCards.length > 0 && (
          <div className="round-start-gate__optional">
            <p className="round-start-gate__optional-title">공주/왕자 카드 선택 (택1)</p>
            <div className="round-start-gate__optional-list">
              <label className="round-start-gate__optional-item">
                <input
                  type="radio"
                  name="route-rank8-card"
                  checked={selectedRouteSwap === null}
                  onChange={() => {
                    if (selectedRouteSwap) onToggleOptionalCard?.(selectedRouteSwap);
                  }}
                />
                <span>기본 공주/왕자</span>
              </label>
              {routeSwapCards.map((cardName) => (
                <label key={cardName} className="round-start-gate__optional-item">
                  <input
                    type="radio"
                    name="route-rank8-card"
                    checked={selectedOptionalCards.includes(cardName)}
                    onChange={() => {
                      if (selectedRouteSwap && selectedRouteSwap !== cardName) onToggleOptionalCard?.(selectedRouteSwap);
                      if (!selectedOptionalCards.includes(cardName)) onToggleOptionalCard?.(cardName);
                    }}
                  />
                  <span>「{cardName}」</span>
                </label>
              ))}
            </div>
          </div>
        )}
        {additionalCards.length > 0 && (
          <div className="round-start-gate__optional">
            <p className="round-start-gate__optional-title">추가 8번 카드 선택</p>
            <div className="round-start-gate__optional-list">
              {additionalCards.map((cardName) => (
                <label key={cardName} className="round-start-gate__optional-item">
                  <input
                    type="checkbox"
                    checked={selectedOptionalCards.includes(cardName)}
                    onChange={() => onToggleOptionalCard?.(cardName)}
                  />
                  <span>「{cardName}」</span>
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
