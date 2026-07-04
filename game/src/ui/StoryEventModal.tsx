import type { ArchiveCardState } from "../engine/types";
import { ArchiveCardDetail } from "./ArchiveCardDetail";
import { Modal } from "./Modal";
import "./StoryEventModal.css";

interface StoryEventModalProps {
  cards: ArchiveCardState[];
  onNext: () => void;
}

/** Shows exactly one newly-revealed card at a time -- even when several
 * unlock in the same milestone (e.g. clock=1 revealing 024/031/053 at
 * once) -- so each reveal reads as its own story beat instead of a wall
 * of text. `onNext` advances the queue; the caller clears it after the
 * last card. */
export function StoryEventModal({ cards, onNext }: StoryEventModalProps) {
  if (cards.length === 0) return null;
  const [current, ...rest] = cards;
  const hasMore = rest.length > 0;

  return (
    <Modal title="이야기 보관소에 새로 공개된 카드" onClose={onNext} dismissible={false}>
      <div className="story-event">
        <div className="story-event__card">
          <ArchiveCardDetail card={current} />
        </div>
        <div className="story-event__actions">
          {hasMore && <span className="story-event__counter">다음 카드 {rest.length}장 남음</span>}
          <button type="button" className="story-event__next-btn" onClick={onNext}>
            {hasMore ? "다음" : "확인"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
