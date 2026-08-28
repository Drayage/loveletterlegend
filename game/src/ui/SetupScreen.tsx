import { useState } from "react";
import type { PlayerConfig } from "../engine/types";
import type { OnlineRoom } from "../net/useOnlineRoom";
import "./SetupScreen.css";

/** 사람(항상 1번 자리) 외 나머지 자리에 채울 수 있는 참가자 유형.
 * "online"은 Firebase 설정이 채워져 있을 때만 고를 수 있다 (설정이 비어
 * 있으면 예전처럼 "준비 중"으로 비활성화된다 -- net/firebaseConfig.ts). */
type SeatType = "ai" | "online";

interface SetupScreenProps {
  /** 로컬(단일 기기) 시작 -- 온라인 방에서는 방장이 누르는 시작이기도 하다. */
  onStart: (players: PlayerConfig[]) => void;
  onBack: () => void;
  /** 온라인 좌석이 있을 때 방을 만든다 (없으면 온라인 UI를 숨긴다). */
  online?: OnlineRoom;
  onHostRoom?: (players: PlayerConfig[]) => void;
}

const MAX_PLAYERS = 4;
const MIN_PLAYERS = 2;

/** 좌석 유형에서 엔진의 PlayerConfig를 만든다. 온라인 좌석은 사람이
 * 조작하므로 isAI가 false다 -- AI 자동 진행(flowDriver)이 건드리지 않는다. */
function playersFromSeats(playerCount: number, seatTypes: SeatType[]): PlayerConfig[] {
  const players: PlayerConfig[] = [{ id: "human", displayName: "나", isAI: false }];
  let aiIndex = 0;
  let onlineIndex = 0;
  for (let i = 0; i < playerCount - 1; i++) {
    if (seatTypes[i] === "online") {
      onlineIndex += 1;
      players.push({ id: `online-${onlineIndex}`, displayName: `온라인 ${onlineIndex}`, isAI: false });
    } else {
      aiIndex += 1;
      players.push({ id: `ai-${aiIndex}`, displayName: `AI ${aiIndex}`, isAI: true });
    }
  }
  return players;
}

export function SetupScreen({ onStart, onBack, online, onHostRoom }: SetupScreenProps) {
  const [playerCount, setPlayerCount] = useState(2);
  // seatTypes[i]는 (i+2)번째 자리(=인덱스 1부터, 사람은 0번) 유형.
  const [seatTypes, setSeatTypes] = useState<SeatType[]>(["ai", "ai", "ai"]);

  const opponentCount = playerCount - 1;
  const onlineEnabled = Boolean(online?.enabled && onHostRoom);
  const players = playersFromSeats(playerCount, seatTypes);
  const hasOnlineSeat = players.some((p) => p.id.startsWith("online-"));
  const hosting = online?.role === "host" && Boolean(online.roomCode);
  const canStart = !hasOnlineSeat || (hosting && online!.everyoneSeated);

  function setSeat(index: number, type: SeatType) {
    setSeatTypes((prev) => prev.map((t, i) => (i === index ? type : t)));
  }

  return (
    <div className="setup-screen">
      <h1 className="setup-screen__title">게임 설정</h1>

      <section className="setup-screen__section">
        <p className="setup-screen__section-title">인원 수</p>
        <div className="setup-screen__count-row">
          {Array.from({ length: MAX_PLAYERS - MIN_PLAYERS + 1 }, (_, i) => MIN_PLAYERS + i).map((n) => (
            <button
              key={n}
              type="button"
              className={`setup-screen__count-btn${playerCount === n ? " setup-screen__count-btn--selected" : ""}`}
              onClick={() => setPlayerCount(n)}
              disabled={hosting}
            >
              {n}인
            </button>
          ))}
        </div>
      </section>

      <section className="setup-screen__section">
        <p className="setup-screen__section-title">참가자</p>
        <div className="setup-screen__seats">
          <div className="setup-screen__seat setup-screen__seat--human">
            <span className="setup-screen__seat-label">1P</span>
            <span className="setup-screen__seat-name">나</span>
          </div>
          {Array.from({ length: opponentCount }, (_, i) => i).map((i) => {
            const seatPlayerId = players[i + 1]?.id;
            const claimedName = online?.seats.find((seat) => seat.playerId === seatPlayerId)?.claimedName;
            return (
              <div key={i} className="setup-screen__seat">
                <span className="setup-screen__seat-label">{i + 2}P</span>
                <div className="setup-screen__seat-type">
                  <button
                    type="button"
                    className={`setup-screen__type-btn${seatTypes[i] === "ai" ? " setup-screen__type-btn--selected" : ""}`}
                    onClick={() => setSeat(i, "ai")}
                    disabled={hosting}
                  >
                    AI
                  </button>
                  <button
                    type="button"
                    className={`setup-screen__type-btn${
                      seatTypes[i] === "online" ? " setup-screen__type-btn--selected" : ""
                    }${onlineEnabled ? "" : " setup-screen__type-btn--disabled"}`}
                    onClick={() => onlineEnabled && setSeat(i, "online")}
                    disabled={!onlineEnabled || hosting}
                    title={onlineEnabled ? "다른 기기의 사람이 이 자리에 참가합니다." : "온라인 대전은 준비 중입니다."}
                    aria-disabled={!onlineEnabled}
                  >
                    온라인
                    {!onlineEnabled && <span className="setup-screen__soon-badge">준비 중</span>}
                    {seatTypes[i] === "online" && claimedName && (
                      <span className="setup-screen__soon-badge">{claimedName}</span>
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
        <p className="setup-screen__hint">
          {onlineEnabled
            ? "온라인 자리는 방 코드를 받은 다른 기기의 사람이 채웁니다. 카드 셔플과 AI 판정은 방장 기기에서만 계산됩니다."
            : "온라인 참가자 자리는 추후 지원 예정입니다. 지금은 모든 상대가 AI로 채워집니다."}
        </p>
      </section>

      {hasOnlineSeat && online && (
        <section className="setup-screen__section">
          <p className="setup-screen__section-title">온라인 방</p>
          {hosting ? (
            <>
              <p className="setup-screen__room-code">
                방 코드 <strong>{online.roomCode}</strong>
              </p>
              <p className="setup-screen__hint">
                {online.everyoneSeated
                  ? "모든 온라인 자리가 찼습니다. 시작할 수 있습니다."
                  : "다른 기기에서 이 코드로 참가하기를 기다리는 중입니다."}
              </p>
            </>
          ) : (
            <button
              type="button"
              className="setup-screen__type-btn"
              onClick={() => onHostRoom?.(players)}
              disabled={online.status === "connecting"}
            >
              {online.status === "connecting" ? "방 만드는 중..." : "방 만들기"}
            </button>
          )}
          {online.error && <p className="setup-screen__hint">{online.error}</p>}
        </section>
      )}

      <div className="setup-screen__actions">
        <button type="button" className="setup-screen__back-btn" onClick={onBack}>
          뒤로
        </button>
        <button type="button" className="primary-btn" onClick={() => onStart(players)} disabled={!canStart}>
          {playerCount}인 게임 시작
        </button>
      </div>
    </div>
  );
}
