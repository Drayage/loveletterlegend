import type { CardName, GameState } from "../engine/types";
import { Card } from "./Card";
import "./TablePlay.css";

interface TablePlayProps {
  state: GameState;
  remaining: Record<CardName, number>;
  upgradeBadges?: Partial<Record<CardName, string>>;
}

/** Center-table exchange view: both players' most recent plays side by
 * side (chronological, oldest left) with a one-line outcome under each --
 * so "상대가 뭘 냈고 내가 뭘 내서 어떻게 됐는지" is readable at a glance
 * without digging through the log. Outcomes come from the engine's
 * recentPlays tracking (see effects.ts setPlayOutcome). */
export function TablePlay({ state, remaining, upgradeBadges = {} }: TablePlayProps) {
  const plays = state.recentPlays ?? [];
  const latest = plays[plays.length - 1];

  return (
    <div className="table-play">
      <span className="table-play__label">이번 교환</span>
      {plays.length > 0 ? (
        <div className="table-play__row">
          {plays.map((p) => {
            const player = state.players.find((pl) => pl.id === p.playerId);
            const isLatest = p === latest;
            return (
              // Re-keying on the instanceId restarts the pop-in animation
              // every time a new card lands on the table.
              <div
                key={p.card.instanceId}
                className={`table-play__slot${isLatest ? " table-play__pop" : ""}`}
              >
                <span className="table-play__name">{player?.displayName ?? p.playerId}</span>
                <Card
                  name={p.card.name}
                  size="sm"
                  remainingCount={remaining[p.card.name]}
                  upgradeBadge={upgradeBadges[p.card.name]}
                />
                <span className={`table-play__outcome${p.outcome ? "" : " table-play__outcome--pending"}`}>
                  {p.outcome ?? "효과 처리 중..."}
                </span>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="table-play__empty">아직 낸 카드 없음</div>
      )}
    </div>
  );
}
