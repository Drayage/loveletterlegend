import type { Route, SessionState } from "../engine/session";
import { ROUTE_SLOT } from "../engine/session";
import { ROUTE_DEFS } from "../data/routes";
import "./SessionHeader.css";

interface SessionHeaderProps {
  session: SessionState;
  humanId: string;
  onShowArchive: () => void;
}

function RouteStatus({ playerName, route, letters }: { playerName: string; route: Route; letters: number }) {
  const def = ROUTE_DEFS[route];
  return (
    <div className="session-header__route">
      <img className="session-header__route-art" src={def.art} alt={def.displayName} />
      <div className="session-header__route-info">
        <span className="session-header__route-player">{playerName}</span>
        <span className="session-header__value">{def.displayName}</span>
        <div className="session-header__progress">
          <div
            className="session-header__progress-bar"
            style={{ width: `${Math.min(100, (letters / 10) * 100)}%` }}
          />
        </div>
        <span className="session-header__progress-label">편지 {letters} / 10</span>
      </div>
    </div>
  );
}

export function SessionHeader({ session, humanId, onShowArchive }: SessionHeaderProps) {
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

      <div className="session-header__routes">
        {session.playerConfigs.map((cfg) => {
          const route = session.currentRoute[cfg.id];
          const slot = ROUTE_SLOT[route];
          const letters = session.letterTokens[slot]?.[cfg.id] ?? 0;
          return (
            <RouteStatus
              key={cfg.id}
              playerName={cfg.id === humanId ? "나" : cfg.displayName}
              route={route}
              letters={letters}
            />
          );
        })}
      </div>

      <button type="button" className="session-header__archive-btn" onClick={onShowArchive}>
        이야기 보관소 보기
      </button>
    </div>
  );
}
