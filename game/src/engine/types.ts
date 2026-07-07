export type CardName =
  | "경비병"
  | "광대"
  | "기사"
  | "승려"
  | "마술사"
  | "장군"
  | "대신"
  | "공주"
  | "왕자"
  /** 025 「국왕 랜들 3세」가 등장할 때 덱에 추가되는 함정 카드 (rank는 편의상
   * 0 -- 실제 카드는 "X"로 순위 비교에 참여하지 않는 특수 취급이며, 이
   * 카드는 손에 들고 있으면 즉시 탈락하는 패시브뿐이라 순위 비교 지점에
   * 아예 도달하지 않는다). */
  | "왕"
  | "마을소녀"
  // 023의 나머지 7개 분기(광대/기사/승려/장군/대신) 아래에서 실카드의
  // [등장] 태그로 기존 base 카드 중 일부를 대체/추가하는 새 게임 카드들
  // (see data/scenario.ts's ArchiveCardSeed.deckEffect).
  | "신병"
  | "시종"
  | "시녀"
  | "광대의제자"
  | "광대의제자여"
  | "점술사"
  | "배우"
  | "무희"
  | "복면기사"
  | "여기사"
  | "상인"
  | "수사"
  | "수녀"
  | "집사"
  | "마녀"
  | "대마도사15"
  | "쥐"
  | "대마도사20"
  | "여장군"
  | "군사"
  | "정무관남"
  | "정무관여"
  | "여후작"
  /** 142 「몹시 바쁜 마술사」 분기의 [143]이 마술사 1장을 이 카드로
   * 대체한다. 실카드 이름이 마술사의 own 편지-등급 시스템을 추적하는
   * `CharacterSlotId`("마술사의도제", engine/session.ts)와 우연히 같은
   * 문자열이지만, 두 타입은 서로 다른 도메인(CardName vs
   * CharacterSlotId)이라 런타임 충돌은 없다. */
  | "마술사의도제"
  | "공주둘째"
  | "공주셋째"
  /** 188 「공주님들」의 3번째 분기(195)가 마지막으로 도달하는 200 「거만한
   * 귀족 영애」의 [등장]으로 덱에 추가되는 새 rank8 카드. 188의 다른
   * 분기(루나 공주/마가렛 공주/백작부인)는 "매 라운드 시작시 선택적으로
   * 토글" 하는 새 메커니즘이 필요해 flavor-only로 남지만, 이 분기는 실카드
   * 등장 태그가 평범한 1회성 추가라 기존 deckEffect로 충분하다. */
  | "백작부인"
  | "귀족영애";

export type RankGuess = "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9";
export type GuessOption = CardName | RankGuess;

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
  /** 정무관(남자/여자)[175/179]의 "플레이: 당신은 이번 라운드에서 탈락하지
   * 않습니다." -- 승려의 "다음 차례까지"보다 강하게, 라운드가 끝날 때까지
   * 유지된다. See effects.ts's eliminatePlayer. */
  immuneThisRound?: boolean;
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
      cardName: CardName;
      targetId: string;
      options: GuessOption[];
    };

export interface RevealInfo {
  id: string;
  /** Only this player is meant to see the revealed info (mirrors the
   * physical game where only the acting player learns the result). */
  viewerPlayerId: string;
  cardName: CardName;
  actorDisplayName?: string;
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
  /** Rolling window of the last two plays (one per player in 2P) with a
   * one-line outcome summary attached once the effect resolves -- drives
   * the center table's "who played what and what happened" exchange view.
   * `outcome` is null while a freshly-played card still awaits its
   * target/guess decision. Optional for the same reason as sessionEvents:
   * bare GameState fixtures (rules.test.ts) may omit it, in which case
   * the tracking is skipped. */
  recentPlays?: Array<{ playerId: string; card: CardInstance; outcome: string | null }>;
  /** Private info revealed by the last-resolved effect, if any -- only
   * meaningful to whoever is named in viewerPlayerId. */
  lastReveal: RevealInfo | null;
  /** Public info: the most recent player to actually become eliminated
   * this round (not set for the 정무관 immunity no-op, nor for a player
   * who was already eliminated) -- unlike lastReveal, this isn't private
   * to a specific viewer, since who's eliminated and why is always public
   * knowledge. Drives a dedicated acknowledgment popup so elimination
   * doesn't feel like it happened off-screen when the local human wasn't
   * the one who caused it. `id` is used (not object identity) for
   * "already shown" tracking, since GameState gets structuredClone'd. */
  lastElimination: { id: string; playerId: string; reason: string } | null;
  /** Public: result of a 경비병/신병-style guess resolution -- both players
   * see this (unlike the private compare/peek reveals gated by
   * RevealInfo.viewerPlayerId), since a guess and its outcome are always
   * visible to both sides in the physical game. Drives a card-flip effect:
   * the target's card stays face down while the guess is announced, then
   * flips face-up ONLY if the guess was correct (hit -- revealing what it
   * actually was); on a miss the card stays face down forever, since a
   * wrong guess never reveals the target's real hand. */
  lastGuessEffect: {
    id: string;
    actingPlayerId: string;
    targetPlayerId: string;
    cardName: CardName;
    guess: GuessOption;
    hit: boolean;
    revealedCardName?: CardName;
  } | null;
  /** Public: a forced-discard resolution (마술사/마술사의도제 계열) -- shown
   * to both sides since the discard pile is always public information, so
   * silently discarding-and-redrawing behind the scenes would hide a real
   * game event from the player it happened to. */
  lastForcedDiscard: {
    id: string;
    actingPlayerId: string;
    targetPlayerId: string;
    cardName: CardName;
    discardedCardName: CardName;
  } | null;
  /** Public: an effect fizzled because it had no legal target -- in this 2P
   * implementation that only happens when the sole opponent is 승려-protected
   * (see effects.ts's eligibleTargets), so this doubles as a "blocked by
   * protection" notice. Surfaced as its own popup instead of a log-only line
   * so a turn that visibly "did nothing" still reads as an intentional
   * block, not a silent no-op/bug. */
  lastEffectBlocked: { id: string; actingPlayerId: string; cardName: CardName } | null;
  /** Session-driven ability upgrades active for this round (see
   * engine/session.ts / engine/upgrades.ts). Absent for callers that don't
   * know about sessions (e.g. rules.test.ts) -- everything defaults to
   * base-card behavior when this is undefined. */
  activeCardUpgrades?: Partial<Record<CardName, CharacterUpgradeTier>>;
  /** 032 「역사 4」로 배정된 「정체」 카드 id, playerId별 (see
   * engine/session.ts's playerIdentities). Only 035's own [지속] +2 순위
   * 보정이 이걸 참조한다 (see effects.ts's effectiveCardRank) -- 나머지
   * 5장의 능력은 v1에서 flavor 텍스트만 표시되고 미연결. */
  activeIdentities?: Record<string, string>;
  /** 039 「역사 5」가 공개하면 매 라운드 시작시 뽑는 "축제 덱" 카드 id
   * (040~047) -- 그 라운드의 덱 소진 승자 결정 규칙을 바꾼다 (see
   * rules.ts's endRound). 종료 시 engine/session.ts가 세션의 festivalDeck
   * 맨 아래로 되돌린다. */
  activeFestivalCardId?: string | null;
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
  | { type: "cardPlayed"; actingPlayerId: string; cardName: CardName }
  /** `cardName`: 「경비병」/「신병」 둘 다 이 이벤트를 쓰므로(같은 효과
   * 로직 공유, see effects.ts), 어느 카드였는지 구분해 053/057 중 맞는
   * 쪽에 [성공]/[실패]를 적립해야 한다 (see engine/session.ts). */
  | { type: "guardGuessResolved"; actingPlayerId: string; hit: boolean; cardName: CardName }
  | { type: "wizardForcedDiscard"; actingPlayerId: string; targetPlayerId: string; discardedCardName: CardName }
  /** 025 「국왕 랜들 3세」의 "도중" tag: 《왕》 효과로 탈락한 플레이어의 총
   * [편지]가 8개 이상이면 025에 [실패] +1 (see engine/session.ts). */
  | { type: "kingElimination"; playerId: string }
  /** 「기사」/「복면기사」 비교 결과 -- 103/108에 각각 필요한 "이 카드로
   * 상대를 탈락시킴"/"이 카드로 자기 자신이 탈락함" 적립에 쓰인다 (see
   * engine/session.ts). `cardName`은 어느 카드였는지(공유 로직이라
   * 구분 필요), `outcome`은 대결 결과. */
  | {
      type: "compareResolved";
      actingPlayerId: string;
      targetPlayerId: string;
      cardName: CardName;
      outcome: "actorLoses" | "targetLoses" | "tie";
    }
  /** 144's "도중" tag: 「마술사의 도제」로 5 이상 숫자 카드를 버리게 함 ->
   * 143(merged 144)에 [성공] +1. Kept separate from `wizardForcedDiscard`
   * (which feeds the unrelated "마술사의도제" CharacterSlotId letter-token
   * upgrade tier on the base 마술사 card) even though the two share a
   * display name -- see types.ts's CardName comment on 마술사의도제. */
  | { type: "apprenticeForcedDiscard"; actingPlayerId: string; targetPlayerId: string; discardedCardName: CardName };

/** Runtime state of one card sitting in the "이야기 보관소" (story archive).
 * Lives here (not engine/session.ts) so both session.ts and ai.ts can import
 * it without a circular dependency between those two modules.
 *
 * Four small, enumerable trigger patterns (not a general Action/Condition
 * interpreter -- see data/scenario.ts's module header):
 * - "sharedToken": card 053-style [조건] tag -- a shared [성공]/[실패]
 *   counter on this card reaches a threshold (e.g. 053 -> 055/056 or 062).
 * - "winnerHeldCard": card 023-style -- round-end check of what CardName
 *   the round winner held (e.g. held 「경비병」 -> reveal 053).
 * - "archiveCardCount": card 024-style -- round-end check of how many
 *   currently-revealed archive cards carry the [조건] tag (conditionTag
 *   below, NOT "has any unfired condition" -- 017/023's 시작/종료 reveal
 *   tables don't qualify as 「조건」).
 * - "clockThreshold": 017 「시간」's "시작" tag table -- checked at ROUND
 *   START ([시계] N개 이상 -> 공개), unlike the other three which resolve
 *   at round end. See conditionTiming below.
 *
 * `label` is the checklist row the story-archive UI shows -- the hypothesis
 * only (e.g. "[시계] 1개", "《1 경비병》"), never the reveal targets, so
 * what an unlock produces stays a surprise. */
export type ArchiveCondition =
  | {
      id: string;
      kind: "sharedToken";
      label: string;
      token: "성공" | "실패";
      threshold: number;
      revealIds: string[];
      removeIds?: string[];
      fired: boolean;
    }
  | {
      id: string;
      kind: "winnerHeldCard";
      label: string;
      cardName: CardName;
      revealIds: string[];
      removeIds?: string[];
      fired: boolean;
    }
  | {
      id: string;
      kind: "archiveCardCount";
      label: string;
      minCount: number;
      revealIds: string[];
      removeIds?: string[];
      fired: boolean;
    }
  | {
      id: string;
      kind: "clockThreshold";
      label: string;
      threshold: number;
      revealIds: string[];
      removeIds?: string[];
      fired: boolean;
    };

/** Real cards check their conditions at two distinct moments -- 「시작」 tags
 * at round start (017's clock table) and 「종료」 tags at round end
 * (everything else). Derived from `kind` rather than stored per-seed since
 * the mapping is inherent to what each pattern means. */
export type ArchiveConditionTiming = "roundStart" | "roundEnd";

export function conditionTiming(kind: ArchiveCondition["kind"]): ArchiveConditionTiming {
  return kind === "clockThreshold" ? "roundStart" : "roundEnd";
}

/** 실카드의 [등장] "《X》[ID]를 덱에 추가/제거" -- 카드가 처음 공개되는
 * 순간 세션의 덱 구성이 영구적으로 바뀐다 (see engine/session.ts's
 * applyDeckEffect). "replace"는 non-exclusive 「선택 적용」 조건 두 개가
 * 같은 base 카드를 동시에 노리는 경우(e.g. 164/168 -> 「장군」) 먼저
 * 발동한 쪽만 적용되고 나머지는 조용히 무시된다. */
export type DeckEffect =
  | { kind: "add"; cardName: CardName }
  | { kind: "optionalRound"; cardName: CardName }
  | { kind: "replace"; removeName: CardName; addName: CardName; count?: number }
  | {
      kind: "batch";
      add?: Array<{ cardName: CardName; count?: number }>;
      remove?: Array<{ cardName: CardName; count?: number }>;
    }
  | { kind: "revert"; removedName: CardName; restoreName: CardName };

export interface ArchiveCardState {
  id: string;
  name: string;
  /** Matches the real card's data/cards.json category -- drives the
   * 캐릭터/정체/시나리오 split in the story archive UI. "identity" is the
   * 032-revealed 033~038 "정체" card pool: unlike ordinary character cards
   * (including 잉그리드공주/아레스왕자), these never receive [편지] tokens
   * (see engine/session.ts's RANK8_SLOTS, which only ever names the two
   * route characters), so they're shown as their own section rather than
   * lumped in with 캐릭터. */
  category: "character" | "scenario" | "identity";
  /** Portrait shown next to cards that have a readable face/person cue. */
  art?: string;
  flavor: string;
  /** True for cards whose real text carries the [조건] tag (053). Only
   * these count toward 024's "「조건」을 가진 카드 2장 이상" check and only
   * these may receive 031's first-eliminated token placement. */
  conditionTag?: boolean;
  /** Real 「종료」 tag "[시계] N개: 이 카드를 제거합니다." -- the card leaves
   * the archive at the end of the round where clockTokens reaches N (that
   * same round's reveal conditions still resolve first). Shown in the UI
   * as a "남은 시간 (N주)" countdown -- 1 clock token = 1 week. */
  expiresAtClock?: number;
  /** Checklist heading shown above the conditions in the archive UI, e.g.
   * "라운드 종료 시, 승자가 든 카드 확인". */
  conditionsTitle?: string;
  conditions: ArchiveCondition[];
  successTokens: number;
  failTokens: number;
  /** Runtime provenance: which prior card/condition/choice caused this card
   * to be revealed, for display purposes only (see engine/session.ts's
   * seedArchiveCard). Undefined for the small set of session-start seeds
   * (017/018/020/023), which aren't "revealed" by anything. */
  revealedFrom?: { sourceName: string; reason: string };
}

/** Character "slots" whose [편지] we track for v1 (see engine/session.ts,
 * engine/upgrades.ts and data/characters.ts). Lives here (not
 * engine/session.ts) so ai.ts can reference the type without depending on
 * session.ts. */
export type CharacterSlotId =
  | "잉그리드공주"
  | "아레스왕자"
  | "루나공주"
  | "마가렛공주"
  | "경비병알리오스"
  | "신병아니스"
  | "마을소녀미란다"
  | "시종트래비스"
  | "시녀메이블"
  | "광대제자리카드"
  | "광대제자피오"
  | "점술사그리셀다"
  | "배우파비오"
  | "무희미나"
  | "기사라이언"
  | "여기사캐리"
  | "여상인수잔나"
  | "승려올리비아"
  | "수사알베르트"
  | "수녀로베리아"
  | "집사세바스티안"
  | "마술사의도제"
  | "마녀베아트릭스"
  | "대마도사15알비스"
  | "대마도사20알비스"
  | "여장군아즈사"
  | "군사시어도어"
  | "정무관오즈릭"
  | "정무관오즈리나"
  | "여후작엘마"
  | "백작부인카밀라"
  | "귀족영애아나스타샤";
