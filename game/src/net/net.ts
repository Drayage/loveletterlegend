/**
 * Firebase Realtime Database 접속 레이어 (온라인 대전).
 *
 * ## 방 구조 (7개 게임이 한 프로젝트를 공유하므로 경로가 곧 네임스페이스다)
 *
 * ```
 * games/loveletterlegend/rooms/<ROOMCODE>
 *   meta      : { game, hostClientId, createdAt, updatedAt, status, seats[] }
 *   state     : { seq, updatedAt, views: { <playerId>: <검열된 SessionState> } }
 *   presence  : { <clientId>: { playerId, name, online, at } }
 *   intents   : { <pushId>: { playerId, intent, at } }
 * ```
 *
 * - `state`는 **호스트만** 쓴다. 게스트는 읽기만 한다.
 * - `intents`는 게스트가 push하고, 호스트가 적용한 뒤 지운다.
 * - `presence`는 각자 자기 것만 쓰고, `onDisconnect`로 연결이 끊기면
 *   자동으로 online=false가 된다.
 *
 * ## seq 가드
 * `state.seq`는 단조 증가한다. `writeState`는 트랜잭션 안에서 현재 seq가
 * 자기가 아는 값보다 크면(= 다른 호스트 탭이 더 최신 상태를 썼다면) 쓰기를
 * 포기한다. 게스트도 자기가 마지막으로 적용한 seq보다 큰 것만 적용한다 --
 * 늦게 도착한 오래된 스냅샷이 판을 되돌리지 못하게 하는 최소 방어다.
 *
 * Firebase SDK는 **동적 import**로만 불러온다: 설정이 비어 있는 로컬/AI
 * 전용 플레이에서는 SDK가 아예 로드되지 않는다.
 */
import type { SessionState } from "../engine/session";
import type { PlayerIntent } from "./intents";
import { ROOM_ROOT_PATH, isFirebaseConfigured, resolveFirebaseConfig } from "./firebaseConfig";

// Firebase RTDB는 빈 배열([])을 쓰면 그 키를 통째로 지운다 -- 읽을 때는
// undefined로 돌아온다. flowState.queue(대기 중일 때 거의 항상 []),
// round.deck/faceUpRemovedCards(라운드 끝나갈 무렵), player.discardPile
// (라운드 시작 직후), round.log 등은 실제 플레이 중 흔히 빈 배열이 되는
// 필드들이라, 게스트가 받는 view를 그대로 쓰면 App.tsx/PlayerArea.tsx의
// 무가드 .length/.map/[0] 호출과 flow.ts의 `queue[0]`이 게스트 화면에서만
// 터진다(호스트는 자기 엔진의 in-memory 상태를 그대로 쓰므로 이 라운드
// 트립을 안 거친다). onState 콜백에 넘기기 전에 복원해 둔다.
function hydrateSessionView(view: SessionState): SessionState {
  if (view.flowState) view.flowState.queue = view.flowState.queue ?? [];
  if (view.round) {
    view.round.deck = view.round.deck ?? [];
    view.round.faceUpRemovedCards = view.round.faceUpRemovedCards ?? [];
    view.round.log = view.round.log ?? [];
    for (const player of view.round.players ?? []) {
      player.hand = player.hand ?? [];
      player.discardPile = player.discardPile ?? [];
    }
  }
  view.storyArchive = view.storyArchive ?? [];
  return view;
}

export type SeatType = "human" | "ai" | "online";

export interface RoomSeat {
  /** 엔진의 PlayerConfig.id와 같은 값 */
  playerId: string;
  displayName: string;
  type: SeatType;
  /** 이 좌석을 차지한 클라이언트 (online 좌석에서만 의미 있음) */
  claimedBy?: string | null;
  claimedName?: string | null;
}

export interface RoomMeta {
  game: "loveletterlegend";
  hostClientId: string;
  createdAt: number;
  updatedAt: number;
  status: "lobby" | "playing" | "ended";
  seats: RoomSeat[];
}

export interface RoomStateEnvelope {
  seq: number;
  updatedAt: number;
  views: Record<string, SessionState>;
}

export interface RoomPresence {
  playerId: string;
  name: string;
  online: boolean;
  at: number;
}

export interface RoomSubscription {
  onMeta?: (meta: RoomMeta | null) => void;
  /** 이 클라이언트 좌석에 해당하는 검열된 상태만 넘어온다. */
  onState?: (view: SessionState, seq: number) => void;
  onPresence?: (presence: Record<string, RoomPresence>) => void;
  /** 호스트 전용: 게스트가 보낸 의도 */
  onIntent?: (key: string, playerId: string, intent: PlayerIntent) => void;
}

const ROOM_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const REJOIN_STORAGE_KEY = "loveletterlegend.online.session";

export interface RejoinInfo {
  roomCode: string;
  clientId: string;
  playerId: string;
  role: "host" | "guest";
}

/** 새로고침/일시적 끊김 후 같은 좌석으로 돌아오기 위한 최소 정보. */
export function saveRejoinInfo(info: RejoinInfo): void {
  try {
    localStorage.setItem(REJOIN_STORAGE_KEY, JSON.stringify(info));
  } catch {
    /* 저장 실패는 치명적이지 않다 -- 재접속만 못 할 뿐이다. */
  }
}

export function loadRejoinInfo(): RejoinInfo | null {
  try {
    const raw = localStorage.getItem(REJOIN_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as RejoinInfo) : null;
  } catch {
    return null;
  }
}

export function clearRejoinInfo(): void {
  try {
    localStorage.removeItem(REJOIN_STORAGE_KEY);
  } catch {
    /* noop */
  }
}

export function newClientId(): string {
  return `c-${Math.random().toString(36).slice(2, 10)}-${Date.now().toString(36)}`;
}

export function newRoomCode(): string {
  let code = "";
  for (let i = 0; i < 4; i++) {
    code += ROOM_CODE_ALPHABET[Math.floor(Math.random() * ROOM_CODE_ALPHABET.length)];
  }
  return code;
}

type FirebaseDb = Awaited<ReturnType<typeof import("firebase/database").getDatabase>>;

let dbPromise: Promise<FirebaseDb> | null = null;

async function getDb(): Promise<FirebaseDb> {
  if (!isFirebaseConfigured()) {
    throw new Error("Firebase 설정이 비어 있습니다 (net/firebaseConfig.ts 참고).");
  }
  if (!dbPromise) {
    dbPromise = (async () => {
      const [{ getApp, getApps, initializeApp }, { getDatabase }] = await Promise.all([
        import("firebase/app"),
        import("firebase/database"),
      ]);
      const app = getApps().length > 0 ? getApp() : initializeApp(resolveFirebaseConfig());
      return getDatabase(app);
    })();
  }
  return dbPromise;
}

function roomPath(roomCode: string, suffix = ""): string {
  return `${ROOM_ROOT_PATH}/${roomCode}${suffix}`;
}

/** 방 만들기. 이미 쓰이는 코드면 다른 코드로 재시도한다. */
export async function createRoom(seats: RoomSeat[], hostClientId: string): Promise<string> {
  const db = await getDb();
  const { ref, runTransaction } = await import("firebase/database");
  for (let attempt = 0; attempt < 8; attempt++) {
    const roomCode = newRoomCode();
    const now = Date.now();
    const meta: RoomMeta = {
      game: "loveletterlegend",
      hostClientId,
      createdAt: now,
      updatedAt: now,
      status: "lobby",
      seats,
    };
    const result = await runTransaction(ref(db, roomPath(roomCode, "/meta")), (current) =>
      current === null ? meta : undefined
    );
    if (result.committed) return roomCode;
  }
  throw new Error("방 코드를 만들지 못했습니다. 잠시 후 다시 시도해 주세요.");
}

/**
 * 방 참가: 비어 있는 online 좌석 하나를 트랜잭션으로 선점한다. 같은
 * clientId가 이미 잡고 있던 좌석이 있으면 그 좌석으로 재입장한다(rejoin).
 */
export async function joinRoom(roomCode: string, clientId: string, displayName: string): Promise<RoomSeat> {
  const db = await getDb();
  const { ref, runTransaction } = await import("firebase/database");
  let claimed: RoomSeat | null = null;
  const result = await runTransaction(ref(db, roomPath(roomCode, "/meta")), (meta: RoomMeta | null) => {
    if (!meta) return meta; // 없는 방 -> 커밋하지 않는다
    const seats = meta.seats ?? [];
    const mine = seats.find((seat) => seat.type === "online" && seat.claimedBy === clientId);
    const target = mine ?? seats.find((seat) => seat.type === "online" && !seat.claimedBy);
    if (!target) return meta; // 빈 자리 없음 -> 변경 없이 커밋
    target.claimedBy = clientId;
    target.claimedName = displayName;
    meta.updatedAt = Date.now();
    claimed = target;
    return meta;
  });
  if (!result.committed || !result.snapshot.exists()) throw new Error("방을 찾을 수 없습니다.");
  if (!claimed) throw new Error("남은 온라인 자리가 없습니다.");
  return claimed;
}

export async function setRoomStatus(roomCode: string, status: RoomMeta["status"]): Promise<void> {
  const db = await getDb();
  const { ref, update } = await import("firebase/database");
  await update(ref(db, roomPath(roomCode, "/meta")), { status, updatedAt: Date.now() });
}

/**
 * 호스트가 좌석별 검열 상태를 쓴다. `expectedSeq`보다 더 앞선 상태가 이미
 * 있으면(다른 탭/재접속한 호스트) 쓰지 않고 그 seq를 돌려준다.
 * 성공하면 새 seq를 돌려준다.
 */
export async function writeState(
  roomCode: string,
  views: Record<string, SessionState>,
  expectedSeq: number
): Promise<number> {
  const db = await getDb();
  const { ref, runTransaction } = await import("firebase/database");
  const nextSeq = expectedSeq + 1;
  const envelope: RoomStateEnvelope = { seq: nextSeq, updatedAt: Date.now(), views };
  const result = await runTransaction(ref(db, roomPath(roomCode, "/state")), (current: RoomStateEnvelope | null) => {
    if (current && current.seq >= nextSeq) return undefined; // 더 최신 상태가 있다 -> 포기
    return envelope;
  });
  const stored = result.snapshot.val() as RoomStateEnvelope | null;
  return stored?.seq ?? expectedSeq;
}

/** 게스트가 자기 의도를 큐에 넣는다. */
export async function sendIntent(roomCode: string, playerId: string, intent: PlayerIntent): Promise<void> {
  const db = await getDb();
  const { push, ref, set } = await import("firebase/database");
  await set(push(ref(db, roomPath(roomCode, "/intents"))), { playerId, intent, at: Date.now() });
}

/** 호스트가 적용을 끝낸 의도를 지운다 (성공/거부 모두 지운다). */
export async function consumeIntent(roomCode: string, key: string): Promise<void> {
  const db = await getDb();
  const { ref, remove } = await import("firebase/database");
  await remove(ref(db, roomPath(roomCode, `/intents/${key}`)));
}

/** 접속 표시 + 끊길 때 자동으로 오프라인 표시 (onDisconnect). */
export async function markPresence(
  roomCode: string,
  clientId: string,
  playerId: string,
  name: string
): Promise<void> {
  const db = await getDb();
  const { onDisconnect, ref, set } = await import("firebase/database");
  const presenceRef = ref(db, roomPath(roomCode, `/presence/${clientId}`));
  await onDisconnect(presenceRef).update({ online: false, at: Date.now() });
  await set(presenceRef, { playerId, name, online: true, at: Date.now() } satisfies RoomPresence);
}

/**
 * 방 구독. 돌려주는 함수를 호출하면 모든 리스너가 해제된다.
 * `viewPlayerId`가 주어지면 state에서 그 좌석의 뷰만 뽑아 넘긴다.
 */
export async function subscribeRoom(
  roomCode: string,
  viewPlayerId: string | null,
  handlers: RoomSubscription
): Promise<() => void> {
  const db = await getDb();
  const { off, onChildAdded, onValue, ref } = await import("firebase/database");
  const unsubscribers: Array<() => void> = [];

  if (handlers.onMeta) {
    const metaRef = ref(db, roomPath(roomCode, "/meta"));
    const cb = onValue(metaRef, (snap) => handlers.onMeta!((snap.val() as RoomMeta | null) ?? null));
    unsubscribers.push(() => off(metaRef, "value", cb));
  }
  if (handlers.onState) {
    const stateRef = ref(db, roomPath(roomCode, "/state"));
    const cb = onValue(stateRef, (snap) => {
      const envelope = snap.val() as RoomStateEnvelope | null;
      if (!envelope || !viewPlayerId) return;
      const view = envelope.views?.[viewPlayerId];
      if (view) handlers.onState!(hydrateSessionView(view), envelope.seq);
    });
    unsubscribers.push(() => off(stateRef, "value", cb));
  }
  if (handlers.onPresence) {
    const presenceRef = ref(db, roomPath(roomCode, "/presence"));
    const cb = onValue(presenceRef, (snap) =>
      handlers.onPresence!((snap.val() as Record<string, RoomPresence> | null) ?? {})
    );
    unsubscribers.push(() => off(presenceRef, "value", cb));
  }
  if (handlers.onIntent) {
    const intentsRef = ref(db, roomPath(roomCode, "/intents"));
    const cb = onChildAdded(intentsRef, (snap) => {
      const value = snap.val() as { playerId: string; intent: PlayerIntent } | null;
      if (value && snap.key) handlers.onIntent!(snap.key, value.playerId, value.intent);
    });
    unsubscribers.push(() => off(intentsRef, "child_added", cb));
  }

  return () => {
    for (const unsubscribe of unsubscribers) unsubscribe();
  };
}

/** 방 나가기 -- 좌석 선점을 풀고 오프라인으로 표시한다. */
export async function leaveRoom(roomCode: string, clientId: string): Promise<void> {
  const db = await getDb();
  const { ref, remove, runTransaction } = await import("firebase/database");
  await remove(ref(db, roomPath(roomCode, `/presence/${clientId}`)));
  await runTransaction(ref(db, roomPath(roomCode, "/meta")), (meta: RoomMeta | null) => {
    if (!meta) return meta;
    for (const seat of meta.seats ?? []) {
      if (seat.claimedBy === clientId) {
        seat.claimedBy = null;
        seat.claimedName = null;
      }
    }
    meta.updatedAt = Date.now();
    return meta;
  });
}

/** 엔진의 PlayerConfig 목록을 방 좌석 목록으로 옮긴다 (0번은 항상 방장). */
export function seatsFromPlayers(
  players: Array<{ id: string; displayName: string; isAI: boolean }>
): RoomSeat[] {
  return players.map((player, index) => ({
    playerId: player.id,
    displayName: player.displayName,
    type: index === 0 ? "human" : player.isAI ? "ai" : "online",
    claimedBy: null,
    claimedName: null,
  }));
}
