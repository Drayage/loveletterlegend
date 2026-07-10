import { useState } from "react";
import { getSoundEngine } from "../audio/soundEngine";
import "./SoundControls.css";

/** 우측 하단에 떠 있는 음소거/볼륨 토글 -- flow-status-fab과 같은 자리
 * 규칙(고정 버튼 + 눌렀을 때만 펼쳐지는 패널)을 따른다. */
export function SoundControls() {
  const engine = getSoundEngine();
  const [open, setOpen] = useState(false);
  const [muted, setMutedState] = useState(engine.isMuted());
  const [volume, setVolumeState] = useState(engine.getVolume());

  function toggleMuted() {
    const next = !muted;
    engine.setMuted(next);
    setMutedState(next);
  }

  function handleVolumeChange(e: React.ChangeEvent<HTMLInputElement>) {
    const v = Number(e.target.value) / 100;
    engine.setVolume(v);
    setVolumeState(v);
  }

  return (
    <div className="sound-controls">
      {open && (
        <div className="sound-controls__panel">
          <label className="sound-controls__row">
            <span>음소거</span>
            <input type="checkbox" checked={muted} onChange={toggleMuted} />
          </label>
          <label className="sound-controls__row">
            <span>볼륨</span>
            <input
              type="range"
              min={0}
              max={100}
              value={Math.round(volume * 100)}
              onChange={handleVolumeChange}
              disabled={muted}
            />
          </label>
        </div>
      )}
      <button
        type="button"
        className="sound-controls__fab"
        onClick={() => setOpen((v) => !v)}
        aria-label="사운드 설정"
        title="사운드 설정"
      >
        {muted ? "🔇" : "🔊"}
      </button>
    </div>
  );
}
