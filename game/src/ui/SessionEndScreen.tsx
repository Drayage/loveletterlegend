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
  마술사의도제: "마술사의 도제 지나",
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
