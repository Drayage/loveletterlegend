import type { CharacterSlotId, SessionState } from "../engine/session";
import { ROUTE_DEFS } from "../data/routes";
import { WIZARD_APPRENTICE } from "../data/characters";
import princessSecond from "../assets/cards/extra/8. 공주(둘째).jpg";
import princessThird from "../assets/cards/extra/8. 공주(셋째).jpg";
import type { PlayerConfig } from "../engine/types";
import "./SessionHeader.css";

interface SessionHeaderProps {
  session: SessionState;
  humanId: string;
  onShowArchive: () => void;
  onShowFlowStatus: () => void;
}

const ALL_SLOTS: CharacterSlotId[] = [
  "잉그리드공주",
  "아레스왕자",
  "루나공주",
  "마가렛공주",
  "경비병알리오스",
  "신병아니스",
  "마을소녀미란다",
  "시종트래비스",
  "시녀메이블",
  "광대제자리카드",
  "광대제자피오",
  "점술사그리셀다",
  "배우파비오",
  "무희미나",
  "기사라이언",
  "여기사캐리",
  "여상인수잔나",
  "승려올리비아",
  "수사알베르트",
  "수녀로베리아",
  "집사세바스티안",
  "마술사의도제",
  "마녀베아트릭스",
  "대마도사15알비스",
  "대마도사20알비스",
  "여장군아즈사",
  "군사시어도어",
  "정무관오즈릭",
  "정무관오즈리나",
  "여후작엘마",
  "백작부인카밀라",
  "귀족영애아나스타샤",
];

const SLOT_INFO: Record<CharacterSlotId, { name: string; art?: string; quote?: string }> = {
  잉그리드공주: { name: ROUTE_DEFS.공주.displayName, art: ROUTE_DEFS.공주.art },
  아레스왕자: { name: ROUTE_DEFS.왕자.displayName, art: ROUTE_DEFS.왕자.art },
  루나공주: { name: "루나 공주", art: princessSecond },
  마가렛공주: { name: "마가렛 공주", art: princessThird },
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

const LETTER_RULES: Partial<Record<CharacterSlotId, string[]>> = {
  잉그리드공주: ["라운드 승리: 공개된 공주/왕자 중 선택해 +1", "《공주》를 들고 승리: 추가 +1"],
  아레스왕자: ["라운드 승리: 공개된 공주/왕자 중 선택해 +1", "《왕자》를 들고 승리: 추가 +1"],
  루나공주: ["라운드 승리: 공개된 공주/왕자 중 선택해 +1", "《공주(둘째)》를 들고 승리: 추가 +1"],
  마가렛공주: ["라운드 승리: 공개된 공주/왕자 중 선택해 +1", "《공주(셋째)》를 들고 승리: 추가 +1"],
  경비병알리오스: ["경비병을 들고 라운드 승리: +2", "경비병 추측 적중으로 탈락시킴: +1"],
  신병아니스: ["신병을 들고 라운드 승리: +3", "신병 숫자 추측 적중으로 탈락시킴: +2"],
  마을소녀미란다: ["마을소녀를 들고 라운드 승리: +1"],
  시종트래비스: ["시종이 버림 더미에 놓인 채 라운드 승리: +2"],
  시녀메이블: ["시녀가 버림 더미에 놓인 채 라운드 승리: +2"],
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

const EFFECT_RULES: Partial<Record<CharacterSlotId, Array<{ threshold: number; result: string; cardName?: string }>>> = {
  마술사의도제: [
    { threshold: WIZARD_APPRENTICE.tier1.threshold, result: WIZARD_APPRENTICE.tier1.abilityText, cardName: "마술사" },
    { threshold: WIZARD_APPRENTICE.tier2.threshold, result: WIZARD_APPRENTICE.tier2.abilityText, cardName: "마술사" },
  ],
};

/** A slot only shows up here once its character has actually been
 * introduced in the story archive -- 잉그리드공주/아레스왕자 are seeded
 * from session start (018/020), but 마술사의도제 has no reveal card in
 * this v1 slice yet, so she stays hidden (her [편지] still counts toward
 * the ending algorithm either way -- this is purely a display gate). */
const SLOT_REVEAL_CARD_ID: Record<CharacterSlotId, string> = {
  잉그리드공주: "018",
  아레스왕자: "020",
  루나공주: "190",
  마가렛공주: "193",
  경비병알리오스: "056",
  신병아니스: "061",
  마을소녀미란다: "029",
  시종트래비스: "070",
  시녀메이블: "078",
  광대제자리카드: "084",
  광대제자피오: "087",
  점술사그리셀다: "092",
  배우파비오: "097",
  무희미나: "101",
  기사라이언: "107",
  여기사캐리: "111",
  여상인수잔나: "118",
  승려올리비아: "121",
  수사알베르트: "127",
  수녀로베리아: "135",
  집사세바스티안: "141",
  마술사의도제: WIZARD_APPRENTICE.characterId,
  마녀베아트릭스: "152",
  대마도사15알비스: "158",
  대마도사20알비스: "161",
  여장군아즈사: "167",
  군사시어도어: "171",
  정무관오즈릭: "177",
  정무관오즈리나: "181",
  여후작엘마: "186",
  백작부인카밀라: "199",
  귀족영애아나스타샤: "203",
};

/** Stable per-player color, assigned by seat order -- used so every
 * character row can show each player's [편지] count in "their" color
 * instead of only surfacing the human's own pursued route. */
const PLAYER_COLORS = ["#4f8fef", "#ef6a6a", "#5fbf7a", "#c98fef"];

function SlotRow({
  slot,
  session,
  playerConfigs,
  humanId,
  letterTokens,
}: {
  slot: CharacterSlotId;
  session: SessionState;
  playerConfigs: PlayerConfig[];
  humanId: string;
  letterTokens: SessionState["letterTokens"];
}) {
  const info = SLOT_INFO[slot];
  const revealCard = session.archiveHistory[SLOT_REVEAL_CARD_ID[slot]];
  const art = info.art ?? revealCard?.art;
  const flavor = revealCard?.flavor ?? info.quote;
  const humanTokens = letterTokens[slot]?.[humanId] ?? 0;
  const effectRules = EFFECT_RULES[slot] ?? [];
  return (
    <details className="session-header__slot">
      <summary className="session-header__slot-front">
        {art && <img className="session-header__slot-art" src={art} alt={info.name} />}
        <span className="session-header__slot-main">
          <span className="session-header__value">{info.name}</span>
          {flavor && <span className="session-header__slot-quote">{flavor}</span>}
        </span>
        <div className="session-header__slot-counts">
          {playerConfigs.map((cfg, i) => (
            <span
              key={cfg.id}
              className="session-header__slot-count"
              style={{ color: PLAYER_COLORS[i % PLAYER_COLORS.length] }}
              title={cfg.id === humanId ? "나" : cfg.displayName}
            >
              {letterTokens[slot]?.[cfg.id] ?? 0}
            </span>
          ))}
        </div>
      </summary>
      <div className="session-header__slot-back">
        <p className="session-header__slot-subtitle">편지 획득 조건</p>
        <ul>
          {(LETTER_RULES[slot] ?? ["이 캐릭터가 공개된 뒤 관련 이벤트로 편지를 획득합니다."]).map((rule) => (
            <li key={rule}>{rule}</li>
          ))}
        </ul>
        {effectRules.length > 0 && (
          <>
            <p className="session-header__slot-subtitle">효과 변경</p>
            <ul>
              {effectRules.map((rule) => {
                const active = humanTokens >= rule.threshold;
                return (
                  <li key={rule.threshold} className={active ? "session-header__effect-rule--active" : ""}>
                    편지 {rule.threshold}개 이상일 시: {rule.cardName ? `「${rule.cardName}」 ` : ""}
                    {rule.result}
                    {active && <span className="session-header__active-mark">발동중</span>}
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </div>
    </details>
  );
}

export function SessionHeader({ session, humanId, onShowArchive, onShowFlowStatus }: SessionHeaderProps) {
  const revealedSlots = ALL_SLOTS.filter((slot) =>
    session.storyArchive.some((c) => c.id === SLOT_REVEAL_CARD_ID[slot])
  );

  return (
    <div className="session-header">
      {/* [시계] 1개 = 1주, 8주짜리 이야기 -- "라운드 N/8"과 "시계 N"이라는
       * 같은 축의 두 숫자 대신 주차 + 남은 시간 하나로 합쳐 보여준다. */}
      <div className="session-header__stat">
        <span className="session-header__label">{session.roundNumber}주차 / 8주</span>
        <span className="session-header__value">남은 시간 {Math.max(0, 8 - session.clockTokens)}주</span>
      </div>

      <div className="session-header__legend">
        {session.playerConfigs.map((cfg, i) => (
          <span key={cfg.id} className="session-header__legend-entry">
            <span
              className="session-header__legend-dot"
              style={{ background: PLAYER_COLORS[i % PLAYER_COLORS.length] }}
            />
            {cfg.id === humanId ? "나" : cfg.displayName}
          </span>
        ))}
      </div>

      <details className="session-header__characters">
        <summary className="session-header__characters-summary">
          캐릭터 <span>{revealedSlots.length}</span>
        </summary>
        <div className="session-header__slots">
          {revealedSlots.map((slot) => (
            <SlotRow
              key={slot}
              slot={slot}
              session={session}
              playerConfigs={session.playerConfigs}
              humanId={humanId}
              letterTokens={session.letterTokens}
            />
          ))}
        </div>
      </details>

      <button type="button" className="session-header__flow-btn" onClick={onShowFlowStatus}>
        진행 확인
      </button>

      <button type="button" className="session-header__archive-btn" onClick={onShowArchive}>
        이야기 보관소 보기
      </button>
    </div>
  );
}
