import { useState } from "react";
import type { ArchiveCardState } from "../engine/types";
import type { SessionState } from "../engine/session";
import { ARCHIVE_CARD_SEEDS } from "../data/scenario";
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

function isLetterRuleFlavor(flavor: string): boolean {
  const text = flavor.trim();
  return text.startsWith("《") || text.includes("+[편지]") || /편지\s*\d+개\s*이상/.test(text);
}

function mergedDisplayFlavor(cards: ArchiveCardState[]): string {
  const flavors = cards.map((card) => card.flavor).filter(Boolean);
  const narrativeFlavors = flavors.filter((flavor) => !isLetterRuleFlavor(flavor));
  const displayFlavors = narrativeFlavors.length > 0 ? narrativeFlavors : flavors;
  return Array.from(new Set(displayFlavors)).join("\n");
}

function groupedCards(
  cards: ArchiveCardState[],
  activeIds: Set<string>,
  isVisible: (card: ArchiveCardState) => boolean
): Array<{ key: string; card: ArchiveCardState; inactive: boolean }> {
  const groups = new Map<string, ArchiveCardState[]>();
  for (const card of cards) {
    groups.set(card.name, [...(groups.get(card.name) ?? []), card]);
  }
  return Array.from(groups.entries())
    .filter(([, group]) => group.some(isVisible))
    .map(([name, group]) => {
      const preferred =
        group.find((card) => ARCHIVE_CARD_SEEDS[card.id]?.deckEffect || card.conditions.length > 0) ??
        group.find((card) => card.flavor.includes("《")) ??
        group[group.length - 1];
      const mergedFlavor = mergedDisplayFlavor(group);
      return {
        key: group.map((card) => card.id).join("-"),
        inactive: !group.some((card) => activeIds.has(card.id)),
        card: { ...preferred, name, flavor: mergedFlavor },
      };
    });
}

export function StoryArchiveModal({ archive, archiveHistory, clockTokens, session, humanId, onClose }: StoryArchiveModalProps) {
  const [showInactive, setShowInactive] = useState(false);
  const activeIds = new Set(archive.map((c) => c.id));
  const allCards = Object.values(archiveHistory);
  const isVisible = (c: ArchiveCardState) => showInactive || activeIds.has(c.id);

  const characters = groupedCards(allCards.filter((c) => c.category === "character"), activeIds, isVisible);
  const identities = allCards.filter((c) => c.category === "identity" && isVisible(c));
  const festivals = allCards.filter((c) => c.category === "festival" && isVisible(c));
  const scenarios = groupedCards(allCards.filter((c) => c.category === "scenario"), activeIds, isVisible);
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
              {characters.map(({ key, card, inactive }) => (
                <div key={key} className="story-archive__card">
                  <ArchiveCardDetail
                    card={card}
                    clockTokens={clockTokens}
                    inactive={inactive}
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
        {festivals.length > 0 && (
          <section className="story-archive__section">
            <h3 className="story-archive__section-title">축제</h3>
            <div className="story-archive__cards">
              {festivals.map((card) => (
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
              {scenarios.map(({ key, card, inactive }) => (
                <div key={key} className="story-archive__card">
                  <ArchiveCardDetail
                    card={card}
                    clockTokens={clockTokens}
                    inactive={inactive}
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
