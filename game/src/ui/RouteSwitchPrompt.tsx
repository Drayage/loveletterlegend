import type { Route } from "../engine/session";
import { ROUTE_DEFS } from "../data/routes";
import { Modal } from "./Modal";
import "./RouteSwitchPrompt.css";

interface RouteSwitchPromptProps {
  currentRoute: Route;
  onChoose: (route: Route) => void;
}

export function RouteSwitchPrompt({ currentRoute, onChoose }: RouteSwitchPromptProps) {
  const otherRoute: Route = currentRoute === "공주" ? "왕자" : "공주";

  return (
    <Modal title="다음 라운드 시작" onClose={() => {}} dismissible={false}>
      <div className="route-switch">
        <p className="route-switch__prompt">
          계속 {ROUTE_DEFS[currentRoute].displayName}을(를) 추구하시겠습니까, 아니면 상대를 바꾸시겠습니까?
        </p>
        <div className="route-switch__options">
          <button type="button" className="route-switch__btn" onClick={() => onChoose(currentRoute)}>
            {ROUTE_DEFS[currentRoute].displayName} 계속 추구
          </button>
          <button type="button" className="route-switch__btn" onClick={() => onChoose(otherRoute)}>
            {ROUTE_DEFS[otherRoute].displayName}(으)로 전환
          </button>
        </div>
      </div>
    </Modal>
  );
}
