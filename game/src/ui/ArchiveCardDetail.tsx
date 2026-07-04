import type { ArchiveCardState, ArchiveCondition } from "../engine/types";
import { ARCHIVE_CARD_SEEDS } from "../data/scenario";
import "./ArchiveCardDetail.css";

type SharedTokenCondition = Extract<ArchiveCondition, { kind: "sharedToken" }>;
function isSharedToken(c: ArchiveCondition): c is SharedTokenCondition {
  return c.kind === "sharedToken";
}

/** earnRules entries end with a "...: 성공" / "...: 실패" suffix marking
 * which shared token they contribute to -- split it off so it can be
 * grouped under the matching condition instead of shown as a flat list. */
function splitEarnRule(rule: string): { text: string; token: "성공" | "실패" } | null {
  const match = rule.match(/^(.*):\s*(성공|실패)$/);
  if (!match) return null;
  return { text: match[1], token: match[2] as "성공" | "실패" };
}

export function ArchiveCardDetail({ card }: { card: ArchiveCardState }) {
  // Only "sharedToken" conditions (e.g. 053's [성공]/[실패] thresholds) have
  // a meaningful player-facing progress readout here. The other condition
  // kinds (023's "winner held X card", 024's "N+ conditioned cards") are
  // driven by things the player can't grind toward, so there's nothing
  // useful to show for them yet.
  const pendingConditions = card.conditions.filter((c): c is SharedTokenCondition => !c.fired && isSharedToken(c));
  const earnRules = ARCHIVE_CARD_SEEDS[card.id]?.earnRules ?? [];
  const parsedRules = earnRules.map(splitEarnRule).filter((r): r is NonNullable<typeof r> => r !== null);

  return (
    <div className="archive-card-detail">
      <div className="archive-card-detail__header">
        {card.category === "character" && card.art && (
          <img className="archive-card-detail__portrait" src={card.art} alt={card.name} />
        )}
        <div className="archive-card-detail__header-text">
          <p className="archive-card-detail__name">{card.name}</p>
          <p className="archive-card-detail__flavor">{card.flavor}</p>
        </div>
      </div>
      {pendingConditions.length > 0 && (
        <ul className="archive-card-detail__conditions">
          {pendingConditions.map((c) => {
            const count = c.token === "성공" ? card.successTokens : card.failTokens;
            const rulesForToken = parsedRules.filter((r) => r.token === c.token);
            return (
              <li key={c.id}>
                <span className="archive-card-detail__condition-progress">
                  [{c.token}] {Math.min(count, c.threshold)} / {c.threshold} 이상 필요
                </span>
                {rulesForToken.length > 0 && (
                  <ul className="archive-card-detail__earn-rules">
                    {rulesForToken.map((r, i) => (
                      <li key={i}>{r.text}</li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
