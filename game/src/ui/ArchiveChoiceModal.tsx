import { Modal } from "./Modal";
import "./ArchiveChoiceModal.css";

interface ArchiveChoiceModalProps {
  options: Array<{ id: string; label: string }>;
  onChoose: (optionId: string) => void;
}

/** 실카드의 "선택" 분기(052/079/105/122/173 등) -- 새로 공개된 이야기
 * 보관소 카드가 제시하는 갈래 중 하나를 고른다. 결과가 무엇을 공개하는지는
 * 보여주지 않는다 (label만 실카드 문구 그대로). */
export function ArchiveChoiceModal({ options, onChoose }: ArchiveChoiceModalProps) {
  return (
    <Modal title="이야기 보관소: 선택" onClose={() => {}} dismissible={false}>
      <div className="archive-choice">
        <p className="archive-choice__prompt">둘 중 하나를 선택합니다.</p>
        <div className="archive-choice__options">
          {options.map((o) => (
            <button key={o.id} type="button" className="archive-choice__option" onClick={() => onChoose(o.id)}>
              {o.label}
            </button>
          ))}
        </div>
      </div>
    </Modal>
  );
}
