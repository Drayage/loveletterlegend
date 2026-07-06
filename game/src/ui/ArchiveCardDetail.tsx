import type { CharacterSlotId, SessionState } from "../engine/session";
import type { ArchiveCardState, ArchiveCondition, DeckEffect, PlayerConfig } from "../engine/types";
import { WIZARD_APPRENTICE } from "../data/characters";
import { ARCHIVE_CARD_SEEDS } from "../data/scenario";
import "./ArchiveCardDetail.css";

type SharedTokenCondition = Extract<ArchiveCondition, { kind: "sharedToken" }>;
function isSharedToken(c: ArchiveCondition): c is SharedTokenCondition {
  return c.kind === "sharedToken";
}

/** earnRules entries end with a "...: 성공" / "...: 실패" suffix marking
 * which shared token they contribute to -- split it off so it can be
 * grouped under the matching condition instead of shown as a flat list. */
function splitEarnRule(rule: string): { text: string; token: "성공" | "실패" } | null {
  const match = rule.match(/^(.*):\s*(성공|실패)$/);
  if (!match) return null;
  return { text: match[1], token: match[2] as "성공" | "실패" };
}

const CHARACTER_CARD_TO_SLOT: Partial<Record<string, CharacterSlotId>> = {
  "018": "잉그리드공주",
  "020": "아레스왕자",
  "056": "경비병알리오스",
  "061": "신병아니스",
  "107": "기사라이언",
  "121": "승려올리비아",
  "147": "마술사의도제",
  "167": "여장군아즈사",
  "171": "군사시어도어",
  "186": "여후작엘마",
  "199": "백작부인카밀라",
  "203": "귀족영애아나스타샤",
};

const CHARACTER_LETTER_RULES: Partial<Record<CharacterSlotId, string[]>> = {
  잉그리드공주: ["라운드 승리: 공개된 공주/왕자 중 선택해 +1", "《공주》를 들고 승리: 추가 +1"],
  아레스왕자: ["라운드 승리: 공개된 공주/왕자 중 선택해 +1", "《왕자》를 들고 승리: 추가 +1"],
  경비병알리오스: ["경비병을 들고 라운드 승리: +2", "경비병 추측 적중으로 탈락시킴: +1"],
  신병아니스: ["신병을 들고 라운드 승리: +3", "신병 홀짝 추측 적중으로 탈락시킴: +2"],
  기사라이언: ["기사를 들고 라운드 승리: +2", "기사 비교로 상대를 탈락시킴: +2"],
  승려올리비아: ["승려를 들고 라운드 승리: +2", "승려를 버린 채 라운드 승리: +1"],
  마술사의도제: ["마술사를 들거나 버린 채 라운드 승리: +2", "마술사로 5 이상 카드를 버리게 함: +1"],
  여장군아즈사: ["여장군을 들고 라운드 승리: +3"],
  군사시어도어: ["군사를 들거나 버린 채 라운드 승리: +2"],
  여후작엘마: ["여후작을 들거나 버린 채 라운드 승리: +3"],
  백작부인카밀라: ["백작부인을 들고 라운드 승리: +4"],
  귀족영애아나스타샤: ["귀족영애를 들고 라운드 승리: +4"],
};

function deckEffectText(effect?: DeckEffect): string | null {
  if (!effect) return null;
  if (effect.kind === "add") return `등장: 다음 라운드부터 덱에 「${effect.cardName}」을(를) 추가합니다.`;
  if (effect.kind === "replace") {
    const count = effect.count && effect.count > 1 ? ` ${effect.count}장` : "";
    return `등장: 다음 라운드부터 「${effect.removeName}」을(를) 빼고 「${effect.addName}」${count}을(를) 덱에 넣습니다.`;
  }
  return `등장: 다음 라운드부터 「${effect.removedName}」을(를) 빼고 「${effect.restoreName}」을(를) 원래 덱으로 되돌립니다.`;
}

function passiveEventText(card: ArchiveCardState, hasVisibleMechanics: boolean): string | null {
  if (hasVisibleMechanics) return null;
  if (card.category === "character") {
    return "공개 이벤트: 새 캐릭터가 이야기 보관소에 기록됩니다. 현재 즉시 적용되는 덱/토큰 규칙 변화는 없습니다.";
  }
  if (card.category === "identity") {
    return "공개 이벤트: 정체 후보가 기록됩니다. 탈락한 플레이어가 정체를 고르는 단계에서 사용됩니다.";
  }
  return "공개 이벤트: 새 이야기가 보관소에 기록됩니다. 현재 즉시 적용되는 덱/토큰 규칙 변화는 없습니다.";
}

const CHARACTER_ACHIEVEMENTS: Partial<
  Record<CharacterSlotId, Array<{ threshold: number; label: string; cardName?: string }>>
> = {
  잉그리드공주: [{ threshold: 10, label: "게임 종료, [051] 공개" }],
  아레스왕자: [{ threshold: 10, label: "게임 종료, [051] 공개" }],
  마술사의도제: [
    {
      threshold: WIZARD_APPRENTICE.tier1.threshold,
      cardName: "마술사",
      label: WIZARD_APPRENTICE.tier1.abilityText,
    },
    {
      threshold: WIZARD_APPRENTICE.tier2.threshold,
      cardName: "마술사",
      label: WIZARD_APPRENTICE.tier2.abilityText,
    },
  ],
};

/** `clockTokens` (the session's elapsed [시계]) enables the "남은 시간 (N주)"
 * countdown on expiring cards -- omitted by callers that don't have the
 * session at hand, in which case the badge is simply not shown.
 * `inactive` marks a card that's no longer in the live story archive
 * (consumed by a fired condition, a resolved 선택, or expiry) -- still
 * shown for history's sake (see SessionState.archiveHistory), just
 * badged so it reads as "done" rather than "currently pending". */
export function ArchiveCardDetail({
  card,
  clockTokens,
  inactive,
  playerConfigs,
  humanId,
  letterTokens,
}: {
  card: ArchiveCardState;
  clockTokens?: number;
  inactive?: boolean;
  playerConfigs?: PlayerConfig[];
  humanId?: string;
  letterTokens?: SessionState["letterTokens"];
}) {
  const earnRules = ARCHIVE_CARD_SEEDS[card.id]?.earnRules ?? [];
  const deckEffect = deckEffectText(ARCHIVE_CARD_SEEDS[card.id]?.deckEffect);
  const parsedRules = earnRules.map(splitEarnRule).filter((r): r is NonNullable<typeof r> => r !== null);
  const standaloneRules = earnRules.filter((rule) => !splitEarnRule(rule));
  const weeksLeft =
    card.expiresAtClock != null && clockTokens != null ? Math.max(0, card.expiresAtClock - clockTokens) : null;
  // Already-fired conditions drop off the checklist entirely (rather than a
  // struck-through row) -- what's left always reads as "still to do".
  const openConditions = card.conditions.filter((c) => !c.fired);
  const characterSlot = CHARACTER_CARD_TO_SLOT[card.id];
  const characterLetterTokens = characterSlot && letterTokens ? letterTokens[characterSlot] : null;
  const letterRules = characterSlot ? CHARACTER_LETTER_RULES[characterSlot] ?? [] : [];
  const achievements = characterSlot ? CHARACTER_ACHIEVEMENTS[characterSlot] ?? [] : [];
  const hasCharacterMechanics = Boolean(
    characterSlot && (letterRules.length > 0 || achievements.length > 0 || characterLetterTokens)
  );
  const passiveEvent = passiveEventText(
    card,
    Boolean(deckEffect) || openConditions.length > 0 || earnRules.length > 0 || hasCharacterMechanics
  );
  const characterProgress =
    characterSlot ? (
      <div className="archive-card-detail__character">
        {characterLetterTokens && playerConfigs && (
          <div className="archive-card-detail__letters">
            {playerConfigs.map((cfg) => (
              <span key={cfg.id} className={cfg.id === humanId ? "archive-card-detail__letter-me" : ""}>
                {cfg.id === humanId ? "나" : cfg.displayName} {characterLetterTokens[cfg.id] ?? 0}
              </span>
            ))}
          </div>
        )}
        {letterRules.length > 0 && (
          <div className="archive-card-detail__character-section">
            <p className="archive-card-detail__checklist-title">편지 조건</p>
            <ul className="archive-card-detail__earn-rules archive-card-detail__earn-rules--character">
              {letterRules.map((rule) => (
                <li key={rule}>{rule}</li>
              ))}
            </ul>
          </div>
        )}
        {achievements.length > 0 && characterLetterTokens && playerConfigs && (
          <div className="archive-card-detail__character-section">
            <p className="archive-card-detail__checklist-title archive-card-detail__achievement-title">달성 조건</p>
            <ul className="archive-card-detail__conditions">
              {achievements.map((achievement) => {
                const mine = humanId ? characterLetterTokens[humanId] ?? 0 : 0;
                const active = mine >= achievement.threshold;
                return (
                  <li key={`${achievement.threshold}-${achievement.label}`}>
                    <span className="archive-card-detail__condition-row">
                      <span className="archive-card-detail__checkbox" aria-hidden="true">
                        {active ? "☑" : "☐"}
                      </span>
                      <span className="archive-card-detail__condition-label">
                        편지 {achievement.threshold}개 이상:{" "}
                        {achievement.cardName ? `「${achievement.cardName}」 ` : ""}
                        {achievement.label}
                        <span className="archive-card-detail__condition-progress">
                          {" "}
                          — 현재 {Math.min(mine, achievement.threshold)} / {achievement.threshold}
                        </span>
                        {active && <span className="archive-card-detail__active-mark">발동중</span>}
                      </span>
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>
    ) : null;

  return (
    <div className="archive-card-detail">
      <div className="archive-card-detail__header">
        {card.art && (
          <img className="archive-card-detail__portrait" src={card.art} alt={card.name} />
        )}
        <div className="archive-card-detail__header-text">
          <p className="archive-card-detail__name">
            {card.name}
            {inactive && <span className="archive-card-detail__done">지난 이야기</span>}
            {!inactive && weeksLeft != null && (
              <span className="archive-card-detail__expiry">남은 시간 ({weeksLeft}주)</span>
            )}
          </p>
          {card.revealedFrom && (
            <p className="archive-card-detail__provenance">
              「{card.revealedFrom.sourceName}」의 「{card.revealedFrom.reason}」(으)로 공개됨
            </p>
          )}
          <p className="archive-card-detail__flavor">{card.flavor}</p>
          {deckEffect && <p className="archive-card-detail__deck-effect">{deckEffect}</p>}
          {standaloneRules.map((rule) => (
            <p key={rule} className="archive-card-detail__deck-effect">
              {rule}
            </p>
          ))}
          {passiveEvent && <p className="archive-card-detail__passive-event">{passiveEvent}</p>}
          {characterProgress}
        </div>
      </div>
      {openConditions.length > 0 && (
        <div className="archive-card-detail__checklist">
          {card.conditionsTitle && <p className="archive-card-detail__checklist-title">{card.conditionsTitle}</p>}
          <ul className="archive-card-detail__conditions">
            {openConditions.map((c) => {
              // sharedToken rows get a live progress readout + the earn
              // rules that feed that counter; other kinds are a plain
              // hypothesis row. Reveal targets are never shown.
              const shared = isSharedToken(c) ? c : null;
              const count = shared ? (shared.token === "성공" ? card.successTokens : card.failTokens) : 0;
              const rulesForToken = shared ? parsedRules.filter((r) => r.token === shared.token) : [];
              return (
                <li key={c.id}>
                  <span className="archive-card-detail__condition-row">
                    <span className="archive-card-detail__checkbox" aria-hidden="true">
                      ☐
                    </span>
                    <span className="archive-card-detail__condition-label">
                      {c.label}
                      {shared && (
                        <span className="archive-card-detail__condition-progress">
                          {" "}
                          — 현재 {Math.min(count, shared.threshold)} / {shared.threshold}
                        </span>
                      )}
                    </span>
                  </span>
                  {rulesForToken.length > 0 && (
                    <ul className="archive-card-detail__earn-rules">
                      {rulesForToken.map((r, i) => (
                        <li key={i}>{r.text}</li>
                      ))}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
