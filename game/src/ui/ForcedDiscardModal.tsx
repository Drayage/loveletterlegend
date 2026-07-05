import type { CardName } from "../engine/types";
import { Card } from "./Card";
import { Modal } from "./Modal";
import "./ForcedDiscardModal.css";

interface ForcedDiscardModalProps {
  effect: { cardName: CardName; discardedCardName: CardName } | null;
  actingDisplayName: string;
  targetDisplayName: string;
  isSelf: boolean;
  onDismiss: () => void;
}

/** Public effect popup for 마술사/마술사의도제's forced-discard resolution --
 * shown to both sides, since the discard pile is always public information
 * and a discard-and-redraw shouldn't happen invisibly to the player it
 * targeted. */
export function ForcedDiscardModal({
  effect,
  actingDisplayName,
  targetDisplayName,
  isSelf,
  onDismiss,
}: ForcedDiscardModalProps) {
  if (!effect) return null;

  return (
    <Modal title={`「${effect.cardName}」 효과`} onClose={onDismiss} dismissible={false}>
      <div className="forced-discard">
        <p className="forced-discard__prompt">
          {isSelf
            ? `${actingDisplayName}이(가) 스스로 손패를 버립니다.`
            : `${actingDisplayName}이(가) ${targetDisplayName}에게 손패를 버리게 합니다.`}
        </p>
        <Card name={effect.discardedCardName} size="lg" />
        <p className="forced-discard__caption">
          {targetDisplayName}이(가) 「{effect.discardedCardName}」을(를) 버렸습니다.
        </p>
        <button type="button" className="forced-discard__confirm-btn" onClick={onDismiss}>
          확인
        </button>
      </div>
    </Modal>
  );
}
