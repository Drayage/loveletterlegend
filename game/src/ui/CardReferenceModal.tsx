import { CARD_DEFS, CARD_ORDER } from "../engine/cards";
import { WIZARD_APPRENTICE } from "../data/characters";
import type { SessionState } from "../engine/session";
import type { CardName } from "../engine/types";
import { Card } from "./Card";
import { Modal } from "./Modal";
import "./CardReferenceModal.css";

interface CardReferenceModalProps {
  onClose: () => void;
  session?: SessionState;
}

function currentDeckEntries(session?: SessionState): Array<{ name: CardName; count: number }> {
  const counts = {} as Partial<Record<CardName, number>>;
  for (const name of CARD_ORDER) counts[name] = CARD_DEFS[name].count;
  for (const name of session?.removedBaseCardNames ?? []) {
    counts[name] = Math.max(0, (counts[name] ?? 0) - 1);
  }
  for (const name of session?.extraDeckCardNames ?? []) {
    counts[name] = (counts[name] ?? 0) + 1;
  }
  for (const name of session?.activeOptionalRoundDeckCardNames ?? []) {
    counts[name] = (counts[name] ?? 0) + 1;
  }
  if (session?.activeOptionalRoundDeckCardNames.some((name) => name === "공주둘째" || name === "공주셋째")) {
    counts.공주 = Math.max(0, (counts.공주 ?? 0) - 1);
  }

  const extraNames = [
    ...(session?.extraDeckCardNames ?? []),
    ...(session?.activeOptionalRoundDeckCardNames ?? []),
  ].filter((name) => !CARD_ORDER.includes(name));
  const orderedNames = [...CARD_ORDER, ...Array.from(new Set(extraNames))];
  return orderedNames
    .map((name) => ({ name, count: counts[name] ?? 0 }))
    .filter((entry) => entry.count > 0);
}

export function CardReferenceModal({ onClose, session }: CardReferenceModalProps) {
  const upgrade = session?.round.activeCardUpgrades?.["마술사"];
  const upgradedAbility =
    upgrade === "tier2"
      ? WIZARD_APPRENTICE.tier2.abilityText
      : upgrade === "tier1"
        ? WIZARD_APPRENTICE.tier1.abilityText
        : null;

  const deckEntries = currentDeckEntries(session);

  return (
    <Modal title="이번 게임 카드 목록" onClose={onClose}>
      <div className="card-reference">
        {deckEntries.map(({ name, count }) => {
          const def = CARD_DEFS[name];
          const showUpgrade = name === "마술사" && upgradedAbility;
          return (
            <div key={name} className="card-reference__row">
              <Card name={name} size="sm" remainingCount={count} />
              <div className="card-reference__text">
                <p className="card-reference__title">
                  {def.rank}. {def.name} ({def.englishAlias}) · {count}장
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
