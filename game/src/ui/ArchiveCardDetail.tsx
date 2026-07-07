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
  "190": "루나공주",
  "193": "마가렛공주",
  "056": "경비병알리오스",
  "061": "신병아니스",
  "029": "마을소녀미란다",
  "070": "시종트래비스",
  "078": "시녀메이블",
  "084": "광대제자리카드",
  "087": "광대제자피오",
  "092": "점술사그리셀다",
  "097": "배우파비오",
  "101": "무희미나",
  "107": "기사라이언",
  "111": "여기사캐리",
  "118": "여상인수잔나",
  "121": "승려올리비아",
  "127": "수사알베르트",
  "135": "수녀로베리아",
  "141": "집사세바스티안",
  "147": "마술사의도제",
  "152": "마녀베아트릭스",
  "158": "대마도사15알비스",
  "161": "대마도사20알비스",
  "167": "여장군아즈사",
  "171": "군사시어도어",
  "177": "정무관오즈릭",
  "181": "정무관오즈리나",
  "186": "여후작엘마",
  "199": "백작부인카밀라",
  "203": "귀족영애아나스타샤",
};

const CHARACTER_LETTER_RULES: Partial<Record<CharacterSlotId, string[]>> = {
  잉그리드공주: ["라운드 승리: 공개된 공주/왕자 중 선택해 +1", "《공주》를 들고 승리: 추가 +1"],
  아레스왕자: ["라운드 승리: 공개된 공주/왕자 중 선택해 +1", "《왕자》를 들고 승리: 추가 +1"],
  루나공주: ["라운드 승리: 공개된 공주/왕자 중 선택해 +1", "《공주(둘째)》를 들고 승리: 추가 +1"],
  마가렛공주: ["라운드 승리: 공개된 공주/왕자 중 선택해 +1", "《공주(셋째)》를 들고 승리: 추가 +1"],
  경비병알리오스: ["경비병을 들고 라운드 승리: +2", "경비병 추측 적중으로 탈락시킴: +1"],
  신병아니스: ["신병을 들고 라운드 승리: +3", "신병 숫자 추측 적중으로 탈락시킴: +2"],
  마을소녀미란다: ["마을소녀를 들고 라운드 승리: +1"],
  시종트래비스: ["시종이 버림 더미에 놓인 채로 라운드 승리: +2"],
  시녀메이블: ["시녀가 버림 더미에 놓인 채로 라운드 승리: +2"],
  광대제자리카드: ["광대의 제자(남)를 들거나 버린 채 라운드 승리: +2"],
  광대제자피오: ["광대의 제자(여)를 들거나 버린 채 라운드 승리: +2"],
  점술사그리셀다: ["점술사를 들거나 버린 채 라운드 승리: +2"],
  배우파비오: ["배우를 들고 라운드 승리: +2"],
  무희미나: ["무희를 들고 라운드 승리: +2"],
  기사라이언: ["기사를 들고 라운드 승리: +2", "기사 비교로 상대를 탈락시킴: +2"],
  여기사캐리: ["여기사를 들고 라운드 승리: +2", "여기사 비교로 상대를 탈락시킴: +2"],
  여상인수잔나: ["상인을 들고 라운드 승리: +2", "상인으로 상대를 탈락시킴: +1"],
  승려올리비아: ["승려를 들고 라운드 승리: +2", "승려를 버린 채 라운드 승리: +1"],
  수사알베르트: ["수사를 들거나 버린 채 라운드 승리: +2"],
  수녀로베리아: ["수녀를 들거나 버린 채 라운드 승리: +2"],
  집사세바스티안: ["집사를 들거나 버린 채 라운드 승리: +2"],
  마술사의도제: ["마술사를 들거나 버린 채 라운드 승리: +2", "마술사로 5 이상 카드를 버리게 함: +1"],
  마녀베아트릭스: ["마녀를 들거나 버린 채 라운드 승리: +2", "마녀를 플레이: +1"],
  대마도사15알비스: ["대마도사(15세)를 들거나 버린 채 라운드 승리: +2", "대마도사(15세)를 플레이: +1"],
  대마도사20알비스: ["대마도사(20세)를 들거나 버린 채 라운드 승리: +2", "대마도사(20세)를 플레이: +1"],
  여장군아즈사: ["여장군을 들고 라운드 승리: +3"],
  군사시어도어: ["군사를 들거나 버린 채 라운드 승리: +2"],
  정무관오즈릭: ["정무관(남자)을 들거나 버린 채 라운드 승리: +2"],
  정무관오즈리나: ["정무관(여자)로 탈락: +1", "승리하지 않고 라운드 종료: +2"],
  여후작엘마: ["여후작을 들거나 버린 채 라운드 승리: +3"],
  백작부인카밀라: ["백작부인을 들고 라운드 승리: +4"],
  귀족영애아나스타샤: ["귀족영애를 들고 라운드 승리: +4"],
};

function deckEffectText(effect?: DeckEffect): string | null {
  if (!effect) return null;
  if (effect.kind === "add") return `등장: 다음 라운드부터 덱에 「${effect.cardName}」을(를) 추가합니다.`;
  if (effect.kind === "optionalRound") {
    return `등장: 매 라운드 시작시 「${effect.cardName}」을(를) 이번 라운드 덱에 넣을지 선택할 수 있습니다.`;
  }
  if (effect.kind === "replace") {
    const count = effect.count && effect.count > 1 ? ` ${effect.count}장` : "";
    return `등장: 다음 라운드부터 「${effect.removeName}」을(를) 빼고 「${effect.addName}」${count}을(를) 덱에 넣습니다.`;
  }
  if (effect.kind === "batch") {
    const removed = (effect.remove ?? []).map((r) => `「${r.cardName}」${r.count && r.count > 1 ? ` ${r.count}장` : ""}`).join(", ");
    const added = (effect.add ?? []).map((a) => `「${a.cardName}」${a.count && a.count > 1 ? ` ${a.count}장` : ""}`).join(", ");
    return `등장: 다음 라운드부터 ${removed || "카드 변화 없음"}을(를) 빼고 ${added || "추가 카드 없음"}을(를) 덱에 넣습니다.`;
  }
  return `등장: 다음 라운드부터 「${effect.removedName}」을(를) 빼고 「${effect.restoreName}」을(를) 원래 덱으로 되돌립니다.`;
}

const CHARACTER_ACHIEVEMENTS: Partial<
  Record<CharacterSlotId, Array<{ threshold: number; label: string; cardName?: string }>>
> = {
  잉그리드공주: [{ threshold: 10, label: "게임 종료, [051] 공개" }],
  아레스왕자: [{ threshold: 10, label: "게임 종료, [051] 공개" }],
  루나공주: [{ threshold: 10, label: "게임 종료, [051] 공개" }],
  마가렛공주: [{ threshold: 10, label: "게임 종료, [051] 공개" }],
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
  경비병알리오스: [{ threshold: 3, cardName: "경비병", label: "한 번에 서로 다른 숫자 2개를 추측" }],
  마을소녀미란다: [{ threshold: 3, cardName: "마을소녀", label: "라운드 종료 숫자가 9로 변경" }],
  배우파비오: [{ threshold: 3, cardName: "배우", label: "라운드 종료 숫자가 2로 변경" }],
  무희미나: [{ threshold: 3, cardName: "무희", label: "라운드 종료 숫자가 7로 변경" }],
  여상인수잔나: [{ threshold: 3, cardName: "상인", label: "비교 대상 카드가 5 이하이면 탈락" }],
  수사알베르트: [{ threshold: 2, cardName: "수사", label: "수사 공개 시 승려 1장을 수사 1장으로 교체" }],
  수녀로베리아: [{ threshold: 3, cardName: "수녀", label: "사용 후 다음 자기 차례까지 보호" }],
  마녀베아트릭스: [{ threshold: 3, cardName: "마녀", label: "분배 결과를 자신에게 유리하게 정함" }],
  대마도사20알비스: [{ threshold: 3, cardName: "대마도사(20세)", label: "받게 하는 「쥐」가 손에 든 즉시 탈락하는 패시브 카드로 변경" }],
  정무관오즈릭: [{ threshold: 3, cardName: "정무관(남자)", label: "상대를 지목해 탈락시킬 수 있음" }],
  정무관오즈리나: [{ threshold: 3, cardName: "정무관(여자)", label: "다른 플레이어가 가능한 한 이 플레이어를 대상으로 선택" }],
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
                        편지 {achievement.threshold}개 이상일 시:{" "}
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
