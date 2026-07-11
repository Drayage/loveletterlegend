import { useState } from "react";
import type { TrueEndingCard } from "../engine/endings";
import "./TrueEndingDraw.css";

interface TrueEndingDrawProps {
  /** 이미 섞인 5장 (engine/endings.ts's shuffleTrueEndingDeck). */
  deck: TrueEndingCard[];
  onResolved: (result: TrueEndingCard) => void;
}

/** 「역사 9 운명의 순간」(스토리북 21쪽): 성공/실패 카드를 섞어 뒷면으로
 * 늘어놓고 그중 한 장을 골라 뒤집는 미니게임. */
export function TrueEndingDraw({ deck, onResolved }: TrueEndingDrawProps) {
  const [pickedIndex, setPickedIndex] = useState<number | null>(null);

  function handlePick(i: number) {
    if (pickedIndex !== null) return;
    setPickedIndex(i);
  }

  const picked = pickedIndex !== null ? deck[pickedIndex] : null;

  return (
    <div className="true-ending-draw">
      <div className="true-ending-draw__frame">
        <h2 className="true-ending-draw__title">운명의 순간</h2>
        <p className="true-ending-draw__prompt">
          {picked === null
            ? "카드 한 장을 골라 뒤집으세요."
            : picked === "성공"
              ? "카드가 빛을 냅니다 -- 성공입니다!"
              : "아쉽지만, 이번에는 아닌 것 같습니다."}
        </p>
        <div className="true-ending-draw__cards">
          {deck.map((card, i) => {
            const revealed = pickedIndex !== null;
            const isPicked = pickedIndex === i;
            return (
              <button
                key={i}
                type="button"
                className={`true-ending-draw__card${isPicked ? " true-ending-draw__card--picked" : ""}${
                  revealed && !isPicked ? " true-ending-draw__card--dim" : ""
                }`}
                onClick={() => handlePick(i)}
                disabled={revealed}
                aria-label={isPicked ? `카드 ${i + 1}: ${card}` : `카드 ${i + 1}`}
              >
                {isPicked ? (card === "성공" ? "★" : "☆") : ""}
              </button>
            );
          })}
        </div>
        {picked !== null && (
          <button type="button" className="true-ending-draw__next-btn" onClick={() => onResolved(picked)}>
            다음 &gt;
          </button>
        )}
      </div>
    </div>
  );
}
