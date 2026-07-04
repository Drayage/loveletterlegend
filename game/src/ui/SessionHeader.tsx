import type { Route, SessionState } from "../engine/session";
import { ROUTE_SLOT } from "../engine/session";
import { ROUTE_DEFS } from "../data/routes";
import "./SessionHeader.css";

interface SessionHeaderProps {
  session: SessionState;
  humanId: string;
  onShowArchive: () => void;
}

export function SessionHeader({ session, humanId, onShowArchive }: SessionHeaderProps) {
  const route: Route = session.currentRoute[humanId];
  const slot = ROUTE_SLOT[route];
  const letters = session.letterTokens[slot]?.[humanId] ?? 0;

  return (
    <div className="session-header">
      <div className="session-header__stat">
        <span className="session-header__label">라운드</span>
        <span className="session-header__value">{session.roundNumber} / 8</span>
      </div>
      <div className="session-header__stat">
        <span className="session-header__label">시계</span>
        <span className="session-header__value">{session.clockTokens}</span>
      </div>
      <div className="session-header__stat session-header__stat--route">
        <span className="session-header__label">추구하는 상대</span>
        <span className="session-header__value">{ROUTE_DEFS[route].displayName}</span>
        <div className="session-header__progress">
          <div
            className="session-header__progress-bar"
            style={{ width: `${Math.min(100, (letters / 10) * 100)}%` }}
          />
        </div>
        <span className="session-header__progress-label">편지 {letters} / 10</span>
      </div>
      <button type="button" className="session-header__archive-btn" onClick={onShowArchive}>
        이야기 보관소 보기
      </button>
    </div>
  );
}
