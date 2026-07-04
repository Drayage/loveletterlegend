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
  endingReason: "roundCap" | null;
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
    storyArchive: [seedArchiveCard("017")],
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

/** Generic condition checker: "[성공]/[실패] N개 이상 -> 카드 공개 (+선택적
 * 제거)". Not a general Action/Condition interpreter -- just this one
 * pattern, which covers every card seeded in data/scenario.ts. */
function resolveArchiveConditions(session: SessionState): void {
  let changed = true;
  while (changed) {
    changed = false;
    const toReveal = new Set<string>();
    const toRemove = new Set<string>();
    for (const card of session.storyArchive) {
      for (const cond of card.conditions) {
        if (cond.fired) continue;
        const count = cond.token === "성공" ? card.successTokens : card.failTokens;
        if (count >= cond.threshold) {
          cond.fired = true;
          changed = true;
          cond.revealIds.forEach((id) => toReveal.add(id));
          (cond.removeIds ?? []).forEach((id) => toRemove.add(id));
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
  const letterGains: RoundSummary["letterTokensGained"] = [];

  next.clockTokens += 1;

  if (winnerId) {
    // 카드 017 「시간」: 라운드 승리 -> 공개된 공주/왕자 중 하나를 골라
    // [편지] +1 (「공주」를 들고 승리했다면 +2). 어느 캐릭터에 놓을지는
    // currentRoute와 무관하게 승자의 선택 -- see resolveLetterChoice.
    const winnerCard = result.revealedHands[winnerId];
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
  resolveArchiveConditions(next);

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
 * settled -- checks the round cap and, if the session continues, opens the
 * story-archive placement gate. Split out from applySessionRoundEnd because
 * the round-cap/ending check must wait for that placement: the winner
 * should still get to decide where their final letter goes before
 * resolveEnding reads the token counts. */
function finalizeRoundEndDecisions(session: SessionState, winnerId: string | null): SessionState {
  const next = session;
  if (next.roundNumber >= 8) {
    return resolveEnding(next, "roundCap", winnerId ?? next.playerConfigs[0].id);
  }
  if (
    next.round.firstEliminatedThisRound &&
    next.storyArchive.some((c) => c.conditions.some((cond) => !cond.fired))
  ) {
    next.pendingArchivePlacement = { eligiblePlayerId: next.round.firstEliminatedThisRound };
  }
  return next;
}

/** Rulebook end-game resolution, implemented generically over ALL_SLOTS so
 * Phase 3 can extend coverage without touching this algorithm. The session
 * only ever ends via the 8-round cap (reaching a player's 10-token pool
 * does NOT end the game, per rulebook Q&A), so `startingPlayerId` is always
 * "the round-8 winner" -- no early-ending case to special-case here. */
function resolveEnding(session: SessionState, reason: "roundCap", startingPlayerId: string): SessionState {
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

/** `route` is decided by whichever player leads the upcoming round (v1: the
 * engine never rotates turn order, so that's always `playerConfigs[0]` --
 * see App.tsx/ai.ts for how that player's choice, human or AI, is sourced).
 * Other players never get an independent say; they just see the result. */
export function beginNextRound(session: SessionState, route: Route): SessionState {
  if (session.ended) throw new Error("세션이 이미 종료되었습니다.");
  if (session.pendingLetterChoice) throw new Error("편지 토큰 배치가 끝나지 않았습니다.");
  if (session.pendingArchivePlacement) throw new Error("이야기 보관소 토큰 배치가 끝나지 않았습니다.");
  const next: SessionState = structuredClone(session);
  next.currentRoute = route;
  next.roundNumber += 1;
  const upgrades = resolveActiveUpgrades(next);
  next.round = { ...setupRound(next.playerConfigs), activeCardUpgrades: upgrades, sessionEvents: [] };
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
