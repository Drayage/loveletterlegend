// 기기(브라우저)에 로컬로 남기는 플레이 기록 -- "지금까지 만난 상대/달성한
// 엔딩" 수집 요소의 기반. 일반엔딩은 정체×맺어진 캐릭터 조합마다 텍스트가
// 다르므로(engine/endings.ts's resolveEndingForPlayer) 그 조합 단위로
// 추적하고, 진엔딩은 정체와 무관하게 공용 텍스트라 8번 캐릭터 슬롯
// 단위로만 추적한다 (UI: RecordsScreen).
import type { CharacterSlotId } from "../engine/session";

const STORAGE_KEY = "loveletterlegend:records:v2";

/** 정체 이름 + 맺어진 슬롯(없으면 "이루어진 상대 없음") 조합 하나를 가리키는
 * 키. resolveEndingForPlayer(identityName, slot)를 다시 호출하면 이 키만
 * 갖고도 언제든 같은 텍스트/종류를 재구성할 수 있으므로, 저장은 "도달한
 * 사실"만 하면 된다 (see parseEndingRecordKey). */
export type EndingRecordKey = string;

const NO_MATCH_MARKER = "__noMatch__";

export function endingRecordKey(identityName: string, slot: CharacterSlotId | null): EndingRecordKey {
  return `${identityName}|${slot ?? NO_MATCH_MARKER}`;
}

export function parseEndingRecordKey(key: EndingRecordKey): { identityName: string; slot: CharacterSlotId | null } {
  const separatorIndex = key.indexOf("|");
  const identityName = key.slice(0, separatorIndex);
  const slotPart = key.slice(separatorIndex + 1);
  return { identityName, slot: slotPart === NO_MATCH_MARKER ? null : (slotPart as CharacterSlotId) };
}

export interface GameRecords {
  version: 2;
  sessionsPlayed: number;
  /** endingRecordKey(정체, 슬롯) -> 그 정확한 조합으로 세션을 마친 횟수
   * (일반엔딩/동성/이루어진 상대 없음 전부 이 하나의 맵으로 추적된다 --
   * 어느 쪽인지는 항상 resolveEndingForPlayer로 다시 판정한다). */
  endingsAchieved: Partial<Record<EndingRecordKey, number>>;
  /** 8번 캐릭터 슬롯 -> 성공/실패 카드 뽑기에서 "성공"을 뽑아 진엔딩을 본
   * 횟수. 진엔딩 텍스트는 정체와 무관하게 공용이라 정체 정보 없이 슬롯만
   * 추적한다. engine/endings.ts's trueEndingSuccessCardCount가 "이미 본
   * 적 있으면 성공 카드 1개로 제한" 판정에 쓴다. */
  trueEndingsSeen: Partial<Record<CharacterSlotId, number>>;
  lastPlayedAt: string | null;
}

function defaultRecords(): GameRecords {
  return { version: 2, sessionsPlayed: 0, endingsAchieved: {}, trueEndingsSeen: {}, lastPlayedAt: null };
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
    if (parsed?.version !== 2) return defaultRecords();
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

/** 세션이 끝날 때 한 번 호출 -- 사람 플레이어의 정체(없으면 기록할 게
 * 없으므로 스킵)와 맺어진 상대(없으면 null), 그리고 그게 8번 캐릭터의
 * 진엔딩(성공 카드를 뽑음)이었는지를 기록에 누적한다. */
export function recordSessionEnding(
  identityName: string | null,
  endingSlot: CharacterSlotId | null,
  wasTrueEnding = false
): GameRecords {
  const records = loadRecords();
  records.sessionsPlayed += 1;
  records.lastPlayedAt = new Date().toISOString();
  if (identityName) {
    const key = endingRecordKey(identityName, endingSlot);
    records.endingsAchieved[key] = (records.endingsAchieved[key] ?? 0) + 1;
    if (wasTrueEnding && endingSlot) {
      records.trueEndingsSeen[endingSlot] = (records.trueEndingsSeen[endingSlot] ?? 0) + 1;
    }
  }
  saveRecords(records);
  return records;
}

/** 정체와 무관하게, 이 8번 캐릭터 슬롯으로 일반엔딩에 도달한 총 횟수
 * (어느 정체로 도달했든 합산) -- trueEndingHistoryFor가 "일반엔딩만 본
 * 적 있는지" 판정에 쓴다. */
function totalEndingsAchievedForSlot(records: GameRecords, slot: CharacterSlotId): number {
  let total = 0;
  for (const [key, count] of Object.entries(records.endingsAchieved)) {
    if (parseEndingRecordKey(key).slot === slot) total += count ?? 0;
  }
  return total;
}

/** engine/endings.ts's trueEndingSuccessCardCount에 넘길 두 플래그를
 * 현재까지의 기록에서 읽어온다. */
export function trueEndingHistoryFor(
  records: GameRecords,
  slot: CharacterSlotId
): { hasSeenTrueEndingBefore: boolean; hasSeenNormalEndingOnlyBefore: boolean } {
  const hasSeenTrueEndingBefore = (records.trueEndingsSeen[slot] ?? 0) > 0;
  const hasSeenNormalEndingOnlyBefore = !hasSeenTrueEndingBefore && totalEndingsAchievedForSlot(records, slot) > 0;
  return { hasSeenTrueEndingBefore, hasSeenNormalEndingOnlyBefore };
}
