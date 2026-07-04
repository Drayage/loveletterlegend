import { CARD_DEFS, CARD_ORDER } from "../engine/cards";
import { WIZARD_APPRENTICE } from "../data/characters";
import type { SessionState } from "../engine/session";
import { Card } from "./Card";
import { Modal } from "./Modal";
import "./CardReferenceModal.css";

interface CardReferenceModalProps {
  onClose: () => void;
  session?: SessionState;
}

export function CardReferenceModal({ onClose, session }: CardReferenceModalProps) {
  const upgrade = session?.round.activeCardUpgrades?.["마술사"];
  const upgradedAbility =
    upgrade === "tier2"
      ? WIZARD_APPRENTICE.tier2.abilityText
      : upgrade === "tier1"
        ? WIZARD_APPRENTICE.tier1.abilityText
        : null;

  return (
    <Modal title="이번 게임 카드 목록" onClose={onClose}>
      <div className="card-reference">
        {CARD_ORDER.map((name) => {
          const def = CARD_DEFS[name];
          const showUpgrade = name === "마술사" && upgradedAbility;
          return (
            <div key={name} className="card-reference__row">
              <Card name={name} size="sm" />
              <div className="card-reference__text">
                <p className="card-reference__title">
                  {def.rank}. {def.name} ({def.englishAlias}) · {def.count}장
                </p>
                <p className="card-reference__ability">{def.ability}</p>
                {showUpgrade && (
                  <p className="card-reference__ability card-reference__ability--upgraded">
                    (개정됨) {upgradedAbility}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </Modal>
  );
}
