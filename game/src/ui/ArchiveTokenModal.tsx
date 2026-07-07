import { useState } from "react";
import type { ArchiveCardState } from "../engine/types";
import { ArchiveCardDetail } from "./ArchiveCardDetail";
import { Modal } from "./Modal";
import "./ArchiveTokenModal.css";

interface ArchiveTokenModalProps {
  archive: ArchiveCardState[];
  eligibleArchiveIds?: string[] | null;
  onPlace: (cardId: string, token: "성공" | "실패") => void;
  onSkip: () => void;
}

export function ArchiveTokenModal({ archive, eligibleArchiveIds, onPlace, onSkip }: ArchiveTokenModalProps) {
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const eligibleSnapshot = eligibleArchiveIds ? new Set(eligibleArchiveIds) : null;
  // 031의 실카드 문구대로 "[조건]을 가진 카드" 위에만 놓을 수 있다.
  const candidates = archive.filter(
    (c) => (!eligibleSnapshot || eligibleSnapshot.has(c.id)) && c.conditionTag && c.conditions.some((cond) => !cond.fired)
  );
  const candidateIds = new Set(candidates.map((c) => c.id));
  const selectedCard = archive.find((c) => c.id === selectedCardId) ?? archive[0] ?? null;
  const canPlace = Boolean(selectedCard && candidateIds.has(selectedCard.id));

  return (
    <Modal title="이야기 보관소에 토큰 놓기" onClose={() => {}} dismissible={false}>
      <div className="archive-token">
        <p className="archive-token__prompt">
          이번 라운드 첫 번째로 탈락했습니다. 이야기 보관소의 [조건]을 가진 카드 1장에 [성공] 또는 [실패] 토큰을
          놓을 수 있습니다 (놓지 않아도 됩니다).
        </p>
        <div className="archive-token__browser">
          <div className="archive-token__cards" aria-label="이야기 보관소 카드">
            {archive.map((c) => (
              <button
                key={c.id}
                type="button"
                className={`archive-token__card${selectedCard?.id === c.id ? " archive-token__card--selected" : ""}`}
                onClick={() => setSelectedCardId(c.id)}
              >
                <span>{c.name}</span>
                {candidateIds.has(c.id) && <span className="archive-token__eligible">토큰 가능</span>}
              </button>
            ))}
          </div>
          {selectedCard && (
            <div className="archive-token__detail">
              <ArchiveCardDetail card={selectedCard} />
            </div>
          )}
        </div>
        <div className="archive-token__actions">
          <button
            type="button"
            className="archive-token__btn"
            disabled={!canPlace}
            onClick={() => selectedCard && onPlace(selectedCard.id, "성공")}
          >
            성공 토큰 놓기
          </button>
          <button
            type="button"
            className="archive-token__btn"
            disabled={!canPlace}
            onClick={() => selectedCard && onPlace(selectedCard.id, "실패")}
          >
            실패 토큰 놓기
          </button>
          <button type="button" className="archive-token__skip" onClick={onSkip}>
            놓지 않기
          </button>
        </div>
      </div>
    </Modal>
  );
}
