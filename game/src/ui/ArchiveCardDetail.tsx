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

/** `clockTokens` (the session's elapsed [시계]) enables the "남은 시간 (N주)"
 * countdown on expiring cards -- omitted by callers that don't have the
 * session at hand, in which case the badge is simply not shown.
 * `inactive` marks a card that's no longer in the live story archive
 * (consumed by a fired condition, a resolved 선택, or expiry) -- still
 * shown for history's sake (see SessionState.archiveHistory), just
 * badged so it reads as "done" rather than "currently pending". */
export function ArchiveCardDetail({
  card,
  clockTokens,
  inactive,
}: {
  card: ArchiveCardState;
  clockTokens?: number;
  inactive?: boolean;
}) {
  const earnRules = ARCHIVE_CARD_SEEDS[card.id]?.earnRules ?? [];
  const parsedRules = earnRules.map(splitEarnRule).filter((r): r is NonNullable<typeof r> => r !== null);
  const weeksLeft =
    card.expiresAtClock != null && clockTokens != null ? Math.max(0, card.expiresAtClock - clockTokens) : null;

  return (
    <div className="archive-card-detail">
      <div className="archive-card-detail__header">
        {card.category === "character" && card.art && (
          <img className="archive-card-detail__portrait" src={card.art} alt={card.name} />
        )}
        <div className="archive-card-detail__header-text">
          <p className="archive-card-detail__name">
            {card.name}
            {inactive && <span className="archive-card-detail__done">지난 이야기</span>}
            {!inactive && weeksLeft != null && (
              <span className="archive-card-detail__expiry">남은 시간 ({weeksLeft}주)</span>
            )}
          </p>
          {card.revealedFrom && (
            <p className="archive-card-detail__provenance">
              「{card.revealedFrom.sourceName}」의 「{card.revealedFrom.reason}」(으)로 공개됨
            </p>
          )}
          <p className="archive-card-detail__flavor">{card.flavor}</p>
        </div>
      </div>
      {card.conditions.length > 0 && (
        <div className="archive-card-detail__checklist">
          {card.conditionsTitle && <p className="archive-card-detail__checklist-title">{card.conditionsTitle}</p>}
          <ul className="archive-card-detail__conditions">
            {card.conditions.map((c) => {
              // sharedToken rows get a live progress readout + the earn
              // rules that feed that counter; other kinds are a plain
              // hypothesis row. Reveal targets are never shown.
              const shared = isSharedToken(c) ? c : null;
              const count = shared ? (shared.token === "성공" ? card.successTokens : card.failTokens) : 0;
              const rulesForToken = shared && !c.fired ? parsedRules.filter((r) => r.token === shared.token) : [];
              return (
                <li key={c.id} className={c.fired ? "archive-card-detail__condition--met" : undefined}>
                  <span className="archive-card-detail__condition-row">
                    <span className="archive-card-detail__checkbox" aria-hidden="true">
                      {c.fired ? "☑" : "☐"}
                    </span>
                    <span className="archive-card-detail__condition-label">
                      {c.label}
                      {shared && !c.fired && (
                        <span className="archive-card-detail__condition-progress">
                          {" "}
                          — 현재 {Math.min(count, shared.threshold)} / {shared.threshold}
                        </span>
                      )}
                    </span>
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
        </div>
      )}
    </div>
  );
}
