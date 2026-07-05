import type { CardName } from "../engine/types";
import { Modal } from "./Modal";
import "./EffectBlockedModal.css";

interface EffectBlockedModalProps {
  effect: { cardName: CardName } | null;
  actingDisplayName: string;
  onDismiss: () => void;
}

/** Public effect popup shown when a card had no legal target -- in this 2P
 * implementation that only happens when the sole opponent is 승려-protected
 * (see GameState.lastEffectBlocked), so this reads as "protection blocked
 * the effect" instead of a silent, easy-to-miss log line. */
export function EffectBlockedModal({ effect, actingDisplayName, onDismiss }: EffectBlockedModalProps) {
  if (!effect) return null;

  return (
    <Modal title="효과 불발" onClose={onDismiss} dismissible={false}>
      <div className="effect-blocked">
        <p className="effect-blocked__badge">보호됨</p>
        <p className="effect-blocked__prompt">
          {actingDisplayName}이(가) 「{effect.cardName}」을(를) 냈지만, 상대가 「승려」 효과로 보호받고 있어 효과가
          발동하지 않았습니다.
        </p>
        <button type="button" className="effect-blocked__confirm-btn" onClick={onDismiss}>
          확인
        </button>
      </div>
    </Modal>
  );
}
