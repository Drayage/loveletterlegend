import { useEffect, useState } from "react";
import type { LogEntry } from "../engine/types";
import "./EffectToast.css";

/** Prominently surfaces the latest 1-2 game log lines for a few seconds so
 * the flow of "what just happened" is visible without reading the scrolling
 * log at the bottom of the page. */
export function EffectToast({ entries }: { entries: LogEntry[] }) {
  const [visible, setVisible] = useState(false);
  const last = entries[entries.length - 1];
  const prev = entries[entries.length - 2];

  useEffect(() => {
    if (!last) return;
    setVisible(true);
    const timer = setTimeout(() => setVisible(false), 2600);
    return () => clearTimeout(timer);
  }, [last?.id]);

  if (!last || !visible) return null;

  return (
    <div className="effect-toast" key={last.id}>
      {prev && <div className="effect-toast__line effect-toast__line--prev">{prev.message}</div>}
      <div className="effect-toast__line effect-toast__line--current">{last.message}</div>
    </div>
  );
}
