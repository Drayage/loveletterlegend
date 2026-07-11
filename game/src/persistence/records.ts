// 기기(브라우저)에 로컬로 남기는 플레이 기록 -- 향후 엔딩 씬이 추가되면
// 이 저장소가 "지금까지 만난 상대/달성한 엔딩" 수집 요소의 기반이 된다.
// 지금은 엔딩 씬 자체가 없으므로, 세션 종료 시 결정된 CharacterSlotId
// (누구와 맺어졌는지)만 누적해 둔다 -- UI(RecordsScreen)는 이걸 그대로
// "달성/미달성" 갤러리로 보여준다.
import type { CharacterSlotId } from "../engine/session";

const STORAGE_KEY = "loveletterlegend:records:v1";

export interface GameRecords {
  version: 1;
  sessionsPlayed: number;
  /** CharacterSlotId -> 그 상대와 맺어져 세션을 마친 횟수 (진엔딩/일반엔딩
   * 구분 없이 "맺어짐" 자체의 누적). 8번 캐릭터(RANK8_SLOTS)가 아닌
   * 슬롯은 애초에 일반엔딩만 존재하므로 이 값 하나로 충분하다. */
  endingsAchieved: Partial<Record<CharacterSlotId, number>>;
  /** 8번 캐릭터와 맺어져 성공/실패 카드 뽑기에서 "성공"을 뽑아 진엔딩을
   * 본 횟수 -- engine/endings.ts's trueEndingSuccessCardCount가 "이미 본
   * 적 있으면 성공 카드 1개로 제한" 판정에 쓴다. endingsAchieved[slot] > 0
   * 인데 이 값이 0이면 "일반엔딩만 본 적 있음"으로 해석된다. */
  trueEndingsSeen: Partial<Record<CharacterSlotId, number>>;
  lastPlayedAt: string | null;
}

function defaultRecords(): GameRecords {
  return { version: 1, sessionsPlayed: 0, endingsAchieved: {}, trueEndingsSeen: {}, lastPlayedAt: null };
}

function hasLocalStorage(): boolean {
  try {
    return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
  } catch {
    return false;
  }
}

export function loadRecords(): GameRecords {
  if (!hasLocalStorage()) return defaultRecords();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultRecords();
    const parsed = JSON.parse(raw) as Partial<GameRecords>;
    if (parsed?.version !== 1) return defaultRecords();
    return { ...defaultRecords(), ...parsed };
  } catch {
    // 손상된 값/비공개 브라우징 모드 등 -- 기록은 부가 기능이므로 조용히
    // 기본값으로 되돌아간다 (게임 진행 자체를 막으면 안 된다).
    return defaultRecords();
  }
}

function saveRecords(records: GameRecords): void {
  if (!hasLocalStorage()) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  } catch {
    // 저장 용량 초과 등 -- 무시.
  }
}

/** 세션이 끝날 때 한 번 호출 -- 사람 플레이어가 맺어진 상대(없으면 null)와,
 * 그게 8번 캐릭터의 진엔딩(성공 카드를 뽑음)이었는지를 기록에 누적한다. */
export function recordSessionEnding(endingSlot: CharacterSlotId | null, wasTrueEnding = false): GameRecords {
  const records = loadRecords();
  records.sessionsPlayed += 1;
  records.lastPlayedAt = new Date().toISOString();
  if (endingSlot) {
    records.endingsAchieved[endingSlot] = (records.endingsAchieved[endingSlot] ?? 0) + 1;
    if (wasTrueEnding) {
      records.trueEndingsSeen[endingSlot] = (records.trueEndingsSeen[endingSlot] ?? 0) + 1;
    }
  }
  saveRecords(records);
  return records;
}

/** engine/endings.ts's trueEndingSuccessCardCount에 넘길 두 플래그를
 * 현재까지의 기록에서 읽어온다. */
export function trueEndingHistoryFor(
  records: GameRecords,
  slot: CharacterSlotId
): { hasSeenTrueEndingBefore: boolean; hasSeenNormalEndingOnlyBefore: boolean } {
  const hasSeenTrueEndingBefore = (records.trueEndingsSeen[slot] ?? 0) > 0;
  const hasSeenNormalEndingOnlyBefore = !hasSeenTrueEndingBefore && (records.endingsAchieved[slot] ?? 0) > 0;
  return { hasSeenTrueEndingBefore, hasSeenNormalEndingOnlyBefore };
}
