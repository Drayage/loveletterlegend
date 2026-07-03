import type { ReactNode } from "react";
import "./Modal.css";

interface ModalProps {
  title: string;
  onClose: () => void;
  children: ReactNode;
  /** Set false for a mandatory decision that has no "cancel" -- hides the
   * close button and ignores backdrop clicks. */
  dismissible?: boolean;
}

export function Modal({ title, onClose, children, dismissible = true }: ModalProps) {
  return (
    <div className="modal-backdrop" onClick={dismissible ? onClose : undefined}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <header className="modal__header">
          <h3>{title}</h3>
          {dismissible && (
            <button type="button" className="modal__close" onClick={onClose} aria-label="닫기">
              ✕
            </button>
          )}
        </header>
        <div className="modal__body">{children}</div>
      </div>
    </div>
  );
}
