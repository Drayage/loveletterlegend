import { useState } from "react";
import type { ArchiveCardState } from "../engine/types";
import type { SessionState } from "../engine/session";
import { ArchiveCardDetail } from "./ArchiveCardDetail";
import { Modal } from "./Modal";
import "./StoryArchiveModal.css";

interface StoryArchiveModalProps {
  /** Currently-active cards (still in the live story archive). */
  archive: ArchiveCardState[];
  /** Every card ever revealed this session, keyed by id (see
   * SessionState.archiveHistory) -- shown alongside `archive` so cards
   * that already got consumed (a fired condition, a resolved 선택,
   * expiry) don't just vanish from view; they're badged "지난 이야기"
   * instead. Hidden by default (behind the "지난 이야기 보기" toggle) so the
   * list stays focused on what's currently relevant. */
  archiveHistory: Record<string, ArchiveCardState>;
  /** Elapsed [시계] -- drives each expiring card's "남은 시간 (N주)" badge. */
  clockTokens: number;
  session: SessionState;
  humanId: string;
  onClose: () => void;
}

export function StoryArchiveModal({ archive, archiveHistory, clockTokens, session, humanId, onClose }: StoryArchiveModalProps) {
  const [showInactive, setShowInactive] = useState(false);
  const activeIds = new Set(archive.map((c) => c.id));
  const allCards = Object.values(archiveHistory);
  const isVisible = (c: ArchiveCardState) => showInactive || activeIds.has(c.id);

  const characters = allCards.filter((c) => c.category === "character" && isVisible(c));
  const identities = allCards.filter((c) => c.category === "identity" && isVisible(c));
  const scenarios = allCards.filter((c) => c.category === "scenario" && isVisible(c));
  const inactiveCount = allCards.filter((c) => !activeIds.has(c.id)).length;

  return (
    <Modal title="이야기 보관소" onClose={onClose}>
      <div className="story-archive">
        {inactiveCount > 0 && (
          <button type="button" className="story-archive__toggle" onClick={() => setShowInactive((v) => !v)}>
            {showInactive ? "지난 이야기 숨기기" : `지난 이야기 보기 (${inactiveCount})`}
          </button>
        )}
        {characters.length > 0 && (
          <section className="story-archive__section">
            <h3 className="story-archive__section-title">캐릭터</h3>
            <div className="story-archive__cards">
              {characters.map((card) => (
                <div key={card.id} className="story-archive__card">
                  <ArchiveCardDetail
                    card={card}
                    clockTokens={clockTokens}
                    inactive={!activeIds.has(card.id)}
                    playerConfigs={session.playerConfigs}
                    humanId={humanId}
                    letterTokens={session.letterTokens}
                  />
                </div>
              ))}
            </div>
          </section>
        )}
        {identities.length > 0 && (
          <section className="story-archive__section">
            <h3 className="story-archive__section-title">정체</h3>
            <div className="story-archive__cards">
              {identities.map((card) => (
                <div key={card.id} className="story-archive__card">
                  <ArchiveCardDetail
                    card={card}
                    clockTokens={clockTokens}
                    inactive={!activeIds.has(card.id)}
                    playerConfigs={session.playerConfigs}
                    humanId={humanId}
                    letterTokens={session.letterTokens}
                  />
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
                  <ArchiveCardDetail
                    card={card}
                    clockTokens={clockTokens}
                    inactive={!activeIds.has(card.id)}
                    playerConfigs={session.playerConfigs}
                    humanId={humanId}
                    letterTokens={session.letterTokens}
                  />
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </Modal>
  );
}
