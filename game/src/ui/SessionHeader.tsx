import type { CharacterSlotId, SessionState } from "../engine/session";
import { ROUTE_DEFS } from "../data/routes";
import { WIZARD_APPRENTICE } from "../data/characters";
import type { PlayerConfig } from "../engine/types";
import "./SessionHeader.css";

interface SessionHeaderProps {
  session: SessionState;
  humanId: string;
  onShowArchive: () => void;
}

const ALL_SLOTS: CharacterSlotId[] = ["잉그리드공주", "아레스왕자", "마술사의도제"];

const SLOT_INFO: Record<CharacterSlotId, { name: string; art?: string }> = {
  잉그리드공주: { name: ROUTE_DEFS.공주.displayName, art: ROUTE_DEFS.공주.art },
  아레스왕자: { name: ROUTE_DEFS.왕자.displayName, art: ROUTE_DEFS.왕자.art },
  마술사의도제: { name: WIZARD_APPRENTICE.name },
};

/** A slot only shows up here once its character has actually been
 * introduced in the story archive -- 잉그리드공주/아레스왕자 are seeded
 * from session start (018/020), but 마술사의도제 has no reveal card in
 * this v1 slice yet, so she stays hidden (her [편지] still counts toward
 * the ending algorithm either way -- this is purely a display gate). */
const SLOT_REVEAL_CARD_ID: Record<CharacterSlotId, string> = {
  잉그리드공주: "018",
  아레스왕자: "020",
  마술사의도제: WIZARD_APPRENTICE.characterId,
};

/** Stable per-player color, assigned by seat order -- used so every
 * character row can show each player's [편지] count in "their" color
 * instead of only surfacing the human's own pursued route. */
const PLAYER_COLORS = ["#4f8fef", "#ef6a6a", "#5fbf7a", "#c98fef"];

function SlotRow({
  slot,
  playerConfigs,
  humanId,
  letterTokens,
}: {
  slot: CharacterSlotId;
  playerConfigs: PlayerConfig[];
  humanId: string;
  letterTokens: SessionState["letterTokens"];
}) {
  const info = SLOT_INFO[slot];
  return (
    <div className="session-header__slot">
      {info.art && <img className="session-header__slot-art" src={info.art} alt={info.name} />}
      <div className="session-header__slot-info">
        <span className="session-header__value">{info.name}</span>
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
      </div>
    </div>
  );
}

export function SessionHeader({ session, humanId, onShowArchive }: SessionHeaderProps) {
  const revealedSlots = ALL_SLOTS.filter((slot) =>
    session.storyArchive.some((c) => c.id === SLOT_REVEAL_CARD_ID[slot])
  );

  return (
    <div className="session-header">
      <div className="session-header__stat">
        <span className="session-header__label">라운드</span>
        <span className="session-header__value">{session.roundNumber} / 8</span>
      </div>
      <div className="session-header__stat">
        <span className="session-header__label">시계</span>
        <span className="session-header__value">{session.clockTokens}</span>
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

      <div className="session-header__slots">
        {revealedSlots.map((slot) => (
          <SlotRow
            key={slot}
            slot={slot}
            playerConfigs={session.playerConfigs}
            humanId={humanId}
            letterTokens={session.letterTokens}
          />
        ))}
      </div>

      <button type="button" className="session-header__archive-btn" onClick={onShowArchive}>
        이야기 보관소 보기
      </button>
    </div>
  );
}
