import { Modal } from "./Modal";
import "./EliminationModal.css";

interface EliminationModalProps {
  playerDisplayName: string;
  reason: string;
  onDismiss: () => void;
}

/** Public acknowledgment of who was just eliminated and why (see
 * GameState.lastElimination) -- shown regardless of who caused it, so
 * eliminations never feel like they happened off-screen just because the
 * local human wasn't the one playing the card (e.g. AI's 「기사」 beating
 * the human, or a 경비병 guess landing, neither of which otherwise pops
 * any modal for the human). */
export function EliminationModal({ playerDisplayName, reason, onDismiss }: EliminationModalProps) {
  return (
    <Modal title="탈락" onClose={onDismiss} dismissible={false}>
      <div className="elimination-modal">
        <p className="elimination-modal__headline">{playerDisplayName} 탈락</p>
        <p className="elimination-modal__reason">{reason}</p>
        <button type="button" className="elimination-modal__confirm-btn" onClick={onDismiss}>
          확인
        </button>
      </div>
    </Modal>
  );
}
