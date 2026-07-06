import type { CardInstance, CardName, CharacterUpgradeTier, GameState, GuessOption, PlayerState } from "./types";
import { nextLogId } from "./clone";

export function log(draft: GameState, message: string): void {
  draft.log.push({ id: nextLogId(), message });
}

/** Attaches a one-line PUBLIC outcome summary to the recentPlays entry for
 * the given played card (see GameState.recentPlays). Public means: never
 * include information only the acting player is supposed to know (광대's
 * seen card etc.) -- the exchange view is visible to everyone. No-op when
 * recentPlays isn't being tracked (bare rules.test.ts fixtures). */
export function setPlayOutcome(draft: GameState, cardInstanceId: string, outcome: string): void {
  const entry = draft.recentPlays?.find((p) => p.card.instanceId === cardInstanceId);
  if (entry) entry.outcome = outcome;
}

export function getPlayer(draft: GameState, playerId: string) {
  const player = draft.players.find((p) => p.id === playerId);
  if (!player) throw new Error(`Unknown player ${playerId}`);
  return player;
}

export function alivePlayers(draft: GameState) {
  return draft.players.filter((p) => !p.eliminated);
}

export function eliminatePlayer(draft: GameState, playerId: string, reason: string): void {
  const player = getPlayer(draft, playerId);
  if (player.eliminated) return;
  if (player.immuneThisRound) {
    log(draft, `${player.displayName}: ${reason} → 「정무관」 효과로 이번 라운드는 탈락하지 않습니다.`);
    return;
  }
  player.eliminated = true;
  if (!draft.firstEliminatedThisRound) draft.firstEliminatedThisRound = playerId;
  draft.lastElimination = { id: nextLogId(), playerId, reason };
  log(draft, `${player.displayName}: ${reason} → 라운드에서 탈락합니다.`);
  const hasSecondPrincess =
    player.hand.some((c) => c.name === "공주둘째") || player.discardPile.some((c) => c.name === "공주둘째");
  if (hasSecondPrincess) {
    const revived = drawCardFor(draft, playerId);
    if (revived) {
      player.eliminated = false;
      log(draft, `${player.displayName}: 「공주(둘째)」 효과로 덱에서 1장을 뽑고 복귀합니다.`);
    }
  }
}

// Draws a card for a player, falling back to the face-down burned card if
// the deck has been emptied by an out-of-turn draw (e.g. 마술사 effect).
export function drawCardFor(draft: GameState, playerId: string): CardInstance | null {
  let card = draft.deck.shift() ?? null;
  if (!card && draft.hiddenRemovedCard) {
    card = draft.hiddenRemovedCard;
    draft.hiddenRemovedCard = null;
    log(draft, "덱이 비어 있어 옆에 빼두었던 카드를 대신 뽑습니다.");
  }
  if (card) {
    getPlayer(draft, playerId).hand.push(card);
  }
  return card;
}

// Discards a card for a player (used for both normal end-of-turn discard and
// forced discards from 마술사). Handles the 공주/귀족영애 auto-elimination
// rules. 귀족영애's real text also has the discarded copy reshuffled back
// into the deck (rather than sitting in the discard pile) if any cards
// remain -- unlike 공주, which stays in the discard pile as normal.
export function discardCard(draft: GameState, playerId: string, card: CardInstance): void {
  const player = getPlayer(draft, playerId);
  player.discardPile.push(card);
  if (card.name === "공주" || card.name === "왕자" || card.name === "공주셋째") {
    eliminatePlayer(draft, playerId, `「${card.name}」를 버려서`);
    if (card.name === "공주셋째") draft.deckExhaustedThisTurn = true;
  } else if (card.name === "귀족영애") {
    eliminatePlayer(draft, playerId, "「귀족영애」를 버려서");
    if (draft.deck.length > 0) {
      player.discardPile.pop();
      const insertAt = Math.floor(Math.random() * (draft.deck.length + 1));
      draft.deck.splice(insertAt, 0, card);
      log(draft, "「귀족영애」가 덱으로 되돌아가 다시 섞입니다.");
    }
  }
}

function eligibleTargets(draft: GameState, actingPlayerId: string, allowSelf: boolean): string[] {
  return alivePlayers(draft)
    .filter((p) => (allowSelf ? true : p.id !== actingPlayerId))
    .filter((p) => !p.protected || p.id === actingPlayerId)
    .map((p) => p.id);
}

/** Shared "no legal target" fizzle path for every target-needing card. In
 * this 2P implementation the only way a card ends up with zero eligible
 * targets is the sole opponent being 승려-protected, so this doubles as the
 * public "blocked by protection" notice (see GameState.lastEffectBlocked). */
function blockNoTarget(draft: GameState, actor: PlayerState, card: CardInstance): void {
  log(draft, `${actor.displayName}: 지목할 상대가 없어 「${card.name}」 효과가 발동하지 않았습니다.`);
  setPlayOutcome(draft, card.instanceId, "대상 없음 (보호효과) → 효과 불발");
  draft.lastEffectBlocked = { id: nextLogId(), actingPlayerId: actor.id, cardName: card.name };
}

export function targetsFor(
  draft: GameState,
  actingPlayerId: string,
  cardName: CardName,
  upgrade?: CharacterUpgradeTier
): string[] {
  switch (cardName) {
    case "경비병":
    case "광대":
    case "기사":
    case "장군":
    case "신병":
    case "시종":
    case "시녀":
    case "광대의제자":
    case "복면기사":
    case "여기사":
    case "상인":
    case "군사":
    case "마술사의도제":
    case "대마도사15":
    case "대마도사20":
      return eligibleTargets(draft, actingPlayerId, false);
    case "마술사":
      // 「마술사의 도제」 편지 5개 이상 개정판: 대상 없이 스스로 카드를 교체.
      if (upgrade === "tier2") return [];
      return eligibleTargets(draft, actingPlayerId, true);
    default:
      return [];
  }
}

export function needsTarget(cardName: CardName, upgrade?: CharacterUpgradeTier): boolean {
  if (cardName === "마술사" && upgrade === "tier2") return false;
  return (
    cardName === "경비병" ||
    cardName === "광대" ||
    cardName === "기사" ||
    cardName === "장군" ||
    cardName === "마술사" ||
    cardName === "신병" ||
    cardName === "시종" ||
    cardName === "시녀" ||
    cardName === "광대의제자" ||
    cardName === "복면기사" ||
    cardName === "여기사" ||
    cardName === "상인" ||
    cardName === "군사" ||
    cardName === "마술사의도제" ||
    cardName === "대마도사15" ||
    cardName === "대마도사20"
  );
}

export function needsGuess(cardName: CardName): boolean {
  return cardName === "경비병" || cardName === "신병";
}

export function currentRoundCardNames(state: GameState): CardName[] {
  const names = new Set<CardName>();
  for (const c of state.deck) names.add(c.name);
  if (state.hiddenRemovedCard) names.add(state.hiddenRemovedCard.name);
  for (const c of state.faceUpRemovedCards) names.add(c.name);
  for (const p of state.players) {
    for (const c of p.hand) names.add(c.name);
    for (const c of p.discardPile) names.add(c.name);
  }
  return [...names];
}

export function guessOptionsFor(cardName: CardName, state?: GameState): GuessOption[] {
  if (cardName === "신병") return ["홀수", "짝수"];
  return (state ? currentRoundCardNames(state) : []).filter((n) => n !== "경비병");
}

export interface ResolveArgs {
  actingPlayerId: string;
  card: CardInstance;
  targetId?: string;
  guess?: GuessOption;
  upgrade?: CharacterUpgradeTier;
}

function guessHits(cardName: CardName, targetCardName: CardName, guess: GuessOption): boolean {
  if (cardName === "신병") {
    const rank = cardRank(targetCardName);
    if (guess === "홀수") return rank !== 1 && rank % 2 === 1;
    if (guess === "짝수") return rank !== 0 && rank % 2 === 0;
    return false;
  }
  return targetCardName === guess;
}

export function applyEffect(draft: GameState, args: ResolveArgs): void {
  const { actingPlayerId, card, targetId, guess, upgrade } = args;
  const actor = getPlayer(draft, actingPlayerId);
  draft.sessionEvents?.push({ type: "cardPlayed", actingPlayerId, cardName: card.name });

  switch (card.name) {
    case "경비병":
    case "신병": {
      if (!targetId || !guess) {
        blockNoTarget(draft, actor, card);
        return;
      }
      const target = getPlayer(draft, targetId);
      const revealedCard = target.hand.find((c) => guessHits(card.name, c.name, guess));
      const hit = Boolean(revealedCard);
      log(draft, `${actor.displayName}: ${target.displayName}을(를) 지목하고 「${guess}」(이)라고 추측합니다.`);
      draft.sessionEvents?.push({ type: "guardGuessResolved", actingPlayerId, hit, cardName: card.name });
      draft.lastGuessEffect = {
        id: nextLogId(),
        actingPlayerId,
        targetPlayerId: targetId,
        cardName: card.name,
        guess,
        hit,
        revealedCardName: hit ? revealedCard?.name : undefined,
      };
      if (hit) {
        eliminatePlayer(draft, targetId, `「${card.name}」 추측 적중`);
        setPlayOutcome(draft, card.instanceId, `「${guess}」 추측 적중! ${target.displayName} 탈락`);
      } else {
        log(draft, `${target.displayName}: 추측이 빗나갔습니다.`);
        setPlayOutcome(draft, card.instanceId, `「${guess}」 추측 → 빗나감`);
      }
      return;
    }
    case "광대":
    case "광대의제자": {
      if (!targetId) {
        blockNoTarget(draft, actor, card);
        return;
      }
      const target = getPlayer(draft, targetId);
      const seen = target.hand[0];
      log(
        draft,
        `${actor.displayName}: 「${card.name}」 효과로 ${target.displayName}의 손패(「${seen?.name ?? "없음"}」)를 확인했습니다.`
      );
      // 본 카드가 뭔지는 비공개 정보 -- 공개 요약에는 확인 사실만 남긴다.
      setPlayOutcome(draft, card.instanceId, `${target.displayName}의 손패를 확인`);
      if (seen) {
        draft.lastReveal = {
          id: nextLogId(),
          viewerPlayerId: actingPlayerId,
          cardName: card.name,
          targetDisplayName: `${target.displayName}의 손패`,
          targetCard: seen.name,
        };
      }
      return;
    }
    case "광대의제자여": {
      const seen = draft.hiddenRemovedCard;
      log(draft, `${actor.displayName}: 「광대의 제자(여)」 효과로 비공개 카드를 확인합니다.`);
      setPlayOutcome(draft, card.instanceId, "비공개 카드 확인");
      if (seen) {
        draft.lastReveal = {
          id: nextLogId(),
          viewerPlayerId: actingPlayerId,
          cardName: card.name,
          targetDisplayName: "비공개 카드",
          targetCard: seen.name,
        };
      }
      return;
    }
    // 점술사: 실카드는 "덱 위 카드 확인 후 교환" 또는 "공동 승리" 중 선택이지만,
    // v1은 앞쪽 선택지만 확인(peek)으로 단순화한다 (see cards.ts's comment).
    // 자기 자신에게만 영향을 주므로 대상 지목이 필요 없다.
    case "점술사": {
      const seen = draft.deck[0];
      log(draft, `${actor.displayName}: 「점술사」 효과로 덱 맨 위 카드를 확인합니다.`);
      const current = actor.hand[0];
      if (seen && current && cardRank(seen.name) > cardRank(current.name)) {
        actor.hand[0] = seen;
        draft.deck[0] = current;
        setPlayOutcome(draft, card.instanceId, "덱 맨 위 카드 확인 후 교환");
      } else {
        setPlayOutcome(draft, card.instanceId, "덱 맨 위 카드를 확인");
      }
      if (seen) {
        draft.lastReveal = {
          id: nextLogId(),
          viewerPlayerId: actingPlayerId,
          cardName: "점술사",
          targetDisplayName: "덱 맨 위 카드",
          targetCard: seen.name,
        };
      }
      return;
    }
    case "기사":
    case "복면기사": {
      if (!targetId) {
        blockNoTarget(draft, actor, card);
        return;
      }
      const target = getPlayer(draft, targetId);
      const actorCard = actor.hand[0];
      const targetCard = target.hand[0];
      if (!actorCard || !targetCard) return;
      log(draft, `${actor.displayName}과(와) ${target.displayName}이(가) 「${card.name}」로 카드를 비교합니다.`);
      const actorRank = effectiveCardRank(draft, actingPlayerId, actorCard.name);
      const targetRank = effectiveCardRank(draft, targetId, targetCard.name);
      // 복면기사는 실카드 규칙이 반대: 숫자가 더 "큰" 쪽이 탈락한다.
      const actorLoses =
        card.name === "복면기사" ? actorRank > targetRank : actorRank < targetRank;
      draft.lastReveal = {
        id: nextLogId(),
        viewerPlayerId: actingPlayerId,
        cardName: card.name,
        actorDisplayName: actor.displayName,
        targetDisplayName: target.displayName,
        compare: {
          actorCard: actorCard.name,
          targetCard: targetCard.name,
          result: actorRank === targetRank ? "tie" : actorLoses ? "lose" : "win",
        },
      };
      draft.sessionEvents?.push({
        type: "compareResolved",
        actingPlayerId,
        targetPlayerId: targetId,
        cardName: card.name,
        outcome: actorRank === targetRank ? "tie" : actorLoses ? "actorLoses" : "targetLoses",
      });
      if (actorRank === targetRank) {
        log(draft, "숫자가 같아 아무 일도 일어나지 않습니다.");
        setPlayOutcome(draft, card.instanceId, `${target.displayName}과(와) 비교 → 무승부`);
      } else if (actorLoses) {
        eliminatePlayer(draft, actingPlayerId, `「${card.name}」 비교에서 패배`);
        setPlayOutcome(draft, card.instanceId, `${target.displayName}과(와) 비교 패배 → ${actor.displayName} 탈락`);
      } else {
        eliminatePlayer(draft, targetId, `「${card.name}」 비교에서 패배`);
        setPlayOutcome(draft, card.instanceId, `${target.displayName}과(와) 비교 승리 → ${target.displayName} 탈락`);
      }
      return;
    }
    case "상인": {
      if (!targetId) {
        blockNoTarget(draft, actor, card);
        return;
      }
      const target = getPlayer(draft, targetId);
      const targetCard = target.hand[0];
      log(draft, `${actor.displayName}: 「상인」 효과로 ${target.displayName}을(를) 지목합니다.`);
      if (targetCard && cardRank(targetCard.name) <= 3) {
        draft.sessionEvents?.push({
          type: "compareResolved",
          actingPlayerId,
          targetPlayerId: targetId,
          cardName: card.name,
          outcome: "targetLoses",
        });
        eliminatePlayer(draft, targetId, "「상인」 효과 (손패 숫자 3 이하)");
        setPlayOutcome(draft, card.instanceId, `${target.displayName} 탈락 (숫자 3 이하)`);
      } else {
        draft.sessionEvents?.push({
          type: "compareResolved",
          actingPlayerId,
          targetPlayerId: targetId,
          cardName: card.name,
          outcome: "tie",
        });
        log(draft, `${target.displayName}의 손패는 숫자 3을 초과해 아무 일도 일어나지 않습니다.`);
        setPlayOutcome(draft, card.instanceId, `${target.displayName}에게 효과 없음 (숫자 4 이상)`);
      }
      return;
    }
    case "수사":
    case "수녀": {
      // 실카드는 어느 버림 더미 카드를 쓸지 직접 고르지만, v1은 새 선택
      // 흐름을 추가하는 대신 유효한 버린 카드 중 무작위로 하나를 골라
      // 그 효과를 재사용한다 (재사용 카드가 대상이 필요하면 대상도
      // 무작위로 고른다).
      const eligible = draft.players.flatMap((p) => p.discardPile.filter((c) => c.name !== card.name));
      if (eligible.length === 0) {
        log(draft, `${actor.displayName}: 재사용할 버린 카드가 없어 「${card.name}」 효과가 발동하지 않았습니다.`);
        setPlayOutcome(draft, card.instanceId, "재사용할 카드 없음 → 효과 불발");
        return;
      }
      const reused = eligible[Math.floor(Math.random() * eligible.length)];
      log(draft, `${actor.displayName}: 「${card.name}」 효과로 버린 더미의 「${reused.name}」 효과를 재사용합니다.`);
      setPlayOutcome(draft, card.instanceId, `「${reused.name}」 효과 재사용`);
      const reusedTargets = targetsFor(draft, actingPlayerId, reused.name, upgrade);
      const reusedTargetId =
        reusedTargets.length > 0 ? reusedTargets[Math.floor(Math.random() * reusedTargets.length)] : undefined;
      const guessableOptions = guessOptionsFor(reused.name, draft);
      const reusedGuess = needsGuess(reused.name)
        ? guessableOptions[Math.floor(Math.random() * guessableOptions.length)]
        : undefined;
      applyEffect(draft, {
        actingPlayerId,
        card: reused,
        targetId: reusedTargetId,
        guess: reusedGuess,
        upgrade,
      });
      return;
    }
    case "마녀": {
      const pooled: CardInstance[] = [];
      for (const p of alivePlayers(draft)) {
        const held = p.hand.pop();
        if (held) pooled.push(held);
      }
      for (let i = pooled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [pooled[i], pooled[j]] = [pooled[j], pooled[i]];
      }
      for (const p of alivePlayers(draft)) {
        const dealt = pooled.pop();
        if (dealt) p.hand.push(dealt);
      }
      log(draft, `${actor.displayName}: 「마녀」 효과로 모든 손패를 모아 무작위로 다시 나눕니다.`);
      setPlayOutcome(draft, card.instanceId, "모든 손패 무작위 재분배");
      return;
    }
    case "대마도사15": {
      if (!targetId) {
        blockNoTarget(draft, actor, card);
        return;
      }
      const target = getPlayer(draft, targetId);
      const discarded = target.hand.pop();
      if (discarded) discardCard(draft, targetId, discarded);
      if (!target.eliminated) target.hand.push({ instanceId: nextLogId(), name: "쥐" });
      log(draft, `${actor.displayName}: 「대마도사(15세)」 효과로 ${target.displayName}에게 「쥐」를 줍니다.`);
      setPlayOutcome(draft, card.instanceId, `${target.displayName}의 손패를 쥐로 교체`);
      return;
    }
    case "대마도사20": {
      if (!targetId) {
        blockNoTarget(draft, actor, card);
        return;
      }
      const target = getPlayer(draft, targetId);
      const taken = target.hand.pop();
      if (taken) actor.hand.push(taken);
      if (!target.eliminated) target.hand.push({ instanceId: nextLogId(), name: "쥐" });
      const discard = [...actor.hand].sort((a, b) => cardRank(a.name) - cardRank(b.name))[0];
      if (discard) {
        actor.hand = actor.hand.filter((c) => c.instanceId !== discard.instanceId);
        discardCard(draft, actingPlayerId, discard);
      }
      log(draft, `${actor.displayName}: 「대마도사(20세)」 효과로 ${target.displayName}의 손패를 받고 「쥐」를 줍니다.`);
      setPlayOutcome(draft, card.instanceId, `${target.displayName}에게 쥐를 주고 1장 버림`);
      return;
    }
    case "쥐": {
      eliminatePlayer(draft, actingPlayerId, "「쥐」를 플레이해서");
      setPlayOutcome(draft, card.instanceId, `${actor.displayName} 탈락`);
      return;
    }
    case "여장군": {
      // 실카드: "이 카드는 내려놓을 수 없습니다." -- rules.ts의 beginTurn이
      // 손패에 다른 카드가 있는 한 이 카드를 playCard 선택지에서 걸러내므로,
      // 여기 도달하는 건 다른 카드가 전혀 없는 예외 상황뿐이다.
      setPlayOutcome(draft, card.instanceId, "효과 없음");
      return;
    }
    case "군사": {
      if (!targetId) {
        blockNoTarget(draft, actor, card);
        return;
      }
      const target = getPlayer(draft, targetId);
      const seen = target.hand[0];
      log(draft, `${actor.displayName}: 「군사」 효과로 ${target.displayName}의 손패를 확인합니다.`);
      // 실카드는 확인 후 교환 여부를 선택할 수 있지만, v1은 장군처럼 항상
      // 교환하는 것으로 단순화한다.
      const actorCard = actor.hand.pop();
      const targetCard = target.hand.pop();
      if (actorCard) target.hand.push(actorCard);
      if (targetCard) actor.hand.push(targetCard);
      log(draft, `${actor.displayName}과(와) ${target.displayName}이(가) 손패를 교환합니다.`);
      setPlayOutcome(draft, card.instanceId, `${target.displayName}의 손패 확인 후 교환`);
      if (seen) {
        draft.lastReveal = {
          id: nextLogId(),
          viewerPlayerId: actingPlayerId,
          cardName: "군사",
          targetDisplayName: `${target.displayName}에게서 받은 카드`,
          targetCard: seen.name,
        };
      }
      return;
    }
    case "정무관남":
    case "정무관여": {
      actor.immuneThisRound = true;
      log(draft, `${actor.displayName}: 「${card.name}」 효과로 이번 라운드 동안 탈락하지 않습니다.`);
      setPlayOutcome(draft, card.instanceId, "이번 라운드 탈락 면역");
      return;
    }
    case "여후작": {
      // 실카드: 손패 합 12 이상이면 반드시 이 카드를 내야 함 -- 그 강제는
      // rules.ts's beginTurn에서 처리하고, 직접 낼 때는 추가 효과가 없다.
      setPlayOutcome(draft, card.instanceId, "효과 없음");
      return;
    }
    case "승려": {
      actor.protected = true;
      log(draft, `${actor.displayName}: 「승려」 효과로 다음 차례까지 보호받습니다.`);
      setPlayOutcome(draft, card.instanceId, "다음 차례까지 보호");
      return;
    }
    case "마술사": {
      // 「마술사의 도제」 편지 5개 이상 개정판: 대상 없이 스스로 손패를 교체.
      if (upgrade === "tier2") {
        const discarded = actor.hand.pop();
        if (!discarded) return;
        log(draft, `${actor.displayName}: 「마술사의 도제」 개정된 효과로 스스로 카드를 교체합니다.`);
        draft.lastForcedDiscard = {
          id: nextLogId(),
          actingPlayerId,
          targetPlayerId: actingPlayerId,
          cardName: card.name,
          discardedCardName: discarded.name,
        };
        discardCard(draft, actingPlayerId, discarded);
        setPlayOutcome(draft, card.instanceId, "스스로 손패를 교체");
        if (!getPlayer(draft, actingPlayerId).eliminated) {
          drawCardFor(draft, actingPlayerId);
          log(draft, `${actor.displayName}이(가) 덱에서 새 카드를 뽑습니다.`);
        }
        return;
      }
      if (!targetId) {
        blockNoTarget(draft, actor, card);
        return;
      }
      // 「마술사의 도제」 편지 3개 이상 개정판: 대상 지목 전에 덱 위 카드를 확인.
      if (upgrade === "tier1") {
        const peek = draft.deck.slice(0, 2);
        log(draft, `${actor.displayName}: 「마술사의 도제」 효과로 덱 위 카드 ${peek.length}장을 확인합니다.`);
      }
      const target = getPlayer(draft, targetId);
      const discarded = target.hand.pop();
      if (!discarded) return;
      log(draft, `${actor.displayName}: 「마술사」 효과로 ${target.displayName}이(가) 손패를 버립니다.`);
      draft.lastForcedDiscard = {
        id: nextLogId(),
        actingPlayerId,
        targetPlayerId: targetId,
        cardName: card.name,
        discardedCardName: discarded.name,
      };
      if (cardRank(discarded.name) >= 5 && targetId !== actingPlayerId) {
        draft.sessionEvents?.push({
          type: "wizardForcedDiscard",
          actingPlayerId,
          targetPlayerId: targetId,
          discardedCardName: discarded.name,
        });
      }
      discardCard(draft, targetId, discarded);
      if (!getPlayer(draft, targetId).eliminated) {
        drawCardFor(draft, targetId);
        log(draft, `${target.displayName}이(가) 덱에서 새 카드를 뽑습니다.`);
        setPlayOutcome(
          draft,
          card.instanceId,
          targetId === actingPlayerId ? "스스로 손패를 교체" : `${target.displayName}의 손패를 버리게 함`
        );
      } else {
        // 버린 카드가 「공주」였다면 discardCard가 즉시 탈락시킨다 -- 버린
        // 더미는 공개 정보이므로 요약에 그대로 담아도 된다.
        setPlayOutcome(draft, card.instanceId, `「공주」를 버리게 해 ${target.displayName} 탈락`);
      }
      return;
    }
    case "장군": {
      if (!targetId) {
        blockNoTarget(draft, actor, card);
        return;
      }
      const target = getPlayer(draft, targetId);
      const actorCard = actor.hand.pop();
      const targetCard = target.hand.pop();
      if (actorCard) target.hand.push(actorCard);
      if (targetCard) actor.hand.push(targetCard);
      log(draft, `${actor.displayName}과(와) ${target.displayName}이(가) 「장군」 효과로 손패를 교환합니다.`);
      setPlayOutcome(draft, card.instanceId, `${target.displayName}과(와) 손패 교환`);
      return;
    }
    case "대신": {
      // Passive: handled separately via checkMinisterElimination before the
      // player chooses a card to play. Playing it directly has no extra effect.
      setPlayOutcome(draft, card.instanceId, "효과 없음");
      return;
    }
    case "공주": {
      // Discard-triggered elimination is handled by discardCard() right
      // after applyEffect -- playing 공주 from hand always eliminates the
      // actor, so summarize that here.
      setPlayOutcome(draft, card.instanceId, `「공주」를 버려 ${actor.displayName} 탈락`);
      return;
    }
    case "마술사의도제": {
      // 실카드: 덱 맨 위를 먼저 확인한 뒤, "다른" 플레이어(자신 제외)를
      // 지목해 그 손패를 버리게 하고 새로 뽑게 한다 -- 기존 「마술사」와
      // 달리 자기 자신은 지목할 수 없다 (targetsFor에서 allowSelf: false).
      const peek = draft.deck[0];
      if (peek) {
        log(draft, `${actor.displayName}: 「마술사의 도제」 효과로 덱 맨 위 카드를 확인합니다.`);
      }
      if (!targetId) {
        blockNoTarget(draft, actor, card);
        return;
      }
      const target = getPlayer(draft, targetId);
      const discarded = target.hand.pop();
      if (!discarded) return;
      log(draft, `${actor.displayName}: 「마술사의 도제」 효과로 ${target.displayName}이(가) 손패를 버립니다.`);
      draft.lastForcedDiscard = {
        id: nextLogId(),
        actingPlayerId,
        targetPlayerId: targetId,
        cardName: card.name,
        discardedCardName: discarded.name,
      };
      if (cardRank(discarded.name) >= 5) {
        draft.sessionEvents?.push({
          type: "apprenticeForcedDiscard",
          actingPlayerId,
          targetPlayerId: targetId,
          discardedCardName: discarded.name,
        });
      }
      discardCard(draft, targetId, discarded);
      if (!getPlayer(draft, targetId).eliminated) {
        drawCardFor(draft, targetId);
        log(draft, `${target.displayName}이(가) 덱에서 새 카드를 뽑습니다.`);
      }
      setPlayOutcome(draft, card.instanceId, `덱 확인 후 ${target.displayName}의 손패를 버리게 함`);
      if (peek) {
        draft.lastReveal = {
          id: nextLogId(),
          viewerPlayerId: actingPlayerId,
          cardName: "마술사의도제",
          targetDisplayName: "덱 맨 위 카드",
          targetCard: peek.name,
        };
      }
      return;
    }
    case "귀족영애": {
      // Discard-triggered elimination (+ reshuffle back into the deck) is
      // handled by discardCard() right after applyEffect. Playing it
      // directly (not forced to discard it) has no extra effect.
      setPlayOutcome(draft, card.instanceId, "효과 없음");
      return;
    }
    case "집사": {
      setPlayOutcome(draft, card.instanceId, "버림 더미에 놓임: 숫자 보정 +2");
      return;
    }
    case "여기사": {
      if (!targetId) {
        blockNoTarget(draft, actor, card);
        return;
      }
      const target = getPlayer(draft, targetId);
      const actorCard = actor.hand[0];
      const targetCard = target.hand[0];
      if (!actorCard || !targetCard) return;
      const actorRank = effectiveCardRank(draft, actingPlayerId, actorCard.name);
      const targetRank = effectiveCardRank(draft, targetId, targetCard.name);
      const actorLoses = actorRank > targetRank;
      draft.lastReveal = {
        id: nextLogId(),
        viewerPlayerId: actingPlayerId,
        cardName: card.name,
        actorDisplayName: actor.displayName,
        targetDisplayName: target.displayName,
        compare: {
          actorCard: actorCard.name,
          targetCard: targetCard.name,
          result: actorRank === targetRank ? "tie" : actorLoses ? "lose" : "win",
        },
      };
      draft.sessionEvents?.push({
        type: "compareResolved",
        actingPlayerId,
        targetPlayerId: targetId,
        cardName: card.name,
        outcome: actorRank === targetRank ? "tie" : actorLoses ? "actorLoses" : "targetLoses",
      });
      if (actorRank === targetRank) {
        setPlayOutcome(draft, card.instanceId, `${target.displayName}과(와) 비교 → 무승부`);
      } else if (actorLoses) {
        eliminatePlayer(draft, actingPlayerId, `「${card.name}」 비교에서 패배`);
        setPlayOutcome(draft, card.instanceId, `${target.displayName}과(와) 비교 패배 → ${actor.displayName} 탈락`);
      } else {
        eliminatePlayer(draft, targetId, `「${card.name}」 비교에서 패배`);
        setPlayOutcome(draft, card.instanceId, `${target.displayName}과(와) 비교 승리 → ${target.displayName} 탈락`);
      }
      return;
    }
    case "시종":
    case "시녀": {
      if (!targetId) {
        blockNoTarget(draft, actor, card);
        return;
      }
      const target = getPlayer(draft, targetId);
      const actorCard = actor.hand.pop();
      const targetCard = target.hand.pop();
      if (actorCard) target.hand.push(actorCard);
      if (targetCard) actor.hand.push(targetCard);
      log(draft, `${actor.displayName}: 「${card.name}」 효과로 ${target.displayName}과(와) 손패를 교환합니다.`);
      setPlayOutcome(draft, card.instanceId, `${target.displayName}과(와) 손패 교환`);
      return;
    }
    case "백작부인": {
      setPlayOutcome(draft, card.instanceId, "효과 없음");
      return;
    }
  }
}

/** 035 「견습기사/호위」의 [지속] +2 순위 보정 -- "카드의 숫자를 비교할
 * 때와 라운드 종료시" (기사 비교, 덱 소진 시 승자 결정) 두 지점에서만
 * 적용된다. 손패 합계를 쓰는 대신 「12 이상」 판정(대신)에는 적용되지
 * 않는다 (실카드 문구가 "비교"만 명시). */
export function effectiveCardRank(draft: GameState, playerId: string, name: CardName): number {
  let base = cardRank(name);
  if (name === "마을소녀") base = 7;
  if (name === "배우") base = 0;
  if (name === "무희") base = 9;
  const player = draft.players.find((p) => p.id === playerId);
  if (player?.discardPile.some((c) => c.name === "집사")) base += 2;
  return draft.activeIdentities?.[playerId] === "035" ? base + 2 : base;
}

export function cardRank(name: CardName): number {
  const ranks: Record<CardName, number> = {
    경비병: 1,
    광대: 2,
    기사: 3,
    승려: 4,
    마술사: 5,
    장군: 6,
    대신: 7,
    공주: 8,
    왕자: 8,
    // 실카드는 숫자 없이 "X" -- checkKingElimination이 순위 비교 지점에
    // 도달하기 전에 항상 먼저 탈락시키므로 이 값이 실제로 쓰일 일은 없다.
    왕: 0,
    마을소녀: 0,
    신병: 1,
    시종: 1,
    시녀: 1,
    광대의제자: 2,
    광대의제자여: 2,
    점술사: 2,
    배우: 9,
    무희: 0,
    복면기사: 3,
    여기사: 3,
    상인: 3,
    수사: 4,
    수녀: 4,
    집사: 4,
    마녀: 5,
    대마도사15: 5,
    쥐: 0,
    대마도사20: 5,
    여장군: 6,
    군사: 6,
    정무관남: 7,
    정무관여: 7,
    여후작: 7,
    마술사의도제: 5,
    공주둘째: 8,
    공주셋째: 8,
    백작부인: 8,
    귀족영애: 8,
  };
  return ranks[name];
}

// 대신 passive check: if a player is holding 대신 and their hand sum >= 12,
// they are eliminated before they get to choose a card to play.
export function checkMinisterElimination(draft: GameState, playerId: string): boolean {
  const player = getPlayer(draft, playerId);
  if (player.hand.length < 2) return false;
  const hasMinister = player.hand.some((c) => c.name === "대신");
  if (!hasMinister) return false;
  const sum = player.hand.reduce((acc, c) => acc + cardRank(c.name), 0);
  if (sum >= 12) {
    eliminatePlayer(draft, playerId, `「대신」을 들고 손패 합계 ${sum}(12 이상)`);
    // 정무관's immunity can make eliminatePlayer a no-op -- return the
    // ACTUAL elimination status, not just whether the trigger fired, so
    // beginTurn doesn't skip this player's turn while leaving them
    // stranded mid-turn with no pendingDecision (see checkKingElimination).
    return player.eliminated;
  }
  return false;
}

// 025/026 「왕」 passive: unconditionally eliminated the moment it's held
// (025's deck-injected trap card). Checked at the same choke point as
// 대신's passive, before the player gets to choose a card to play.
export function checkKingElimination(draft: GameState, playerId: string): boolean {
  const player = getPlayer(draft, playerId);
  const hasKing = player.hand.some((c) => c.name === "왕");
  if (!hasKing) return false;
  eliminatePlayer(draft, playerId, "「왕」을 들고 있어");
  // See checkMinisterElimination's comment -- 정무관 immunity can make this
  // a no-op, in which case the player must still get their normal turn.
  if (!player.eliminated) return false;
  draft.sessionEvents?.push({ type: "kingElimination", playerId });
  return true;
}
