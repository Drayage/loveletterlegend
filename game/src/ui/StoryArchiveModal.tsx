import type { ArchiveCardState } from "../engine/types";
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
            <p className="story-archive__name">{card.name}</p>
            <p className="story-archive__flavor">{card.flavor}</p>
            {card.conditions.filter((c) => !c.fired).length > 0 && (
              <ul className="story-archive__conditions">
                {card.conditions
                  .filter((c) => !c.fired)
                  .map((c) => {
                    const count = c.token === "성공" ? card.successTokens : card.failTokens;
                    return (
                      <li key={c.id}>
                        [{c.token}] {Math.min(count, c.threshold)} / {c.threshold}
                      </li>
                    );
                  })}
              </ul>
            )}
          </div>
        ))}
      </div>
    </Modal>
  );
}
