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
}
