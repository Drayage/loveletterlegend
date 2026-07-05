import { describe, expect, it } from "vitest";
import { chooseCardToPlay, chooseTarget, chooseGuess, beginTurn } from "./rules";
import { chooseCardToPlayAI, chooseGuessAI, chooseTargetAI, chooseRouteAI, chooseLetterTargetAI } from "./ai";
import { needsTarget, targetsFor, applyEffect } from "./effects";
import {
  startSession,
  applyToRound,
  beginNextRound,
  placeArchiveToken,
  skipArchivePlacement,
  resolveLetterChoice,
  chooseIdentity,
  resolveArchiveChoice,
  nextRoundLeader,
  ROUTE_SLOT,
} from "./session";
import type { SessionState } from "./session";
import type { PlayerConfig, GameState } from "./types";
import { ARCHIVE_CARD_SEEDS } from "../data/scenario";

const PLAYERS: PlayerConfig[] = [
  { id: "p1", displayName: "플레이어", isAI: false },
  { id: "p2", displayName: "AI", isAI: true },
];

// Mirrors session.ts's private seedArchiveCard, kept independent of
// setupRound's random shuffle so it's a genuinely deterministic baseline
// for forceImmediateWin to reset onto (see its comment below).
function pristineStoryArchive(): SessionState["storyArchive"] {
  return ["017", "018", "020", "023"].map((id) => {
    const seed = ARCHIVE_CARD_SEEDS[id];
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
    };
  });
}

// startSession's random initial deal can rarely (~2-3%) already trigger
// 「대신」's passive elimination, ending round 1 before a test that wants to
// call beginNextRound directly (without going through forceImmediateWin's
// own reset-to-pristine logic) ever gets to run. Retry until round 1 is
// still genuinely in progress.
function freshSession(): SessionState {
  let session = startSession(PLAYERS);
  while (session.round.roundResult) session = startSession(PLAYERS);
  return session;
}

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
    // 038 「남작/여자작」을 고르면 새 pendingLetterChoice가 생길 수 있어
    // 세 가지 세션 결정이 전부 해소될 때까지 반복한다.
    while (s.pendingLetterChoice || s.pendingArchivePlacement || s.pendingIdentityChoice || s.pendingChoice) {
      if (s.pendingLetterChoice) {
        const choice = chooseLetterTargetAI(ROUTE_SLOT[s.currentRoute], s.pendingLetterChoice.atCap);
        s = resolveLetterChoice(s, s.pendingLetterChoice.playerId, choice);
      }
      if (s.pendingArchivePlacement) {
        s = skipArchivePlacement(s, s.pendingArchivePlacement.eligiblePlayerId);
      }
      if (s.pendingIdentityChoice) {
        s = chooseIdentity(s, s.pendingIdentityChoice.eligiblePlayerId, s.pendingIdentityChoice.options[0]);
      }
      if (s.pendingChoice) {
        s = resolveArchiveChoice(s, s.pendingChoice.eligiblePlayerId, s.pendingChoice.options[0].id);
      }
    }
    if (!s.ended) {
      s = beginNextRound(s, chooseRouteAI(s.currentRoute));
    }
  }
  return s;
}

// Deterministically ends the current round with `winnerId` as the sole
// survivor, regardless of what's actually in play -- mirrors the
// hand-mutation technique already used in rules.test.ts.
function forceImmediateWin(
  session: SessionState,
  winnerId: string,
  winnerHand?: GameState["players"][number]["hand"],
  extraArchiveCards: SessionState["storyArchive"] = [],
  presetClock = 0,
  extraSessionEvents: NonNullable<GameState["sessionEvents"]> = []
): SessionState {
  const s: SessionState = structuredClone(session);
  // The random initial deal can occasionally (~2-3% of the time) already
  // trigger 「대신」's passive elimination during setupRound, ending the
  // round before this helper ever runs (see effects.ts's
  // checkMinisterElimination) -- and, since that degenerate round runs
  // through the exact same applySessionRoundEnd this helper is about to
  // trigger again, it can also have already advanced clockTokens/
  // storyArchive (e.g. already revealing 053, or even resolving 053's own
  // condition). Reset all of that to a pristine baseline so this helper's
  // result only reflects the round it's about to force, not whatever the
  // untamed initial deal happened to do first.
  s.round.roundResult = null;
  s.round.firstEliminatedThisRound = null;
  s.clockTokens = presetClock;
  s.storyArchive = [...pristineStoryArchive(), ...extraArchiveCards];
  s.pendingLetterChoice = null;
  s.pendingArchivePlacement = null;
  s.pendingChoice = null;
  s.pendingIdentityChoice = null;
  s.extraDeckCardNames = [];
  s.removedBaseCardNames = [];
  const winner = s.round.players.find((p) => p.id === winnerId)!;
  for (const p of s.round.players) {
    p.eliminated = p.id !== winnerId;
  }
  // Always pin the hand to a card that never needs a target (대신), unless
  // the caller explicitly wants to test a specific hand -- otherwise this
  // is flaky whenever the random initial deal happens to give a self-
  // targetable card (마술사) instead, which leaves the round mid-decision.
  winner.hand = winnerHand ?? [{ instanceId: "force-win-card", name: "대신" }];
  s.round.currentPlayerIndex = s.round.players.findIndex((p) => p.id === winnerId);
  s.round.sessionEvents = [...extraSessionEvents];
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

  it("seeds 017/018/020/023 at session start -- 031 not revealed yet", () => {
    const session = startSession(PLAYERS);
    const ids = session.storyArchive.map((c) => c.id);
    // The random initial deal can rarely (~2-3%) already trigger 「대신」's
    // passive elimination during setupRound, ending round 1 before this
    // assertion even runs -- which can legitimately reveal 024 (clock=1)
    // and even 053 (if that degenerate round's winner held 「경비병」,
    // firing 023's condition). Assert on the base 4 ids and the one thing
    // that should never happen this early, instead of exact equality.
    expect(ids).toEqual(expect.arrayContaining(["017", "018", "020", "023"]));
    expect(session.storyArchive.some((c) => c.id === "031")).toBe(false);
  });

  it("023's winnerHeldCard condition reveals 052 (-> 053 via choice) only when the winner held 「경비병」", () => {
    let session = startSession(PLAYERS);
    session = forceImmediateWin(session, "p1", [
      { instanceId: "c1", name: "대신" },
      { instanceId: "c2", name: "경비병" },
    ]);
    expect(session.storyArchive.some((c) => c.id === "052")).toBe(true);
    // Only the 경비병 branch of 023's 8-branch table fired.
    const card023 = session.storyArchive.find((c) => c.id === "023")!;
    expect(card023.conditions.find((c) => c.id === "023-guard")?.fired).toBe(true);
    expect(card023.conditions.find((c) => c.id === "023-clown")?.fired).toBe(false);
    // 052's own "선택" resolves to reveal 053 (merged 053/054).
    expect(session.pendingChoice?.cardId).toBe("052");
    session = resolveArchiveChoice(session, session.pendingChoice!.eligiblePlayerId, "052-familiar");
    expect(session.storyArchive.some((c) => c.id === "053")).toBe(true);
    expect(session.storyArchive.some((c) => c.id === "052")).toBe(false);
  });

  it("checks off 023's non-경비병 branches and reveals that branch's own scenario card", () => {
    let session = startSession(PLAYERS);
    session = forceImmediateWin(session, "p1", [
      { instanceId: "c1", name: "대신" },
      { instanceId: "c2", name: "광대" },
    ]);
    const card023 = session.storyArchive.find((c) => c.id === "023")!;
    expect(card023.conditions.find((c) => c.id === "023-clown")?.fired).toBe(true);
    // 광대 branch reveals [079] ("광대의 초대"), which is now wired in v1.
    expect(session.storyArchive.map((c) => c.id).sort()).toEqual(["017", "018", "020", "023", "079"]);
  });

  it("does not reveal 053 when the winner held a different card", () => {
    let session = startSession(PLAYERS);
    session = forceImmediateWin(session, "p1", [
      { instanceId: "c1", name: "대신" },
      { instanceId: "c2", name: "장군" },
    ]);
    expect(session.storyArchive.some((c) => c.id === "053")).toBe(false);
  });

  it("017's clockThreshold conditions fire at ROUND START (beginNextRound), unlocking by accumulated clock", () => {
    // Round 2's own fresh initial deal can also rarely (~2-3%) auto-end
    // via 「대신」 -- that runs a full round-END pass on top (clockTokens+1,
    // possibly expiring/revealing unrelated cards), so retry from scratch
    // whenever that degenerate case shows up, same spirit as freshSession().
    let session: SessionState;
    do {
      session = freshSession();
      session.clockTokens = 6;
      session = beginNextRound(session, "공주");
    } while (session.round.roundResult);
    const ids = session.storyArchive.map((c) => c.id);
    expect(ids).toEqual(expect.arrayContaining(["024", "025", "032", "049"]));
    expect(ids).not.toContain("050");
  });

  it("025's reveal injects 「왕」 into the session's extra deck-card pool, and the next round's deck includes it", () => {
    let session = freshSession();
    expect(session.extraDeckCardNames).not.toContain("왕");
    session.clockTokens = 2;
    session = beginNextRound(session, "공주");
    expect(session.storyArchive.some((c) => c.id === "025")).toBe(true);
    expect(session.extraDeckCardNames).toContain("왕");
    const totalCards =
      session.round.deck.length +
      session.round.faceUpRemovedCards.length +
      (session.round.hiddenRemovedCard ? 1 : 0) +
      session.round.players.reduce((sum, p) => sum + p.hand.length, 0);
    // Base 16-card deck + the injected 「왕」 = 17 cards in play this round.
    expect(totalCards).toBe(17);
  });

  it("032's reveal seeds the identity pool with all 6 ids and null player assignments", () => {
    let session: SessionState;
    do {
      session = freshSession();
      session.clockTokens = 3;
      session = beginNextRound(session, "공주");
    } while (session.round.roundResult);
    expect(session.storyArchive.some((c) => c.id === "032")).toBe(true);
    expect(session.identityPool.sort()).toEqual(["033", "034", "035", "036", "037", "038"]);
    // 실카드: 032의 [등장]은 정체 풀 6장 전체를 즉시 보관소에 공개한다.
    for (const id of ["033", "034", "035", "036", "037", "038"]) {
      expect(session.storyArchive.some((c) => c.id === id)).toBe(true);
    }
    expect(session.playerIdentities["p1"]).toBeNull();
    expect(session.playerIdentities["p2"]).toBeNull();
  });

  it("an eliminated player without an identity gets pendingIdentityChoice once 032 is revealed", () => {
    let session = startSession(PLAYERS);
    session = forceImmediateWin(
      session,
      "p1",
      [
        { instanceId: "c1", name: "대신" },
        { instanceId: "c2", name: "장군" },
      ],
      [{ id: "032", name: ARCHIVE_CARD_SEEDS["032"].name, category: "scenario", flavor: "", conditions: [], successTokens: 0, failTokens: 0 }]
    );
    session.identityPool = ["033", "034", "035", "036", "037", "038"];
    session = resolveLetterChoice(session, "p1", { type: "place", slot: "잉그리드공주" });
    expect(session.pendingIdentityChoice?.eligiblePlayerId).toBe("p2");
    expect(session.pendingIdentityChoice?.options).toEqual(["033", "034", "035", "036", "037", "038"]);
  });

  it("chooseIdentity assigns permanently and removes the id from the pool", () => {
    let session = startSession(PLAYERS);
    session = forceImmediateWin(
      session,
      "p1",
      [
        { instanceId: "c1", name: "대신" },
        { instanceId: "c2", name: "장군" },
      ],
      [{ id: "032", name: ARCHIVE_CARD_SEEDS["032"].name, category: "scenario", flavor: "", conditions: [], successTokens: 0, failTokens: 0 }]
    );
    session.identityPool = ["033", "034", "035", "036", "037", "038"];
    session = resolveLetterChoice(session, "p1", { type: "place", slot: "잉그리드공주" });
    session = chooseIdentity(session, "p2", "035");
    expect(session.playerIdentities["p2"]).toBe("035");
    expect(session.identityPool).not.toContain("035");
    expect(session.pendingIdentityChoice).toBeNull();
  });

  it("choosing 038 grants a +2 letter-placement choice on acquisition", () => {
    let session = startSession(PLAYERS);
    session = forceImmediateWin(
      session,
      "p1",
      [
        { instanceId: "c1", name: "대신" },
        { instanceId: "c2", name: "장군" },
      ],
      [{ id: "032", name: ARCHIVE_CARD_SEEDS["032"].name, category: "scenario", flavor: "", conditions: [], successTokens: 0, failTokens: 0 }]
    );
    session.identityPool = ["033", "034", "035", "036", "037", "038"];
    session = resolveLetterChoice(session, "p1", { type: "place", slot: "잉그리드공주" });
    session = chooseIdentity(session, "p2", "038");
    expect(session.pendingLetterChoice?.playerId).toBe("p2");
    expect(session.pendingLetterChoice?.amount).toBe(2);
    session = resolveLetterChoice(session, "p2", { type: "place", slot: "아레스왕자" });
    expect(session.letterTokens["아레스왕자"]["p2"]).toBe(2);
  });

  it("032 reveals 039 and removes itself once every player has an identity", () => {
    let session = startSession(PLAYERS);
    session = forceImmediateWin(
      session,
      "p1",
      [
        { instanceId: "c1", name: "대신" },
        { instanceId: "c2", name: "장군" },
      ],
      [{ id: "032", name: ARCHIVE_CARD_SEEDS["032"].name, category: "scenario", flavor: "", conditions: [], successTokens: 0, failTokens: 0 }]
    );
    session.identityPool = ["033", "034", "035", "036", "037", "038"];
    session.playerIdentities["p1"] = "033"; // winner already has one from an earlier round
    session = resolveLetterChoice(session, "p1", { type: "place", slot: "잉그리드공주" });
    expect(session.pendingIdentityChoice?.eligiblePlayerId).toBe("p2");
    session = chooseIdentity(session, "p2", "034");
    expect(session.storyArchive.some((c) => c.id === "032")).toBe(false);
    expect(session.storyArchive.some((c) => c.id === "039")).toBe(true);
    // 039의 [등장]: 축제 덱 8장이 즉시 채워진다.
    expect(session.festivalDeck.slice().sort()).toEqual(["040", "041", "042", "043", "044", "045", "046", "047"]);
  });

  it("beginNextRound draws the top festival card, and round end recycles it to the bottom", () => {
    let session = startSession(PLAYERS);
    session = forceImmediateWin(
      session,
      "p1",
      [
        { instanceId: "c1", name: "대신" },
        { instanceId: "c2", name: "장군" },
      ],
      [{ id: "039", name: ARCHIVE_CARD_SEEDS["039"].name, category: "scenario", flavor: "", conditions: [], successTokens: 0, failTokens: 0 }]
    );
    session.festivalDeck = ["040", "041", "042"];
    session = resolveLetterChoice(session, "p1", { type: "place", slot: "잉그리드공주" });
    // Round 2's own fresh initial deal can also rarely (~2-3%) auto-end via
    // 「대신」, which would immediately recycle "040" back into festivalDeck
    // before these assertions run -- retry from scratch when that happens.
    let session2 = session;
    do {
      session2 = beginNextRound(session, "공주");
    } while (session2.round.roundResult);
    session = session2;
    expect(session.round.activeFestivalCardId).toBe("040");
    expect(session.festivalDeck).toEqual(["041", "042"]);

    // Round-end recycling only reads round.activeFestivalCardId (already set
    // to "040" above), independent of 039's storyArchive presence -- so it
    // still applies even though forceImmediateWin resets storyArchive to
    // pristine (039 no longer listed there).
    session = forceImmediateWin(session, "p1", [
      { instanceId: "c3", name: "대신" },
      { instanceId: "c4", name: "장군" },
    ]);
    expect(session.festivalDeck).toEqual(["041", "042", "040"]);
  });

  it("025's [실패] threshold (kingElimination + 8+ 편지) removes 025 from the archive", () => {
    let session = startSession(PLAYERS);
    session.letterTokens["잉그리드공주"]["p2"] = 8;
    session = forceImmediateWin(
      session,
      "p1",
      [
        { instanceId: "c1", name: "대신" },
        { instanceId: "c2", name: "장군" },
      ],
      [
        {
          id: "025",
          name: ARCHIVE_CARD_SEEDS["025"].name,
          category: "scenario",
          flavor: "",
          conditions: ARCHIVE_CARD_SEEDS["025"].conditions.map((c) => ({ ...c, fired: false })),
          successTokens: 0,
          failTokens: 0,
        },
      ],
      0,
      [{ type: "kingElimination", playerId: "p2" }]
    );
    expect(session.storyArchive.some((c) => c.id === "025")).toBe(false);
  });

  it("025's [실패] threshold does NOT fire when the eliminated player has under 8 편지", () => {
    let session = startSession(PLAYERS);
    session.letterTokens["잉그리드공주"]["p2"] = 3;
    session = forceImmediateWin(
      session,
      "p1",
      [
        { instanceId: "c1", name: "대신" },
        { instanceId: "c2", name: "장군" },
      ],
      [
        {
          id: "025",
          name: ARCHIVE_CARD_SEEDS["025"].name,
          category: "scenario",
          flavor: "",
          conditions: ARCHIVE_CARD_SEEDS["025"].conditions.map((c) => ({ ...c, fired: false })),
          successTokens: 0,
          failTokens: 0,
        },
      ],
      0,
      [{ type: "kingElimination", playerId: "p2" }]
    );
    expect(session.storyArchive.some((c) => c.id === "025")).toBe(true);
  });

  it("does NOT reveal 024 at round 1's end -- only at round 2's start (시작/종료 timing split)", () => {
    let session = startSession(PLAYERS);
    session = forceImmediateWin(session, "p1", [
      { instanceId: "c1", name: "대신" },
      { instanceId: "c2", name: "장군" },
    ]);
    // Round 1 just ended: clock is 1, but 017's 시작 table must not have
    // fired yet -- it's a round-START check.
    expect(session.clockTokens).toBe(1);
    expect(session.storyArchive.some((c) => c.id === "024")).toBe(false);
    session = resolveLetterChoice(session, "p1", { type: "place", slot: "잉그리드공주" });
    expect(session.storyArchive.some((c) => c.id === "024")).toBe(false);
    session = beginNextRound(session, "공주");
    expect(session.storyArchive.some((c) => c.id === "024")).toBe(true);
  });

  it("only [조건]-tagged cards count toward 024's 'reveal 031' check -- 시작/종료 reveal tables don't (bug regression)", () => {
    const card024 = {
      ...ARCHIVE_CARD_SEEDS["024"],
      art: undefined,
      conditions: ARCHIVE_CARD_SEEDS["024"].conditions.map((c) => ({ ...c, fired: false })),
      successTokens: 0,
      failTokens: 0,
    };
    let session = startSession(PLAYERS);
    // 017 and 023 both sit in the archive with plenty of unfired conditions
    // -- but none of them carries the [조건] tag, so 031 must NOT appear.
    session = forceImmediateWin(
      session,
      "p1",
      [
        { instanceId: "c1", name: "대신" },
        { instanceId: "c2", name: "장군" },
      ],
      [card024]
    );
    expect(session.storyArchive.some((c) => c.id === "031")).toBe(false);
  });

  it("reveals 031 once two [조건]-tagged cards are in the archive", () => {
    const card024 = {
      ...ARCHIVE_CARD_SEEDS["024"],
      art: undefined,
      conditions: ARCHIVE_CARD_SEEDS["024"].conditions.map((c) => ({ ...c, fired: false })),
      successTokens: 0,
      failTokens: 0,
    };
    const fakeConditionCard = (id: string) => ({
      id,
      name: `조건 카드 ${id}`,
      category: "scenario" as const,
      flavor: "",
      conditionTag: true,
      conditions: [],
      successTokens: 0,
      failTokens: 0,
    });
    let session = startSession(PLAYERS);
    session = forceImmediateWin(
      session,
      "p1",
      [
        { instanceId: "c1", name: "대신" },
        { instanceId: "c2", name: "장군" },
      ],
      [card024, fakeConditionCard("098"), fakeConditionCard("099")]
    );
    expect(session.storyArchive.some((c) => c.id === "031")).toBe(true);
  });

  it("expires archive cards at their [시계] deadline and reports them in the round summary", () => {
    let session = startSession(PLAYERS);
    // 023 expires at clock 4 -- preset 3 so this round's end brings it to 4.
    session = forceImmediateWin(
      session,
      "p1",
      [
        { instanceId: "c1", name: "대신" },
        { instanceId: "c2", name: "장군" },
      ],
      [],
      3
    );
    expect(session.clockTokens).toBe(4);
    expect(session.storyArchive.some((c) => c.id === "023")).toBe(false);
    expect(session.lastRoundSummary?.expiredCards).toContain("역사 1 이야기의 시작");
  });

  it("does not expire 023 before clock 4", () => {
    let session = startSession(PLAYERS);
    session = forceImmediateWin(
      session,
      "p1",
      [
        { instanceId: "c1", name: "대신" },
        { instanceId: "c2", name: "장군" },
      ],
      [],
      2
    );
    expect(session.clockTokens).toBe(3);
    expect(session.storyArchive.some((c) => c.id === "023")).toBe(true);
    expect(session.lastRoundSummary?.expiredCards).toEqual([]);
  });

  it("offers the first-eliminated placement only when a [조건] card is present, even with 031 revealed", () => {
    const card031 = {
      ...ARCHIVE_CARD_SEEDS["031"],
      art: undefined,
      conditions: [],
      successTokens: 0,
      failTokens: 0,
    };
    let session = startSession(PLAYERS);
    session = forceImmediateWin(
      session,
      "p1",
      // "신병" isn't one of 023's 8 tracked base cards, so its
      // winnerHeldCard branch doesn't fire and no [조건] card gets
      // introduced as a side effect (unlike e.g. 「장군」, which now reveals
      // conditionTag-bearing 162 via 023-general).
      [
        { instanceId: "c1", name: "대신" },
        { instanceId: "c2", name: "신병" },
      ],
      [card031]
    );
    session.round.firstEliminatedThisRound = "p2";
    session = resolveLetterChoice(session, "p1", { type: "place", slot: "잉그리드공주" });
    // 031 is out, p2 was eliminated first -- but no card carries the
    // [조건] tag, so there's nothing legal to place a token on.
    expect(session.pendingArchivePlacement).toBeNull();
  });

  it("049 grants an automatic +1 letter bonus on top of the round-win award once revealed", () => {
    let session = startSession(PLAYERS);
    session = forceImmediateWin(
      session,
      "p1",
      [
        { instanceId: "c1", name: "대신" },
        { instanceId: "c2", name: "장군" },
      ],
      [{ id: "049", name: ARCHIVE_CARD_SEEDS["049"].name, category: "scenario", flavor: "", conditions: [], successTokens: 0, failTokens: 0 }]
    );
    expect(session.pendingLetterChoice?.amount).toBe(2);
  });

  it("050 grants +1, plus +2 more when the winner held 「공주」, on top of the round-win award", () => {
    let session = startSession(PLAYERS);
    session = forceImmediateWin(
      session,
      "p1",
      [
        { instanceId: "c1", name: "대신" },
        { instanceId: "c2", name: "공주" },
      ],
      [{ id: "050", name: ARCHIVE_CARD_SEEDS["050"].name, category: "scenario", flavor: "", conditions: [], successTokens: 0, failTokens: 0 }]
    );
    // base 2 (공주 win) + 050's +1 + 050's +2 (also held 공주) = 5
    expect(session.pendingLetterChoice?.amount).toBe(5);
  });

  it("050's ending tag reveals 051 when the 공주-holding winner leads the corresponding route slot", () => {
    let session = startSession(PLAYERS);
    session = forceImmediateWin(
      session,
      "p1",
      [
        { instanceId: "c1", name: "대신" },
        { instanceId: "c2", name: "공주" },
      ],
      [{ id: "050", name: ARCHIVE_CARD_SEEDS["050"].name, category: "scenario", flavor: "", conditions: [], successTokens: 0, failTokens: 0 }]
    );
    session = resolveLetterChoice(session, "p1", { type: "place", slot: "잉그리드공주" });
    expect(session.storyArchive.some((c) => c.id === "051")).toBe(true);
  });

  it("does not reveal 051 when 050 is present but the winner did not hold 「공주」", () => {
    let session = startSession(PLAYERS);
    session = forceImmediateWin(
      session,
      "p1",
      [
        { instanceId: "c1", name: "대신" },
        { instanceId: "c2", name: "장군" },
      ],
      [{ id: "050", name: ARCHIVE_CARD_SEEDS["050"].name, category: "scenario", flavor: "", conditions: [], successTokens: 0, failTokens: 0 }]
    );
    session = resolveLetterChoice(session, "p1", { type: "place", slot: "잉그리드공주" });
    expect(session.storyArchive.some((c) => c.id === "051")).toBe(false);
  });

  it("gates the first-eliminated archive-token placement behind 031 being revealed", () => {
    let session = startSession(PLAYERS);
    // 031 isn't revealed yet in a fresh session -- even a first-eliminated
    // player shouldn't get a pendingArchivePlacement.
    session.round.firstEliminatedThisRound = "p2";
    session = forceImmediateWin(session, "p1", [
      { instanceId: "c1", name: "대신" },
      { instanceId: "c2", name: "장군" },
    ]);
    session = resolveLetterChoice(session, "p1", { type: "place", slot: "잉그리드공주" });
    expect(session.pendingArchivePlacement).toBeNull();
  });

  it("accrues letter tokens for AI wins just like human wins (no human-only special case), via the winner's own placement choice", () => {
    let session = startSession(PLAYERS);
    session = forceImmediateWin(session, "p2");
    expect(session.pendingLetterChoice?.playerId).toBe("p2");
    expect(session.pendingLetterChoice?.amount).toBe(1);
    session = resolveLetterChoice(session, "p2", { type: "place", slot: "잉그리드공주" });
    expect(session.letterTokens["잉그리드공주"]["p2"]).toBe(1);
    expect(session.pendingLetterChoice).toBeNull();
  });

  it("makes the previous round's winner the next round's leader (선플레이어), whose route choice is the only one that applies", () => {
    let session = startSession(PLAYERS);
    session = forceImmediateWin(session, "p2");
    session = resolveLetterChoice(session, "p2", { type: "place", slot: "잉그리드공주" });
    expect(nextRoundLeader(session)).toBe("p2");
    session = beginNextRound(session, "왕자");
    // p2 (AI) leads -> currentPlayerIndex should point at p2, not p1.
    expect(session.round.players[session.round.currentPlayerIndex].id).toBe("p2");
    expect(session.currentRoute).toBe("왕자");
  });

  it("offers an extra letter token to place when the winner held 「공주」", () => {
    let session = startSession(PLAYERS);
    session = forceImmediateWin(session, "p1", [
      { instanceId: "c1", name: "대신" },
      { instanceId: "c2", name: "공주" },
    ]);
    // played "대신" (no-op), leaving 공주 as revealedHands[winnerId] -> amount 2
    expect(session.pendingLetterChoice?.amount).toBe(2);
    session = resolveLetterChoice(session, "p1", { type: "place", slot: "아레스왕자" });
    expect(session.letterTokens["아레스왕자"]["p1"]).toBe(2);
  });

  it("ends the session immediately once a player concentrates 10 letter tokens on a single 공주/왕자 slot", () => {
    let session = startSession(PLAYERS);
    session.letterTokens["잉그리드공주"]["p1"] = 9;
    session = forceImmediateWin(session, "p1", [
      { instanceId: "c1", name: "대신" },
      { instanceId: "c2", name: "장군" },
    ]);
    expect(session.pendingLetterChoice?.atCap).toBe(false); // only 9 total so far, still room
    session = resolveLetterChoice(session, "p1", { type: "place", slot: "잉그리드공주" });
    expect(session.letterTokens["잉그리드공주"]["p1"]).toBe(10);
    expect(session.ended).toBe(true);
    expect(session.endingReason).toBe("earlyThreshold");
  });

  it("does not end the session when a player's 10-token pool is split across multiple slots (rulebook Q&A)", () => {
    let session = startSession(PLAYERS);
    session.letterTokens["잉그리드공주"]["p1"] = 6;
    session.letterTokens["마술사의도제"]["p1"] = 4; // total 10, but no single 공주/왕자 slot has 10
    session = forceImmediateWin(session, "p1", [
      { instanceId: "c1", name: "대신" },
      { instanceId: "c2", name: "장군" },
    ]);
    expect(session.pendingLetterChoice?.atCap).toBe(true);
    expect(() => resolveLetterChoice(session, "p1", { type: "place", slot: "아레스왕자" })).toThrow();
    session = resolveLetterChoice(session, "p1", { type: "decline" });
    expect(session.ended).toBe(false);
  });

  it("lets an at-cap player move an already-placed token between slots instead of gaining a new one", () => {
    let session = startSession(PLAYERS);
    session.letterTokens["잉그리드공주"]["p1"] = 10;
    session = forceImmediateWin(session, "p1", [
      { instanceId: "c1", name: "대신" },
      { instanceId: "c2", name: "장군" },
    ]);
    session = resolveLetterChoice(session, "p1", { type: "move", from: "잉그리드공주", to: "아레스왕자" });
    expect(session.letterTokens["잉그리드공주"]["p1"]).toBe(9);
    expect(session.letterTokens["아레스왕자"]["p1"]).toBe(1);
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
    // Round-cap ending waits for the winner's letter-token placement first.
    expect(session.ended).toBe(false);
    session = resolveLetterChoice(session, "p1", { type: "place", slot: "아레스왕자" });
    expect(session.ended).toBe(true);
    expect(session.endingReason).toBe("roundCap");
    // p1's tied 잉그리드공주 tokens got wiped, but their untied 아레스왕자
    // tokens (now boosted by this round's placement) still let them claim
    // something.
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
    expect(session.ended).toBe(false);
    session = resolveLetterChoice(session, "p1", { type: "place", slot: "잉그리드공주" });
    expect(session.ended).toBe(true);
    // p2 never won anything this round and had every slot tied -> "이루어진 상대 없음"
    expect(session.playerEndings?.["p2"]).toBeNull();
  });

  it("reveals new archive cards once a shared token condition is met", () => {
    let session = startSession(PLAYERS);
    session.storyArchive.push({
      id: "053",
      name: "고지식한 병사",
      category: "scenario",
      flavor: "",
      conditionTag: true,
      conditions: [
        {
          id: "053-success",
          kind: "sharedToken",
          label: "[성공] 2개 이상",
          token: "성공",
          threshold: 2,
          revealIds: ["055", "056"],
          removeIds: ["053"],
          fired: false,
        },
        {
          id: "053-fail",
          kind: "sharedToken",
          label: "[실패] 4개 이상",
          token: "실패",
          threshold: 4,
          revealIds: ["062"],
          removeIds: ["053"],
          fired: false,
        },
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
    expect(() => beginNextRound(session, "공주")).toThrow();
  });

  describe("ROOT B: 023's remaining 6 wired branches", () => {
    it("resolves 052's choice to the 낯선 여자 병사 branch, revealing 057 (conditionTag) with a 신병 deckEffect", () => {
      let session = startSession(PLAYERS);
      session = forceImmediateWin(session, "p1", [
        { instanceId: "c1", name: "대신" },
        { instanceId: "c2", name: "경비병" },
      ]);
      expect(session.pendingChoice?.cardId).toBe("052");
      session = resolveArchiveChoice(session, session.pendingChoice!.eligiblePlayerId, "052-stranger");
      expect(session.storyArchive.some((c) => c.id === "052")).toBe(false);
      const card057 = session.storyArchive.find((c) => c.id === "057");
      expect(card057?.conditionTag).toBe(true);
      expect(session.extraDeckCardNames).toContain("신병");
    });

    it("103's [실패] threshold reveals 113, whose autoRevealIds cascades straight to 114 (conditionTag, deckEffect replaces 기사 with 상인 x2) with no condition/choice gate of its own", () => {
      let session = startSession(PLAYERS);
      session = forceImmediateWin(
        session,
        "p1",
        [
          { instanceId: "c1", name: "대신" },
          { instanceId: "c2", name: "기사" },
        ],
        [],
        0,
        [
          { type: "compareResolved", actingPlayerId: "p1", targetPlayerId: "p2", cardName: "기사", outcome: "actorLoses" },
          { type: "compareResolved", actingPlayerId: "p1", targetPlayerId: "p2", cardName: "기사", outcome: "actorLoses" },
        ]
      );
      const card103 = session.storyArchive.find((c) => c.id === "103");
      expect(card103?.conditions.find((c) => c.id === "103-fail")?.fired).toBe(true);
      // 113 itself never lingers -- its autoRevealIds fires and removes it
      // in the same pass that reveals 114.
      expect(session.storyArchive.some((c) => c.id === "113")).toBe(false);
      const card114 = session.storyArchive.find((c) => c.id === "114");
      expect(card114?.conditionTag).toBe(true);
      expect(session.removedBaseCardNames.filter((n) => n === "기사").length).toBe(2);
      expect(session.extraDeckCardNames.filter((n) => n === "상인").length).toBe(2);
    });

    it("compareResolved 기사 targetLoses credits 103's [성공]; actorLoses credits its own [실패] separately from the general 들고탈락 check", () => {
      let session = startSession(PLAYERS);
      // Seed 103 directly (pristine) so the win check below (winner holds
      // 「신병」, not 「기사」) doesn't also grant it a [성공] via the "held
      // 기사 and won" path -- isolates compareResolved's own contribution.
      const card103 = { ...ARCHIVE_CARD_SEEDS["103"], conditions: ARCHIVE_CARD_SEEDS["103"].conditions.map((c) => ({ ...c, fired: false })), successTokens: 0, failTokens: 0 };
      // p2 (eliminated) gets a random hand from the initial deal --
      // pin it away from 「기사」 so the post-hoc "eliminated while holding
      // 기사" check can't also add a [실패] and break this test's isolation.
      const p2 = session.round.players.find((p) => p.id === "p2")!;
      p2.hand = [{ instanceId: "p2-hand", name: "대신" }];
      session = forceImmediateWin(
        session,
        "p1",
        [
          { instanceId: "c1", name: "대신" },
          { instanceId: "c2", name: "신병" },
        ],
        [card103],
        0,
        [{ type: "compareResolved", actingPlayerId: "p1", targetPlayerId: "p2", cardName: "기사", outcome: "targetLoses" }]
      );
      const updated103 = session.storyArchive.find((c) => c.id === "103")!;
      expect(updated103.successTokens).toBe(1);
      expect(updated103.failTokens).toBe(0);
    });

    it("정무관's immunity blocking eliminatePlayer doesn't strand the player's turn (checkKingElimination/checkMinisterElimination regression)", () => {
      // Regression test for a real bug found during ROOT B fuzzing: when
      // eliminatePlayer no-ops due to immuneThisRound, checkKingElimination/
      // checkMinisterElimination used to still report "true" (trigger
      // fired), which made beginTurn skip setting pendingDecision for that
      // player entirely -- advanceTurn then cycled back to them on their
      // next turn, redrawing without ever having played, growing their
      // hand without bound. Uses a hand-built GameState (not a real
      // session round) so the deck/draw are fully deterministic: p1 starts
      // with exactly 1 card (holding 대신, immune, sum with the 공주 about
      // to be drawn is >= 12) and beginTurn draws the 2nd.
      const state: GameState = {
        players: [
          {
            id: "p1",
            displayName: "P1",
            isAI: false,
            hand: [{ instanceId: "x1", name: "대신" }],
            discardPile: [],
            eliminated: false,
            protected: false,
            immuneThisRound: true,
          },
          { id: "p2", displayName: "P2", isAI: true, hand: [{ instanceId: "y1", name: "신병" }], discardPile: [], eliminated: false, protected: false },
        ],
        deck: [{ instanceId: "x2", name: "공주" }],
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
      const next = beginTurn(state);
      // Immune despite holding 대신 with hand sum >= 12 (7 + 8) -- must
      // still reach a normal playCard decision (not get silently skipped).
      expect(next.pendingDecision?.kind).toBe("playCard");
      expect(next.pendingDecision?.playerId).toBe("p1");
      expect(next.players.find((p) => p.id === "p1")?.eliminated).toBe(false);
      expect(next.players.find((p) => p.id === "p1")?.hand.length).toBe(2);
    });

    it("142 「몹시 바쁜 마술사」's choice resolves to 143 (conditionTag, deckEffect replaces 마술사 with 마술사의도제)", () => {
      let session = startSession(PLAYERS);
      session = forceImmediateWin(session, "p1", [
        { instanceId: "c1", name: "대신" },
        { instanceId: "c2", name: "마술사" },
      ]);
      expect(session.pendingChoice?.cardId).toBe("142");
      session = resolveArchiveChoice(session, session.pendingChoice!.eligiblePlayerId, "142-apprentice");
      expect(session.storyArchive.some((c) => c.id === "142")).toBe(false);
      const card143 = session.storyArchive.find((c) => c.id === "143");
      expect(card143?.conditionTag).toBe(true);
      expect(session.removedBaseCardNames).toContain("마술사");
      expect(session.extraDeckCardNames).toContain("마술사의도제");
    });

    it("apprenticeForcedDiscard event credits 143's [성공], immediately clearing its threshold and revealing 146/147", () => {
      // 143's threshold is 1, so a single event reaching it in the same
      // round-end pass consumes the card right away (removeIds fires along
      // with the reveal) -- matches the established same-round-consumption
      // behavior already accepted elsewhere (e.g. 057). Assert on the
      // reveal, not on lingering token state that's gone by the time this
      // helper returns.
      let session = startSession(PLAYERS);
      const card143 = { ...ARCHIVE_CARD_SEEDS["143"], conditions: ARCHIVE_CARD_SEEDS["143"].conditions.map((c) => ({ ...c, fired: false })), successTokens: 0, failTokens: 0 };
      const p2 = session.round.players.find((p) => p.id === "p2")!;
      p2.hand = [{ instanceId: "p2-hand", name: "대신" }];
      session = forceImmediateWin(
        session,
        "p1",
        [
          { instanceId: "c1", name: "대신" },
          { instanceId: "c2", name: "신병" },
        ],
        [card143],
        0,
        [
          {
            type: "apprenticeForcedDiscard",
            actingPlayerId: "p1",
            targetPlayerId: "p2",
            discardedCardName: "공주",
          },
        ]
      );
      expect(session.storyArchive.some((c) => c.id === "143")).toBe(false);
      expect(session.storyArchive.some((c) => c.id === "146")).toBe(true);
      expect(session.storyArchive.some((c) => c.id === "147")).toBe(true);
    });

    it("188 「공주님들」's 3rd choice resolves to 195 -> 200 「거만한 귀족 영애」 (deckEffect add, winnerHeldCard-style reveal to 202/203)", () => {
      let session = startSession(PLAYERS);
      session = forceImmediateWin(session, "p1", [
        { instanceId: "c1", name: "대신" },
        { instanceId: "c2", name: "공주" },
      ]);
      expect(session.pendingChoice?.cardId).toBe("188");
      session = resolveArchiveChoice(session, session.pendingChoice!.eligiblePlayerId, "188-other");
      expect(session.pendingChoice?.cardId).toBe("195");
      session = resolveArchiveChoice(session, session.pendingChoice!.eligiblePlayerId, "195-noble");
      expect(session.storyArchive.some((c) => c.id === "200")).toBe(true);
      expect(session.extraDeckCardNames).toContain("귀족영애");

      // Now force a win holding 귀족영애 to complete 200's own reveal.
      session = resolveLetterChoice(session, "p1", { type: "place", slot: "잉그리드공주" });
      session = beginNextRound(session, "공주");
      session = forceImmediateWin(
        session,
        "p1",
        [
          { instanceId: "c3", name: "대신" },
          { instanceId: "c4", name: "귀족영애" },
        ],
        session.storyArchive.filter((c) => c.id === "200")
      );
      expect(session.storyArchive.some((c) => c.id === "200")).toBe(false);
      expect(session.storyArchive.some((c) => c.id === "202")).toBe(true);
      expect(session.storyArchive.some((c) => c.id === "203")).toBe(true);
    });
  });
});
