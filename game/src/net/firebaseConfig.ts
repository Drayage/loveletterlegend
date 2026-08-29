/**
 * Firebase 설정 (온라인 대전용).
 *
 * 이 저장소를 포함한 7개 게임이 **하나의 Firebase 프로젝트**를 공유하므로,
 * 여기에 들어갈 값은 그 공용 프로젝트의 웹 앱 설정 하나뿐이다. 실제 키는
 * 아직 발급되지 않았고, 저장소에 커밋하지도 않는다.
 *
 * ## 실제 키를 넣는 방법
 *
 * 1. Firebase 콘솔 -> 프로젝트 설정 -> "내 앱"(웹)의 `firebaseConfig`를 복사한다.
 * 2. 아래 `FIREBASE_CONFIG`의 빈 객체를 그 값으로 채운다. 필요한 필드는
 *    `apiKey`, `authDomain`, `databaseURL`, `projectId`, `appId` 이며,
 *    Realtime Database를 쓰므로 `databaseURL`이 반드시 있어야 한다.
 * 3. 값을 비공개로 유지하고 싶다면 대신 빌드 환경변수를 쓴다:
 *    `.env.local`에 `VITE_FIREBASE_CONFIG={"apiKey":"...","databaseURL":"..."}`
 *    한 줄을 넣으면 아래 로더가 그쪽을 우선 사용한다 (.env.local은 커밋 금지).
 *
 * 설정이 비어 있으면 온라인 기능은 UI에서 "준비 중"으로 비활성화되고,
 * 기존 단일 기기 로컬/AI 모드는 아무 영향 없이 그대로 동작한다.
 */
export interface FirebaseConfig {
  apiKey?: string;
  authDomain?: string;
  /** Realtime Database URL -- 온라인 대전에 반드시 필요. */
  databaseURL?: string;
  projectId?: string;
  storageBucket?: string;
  messagingSenderId?: string;
  appId?: string;
}

export const FIREBASE_CONFIG: FirebaseConfig = {
  apiKey: "AIzaSyByKyy7PYBIMi2K1jxH6KmzfWbE2_SsB5A",
  authDomain: "deadline-38cdb.firebaseapp.com",
  databaseURL: "https://deadline-38cdb-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "deadline-38cdb",
  storageBucket: "deadline-38cdb.firebasestorage.app",
  messagingSenderId: "768255871086",
  appId: "1:768255871086:web:ad7713b5a3b8e01f9cbe7f",
};

/** 7개 게임이 공유하는 RTDB의 이 게임 전용 루트 경로. 다른 게임과 절대
 * 겹치지 않도록 규칙(rules)도 이 경로 기준으로 작성한다. */
export const ROOM_ROOT_PATH = "games/loveletterlegend/rooms";

function configFromEnv(): FirebaseConfig | null {
  const raw = import.meta.env?.VITE_FIREBASE_CONFIG;
  if (!raw) return null;
  try {
    return JSON.parse(raw) as FirebaseConfig;
  } catch {
    console.error("VITE_FIREBASE_CONFIG를 JSON으로 읽을 수 없습니다.");
    return null;
  }
}

export function resolveFirebaseConfig(): FirebaseConfig {
  return configFromEnv() ?? FIREBASE_CONFIG;
}

/** 온라인 기능을 켜도 되는지 -- 최소한 databaseURL과 apiKey가 있어야 한다. */
export function isFirebaseConfigured(): boolean {
  const config = resolveFirebaseConfig();
  return Boolean(config.databaseURL && config.apiKey);
}
