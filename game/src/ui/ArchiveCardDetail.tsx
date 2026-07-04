import type { ArchiveCardState } from "../engine/types";
import { ARCHIVE_CARD_SEEDS } from "../data/scenario";
import "./ArchiveCardDetail.css";

export function ArchiveCardDetail({ card }: { card: ArchiveCardState }) {
  const pendingConditions = card.conditions.filter((c) => !c.fired);
  const earnRules = ARCHIVE_CARD_SEEDS[card.id]?.earnRules;

  return (
    <div className="archive-card-detail">
      <p className="archive-card-detail__name">{card.name}</p>
      <p className="archive-card-detail__flavor">{card.flavor}</p>
      {earnRules && earnRules.length > 0 && (
        <ul className="archive-card-detail__earn-rules">
          {earnRules.map((rule, i) => (
            <li key={i}>{rule}</li>
          ))}
        </ul>
      )}
      {pendingConditions.length > 0 && (
        <ul className="archive-card-detail__conditions">
          {pendingConditions.map((c) => {
            const count = c.token === "성공" ? card.successTokens : card.failTokens;
            return (
              <li key={c.id}>
                [{c.token}] {Math.min(count, c.threshold)} / {c.threshold} 이상 필요
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
