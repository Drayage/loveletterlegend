import { useEffect, useRef } from "react";
import type { LogEntry } from "../engine/types";
import "./GameLog.css";

export function GameLog({ entries }: { entries: LogEntry[] }) {
  const bottomRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [entries.length]);

  return (
    <div className="game-log">
      <h3 className="game-log__title">진행 기록</h3>
      <div className="game-log__list">
        {entries.map((e) => (
          <div key={e.id} className="game-log__entry">
            {e.message}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
