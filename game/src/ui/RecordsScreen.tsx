import { ALL_SLOTS, RANK8_SLOTS } from "../engine/session";
import type { CharacterSlotId } from "../engine/session";
import { loadRecords } from "../persistence/records";
import { SLOT_INFO } from "./slotInfo";
import "./RecordsScreen.css";

interface RecordsScreenProps {
  onBack: () => void;
}

/** "기록보관실" -- 지금까지 어떤 상대와 맺어져 세션을 마쳤는지 기기에 남은
 * 기록을 보여주는 갤러리. 엔딩 씬(CG/스토리)이 아직 구현되지 않았으므로,
 * 지금은 달성 여부 + 횟수만 보여주는 자리로 준비해 둔다 -- 엔딩 씬이
 * 추가되면 unlocked 카드를 눌러 그 씬을 다시 보는 식으로 확장하면 된다. */
export function RecordsScreen({ onBack }: RecordsScreenProps) {
  const records = loadRecords();
  const routeSlots = RANK8_SLOTS;
  const otherSlots = ALL_SLOTS.filter((slot) => !routeSlots.includes(slot));

  function renderSlot(slot: CharacterSlotId) {
    const info = SLOT_INFO[slot];
    const count = records.endingsAchieved[slot] ?? 0;
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
        엔딩 씬은 추후 업데이트에서 추가될 예정입니다. 지금은 어떤 상대와 맺어져 세션을 마쳤는지만
        기록됩니다 -- 씬이 추가되면 달성한 카드를 눌러 다시 볼 수 있게 됩니다.
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
