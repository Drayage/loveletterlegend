import { CARD_DEFS, CARD_ORDER } from "../engine/cards";
import { Card } from "./Card";
import { Modal } from "./Modal";
import "./CardReferenceModal.css";

export function CardReferenceModal({ onClose }: { onClose: () => void }) {
  return (
    <Modal title="이번 게임 카드 목록" onClose={onClose}>
      <div className="card-reference">
        {CARD_ORDER.map((name) => {
          const def = CARD_DEFS[name];
          return (
            <div key={name} className="card-reference__row">
              <Card name={name} size="sm" />
              <div className="card-reference__text">
                <p className="card-reference__title">
                  {def.rank}. {def.name} ({def.englishAlias}) · {def.count}장
                </p>
                <p className="card-reference__ability">{def.ability}</p>
              </div>
            </div>
          );
        })}
      </div>
    </Modal>
  );
}
