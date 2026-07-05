import { useEffect, useState } from "react";
import type { CardName } from "../engine/types";
import { Card } from "./Card";
import { Modal } from "./Modal";
import "./GuessEffectModal.css";

interface GuessEffectModalProps {
  effect: { id: string; cardName: CardName; guess: CardName; hit: boolean } | null;
  actingDisplayName: string;
  targetDisplayName: string;
  onDismiss: () => void;
}

/** Public effect popup for 경비병/신병's guess resolution -- both players see
 * this (unlike the acting-player-only EffectRevealModal), since a guess and
 * whether it landed are always public in the physical game. The target's
 * card stays face down while the guess is read out, then flips face-up only
 * on a hit (a miss never reveals what the card actually was). */
export function GuessEffectModal({ effect, actingDisplayName, targetDisplayName, onDismiss }: GuessEffectModalProps) {
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    setRevealed(false);
    if (!effect || !effect.hit) return;
    const timer = setTimeout(() => setRevealed(true), 700);
    return () => clearTimeout(timer);
  }, [effect?.id, effect?.hit]);

  if (!effect) return null;

  return (
    <Modal title={`「${effect.cardName}」 효과`} onClose={onDismiss} dismissible={false}>
      <div className="guess-effect">
        <p className="guess-effect__prompt">
          {actingDisplayName}이(가) {targetDisplayName}을(를) 지목하고 「{effect.guess}」(이)라고 추측합니다.
        </p>
        <div key={revealed ? "front" : "back"} className="guess-effect__card-wrap">
          <Card name={effect.guess} faceDown={!revealed} size="lg" />
        </div>
        <p
          className={
            effect.hit
              ? "guess-effect__result guess-effect__result--hit"
              : "guess-effect__result guess-effect__result--miss"
          }
        >
          {effect.hit ? `적중! ${targetDisplayName} 탈락` : "빗나감, 아무 일도 일어나지 않습니다."}
        </p>
        <button type="button" className="guess-effect__confirm-btn" onClick={onDismiss}>
          확인
        </button>
      </div>
    </Modal>
  );
}
