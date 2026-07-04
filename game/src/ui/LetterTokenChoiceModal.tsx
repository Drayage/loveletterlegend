import { useState } from "react";
import type { CharacterSlotId, LetterChoice } from "../engine/session";
import { RANK8_SLOTS } from "../engine/session";
import { ROUTE_DEFS } from "../data/routes";
import { WIZARD_APPRENTICE } from "../data/characters";
import { Modal } from "./Modal";
import "./LetterTokenChoiceModal.css";

const SLOT_INFO: Record<CharacterSlotId, { name: string; art?: string }> = {
  잉그리드공주: { name: ROUTE_DEFS.공주.displayName, art: ROUTE_DEFS.공주.art },
  아레스왕자: { name: ROUTE_DEFS.왕자.displayName, art: ROUTE_DEFS.왕자.art },
  마술사의도제: { name: WIZARD_APPRENTICE.name },
};

interface LetterTokenChoiceModalProps {
  amount: number;
  atCap: boolean;
  tokens: Record<CharacterSlotId, number>;
  onChoose: (choice: LetterChoice) => void;
}

/** Card 017's round-win [편지] award: the winner picks which revealed
 * 공주/왕자 to place it on (independent of the shared route). Once their
 * 10-token pool is full, placement is replaced by an optional move between
 * whichever slots already hold tokens. */
export function LetterTokenChoiceModal({ amount, atCap, tokens, onChoose }: LetterTokenChoiceModalProps) {
  const [moveFrom, setMoveFrom] = useState<CharacterSlotId | null>(null);
  const allSlots = Object.keys(SLOT_INFO) as CharacterSlotId[];

  if (!atCap) {
    return (
      <Modal title="라운드 승리!" onClose={() => {}} dismissible={false}>
        <div className="letter-token-choice">
          <p className="letter-token-choice__prompt">편지 토큰 {amount}개를 어느 캐릭터에 놓으시겠습니까?</p>
          <div className="letter-token-choice__options">
            {RANK8_SLOTS.map((slot) => (
              <button
                key={slot}
                type="button"
                className="letter-token-choice__card"
                onClick={() => onChoose({ type: "place", slot })}
              >
                {SLOT_INFO[slot].art && <img src={SLOT_INFO[slot].art} alt={SLOT_INFO[slot].name} />}
                <span>{SLOT_INFO[slot].name}</span>
              </button>
            ))}
          </div>
        </div>
      </Modal>
    );
  }

  const moveSources = allSlots.filter((slot) => (tokens[slot] ?? 0) > 0);

  return (
    <Modal title="편지 토큰(10개)을 모두 사용했습니다" onClose={() => {}} dismissible={false}>
      <div className="letter-token-choice">
        <p className="letter-token-choice__prompt">
          {moveFrom
            ? `${SLOT_INFO[moveFrom].name}의 토큰을 어디로 옮기시겠습니까?`
            : "다른 캐릭터로 토큰을 옮기시겠습니까? (옮기지 않아도 됩니다)"}
        </p>
        <div className="letter-token-choice__standings">
          {allSlots.map((slot) => (
            <span key={slot} className="letter-token-choice__standing">
              {SLOT_INFO[slot].name} {tokens[slot] ?? 0}개
            </span>
          ))}
        </div>
        {!moveFrom && (
          <div className="letter-token-choice__options">
            {moveSources.map((slot) => (
              <button key={slot} type="button" className="letter-token-choice__card" onClick={() => setMoveFrom(slot)}>
                {SLOT_INFO[slot].art && <img src={SLOT_INFO[slot].art} alt={SLOT_INFO[slot].name} />}
                <span>{SLOT_INFO[slot].name}에서 옮기기</span>
              </button>
            ))}
          </div>
        )}
        {moveFrom && (
          <div className="letter-token-choice__options">
            {allSlots
              .filter((slot) => slot !== moveFrom)
              .map((slot) => (
                <button
                  key={slot}
                  type="button"
                  className="letter-token-choice__card"
                  onClick={() => onChoose({ type: "move", from: moveFrom, to: slot })}
                >
                  {SLOT_INFO[slot].art && <img src={SLOT_INFO[slot].art} alt={SLOT_INFO[slot].name} />}
                  <span>{SLOT_INFO[slot].name}(으)로</span>
                </button>
              ))}
            <button type="button" className="letter-token-choice__skip" onClick={() => setMoveFrom(null)}>
              취소
            </button>
          </div>
        )}
        <button type="button" className="letter-token-choice__skip" onClick={() => onChoose({ type: "decline" })}>
          옮기지 않기
        </button>
      </div>
    </Modal>
  );
}
