// 음소거/볼륨 설정을 기기에 남겨 다음 방문 때도 유지한다.
const STORAGE_KEY = "loveletterlegend:audio:v1";

export interface AudioSettings {
  muted: boolean;
  volume: number; // 0..1
}

function defaultSettings(): AudioSettings {
  return { muted: false, volume: 0.6 };
}

function hasLocalStorage(): boolean {
  try {
    return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
  } catch {
    return false;
  }
}

export function loadAudioSettings(): AudioSettings {
  if (!hasLocalStorage()) return defaultSettings();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultSettings();
    const parsed = JSON.parse(raw) as Partial<AudioSettings>;
    return { ...defaultSettings(), ...parsed };
  } catch {
    return defaultSettings();
  }
}

export function saveAudioSettings(settings: AudioSettings): void {
  if (!hasLocalStorage()) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // 저장 실패는 무시 -- 설정이 부가 기능이라 게임 진행을 막으면 안 된다.
  }
}
