import type { CardName, RevealInfo } from "../engine/types";
import { Card } from "./Card";
import { Modal } from "./Modal";
import "./EffectRevealModal.css";

interface EffectRevealModalProps {
  reveal: RevealInfo | null;
  onDismiss: () => void;
}

// 광대와 같은 "상대(또는 덱) 카드 한 장 확인" 형태를 공유하는 카드들.
const PEEK_TITLES: Partial<Record<CardName, string>> = {
  광대: "「광대」로 확인한 카드",
  광대의제자: "「광대의 제자」로 확인한 카드",
  점술사: "「점술사」로 확인한 덱 맨 위 카드",
  군사: "「군사」로 확인하고 교환한 카드",
  마술사의도제: "「마술사의 도제」로 확인한 덱 맨 위 카드",
};

// 기사와 같은 "손패 숫자 비밀 비교" 형태를 공유하는 카드들.
const COMPARE_TITLES: Partial<Record<CardName, string>> = {
  기사: "「기사」 대결 결과",
  복면기사: "「복면 기사」 대결 결과",
};

export function EffectRevealModal({ reveal, onDismiss }: EffectRevealModalProps) {
  if (!reveal) return null;

  const close = onDismiss;

  const peekTitle = PEEK_TITLES[reveal.cardName];
  if (reveal.targetCard && peekTitle) {
    return (
      <Modal title={peekTitle} onClose={close}>
        <div className="reveal-modal">
          <p className="reveal-modal__caption">{reveal.targetDisplayName}</p>
          <Card name={reveal.targetCard} size="lg" />
        </div>
      </Modal>
    );
  }

  const compareTitle = COMPARE_TITLES[reveal.cardName];
  if (reveal.compare && compareTitle) {
    const { actorCard, targetCard, result } = reveal.compare;
    return (
      <Modal title={compareTitle} onClose={close}>
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
