import { CARD_DEFS } from "../engine/cards";
import type { CardName } from "../engine/types";
import "./Card.css";

interface CardProps {
  name: CardName;
  faceDown?: boolean;
  size?: "sm" | "md" | "lg";
  selected?: boolean;
  disabled?: boolean;
  onClick?: () => void;
}

export function Card({ name, faceDown, size = "md", selected, disabled, onClick }: CardProps) {
  if (faceDown) {
    return <div className={`card card--${size} card--back`} aria-label="뒷면 카드" />;
  }
  const def = CARD_DEFS[name];
  const clickable = Boolean(onClick) && !disabled;
  return (
    <button
      type="button"
      className={[
        "card",
        `card--${size}`,
        selected ? "card--selected" : "",
        disabled ? "card--disabled" : "",
        clickable ? "card--clickable" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      onClick={onClick}
      disabled={!clickable}
    >
      <div className="card__rank">{def.rank}</div>
      <div className="card__name">{def.name}</div>
      <div className="card__alias">{def.englishAlias}</div>
      {size !== "sm" && <div className="card__ability">{def.ability}</div>}
    </button>
  );
}
