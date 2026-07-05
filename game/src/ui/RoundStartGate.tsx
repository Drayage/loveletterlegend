import type { Route } from "../engine/session";
import { ROUTE_DEFS } from "../data/routes";
import { Modal } from "./Modal";
import "./RoundStartGate.css";

interface RoundStartGateProps {
  upcomingRoundNumber: number;
  route: Route;
  chooserName: string;
  onStart: () => void;
}

/** A deliberate breather between "이전 라운드 결과 확인 완료" and the next
 * round actually starting (hands dealt, 「시작」태그 조건 재확인 등) -- the
 * player has to click to proceed, so the two never blur into one instant
 * cascade. */
export function RoundStartGate({ upcomingRoundNumber, route, chooserName, onStart }: RoundStartGateProps) {
  return (
    <Modal title={`${upcomingRoundNumber}주차 준비`} onClose={() => {}} dismissible={false}>
      <div className="round-start-gate">
        <p className="round-start-gate__prompt">
          {chooserName}이(가) 「{ROUTE_DEFS[route].displayName}」을(를) 추구하기로 했습니다.
        </p>
        <button type="button" className="round-start-gate__start-btn" onClick={onStart}>
          {upcomingRoundNumber}주차 시작
        </button>
      </div>
    </Modal>
  );
}
