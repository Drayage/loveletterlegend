import { shuffledDeck } from "./deck";
import { cloneState } from "./clone";
import {
  alivePlayers,
  applyEffect,
  cardRank,
  checkMinisterElimination,
  discardCard,
  drawCardFor,
  getPlayer,
  log,
  needsGuess,
  needsTarget,
  targetsFor,
} from "./effects";
import { CARD_ORDER } from "./cards";
import { resolveUpgradeTier } from "./upgrades";
import type { CardInstance, CardName, GameState, PlayerConfig } from "./types";
export type { PlayerConfig } from "./types";

/** `startingPlayerId` -- the previous round's winner leads the new round
 * (rulebook: "이전 라운드에서 승리한 플레이어가 새로운 라운드의 시작
 * 플레이어가 됩니다"). Defaults to the first configured player, which
 * also covers round 1 and plain single-round callers (e.g. rules.test.ts)
 * that don't care about session-level turn rotation. */
export function setupRound(playerConfigs: PlayerConfig[], startingPlayerId?: string): GameState {
  const deck = shuffledDeck();
  const hiddenRemovedCard = deck.shift() ?? null;
  const faceUpRemovedCards: CardInstance[] = [];
  if (playerConfigs.length === 2) {
    for (let i = 0; i < 3; i++) {
      const c = deck.shift();
      if (c) faceUpRemovedCards.push(c);
    }
  }

  const players = playerConfigs.map((cfg) => ({
    id: cfg.id,
    displayName: cfg.displayName,
    isAI: cfg.isAI,
    hand: [] as CardInstance[],
    discardPile: [] as CardInstance[],
    eliminated: false,
    protected: false,
  }));

  for (const player of players) {
    const card = deck.shift();
    if (card) player.hand.push(card);
  }

  const startingIndex = startingPlayerId ? players.findIndex((p) => p.id === startingPlayerId) : 0;

  let state: GameState = {
    players,
    deck,
    hiddenRemovedCard,
    faceUpRemovedCards,
    currentPlayerIndex: startingIndex >= 0 ? startingIndex : 0,
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
  log(state, "라운드를 시작합니다.");
  state = beginTurn(state);
  return state;
}

export function beginTurn(state: GameState): GameState {
  const draft = cloneState(state);
  const player = draft.players[draft.currentPlayerIndex];
  player.protected = false;

  const drawn = drawCardFor(draft, player.id);
  if (draft.deck.length === 0) {
    draft.deckExhaustedThisTurn = true;
  }
  if (!drawn) {
    // Should not normally happen (round ends before this), but guard anyway.
    return endRound(draft, "deckExhausted");
  }
  log(draft, `${player.displayName}의 차례입니다. 카드를 뽑았습니다.`);

  if (checkMinisterElimination(draft, player.id)) {
    return afterTurnResolved(draft);
  }

  draft.pendingDecision = {
    kind: "playCard",
    playerId: player.id,
    options: player.hand,
  };
  return draft;
}

export function chooseCardToPlay(state: GameState, cardInstanceId: string): GameState {
  const draft = cloneState(state);
  if (!draft.pendingDecision || draft.pendingDecision.kind !== "playCard") {
    throw new Error("현재 카드를 낼 차례가 아닙니다.");
  }
  const playerId = draft.pendingDecision.playerId;
  const player = getPlayer(draft, playerId);
  const idx = player.hand.findIndex((c) => c.instanceId === cardInstanceId);
  if (idx === -1) throw new Error("손에 없는 카드입니다.");
  const [card] = player.hand.splice(idx, 1);

  draft.resolvingCard = card;
  draft.resolvingPlayerId = playerId;
  draft.lastPlayedCard = { playerId, card };
  log(draft, `${player.displayName}: 「${card.name}」 카드를 냅니다.`);

  const upgrade = resolveUpgradeTier(draft, card.name);
  if (needsTarget(card.name, upgrade)) {
    const eligible = targetsFor(draft, playerId, card.name, upgrade);
    draft.pendingDecision = {
      kind: "chooseTarget",
      playerId,
      cardInstanceId: card.instanceId,
      cardName: card.name,
      eligiblePlayerIds: eligible,
    };
    if (eligible.length === 0) {
      // No valid target (everyone else protected) -- fizzle immediately.
      return finishResolution(draft, {});
    }
    return draft;
  }

  return finishResolution(draft, {});
}

export function chooseTarget(state: GameState, targetId: string): GameState {
  const draft = cloneState(state);
  if (!draft.pendingDecision || draft.pendingDecision.kind !== "chooseTarget") {
    throw new Error("현재 대상을 고를 차례가 아닙니다.");
  }
  const { playerId, cardName } = draft.pendingDecision;

  if (needsGuess(cardName)) {
    const options: CardName[] = CARD_ORDER.filter((n) => n !== "경비병");
    draft.pendingDecision = {
      kind: "guessCard",
      playerId,
      cardInstanceId: draft.pendingDecision.cardInstanceId,
      targetId,
      options,
    };
    return draft;
  }

  return finishResolution(draft, { targetId });
}

export function chooseGuess(state: GameState, guess: CardName): GameState {
  const draft = cloneState(state);
  if (!draft.pendingDecision || draft.pendingDecision.kind !== "guessCard") {
    throw new Error("현재 카드를 추측할 차례가 아닙니다.");
  }
  const { targetId } = draft.pendingDecision;
  return finishResolution(draft, { targetId, guess });
}

function finishResolution(
  draft: GameState,
  extra: { targetId?: string; guess?: CardName }
): GameState {
  const card = draft.resolvingCard;
  const playerId = draft.resolvingPlayerId;
  if (!card || !playerId) throw new Error("진행 중인 카드가 없습니다.");

  const upgrade = resolveUpgradeTier(draft, card.name);
  applyEffect(draft, { actingPlayerId: playerId, card, upgrade, ...extra });

  const actor = getPlayer(draft, playerId);
  if (!actor.eliminated) {
    discardCard(draft, playerId, card);
  } else {
    actor.discardPile.push(card);
  }

  draft.resolvingCard = null;
  draft.resolvingPlayerId = null;
  draft.pendingDecision = null;

  return afterTurnResolved(draft);
}

function afterTurnResolved(draft: GameState): GameState {
  const alive = alivePlayers(draft);
  if (alive.length <= 1) {
    return endRound(draft, "lastPlayerStanding");
  }
  if (draft.deckExhaustedThisTurn) {
    return endRound(draft, "deckExhausted");
  }
  return advanceTurn(draft);
}

function advanceTurn(draft: GameState): GameState {
  const n = draft.players.length;
  let next = (draft.currentPlayerIndex + 1) % n;
  let guard = 0;
  while (draft.players[next].eliminated && guard < n) {
    next = (next + 1) % n;
    guard += 1;
  }
  draft.currentPlayerIndex = next;
  return beginTurn(draft);
}

function endRound(
  draft: GameState,
  reason: "lastPlayerStanding" | "deckExhausted"
): GameState {
  const alive = alivePlayers(draft);
  let winnerId: string | null = null;

  if (reason === "lastPlayerStanding") {
    winnerId = alive[0]?.id ?? null;
    if (winnerId) {
      log(draft, `${getPlayer(draft, winnerId).displayName} 만 남아 라운드에서 승리합니다!`);
    }
  } else {
    log(draft, "덱이 소진되어 라운드가 종료됩니다. 남은 플레이어의 카드를 공개합니다.");
    let best: { id: string; rank: number }[] = [];
    for (const p of alive) {
      const c = p.hand[0];
      if (!c) continue;
      const r = cardRank(c.name);
      log(draft, `${p.displayName}: 「${c.name}」 (${r})`);
      if (best.length === 0 || r > best[0].rank) {
        best = [{ id: p.id, rank: r }];
      } else if (r === best[0].rank) {
        best.push({ id: p.id, rank: r });
      }
    }
    if (best.length === 1) {
      winnerId = best[0].id;
      log(draft, `${getPlayer(draft, winnerId).displayName}이(가) 가장 높은 카드로 승리합니다!`);
    } else {
      log(draft, "동점으로 무승부입니다.");
    }
  }

  const revealedHands: Record<string, CardInstance | undefined> = {};
  for (const p of draft.players) revealedHands[p.id] = p.hand[0];

  draft.roundResult = { reason, winnerId, revealedHands };
  draft.pendingDecision = null;
  return draft;
}

// Re-export for convenience so UI code has a single import surface.
export { eliminatePlayer, alivePlayers } from "./effects";
