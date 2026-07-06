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
  경비병알리오스: { name: "경비병 알리오스" },
  신병아니스: { name: "신병 아니스" },
  마을소녀미란다: { name: "간판 점원 미란다" },
  시종트래비스: { name: "시종 트래비스" },
  시녀메이블: { name: "시녀 메이블" },
  광대제자리카드: { name: "광대의 제자 리카드" },
  광대제자피오: { name: "광대의 제자 피오" },
  점술사그리셀다: { name: "점술사 그리셀다" },
  배우파비오: { name: "배우 파비오" },
  무희미나: { name: "무희 미나" },
  기사라이언: { name: "기사 라이언" },
  여기사캐리: { name: "여기사 캐리" },
  여상인수잔나: { name: "여상인 수잔나" },
  승려올리비아: { name: "승려 올리비아" },
  수사알베르트: { name: "수사 알베르트" },
  수녀로베리아: { name: "수녀 로베리아" },
  집사세바스티안: { name: "집사 세바스티안" },
  마술사의도제: { name: WIZARD_APPRENTICE.name },
  마녀베아트릭스: { name: "마녀 베아트릭스" },
  대마도사15알비스: { name: "대마도사 알비스(15세)" },
  대마도사20알비스: { name: "대마도사 알비스(20세)" },
  여장군아즈사: { name: "여장군 아즈사" },
  군사시어도어: { name: "군사 시어도어" },
  정무관오즈릭: { name: "정무관 오즈릭" },
  정무관오즈리나: { name: "정무관 오즈리나" },
  여후작엘마: { name: "여후작 엘마" },
  백작부인카밀라: { name: "백작부인 카밀라" },
  귀족영애아나스타샤: { name: "공작의 영애 아나스타샤" },
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
