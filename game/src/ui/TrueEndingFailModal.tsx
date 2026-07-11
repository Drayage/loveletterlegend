import { Modal } from "./Modal";
import "./TrueEndingFailModal.css";

interface TrueEndingFailModalProps {
  text: string;
  onNext: () => void;
}

/** 성공/실패 카드 뽑기에서 실패가 나왔을 때의 짧은 결과 문구 -- 이 문구엔
 * (일반엔딩과 달리) CG가 준비될 계획이 없어, EndingScene의 이미지+한 줄씩
 * 넘기는 연출 대신 다른 모달들과 같은 평범한 확인 모달로 간단히 보여주고
 * 곧바로 일반엔딩(EndingScene)으로 넘어간다. */
export function TrueEndingFailModal({ text, onNext }: TrueEndingFailModalProps) {
  return (
    <Modal title="운명의 순간" onClose={onNext} dismissible={false}>
      <div className="true-ending-fail">
        <p className="true-ending-fail__text">{text}</p>
        <button type="button" className="true-ending-fail__confirm-btn" onClick={onNext}>
          다음 &gt;
        </button>
      </div>
    </Modal>
  );
}
