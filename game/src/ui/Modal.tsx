import type { ReactNode } from "react";
import "./Modal.css";

interface ModalProps {
  title: string;
  onClose: () => void;
  children: ReactNode;
}

export function Modal({ title, onClose, children }: ModalProps) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <header className="modal__header">
          <h3>{title}</h3>
          <button type="button" className="modal__close" onClick={onClose} aria-label="닫기">
            ✕
          </button>
        </header>
        <div className="modal__body">{children}</div>
      </div>
    </div>
  );
}
