import { ALL_SLOTS, RANK8_SLOTS } from "../engine/session";
import type { CharacterSlotId } from "../engine/session";
import { loadRecords } from "../persistence/records";
import { SLOT_INFO } from "./slotInfo";
import "./RecordsScreen.css";

interface RecordsScreenProps {
  onBack: () => void;
}

/** "기록보관실" -- 지금까지 어떤 상대와 맺어져 세션을 마쳤는지 기기에 남은
 * 기록을 보여주는 갤러리. 8번 캐릭터(공주/왕자 루트)는 진엔딩 달성 여부도
 * 별도 배지로 보여준다 (see persistence/records.ts's trueEndingsSeen). */
export function RecordsScreen({ onBack }: RecordsScreenProps) {
  const records = loadRecords();
  const routeSlots = RANK8_SLOTS;
  const otherSlots = ALL_SLOTS.filter((slot) => !routeSlots.includes(slot));

  function renderSlot(slot: CharacterSlotId) {
    const info = SLOT_INFO[slot];
    const count = records.endingsAchieved[slot] ?? 0;
    const trueCount = records.trueEndingsSeen[slot] ?? 0;
    const unlocked = count > 0;
    return (
      <div key={slot} className={`records-screen__card${unlocked ? " records-screen__card--unlocked" : ""}`}>
        <div className="records-screen__portrait">
          {unlocked && info.art ? (
            <img src={info.art} alt={info.name} />
          ) : (
            <span className="records-screen__silhouette">?</span>
          )}
        </div>
        <span className="records-screen__name">{unlocked ? info.name : "???"}</span>
        {unlocked && <span className="records-screen__count">{count}회 달성</span>}
        {trueCount > 0 && <span className="records-screen__true-ending">★ 진엔딩 달성</span>}
      </div>
    );
  }

  return (
    <div className="records-screen">
      <h1 className="records-screen__title">기록보관실</h1>
      <p className="records-screen__summary">
        지금까지 {records.sessionsPlayed}번 플레이했습니다.
        {records.lastPlayedAt && ` (최근: ${new Date(records.lastPlayedAt).toLocaleDateString()})`}
      </p>
      <p className="records-screen__note">
        게임을 마치면 맺어진 상대의 엔딩을 보게 됩니다. 공주/왕자 루트는 진엔딩에 도전할 기회가 주어지며,
        한 번 달성한 진엔딩은 이후 도전에서 성공 확률이 낮아집니다.
      </p>

      <section className="records-screen__section">
        <p className="records-screen__section-title">공주/왕자 루트</p>
        <div className="records-screen__grid">{routeSlots.map(renderSlot)}</div>
      </section>

      <section className="records-screen__section">
        <p className="records-screen__section-title">그 외 캐릭터</p>
        <div className="records-screen__grid">{otherSlots.map(renderSlot)}</div>
      </section>

      <button type="button" className="records-screen__back-btn" onClick={onBack}>
        뒤로
      </button>
    </div>
  );
}
