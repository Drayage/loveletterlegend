export type CardName =
  | "경비병"
  | "광대"
  | "기사"
  | "승려"
  | "마술사"
  | "장군"
  | "대신"
  | "공주";

export interface CardDef {
  name: CardName;
  rank: number;
  count: number;
  /** Full rulebook wording, shown in the card reference guide. */
  ability: string;
  /** One-line summary shown on hover/tap over the card itself. */
  shortAbility: string;
  englishAlias: string;
}

export interface CardInstance {
  instanceId: string;
  name: CardName;
}

export interface PlayerConfig {
  id: string;
  displayName: string;
  isAI: boolean;
}

export interface PlayerState {
  id: string;
  displayName: string;
  isAI: boolean;
  hand: CardInstance[];
  discardPile: CardInstance[];
  eliminated: boolean;
  protected: boolean;
}

export interface LogEntry {
  id: string;
  message: string;
}

export type PendingDecision =
  | { kind: "playCard"; playerId: string; options: CardInstance[] }
  | {
      kind: "chooseTarget";
      playerId: string;
      cardInstanceId: string;
      cardName: CardName;
      eligiblePlayerIds: string[];
    }
  | {
      kind: "guessCard";
      playerId: string;
      cardInstanceId: string;
      targetId: string;
      options: CardName[];
    };

export interface RevealInfo {
  id: string;
  /** Only this player is meant to see the revealed info (mirrors the
   * physical game where only the acting player learns the result). */
  viewerPlayerId: string;
  cardName: CardName;
  targetDisplayName: string;
  /** 광대: the card seen in the target's hand. */
  targetCard?: CardName;
  /** 기사: both hands compared. */
  compare?: { actorCard: CardName; targetCard: CardName; result: "win" | "lose" | "tie" };
}

export type RoundEndReason = "lastPlayerStanding" | "deckExhausted";

export interface RoundResult {
  reason: RoundEndReason;
  winnerId: string | null; // null => tie
  revealedHands: Record<string, CardInstance | undefined>;
}

/** A card's ability text/behavior can be upgraded by a player's accumulated
 * [편지] on the character currently skinning it (see engine/upgrades.ts). */
export type CharacterUpgradeTier = "tier1" | "tier2";

export interface GameState {
  players: PlayerState[];
  deck: CardInstance[];
  hiddenRemovedCard: CardInstance | null;
  faceUpRemovedCards: CardInstance[];
  currentPlayerIndex: number;
  log: LogEntry[];
  pendingDecision: PendingDecision | null;
  roundResult: RoundResult | null;
  /** Card removed from hand via chooseCardToPlay, held here until the
   * effect finishes resolving (may still need a target/guess decision). */
  resolvingCard: CardInstance | null;
  resolvingPlayerId: string | null;
  /** True if the deck became empty from this turn's normal draw -- per the
   * rules the round ends when that player's turn finishes, regardless of
   * how many players remain. */
  deckExhaustedThisTurn: boolean;
  /** The most recent card played by anyone, shown as "the card currently in
   * play" until the next card is played (by either player). */
  lastPlayedCard: { playerId: string; card: CardInstance } | null;
  /** Private info revealed by the last-resolved effect, if any -- only
   * meaningful to whoever is named in viewerPlayerId. */
  lastReveal: RevealInfo | null;
  /** Session-driven ability upgrades active for this round (see
   * engine/session.ts / engine/upgrades.ts). Absent for callers that don't
   * know about sessions (e.g. rules.test.ts) -- everything defaults to
   * base-card behavior when this is undefined. */
  activeCardUpgrades?: Partial<Record<CardName, CharacterUpgradeTier>>;
  /** First player eliminated during this round, if any -- used by the
   * session layer's story-archive token placement (see engine/session.ts).
   * Set once per round by effects.ts's eliminatePlayer and never cleared
   * mid-round. */
  firstEliminatedThisRound?: string | null;
  /** Structured record of specific effect resolutions this round, read by
   * the session layer after the round ends to award character-progress
   * tokens (e.g. 147/056's [편지] conditions) that aren't derivable from
   * final hand/discard state alone. Only populated when the caller (see
   * engine/session.ts) initializes it to []; plain single-round callers
   * (e.g. rules.test.ts) leave it undefined and these pushes are skipped. */
  sessionEvents?: SessionEvent[];
}

export type SessionEvent =
  | { type: "guardGuessResolved"; actingPlayerId: string; hit: boolean }
  | { type: "wizardForcedDiscard"; actingPlayerId: string; targetPlayerId: string; discardedCardName: CardName };

/** Runtime state of one card sitting in the "이야기 보관소" (story archive).
 * Lives here (not engine/session.ts) so both session.ts and ai.ts can import
 * it without a circular dependency between those two modules.
 *
 * Three small, enumerable trigger patterns (not a general Action/Condition
 * interpreter -- see data/scenario.ts's module header):
 * - "sharedToken": card 031/053-style -- a shared [성공]/[실패] counter on
 *   this card reaches a threshold (e.g. 053 -> 055/056 or 062).
 * - "winnerHeldCard": card 023-style -- round-end check of what CardName
 *   the round winner held (e.g. held 「경비병」 -> reveal 053).
 * - "archiveCardCount": card 024-style -- round-end check of how many
 *   currently-revealed archive cards still have an unfired condition
 *   (e.g. 2+ such cards -> reveal 031). */
export type ArchiveCondition =
  | {
      id: string;
      kind: "sharedToken";
      token: "성공" | "실패";
      threshold: number;
      revealIds: string[];
      removeIds?: string[];
      fired: boolean;
    }
  | { id: string; kind: "winnerHeldCard"; cardName: CardName; revealIds: string[]; fired: boolean }
  | { id: string; kind: "archiveCardCount"; minCount: number; revealIds: string[]; fired: boolean };

export interface ArchiveCardState {
  id: string;
  name: string;
  /** Matches the real card's data/cards.json category -- drives the
   * 캐릭터/시나리오 split in the story archive UI. */
  category: "character" | "scenario";
  /** Portrait shown next to character cards (character-only). */
  art?: string;
  flavor: string;
  conditions: ArchiveCondition[];
  successTokens: number;
  failTokens: number;
}

/** Character "slots" whose [편지] we track for v1 (see engine/session.ts,
 * engine/upgrades.ts and data/characters.ts). Lives here (not
 * engine/session.ts) so ai.ts can reference the type without depending on
 * session.ts. */
export type CharacterSlotId = "잉그리드공주" | "아레스왕자" | "마술사의도제";
