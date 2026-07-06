import { setupRound } from "./rules";
import { ARCHIVE_CARD_SEEDS } from "../data/scenario";
import { WIZARD_APPRENTICE } from "../data/characters";
import type { Route } from "../data/routes";
import { conditionTiming } from "./types";
import type {
  ArchiveCardState,
  ArchiveConditionTiming,
  CardName,
  CharacterSlotId,
  CharacterUpgradeTier,
  DeckEffect,
  GameState,
  PlayerConfig,
  RoundEndReason,
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
const ALL_SLOTS: readonly CharacterSlotId[] = [
  "잉그리드공주",
  "아레스왕자",
  "경비병알리오스",
  "신병아니스",
  "마을소녀미란다",
  "시종트래비스",
  "시녀메이블",
  "광대제자리카드",
  "광대제자피오",
  "점술사그리셀다",
  "배우파비오",
  "무희미나",
  "기사라이언",
  "여기사캐리",
  "여상인수잔나",
  "승려올리비아",
  "수사알베르트",
  "수녀로베리아",
  "집사세바스티안",
  "마술사의도제",
  "마녀베아트릭스",
  "대마도사15알비스",
  "대마도사20알비스",
  "여장군아즈사",
  "군사시어도어",
  "정무관오즈릭",
  "정무관오즈리나",
  "여후작엘마",
  "백작부인카밀라",
  "귀족영애아나스타샤",
];

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
  roundEndReason: RoundEndReason;
  revealedHands: Array<{ playerId: string; cardName: CardName | null }>;
  clockTokensGained: number;
  letterTokensGained: Array<{ playerId: string; slot: CharacterSlotId; amount: number; reason?: string }>;
  archiveTokensGained: Array<{ cardId: string; cardName: string; token: "성공" | "실패"; amount: number; reason: string }>;
  archiveCardsRevealed: Array<{ cardId: string; cardName: string; sourceName: string; reason: string }>;
  /** Names of archive cards that hit their "[시계] N개: 이 카드를 제거"
   * expiry at this round's end -- surfaced in the round-end summary so
   * cards don't just silently vanish. */
  expiredCards: string[];
}

export type LetterChoice =
  | { type: "place"; slot: CharacterSlotId }
  | { type: "move"; from: CharacterSlotId; to: CharacterSlotId }
  | { type: "decline" };

/** 032 「역사 4」가 공개하는 6장의 "게임:정체" 카드 id 풀. */
const IDENTITY_CARD_IDS = ["033", "034", "035", "036", "037", "038"];
/** 039 「역사 5」가 공개하는 8장의 "게임:축제" 카드 id 풀. */
const FESTIVAL_CARD_IDS = ["040", "041", "042", "043", "044", "045", "046", "047"];

function shuffledCopy<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

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
  /** 025 「국왕 랜들 3세」가 등장하면 덱에 추가되는 「왕」처럼, 세션 진행 중
   * 이야기 보관소 공개로 인해 기본 16장 덱에 permanently 추가되는 카드
   * 이름 목록 -- 매 라운드 setupRound에 그대로 넘긴다. */
  extraDeckCardNames: CardName[];
  /** 032가 공개하면 채워지는, 아직 아무도 고르지 않은 「정체」 카드 id 풀
   * (033~038). 032가 아직 공개되지 않았다면 빈 배열. */
  identityPool: string[];
  /** playerId -> 배정된 「정체」 카드 id (아직 없으면 null). */
  playerIdentities: Record<string, string | null>;
  /** 탈락했지만 아직 「정체」가 없는 플레이어가 라운드 종료 시 하나를 골라야
   * 하는 차례 -- see chooseIdentity. */
  pendingIdentityChoice: { eligiblePlayerId: string; options: string[] } | null;
  /** 039가 공개하면 채워지는 "축제 덱" -- 매 라운드 시작시 맨 위 카드를
   * 뽑아 그 라운드의 GameState.activeFestivalCardId로 넘기고, 라운드
   * 종료시 맨 아래로 되돌린다 (see beginNextRound/applySessionRoundEnd). */
  festivalDeck: string[];
  /** 023의 나머지 분기들이 실카드의 [등장] 태그로 기존 base 카드를 영구히
   * 대체할 때, 제거된 쪽의 이름을 하나씩 쌓아둔다 (see engine/deck.ts's
   * shuffledDeck, engine/session.ts's applyDeckEffect). */
  removedBaseCardNames: CardName[];
  /** 실카드의 "선택" 분기 카드가 공개되면 그 라운드 승자가 옵션 중 하나를
   * 골라야 하는 차례 -- see resolveArchiveChoice. */
  pendingChoice: { cardId: string; eligiblePlayerId: string; options: Array<{ id: string; label: string }> } | null;
  /** 가장 최근에 해소된 "선택" 결과 -- 어떤 선택지들이 있었고 그중 무엇을
   * 누가 골랐는지 UI에 보여주기 위한 것 (see resolveArchiveChoice). 다음
   * 선택이 해소될 때까지 유지되며, 세션이 끝나도 지워지지 않는다 --
   * App.tsx는 참조 동일성으로 "이미 보여준 결과"를 구분한다. */
  lastResolvedChoice: ResolvedChoiceInfo | null;
  /** Every archive card ever revealed this session, keyed by id -- an
   * append-only companion to `storyArchive` (which only holds currently
   * ACTIVE cards; entries leave `storyArchive` once consumed by a fired
   * sharedToken condition, a resolved 선택, an autoRevealIds cascade, or
   * expiry). Without this, the Story Archive UI would lose access to
   * everything the player has already unlocked the moment it's consumed --
   * see pushArchiveCard. */
  archiveHistory: Record<string, ArchiveCardState>;
}

/** See SessionState.lastResolvedChoice. */
export interface ResolvedChoiceInfo {
  cardId: string;
  cardName: string;
  options: Array<{ id: string; label: string }>;
  chosenOptionId: string;
  chosenBy: string;
}

function seedArchiveCard(id: string, revealedFrom?: ArchiveCardState["revealedFrom"]): ArchiveCardState {
  const seed = ARCHIVE_CARD_SEEDS[id];
  if (!seed) throw new Error(`알 수 없는 이야기 보관소 카드 id: ${id}`);
  return {
    id: seed.id,
    name: seed.name,
    category: seed.category,
    art: seed.art,
    flavor: seed.flavor,
    conditionTag: seed.conditionTag,
    expiresAtClock: seed.expiresAtClock,
    conditionsTitle: seed.conditionsTitle,
    conditions: seed.conditions.map((c) => ({ ...c, fired: false })),
    successTokens: 0,
    failTokens: 0,
    revealedFrom,
  };
}

/** Reveals a new archive card: adds it to the live `storyArchive` AND
 * records it into `archiveHistory` -- the SAME object reference on
 * purpose, so later `addArchiveToken`/condition-firing mutations (which
 * only touch the live `storyArchive` entry) stay visible through history
 * too, even after the card is later filtered out of `storyArchive`.
 * structuredClone (used throughout this module) preserves shared
 * references within a single clone call, so this survives every clone
 * boundary the engine creates. */
function pushArchiveCard(session: SessionState, id: string, revealedFrom?: ArchiveCardState["revealedFrom"]): void {
  const card = seedArchiveCard(id, revealedFrom);
  session.storyArchive.push(card);
  session.archiveHistory[id] = card;
}

export function startSession(playerConfigs: PlayerConfig[], initialRoute: Route = "공주"): SessionState {
  const letterTokens = {} as Record<CharacterSlotId, Record<string, number>>;
  for (const slot of ALL_SLOTS) {
    letterTokens[slot] = {};
    for (const cfg of playerConfigs) letterTokens[slot][cfg.id] = 0;
  }
  const playerIdentities: Record<string, string | null> = {};
  for (const cfg of playerConfigs) playerIdentities[cfg.id] = null;

  const initialArchive = [seedArchiveCard("017"), seedArchiveCard("018"), seedArchiveCard("020"), seedArchiveCard("023")];

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
    storyArchive: initialArchive,
    pendingArchivePlacement: null,
    pendingLetterChoice: null,
    extraDeckCardNames: [],
    identityPool: [],
    playerIdentities,
    pendingIdentityChoice: null,
    festivalDeck: [],
    removedBaseCardNames: [],
    pendingChoice: null,
    lastResolvedChoice: null,
    archiveHistory: Object.fromEntries(initialArchive.map((c) => [c.id, c])),
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

/** Checks the 4 small archive-condition patterns (see types.ts's
 * ArchiveCondition doc comment) and reveals/removes cards accordingly.
 * Not a general Action/Condition interpreter -- just these 4 patterns,
 * which cover every card seeded in data/scenario.ts.
 *
 * `timing` keeps the real cards' 시작/종료 tags from interleaving: 017's
 * clock table ("roundStart") only fires from beginNextRound, everything
 * else ("roundEnd") from the round-end flow (placeArchiveToken counts as
 * part of the round-end sequence -- the 031 placement happens between
 * rounds).
 *
 * `winnerCardName` is only meaningful right at round end (for 023's
 * "winnerHeldCard" branches) -- other callers omit it, so those branches
 * simply never fire there. Runs to a fixed point (a reveal can itself
 * satisfy another card's condition, e.g. 023 revealing 053 lets 024's
 * "2+ [조건] cards" check see it in the same pass), which also matches
 * the rulebook's "ascending card-id" processing for this small dataset
 * since 023 < 024.
 *
 * Returns every id newly pushed into the archive this call, so callers can
 * react to specific reveals (e.g. 025 injecting 「왕」 into the deck, 032
 * seeding the 정체 pool, 039 seeding the 축제 덱) via applyRevealSideEffects. */
function resolveArchiveConditions(
  session: SessionState,
  timing: ArchiveConditionTiming,
  winnerCardName?: CardName | null
): Set<string> {
  const everRevealed = new Set<string>();
  let changed = true;
  while (changed) {
    changed = false;
    const toReveal = new Map<string, { sourceName: string; reason: string }>();
    const toRemove = new Set<string>();
    for (const card of session.storyArchive) {
      for (const cond of card.conditions) {
        if (cond.fired || conditionTiming(cond.kind) !== timing) continue;
        let met = false;
        if (cond.kind === "sharedToken") {
          const count = cond.token === "성공" ? card.successTokens : card.failTokens;
          met = count >= cond.threshold;
        } else if (cond.kind === "winnerHeldCard") {
          met = winnerCardName != null && winnerCardName === cond.cardName;
        } else if (cond.kind === "archiveCardCount") {
          // Only cards carrying the real [조건] tag count ("이야기 보관소에
          // 「조건」을 가진 카드가 2장 이상") -- NOT any card with an
          // unfired 시작/종료 reveal table. Doesn't count itself either.
          const conditionTaggedCount = session.storyArchive.filter(
            (c) => c.id !== card.id && c.conditionTag
          ).length;
          met = conditionTaggedCount >= cond.minCount;
        } else if (cond.kind === "clockThreshold") {
          met = session.clockTokens >= cond.threshold;
        }
        if (met) {
          cond.fired = true;
          changed = true;
          cond.revealIds.forEach((id) => {
            if (!toReveal.has(id)) toReveal.set(id, { sourceName: card.name, reason: cond.label });
          });
          (cond.removeIds ?? []).forEach((id) => toRemove.add(id));
        }
      }
    }
    if (changed) {
      session.storyArchive = session.storyArchive.filter((c) => !toRemove.has(c.id));
      for (const [id, provenance] of toReveal) {
        if (!session.storyArchive.some((c) => c.id === id)) {
          pushArchiveCard(session, id, provenance);
          everRevealed.add(id);
        }
      }
    }
  }
  return everRevealed;
}

/** 실카드의 [등장] "《X》[ID]를 덱에 추가/제거" -- ArchiveCardSeed.deckEffect
 * 데이터를 그대로 세션의 덱 구성에 반영한다. "replace"는 non-exclusive
 * 「선택 적용」조건 두 개가 같은 base 카드를 동시에 노리는 경우(e.g.
 * 164/168 -> 「장군」) 먼저 발동한 쪽만 적용되고 나머지는 조용히
 * 무시된다 (removedBaseCardNames에 이미 있으면 스킵). */
function applyDeckEffect(session: SessionState, effect: DeckEffect): void {
  if (effect.kind === "add") {
    if (!session.extraDeckCardNames.includes(effect.cardName)) session.extraDeckCardNames.push(effect.cardName);
  } else if (effect.kind === "replace") {
    if (session.removedBaseCardNames.includes(effect.removeName)) return;
    for (let i = 0; i < (effect.count ?? 1); i++) {
      session.removedBaseCardNames.push(effect.removeName);
      session.extraDeckCardNames.push(effect.addName);
    }
  } else if (effect.kind === "batch") {
    for (const removal of effect.remove ?? []) {
      for (let i = 0; i < (removal.count ?? 1); i++) {
        const extraIdx = session.extraDeckCardNames.indexOf(removal.cardName);
        if (extraIdx !== -1) {
          session.extraDeckCardNames.splice(extraIdx, 1);
        } else {
          session.removedBaseCardNames.push(removal.cardName);
        }
      }
    }
    for (const addition of effect.add ?? []) {
      for (let i = 0; i < (addition.count ?? 1); i++) {
        session.extraDeckCardNames.push(addition.cardName);
      }
    }
  } else {
    const idx = session.extraDeckCardNames.indexOf(effect.removedName);
    if (idx !== -1) session.extraDeckCardNames.splice(idx, 1);
    const ridx = session.removedBaseCardNames.indexOf(effect.restoreName);
    if (ridx !== -1) session.removedBaseCardNames.splice(ridx, 1);
  }
}

/** `choiceEligiblePlayerId` -- who gets to pick if a 「선택」 card is newly
 * revealed this call. Every choice card in this v1 slice is only ever
 * reached via a round-end condition, so callers pass that round's winner
 * (falling back to the session's first player for the rare no-winner
 * callers, e.g. 017's own round-start clock table, which never itself
 * reveals a choice card). */
function applyRevealSideEffects(
  session: SessionState,
  newlyRevealedIds: Set<string>,
  choiceEligiblePlayerId: string = session.playerConfigs[0].id
): void {
  // autoRevealIds cards (e.g. 113) can themselves reveal further cards that
  // are also autoRevealIds/deckEffect/choices holders, so this runs to a
  // fixed point rather than a single pass over the initial set.
  let pending = [...newlyRevealedIds];
  while (pending.length > 0) {
    const id = pending.shift()!;
    const seed = ARCHIVE_CARD_SEEDS[id];
    if (seed?.deckEffect) applyDeckEffect(session, seed.deckEffect);
    // 여러 선택 카드가 같은 패스에서 동시에 공개될 일은 이 v1 슬라이스엔
    // 없어 마지막 것으로 덮어써도 무방하다.
    if (seed?.choices) {
      session.pendingChoice = {
        cardId: id,
        eligiblePlayerId: choiceEligiblePlayerId,
        options: seed.choices.map((c) => ({ id: c.id, label: c.label })),
      };
    }
    if (seed?.autoRevealIds) {
      session.storyArchive = session.storyArchive.filter((c) => c.id !== id);
      for (const revealId of seed.autoRevealIds) {
        if (!session.storyArchive.some((c) => c.id === revealId)) {
          pushArchiveCard(session, revealId, { sourceName: seed.name, reason: "등장과 동시에 자동 공개" });
          pending.push(revealId);
        }
      }
    }
  }
  if (newlyRevealedIds.has("032")) {
    // 실카드: "033~038 (6장)을 공개하고 옆으로 치워 둡니다" -- 풀 전체가
    // 즉시 보관소에 드러나며, identityPool은 그중 "아직 안 고른" 것만
    // 추적하는 별도 북키핑이다 (둘 다 필요: 보관소는 표시용, 풀은 로직용).
    session.identityPool = [...IDENTITY_CARD_IDS];
    const provenance = { sourceName: ARCHIVE_CARD_SEEDS["032"].name, reason: "정체 후보 전원 공개" };
    for (const id of IDENTITY_CARD_IDS) {
      if (!session.storyArchive.some((c) => c.id === id)) pushArchiveCard(session, id, provenance);
    }
    for (const cfg of session.playerConfigs) {
      if (!(cfg.id in session.playerIdentities)) session.playerIdentities[cfg.id] = null;
    }
  }
  // 039는 이 generic 경로로 공개되지 않는다 -- 032의 "전원 정체 보유"
  // 종료 조건은 배정 직후 상태가 필요해 chooseIdentity 안의 bespoke
  // 체크에서 직접 처리한다 (거기서 festivalDeck도 함께 시딩).
}

function applySessionRoundEnd(session: SessionState): SessionState {
  const next: SessionState = structuredClone(session);
  const result = next.round.roundResult!;
  const winnerId = result.winnerId;
  const winnerCard = winnerId ? result.revealedHands[winnerId] : null;
  const letterGains: RoundSummary["letterTokensGained"] = [];
  const archiveTokensGained: RoundSummary["archiveTokensGained"] = [];
  const archiveCardsRevealed: RoundSummary["archiveCardsRevealed"] = [];
  const roundEndEligibleArchiveIds = new Set([
    ...Object.keys(next.archiveHistory),
    ...next.storyArchive.map((c) => c.id),
  ]);
  const summaryKnownArchiveIds = new Set(Object.keys(next.archiveHistory));

  const recordNewReveals = (knownIds: Set<string>) => {
    for (const card of Object.values(next.archiveHistory)) {
      if (knownIds.has(card.id)) continue;
      const from = card.revealedFrom;
      archiveCardsRevealed.push({
        cardId: card.id,
        cardName: card.name,
        sourceName: from?.sourceName ?? "이야기 진행",
        reason: from?.reason ?? "공개",
      });
      knownIds.add(card.id);
    }
  };

  const revealWithSummary = (ids: Set<string>, choiceEligiblePlayerId?: string) => {
    applyRevealSideEffects(next, ids, choiceEligiblePlayerId);
    recordNewReveals(summaryKnownArchiveIds);
  };

  const grantArchive = (cardId: string, token: "성공" | "실패", amount: number, reason: string) => {
    if (!roundEndEligibleArchiveIds.has(cardId)) return;
    const target = next.storyArchive.find((c) => c.id === cardId);
    if (!target) return;
    addArchiveToken(next, cardId, token, amount);
    archiveTokensGained.push({ cardId, cardName: target.name, token, amount, reason });
  };

  const grantCharacterLetter = (
    slot: CharacterSlotId,
    playerId: string,
    amount: number,
    reason: string,
    revealCardId?: string
  ) => {
    if (revealCardId && !roundEndEligibleArchiveIds.has(revealCardId)) return;
    const applied = addLetterTokenCapped(next, slot, playerId, amount);
    if (applied > 0) letterGains.push({ playerId, slot, amount: applied, reason });
  };

  next.clockTokens += 1;

  // 039 「역사 5」의 "종료" 태그: 이번 라운드에 사용한 축제 덱 카드를 맨
  // 아래로 되돌린다.
  if (next.round.activeFestivalCardId) {
    next.festivalDeck.push(next.round.activeFestivalCardId);
  }

  // 023 「역사 1」의 "승자가 든 카드 확인" 조건 등을 이번 라운드의 [성공]/
  // [실패] 부여보다 먼저 처리한다 -- 그래야 이번 라운드에 새로 공개되는
  // 카드(예: 053)가 존재하는 상태에서 그 아래쪽 addArchiveToken 호출이
  // 토큰을 놓을 수 있다. (반대로, 새로 공개된 카드 자신의 [조건] 충족
  // 여부는 원래 "공개된 라운드 중에는 처리하지 않는다"는 규칙이 있지만,
  // v1에서는 이 재확인을 별도로 억제하지 않는다 -- 같은 라운드에 정확히
  // 임계값에 도달하는 경우는 드물고, 억제 로직을 넣을 만큼 가치가 크지
  // 않다고 판단.)
  revealWithSummary(resolveArchiveConditions(next, "roundEnd", winnerCard?.name ?? null), winnerId ?? undefined);

  if (winnerId) {
    // 카드 017 「시간」: 라운드 승리 -> 공개된 공주/왕자 중 하나를 골라
    // [편지] +1 (「공주」를 들고 승리했다면 +2). 어느 캐릭터에 놓을지는
    // currentRoute와 무관하게 승자의 선택 -- see resolveLetterChoice.
    let amount = winnerCard?.name === "공주" ? 2 : 1;
    // 049 「역사 7」의 "중요" tag: 캐릭터 카드에 [편지]를 놓을 때 추가 +1
    // (실제 카드는 이 추가분을 "선택"으로 두지만, v1은 017 자체의 승리
    // 포상과 동일하게 자동 지급으로 단순화한다).
    if (next.storyArchive.some((c) => c.id === "049")) amount += 1;
    // 027 「왕비 릴리안」의 종료 tag: 라운드 종료시 승자는 「공주/왕자」 위에
    // 추가로 +[편지] 해도 된다. v1은 다른 라운드 승리 보너스와 함께 한 번의
    // 배치 선택으로 합산한다.
    if (next.storyArchive.some((c) => c.id === "027")) amount += 1;
    // 050 「역사 8」의 "중요" tag: 라운드 승자는 추가 +1, 「공주」를 들고
    // 승리했다면 대응 캐릭터에 추가 +2 더 (역시 자동 지급으로 단순화).
    if (next.storyArchive.some((c) => c.id === "050")) {
      amount += 1;
      if (winnerCard?.name === "공주") amount += 2;
    }
    next.pendingLetterChoice = {
      playerId: winnerId,
      amount,
      atCap: totalLetterTokens(next, winnerId) >= LETTER_TOKEN_POOL,
    };

    const winner = next.round.players.find((p) => p.id === winnerId);
    const heldOrDiscardedWizard =
      winner?.hand.some((c) => c.name === "마술사") || winner?.discardPile.some((c) => c.name === "마술사");
    if (heldOrDiscardedWizard) {
      grantCharacterLetter("마술사의도제", winnerId, 2, "「마술사」를 들거나 버린 채로 라운드 승리", "147");
    }

    // 053 "고지식한 병사"/057 "풋풋한 신병" -- 경비병/신병을 들고/버리고
    // 승리: 각 공유 [성공] +1.
    const heldOrDiscardedGuard =
      winner?.hand.some((c) => c.name === "경비병") || winner?.discardPile.some((c) => c.name === "경비병");
    if (heldOrDiscardedGuard) {
      grantArchive("053", "성공", 1, "「경비병」을 들거나 버린 채로 라운드 승리");
      grantCharacterLetter("경비병알리오스", winnerId, 2, "「경비병」을 들고 라운드 승리", "056");
    }
    const heldOrDiscardedRecruit =
      winner?.hand.some((c) => c.name === "신병") || winner?.discardPile.some((c) => c.name === "신병");
    if (heldOrDiscardedRecruit) {
      grantArchive("057", "성공", 1, "「신병」을 들거나 버린 채로 라운드 승리");
      grantCharacterLetter("신병아니스", winnerId, 3, "「신병」을 들고 라운드 승리", "061");
    }
    if (winner?.hand.some((c) => c.name === "마을소녀")) {
      grantCharacterLetter("마을소녀미란다", winnerId, 1, "「마을소녀」를 손에 들고 라운드 승리", "029");
    }
    if (winner?.discardPile.some((c) => c.name === "시종")) {
      grantArchive("063", "성공", 1, "「시종」이 버림 더미에 있는 채로 라운드 승리");
      grantCharacterLetter("시종트래비스", winnerId, 2, "「시종」이 버림 더미에 있는 채로 라운드 승리", "070");
    }
    if (winner?.discardPile.some((c) => c.name === "시녀")) {
      grantArchive("071", "성공", 1, "「시녀」가 버림 더미에 있는 채로 라운드 승리");
      grantCharacterLetter("시녀메이블", winnerId, 2, "「시녀」가 버림 더미에 있는 채로 라운드 승리", "078");
    }
    if (winner?.hand.some((c) => c.name === "광대의제자") || winner?.discardPile.some((c) => c.name === "광대의제자")) {
      grantArchive("080", "성공", 1, "「광대의 제자」를 들거나 버린 채로 라운드 승리");
      grantCharacterLetter("광대제자리카드", winnerId, 2, "「광대의 제자(남)」를 들거나 버린 채로 라운드 승리", "084");
    }
    if (winner?.hand.some((c) => c.name === "광대의제자여") || winner?.discardPile.some((c) => c.name === "광대의제자여")) {
      grantCharacterLetter("광대제자피오", winnerId, 2, "「광대의 제자(여)」를 들거나 버린 채로 라운드 승리", "087");
    }
    if (winner?.hand.some((c) => c.name === "점술사") || winner?.discardPile.some((c) => c.name === "점술사")) {
      grantArchive("089", "성공", 1, "「점술사」를 들거나 버린 채로 라운드 승리");
      grantCharacterLetter("점술사그리셀다", winnerId, 2, "「점술사」를 들거나 버린 채로 라운드 승리", "092");
    }
    if (winner?.hand.some((c) => c.name === "배우")) {
      grantArchive("094", "성공", 1, "「배우」를 손에 들고 라운드 승리");
      grantCharacterLetter("배우파비오", winnerId, 2, "「배우」를 손에 들고 라운드 승리", "097");
    }
    if (winner?.hand.some((c) => c.name === "무희")) {
      grantArchive("098", "성공", 1, "「무희」를 손에 들고 라운드 승리");
      grantCharacterLetter("무희미나", winnerId, 2, "「무희」를 손에 들고 라운드 승리", "101");
    }

    // 103 "성실한 기사"/108 "전신 갑옷 기사" -- 기사/복면기사를 손에 들고
    // 승리 (실카드는 "들고"만 명시, 버림더미는 포함하지 않는다).
    if (winner?.hand.some((c) => c.name === "기사")) {
      grantArchive("103", "성공", 1, "「기사」를 손에 들고 라운드 승리");
      grantCharacterLetter("기사라이언", winnerId, 2, "「기사」를 손에 들고 라운드 승리", "107");
    }
    if (winner?.hand.some((c) => c.name === "복면기사")) {
      grantArchive("108", "성공", 1, "「복면기사」를 손에 들고 라운드 승리");
    }
    if (winner?.hand.some((c) => c.name === "여기사")) {
      grantCharacterLetter("여기사캐리", winnerId, 2, "「여기사」를 손에 들고 라운드 승리", "111");
    }
    // 114 "수완 좋은 여상인" -- 상인을 손에 들고 승리.
    if (winner?.hand.some((c) => c.name === "상인")) {
      grantArchive("114", "성공", 1, "「상인」을 손에 들고 라운드 승리");
      grantCharacterLetter("여상인수잔나", winnerId, 2, "「상인」을 손에 들고 라운드 승리", "118");
    }

    // 119 "경건한 여승려"/123 "안색이 나쁜 수사" -- 승려/수사를 들고/버리고
    // 승리.
    if (winner?.hand.some((c) => c.name === "승려") || winner?.discardPile.some((c) => c.name === "승려")) {
      grantArchive("119", "성공", 1, "「승려」를 들거나 버린 채로 라운드 승리");
      grantCharacterLetter(
        "승려올리비아",
        winnerId,
        winner.hand.some((c) => c.name === "승려") ? 2 : 1,
        winner.hand.some((c) => c.name === "승려") ? "「승려」를 손에 들고 라운드 승리" : "「승려」를 버린 채로 라운드 승리",
        "121"
      );
    }
    if (winner?.hand.some((c) => c.name === "수사") || winner?.discardPile.some((c) => c.name === "수사")) {
      grantArchive("123", "성공", 1, "「수사」를 들거나 버린 채로 라운드 승리");
      grantCharacterLetter("수사알베르트", winnerId, 2, "「수사」를 들거나 버린 채로 라운드 승리", "127");
    }
    if (winner?.hand.some((c) => c.name === "수녀") || winner?.discardPile.some((c) => c.name === "수녀")) {
      grantCharacterLetter("수녀로베리아", winnerId, 2, "「수녀」를 들거나 버린 채로 라운드 승리", "135");
    }
    if (winner?.hand.some((c) => c.name === "집사") || winner?.discardPile.some((c) => c.name === "집사")) {
      grantCharacterLetter("집사세바스티안", winnerId, 2, "「집사」를 들거나 버린 채로 라운드 승리", "141");
    }
    if (winner?.hand.some((c) => c.name === "마녀") || winner?.discardPile.some((c) => c.name === "마녀")) {
      grantArchive("149", "성공", 1, "「마녀」를 들거나 버린 채로 라운드 승리");
      grantCharacterLetter("마녀베아트릭스", winnerId, 2, "「마녀」를 들거나 버린 채로 라운드 승리", "152");
    }
    if (winner?.hand.some((c) => c.name === "대마도사15") || winner?.discardPile.some((c) => c.name === "대마도사15")) {
      grantCharacterLetter("대마도사15알비스", winnerId, 2, "「대마도사(15세)」를 들거나 버린 채로 라운드 승리", "158");
    }
    if (winner?.hand.some((c) => c.name === "대마도사20") || winner?.discardPile.some((c) => c.name === "대마도사20")) {
      grantCharacterLetter("대마도사20알비스", winnerId, 2, "「대마도사(20세)」를 들거나 버린 채로 라운드 승리", "161");
    }

    // 162 "고민하는 장군" -- 실카드는 "버림더미에 남은 채로 승리"만 본다
    // (장군의 효과 자체가 손 교환이라 승리 시점엔 이미 버림더미에 있다).
    if (winner?.discardPile.some((c) => c.name === "장군")) {
      grantArchive("162", "성공", 1, "「장군」을 버림더미에 남긴 채로 라운드 승리");
    }
    // 164 "떠넘기기" -- 여장군을 손에 들고 승리 (일회성 확인이지만
    // sharedToken threshold=1로 모델링해 기존 공개/제거 메커니즘을 재사용).
    if (winner?.hand.some((c) => c.name === "여장군")) {
      grantArchive("164", "성공", 1, "「여장군」을 손에 들고 라운드 승리");
      grantCharacterLetter("여장군아즈사", winnerId, 3, "「여장군」을 손에 들고 라운드 승리", "167");
    }
    // 168 "표표한 군사" -- 군사를 들고/버리고 승리.
    if (winner?.hand.some((c) => c.name === "군사") || winner?.discardPile.some((c) => c.name === "군사")) {
      grantArchive("168", "성공", 1, "「군사」를 들거나 버린 채로 라운드 승리");
      grantCharacterLetter("군사시어도어", winnerId, 2, "「군사」를 들거나 버린 채로 라운드 승리", "171");
    }

    // 172 "우려하는 대신"/182 "분주한 여후작" -- 대신/여후작을 들고/버리고
    // 승리.
    if (winner?.hand.some((c) => c.name === "대신") || winner?.discardPile.some((c) => c.name === "대신")) {
      grantArchive("172", "성공", 1, "「대신」을 들거나 버린 채로 라운드 승리");
    }
    if (winner?.hand.some((c) => c.name === "정무관남") || winner?.discardPile.some((c) => c.name === "정무관남")) {
      grantArchive("174", "성공", 1, "「정무관(남자)」를 들거나 버린 채로 라운드 승리");
      grantCharacterLetter("정무관오즈릭", winnerId, 2, "「정무관(남자)」를 들거나 버린 채로 라운드 승리", "177");
    }
    if (winner?.hand.some((c) => c.name === "여후작") || winner?.discardPile.some((c) => c.name === "여후작")) {
      grantArchive("182", "성공", 1, "「여후작」을 들거나 버린 채로 라운드 승리");
      grantCharacterLetter("여후작엘마", winnerId, 3, "「여후작」을 들거나 버린 채로 라운드 승리", "186");
    }

    // 153 "수수께끼의 아이" -- 마술사를 들고/버리고 승리 (일회성 확인,
    // 164/168과 동일하게 sharedToken threshold=1로 모델링).
    if (winner?.hand.some((c) => c.name === "마술사") || winner?.discardPile.some((c) => c.name === "마술사")) {
      grantArchive("153", "성공", 1, "「마술사」를 들거나 버린 채로 라운드 승리");
    }
    // 200 "거만한 귀족 영애" -- 귀족영애를 손에 들고 승리.
    if (winner?.hand.some((c) => c.name === "귀족영애")) {
      grantArchive("200", "성공", 1, "「귀족영애」를 손에 들고 라운드 승리");
      grantCharacterLetter("귀족영애아나스타샤", winnerId, 4, "「귀족영애」를 손에 들고 라운드 승리", "203");
    }
    // 196 "나른한 백작부인" -- 백작부인을 손에 들고 승리하면 198/199 공개.
    if (winner?.hand.some((c) => c.name === "백작부인")) {
      grantCharacterLetter("백작부인카밀라", winnerId, 4, "「백작부인」을 손에 들고 라운드 승리", "199");
    }
  }

  for (const event of next.round.sessionEvents ?? []) {
    if (event.type === "cardPlayed") {
      if (event.cardName === "마녀") {
        grantCharacterLetter("마녀베아트릭스", event.actingPlayerId, 1, "「마녀」를 플레이함", "152");
      } else if (event.cardName === "대마도사15") {
        grantCharacterLetter("대마도사15알비스", event.actingPlayerId, 1, "「대마도사(15세)」를 플레이함", "158");
      } else if (event.cardName === "대마도사20") {
        grantCharacterLetter("대마도사20알비스", event.actingPlayerId, 1, "「대마도사(20세)」를 플레이함", "161");
      }
    } else if (event.type === "wizardForcedDiscard") {
      grantCharacterLetter(
        "마술사의도제",
        event.actingPlayerId,
        1,
        "「마술사」로 5 이상 숫자 카드를 버리게 함",
        "147"
      );
    } else if (event.type === "guardGuessResolved") {
      // 「경비병」/「신병」이 같은 효과 로직을 공유하므로(see effects.ts),
      // 어느 카드였는지에 따라 053/057 중 맞는 쪽에 적립한다.
      const targetCardId = event.cardName === "신병" ? "057" : "053";
      grantArchive(
        targetCardId,
        event.hit ? "성공" : "실패",
        1,
        event.hit ? `「${event.cardName}」 추측 적중` : `「${event.cardName}」 추측 실패`
      );
      if (event.hit && event.cardName === "경비병") {
        grantCharacterLetter("경비병알리오스", event.actingPlayerId, 1, "「경비병」으로 다른 플레이어를 탈락시킴", "056");
      }
      if (event.hit && event.cardName === "신병") {
        grantCharacterLetter("신병아니스", event.actingPlayerId, 2, "「신병」으로 다른 플레이어를 탈락시킴", "061");
      }
    } else if (event.type === "kingElimination") {
      // 025 "도중": 《왕》 효과로 탈락한 플레이어의 총 [편지]가 8개 이상이면
      // 025에 [실패] +1.
      if (totalLetterTokens(next, event.playerId) >= 8) {
        grantArchive("025", "실패", 1, "「왕」 효과로 탈락한 플레이어가 편지 8개 이상 보유");
      }
    } else if (event.type === "compareResolved") {
      // 「기사」/「복면기사」가 같은 비교 로직을 공유하므로(see effects.ts),
      // 어느 카드였는지에 따라 103/108 중 맞는 쪽에 적립한다. 103만 "자기
      // 자신탈락" 실패 조항이 있다 (108의 실카드는 그 조항이 없음).
      if (event.cardName === "기사" || event.cardName === "복면기사" || event.cardName === "여기사" || event.cardName === "상인") {
        const targetCardId = event.cardName === "기사" ? "103" : "108";
        if (event.outcome === "targetLoses") {
          grantArchive(targetCardId, "성공", 1, `「${event.cardName}」로 다른 플레이어를 탈락시킴`);
          if (event.cardName === "기사") {
            grantCharacterLetter("기사라이언", event.actingPlayerId, 2, "「기사」로 다른 플레이어를 탈락시킴", "107");
          } else if (event.cardName === "여기사") {
            grantCharacterLetter("여기사캐리", event.actingPlayerId, 2, "「여기사」로 다른 플레이어를 탈락시킴", "111");
          } else if (event.cardName === "상인") {
            grantCharacterLetter("여상인수잔나", event.actingPlayerId, 1, "「상인」으로 다른 플레이어를 탈락시킴", "118");
          }
        }
        else if (event.outcome === "actorLoses" && event.cardName === "기사") {
          grantArchive("103", "실패", 1, "「기사」 비교로 스스로 탈락");
        }
      }
    } else if (event.type === "apprenticeForcedDiscard") {
      // 144 "도중": 「마술사의 도제」로 5 이상 숫자 카드를 버리게 함 -> 143에
      // [성공] +1 (event 자체가 이미 rank>=5 조건을 만족할 때만 push됨).
      grantArchive("143", "성공", 1, "「마술사의 도제」로 5 이상 숫자 카드를 버리게 함");
    }
  }

  // 053/057: 경비병/신병을 손에 들고 탈락 -> 각 공유 [실패] +1.
  // 103/119/123/130: 기사/승려/수사/수녀를 손에 들고 탈락 -> 각 [실패] +1.
  // 162/178/182: 장군/정무관여/여후작을 들고(또는 버리고) 탈락 -> [실패] +1.
  // 172: 대신을 손에 들고 탈락 -> [실패] +1 (실카드는 "대신 효과로 탈락"만
  // 명시하지만, v1은 원인을 구분하지 않고 "대신을 들고 탈락"으로
  // 단순화한다 -- 대신은 활성 효과가 없어 대부분 이 패시브가 원인이다).
  for (const p of next.round.players) {
    if (p.id !== winnerId && (p.hand.some((c) => c.name === "정무관여") || p.discardPile.some((c) => c.name === "정무관여"))) {
      grantArchive("178", "성공", 1, "「정무관(여자)」를 들거나 버린 채 승리하지 않고 라운드 종료");
      grantCharacterLetter("정무관오즈리나", p.id, 2, "「정무관(여자)」를 들거나 버린 채 승리하지 않고 라운드 종료", "181");
    }
    if (!p.eliminated) continue;
    if (p.hand.some((c) => c.name === "경비병")) grantArchive("053", "실패", 1, "「경비병」을 손에 들고 탈락");
    if (p.hand.some((c) => c.name === "신병")) grantArchive("057", "실패", 1, "「신병」을 손에 들고 탈락");
    if (p.hand.some((c) => c.name === "배우")) grantArchive("094", "실패", 1, "「배우」를 손에 들고 탈락");
    if (p.hand.some((c) => c.name === "무희")) grantArchive("098", "실패", 1, "「무희」를 손에 들고 탈락");
    if (p.hand.some((c) => c.name === "기사")) grantArchive("103", "실패", 1, "「기사」를 손에 들고 탈락");
    if (p.hand.some((c) => c.name === "승려")) grantArchive("119", "실패", 1, "「승려」를 손에 들고 탈락");
    if (p.hand.some((c) => c.name === "수사")) grantArchive("123", "실패", 1, "「수사」를 손에 들고 탈락");
    if (p.hand.some((c) => c.name === "수녀")) grantArchive("130", "실패", 1, "「수녀」를 손에 들고 탈락");
    if (p.discardPile.some((c) => c.name === "장군")) grantArchive("162", "실패", 1, "「장군」을 버림더미에 둔 채 탈락");
    if (p.hand.some((c) => c.name === "대신")) grantArchive("172", "실패", 1, "「대신」을 손에 들고 탈락");
    if (p.hand.some((c) => c.name === "정무관여") || p.discardPile.some((c) => c.name === "정무관여")) {
      grantArchive("178", "실패", 1, "「정무관(여자)」를 들거나 버린 채 패배");
      grantCharacterLetter("정무관오즈리나", p.id, 1, "「정무관(여자)」를 들거나 버린 채 탈락", "181");
    }
    if (p.hand.some((c) => c.name === "마술사의도제")) grantArchive("143", "실패", 1, "「마술사의 도제」를 손에 들고 탈락");
    if (p.hand.some((c) => c.name === "여후작") || p.discardPile.some((c) => c.name === "여후작")) {
      grantArchive("182", "실패", 1, "「여후작」을 들거나 버린 채 탈락");
    }
  }

  // Re-check now that this round's [성공]/[실패] grants are in.
  revealWithSummary(resolveArchiveConditions(next, "roundEnd", winnerCard?.name ?? null), winnerId ?? undefined);

  // 만료 처리 -- "[시계] N개: 이 카드를 제거합니다." 실카드 종료 태그.
  // 같은 라운드의 공개 조건을 먼저 처리한 뒤에 제거한다 (시계가 4가 되는
  // 라운드에서도 023의 승자 카드 확인은 그 라운드까지는 유효하다고 해석).
  const expired = next.storyArchive.filter(
    (c) => c.expiresAtClock != null && next.clockTokens >= c.expiresAtClock
  );
  if (expired.length > 0) {
    next.storyArchive = next.storyArchive.filter((c) => !expired.includes(c));
  }

  next.lastRoundSummary = {
    roundNumber: next.roundNumber,
    winnerId,
    roundEndReason: result.reason,
    revealedHands: next.playerConfigs.map((cfg) => ({
      playerId: cfg.id,
      cardName: result.revealedHands[cfg.id]?.name ?? null,
    })),
    clockTokensGained: 1,
    letterTokensGained: letterGains,
    archiveTokensGained,
    archiveCardsRevealed,
    expiredCards: expired.map((c) => c.name),
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

  // 050 「역사 8」의 "종료" tag: 《8(공주)》을 손에 들고 라운드에서 승리하고,
  // 대응하는 캐릭터(현재 route의 RANK8 슬롯)에 놓은 [편지]가 플레이어들
  // 중 가장 많다면 -> 051 공개. 이 시점(편지 배치가 끝난 직후)의
  // letterTokens를 읽어야 하므로 일반 조건 체커가 아닌 별도 체크로 둔다.
  if (
    winnerId &&
    next.storyArchive.some((c) => c.id === "050") &&
    !next.storyArchive.some((c) => c.id === "051") &&
    next.round.roundResult?.revealedHands[winnerId]?.name === "공주"
  ) {
    const slot = ROUTE_SLOT[next.currentRoute];
    const mine = next.letterTokens[slot][winnerId] ?? 0;
    const othersMax = Math.max(
      0,
      ...next.playerConfigs.filter((c) => c.id !== winnerId).map((c) => next.letterTokens[slot][c.id] ?? 0)
    );
    if (mine > othersMax) {
      pushArchiveCard(next, "051", {
        sourceName: ARCHIVE_CARD_SEEDS["050"].name,
        reason: "《공주》를 들고 승리, 해당 캐릭터의 [편지]가 최다",
      });
    }
  }

  // 032 「역사 4」의 "중요" tag: 이번 라운드에 탈락했지만 아직 「정체」가
  // 없는 플레이어는 남은 풀에서 하나를 골라 영구히 갖는다.
  if (next.storyArchive.some((c) => c.id === "032") && next.identityPool.length > 0) {
    const needsIdentity = next.round.players.find((p) => p.eliminated && !next.playerIdentities[p.id]);
    if (needsIdentity) {
      next.pendingIdentityChoice = { eligiblePlayerId: needsIdentity.id, options: [...next.identityPool] };
    }
  }

  // 역사 3[031]이 공개되기 전에는 "첫 탈락자가 조건 카드에 토큰을 놓을 수
  // 있다"는 규칙 자체가 아직 존재하지 않는다. 놓을 수 있는 대상도 실카드
  // 문구 그대로 "[조건]을 가진 카드"뿐이다 (053류) -- 시작/종료 공개표만
  // 가진 카드(017/023 등)에는 놓을 수 없다.
  if (
    next.storyArchive.some((c) => c.id === "031") &&
    next.round.firstEliminatedThisRound &&
    next.storyArchive.some((c) => c.conditionTag && c.conditions.some((cond) => !cond.fired))
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
  if (session.pendingIdentityChoice) throw new Error("정체 카드 선택이 끝나지 않았습니다.");
  if (session.pendingChoice) throw new Error("이야기 보관소 선택이 끝나지 않았습니다.");
  const next: SessionState = structuredClone(session);
  const leaderId = nextRoundLeader(next);
  next.currentRoute = route;
  next.roundNumber += 1;
  // 017 「시간」의 "시작" 태그: 라운드 시작 시 [시계] 개수를 확인해 공개.
  // 라운드 종료 이벤트와 순서가 섞이지 않도록 여기(다음 라운드가 실제로
  // 시작되는 시점)에서만 처리한다.
  applyRevealSideEffects(next, resolveArchiveConditions(next, "roundStart"));
  const upgrades = resolveActiveUpgrades(next);
  const activeIdentities: Record<string, string> = {};
  for (const [pid, identityId] of Object.entries(next.playerIdentities)) {
    if (identityId) activeIdentities[pid] = identityId;
  }
  // 039 「역사 5」의 "시작" 태그: 매 라운드 시작시 축제 덱에서 카드 1장 공개.
  const activeFestivalCardId =
    next.storyArchive.some((c) => c.id === "039") && next.festivalDeck.length > 0
      ? (next.festivalDeck.shift() ?? null)
      : null;
  const roundExtraDeckCardNames = [...next.extraDeckCardNames];
  if (
    next.storyArchive.some((c) => c.id === "196" || c.id === "199") &&
    !roundExtraDeckCardNames.includes("백작부인")
  ) {
    roundExtraDeckCardNames.push("백작부인");
  }
  next.round = {
    ...setupRound(next.playerConfigs, leaderId, roundExtraDeckCardNames, next.removedBaseCardNames),
    activeCardUpgrades: upgrades,
    activeIdentities,
    activeFestivalCardId,
    sessionEvents: [],
  };
  next.lastRoundSummary = null;
  return finalizeFreshRound(next);
}

/** Resolves a pending 032-triggered 「정체」 카드 선택 -- 배정은 영구적이며
 * 이후 세션 내내 유지된다. 038 「남작/여자작」을 고르면 실카드의 "획득 시
 * [편지] 2개 배치" 보너스도 함께 트리거 (기존 pendingLetterChoice 흐름
 * 재사용). 032가 전원 배정으로 완료되면 039를 공개하고 032를 제거한다
 * (배정 직후 상태가 필요해 bespoke 체크 -- 050->051과 동일 패턴). */
export function chooseIdentity(session: SessionState, playerId: string, identityId: string): SessionState {
  if (!session.pendingIdentityChoice || session.pendingIdentityChoice.eligiblePlayerId !== playerId) {
    throw new Error("지금은 이 플레이어가 정체 카드를 고를 차례가 아닙니다.");
  }
  if (!session.identityPool.includes(identityId)) {
    throw new Error("이미 선택되었거나 존재하지 않는 정체 카드입니다.");
  }
  const next: SessionState = structuredClone(session);
  next.playerIdentities[playerId] = identityId;
  next.identityPool = next.identityPool.filter((id) => id !== identityId);
  next.pendingIdentityChoice = null;

  if (identityId === "038") {
    next.pendingLetterChoice = {
      playerId,
      amount: 2,
      atCap: totalLetterTokens(next, playerId) >= LETTER_TOKEN_POOL,
    };
  }

  if (
    next.storyArchive.some((c) => c.id === "032") &&
    next.playerConfigs.every((cfg) => next.playerIdentities[cfg.id])
  ) {
    next.storyArchive = next.storyArchive.filter((c) => c.id !== "032");
    if (!next.storyArchive.some((c) => c.id === "039")) {
      pushArchiveCard(next, "039", { sourceName: ARCHIVE_CARD_SEEDS["032"].name, reason: "전원 정체 보유 완료" });
      next.festivalDeck = shuffledCopy(FESTIVAL_CARD_IDS);
    }
  }

  if (next.pendingLetterChoice) return next;
  return finalizeRoundEndDecisions(next, next.round.roundResult?.winnerId ?? null);
}

/** Resolves a pending 실카드 "선택" 분기 (052/079/105/122/173 등) -- 고른
 * 옵션이 가리키는 카드들을 공개하고, 그 옵션이 스스로의 [등장] deckEffect를
 * 가진 경우 즉시 반영한다 (see applyRevealSideEffects). 카드 자신은 실카드
 * 문구 "선택을 마친 후에 이 카드를 제거합니다."대로 보관소에서 제거된다. */
export function resolveArchiveChoice(session: SessionState, playerId: string, optionId: string): SessionState {
  if (!session.pendingChoice || session.pendingChoice.eligiblePlayerId !== playerId) {
    throw new Error("지금은 이 플레이어가 선택할 차례가 아닙니다.");
  }
  const { cardId } = session.pendingChoice;
  const seed = ARCHIVE_CARD_SEEDS[cardId];
  const option = seed?.choices?.find((o) => o.id === optionId);
  if (!option) throw new Error("존재하지 않는 선택지입니다.");

  const next: SessionState = structuredClone(session);
  next.pendingChoice = null;
  next.lastResolvedChoice = {
    cardId,
    cardName: seed.name,
    options: seed.choices!.map((c) => ({ id: c.id, label: c.label })),
    chosenOptionId: optionId,
    chosenBy: playerId,
  };
  next.storyArchive = next.storyArchive.filter((c) => c.id !== cardId);
  const newlyRevealed = new Set<string>();
  const provenance = { sourceName: seed.name, reason: option.label };
  for (const id of option.revealIds) {
    if (!next.storyArchive.some((c) => c.id === id)) {
      pushArchiveCard(next, id, provenance);
      newlyRevealed.add(id);
    }
  }
  applyRevealSideEffects(next, newlyRevealed, playerId);
  return finalizeRoundEndDecisions(next, next.round.roundResult?.winnerId ?? null);
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
    letterGains.push({ playerId, slot: choice.slot, amount: pending.amount, reason: "라운드 승리 보상" });
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
  const target = next.storyArchive.find((c) => c.id === cardId);
  if (!target?.conditionTag) {
    throw new Error("[조건]을 가진 카드 위에만 토큰을 놓을 수 있습니다.");
  }
  addArchiveToken(next, cardId, token, 1);
  next.pendingArchivePlacement = null;
  // 이 배치는 라운드 종료 시퀀스의 일부 -- 시작 태그(017의 시계표)는 여기서
  // 발동시키지 않는다.
  applyRevealSideEffects(next, resolveArchiveConditions(next, "roundEnd"));
  return next;
}

export function skipArchivePlacement(session: SessionState, playerId: string): SessionState {
  if (!session.pendingArchivePlacement || session.pendingArchivePlacement.eligiblePlayerId !== playerId) {
    throw new Error("지금은 이 플레이어가 토큰을 놓을 차례가 아닙니다.");
  }
  return { ...structuredClone(session), pendingArchivePlacement: null };
}
