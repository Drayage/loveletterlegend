import { useState } from "react";
import { Modal } from "./Modal";
import "./FlowStatusModal.css";

export type FlowStatusItem = {
  title: string;
  detail: string;
  tone?: "ready" | "blocked" | "waiting";
};

interface FlowStatusModalProps {
  aiTasks: FlowStatusItem[];
  playerTasks: FlowStatusItem[];
  blockers: FlowStatusItem[];
  onClose: () => void;
}

type FlowTab = "ai" | "player" | "blockers";

const TAB_LABELS: Record<FlowTab, string> = {
  ai: "AI 할 일",
  player: "내 할 일",
  blockers: "막는 것",
};

function StatusList({ items }: { items: FlowStatusItem[] }) {
  return (
    <div className="flow-status__list">
      {items.map((item, index) => (
        <div key={`${item.title}-${index}`} className={`flow-status__item flow-status__item--${item.tone ?? "waiting"}`}>
          <div className="flow-status__item-head">
            <span className="flow-status__dot" />
            <strong>{item.title}</strong>
          </div>
          <p>{item.detail}</p>
        </div>
      ))}
    </div>
  );
}

export function FlowStatusModal({ aiTasks, playerTasks, blockers, onClose }: FlowStatusModalProps) {
  const [tab, setTab] = useState<FlowTab>("blockers");
  const items = tab === "ai" ? aiTasks : tab === "player" ? playerTasks : blockers;
  const hasBlockingScreen = blockers.some((item) => item.tone !== "ready");

  return (
    <Modal title="진행 확인" onClose={onClose}>
      <div className="flow-status">
        <div className="flow-status__tabs" role="tablist" aria-label="진행 상태">
          {(Object.keys(TAB_LABELS) as FlowTab[]).map((key) => (
            <button
              key={key}
              type="button"
              className={`flow-status__tab${tab === key ? " flow-status__tab--active" : ""}`}
              onClick={() => setTab(key)}
            >
              {TAB_LABELS[key]}
            </button>
          ))}
        </div>
        <StatusList items={items} />
        {hasBlockingScreen && (
          <button type="button" className="flow-status__return-btn" onClick={onClose}>
            막고 있는 화면으로 돌아가기
          </button>
        )}
      </div>
    </Modal>
  );
}
