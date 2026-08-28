/**
 * 온라인 방의 수명주기를 한곳에 모은 훅. App.tsx는 이 훅이 주는
 * `role`/`localPlayerId`/`submitIntent`만 알면 되고, 로컬(AI 전용) 모드에서는
 * 훅이 아무 것도 하지 않는다 -- Firebase SDK조차 로드되지 않는다.
 *
 * 호스트 권한 방식:
 * - 호스트: 엔진을 돌리고, 매 전이마다 좌석별 검열 뷰를 브로드캐스트하며,
 *   게스트가 보낸 의도를 큐(flowState) 기준으로 검증해 적용한다.
 * - 게스트: 엔진을 절대 돌리지 않는다. 받은 뷰를 그리고, 자기 차례에
 *   의도만 보낸다.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import type { SessionState } from "../engine/session";
import type { PlayerIntent } from "./intents";
import { broadcastViews } from "./sync";
import {
  clearRejoinInfo,
  consumeIntent,
  createRoom,
  joinRoom,
  leaveRoom,
  loadRejoinInfo,
  markPresence,
  newClientId,
  saveRejoinInfo,
  sendIntent,
  setRoomStatus,
  subscribeRoom,
  writeState,
} from "./net";
import type { RoomMeta, RoomPresence, RoomSeat } from "./net";
import { isFirebaseConfigured } from "./firebaseConfig";

export type OnlineRole = "host" | "guest" | null;
export type OnlineStatus = "offline" | "connecting" | "lobby" | "playing" | "error";

export interface OnlineRoom {
  enabled: boolean;
  status: OnlineStatus;
  role: OnlineRole;
  roomCode: string | null;
  /** 이 클라이언트가 앉은 좌석 id (오프라인이면 null) */
  localPlayerId: string | null;
  seats: RoomSeat[];
  presence: Record<string, RoomPresence>;
  error: string | null;
  /** 모든 온라인 좌석이 채워졌는가 (호스트가 시작할 수 있는 조건) */
  everyoneSeated: boolean;
  host: (seats: RoomSeat[], localPlayerId: string) => Promise<void>;
  join: (roomCode: string, displayName: string) => Promise<void>;
  start: () => Promise<void>;
  leave: () => Promise<void>;
  /** 게스트면 서버로 보내고 true, 아니면 false(= 호출자가 직접 적용). */
  submitIntent: (intent: PlayerIntent) => boolean;
  /** 호스트 전용: 현재 세션을 좌석별 뷰로 브로드캐스트. */
  broadcast: (session: SessionState) => void;
}

interface UseOnlineRoomOptions {
  /** 게스트: 호스트가 보낸 새 상태 */
  onRemoteState: (view: SessionState, seq: number) => void;
  /** 호스트: 게스트가 보낸 의도 */
  onRemoteIntent: (playerId: string, intent: PlayerIntent) => void;
}

export function useOnlineRoom({ onRemoteState, onRemoteIntent }: UseOnlineRoomOptions): OnlineRoom {
  const enabled = isFirebaseConfigured();
  const [status, setStatus] = useState<OnlineStatus>("offline");
  const [role, setRole] = useState<OnlineRole>(null);
  const [roomCode, setRoomCode] = useState<string | null>(null);
  const [localPlayerId, setLocalPlayerId] = useState<string | null>(null);
  const [seats, setSeats] = useState<RoomSeat[]>([]);
  const [presence, setPresence] = useState<Record<string, RoomPresence>>({});
  const [error, setError] = useState<string | null>(null);

  const clientIdRef = useRef<string>(loadRejoinInfo()?.clientId ?? newClientId());
  const unsubscribeRef = useRef<(() => void) | null>(null);
  const seqRef = useRef(0);
  // 브로드캐스트는 항상 마지막 상태 하나만 보내면 된다 -- 쓰기가 진행 중이면
  // 최신 상태를 대기시켜 두고 끝난 뒤 한 번 더 보낸다.
  const writingRef = useRef(false);
  const queuedSessionRef = useRef<SessionState | null>(null);
  const roleRef = useRef<OnlineRole>(null);
  const roomCodeRef = useRef<string | null>(null);
  const localPlayerIdRef = useRef<string | null>(null);
  localPlayerIdRef.current = localPlayerId;
  const stateHandlerRef = useRef(onRemoteState);
  const intentHandlerRef = useRef(onRemoteIntent);
  stateHandlerRef.current = onRemoteState;
  intentHandlerRef.current = onRemoteIntent;

  useEffect(() => {
    return () => {
      unsubscribeRef.current?.();
      unsubscribeRef.current = null;
    };
  }, []);

  const applyMeta = useCallback((meta: RoomMeta | null) => {
    if (!meta) return;
    setSeats(meta.seats ?? []);
    setStatus(meta.status === "playing" ? "playing" : meta.status === "ended" ? "offline" : "lobby");
  }, []);

  const subscribe = useCallback(
    async (code: string, viewPlayerId: string, asHost: boolean) => {
      unsubscribeRef.current?.();
      unsubscribeRef.current = await subscribeRoom(code, viewPlayerId, {
        onMeta: applyMeta,
        onPresence: setPresence,
        // 게스트만 상태를 받아 그린다 -- 호스트는 자기 엔진이 곧 진실이다.
        onState: asHost
          ? undefined
          : (view, seq) => {
              if (seq <= seqRef.current) return; // 늦게 도착한 오래된 스냅샷 무시
              seqRef.current = seq;
              setStatus("playing");
              stateHandlerRef.current(view, seq);
            },
        onIntent: asHost
          ? (key, playerId, intent) => {
              intentHandlerRef.current(playerId, intent);
              void consumeIntent(code, key).catch(() => undefined);
            }
          : undefined,
      });
    },
    [applyMeta]
  );

  const host = useCallback(
    async (roomSeats: RoomSeat[], hostPlayerId: string) => {
      setStatus("connecting");
      setError(null);
      try {
        const code = await createRoom(roomSeats, clientIdRef.current);
        roleRef.current = "host";
        roomCodeRef.current = code;
        seqRef.current = 0;
        setRole("host");
        setRoomCode(code);
        setLocalPlayerId(hostPlayerId);
        setSeats(roomSeats);
        setStatus("lobby");
        saveRejoinInfo({ roomCode: code, clientId: clientIdRef.current, playerId: hostPlayerId, role: "host" });
        await markPresence(code, clientIdRef.current, hostPlayerId, "방장");
        await subscribe(code, hostPlayerId, true);
      } catch (err) {
        setStatus("error");
        setError(err instanceof Error ? err.message : "방을 만들지 못했습니다.");
      }
    },
    [subscribe]
  );

  const join = useCallback(
    async (code: string, displayName: string) => {
      setStatus("connecting");
      setError(null);
      try {
        const normalized = code.trim().toUpperCase();
        const seat = await joinRoom(normalized, clientIdRef.current, displayName);
        roleRef.current = "guest";
        roomCodeRef.current = normalized;
        seqRef.current = 0;
        setRole("guest");
        setRoomCode(normalized);
        setLocalPlayerId(seat.playerId);
        setStatus("lobby");
        saveRejoinInfo({ roomCode: normalized, clientId: clientIdRef.current, playerId: seat.playerId, role: "guest" });
        await markPresence(normalized, clientIdRef.current, seat.playerId, displayName);
        await subscribe(normalized, seat.playerId, false);
      } catch (err) {
        setStatus("error");
        setError(err instanceof Error ? err.message : "방에 참가하지 못했습니다.");
      }
    },
    [subscribe]
  );

  const start = useCallback(async () => {
    const code = roomCodeRef.current;
    if (!code || roleRef.current !== "host") return;
    try {
      await setRoomStatus(code, "playing");
      setStatus("playing");
    } catch (err) {
      setError(err instanceof Error ? err.message : "게임을 시작하지 못했습니다.");
    }
  }, []);

  const leave = useCallback(async () => {
    const code = roomCodeRef.current;
    unsubscribeRef.current?.();
    unsubscribeRef.current = null;
    roleRef.current = null;
    roomCodeRef.current = null;
    setRole(null);
    setRoomCode(null);
    setLocalPlayerId(null);
    setSeats([]);
    setPresence({});
    setStatus("offline");
    clearRejoinInfo();
    if (code) await leaveRoom(code, clientIdRef.current).catch(() => undefined);
  }, []);

  const broadcast = useCallback((session: SessionState) => {
    const code = roomCodeRef.current;
    if (!code || roleRef.current !== "host") return;
    queuedSessionRef.current = session;
    if (writingRef.current) return;
    writingRef.current = true;
    void (async () => {
      try {
        while (queuedSessionRef.current) {
          const pending = queuedSessionRef.current;
          queuedSessionRef.current = null;
          seqRef.current = await writeState(code, broadcastViews(pending), seqRef.current);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "상태 동기화에 실패했습니다.");
      } finally {
        writingRef.current = false;
      }
    })();
  }, []);

  const submitIntent = useCallback((intent: PlayerIntent) => {
    const code = roomCodeRef.current;
    if (roleRef.current !== "guest" || !code) return false;
    void sendIntent(code, localPlayerIdRef.current ?? "", intent).catch((err) => {
      setError(err instanceof Error ? err.message : "행동을 보내지 못했습니다.");
    });
    return true;
  }, []);

  const onlineSeats = seats.filter((seat) => seat.type === "online");
  const everyoneSeated = onlineSeats.length > 0 && onlineSeats.every((seat) => Boolean(seat.claimedBy));

  return {
    enabled,
    status,
    role,
    roomCode,
    localPlayerId,
    seats,
    presence,
    error,
    everyoneSeated,
    host,
    join,
    start,
    leave,
    submitIntent,
    broadcast,
  };
}
