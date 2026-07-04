import type { ArchiveCardState } from "../engine/types";
import { ArchiveCardDetail } from "./ArchiveCardDetail";
import { Modal } from "./Modal";
import "./StoryEventModal.css";

interface StoryEventModalProps {
  cards: ArchiveCardState[];
  onClose: () => void;
}

export function StoryEventModal({ cards, onClose }: StoryEventModalProps) {
  if (cards.length === 0) return null;

  return (
    <Modal title="이야기 보관소에 새로 공개된 카드" onClose={onClose}>
      <div className="story-event">
        {cards.map((card) => (
          <div key={card.id} className="story-event__card">
            <ArchiveCardDetail card={card} />
          </div>
        ))}
      </div>
    </Modal>
  );
}
