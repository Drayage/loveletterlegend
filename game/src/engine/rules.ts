import { shuffledDeck } from "./deck";
import { cloneState } from "./clone";
import {
  alivePlayers,
  applyEffect,
  cardRank,
  checkKingElimination,
  checkMinisterElimination,
  discardCard,
  drawCardFor,
  effectiveCardRank,
  eliminatePlayer,
  getPlayer,
  hasReusablePlayEffect,
  log,
  guessOptionsFor,
  needsGuess,
  needsTarget,
  targetsFor,
} from "./effects";
import { resolveUpgradeTier } from "./upgrades";
import type { CardInstance, CardName, GameState, GuessOption, PlayerConfig, PlayerState } from "./types";
export type { PlayerConfig } from "./types";

/** `startingPlayerId` -- the previous round's winner leads the new round
 * (rulebook: "이전 라운드에서 승리한 플레이어가 새로운 라운드의 시작
 * 플레이어가 됩니다"). Defaults to the first configured player, which
 * also covers round 1 and plain single-round callers (e.g. rules.test.ts)
 * that don't care about session-level turn rotation. */
export function setupRound(
  playerConfigs: PlayerConfig[],
  startingPlayerId?: string,
  extraCardNames?: CardName[],
  removedBaseCardNames?: CardName[]
): GameState {
  const deck = shuffledDeck(extraCardNames, removedBaseCardNames);
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
    lastElimination: null,
    lastGuessEffect: null,
    lastForcedDiscard: null,
    lastEffectBlocked: null,
    firstEliminatedThisRound: null,
    recentPlays: [],
  };
  log(state, "라운드를 시작합니다.");
  state = beginTurn(state);
  return state;
}

/** Two base cards restrict which of the player's 2 hand cards may actually
 * be chosen this turn, rather than being caught by a simple elimination
 * passive:
 * - 「여후작」[184]: 손패 합 12 이상이면 반드시 이 카드를 내야 한다.
 * - 「여장군」[165]: "이 카드는 내려놓을 수 없습니다" -- 다른 카드가 있는
 *   한 절대 선택지에 들어가지 않는다.
 * Falls back to the full hand if applying a rule would leave zero options
 * (e.g. both cards are somehow the same restricted name). */
function restrictedPlayOptions(hand: CardInstance[]): CardInstance[] {
  if (hand.length >= 2) {
    const marchioness = hand.find((c) => c.name === "여후작");
    if (marchioness) {
      const sum = hand.reduce((acc, c) => acc + cardRank(c.name), 0);
      if (sum >= 12) return [marchioness];
    }
  }
  const withoutLadyGeneral = hand.filter((c) => c.name !== "여장군");
  const withoutUnplayableRank8 = withoutLadyGeneral.filter((c) => c.name !== "백작부인");
  if (withoutUnplayableRank8.length > 0) return withoutUnplayableRank8;
  return withoutLadyGeneral.length > 0 ? withoutLadyGeneral : hand;
}

export function beginTurn(state: GameState): GameState {
  const draft = cloneState(state);
  const player = draft.players[draft.currentPlayerIndex];
  player.protected = false;

  if (
    draft.activeIdentities?.[player.id] === "033" &&
    !draft.identityRoundUsed?.[`${player.id}:033`] &&
    draft.hiddenRemovedCard &&
    player.hand[0]
  ) {
    draft.pendingDecision = { kind: "identitySwap", playerId: player.id };
    return draft;
  }

  const drawn = drawCardFor(draft, player.id);
  if (draft.deck.length === 0) {
    draft.deckExhaustedThisTurn = true;
  }
  if (!drawn) {
    // Should not normally happen (round ends before this), but guard anyway.
    return endRound(draft, "deckExhausted");
  }
  log(draft, `${player.displayName}의 차례입니다. 카드를 뽑았습니다.`);

  if (checkKingElimination(draft, player.id) || checkMinisterElimination(draft, player.id)) {
    return afterTurnResolved(draft, player.id);
  }

  draft.pendingDecision = {
    kind: "playCard",
    playerId: player.id,
    options: restrictedPlayOptions(player.hand),
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
  // 중앙 테이블의 "누가 뭘 냈고 어떻게 됐는지" 교환 뷰용 -- 최근 2건만
  // 유지 (2인전에서 양쪽의 직전 플레이). outcome은 효과가 실제로 해소될
  // 때 effects.ts의 setPlayOutcome이 채운다.
  if (draft.recentPlays) {
    draft.recentPlays.push({ playerId, card, outcome: null });
    while (draft.recentPlays.length > 2) draft.recentPlays.shift();
  }
  log(draft, `${player.displayName}: 「${card.name}」 카드를 냅니다.`);

  const upgrade = resolveUpgradeTier(draft, card.name, playerId);
  if (draft.activeIdentities?.[playerId] === "036" && !draft.identityRoundUsed?.[`${playerId}:036`]) {
    const options = draft.players
      .flatMap((p) => p.discardPile)
      .filter((c) => c.name !== card.name && hasReusablePlayEffect(c.name));
    if (options.length > 0) {
      draft.pendingDecision = {
        kind: "identityReplaceEffect",
        playerId,
        cardInstanceId: card.instanceId,
        cardName: card.name,
        options,
      };
      return draft;
    }
  }

  // 점술사: 실카드의 두 선택지(덱 확인 / 공동 승리 지목)를 먼저 고른다.
  if (card.name === "점술사") {
    draft.pendingDecision = { kind: "fortunePath", playerId, cardInstanceId: card.instanceId, cardName: card.name };
    return draft;
  }

  // 수사/수녀: 버림 더미에서 재사용할 「플레이:」 효과 카드를 직접 고른다.
  if (card.name === "수사" || card.name === "수녀") {
    const options = draft.players
      .flatMap((p) => p.discardPile)
      .filter((c) => c.name !== card.name && hasReusablePlayEffect(c.name));
    if (options.length > 0) {
      draft.pendingDecision = {
        kind: "reuseDiscard",
        playerId,
        cardInstanceId: card.instanceId,
        cardName: card.name,
        options,
      };
      return draft;
    }
    // 재사용할 카드가 없으면 그대로 불발 처리 (applyEffect의 수사/수녀 케이스).
    return finishResolution(draft, {});
  }

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
  const { playerId, cardName, effectCardName } = draft.pendingDecision;
  if (!draft.pendingDecision.eligiblePlayerIds.includes(targetId)) {
    throw new Error("선택할 수 없는 대상입니다.");
  }
  const card = draft.resolvingCard;
  if (
    card &&
    targetId !== playerId &&
    draft.activeIdentities?.[targetId] === "034" &&
    !draft.identityRoundUsed?.[`${targetId}:034`]
  ) {
    draft.pendingDecision = {
      kind: "identityCancel",
      playerId: targetId,
      actingPlayerId: playerId,
      cardInstanceId: card.instanceId,
      cardName,
      effectCardName,
      targetId,
    };
    return draft;
  }

  return continueAfterTarget(draft, {
    playerId,
    cardInstanceId: draft.pendingDecision.cardInstanceId,
    cardName,
    effectCardName,
    targetId,
  });
}

/** Shared tail of the target-selection flow (chooseTarget and the 034
 * identity-cancel decline path): installs the follow-up decision the chosen
 * card still needs -- 경비병/신병's guess, 군사's "확인 후 교환 여부" -- or
 * resolves immediately when there is none. */
function continueAfterTarget(
  draft: GameState,
  args: { playerId: string; cardInstanceId: string; cardName: CardName; effectCardName?: CardName; targetId: string }
): GameState {
  const { playerId, cardInstanceId, cardName, effectCardName, targetId } = args;
  if (needsGuess(cardName)) {
    const upgrade = resolveUpgradeTier(draft, cardName, playerId);
    draft.pendingDecision = {
      kind: "guessCard",
      playerId,
      cardInstanceId,
      cardName,
      effectCardName,
      targetId,
      options: guessOptionsFor(cardName, draft),
      guesses: [],
      maxGuesses: cardName === "경비병" && upgrade ? 2 : 1,
    };
    return draft;
  }

  // 군사: 실카드 문구대로 상대 손패를 먼저 확인(선택자에게만 공개)한 뒤
  // 교환 여부를 선택한다. 확인한 카드는 tacticianSwap 결정 패널이 보여준다.
  if (cardName === "군사") {
    const target = getPlayer(draft, targetId);
    const seen = target.hand[0];
    if (seen) {
      log(draft, `${getPlayer(draft, playerId).displayName}: 「군사」 효과로 ${target.displayName}의 손패를 확인합니다.`);
      draft.pendingDecision = {
        kind: "tacticianSwap",
        playerId,
        cardInstanceId,
        cardName,
        effectCardName,
        targetId,
        seenCardName: seen.name,
      };
      return draft;
    }
  }

  return finishResolution(draft, { targetId, effectCardName });
}

export function chooseGuess(state: GameState, guess: GuessOption): GameState {
  const draft = cloneState(state);
  if (!draft.pendingDecision || draft.pendingDecision.kind !== "guessCard") {
    throw new Error("현재 카드를 추측할 차례가 아닙니다.");
  }
  const decision = draft.pendingDecision;
  const guesses = [...(decision.guesses ?? []), guess];
  if ((decision.maxGuesses ?? 1) > guesses.length) {
    draft.pendingDecision = {
      ...decision,
      guesses,
      options: decision.options.filter((option) => option !== guess),
    };
    return draft;
  }
  return finishResolution(draft, { targetId: decision.targetId, guess: guesses.join("|") as GuessOption, effectCardName: decision.effectCardName });
}

/** 「점술사」의 두 선택지: "peek"(덱 맨 위 확인, 이어서 교환 여부 선택) 또는
 * "coWin"(다른 플레이어 지목 -- 그가 승리하면 공동 승리). */
export function chooseFortunePath(state: GameState, path: "peek" | "coWin"): GameState {
  const draft = cloneState(state);
  if (!draft.pendingDecision || draft.pendingDecision.kind !== "fortunePath") {
    throw new Error("현재 점술사 선택지를 고를 차례가 아닙니다.");
  }
  const decision = draft.pendingDecision;
  if (path === "coWin") {
    return finishResolution(draft, { effectCardName: decision.effectCardName, option: "coWin" });
  }
  const seen = draft.deck[0];
  if (!seen) {
    return finishResolution(draft, { effectCardName: decision.effectCardName, option: "keep" });
  }
  // 확인한 카드는 deckSwap 결정 패널 자체가 보여준다 (별도 reveal 모달을
  // 띄우면 선택 패널과 겹쳐 흐름이 어색해진다).
  log(draft, `${getPlayer(draft, decision.playerId).displayName}: 「점술사」 효과로 덱 맨 위 카드를 확인합니다.`);
  draft.pendingDecision = {
    kind: "deckSwap",
    playerId: decision.playerId,
    cardInstanceId: decision.cardInstanceId,
    cardName: decision.cardName,
    effectCardName: decision.effectCardName,
    seenCardName: seen.name,
  };
  return draft;
}

/** 「점술사」 peek의 후속: 확인한 덱 맨 위 카드와 손패를 교환할지. */
export function chooseDeckSwap(state: GameState, swap: boolean): GameState {
  const draft = cloneState(state);
  if (!draft.pendingDecision || draft.pendingDecision.kind !== "deckSwap") {
    throw new Error("현재 덱 카드 교환을 선택할 차례가 아닙니다.");
  }
  return finishResolution(draft, {
    effectCardName: draft.pendingDecision.effectCardName,
    option: swap ? "swap" : "keep",
  });
}

/** 「군사」의 후속: 확인한 상대 손패와 교환할지. */
export function chooseTacticianSwap(state: GameState, swap: boolean): GameState {
  const draft = cloneState(state);
  if (!draft.pendingDecision || draft.pendingDecision.kind !== "tacticianSwap") {
    throw new Error("현재 군사 교환 여부를 선택할 차례가 아닙니다.");
  }
  const decision = draft.pendingDecision;
  return finishResolution(draft, {
    targetId: decision.targetId,
    effectCardName: decision.effectCardName,
    option: swap ? "swap" : "keep",
  });
}

/** 「수사/수녀」: 선택한 버림 더미 카드의 「플레이:」 효과를 재사용한다 --
 * effectCardName 메커니즘(036 「학생/여학생」과 동일)으로 대상/추측 등
 * 후속 플로우까지 그대로 이어진다. */
export function chooseReuseCard(state: GameState, reuseInstanceId: string): GameState {
  const draft = cloneState(state);
  if (!draft.pendingDecision || draft.pendingDecision.kind !== "reuseDiscard") {
    throw new Error("현재 재사용할 카드를 고를 차례가 아닙니다.");
  }
  const decision = draft.pendingDecision;
  const reused = decision.options.find((c) => c.instanceId === reuseInstanceId);
  if (!reused) throw new Error("선택할 수 없는 버림 더미 카드입니다.");
  log(
    draft,
    `${getPlayer(draft, decision.playerId).displayName}: 「${decision.cardName}」 효과로 버림 더미의 「${reused.name}」 효과를 재사용합니다.`
  );
  draft.pendingDecision = null;
  const upgrade = resolveUpgradeTier(draft, reused.name, decision.playerId);
  if (reused.name === "점술사") {
    draft.pendingDecision = {
      kind: "fortunePath",
      playerId: decision.playerId,
      cardInstanceId: decision.cardInstanceId,
      cardName: reused.name,
      effectCardName: reused.name,
    };
    return draft;
  }
  if (needsTarget(reused.name, upgrade)) {
    const eligible = targetsFor(draft, decision.playerId, reused.name, upgrade);
    draft.pendingDecision = {
      kind: "chooseTarget",
      playerId: decision.playerId,
      cardInstanceId: decision.cardInstanceId,
      cardName: reused.name,
      effectCardName: reused.name,
      eligiblePlayerIds: eligible,
    };
    if (eligible.length === 0) return finishResolution(draft, { effectCardName: reused.name });
    return draft;
  }
  return finishResolution(draft, { effectCardName: reused.name });
}

/** 「대마도사(20세)」의 후속: 손에 든 카드 중 버릴 1장을 고른다 (공주류를
 * 고르면 그대로 탈락 규칙이 적용된다). */
export function chooseHandDiscard(state: GameState, cardInstanceId: string): GameState {
  const draft = cloneState(state);
  if (!draft.pendingDecision || draft.pendingDecision.kind !== "discardFromHand") {
    throw new Error("현재 버릴 카드를 고를 차례가 아닙니다.");
  }
  const decision = draft.pendingDecision;
  const actor = getPlayer(draft, decision.playerId);
  const idx = actor.hand.findIndex((c) => c.instanceId === cardInstanceId);
  if (idx === -1) throw new Error("손에 없는 카드입니다.");
  const [discarded] = actor.hand.splice(idx, 1);
  log(draft, `${actor.displayName}: 「${decision.cardName}」 효과로 「${discarded.name}」를 버립니다.`);
  discardCard(draft, decision.playerId, discarded);
  draft.pendingDecision = null;
  return afterTurnResolved(draft, decision.playerId);
}

export function chooseIdentitySwap(state: GameState, use: boolean): GameState {
  const draft = cloneState(state);
  if (!draft.pendingDecision || draft.pendingDecision.kind !== "identitySwap") {
    throw new Error("현재 정체 교환을 선택할 차례가 아닙니다.");
  }
  const player = getPlayer(draft, draft.pendingDecision.playerId);
  draft.identityRoundUsed = { ...(draft.identityRoundUsed ?? {}), [`${player.id}:033`]: true };
  if (use && draft.hiddenRemovedCard && player.hand[0]) {
    const previous = player.hand[0];
    player.hand[0] = draft.hiddenRemovedCard;
    draft.hiddenRemovedCard = previous;
    log(draft, `${player.displayName}: 「농부/양치기」 효과로 비공개 카드와 손패를 교환합니다.`);
  }
  draft.pendingDecision = null;
  return beginTurn(draft);
}

export function chooseIdentityCancel(state: GameState, use: boolean): GameState {
  const draft = cloneState(state);
  if (!draft.pendingDecision || draft.pendingDecision.kind !== "identityCancel") {
    throw new Error("현재 정체 취소를 선택할 차례가 아닙니다.");
  }
  const decision = draft.pendingDecision;
  if (use) {
    const target = getPlayer(draft, decision.playerId);
    draft.identityRoundUsed = { ...(draft.identityRoundUsed ?? {}), [`${decision.playerId}:034`]: true };
    log(draft, `${target.displayName}: 「사냥꾼/약초꾼」 효과로 「${decision.cardName}」 효과를 취소합니다.`);
    const actor = getPlayer(draft, decision.actingPlayerId);
    const card = draft.resolvingCard;
    if (card) {
      actor.discardPile.push(card);
      draft.resolvingCard = null;
      draft.resolvingPlayerId = null;
    }
    draft.pendingDecision = null;
    return afterTurnResolved(draft, decision.actingPlayerId);
  }
  draft.pendingDecision = null;
  return continueAfterTarget(draft, {
    playerId: decision.actingPlayerId,
    cardInstanceId: decision.cardInstanceId,
    cardName: decision.cardName,
    effectCardName: decision.effectCardName,
    targetId: decision.targetId,
  });
}

export function chooseIdentityReplacement(state: GameState, replacementInstanceId: string | null): GameState {
  const draft = cloneState(state);
  if (!draft.pendingDecision || draft.pendingDecision.kind !== "identityReplaceEffect") {
    throw new Error("현재 정체 효과 대체를 선택할 차례가 아닙니다.");
  }
  const decision = draft.pendingDecision;
  if (replacementInstanceId) {
    const replacement = decision.options.find((c) => c.instanceId === replacementInstanceId);
    if (!replacement) throw new Error("선택할 수 없는 버림 더미 카드입니다.");
    draft.identityRoundUsed = { ...(draft.identityRoundUsed ?? {}), [`${decision.playerId}:036`]: true };
    log(draft, `${getPlayer(draft, decision.playerId).displayName}: 「학생/여학생」 효과로 「${decision.cardName}」 대신 「${replacement.name}」 효과를 사용합니다.`);
    draft.pendingDecision = null;
    const upgrade = resolveUpgradeTier(draft, replacement.name, decision.playerId);
    if (needsTarget(replacement.name, upgrade)) {
      const eligible = targetsFor(draft, decision.playerId, replacement.name, upgrade);
      draft.pendingDecision = {
        kind: "chooseTarget",
        playerId: decision.playerId,
        cardInstanceId: decision.cardInstanceId,
        cardName: replacement.name,
        effectCardName: replacement.name,
        eligiblePlayerIds: eligible,
      };
      if (eligible.length === 0) return finishResolution(draft, { effectCardName: replacement.name });
      return draft;
    }
    return finishResolution(draft, { effectCardName: replacement.name });
  }
  draft.pendingDecision = null;
  const upgrade = resolveUpgradeTier(draft, decision.cardName, decision.playerId);
  if (needsTarget(decision.cardName, upgrade)) {
    const eligible = targetsFor(draft, decision.playerId, decision.cardName, upgrade);
    draft.pendingDecision = {
      kind: "chooseTarget",
      playerId: decision.playerId,
      cardInstanceId: decision.cardInstanceId,
      cardName: decision.cardName,
      eligiblePlayerIds: eligible,
    };
    if (eligible.length === 0) return finishResolution(draft, {});
    return draft;
  }
  return finishResolution(draft, {});
}

function finishResolution(
  draft: GameState,
  extra: { targetId?: string; guess?: GuessOption; effectCardName?: CardName; option?: string }
): GameState {
  const card = draft.resolvingCard;
  const playerId = draft.resolvingPlayerId;
  if (!card || !playerId) throw new Error("진행 중인 카드가 없습니다.");

  const effectCard = extra.effectCardName ? { ...card, name: extra.effectCardName } : card;
  const upgrade = resolveUpgradeTier(draft, effectCard.name, playerId);
  draft.pendingDecision = null;
  applyEffect(draft, { actingPlayerId: playerId, card: effectCard, upgrade, ...extra });
  // 효과가 후속 선택(대마도사20의 discardFromHand 등)을 설치했다면 붙잡아
  // 두고, 카드 버림 처리 후 그 선택으로 턴을 일시정지한다.
  const followUp = draft.pendingDecision;
  draft.pendingDecision = null;

  const actor = getPlayer(draft, playerId);
  if (!actor.eliminated) {
    discardCard(draft, playerId, card);
  } else {
    actor.discardPile.push(card);
  }

  // 수녀의 [편지] 강화: 재사용 여부와 무관하게 사용 후 다음 차례까지 보호.
  if (card.name === "수녀" && !actor.eliminated && resolveUpgradeTier(draft, "수녀", playerId)) {
    actor.protected = true;
    log(draft, `${actor.displayName}: 강화된 「수녀」 효과로 다음 차례까지 보호받습니다.`);
  }

  draft.resolvingCard = null;
  draft.resolvingPlayerId = null;

  if (followUp && !actor.eliminated) {
    draft.pendingDecision = followUp;
    return draft;
  }

  return afterTurnResolved(draft, playerId);
}

function afterTurnResolved(draft: GameState, endedTurnPlayerId?: string): GameState {
  const actor = endedTurnPlayerId ? getPlayer(draft, endedTurnPlayerId) : null;
  if (
    draft.deckExhaustedThisTurn &&
    actor &&
    !actor.eliminated &&
    actor.hand.some((c) => c.name === "백작부인")
  ) {
    eliminatePlayer(draft, actor.id, "덱이 떨어진 차례를 마칠 때 「백작부인」을 들고 있어");
  }
  const alive = alivePlayers(draft);
  if (alive.length <= 1) {
    return endRound(draft, "lastPlayerStanding");
  }
  if (draft.deckExhaustedThisTurn) {
    return endRound(draft, "deckExhausted");
  }
  if (
    actor &&
    !actor.eliminated &&
    draft.activeIdentities?.[actor.id] === "037" &&
    !draft.identityGameUsed?.[`${actor.id}:037`]
  ) {
    draft.pendingDecision = { kind: "identityExtraTurn", playerId: actor.id };
    return draft;
  }
  return advanceTurn(draft);
}

export function chooseIdentityExtraTurn(state: GameState, use: boolean): GameState {
  const draft = cloneState(state);
  if (!draft.pendingDecision || draft.pendingDecision.kind !== "identityExtraTurn") {
    throw new Error("현재 추가 차례를 선택할 차례가 아닙니다.");
  }
  const playerId = draft.pendingDecision.playerId;
  draft.identityGameUsed = { ...(draft.identityGameUsed ?? {}), [`${playerId}:037`]: true };
  draft.pendingDecision = null;
  if (use) {
    log(draft, `${getPlayer(draft, playerId).displayName}: 「여행자/순례자」 효과로 한 번 더 차례를 가집니다.`);
    return beginTurn(draft);
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

/** Ranks alive players into descending-value tiers (players sharing a value
 * land in the same tier) -- shared by both the default "highest wins" rule
 * and 039 「역사 5」의 축제 덱 대체 규칙(043/044) which pick a specific tier
 * instead of always the top one. */
function valueTiers(values: Array<{ id: string; value: number }>): string[][] {
  const sorted = [...values].sort((a, b) => b.value - a.value);
  const tiers: string[][] = [];
  for (const { id, value } of sorted) {
    if (tiers.length > 0 && sorted.find((v) => v.id === tiers[tiers.length - 1][0])!.value === value) {
      tiers[tiers.length - 1].push(id);
    } else {
      tiers.push([id]);
    }
  }
  return tiers;
}

/** 덱 소진 시 승자 결정 -- 기본은 "손에 든 카드 숫자가 가장 큰 플레이어
 * 승리" (동점이면 무승부)지만, 039 「역사 5」가 공개되어 있다면 그 라운드
 * 시작시 뽑은 축제 덱 카드(040~047)가 이 규칙을 통째로 바꿀 수 있다. */
function determineDeckExhaustedWinner(draft: GameState, alive: PlayerState[]): string | null {
  const festivalId = draft.activeFestivalCardId;

  // 046 「별의 축복」: 덱이 소진되면 무조건 승자 없음 (오직 최후의 1인
  // 생존으로만 승리 가능).
  if (festivalId === "046") return null;

  // 045 「건국제」: 버린 카드 숫자의 합이 가장 큰 플레이어 승리. 집사/035의
  // +2는 "손에 든 카드"에만 적용되는 보정이므로 버림 더미 합에는 카드의
  // 인쇄 숫자를 그대로 쓴다.
  if (festivalId === "045") {
    const values = alive.map((p) => ({
      id: p.id,
      value: p.discardPile.reduce((sum, c) => sum + cardRank(c.name), 0),
    }));
    const tiers = valueTiers(values);
    return tiers[0]?.length === 1 ? tiers[0][0] : null;
  }

  const values = alive
    .map((p) => {
      const c = p.hand[0];
      if (!c) return null;
      let value = effectiveCardRank(draft, p.id, c.name);
      const base = cardRank(c.name);
      // 041/042 「수확제/강탄제」: 실카드 숫자(035의 +2 보정 전) 기준 홀/짝에
      // +8. 견습기사/호위의 보정은 그 위에 그대로 유지된다.
      if (festivalId === "041" && base % 2 === 1) value += 8;
      if (festivalId === "042" && base % 2 === 0) value += 8;
      return { id: p.id, value };
    })
    .filter((v): v is { id: string; value: number } => v !== null);

  // 047 「정원파티」: 비공개 카드도 비교 대상에 포함 -- 그게 유일한 최댓값
  // 이면 승자 없음.
  if (festivalId === "047" && draft.hiddenRemovedCard) {
    const hiddenValue = effectiveCardRank(draft, "__hidden__", draft.hiddenRemovedCard.name);
    const allValues = [...values, { id: "__hidden__", value: hiddenValue }];
    const tiers = valueTiers(allValues);
    if (tiers[0]?.length === 1 && tiers[0][0] === "__hidden__") return null;
    return tiers[0]?.length === 1 ? tiers[0][0] : null;
  }

  const tiers = valueTiers(values);
  if (festivalId === "043") {
    // 「알현식」: 두 번째로 숫자가 큰 플레이어 승리 (2번째 tier가 없거나
    // 단독이 아니면 승자 없음).
    return tiers[1]?.length === 1 ? tiers[1][0] : null;
  }
  if (festivalId === "044") {
    // 「원탁회의」: 가장 작은 값(tiers 배열의 끝)부터 훑어 단독인 tier를
    // 찾는다 -- 동률이면 그다음으로 작은 값(한 단계 위 tier)으로 넘어간다
    // (실카드 문구 "다음으로 숫자가 작은 플레이어"). tiers는 내림차순이므로
    // 끝에서부터 앞으로 탐색.
    for (let i = tiers.length - 1; i >= 0; i--) {
      if (tiers[i].length === 1) return tiers[i][0];
    }
    return null;
  }
  // 기본(040 또는 축제 없음): 가장 큰 값의 tier가 단독일 때만 승리.
  return tiers[0]?.length === 1 ? tiers[0][0] : null;
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
    for (const p of alive) {
      const c = p.hand[0];
      if (c) log(draft, `${p.displayName}: 「${c.name}」 (${effectiveCardRank(draft, p.id, c.name)})`);
    }
    winnerId = determineDeckExhaustedWinner(draft, alive);
    if (winnerId) {
      log(draft, `${getPlayer(draft, winnerId).displayName}이(가) 승리합니다!`);
    } else {
      log(draft, "승자가 없습니다 (무승부).");
    }
  }

  const revealedHands: Record<string, CardInstance | undefined> = {};
  for (const p of draft.players) revealedHands[p.id] = p.hand[0];

  // 「점술사」 공동 승리: 지목했던 대상이 이 라운드의 승자라면 지목자도
  // 함께 승리한 것으로 기록한다 (편지 보상은 세션 레이어가 처리).
  const coWinnerIds = winnerId
    ? [
        ...new Set(
          (draft.fortuneCoWins ?? [])
            .filter((c) => c.targetId === winnerId && c.playerId !== winnerId)
            .map((c) => c.playerId)
        ),
      ]
    : [];
  if (coWinnerIds.length > 0) {
    log(
      draft,
      `「점술사」의 예언이 적중했습니다! ${coWinnerIds.map((id) => getPlayer(draft, id).displayName).join(", ")}도 함께 승리합니다.`
    );
  }

  draft.roundResult = { reason, winnerId, revealedHands, coWinnerIds };
  draft.pendingDecision = null;
  return draft;
}

// Re-export for convenience so UI code has a single import surface.
export { eliminatePlayer, alivePlayers } from "./effects";
