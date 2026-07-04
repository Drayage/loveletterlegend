import type { ArchiveCardState } from "../engine/types";
import { ArchiveCardDetail } from "./ArchiveCardDetail";
import { Modal } from "./Modal";
import "./StoryArchiveModal.css";

interface StoryArchiveModalProps {
  archive: ArchiveCardState[];
  onClose: () => void;
}

export function StoryArchiveModal({ archive, onClose }: StoryArchiveModalProps) {
  return (
    <Modal title="이야기 보관소" onClose={onClose}>
      <div className="story-archive">
        {archive.map((card) => (
          <div key={card.id} className="story-archive__card">
            <ArchiveCardDetail card={card} />
          </div>
        ))}
      </div>
    </Modal>
  );
}
