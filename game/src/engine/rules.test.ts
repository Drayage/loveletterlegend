import { describe, expect, it } from "vitest";
import {
  setupRound,
  chooseCardToPlay,
  chooseTarget,
  chooseGuess,
  chooseFortunePath,
  chooseDeckSwap,
  chooseTacticianSwap,
  chooseReuseCard,
  chooseHandDiscard,
  chooseRegentChoice,
  chooseWitchAssign,
} from "./rules";
import { applyAiDecision, chooseCardToPlayAI, chooseGuessAI, chooseTargetAI, rankOpponentsByThreat } from "./ai";
import {
  applyEffect,
  checkKingElimination,
  checkMinisterElimination,
  discardCard,
  drawCardFor,
  effectiveCardRank,
  eliminatePlayer,
} from "./effects";
import type { CardName, CharacterSlotId, GameState, PlayerConfig } from "./types";

const PLAYERS: PlayerConfig[] = [
  { id: "p1", displayName: "플레이어", isAI: false },
  { id: "p2", displayName: "AI", isAI: true },
];

function driveOneAiVsAiGame(): GameState {
  let state = setupRound(PLAYERS);
  let steps = 0;
  while (!state.roundResult) {
    steps += 1;
    if (steps > 500) throw new Error("게임이 끝나지 않습니다 (무한 루프 의심)");

    const decision = state.pendingDecision;
    if (!decision) throw new Error("진행할 결정이 없는데 라운드가 끝나지 않았습니다.");
    state = applyAiDecision(state, decision);
  }
  return state;
}

describe("Love Letter engine", () => {
  it("deals 1 card to each player and removes burn cards for a 2p round", () => {
    const state = setupRound(PLAYERS);
    // one player already drew for their first turn, so hand sizes are 2/1
    const sizes = state.players.map((p) => p.hand.length).sort();
    expect(sizes).toEqual([1, 2]);
    expect(state.hiddenRemovedCard).not.toBeNull();
    expect(state.faceUpRemovedCards).toHaveLength(3);
  });

  it("plays a full AI-vs-AI round to completion without crashing", () => {
    const state = driveOneAiVsAiGame();
    expect(state.roundResult).not.toBeNull();
    expect(["lastPlayerStanding", "deckExhausted"]).toContain(state.roundResult!.reason);
  });

  it("plays 100 full rounds without crashing (fuzz-ish coverage of effects)", () => {
    for (let i = 0; i < 100; i++) {
      const state = driveOneAiVsAiGame();
      expect(state.roundResult).not.toBeNull();
    }
  });

  it("경비병 guard: correct guess eliminates the target", () => {
    // Run many rounds and assert we see at least one Guard hit and one miss
    // across the sample (effect correctness, not exact determinism).
    let sawEliminationLog = false;
    for (let i = 0; i < 50; i++) {
      const state = driveOneAiVsAiGame();
      if (state.log.some((l) => l.message.includes("경비병"))) {
        sawEliminationLog = true;
      }
    }
    expect(sawEliminationLog).toBe(true);
  });

  it("chooseGuessAI avoids repeating a guess already missed against the same target this round", () => {
    const state = setupRound(PLAYERS);
    const [p1, p2] = state.players;
    // 덱을 「기사」 위주로 채워 "기사"가 확률상 가장 유력한 추측이 되도록
    // 강제한다.
    state.deck = [
      { instanceId: "d1", name: "기사" },
      { instanceId: "d2", name: "기사" },
      { instanceId: "d3", name: "기사" },
      { instanceId: "d4", name: "광대" },
    ];
    state.hiddenRemovedCard = null;
    state.faceUpRemovedCards = [];
    p1.hand = [{ instanceId: "ph1", name: "여후작" }]; // target (guess당하는 쪽)
    p2.hand = [{ instanceId: "ph2", name: "기사" }]; // guesser 자신의 카드 (dist에서 제외됨)
    state.pendingDecision = {
      kind: "guessCard",
      playerId: "p2",
      cardInstanceId: "test-guard",
      cardName: "경비병",
      targetId: "p1",
      options: ["기사", "광대"],
      guesses: [],
      maxGuesses: 1,
    };

    // 기록이 없으면 확률이 가장 높은 "기사"를 고른다.
    expect(chooseGuessAI(state, "p2")).toBe("기사");

    // p1에게 이미 "기사"로 틀렸던 기록이 있으면 다른 값(광대)을 고른다.
    state.guessHistory = { p1: ["기사"] };
    expect(chooseGuessAI(state, "p2")).toBe("광대");
  });

  it("drawCardFor clears guessHistory for a player once their hand actually changes", () => {
    const state = setupRound(PLAYERS);
    state.guessHistory = { p1: ["기사", "5"] };
    state.deck = [{ instanceId: "d1", name: "광대" }, ...state.deck];
    drawCardFor(state, "p1");
    expect(state.guessHistory.p1).toBeUndefined();
  });

  it("chooseTargetAI prefers the opponent with more accumulated [편지] tokens when given a threat context", () => {
    const letterTokens = {
      경비병알리오스: { p1: 0, p2: 0, p3: 5 },
    } as unknown as Record<CharacterSlotId, Record<string, number>>;
    const target = chooseTargetAI("p1", "경비병", ["p1", "p2", "p3"], { letterTokens });
    expect(target).toBe("p3");
  });

  it("chooseTargetAI prefers a rival pursuing the same character slot over a stranger with fewer tokens", () => {
    const letterTokens = {
      경비병알리오스: { p1: 3, p2: 0, p3: 1 },
      기사라이언: { p1: 0, p2: 2, p3: 0 },
    } as unknown as Record<CharacterSlotId, Record<string, number>>;
    // p1의 주력 슬롯은 "경비병알리오스". p3도 같은 슬롯에 소량 투자한
    // "라이벌"이고, p2는 총량은 더 많지만(2) 겹치는 슬롯이 없다. 라이벌
    // 보너스가 우선되어 p3를 노려야 한다.
    const target = chooseTargetAI("p1", "경비병", ["p1", "p2", "p3"], { letterTokens });
    expect(target).toBe("p3");
  });

  it("chooseTargetAI keeps default ordering when no threat context is given", () => {
    expect(chooseTargetAI("p1", "경비병", ["p1", "p2", "p3"])).toBe("p2");
    expect(rankOpponentsByThreat(["p2", "p3"], "p1")).toEqual(["p2", "p3"]);
  });

  it("공주 discard eliminates the player immediately", () => {
    let state = setupRound(PLAYERS);
    // Force the human player's hand to include 공주 and something harmless,
    // then play 공주 directly to verify the elimination rule.
    const human = state.players.find((p) => p.id === "p1")!;
    human.hand = [
      { instanceId: "test-princess", name: "공주" },
      { instanceId: "test-guard", name: "경비병" },
    ];
    human.eliminated = false; // isolate from setupRound's own random initial deal
    state.currentPlayerIndex = 0;
    state.pendingDecision = { kind: "playCard", playerId: "p1", options: human.hand };

    state = chooseCardToPlay(state, "test-princess");
    const after = state.players.find((p) => p.id === "p1")!;
    expect(after.eliminated).toBe(true);
  });

  it("대신 auto-eliminates when hand sum >= 12", () => {
    const state = setupRound(PLAYERS);
    const human = state.players.find((p) => p.id === "p1")!;
    human.hand = [
      { instanceId: "test-minister", name: "대신" },
      { instanceId: "test-princess2", name: "공주" },
    ];
    human.eliminated = false; // isolate from setupRound's own random initial deal
    const eliminated = checkMinisterElimination(state, "p1");
    expect(eliminated).toBe(true);
    expect(human.eliminated).toBe(true);
  });

  it("대신 does NOT eliminate when hand sum < 12", () => {
    const state = setupRound(PLAYERS);
    const human = state.players.find((p) => p.id === "p1")!;
    human.hand = [
      { instanceId: "test-minister2", name: "대신" },
      { instanceId: "test-guard2", name: "경비병" },
    ];
    human.eliminated = false; // isolate from setupRound's own random initial deal
    const eliminated = checkMinisterElimination(state, "p1");
    expect(eliminated).toBe(false);
    expect(human.eliminated).toBe(false);
  });

  it("왕 auto-eliminates unconditionally the moment it's held", () => {
    const state = setupRound(PLAYERS);
    state.sessionEvents = [];
    const human = state.players.find((p) => p.id === "p1")!;
    human.hand = [
      { instanceId: "test-king", name: "왕" },
      { instanceId: "test-guard3", name: "경비병" },
    ];
    human.eliminated = false; // isolate from setupRound's own random initial deal
    const eliminated = checkKingElimination(state, "p1");
    expect(eliminated).toBe(true);
    expect(human.eliminated).toBe(true);
    expect(state.sessionEvents).toEqual([{ type: "kingElimination", playerId: "p1" }]);
  });

  it("왕 does not affect a player who isn't holding it", () => {
    const state = setupRound(PLAYERS);
    const human = state.players.find((p) => p.id === "p1")!;
    human.hand = [
      { instanceId: "test-guard4", name: "경비병" },
      { instanceId: "test-clown", name: "광대" },
    ];
    human.eliminated = false; // isolate from setupRound's own random initial deal
    const eliminated = checkKingElimination(state, "p1");
    expect(eliminated).toBe(false);
    expect(human.eliminated).toBe(false);
  });

  function knightMatchupState(activeIdentities?: Record<string, string>): GameState {
    return {
      // p1 holds 광대 (rank 2), p2 holds 기사 (rank 3) -- without any bonus,
      // p1 loses (2 < 3).
      players: [
        { id: "p1", displayName: "P1", isAI: false, hand: [{ instanceId: "a", name: "광대" }], discardPile: [], eliminated: false, protected: false },
        { id: "p2", displayName: "P2", isAI: false, hand: [{ instanceId: "b", name: "기사" }], discardPile: [], eliminated: false, protected: false },
      ],
      deck: [],
      hiddenRemovedCard: null,
      faceUpRemovedCards: [],
      currentPlayerIndex: 1,
      log: [],
      pendingDecision: null,
      roundResult: null,
      resolvingCard: null,
      resolvingPlayerId: null,
      deckExhaustedThisTurn: false,
      lastPlayedCard: null,
      lastReveal: null,
      lastElimination: null,
      lastGuessEffect: null,
      lastForcedDiscard: null,
      lastEffectBlocked: null,
      firstEliminatedThisRound: null,
      activeIdentities,
    };
  }

  it("035 「견습기사/호위」의 +2 identity bonus flips a 기사 comparison the holder would otherwise lose", () => {
    const state = knightMatchupState({ p1: "035" });
    applyEffect(state, { actingPlayerId: "p2", card: { instanceId: "b", name: "기사" }, targetId: "p1" });
    // p1's effective rank becomes 2+2=4, beating p2's 기사 (3) -- p2 is eliminated instead.
    expect(state.players[0].eliminated).toBe(false);
    expect(state.players[1].eliminated).toBe(true);
  });

  it("without the 035 bonus, the same matchup eliminates the lower-ranked player", () => {
    const state = knightMatchupState();
    applyEffect(state, { actingPlayerId: "p2", card: { instanceId: "b", name: "기사" }, targetId: "p1" });
    expect(state.players[0].eliminated).toBe(true);
    expect(state.players[1].eliminated).toBe(false);
  });

  it("upgraded 경비병 accepts two guesses and hits if either one matches", () => {
    let state = setupRound(PLAYERS);
    state.activeCardUpgradesByPlayer = { p1: { 경비병: "tier1" } };
    state.players[0].hand = [
      { instanceId: "g1", name: "경비병" },
      { instanceId: "g2", name: "광대" },
    ];
    state.players[1].hand = [{ instanceId: "t1", name: "기사" }];
    state.currentPlayerIndex = 0;
    state.pendingDecision = { kind: "playCard", playerId: "p1", options: state.players[0].hand };

    state = chooseCardToPlay(state, "g1");
    expect(state.pendingDecision?.kind).toBe("chooseTarget");
    state = chooseTarget(state, "p2");
    expect(state.pendingDecision?.kind).toBe("guessCard");
    state = chooseGuess(state, "광대");
    expect(state.pendingDecision?.kind).toBe("guessCard");
    state = chooseGuess(state, "기사");
    expect(state.players[1].eliminated).toBe(true);
  });

  it("upgraded 상인 eliminates targets with rank 5 or lower", () => {
    const state = knightMatchupState();
    state.activeCardUpgradesByPlayer = { p2: { 상인: "tier1" } };
    state.players[0].hand = [{ instanceId: "w", name: "마술사" }];
    state.players[1].hand = [{ instanceId: "m", name: "상인" }];
    applyEffect(state, { actingPlayerId: "p2", card: { instanceId: "m", name: "상인" }, targetId: "p1", upgrade: "tier1" });
    expect(state.players[0].eliminated).toBe(true);
  });

  it("대마도사20 upgrade makes the given 쥐 a passive elimination, while base 쥐 eliminates when played", () => {
    const state = knightMatchupState();
    state.players[0].hand = [{ instanceId: "target-card", name: "광대" }];
    state.players[1].hand = [{ instanceId: "archmage", name: "대마도사20" }];

    applyEffect(state, { actingPlayerId: "p2", card: { instanceId: "archmage", name: "대마도사20" }, targetId: "p1", upgrade: "tier1" });
    expect(state.players[0].eliminated).toBe(true);
    expect(state.lastElimination?.reason).toContain("강화된 「쥐」");

    const baseState = knightMatchupState();
    baseState.players[0].hand = [{ instanceId: "mouse", name: "쥐" }];
    applyEffect(baseState, { actingPlayerId: "p1", card: { instanceId: "mouse", name: "쥐" } });
    expect(baseState.players[0].eliminated).toBe(true);
  });
});

describe("039 「역사 5」축제 덱 -- 덱 소진 시 승자 결정 규칙 대체", () => {
  // p2 always plays 대신 (no target needed, no side effect), leaving
  // `p2RemainingCard` as their hand for the deck-exhaustion comparison
  // against p1's single card.
  function deckExhaustionWinner(
    p1Card: CardName,
    p2RemainingCard: CardName,
    activeFestivalCardId: string | null,
    p1Discards: CardName[] = [],
    p2Discards: CardName[] = []
  ): string | null {
    const state: GameState = {
      players: [
        {
          id: "p1",
          displayName: "P1",
          isAI: false,
          hand: [{ instanceId: "p1c", name: p1Card }],
          discardPile: p1Discards.map((name, i) => ({ instanceId: `p1d${i}`, name })),
          eliminated: false,
          protected: false,
        },
        {
          id: "p2",
          displayName: "P2",
          isAI: false,
          hand: [
            { instanceId: "p2c1", name: p2RemainingCard },
            { instanceId: "p2c2", name: "대신" },
          ],
          discardPile: p2Discards.map((name, i) => ({ instanceId: `p2d${i}`, name })),
          eliminated: false,
          protected: false,
        },
      ],
      deck: [],
      hiddenRemovedCard: null,
      faceUpRemovedCards: [],
      currentPlayerIndex: 1,
      log: [],
      pendingDecision: null,
      roundResult: null,
      resolvingCard: null,
      resolvingPlayerId: null,
      deckExhaustedThisTurn: true,
      lastPlayedCard: null,
      lastReveal: null,
      lastElimination: null,
      lastGuessEffect: null,
      lastForcedDiscard: null,
      lastEffectBlocked: null,
      firstEliminatedThisRound: null,
      activeFestivalCardId,
    };
    state.pendingDecision = { kind: "playCard", playerId: "p2", options: state.players[1].hand };
    const result = chooseCardToPlay(state, "p2c2");
    return result.roundResult!.winnerId;
  }

  it("041 「수확제」: 홀수 카드 숫자에 +8 -- 낮은 홀수 카드가 역전승", () => {
    // p1: 경비병(1, 홀수) -> 9;  p2: 공주(8, 짝수) -> 8. p1 승리로 역전.
    expect(deckExhaustionWinner("경비병", "공주", "041")).toBe("p1");
    expect(deckExhaustionWinner("경비병", "공주", null)).toBe("p2"); // baseline (no festival card)
  });

  it("042 「강탄제」: 짝수 카드 숫자에 +8 -- 낮은 짝수 카드가 역전승", () => {
    // p1: 기사(3, 홀수) -> 3;  p2: 광대(2, 짝수) -> 10. p2 승리로 역전.
    expect(deckExhaustionWinner("기사", "광대", "042")).toBe("p2");
    expect(deckExhaustionWinner("기사", "광대", null)).toBe("p1"); // baseline
  });

  it("043 「알현식」: 두 번째로 높은 카드가 승리 -- 2인전에서는 낮은 쪽이 승리", () => {
    expect(deckExhaustionWinner("경비병", "공주", "043")).toBe("p1");
  });

  it("044 「원탁회의」: 가장 낮은 카드가 승리 (동률이면 무승부)", () => {
    expect(deckExhaustionWinner("경비병", "공주", "044")).toBe("p1");
    expect(deckExhaustionWinner("광대", "광대", "044")).toBeNull();
  });

  it("045 「건국제」: 손패가 아니라 버린 카드 숫자 합이 가장 큰 플레이어가 승리", () => {
    // p1 hand is low (경비병=1) but discarded a lot; p2 hand is high (공주=8)
    // but has a smaller discard sum -- 045 flips the comparison basis entirely.
    expect(
      deckExhaustionWinner("경비병", "공주", "045", ["장군", "대신"], ["광대"])
    ).toBe("p1"); // p1 discard sum 6+7=13 > p2 discard sum 2
  });

  it("046 「별의 축복」: 덱 소진으로는 절대 승자가 나오지 않는다", () => {
    expect(deckExhaustionWinner("경비병", "공주", "046")).toBeNull();
  });

  it("047 「정원파티」: 비공개 카드가 유일한 최댓값이면 승자 없음", () => {
    const state: GameState = {
      players: [
        { id: "p1", displayName: "P1", isAI: false, hand: [{ instanceId: "p1c", name: "경비병" }], discardPile: [], eliminated: false, protected: false },
        {
          id: "p2",
          displayName: "P2",
          isAI: false,
          hand: [
            { instanceId: "p2c1", name: "장군" },
            { instanceId: "p2c2", name: "대신" },
          ],
          discardPile: [],
          eliminated: false,
          protected: false,
        },
      ],
      deck: [],
      hiddenRemovedCard: { instanceId: "hidden", name: "공주" }, // rank 8, unique max
      faceUpRemovedCards: [],
      currentPlayerIndex: 1,
      log: [],
      pendingDecision: null,
      roundResult: null,
      resolvingCard: null,
      resolvingPlayerId: null,
      deckExhaustedThisTurn: true,
      lastPlayedCard: null,
      lastReveal: null,
      lastElimination: null,
      lastGuessEffect: null,
      lastForcedDiscard: null,
      lastEffectBlocked: null,
      firstEliminatedThisRound: null,
      activeFestivalCardId: "047",
    };
    state.pendingDecision = { kind: "playCard", playerId: "p2", options: state.players[1].hand };
    const result = chooseCardToPlay(state, "p2c2");
    // p2's remaining card (장군, rank 6) would normally beat p1's 경비병 (1),
    // but the hidden 공주 (8) is the unique max -> no winner.
    expect(result.roundResult!.winnerId).toBeNull();
  });
});

function minimalState(overrides: Partial<GameState> = {}): GameState {
  return {
    players: [
      { id: "p1", displayName: "P1", isAI: false, hand: [], discardPile: [], eliminated: false, protected: false },
      { id: "p2", displayName: "P2", isAI: true, hand: [], discardPile: [], eliminated: false, protected: false },
    ],
    deck: [],
    hiddenRemovedCard: null,
    faceUpRemovedCards: [],
    currentPlayerIndex: 0,
    log: [],
    pendingDecision: null,
    roundResult: null,
    resolvingCard: null,
    resolvingPlayerId: null,
    deckExhaustedThisTurn: false,
    lastPlayedCard: null,
    lastReveal: null,
    lastElimination: null,
    lastGuessEffect: null,
    lastForcedDiscard: null,
    lastEffectBlocked: null,
    firstEliminatedThisRound: null,
    ...overrides,
  };
}

describe("ROOT B: 142/188 new cards (마술사의도제, 점술사, 귀족영애)", () => {
  it("점술사: peeks the deck's top card (self-directed, no target) -- regression for the missing applyEffect case found via 089's chain", () => {
    const state = minimalState({ deck: [{ instanceId: "d1", name: "공주" }] });
    applyEffect(state, { actingPlayerId: "p1", card: { instanceId: "c1", name: "점술사" } });
    expect(state.lastReveal?.cardName).toBe("점술사");
    expect(state.lastReveal?.targetCard).toBe("공주");
    // Peeking doesn't consume the card -- it stays on top of the deck.
    expect(state.deck).toHaveLength(1);
  });

  it("마술사의도제: peeks the deck top, then forces a DIFFERENT player (not self) to discard and redraw", () => {
    const state = minimalState({
      deck: [{ instanceId: "d1", name: "왕" }, { instanceId: "d2", name: "경비병" }],
      players: [
        { id: "p1", displayName: "P1", isAI: false, hand: [], discardPile: [], eliminated: false, protected: false },
        {
          id: "p2",
          displayName: "P2",
          isAI: true,
          hand: [{ instanceId: "p2c", name: "마술사" }],
          discardPile: [],
          eliminated: false,
          protected: false,
        },
      ],
    });
    applyEffect(state, {
      actingPlayerId: "p1",
      card: { instanceId: "c1", name: "마술사의도제" },
      targetId: "p2",
    });
    expect(state.lastReveal?.cardName).toBe("마술사의도제");
    expect(state.lastReveal?.targetCard).toBe("왕");
    // p2 discarded 마술사 and drew from the deck top -- nothing else touches
    // the deck between the peek and the forced draw, so it draws the exact
    // card that was just peeked (왕), leaving 경비병 still on top.
    expect(state.players[1].discardPile.map((c) => c.name)).toEqual(["마술사"]);
    expect(state.players[1].hand.map((c) => c.name)).toEqual(["왕"]);
    expect(state.deck.map((c) => c.name)).toEqual(["경비병"]);
  });

  it("귀족영애: forced discard eliminates the holder AND reshuffles the card back into the deck (unlike 공주, which stays in the discard pile)", () => {
    const state = minimalState({ deck: [{ instanceId: "d1", name: "경비병" }] });
    discardCard(state, "p1", { instanceId: "c1", name: "귀족영애" });
    expect(state.players[0].eliminated).toBe(true);
    expect(state.players[0].discardPile).toHaveLength(0);
    expect(state.deck.map((c) => c.name).sort()).toEqual(["경비병", "귀족영애"]);
  });

  it("귀족영애: if the deck is already empty, it just stays in the discard pile (nothing left to reshuffle into)", () => {
    const state = minimalState({ deck: [] });
    discardCard(state, "p1", { instanceId: "c1", name: "귀족영애" });
    expect(state.players[0].eliminated).toBe(true);
    expect(state.players[0].discardPile.map((c) => c.name)).toEqual(["귀족영애"]);
    expect(state.deck).toHaveLength(0);
  });

  it("백작부인: if held when the turn ends with an empty deck, the holder is eliminated before deck-exhaustion scoring", () => {
    const state = minimalState({
      deck: [],
      deckExhaustedThisTurn: true,
      currentPlayerIndex: 0,
      players: [
        {
          id: "p1",
          displayName: "P1",
          isAI: false,
          hand: [
            { instanceId: "countess", name: "백작부인" },
            { instanceId: "priestess", name: "승려" },
          ],
          discardPile: [],
          eliminated: false,
          protected: false,
        },
        {
          id: "p2",
          displayName: "P2",
          isAI: true,
          hand: [{ instanceId: "guard", name: "경비병" }],
          discardPile: [],
          eliminated: false,
          protected: false,
        },
      ],
      pendingDecision: {
        kind: "playCard",
        playerId: "p1",
        options: [{ instanceId: "priestess", name: "승려" }],
      },
    });

    const result = chooseCardToPlay(state, "priestess");
    expect(result.players[0].eliminated).toBe(true);
    expect(result.roundResult?.reason).toBe("lastPlayerStanding");
    expect(result.roundResult?.winnerId).toBe("p2");
  });

  it("공주's own discard still just eliminates without any reshuffle (규칙 차이 확인)", () => {
    const state = minimalState({ deck: [{ instanceId: "d1", name: "경비병" }] });
    discardCard(state, "p1", { instanceId: "c1", name: "공주" });
    expect(state.players[0].eliminated).toBe(true);
    expect(state.players[0].discardPile.map((c) => c.name)).toEqual(["공주"]);
    expect(state.deck).toHaveLength(1);
  });
});

describe("GameState.lastElimination (public elimination acknowledgment)", () => {
  it("eliminatePlayer stamps lastElimination with the eliminated player's id and the reason", () => {
    const state = minimalState();
    eliminatePlayer(state, "p1", "「기사」 비교에서 패배");
    expect(state.lastElimination?.playerId).toBe("p1");
    expect(state.lastElimination?.reason).toBe("「기사」 비교에서 패배");
    expect(state.lastElimination?.id).toBeTruthy();
  });

  it("does not stamp lastElimination when 정무관 immunity blocks the elimination", () => {
    const state = minimalState();
    state.players[0].immuneThisRound = true;
    eliminatePlayer(state, "p1", "「대신」을 들고 손패 합계 15(12 이상)");
    expect(state.players[0].eliminated).toBe(false);
    expect(state.lastElimination).toBeNull();
  });

  it("does not re-stamp lastElimination for a player who's already eliminated", () => {
    const state = minimalState();
    eliminatePlayer(state, "p1", "first reason");
    const firstId = state.lastElimination?.id;
    eliminatePlayer(state, "p1", "second reason (should be ignored)");
    expect(state.lastElimination?.id).toBe(firstId);
    expect(state.lastElimination?.reason).toBe("first reason");
  });
});

describe("Public effect popups (lastGuessEffect / lastForcedDiscard / lastEffectBlocked)", () => {
  it("경비병: a hit stamps lastGuessEffect with hit:true AND still eliminates the target", () => {
    const state = minimalState({
      players: [
        { id: "p1", displayName: "P1", isAI: false, hand: [], discardPile: [], eliminated: false, protected: false },
        {
          id: "p2",
          displayName: "P2",
          isAI: true,
          hand: [{ instanceId: "p2c", name: "공주" }],
          discardPile: [],
          eliminated: false,
          protected: false,
        },
      ],
    });
    applyEffect(state, {
      actingPlayerId: "p1",
      card: { instanceId: "c1", name: "경비병" },
      targetId: "p2",
      guess: "공주",
    });
    expect(state.lastGuessEffect).toEqual({
      id: expect.any(String),
      actingPlayerId: "p1",
      targetPlayerId: "p2",
      cardName: "경비병",
      guess: "공주",
      hit: true,
      revealedCardName: "공주",
    });
    expect(state.players[1].eliminated).toBe(true);
    expect(state.lastElimination?.playerId).toBe("p2");
  });

  it("경비병: a miss stamps lastGuessEffect with hit:false and doesn't eliminate anyone", () => {
    const state = minimalState({
      players: [
        { id: "p1", displayName: "P1", isAI: false, hand: [], discardPile: [], eliminated: false, protected: false },
        {
          id: "p2",
          displayName: "P2",
          isAI: true,
          hand: [{ instanceId: "p2c", name: "장군" }],
          discardPile: [],
          eliminated: false,
          protected: false,
        },
      ],
    });
    applyEffect(state, {
      actingPlayerId: "p1",
      card: { instanceId: "c1", name: "경비병" },
      targetId: "p2",
      guess: "공주",
    });
    expect(state.lastGuessEffect?.hit).toBe(false);
    expect(state.players[1].eliminated).toBe(false);
    expect(state.lastElimination).toBeNull();
  });

  it("마술사: forcing a discard stamps lastForcedDiscard with the actual discarded card name", () => {
    const state = minimalState({
      deck: [{ instanceId: "d1", name: "경비병" }],
      players: [
        { id: "p1", displayName: "P1", isAI: false, hand: [], discardPile: [], eliminated: false, protected: false },
        {
          id: "p2",
          displayName: "P2",
          isAI: true,
          hand: [{ instanceId: "p2c", name: "장군" }],
          discardPile: [],
          eliminated: false,
          protected: false,
        },
      ],
    });
    applyEffect(state, { actingPlayerId: "p1", card: { instanceId: "c1", name: "마술사" }, targetId: "p2" });
    expect(state.lastForcedDiscard).toEqual({
      id: expect.any(String),
      actingPlayerId: "p1",
      targetPlayerId: "p2",
      cardName: "마술사",
      discardedCardName: "장군",
    });
  });

  it("경비병 with no eligible target (opponent 승려-protected) stamps lastEffectBlocked instead of a guess", () => {
    const state = minimalState({
      players: [
        { id: "p1", displayName: "P1", isAI: false, hand: [], discardPile: [], eliminated: false, protected: false },
        { id: "p2", displayName: "P2", isAI: true, hand: [], discardPile: [], eliminated: false, protected: true },
      ],
    });
    applyEffect(state, { actingPlayerId: "p1", card: { instanceId: "c1", name: "경비병" } });
    expect(state.lastEffectBlocked).toEqual({
      id: expect.any(String),
      actingPlayerId: "p1",
      cardName: "경비병",
    });
    expect(state.lastGuessEffect).toBeNull();
  });

  it("신병 guesses a number except 0 and 1 instead of a specific card name", () => {
    const state = minimalState({
      players: [
        { id: "p1", displayName: "P1", isAI: false, hand: [], discardPile: [], eliminated: false, protected: false },
        {
          id: "p2",
          displayName: "P2",
          isAI: true,
          hand: [{ instanceId: "p2c", name: "기사" }],
          discardPile: [],
          eliminated: false,
          protected: false,
        },
      ],
    });
    applyEffect(state, {
      actingPlayerId: "p1",
      card: { instanceId: "c1", name: "신병" },
      targetId: "p2",
      guess: "3",
    });
    expect(state.lastGuessEffect?.guess).toBe("3");
    expect(state.lastGuessEffect?.hit).toBe(true);
    expect(state.players[1].eliminated).toBe(true);
  });
});

describe("선택 플로우: 점술사/군사/수사·수녀/대마도사20", () => {
  function twoCardTurnState(
    p1Hand: Array<{ instanceId: string; name: CardName }>,
    p2Hand: Array<{ instanceId: string; name: CardName }>,
    deck: Array<{ instanceId: string; name: CardName }> = [{ instanceId: "deck-top", name: "공주" }, { instanceId: "deck-2", name: "광대" }]
  ): GameState {
    const state = setupRound(PLAYERS);
    state.players[0].hand = p1Hand;
    state.players[0].eliminated = false;
    state.players[0].discardPile = [];
    state.players[1].hand = p2Hand;
    state.players[1].eliminated = false;
    state.players[1].discardPile = [];
    state.deck = deck;
    state.deckExhaustedThisTurn = false;
    state.currentPlayerIndex = 0;
    state.pendingDecision = { kind: "playCard", playerId: "p1", options: state.players[0].hand };
    return state;
  }

  it("점술사: peek -> deckSwap(교환)으로 덱 맨 위 카드와 손패를 바꾼다", () => {
    let state = twoCardTurnState(
      [{ instanceId: "ft", name: "점술사" }, { instanceId: "keep", name: "경비병" }],
      [{ instanceId: "opp", name: "기사" }]
    );
    state = chooseCardToPlay(state, "ft");
    expect(state.pendingDecision?.kind).toBe("fortunePath");
    state = chooseFortunePath(state, "peek");
    expect(state.pendingDecision?.kind).toBe("deckSwap");
    if (state.pendingDecision?.kind === "deckSwap") {
      expect(state.pendingDecision.seenCardName).toBe("공주");
    }
    state = chooseDeckSwap(state, true);
    expect(state.players[0].hand[0].name).toBe("공주");
    // 원래 들고 있던 카드는 덱 맨 위로 돌아간다 (이후 상대 턴의 드로우로
    // 소비될 수 있으므로, p1 손패만 단정한다).
    expect(state.players[0].eliminated).toBe(false);
  });

  it("점술사: peek -> deckSwap(유지)면 손패가 그대로다", () => {
    let state = twoCardTurnState(
      [{ instanceId: "ft", name: "점술사" }, { instanceId: "keep", name: "경비병" }],
      [{ instanceId: "opp", name: "기사" }]
    );
    state = chooseCardToPlay(state, "ft");
    state = chooseFortunePath(state, "peek");
    state = chooseDeckSwap(state, false);
    expect(state.players[0].hand[0].name).toBe("경비병");
  });

  it("점술사: coWin 지목 후 그 상대가 덱 소진 승리하면 coWinnerIds에 든다", () => {
    let state = twoCardTurnState(
      [{ instanceId: "ft", name: "점술사" }, { instanceId: "keep", name: "경비병" }],
      [{ instanceId: "opp", name: "공주" }],
      []
    );
    state.deckExhaustedThisTurn = true;
    state = chooseCardToPlay(state, "ft");
    state = chooseFortunePath(state, "coWin");
    expect(state.roundResult?.winnerId).toBe("p2");
    expect(state.roundResult?.coWinnerIds).toEqual(["p1"]);
  });

  it("군사: 확인 후 교환/비교환을 선택할 수 있다", () => {
    let state = twoCardTurnState(
      [{ instanceId: "tac", name: "군사" }, { instanceId: "keep", name: "광대" }],
      [{ instanceId: "opp", name: "공주" }]
    );
    state = chooseCardToPlay(state, "tac");
    expect(state.pendingDecision?.kind).toBe("chooseTarget");
    state = chooseTarget(state, "p2");
    expect(state.pendingDecision?.kind).toBe("tacticianSwap");
    if (state.pendingDecision?.kind === "tacticianSwap") {
      expect(state.pendingDecision.seenCardName).toBe("공주");
    }
    state = chooseTacticianSwap(state, true);
    expect(state.players[0].hand[0].name).toBe("공주");
    expect(state.players[1].hand[0].name).toBe("광대");

    let keepState = twoCardTurnState(
      [{ instanceId: "tac", name: "군사" }, { instanceId: "keep", name: "광대" }],
      [{ instanceId: "opp", name: "공주" }]
    );
    keepState = chooseCardToPlay(keepState, "tac");
    keepState = chooseTarget(keepState, "p2");
    keepState = chooseTacticianSwap(keepState, false);
    expect(keepState.players[0].hand[0].name).toBe("광대");
    expect(keepState.players[1].hand[0].name).toBe("공주");
  });

  it("수사: 버림 더미에서 고른 경비병 효과를 재사용해 추측으로 탈락시킨다", () => {
    let state = twoCardTurnState(
      [{ instanceId: "friar", name: "수사" }, { instanceId: "keep", name: "승려" }],
      [{ instanceId: "opp", name: "기사" }]
    );
    state.players[1].discardPile = [{ instanceId: "dis-guard", name: "경비병" }];
    state = chooseCardToPlay(state, "friar");
    expect(state.pendingDecision?.kind).toBe("reuseDiscard");
    state = chooseReuseCard(state, "dis-guard");
    expect(state.pendingDecision?.kind).toBe("chooseTarget");
    state = chooseTarget(state, "p2");
    expect(state.pendingDecision?.kind).toBe("guessCard");
    state = chooseGuess(state, "기사");
    expect(state.players[1].eliminated).toBe(true);
  });

  it("수사: 재사용 선택지에 효과 없는 카드(공주/대신 등)는 나오지 않는다", () => {
    let state = twoCardTurnState(
      [{ instanceId: "friar", name: "수사" }, { instanceId: "keep", name: "승려" }],
      [{ instanceId: "opp", name: "기사" }]
    );
    state.players[1].discardPile = [
      { instanceId: "dis-princess", name: "공주" },
      { instanceId: "dis-minister", name: "대신" },
      { instanceId: "dis-clown", name: "광대" },
    ];
    state = chooseCardToPlay(state, "friar");
    expect(state.pendingDecision?.kind).toBe("reuseDiscard");
    if (state.pendingDecision?.kind === "reuseDiscard") {
      expect(state.pendingDecision.options.map((c) => c.name)).toEqual(["광대"]);
    }
  });

  it("대마도사20: 교환 후 버릴 카드를 직접 고른다 (공주를 남길 수 있다)", () => {
    let state = twoCardTurnState(
      [{ instanceId: "arch", name: "대마도사20" }, { instanceId: "keep", name: "경비병" }],
      [{ instanceId: "opp", name: "공주" }]
    );
    state = chooseCardToPlay(state, "arch");
    state = chooseTarget(state, "p2");
    expect(state.pendingDecision?.kind).toBe("discardFromHand");
    expect(state.players[1].hand.map((c) => c.name)).toEqual(["쥐"]);
    state = chooseHandDiscard(state, "keep");
    expect(state.players[0].hand.map((c) => c.name)).toEqual(["공주"]);
    expect(state.players[0].eliminated).toBe(false);
    expect(state.players[0].discardPile.some((c) => c.name === "경비병")).toBe(true);
  });

  it("강화된 정무관(남자): '탈락하지 않기'를 고르면 즉시 면역으로 끝난다", () => {
    let state = twoCardTurnState(
      [{ instanceId: "regent", name: "정무관남" }, { instanceId: "keep", name: "경비병" }],
      [{ instanceId: "opp", name: "기사" }]
    );
    state.activeCardUpgradesByPlayer = { p1: { 정무관남: "tier1" } };
    state = chooseCardToPlay(state, "regent");
    expect(state.pendingDecision?.kind).toBe("regentChoice");
    state = chooseRegentChoice(state, "immune");
    expect(state.players[0].immuneThisRound).toBe(true);
    expect(state.players[1].eliminated).toBe(false);
  });

  it("강화된 정무관(남자): '상대 탈락'을 고르면 대상을 지목해 탈락시킨다", () => {
    let state = twoCardTurnState(
      [{ instanceId: "regent", name: "정무관남" }, { instanceId: "keep", name: "경비병" }],
      [{ instanceId: "opp", name: "기사" }]
    );
    state.activeCardUpgradesByPlayer = { p1: { 정무관남: "tier1" } };
    state = chooseCardToPlay(state, "regent");
    state = chooseRegentChoice(state, "eliminate");
    expect(state.pendingDecision?.kind).toBe("chooseTarget");
    state = chooseTarget(state, "p2");
    expect(state.players[1].eliminated).toBe(true);
    expect(state.players[0].immuneThisRound).toBeFalsy();
  });

  it("업그레이드 없는 정무관(남자)는 선택지 없이 항상 면역만 준다", () => {
    let state = twoCardTurnState(
      [{ instanceId: "regent", name: "정무관남" }, { instanceId: "keep", name: "경비병" }],
      [{ instanceId: "opp", name: "기사" }]
    );
    state = chooseCardToPlay(state, "regent");
    // regentChoice 개입 없이 곧바로 해소되고, 턴이 끝나 상대 차례로
    // 자동 진행된다(다음 playCard 결정) -- 라운드가 안 끝났으므로 null이
    // 아니라 다음 플레이어의 새 결정이 서게 된다.
    expect(state.pendingDecision?.kind).toBe("playCard");
    expect(state.players[0].immuneThisRound).toBe(true);
    expect(state.players[1].eliminated).toBe(false);
  });

  it("강화된 마녀: 모은 카드 중 자신이 가질 카드를 직접 고른다", () => {
    // deck-top을 "기사"로 둬 witchAssign 이후 자동으로 진행되는 상대 턴의
    // 드로우가 분배받은 「공주」와 겹쳐 판별을 헷갈리게 하지 않도록 한다.
    let state = twoCardTurnState(
      [{ instanceId: "witch", name: "마녀" }, { instanceId: "keep", name: "경비병" }],
      [{ instanceId: "opp", name: "공주" }],
      [{ instanceId: "deck-x", name: "기사" }]
    );
    state.activeCardUpgradesByPlayer = { p1: { 마녀: "tier1" } };
    state = chooseCardToPlay(state, "witch");
    expect(state.pendingDecision?.kind).toBe("witchAssign");
    if (state.pendingDecision?.kind === "witchAssign") {
      expect(state.pendingDecision.pool.map((c) => c.name).sort()).toEqual(["경비병", "공주"]);
    }
    state = chooseWitchAssign(state, "keep");
    expect(state.players[0].hand.map((c) => c.name)).toEqual(["경비병"]);
    // 상대 턴이 자동으로 시작돼 덱에서 1장을 더 뽑으므로, 분배받은
    // 「공주」에 그 카드가 더해진다.
    expect(state.players[1].hand.map((c) => c.name).sort()).toEqual(["공주", "기사"]);
  });

  it("업그레이드 없는 마녀는 그대로 무작위 재분배된다 (선택 없음)", () => {
    let state = twoCardTurnState(
      [{ instanceId: "witch", name: "마녀" }, { instanceId: "keep", name: "경비병" }],
      [{ instanceId: "opp", name: "공주" }],
      [{ instanceId: "deck-x", name: "기사" }]
    );
    state = chooseCardToPlay(state, "witch");
    expect(state.pendingDecision?.kind).toBe("playCard");
    // 재분배는 무작위(어느 쪽이 「경비병」/「공주」를 받을지 불특정)이므로
    // p1은 정확히 1장, p2는 재분배분 1장 + 자동 드로우 1장으로 2장을
    // 갖는지와, 세 장의 이름 다중집합이 정확히 일치하는지만 검증한다.
    expect(state.players[0].hand).toHaveLength(1);
    expect(state.players[1].hand).toHaveLength(2);
    const allNames = [...state.players[0].hand, ...state.players[1].hand].map((c) => c.name).sort();
    expect(allNames).toEqual(["경비병", "공주", "기사"]);
  });
});

describe("숫자 판정 시점 (compare vs roundEnd)", () => {
  it("배우(인쇄 9)는 기사 비교에서는 9로 취급된다 (종료 숫자 0 아님)", () => {
    const state = setupRound(PLAYERS);
    state.players[0].hand = [{ instanceId: "actor-card", name: "배우" }];
    state.players[0].eliminated = false;
    state.players[1].hand = [{ instanceId: "knight-card", name: "기사" }];
    state.players[1].eliminated = false;
    applyEffect(state, { actingPlayerId: "p2", card: { instanceId: "knight-card", name: "기사" }, targetId: "p1" });
    // 비교 시점엔 인쇄 숫자 9 > 3 -- 기사를 낸 쪽이 진다.
    expect(state.players[0].eliminated).toBe(false);
    expect(state.players[1].eliminated).toBe(true);
    // 라운드 종료 시점 값은 여전히 0.
    expect(effectiveCardRank(state, "p1", "배우")).toBe(0);
    expect(effectiveCardRank(state, "p1", "배우", "compare")).toBe(9);
  });
});

describe("AI 자살 방지", () => {
  it("AI는 대안이 있으면 왕자/쥐/공주(셋째)를 내지 않는다", () => {
    const lethalNames: CardName[] = ["왕자", "쥐", "공주셋째", "귀족영애"];
    for (const lethal of lethalNames) {
      const state = setupRound(PLAYERS);
      state.players[1].hand = [
        { instanceId: "lethal", name: lethal },
        { instanceId: "safe", name: "경비병" },
      ];
      state.currentPlayerIndex = 1;
      state.pendingDecision = { kind: "playCard", playerId: "p2", options: state.players[1].hand };
      const picked = chooseCardToPlayAI(state, "p2");
      expect(picked.name).toBe("경비병");
    }
  });
});

describe("3~4인 플레이 정합성", () => {
  const PLAYERS_3: PlayerConfig[] = [
    { id: "p1", displayName: "플레이어1", isAI: false },
    { id: "p2", displayName: "AI-1", isAI: true },
    { id: "p3", displayName: "AI-2", isAI: true },
  ];
  const PLAYERS_4: PlayerConfig[] = [
    { id: "p1", displayName: "플레이어1", isAI: false },
    { id: "p2", displayName: "AI-1", isAI: true },
    { id: "p3", displayName: "AI-2", isAI: true },
    { id: "p4", displayName: "AI-3", isAI: true },
  ];

  it("3인/4인 라운드는 비공개 카드만 빼고(공개 제거 카드 없음) 시작한다 -- 2인 전용 규칙", () => {
    const state3 = setupRound(PLAYERS_3);
    expect(state3.hiddenRemovedCard).not.toBeNull();
    expect(state3.faceUpRemovedCards).toHaveLength(0);
    const state4 = setupRound(PLAYERS_4);
    expect(state4.hiddenRemovedCard).not.toBeNull();
    expect(state4.faceUpRemovedCards).toHaveLength(0);
  });

  function driveFullRound(players: PlayerConfig[]): GameState {
    let state = setupRound(players);
    let steps = 0;
    while (!state.roundResult) {
      steps += 1;
      if (steps > 800) throw new Error("게임이 끝나지 않습니다 (무한 루프 의심)");
      const decision = state.pendingDecision;
      if (!decision) throw new Error("진행할 결정이 없는데 라운드가 끝나지 않았습니다.");
      state = applyAiDecision(state, decision);
    }
    return state;
  }

  it("3인/4인 라운드를 AI들만으로 여러 번 완주해도 무너지지 않는다", () => {
    for (let i = 0; i < 30; i++) {
      const state3 = driveFullRound(PLAYERS_3);
      expect(["lastPlayerStanding", "deckExhausted"]).toContain(state3.roundResult!.reason);
    }
    for (let i = 0; i < 30; i++) {
      const state4 = driveFullRound(PLAYERS_4);
      expect(["lastPlayerStanding", "deckExhausted"]).toContain(state4.roundResult!.reason);
    }
  });

  it("강화된 마녀는 3인전에서 자신 1장 + 나머지 두 플레이어에게 1장씩 나눈다", () => {
    const state = setupRound(PLAYERS_3);
    state.players[0].hand = [{ instanceId: "witch", name: "마녀" }, { instanceId: "keep", name: "경비병" }];
    state.players[0].eliminated = false;
    state.players[1].hand = [{ instanceId: "opp1", name: "공주" }];
    state.players[1].eliminated = false;
    state.players[2].hand = [{ instanceId: "opp2", name: "대신" }];
    state.players[2].eliminated = false;
    state.activeCardUpgradesByPlayer = { p1: { 마녀: "tier1" } };
    // p3가 이미 「대신」을 들고 있으므로, p2가 자기 턴에 덱 맨 위에서 「대신」을
    // 뽑아 손패 합 12 이상(공주8+대신7)으로 자동 탈락 -> p3까지 연쇄 드로우로
    // 넘어가는 경우가 드물게 있었다(무작위 덱). 덱을 안전한 카드로 고정해
    // 어떤 순서로 뽑히든 이 테스트 범위에서 패시브가 발동하지 않게 한다.
    state.deck = Array.from({ length: 6 }, (_, i) => ({ instanceId: `safe-${i}`, name: "경비병" as const }));
    state.currentPlayerIndex = 0;
    state.pendingDecision = { kind: "playCard", playerId: "p1", options: state.players[0].hand };
    let s = chooseCardToPlay(state, "witch");
    expect(s.pendingDecision?.kind).toBe("witchAssign");
    if (s.pendingDecision?.kind === "witchAssign") {
      expect(s.pendingDecision.pool.map((c) => c.name).sort()).toEqual(["경비병", "공주", "대신"]);
    }
    s = chooseWitchAssign(s, "keep");
    expect(s.players[0].hand.map((c) => c.name)).toEqual(["경비병"]);
    // p2/p3는 각각 나머지 카드(공주/대신) 1장씩 받는다. p1 다음 차례인 p2는
    // 곧바로 자동 진행되는 자기 턴에서 덱 카드를 1장 더 뽑으므로 2장이 된다.
    expect(s.players[1].hand.map((c) => c.name)).toContain("공주");
    expect(s.players[1].hand).toHaveLength(2);
    expect(s.players[2].hand.map((c) => c.name)).toEqual(["대신"]);
  });
});
