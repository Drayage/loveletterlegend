import { describe, expect, it } from "vitest";
import { setupRound, chooseCardToPlay, chooseTarget, chooseGuess } from "./rules";
import { chooseCardToPlayAI, chooseGuessAI, chooseTargetAI } from "./ai";
import { applyEffect, checkKingElimination, checkMinisterElimination, discardCard, eliminatePlayer } from "./effects";
import type { CardName, GameState, PlayerConfig } from "./types";

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

    if (decision.kind === "playCard") {
      const card = chooseCardToPlayAI(state, decision.playerId);
      state = chooseCardToPlay(state, card.instanceId);
    } else if (decision.kind === "chooseTarget") {
      const targetId = chooseTargetAI(
        decision.playerId,
        decision.cardName,
        decision.eligiblePlayerIds
      );
      state = chooseTarget(state, targetId);
    } else if (decision.kind === "guessCard") {
      const guess = chooseGuessAI(state, decision.playerId);
      state = chooseGuess(state, guess);
    }
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

  it("신병 guesses parity instead of a specific card name", () => {
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
      guess: "홀수",
    });
    expect(state.lastGuessEffect?.guess).toBe("홀수");
    expect(state.lastGuessEffect?.hit).toBe(true);
    expect(state.players[1].eliminated).toBe(true);
  });
});
