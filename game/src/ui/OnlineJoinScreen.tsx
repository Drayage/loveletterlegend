import { useState } from "react";
import type { OnlineRoom } from "../net/useOnlineRoom";
import "./SetupScreen.css";

interface OnlineJoinScreenProps {
  online: OnlineRoom;
  onBack: () => void;
}

/** 게스트용 참가 화면. 참가한 뒤에는 방장이 게임을 시작해 첫 상태를
 * 보내줄 때까지 기다린다 -- 게스트는 엔진을 돌리지 않으므로, 받은 상태가
 * 도착하는 순간 App이 곧바로 게임 화면으로 바뀐다. */
export function OnlineJoinScreen({ online, onBack }: OnlineJoinScreenProps) {
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const joined = online.role === "guest" && Boolean(online.roomCode);

  return (
    <div className="setup-screen">
      <h1 className="setup-screen__title">온라인 참가</h1>

      {joined ? (
        <section className="setup-screen__section">
          <p className="setup-screen__room-code">
            방 코드 <strong>{online.roomCode}</strong>
          </p>
          <p className="setup-screen__hint">
            {online.localPlayerId
              ? `${online.localPlayerId} 자리에 앉았습니다. 방장이 시작하기를 기다리는 중입니다.`
              : "자리를 배정받는 중입니다."}
          </p>
        </section>
      ) : (
        <section className="setup-screen__section">
          <p className="setup-screen__section-title">방 코드</p>
          <input
            className="setup-screen__input"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            maxLength={4}
            placeholder="ABCD"
            aria-label="방 코드"
          />
          <p className="setup-screen__section-title">표시 이름</p>
          <input
            className="setup-screen__input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={12}
            placeholder="이름"
            aria-label="표시 이름"
          />
          <p className="setup-screen__hint">
            카드 셔플과 판정은 방장 기기에서만 계산되고, 내 손패 외의 정보는 서버에서도 가려진 채로 전달됩니다.
          </p>
        </section>
      )}

      {online.error && <p className="setup-screen__hint">{online.error}</p>}

      <div className="setup-screen__actions">
        <button
          type="button"
          className="setup-screen__back-btn"
          onClick={() => {
            void online.leave();
            onBack();
          }}
        >
          뒤로
        </button>
        {!joined && (
          <button
            type="button"
            className="primary-btn"
            disabled={code.trim().length < 4 || online.status === "connecting"}
            onClick={() => void online.join(code, name.trim() || "게스트")}
          >
            {online.status === "connecting" ? "참가하는 중..." : "참가"}
          </button>
        )}
      </div>
    </div>
  );
}
