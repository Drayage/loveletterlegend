import type { ArchiveCardState } from "../engine/types";
import { describeRevealTargets } from "../data/scenario";
import "./ArchiveCardDetail.css";

export function ArchiveCardDetail({ card }: { card: ArchiveCardState }) {
  const pendingConditions = card.conditions.filter((c) => !c.fired);

  return (
    <div className="archive-card-detail">
      <p className="archive-card-detail__name">{card.name}</p>
      <p className="archive-card-detail__flavor">{card.flavor}</p>
      {pendingConditions.length > 0 && (
        <ul className="archive-card-detail__conditions">
          {pendingConditions.map((c) => {
            const count = c.token === "성공" ? card.successTokens : card.failTokens;
            return (
              <li key={c.id}>
                [{c.token}] {Math.min(count, c.threshold)} / {c.threshold} 이상 → 공개:{" "}
                {describeRevealTargets(c.revealIds)}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
