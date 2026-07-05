import type { ResolvedChoiceInfo } from "../engine/session";
import { Modal } from "./Modal";
import "./ChoiceResultModal.css";

interface ChoiceResultModalProps {
  info: ResolvedChoiceInfo;
  chooserName: string;
  onDismiss: () => void;
}

/** Shown right after a 실카드 "선택" 분기(052/079/105/122/173 등)가 해소된
 * 직후 -- 어떤 선택지들이 있었고 그중 무엇을 누가 골랐는지 보여준다. The
 * resulting newly-revealed cards' own StoryEventModal pops up right after
 * this closes. */
export function ChoiceResultModal({ info, chooserName, onDismiss }: ChoiceResultModalProps) {
  return (
    <Modal title="이야기 보관소: 선택 결과" onClose={onDismiss} dismissible={false}>
      <div className="choice-result">
        <p className="choice-result__prompt">
          「{info.cardName}」에서 {chooserName}이(가) 선택했습니다.
        </p>
        <ul className="choice-result__options">
          {info.options.map((o) => {
            const chosen = o.id === info.chosenOptionId;
            return (
              <li key={o.id} className={chosen ? "choice-result__option--chosen" : undefined}>
                <span className="choice-result__marker" aria-hidden="true">
                  {chosen ? "●" : "○"}
                </span>
                <span className="choice-result__label">{o.label}</span>
              </li>
            );
          })}
        </ul>
        <button type="button" className="choice-result__confirm-btn" onClick={onDismiss}>
          확인
        </button>
      </div>
    </Modal>
  );
}
