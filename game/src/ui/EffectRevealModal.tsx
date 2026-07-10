import { useEffect, useState } from "react";
import type { CardName, RevealInfo } from "../engine/types";
import { Card } from "./Card";
import { Modal } from "./Modal";
import "./EffectRevealModal.css";

interface EffectRevealModalProps {
  reveal: RevealInfo | null;
  onDismiss: () => void;
}

// 광대와 같은 "상대(또는 덱) 카드 한 장 확인" 형태를 공유하는 카드들.
// 여기 없는 카드가 확인 정보를 만들어도 폴백 타이틀로 항상 표시된다 --
// 초기 구현은 타이틀이 없으면 모달을 아예 그리지 않아, 닫을 수 없는
// 보이지 않는 팝업이 흐름을 영영 막는 교착이 있었다 (예: 광대의 제자(여)).
const PEEK_TITLES: Partial<Record<CardName, string>> = {
  광대: "「광대」로 확인한 카드",
  광대의제자: "「광대의 제자」로 확인한 카드",
  광대의제자여: "「광대의 제자(여)」로 확인한 비공개 카드",
  점술사: "「점술사」로 확인한 덱 맨 위 카드",
  군사: "「군사」로 확인하고 교환한 카드",
  마술사: "「마술사」(도제 강화)로 확인한 덱 위 카드",
  마술사의도제: "「마술사의 도제」로 확인한 덱 맨 위 카드",
};

// 기사와 같은 "손패 숫자 비밀 비교" 형태를 공유하는 카드들.
const COMPARE_TITLES: Partial<Record<CardName, string>> = {
  기사: "「기사」 대결 결과",
  복면기사: "「복면 기사」 대결 결과",
  여기사: "「여기사」 대결 결과",
};

export function EffectRevealModal({ reveal, onDismiss }: EffectRevealModalProps) {
  const [compareRevealed, setCompareRevealed] = useState(false);

  useEffect(() => {
    setCompareRevealed(false);
    if (!reveal?.compare) return;
    const timer = setTimeout(() => setCompareRevealed(true), 650);
    return () => clearTimeout(timer);
  }, [reveal?.id]);

  if (!reveal) return null;

  const close = onDismiss;

  const peekTitle = PEEK_TITLES[reveal.cardName] ?? `「${reveal.cardName}」로 확인한 카드`;
  if (reveal.targetCards && reveal.targetCards.length > 0) {
    return (
      <Modal title={peekTitle} onClose={close}>
        <div className="reveal-modal">
          <p className="reveal-modal__caption">{reveal.targetDisplayName}</p>
          <div className="reveal-modal__row">
            {reveal.targetCards.map((name, i) => (
              <Card key={`${name}-${i}`} name={name} size="md" />
            ))}
          </div>
        </div>
      </Modal>
    );
  }
  if (reveal.targetCard) {
    return (
      <Modal title={peekTitle} onClose={close}>
        <div className="reveal-modal">
          <p className="reveal-modal__caption">{reveal.targetDisplayName}</p>
          <Card name={reveal.targetCard} size="lg" />
        </div>
      </Modal>
    );
  }

  const compareTitle = COMPARE_TITLES[reveal.cardName] ?? `「${reveal.cardName}」 대결 결과`;
  if (reveal.compare && compareTitle) {
    const { actorCard, targetCard, result } = reveal.compare;
    return (
      <Modal title={compareTitle} onClose={close}>
        <div className="reveal-modal">
          <div className="reveal-modal__row">
            <div className="reveal-modal__col">
              <p className="reveal-modal__caption">{reveal.actorDisplayName ?? "사용자"}의 카드</p>
              <div className={`reveal-modal__flip-card${compareRevealed ? " reveal-modal__flip-card--revealed" : ""}`}>
                <Card name={actorCard} size="md" faceDown={!compareRevealed} />
              </div>
            </div>
            <div className="reveal-modal__col">
              <p className="reveal-modal__caption">{reveal.targetDisplayName}의 카드</p>
              <div className={`reveal-modal__flip-card${compareRevealed ? " reveal-modal__flip-card--revealed" : ""}`}>
                <Card name={targetCard} size="md" faceDown={!compareRevealed} />
              </div>
            </div>
          </div>
          {compareRevealed && (
            <p className="reveal-modal__result">
              {result === "win" &&
                `${reveal.actorDisplayName ?? "사용자"} 승리: ${reveal.targetDisplayName}이(가) 탈락합니다.`}
              {result === "lose" &&
                `${reveal.targetDisplayName} 승리: ${reveal.actorDisplayName ?? "사용자"}이(가) 탈락합니다.`}
              {result === "tie" && "무승부, 아무 일도 일어나지 않습니다."}
            </p>
          )}
        </div>
      </Modal>
    );
  }

  // 알 수 없는 형태의 확인 정보라도 닫을 수 있는 모달은 반드시 그린다 --
  // null을 돌려주면 이 팝업이 흐름을 막은 채 닫을 방법이 없어진다.
  return (
    <Modal title={`「${reveal.cardName}」 효과`} onClose={close}>
      <div className="reveal-modal">
        <p className="reveal-modal__caption">{reveal.targetDisplayName}</p>
      </div>
    </Modal>
  );
}
