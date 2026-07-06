import type { CharacterSlotId, SessionState } from "../engine/session";
import { ENDING_FLAVOR } from "../data/scenario";
import type { PlayerConfig } from "../engine/types";
import "./SessionEndScreen.css";

interface SessionEndScreenProps {
  session: SessionState;
  players: PlayerConfig[];
  onNewGame: () => void;
}

const SLOT_DISPLAY_NAME: Record<CharacterSlotId, string> = {
  잉그리드공주: "잉그리드 공주",
  아레스왕자: "아레스 왕자",
  경비병알리오스: "경비병 알리오스",
  신병아니스: "신병 아니스",
  마을소녀미란다: "간판 점원 미란다",
  시종트래비스: "시종 트래비스",
  시녀메이블: "시녀 메이블",
  광대제자리카드: "광대의 제자 리카드",
  광대제자피오: "광대의 제자 피오",
  점술사그리셀다: "점술사 그리셀다",
  배우파비오: "배우 파비오",
  무희미나: "무희 미나",
  기사라이언: "기사 라이언",
  여기사캐리: "여기사 캐리",
  여상인수잔나: "여상인 수잔나",
  승려올리비아: "승려 올리비아",
  수사알베르트: "수사 알베르트",
  수녀로베리아: "수녀 로베리아",
  집사세바스티안: "집사 세바스티안",
  마술사의도제: "마술사의 도제 지나",
  마녀베아트릭스: "마녀 베아트릭스",
  대마도사15알비스: "대마도사 알비스(15세)",
  대마도사20알비스: "대마도사 알비스(20세)",
  여장군아즈사: "여장군 아즈사",
  군사시어도어: "군사 시어도어",
  정무관오즈릭: "정무관 오즈릭",
  정무관오즈리나: "정무관 오즈리나",
  여후작엘마: "여후작 엘마",
  백작부인카밀라: "백작부인 카밀라",
  귀족영애아나스타샤: "공작의 영애 아나스타샤",
};

export function SessionEndScreen({ session, players, onNewGame }: SessionEndScreenProps) {
  const endings = session.playerEndings ?? {};

  return (
    <div className="session-end">
      <h2 className="session-end__title">
        {session.endingReason === "roundCap" ? "8라운드 종료" : "이야기가 조기 종료되었습니다"}
      </h2>

      <div className="session-end__players">
        {players.map((p) => {
          const slot = endings[p.id];
          return (
            <div key={p.id} className="session-end__player">
              <span className="session-end__player-name">{p.displayName}</span>
              <span className="session-end__player-result">
                {slot ? `${SLOT_DISPLAY_NAME[slot]}와(과) 맺어졌습니다.` : "이루어진 상대가 없습니다."}
              </span>
            </div>
          );
        })}
      </div>

      {session.overallWinnerPlayerId ? (
        <p className="session-end__overall">
          종합 승리:{" "}
          {players.find((p) => p.id === session.overallWinnerPlayerId)?.displayName ?? session.overallWinnerPlayerId}
        </p>
      ) : (
        <p className="session-end__overall session-end__overall--none">이번 게임엔 종합 승자가 없습니다.</p>
      )}

      <p className="session-end__flavor">{ENDING_FLAVOR.text}</p>

      <button type="button" className="primary-btn" onClick={onNewGame}>
        새 게임
      </button>
    </div>
  );
}
