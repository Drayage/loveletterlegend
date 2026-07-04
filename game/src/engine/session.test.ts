import { describe, expect, it } from "vitest";
import { chooseCardToPlay, chooseTarget, chooseGuess } from "./rules";
import { chooseCardToPlayAI, chooseGuessAI, chooseTargetAI, chooseRouteAI } from "./ai";
import { needsTarget, targetsFor, applyEffect } from "./effects";
import {
  startSession,
  applyToRound,
  beginNextRound,
  placeArchiveToken,
  skipArchivePlacement,
} from "./session";
import type { Route, SessionState } from "./session";
import type { PlayerConfig, GameState } from "./types";

const PLAYERS: PlayerConfig[] = [
  { id: "p1", displayName: "플레이어", isAI: false },
  { id: "p2", displayName: "AI", isAI: true },
];

function driveOneSessionRound(session: SessionState): SessionState {
  let s = session;
  let steps = 0;
  while (!s.round.roundResult) {
    steps += 1;
    if (steps > 500) throw new Error("라운드가 끝나지 않습니다 (무한 루프 의심)");
    const decision = s.round.pendingDecision;
    if (!decision) throw new Error("진행할 결정이 없는데 라운드가 끝나지 않았습니다.");
    if (decision.kind === "playCard") {
      const card = chooseCardToPlayAI(s.round, decision.playerId);
      s = applyToRound(s, (r) => chooseCardToPlay(r, card.instanceId));
    } else if (decision.kind === "chooseTarget") {
      const targetId = chooseTargetAI(decision.playerId, decision.cardName, decision.eligiblePlayerIds);
      s = applyToRound(s, (r) => chooseTarget(r, targetId));
    } else {
      const guess = chooseGuessAI(s.round, decision.playerId);
      s = applyToRound(s, (r) => chooseGuess(r, guess));
    }
  }
  return s;
}

function driveSessionToEnd(session: SessionState, maxRounds = 20): SessionState {
  let s = session;
  let rounds = 0;
  while (!s.ended) {
    rounds += 1;
    if (rounds > maxRounds) throw new Error("세션이 끝나지 않습니다 (무한 루프 의심)");
    s = driveOneSessionRound(s);
    if (s.pendingArchivePlacement) {
      s = skipArchivePlacement(s, s.pendingArchivePlacement.eligiblePlayerId);
    }
    if (!s.ended) {
      const routeChoices: Record<string, Route> = {};
      for (const cfg of s.playerConfigs) routeChoices[cfg.id] = chooseRouteAI(s.currentRoute[cfg.id]);
      s = beginNextRound(s, routeChoices);
    }
  }
  return s;
}

// Deterministically ends the current round with `winnerId` as the sole
// survivor, regardless of what's actually in play -- mirrors the
// hand-mutation technique already used in rules.test.ts.
function forceImmediateWin(session: SessionState, winnerId: string, winnerHand?: GameState["players"][number]["hand"]): SessionState {
  const s: SessionState = structuredClone(session);
  const winner = s.round.players.find((p) => p.id === winnerId)!;
  for (const p of s.round.players) {
    if (p.id !== winnerId) p.eliminated = true;
  }
  // Always pin the hand to a card that never needs a target (대신), unless
  // the caller explicitly wants to test a specific hand -- otherwise this
  // is flaky whenever the random initial deal happens to give a self-
  // targetable card (마술사) instead, which leaves the round mid-decision.
  winner.hand = winnerHand ?? [{ instanceId: "force-win-card", name: "대신" }];
  s.round.currentPlayerIndex = s.round.players.findIndex((p) => p.id === winnerId);
  const card = winner.hand[0];
  s.round.pendingDecision = { kind: "playCard", playerId: winnerId, options: winner.hand };
  return applyToRound(s, (r) => chooseCardToPlay(r, card.instanceId));
}

describe("Session (Phase 2 round loop + tokens + ending)", () => {
  it("plays a full session to completion within the 8-round cap (fuzz)", () => {
    for (let i = 0; i < 15; i++) {
      const session = driveSessionToEnd(startSession(PLAYERS));
      expect(session.ended).toBe(true);
      expect(session.roundNumber).toBeLessThanOrEqual(8);
      expect(session.playerEndings).not.toBeNull();
    }
  });

  it("accrues letter tokens for AI wins just like human wins (no human-only special case)", () => {
    let session = startSession(PLAYERS);
    session = forceImmediateWin(session, "p2");
    expect(session.letterTokens["잉그리드공주"]["p2"]).toBe(1);
  });

  it("awards an extra letter token when the winner held 「공주」", () => {
    let session = startSession(PLAYERS);
    session = forceImmediateWin(session, "p1", [
      { instanceId: "c1", name: "대신" },
      { instanceId: "c2", name: "공주" },
    ]);
    // played "대신" (no-op), leaving 공주 as revealedHands[winnerId] -> +1 base +1 bonus
    expect(session.letterTokens["잉그리드공주"]["p1"]).toBe(2);
  });

  it("ends the session early once a player's route reaches 10 letter tokens", () => {
    let session = startSession(PLAYERS);
    session.letterTokens["잉그리드공주"]["p1"] = 9;
    session = forceImmediateWin(session, "p1", [
      { instanceId: "c1", name: "대신" },
      { instanceId: "c2", name: "장군" },
    ]);
    expect(session.letterTokens["잉그리드공주"]["p1"]).toBe(10);
    expect(session.ended).toBe(true);
    expect(session.endingReason).toBe("earlyThreshold");
  });

  it("tie-wipes equal token counts on a slot before assigning endings", () => {
    let session = startSession(PLAYERS);
    session.letterTokens["잉그리드공주"]["p1"] = 4;
    session.letterTokens["잉그리드공주"]["p2"] = 4;
    session.letterTokens["아레스왕자"]["p1"] = 2;
    session.roundNumber = 8;
    session = forceImmediateWin(session, "p1", [
      { instanceId: "c1", name: "대신" },
      { instanceId: "c2", name: "장군" },
    ]);
    expect(session.ended).toBe(true);
    expect(session.endingReason).toBe("roundCap");
    // p1's tied 잉그리드공주 tokens got wiped, but their untied 아레스왕자
    // tokens (plus the +1 from this round's win, credited to whichever
    // route p1 is currently pursuing) still let them claim something.
    expect(session.playerEndings).not.toBeNull();
  });

  it("assigns 'no one' when a player ends up with no exclusive slot", () => {
    let session = startSession(PLAYERS);
    session.roundNumber = 8;
    // Force a tie on every slot so both players end up empty-handed.
    for (const slot of Object.keys(session.letterTokens) as Array<keyof typeof session.letterTokens>) {
      session.letterTokens[slot]["p1"] = 3;
      session.letterTokens[slot]["p2"] = 3;
    }
    session = forceImmediateWin(session, "p1", [
      { instanceId: "c1", name: "대신" },
      { instanceId: "c2", name: "장군" },
    ]);
    expect(session.ended).toBe(true);
    // p2 never won anything this round and had every slot tied -> "이루어진 상대 없음"
    expect(session.playerEndings?.["p2"]).toBeNull();
  });

  it("reveals new archive cards once a shared token condition is met", () => {
    let session = startSession(PLAYERS);
    session.storyArchive.push({
      id: "053",
      name: "고지식한 병사",
      flavor: "",
      conditions: [
        { id: "053-success", token: "성공", threshold: 2, revealIds: ["055", "056"], removeIds: ["053"], fired: false },
        { id: "053-fail", token: "실패", threshold: 4, revealIds: ["062"], removeIds: ["053"], fired: false },
      ],
      successTokens: 1, // one below the real threshold of 2
      failTokens: 0,
    });
    session.pendingArchivePlacement = { eligiblePlayerId: "p1" };

    session = placeArchiveToken(session, "p1", "053", "성공");

    expect(session.storyArchive.some((c) => c.id === "053")).toBe(false);
    expect(session.storyArchive.some((c) => c.id === "055")).toBe(true);
    expect(session.storyArchive.some((c) => c.id === "056")).toBe(true);
  });

  it("wizard tier2 upgrade needs no target and lets the actor redraw alone", () => {
    expect(needsTarget("마술사", "tier2")).toBe(false);
    expect(targetsFor({ players: [] } as unknown as GameState, "p1", "마술사", "tier2")).toEqual([]);

    const state: GameState = {
      players: [
        { id: "p1", displayName: "P1", isAI: false, hand: [{ instanceId: "a", name: "기사" }], discardPile: [], eliminated: false, protected: false },
      ],
      deck: [{ instanceId: "b", name: "광대" }],
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
      firstEliminatedThisRound: null,
    };
    applyEffect(state, {
      actingPlayerId: "p1",
      card: { instanceId: "z", name: "마술사" },
      upgrade: "tier2",
    });
    expect(state.players[0].hand.map((c) => c.name)).toEqual(["광대"]);
    expect(state.players[0].discardPile.map((c) => c.name)).toEqual(["기사"]);
  });

  it("beginNextRound rejects being called while a session-level decision is pending", () => {
    let session = startSession(PLAYERS);
    session.pendingArchivePlacement = { eligiblePlayerId: "p1" };
    expect(() => beginNextRound(session, { p1: "공주", p2: "공주" })).toThrow();
  });
});
