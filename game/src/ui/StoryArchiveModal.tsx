import type { ArchiveCardState } from "../engine/types";
import { ArchiveCardDetail } from "./ArchiveCardDetail";
import { Modal } from "./Modal";
import "./StoryArchiveModal.css";

interface StoryArchiveModalProps {
  archive: ArchiveCardState[];
  /** Elapsed [시계] -- drives each expiring card's "남은 시간 (N주)" badge. */
  clockTokens: number;
  onClose: () => void;
}

export function StoryArchiveModal({ archive, clockTokens, onClose }: StoryArchiveModalProps) {
  const characters = archive.filter((c) => c.category === "character");
  const scenarios = archive.filter((c) => c.category === "scenario");

  return (
    <Modal title="이야기 보관소" onClose={onClose}>
      <div className="story-archive">
        {characters.length > 0 && (
          <section className="story-archive__section">
            <h3 className="story-archive__section-title">캐릭터</h3>
            <div className="story-archive__cards">
              {characters.map((card) => (
                <div key={card.id} className="story-archive__card">
                  <ArchiveCardDetail card={card} clockTokens={clockTokens} />
                </div>
              ))}
            </div>
          </section>
        )}
        {scenarios.length > 0 && (
          <section className="story-archive__section">
            <h3 className="story-archive__section-title">시나리오</h3>
            <div className="story-archive__cards">
              {scenarios.map((card) => (
                <div key={card.id} className="story-archive__card">
                  <ArchiveCardDetail card={card} clockTokens={clockTokens} />
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </Modal>
  );
}
