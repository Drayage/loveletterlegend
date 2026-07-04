import { setupRound } from "./rules";
import { ARCHIVE_CARD_SEEDS, CLOCK_MILESTONES } from "../data/scenario";
import { WIZARD_APPRENTICE } from "../data/characters";
import type { Route } from "../data/routes";
import type {
  ArchiveCardState,
  CardName,
  CharacterSlotId,
  CharacterUpgradeTier,
  GameState,
  PlayerConfig,
} from "./types";

export type { Route } from "../data/routes";
export type { CharacterSlotId } from "./types";

/** [편지] 토큰을 추적하는 캐릭터 슬롯 목록 (see engine/upgrades.ts and
 * data/characters.ts for how "마술사의도제" feeds back into gameplay).
 * Extending coverage to more of the 64 character cards later is purely a
 * matter of adding slots here + seed data -- this module's algorithms don't
 * change. */
export const ROUTE_SLOT: Record<Route, CharacterSlotId> = { 공주: "잉그리드공주", 왕자: "아레스왕자" };
export const RANK8_SLOTS: readonly CharacterSlotId[] = ["잉그리드공주", "아레스왕자"];
const ALL_SLOTS: readonly CharacterSlotId[] = ["잉그리드공주", "아레스왕자", "마술사의도제"];

/** Each player owns a finite personal pool of 10 physical [편지] tokens,
 * shared across every character slot (not a per-slot cap). Confirmed by
 * rulebook Q&A: using all 10 does NOT end the game, and once a player has
 * placed all 10, they may choose to move one of their already-placed
 * tokens between characters (or leave them where they are) instead of
 * gaining a new one. */
const LETTER_TOKEN_POOL = 10;

export interface RoundSummary {
  roundNumber: number;
  winnerId: string | null;
  clockTokensGained: number;
  letterTokensGained: Array<{ playerId: string; slot: CharacterSlotId; amount: number }>;
}

export type LetterChoice =
  | { type: "place"; slot: CharacterSlotId }
  | { type: "move"; from: CharacterSlotId; to: CharacterSlotId }
  | { type: "decline" };

export interface SessionState {
  playerConfigs: PlayerConfig[];
  round: GameState; // current single-round engine state, shape unchanged
  roundNumber: number; // 1-based
  clockTokens: number; // 카드 017 누적, 라운드 상한(8) 판정에 사용
  /** 카드 한 장(공주/왕자)의 현재 활성 면 -- 세션 전체가 공유하는 값이며
   * 플레이어별로 다르지 않다. 매 라운드 시작 시 그 라운드의 선플레이어만
   * 전환 여부를 결정하고, 다른 플레이어는 결과만 본다. */
  currentRoute: Route;
  letterTokens: Record<CharacterSlotId, Record<string /* playerId */, number>>;
  ended: boolean;
  endingReason: "roundCap" | "earlyThreshold" | null;
  playerEndings: Record<string /* playerId */, CharacterSlotId | null> | null; // null = "이루어진 상대 없음"
  overallWinnerPlayerId: string | null; // RANK8_SLOTS 중 하나와 맺어진 플레이어
  lastRoundSummary: RoundSummary | null;
  storyArchive: ArchiveCardState[];
  pendingArchivePlacement: { eligiblePlayerId: string } | null;
  /** 라운드 승자가 이번 라운드에 얻은 [편지] 토큰을 어디에 놓을지 결정할
   * 차례 -- amount는 놓일 토큰 수(공주를 들고 승리했다면 2), atCap이면
   * 놓을 자리가 없어 "이동" 또는 "이동하지 않음"만 선택 가능하다. */
  pendingLetterChoice: { playerId: string; amount: number; atCap: boolean } | null;
}

function seedArchiveCard(id: string): ArchiveCardState {
  const seed = ARCHIVE_CARD_SEEDS[id];
  if (!seed) throw new Error(`알 수 없는 이야기 보관소 카드 id: ${id}`);
  return {
    id: seed.id,
    name: seed.name,
    category: seed.category,
    art: seed.art,
    flavor: seed.flavor,
    conditions: seed.conditions.map((c) => ({ ...c, fired: false })),
    successTokens: 0,
    failTokens: 0,
  };
}

export function startSession(playerConfigs: PlayerConfig[], initialRoute: Route = "공주"): SessionState {
  const letterTokens = {} as Record<CharacterSlotId, Record<string, number>>;
  for (const slot of ALL_SLOTS) {
    letterTokens[slot] = {};
    for (const cfg of playerConfigs) letterTokens[slot][cfg.id] = 0;
  }

  return finalizeFreshRound({
    playerConfigs,
    round: { ...setupRound(playerConfigs), sessionEvents: [] },
    roundNumber: 1,
    clockTokens: 0,
    currentRoute: initialRoute,
    letterTokens,
    ended: false,
    endingReason: null,
    playerEndings: null,
    overallWinnerPlayerId: null,
    lastRoundSummary: null,
    // 017 「시간」, 018/020(잉그리드공주/아레스왕자), 023(역사1) -- exactly
    // what the rulebook's worked example shows in the archive at session
    // start (before any round-end reveal has happened).
    storyArchive: [seedArchiveCard("017"), seedArchiveCard("018"), seedArchiveCard("020"), seedArchiveCard("023")],
    pendingArchivePlacement: null,
    pendingLetterChoice: null,
  });
}

/** Central wrapper every engine call in App.tsx goes through, so round-end
 * token bookkeeping fires uniformly whether the round-ending decision was
 * made by the human or the AI. */
export function applyToRound(session: SessionState, fn: (s: GameState) => GameState): SessionState {
  const wasOver = Boolean(session.round.roundResult);
  const nextRound = fn(session.round);
  const next: SessionState = { ...session, round: nextRound };
  if (!wasOver && nextRound.roundResult) {
    return applySessionRoundEnd(next);
  }
  return next;
}

/** A freshly-created round can end immediately, before any decision is ever
 * applied through applyToRound -- e.g. 대신's passive elimination fires
 * inside setupRound/beginTurn itself if the player who's about to move
 * already qualifies. Without this, that round's token/clock bookkeeping (and
 * the round-cap check) would be silently skipped entirely. */
function finalizeFreshRound(session: SessionState): SessionState {
  if (session.round.roundResult) {
    return applySessionRoundEnd(session);
  }
  return session;
}

function addLetterToken(session: SessionState, slot: CharacterSlotId, playerId: string, amount: number): void {
  session.letterTokens[slot][playerId] = (session.letterTokens[slot][playerId] ?? 0) + amount;
}

function totalLetterTokens(session: SessionState, playerId: string): number {
  return ALL_SLOTS.reduce((sum, slot) => sum + (session.letterTokens[slot][playerId] ?? 0), 0);
}

/** Adds up to `amount` tokens without exceeding the player's 10-token pool,
 * silently dropping whatever doesn't fit. Used for the automatic (non-
 * choice) grants -- 마술사의도제 progress and the archive's shared tokens
 * aren't part of this cap, only per-player letterTokens are. This is a v1
 * simplification: unlike the round-win route award (which always gets a
 * real move-or-decline choice via pendingLetterChoice when at cap), these
 * secondary grants just get dropped once the pool is full rather than also
 * offering a reallocation prompt. */
function addLetterTokenCapped(session: SessionState, slot: CharacterSlotId, playerId: string, amount: number): number {
  const room = LETTER_TOKEN_POOL - totalLetterTokens(session, playerId);
  const applied = Math.max(0, Math.min(amount, room));
  if (applied > 0) addLetterToken(session, slot, playerId, applied);
  return applied;
}

function addArchiveToken(session: SessionState, cardId: string, token: "성공" | "실패", amount: number): void {
  const card = session.storyArchive.find((c) => c.id === cardId);
  if (!card) return;
  if (token === "성공") card.successTokens += amount;
  else card.failTokens += amount;
}

function checkClockMilestones(session: SessionState): void {
  const ids = CLOCK_MILESTONES[session.clockTokens];
  if (!ids) return;
  for (const id of ids) {
    if (!session.storyArchive.some((c) => c.id === id)) {
      session.storyArchive.push(seedArchiveCard(id));
    }
  }
}

/** Checks the 3 small archive-condition patterns (see types.ts's
 * ArchiveCondition doc comment) and reveals/removes cards accordingly.
 * Not a general Action/Condition interpreter -- just these 3 patterns,
 * which cover every card seeded in data/scenario.ts.
 *
 * `winnerCardName` is only meaningful right at round end (for 023's
 * "winnerHeldCard" branch) -- other callers (e.g. placeArchiveToken, which
 * isn't a round-end event) omit it, so that branch simply never fires
 * there. Runs to a fixed point (a reveal can itself satisfy another card's
 * condition, e.g. 023 revealing 053 lets 024's "2+ conditioned cards"
 * check see it in the same pass), which also matches the rulebook's
 * "ascending card-id" processing for this small dataset since 023 < 024. */
function resolveArchiveConditions(session: SessionState, winnerCardName?: CardName | null): void {
  let changed = true;
  while (changed) {
    changed = false;
    const toReveal = new Set<string>();
    const toRemove = new Set<string>();
    for (const card of session.storyArchive) {
      for (const cond of card.conditions) {
        if (cond.fired) continue;
        let met = false;
        if (cond.kind === "sharedToken") {
          const count = cond.token === "성공" ? card.successTokens : card.failTokens;
          met = count >= cond.threshold;
        } else if (cond.kind === "winnerHeldCard") {
          met = winnerCardName != null && winnerCardName === cond.cardName;
        } else if (cond.kind === "archiveCardCount") {
          // Doesn't count itself -- a card checking "N+ OTHER conditioned
          // cards" shouldn't satisfy its own threshold by existing.
          const otherConditionedCount = session.storyArchive.filter(
            (c) => c.id !== card.id && c.conditions.some((other) => !other.fired)
          ).length;
          met = otherConditionedCount >= cond.minCount;
        }
        if (met) {
          cond.fired = true;
          changed = true;
          cond.revealIds.forEach((id) => toReveal.add(id));
          if (cond.kind === "sharedToken") (cond.removeIds ?? []).forEach((id) => toRemove.add(id));
        }
      }
    }
    if (changed) {
      session.storyArchive = session.storyArchive.filter((c) => !toRemove.has(c.id));
      for (const id of toReveal) {
        if (!session.storyArchive.some((c) => c.id === id)) {
          session.storyArchive.push(seedArchiveCard(id));
        }
      }
    }
  }
}

function applySessionRoundEnd(session: SessionState): SessionState {
  const next: SessionState = structuredClone(session);
  const result = next.round.roundResult!;
  const winnerId = result.winnerId;
  const winnerCard = winnerId ? result.revealedHands[winnerId] : null;
  const letterGains: RoundSummary["letterTokensGained"] = [];

  next.clockTokens += 1;

  // 023 「역사 1」의 "승자가 든 카드 확인" 조건 등을 이번 라운드의 [성공]/
  // [실패] 부여보다 먼저 처리한다 -- 그래야 이번 라운드에 새로 공개되는
  // 카드(예: 053)가 존재하는 상태에서 그 아래쪽 addArchiveToken 호출이
  // 토큰을 놓을 수 있다. (반대로, 새로 공개된 카드 자신의 [조건] 충족
  // 여부는 원래 "공개된 라운드 중에는 처리하지 않는다"는 규칙이 있지만,
  // v1에서는 이 재확인을 별도로 억제하지 않는다 -- 같은 라운드에 정확히
  // 임계값에 도달하는 경우는 드물고, 억제 로직을 넣을 만큼 가치가 크지
  // 않다고 판단.)
  resolveArchiveConditions(next, winnerCard?.name ?? null);

  if (winnerId) {
    // 카드 017 「시간」: 라운드 승리 -> 공개된 공주/왕자 중 하나를 골라
    // [편지] +1 (「공주」를 들고 승리했다면 +2). 어느 캐릭터에 놓을지는
    // currentRoute와 무관하게 승자의 선택 -- see resolveLetterChoice.
    const amount = winnerCard?.name === "공주" ? 2 : 1;
    next.pendingLetterChoice = {
      playerId: winnerId,
      amount,
      atCap: totalLetterTokens(next, winnerId) >= LETTER_TOKEN_POOL,
    };

    const winner = next.round.players.find((p) => p.id === winnerId);
    const heldOrDiscardedWizard =
      winner?.hand.some((c) => c.name === "마술사") || winner?.discardPile.some((c) => c.name === "마술사");
    if (heldOrDiscardedWizard) {
      const applied = addLetterTokenCapped(next, "마술사의도제", winnerId, 2);
      if (applied > 0) letterGains.push({ playerId: winnerId, slot: "마술사의도제", amount: applied });
    }

    // 053 "고지식한 병사 1" -- 경비병을 들고/버리고 승리: 공유 [성공] +1.
    const heldOrDiscardedGuard =
      winner?.hand.some((c) => c.name === "경비병") || winner?.discardPile.some((c) => c.name === "경비병");
    if (heldOrDiscardedGuard) addArchiveToken(next, "053", "성공", 1);
  }

  for (const event of next.round.sessionEvents ?? []) {
    if (event.type === "wizardForcedDiscard") {
      const applied = addLetterTokenCapped(next, "마술사의도제", event.actingPlayerId, 1);
      if (applied > 0) letterGains.push({ playerId: event.actingPlayerId, slot: "마술사의도제", amount: applied });
    } else if (event.type === "guardGuessResolved") {
      addArchiveToken(next, "053", event.hit ? "성공" : "실패", 1);
    }
  }

  // 053: 경비병을 손에 들고 탈락 -> 공유 [실패] +1.
  for (const p of next.round.players) {
    if (p.eliminated && p.hand.some((c) => c.name === "경비병")) {
      addArchiveToken(next, "053", "실패", 1);
    }
  }

  checkClockMilestones(next);
  // Re-check now that this round's [성공]/[실패] grants (and any clock
  // milestone reveal, e.g. 024) are in.
  resolveArchiveConditions(next, winnerCard?.name ?? null);

  next.lastRoundSummary = {
    roundNumber: next.roundNumber,
    winnerId,
    clockTokensGained: 1,
    letterTokensGained: letterGains,
  };

  if (next.pendingLetterChoice) return next;
  return finalizeRoundEndDecisions(next, winnerId);
}

/** Runs once the round winner's [편지] placement (or move/decline) is
 * settled -- checks both ending conditions and, if the session continues,
 * opens the story-archive placement gate. Split out from
 * applySessionRoundEnd because the ending checks must wait for that
 * placement: the winner should still get to decide where their final
 * letter goes before token counts are read. */
function finalizeRoundEndDecisions(session: SessionState, winnerId: string | null): SessionState {
  const next = session;
  // 018/020 「잉그리드 공주/아레스 왕자」의 종료 tag: 한 플레이어가 그
  // 캐릭터 위에 [편지] 10개를 놓으면 즉시 게임 종료 (051 공개). 이건
  // "10개를 다 쓰면 게임이 계속된다"는 개인 풀 소진과는 다른 규칙 --
  // 여러 캐릭터에 나눠 놓아 풀을 다 쓴 경우엔 안 끝나지만, 한 캐릭터에
  // 몰아서 10개를 채우면 즉시 끝난다.
  for (const cfg of next.playerConfigs) {
    for (const slot of RANK8_SLOTS) {
      if ((next.letterTokens[slot][cfg.id] ?? 0) >= LETTER_TOKEN_POOL) {
        return resolveEnding(next, "earlyThreshold", winnerId ?? next.playerConfigs[0].id);
      }
    }
  }
  if (next.roundNumber >= 8) {
    return resolveEnding(next, "roundCap", winnerId ?? next.playerConfigs[0].id);
  }
  // 역사 3[031]이 공개되기 전에는 "첫 탈락자가 조건 카드에 토큰을 놓을 수
  // 있다"는 규칙 자체가 아직 존재하지 않는다.
  if (
    next.storyArchive.some((c) => c.id === "031") &&
    next.round.firstEliminatedThisRound &&
    next.storyArchive.some((c) => c.conditions.some((cond) => !cond.fired))
  ) {
    next.pendingArchivePlacement = { eligiblePlayerId: next.round.firstEliminatedThisRound };
  }
  return next;
}

/** Rulebook end-game resolution, implemented generically over ALL_SLOTS so
 * Phase 3 can extend coverage without touching this algorithm. Assumption
 * (flagged): for an early-threshold ending, "8라운드의 승자부터" is read as
 * "whoever won the round that triggered the ending" -- the rulebook text
 * assumes reaching round 8. */
function resolveEnding(
  session: SessionState,
  reason: "roundCap" | "earlyThreshold",
  startingPlayerId: string
): SessionState {
  const next: SessionState = structuredClone(session);
  const playerIds = next.playerConfigs.map((c) => c.id);
  const order = [startingPlayerId, ...playerIds.filter((id) => id !== startingPlayerId)];

  // 1. Tie-wipe: if the top count on a slot is shared by more than one
  //    player, remove all their tokens from that slot first.
  for (const slot of ALL_SLOTS) {
    const counts = playerIds.map((pid) => next.letterTokens[slot][pid] ?? 0);
    const max = Math.max(...counts, 0);
    if (max > 0 && counts.filter((c) => c === max).length > 1) {
      for (const pid of playerIds) {
        if ((next.letterTokens[slot][pid] ?? 0) === max) next.letterTokens[slot][pid] = 0;
      }
    }
  }

  // 2. Sequential claim, starting from the triggering round's winner.
  const playerEndings: Record<string, CharacterSlotId | null> = {};
  for (const pid of order) {
    let best: { slot: CharacterSlotId; count: number } | null = null;
    for (const slot of ALL_SLOTS) {
      const mine = next.letterTokens[slot][pid] ?? 0;
      if (mine <= 0) continue;
      const othersMax = Math.max(
        0,
        ...playerIds.filter((o) => o !== pid).map((o) => next.letterTokens[slot][o] ?? 0)
      );
      if (mine > othersMax && (!best || mine > best.count)) best = { slot, count: mine };
    }
    playerEndings[pid] = best?.slot ?? null;
    // Lock in: this player's tokens elsewhere no longer matter for later
    // players' comparisons (mirrors the rulebook's "다시 위의 조건을
    // 대조합니다" reevaluation-after-removal wording). Verified correct for
    // 2 players; re-verify before extending to 3+.
    for (const slot of ALL_SLOTS) {
      if (!best || slot !== best.slot) next.letterTokens[slot][pid] = 0;
    }
  }

  next.ended = true;
  next.endingReason = reason;
  next.playerEndings = playerEndings;
  next.overallWinnerPlayerId =
    playerIds.find((pid) => {
      const slot = playerEndings[pid];
      return slot !== null && (RANK8_SLOTS as readonly string[]).includes(slot);
    }) ?? null;
  next.pendingArchivePlacement = null;
  next.pendingLetterChoice = null;
  return next;
}

function resolveActiveUpgrades(session: SessionState): Partial<Record<CardName, CharacterUpgradeTier>> {
  const upgrades: Partial<Record<CardName, CharacterUpgradeTier>> = {};
  // v1: only the human's own progress changes what their card actually
  // does/shows; the AI's progress still counts toward the ending algorithm
  // via letterTokens either way (see plan's noted asymmetry).
  const humanId = session.playerConfigs.find((p) => !p.isAI)?.id;
  if (humanId) {
    const progress = session.letterTokens["마술사의도제"][humanId] ?? 0;
    if (progress >= WIZARD_APPRENTICE.tier2.threshold) upgrades["마술사"] = "tier2";
    else if (progress >= WIZARD_APPRENTICE.tier1.threshold) upgrades["마술사"] = "tier1";
  }
  return upgrades;
}

/** 이전 라운드에서 승리한 플레이어가 새로운 라운드의 시작 플레이어(선플레이어)가
 * 된다 -- 무승부(승자 없음)면 세션 시작 시의 첫 플레이어로 되돌아간다.
 * App.tsx/ai.ts는 이 값으로 route 전환 결정권을 누구에게 물어볼지 정한다. */
export function nextRoundLeader(session: SessionState): string {
  return session.lastRoundSummary?.winnerId ?? session.playerConfigs[0].id;
}

/** `route`는 다음 라운드를 이끄는 플레이어(nextRoundLeader -- 직전 라운드
 * 승자)가 결정한다. 다른 플레이어는 결과만 본다. */
export function beginNextRound(session: SessionState, route: Route): SessionState {
  if (session.ended) throw new Error("세션이 이미 종료되었습니다.");
  if (session.pendingLetterChoice) throw new Error("편지 토큰 배치가 끝나지 않았습니다.");
  if (session.pendingArchivePlacement) throw new Error("이야기 보관소 토큰 배치가 끝나지 않았습니다.");
  const next: SessionState = structuredClone(session);
  const leaderId = nextRoundLeader(next);
  next.currentRoute = route;
  next.roundNumber += 1;
  const upgrades = resolveActiveUpgrades(next);
  next.round = { ...setupRound(next.playerConfigs, leaderId), activeCardUpgrades: upgrades, sessionEvents: [] };
  next.lastRoundSummary = null;
  return finalizeFreshRound(next);
}

/** Resolves the round winner's pendingLetterChoice: a fresh placement when
 * under the 10-token pool, or -- once the pool is full -- an optional move
 * between slots (never a fresh placement, per rulebook Q&A). */
export function resolveLetterChoice(session: SessionState, playerId: string, choice: LetterChoice): SessionState {
  const pending = session.pendingLetterChoice;
  if (!pending || pending.playerId !== playerId) {
    throw new Error("지금은 이 플레이어가 편지 토큰을 놓을 차례가 아닙니다.");
  }
  if (choice.type === "place" && pending.atCap) {
    throw new Error("편지 토큰을 이미 다 사용해 새로 놓을 수 없습니다. 이동하거나 그대로 두세요.");
  }
  if (choice.type !== "place" && !pending.atCap) {
    throw new Error("아직 편지 토큰에 여유가 있어 이동할 수 없습니다.");
  }
  if (choice.type === "place" && !(RANK8_SLOTS as readonly CharacterSlotId[]).includes(choice.slot)) {
    throw new Error("편지 토큰은 공주/왕자 캐릭터에만 놓을 수 있습니다.");
  }

  const next: SessionState = structuredClone(session);
  const letterGains: RoundSummary["letterTokensGained"] = [...(next.lastRoundSummary?.letterTokensGained ?? [])];

  if (choice.type === "place") {
    addLetterToken(next, choice.slot, playerId, pending.amount);
    letterGains.push({ playerId, slot: choice.slot, amount: pending.amount });
  } else if (choice.type === "move") {
    const available = next.letterTokens[choice.from][playerId] ?? 0;
    if (available <= 0) throw new Error(`${choice.from}에 이동시킬 토큰이 없습니다.`);
    addLetterToken(next, choice.from, playerId, -1);
    addLetterToken(next, choice.to, playerId, 1);
  }
  // "decline": no-op.

  if (next.lastRoundSummary) next.lastRoundSummary = { ...next.lastRoundSummary, letterTokensGained: letterGains };
  next.pendingLetterChoice = null;
  return finalizeRoundEndDecisions(next, next.round.roundResult?.winnerId ?? null);
}

export function placeArchiveToken(
  session: SessionState,
  playerId: string,
  cardId: string,
  token: "성공" | "실패"
): SessionState {
  if (!session.pendingArchivePlacement || session.pendingArchivePlacement.eligiblePlayerId !== playerId) {
    throw new Error("지금은 이 플레이어가 토큰을 놓을 차례가 아닙니다.");
  }
  const next: SessionState = structuredClone(session);
  addArchiveToken(next, cardId, token, 1);
  next.pendingArchivePlacement = null;
  resolveArchiveConditions(next);
  return next;
}

export function skipArchivePlacement(session: SessionState, playerId: string): SessionState {
  if (!session.pendingArchivePlacement || session.pendingArchivePlacement.eligiblePlayerId !== playerId) {
    throw new Error("지금은 이 플레이어가 토큰을 놓을 차례가 아닙니다.");
  }
  return { ...structuredClone(session), pendingArchivePlacement: null };
}
