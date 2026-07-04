import { useEffect, useRef, useState } from "react";
import type { LogEntry } from "../engine/types";
import "./GameLog.css";

/** Fixed-height bottom panel with its OWN scrollbar -- the log must never
 * grow the document or yank the page down as entries accumulate. Collapsed
 * by default (shows the latest couple of lines); tap the header to expand.
 * Auto-scroll is done by setting the list container's scrollTop directly:
 * scrollIntoView({block:"end"}) also scrolls every ancestor, which was
 * exactly the page-jumping bug this replaces. */
export function GameLog({ entries }: { entries: LogEntry[] }) {
  const listRef = useRef<HTMLDivElement>(null);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [entries.length, expanded]);

  return (
    <div className={`game-log${expanded ? " game-log--expanded" : ""}`}>
      <button
        type="button"
        className="game-log__header"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
      >
        <span className="game-log__title">진행 기록</span>
        <span className="game-log__toggle">{expanded ? "접기 ▾" : "펼치기 ▴"}</span>
      </button>
      <div ref={listRef} className="game-log__list">
        {entries.map((e) => (
          <div key={e.id} className="game-log__entry">
            {e.message}
          </div>
        ))}
      </div>
    </div>
  );
}
