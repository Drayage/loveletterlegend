import { ARCHIVE_CARD_SEEDS } from "../data/scenario";
import { IDENTITY_VARIANTS, type IdentityVariantId } from "../data/identityVariants";
import { Modal } from "./Modal";
import "./IdentityChoiceModal.css";

interface IdentityChoiceModalProps {
  options: string[];
  onChoose: (identityId: string, variantId: IdentityVariantId) => void;
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
            const variants = IDENTITY_VARIANTS[id] ?? [];
            return (
              <div key={id} className="identity-choice__card">
                <span className="identity-choice__name">{seed.name}</span>
                <span className="identity-choice__ability">{seed.flavor}</span>
                <div className="identity-choice__variants">
                  {variants.map((variant) => (
                    <button
                      key={variant.id}
                      type="button"
                      className="identity-choice__variant"
                      onClick={() => onChoose(id, variant.id)}
                    >
                      <img className="identity-choice__portrait" src={variant.art} alt={variant.name} />
                      <span>{variant.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </Modal>
  );
}
