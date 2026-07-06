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
  기사라이언: "기사 라이언",
  승려올리비아: "승려 올리비아",
  마술사의도제: "마술사의 도제 지나",
  여장군아즈사: "여장군 아즈사",
  군사시어도어: "군사 시어도어",
  여후작엘마: "여후작 엘마",
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
