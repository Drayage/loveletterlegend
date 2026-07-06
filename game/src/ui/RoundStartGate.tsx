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
  return (
    <Modal title={`${upcomingRoundNumber}주차 준비`} onClose={() => {}} dismissible={false}>
      <div className="round-start-gate">
        <p className="round-start-gate__prompt">
          {chooserName}이(가) 「{ROUTE_DEFS[route].displayName}」을(를) 추구하기로 했습니다.
        </p>
        {optionalCards.length > 0 && (
          <div className="round-start-gate__optional">
            <p className="round-start-gate__optional-title">이번 라운드 덱에 넣을 8번 카드</p>
            <div className="round-start-gate__optional-list">
              {optionalCards.map((cardName) => (
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
