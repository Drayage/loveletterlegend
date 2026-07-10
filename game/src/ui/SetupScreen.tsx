import { useState } from "react";
import type { PlayerConfig } from "../engine/types";
import "./SetupScreen.css";

/** 사람(항상 1번 자리) 외 나머지 자리에 채울 수 있는 참가자 유형. "online"은
 * 아직 실제 네트워크 대전이 없어(GAME_PLAN.md Phase 5, Firebase 필요) 항상
 * 비활성 상태로만 보여준다 -- 고르면 곧바로 "ai"로 대체된다. */
type SeatType = "ai" | "online";

interface SetupScreenProps {
  onStart: (players: PlayerConfig[]) => void;
  onBack: () => void;
}

const MAX_PLAYERS = 4;
const MIN_PLAYERS = 2;

export function SetupScreen({ onStart, onBack }: SetupScreenProps) {
  const [playerCount, setPlayerCount] = useState(2);
  // seatTypes[i]는 (i+2)번째 자리(=인덱스 1부터, 사람은 0번) 유형.
  const [seatTypes, setSeatTypes] = useState<SeatType[]>(["ai", "ai", "ai"]);

  const opponentCount = playerCount - 1;

  function handleStart() {
    const players: PlayerConfig[] = [{ id: "human", displayName: "나", isAI: false }];
    for (let i = 0; i < opponentCount; i++) {
      players.push({ id: `ai-${i + 1}`, displayName: `AI ${i + 1}`, isAI: true });
    }
    onStart(players);
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
          {Array.from({ length: opponentCount }, (_, i) => i).map((i) => (
            <div key={i} className="setup-screen__seat">
              <span className="setup-screen__seat-label">{i + 2}P</span>
              <div className="setup-screen__seat-type">
                <button
                  type="button"
                  className={`setup-screen__type-btn${seatTypes[i] === "ai" ? " setup-screen__type-btn--selected" : ""}`}
                  onClick={() =>
                    setSeatTypes((prev) => prev.map((t, idx) => (idx === i ? "ai" : t)))
                  }
                >
                  AI
                </button>
                <button
                  type="button"
                  className="setup-screen__type-btn setup-screen__type-btn--disabled"
                  disabled
                  title="온라인 대전은 준비 중입니다."
                  aria-disabled="true"
                >
                  온라인
                  <span className="setup-screen__soon-badge">준비 중</span>
                </button>
              </div>
            </div>
          ))}
        </div>
        <p className="setup-screen__hint">
          온라인 참가자 자리는 추후 지원 예정입니다. 지금은 모든 상대가 AI로 채워집니다.
        </p>
      </section>

      <div className="setup-screen__actions">
        <button type="button" className="setup-screen__back-btn" onClick={onBack}>
          뒤로
        </button>
        <button type="button" className="primary-btn" onClick={handleStart}>
          {playerCount}인 게임 시작
        </button>
      </div>
    </div>
  );
}
