import { ARCHIVE_CARD_SEEDS } from "../data/scenario";
import { Modal } from "./Modal";
import "./IdentityChoiceModal.css";

interface IdentityChoiceModalProps {
  options: string[];
  onChoose: (identityId: string) => void;
}

/** 032 「역사 4」의 "중요" tag: 탈락했지만 아직 「정체」가 없는 플레이어가
 * 남은 풀에서 하나를 영구히 고른다. 이후 세션 내내 유지되며 다시 고를 수
 * 없다 (dismissible={false}). */
export function IdentityChoiceModal({ options, onChoose }: IdentityChoiceModalProps) {
  return (
    <Modal title="정체 카드 선택" onClose={() => {}} dismissible={false}>
      <div className="identity-choice">
        <p className="identity-choice__prompt">
          이번 라운드에 탈락했습니다. 아직 「정체」 카드가 없다면, 남은 카드 중 하나를 골라 영구히 갖습니다.
        </p>
        <div className="identity-choice__cards">
          {options.map((id) => {
            const seed = ARCHIVE_CARD_SEEDS[id];
            return (
              <button
                key={id}
                type="button"
                className="identity-choice__card"
                onClick={() => onChoose(id)}
              >
                {seed.art && <img className="identity-choice__portrait" src={seed.art} alt={seed.name} />}
                <span className="identity-choice__name">{seed.name}</span>
              </button>
            );
          })}
        </div>
      </div>
    </Modal>
  );
}
