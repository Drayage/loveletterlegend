import type { RevealInfo } from "../engine/types";
import { Card } from "./Card";
import { Modal } from "./Modal";
import "./EffectRevealModal.css";

interface EffectRevealModalProps {
  reveal: RevealInfo | null;
  onDismiss: () => void;
}

export function EffectRevealModal({ reveal, onDismiss }: EffectRevealModalProps) {
  if (!reveal) return null;

  const close = onDismiss;

  if (reveal.cardName === "광대" && reveal.targetCard) {
    return (
      <Modal title="「광대」로 확인한 카드" onClose={close}>
        <div className="reveal-modal">
          <p className="reveal-modal__caption">{reveal.targetDisplayName}의 손패</p>
          <Card name={reveal.targetCard} size="lg" />
        </div>
      </Modal>
    );
  }

  if (reveal.cardName === "기사" && reveal.compare) {
    const { actorCard, targetCard, result } = reveal.compare;
    return (
      <Modal title="「기사」 대결 결과" onClose={close}>
        <div className="reveal-modal">
          <div className="reveal-modal__row">
            <div className="reveal-modal__col">
              <p className="reveal-modal__caption">내 카드</p>
              <Card name={actorCard} size="md" />
            </div>
            <div className="reveal-modal__col">
              <p className="reveal-modal__caption">{reveal.targetDisplayName}의 카드</p>
              <Card name={targetCard} size="md" />
            </div>
          </div>
          <p className="reveal-modal__result">
            {result === "win" && `승리! ${reveal.targetDisplayName}이(가) 탈락합니다.`}
            {result === "lose" && "패배... 내가 탈락합니다."}
            {result === "tie" && "무승부, 아무 일도 일어나지 않습니다."}
          </p>
        </div>
      </Modal>
    );
  }

  return null;
}
