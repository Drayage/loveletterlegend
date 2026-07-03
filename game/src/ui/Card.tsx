import { useState } from "react";
import { CARD_DEFS } from "../engine/cards";
import { CARD_ART } from "./cardArt";
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
  const [showAbility, setShowAbility] = useState(false);

  if (faceDown) {
    return <div className={`card card--${size} card--back`} aria-label="뒷면 카드" />;
  }

  const def = CARD_DEFS[name];
  const clickable = Boolean(onClick) && !disabled;

  // Plain div (not <button>) so the ability-info toggle stays clickable even
  // when the card itself isn't playable right now -- a native disabled
  // <button> suppresses pointer events on all its descendants too.
  return (
    <div
      className={[
        "card",
        `card--${size}`,
        selected ? "card--selected" : "",
        disabled ? "card--disabled" : "",
        clickable ? "card--clickable" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      role={clickable ? "button" : undefined}
      tabIndex={clickable ? 0 : undefined}
      onClick={clickable ? onClick : undefined}
      onKeyDown={
        clickable
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") onClick?.();
            }
          : undefined
      }
    >
      <img className="card__art" src={CARD_ART[name]} alt={def.name} draggable={false} />
      <span className="card__rank-badge">{def.rank}</span>
      <span className="card__name-bar">{def.name}</span>

      {size !== "sm" && (
        <span
          className="card__info-btn"
          role="button"
          tabIndex={0}
          aria-label="능력 설명 보기"
          onClick={(e) => {
            e.stopPropagation();
            setShowAbility((v) => !v);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.stopPropagation();
              setShowAbility((v) => !v);
            }
          }}
        >
          ?
        </span>
      )}

      {showAbility && size !== "sm" && (
        <span className="card__ability-overlay">{def.ability}</span>
      )}
    </div>
  );
}
