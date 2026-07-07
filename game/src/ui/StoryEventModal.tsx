import type { ArchiveCardState } from "../engine/types";
import { ARCHIVE_CARD_SEEDS } from "../data/scenario";
import { ArchiveCardDetail } from "./ArchiveCardDetail";
import { Modal } from "./Modal";
import "./StoryEventModal.css";

interface StoryEventModalProps {
  cards: ArchiveCardState[];
  /** Elapsed [시계] -- drives the expiring card's "남은 시간 (N주)" badge. */
  clockTokens: number;
  onNext: (count?: number) => void;
}

/** Shows exactly one newly-revealed card at a time -- even when several
 * unlock in the same milestone (e.g. clock=1 revealing 024/031/053 at
 * once) -- so each reveal reads as its own story beat instead of a wall
 * of text. `onNext` advances the queue; the caller clears it after the
 * last card. */
export function StoryEventModal({ cards, clockTokens, onNext }: StoryEventModalProps) {
  if (cards.length === 0) return null;
  const current = cards[0];
  const identityGroup = current.category === "identity" ? cards.filter((card) => card.category === "identity") : [];
  const contiguousSameName: ArchiveCardState[] = [];
  for (const card of cards) {
    if (card.name !== current.name || card.category !== current.category) break;
    contiguousSameName.push(card);
  }
  const sameNameGroup =
    identityGroup.length === 0
      ? contiguousSameName
      : [];
  const mergedSameName =
    sameNameGroup.length > 1
      ? (() => {
          const preferred =
            sameNameGroup.find((card) => ARCHIVE_CARD_SEEDS[card.id]?.deckEffect || card.conditions.length > 0) ??
            sameNameGroup.find((card) => card.flavor.includes("《")) ??
            sameNameGroup[sameNameGroup.length - 1];
          const mergedFlavor = Array.from(new Set(sameNameGroup.map((card) => card.flavor).filter(Boolean))).join("\n");
          return [{ ...preferred, flavor: mergedFlavor }];
        })()
      : null;
  const visibleCards = identityGroup.length > 0 ? identityGroup : mergedSameName ?? [current];
  const advanceCount = identityGroup.length > 0 ? identityGroup.length : sameNameGroup.length > 1 ? sameNameGroup.length : 1;
  const remainingAfter = cards.length - advanceCount;
  const hasMore = remainingAfter > 0;

  return (
    <Modal title="이야기 보관소에 새로 공개된 카드" onClose={onNext} dismissible={false}>
      <div className="story-event">
        <div className={visibleCards.length > 1 ? "story-event__card story-event__card--grid" : "story-event__card"}>
          {visibleCards.map((card) => (
            <ArchiveCardDetail key={card.id} card={card} clockTokens={clockTokens} />
          ))}
        </div>
        <div className="story-event__actions">
          {hasMore && <span className="story-event__counter">다음 카드 {remainingAfter}장 남음</span>}
          <button type="button" className="story-event__next-btn" onClick={() => onNext(advanceCount)}>
            {hasMore ? "다음" : "확인"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
