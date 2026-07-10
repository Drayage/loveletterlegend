import { useEffect, useRef, useState } from "react";
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
  /** How many copies of this card name are still unaccounted-for (not yet
   * discarded or publicly removed). Defaults to the full deck count, i.e.
   * "none used up yet", when the caller doesn't track this. */
  remainingCount?: number;
  /** Small marker for session-driven ability upgrades currently active --
   * short tier label ("효과 변경 1단계"), used as a fallback badge title
   * when upgradeAbilityText isn't available for this card. */
  upgradeBadge?: string;
  /** What the upgrade ACTUALLY changed, in the card's own wording -- shown
   * in the badge tooltip and replaces the base ability text in the overlay/
   * tap-popup, so the badge means something more than "something changed"
   * (see engine/upgrades.ts's UPGRADE_ABILITY_TEXT). */
  upgradeAbilityText?: string;
}

export function Card({
  name,
  faceDown,
  size = "md",
  selected,
  disabled,
  onClick,
  remainingCount,
  upgradeBadge,
  upgradeAbilityText,
}: CardProps) {
  // Explicit tap-to-toggle state, used as the primary interaction on touch
  // devices (which have no hover). Desktop mouse users get the ability text
  // via pure CSS :hover instead (see Card.css) so this state normally stays
  // untouched there.
  const [showAbility, setShowAbility] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showAbility) return;
    function handlePointerDown(e: PointerEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setShowAbility(false);
      }
    }
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [showAbility]);

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
      ref={rootRef}
      className={[
        "card",
        `card--${size}`,
        selected ? "card--selected" : "",
        disabled ? "card--disabled" : "",
        clickable ? "card--clickable" : "",
        showAbility ? "card--ability-open" : "",
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
      {upgradeBadge && (
        <span
          className="card__upgrade-badge"
          title={upgradeAbilityText ? `${upgradeBadge}: ${upgradeAbilityText}` : upgradeBadge}
          aria-label={upgradeAbilityText ? `${upgradeBadge}: ${upgradeAbilityText}` : upgradeBadge}
        >
          ●
        </span>
      )}
      {/* 「왕」의 실카드 숫자는 "X" (순위 비교에 참여하지 않음) */}
      <span className="card__rank-badge">{name === "왕" ? "X" : def.rank}</span>
      {def.count > 1 && (
        <span
          className="card__count-badge"
          aria-label={`총 ${def.count}장 중 ${remainingCount ?? def.count}장 남음`}
        >
          {Array.from({ length: def.count }, (_, i) => (
            <span
              key={i}
              className={
                i < (remainingCount ?? def.count) ? "diamond diamond--active" : "diamond diamond--used"
              }
            >
              ◆
            </span>
          ))}
        </span>
      )}
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

      {size !== "sm" && (
        <span className="card__ability-overlay">
          {upgradeAbilityText ?? def.shortAbility}
          {upgradeAbilityText && <span className="card__ability-overlay-upgraded-tag">효과 변경됨</span>}
        </span>
      )}
    </div>
  );
}
