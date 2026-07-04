import type { CardInstance, CardName, CharacterUpgradeTier, GameState } from "./types";
import { nextLogId } from "./clone";

export function log(draft: GameState, message: string): void {
  draft.log.push({ id: nextLogId(), message });
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
  player.eliminated = true;
  if (!draft.firstEliminatedThisRound) draft.firstEliminatedThisRound = playerId;
  log(draft, `${player.displayName}: ${reason} → 라운드에서 탈락합니다.`);
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
// forced discards from 마술사). Handles the 공주 auto-elimination rule.
export function discardCard(draft: GameState, playerId: string, card: CardInstance): void {
  const player = getPlayer(draft, playerId);
  player.discardPile.push(card);
  if (card.name === "공주") {
    eliminatePlayer(draft, playerId, "「공주」를 버려서");
  }
}

function eligibleTargets(draft: GameState, actingPlayerId: string, allowSelf: boolean): string[] {
  return alivePlayers(draft)
    .filter((p) => (allowSelf ? true : p.id !== actingPlayerId))
    .filter((p) => !p.protected || p.id === actingPlayerId)
    .map((p) => p.id);
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
  return cardName === "경비병" || cardName === "광대" || cardName === "기사" ||
    cardName === "장군" || cardName === "마술사";
}

export function needsGuess(cardName: CardName): boolean {
  return cardName === "경비병";
}

export interface ResolveArgs {
  actingPlayerId: string;
  card: CardInstance;
  targetId?: string;
  guess?: CardName;
  upgrade?: CharacterUpgradeTier;
}

export function applyEffect(draft: GameState, args: ResolveArgs): void {
  const { actingPlayerId, card, targetId, guess, upgrade } = args;
  const actor = getPlayer(draft, actingPlayerId);

  switch (card.name) {
    case "경비병": {
      if (!targetId || !guess) {
        log(draft, `${actor.displayName}: 지목할 상대가 없어 「경비병」 효과가 발동하지 않았습니다.`);
        return;
      }
      const target = getPlayer(draft, targetId);
      const hit = target.hand.some((c) => c.name === guess);
      log(draft, `${actor.displayName}: ${target.displayName}을(를) 지목하고 「${guess}」(이)라고 추측합니다.`);
      draft.sessionEvents?.push({ type: "guardGuessResolved", actingPlayerId, hit });
      if (hit) {
        eliminatePlayer(draft, targetId, "「경비병」 추측 적중");
      } else {
        log(draft, `${target.displayName}: 추측이 빗나갔습니다.`);
      }
      return;
    }
    case "광대": {
      if (!targetId) {
        log(draft, `${actor.displayName}: 지목할 상대가 없어 「광대」 효과가 발동하지 않았습니다.`);
        return;
      }
      const target = getPlayer(draft, targetId);
      const seen = target.hand[0];
      log(
        draft,
        `${actor.displayName}: 「광대」 효과로 ${target.displayName}의 손패(「${seen?.name ?? "없음"}」)를 확인했습니다.`
      );
      if (seen) {
        draft.lastReveal = {
          id: nextLogId(),
          viewerPlayerId: actingPlayerId,
          cardName: "광대",
          targetDisplayName: target.displayName,
          targetCard: seen.name,
        };
      }
      return;
    }
    case "기사": {
      if (!targetId) {
        log(draft, `${actor.displayName}: 지목할 상대가 없어 「기사」 효과가 발동하지 않았습니다.`);
        return;
      }
      const target = getPlayer(draft, targetId);
      const actorCard = actor.hand[0];
      const targetCard = target.hand[0];
      if (!actorCard || !targetCard) return;
      log(draft, `${actor.displayName}과(와) ${target.displayName}이(가) 「기사」로 카드를 비교합니다.`);
      const actorRank = cardRank(actorCard.name);
      const targetRank = cardRank(targetCard.name);
      draft.lastReveal = {
        id: nextLogId(),
        viewerPlayerId: actingPlayerId,
        cardName: "기사",
        targetDisplayName: target.displayName,
        compare: {
          actorCard: actorCard.name,
          targetCard: targetCard.name,
          result: actorRank === targetRank ? "tie" : actorRank < targetRank ? "lose" : "win",
        },
      };
      if (actorRank === targetRank) {
        log(draft, "숫자가 같아 아무 일도 일어나지 않습니다.");
      } else if (actorRank < targetRank) {
        eliminatePlayer(draft, actingPlayerId, "「기사」 비교에서 패배");
      } else {
        eliminatePlayer(draft, targetId, "「기사」 비교에서 패배");
      }
      return;
    }
    case "승려": {
      actor.protected = true;
      log(draft, `${actor.displayName}: 「승려」 효과로 다음 차례까지 보호받습니다.`);
      return;
    }
    case "마술사": {
      // 「마술사의 도제」 편지 5개 이상 개정판: 대상 없이 스스로 손패를 교체.
      if (upgrade === "tier2") {
        const discarded = actor.hand.pop();
        if (!discarded) return;
        log(draft, `${actor.displayName}: 「마술사의 도제」 개정된 효과로 스스로 카드를 교체합니다.`);
        discardCard(draft, actingPlayerId, discarded);
        if (!getPlayer(draft, actingPlayerId).eliminated) {
          drawCardFor(draft, actingPlayerId);
          log(draft, `${actor.displayName}이(가) 덱에서 새 카드를 뽑습니다.`);
        }
        return;
      }
      if (!targetId) {
        log(draft, `${actor.displayName}: 지목할 상대가 없어 「마술사」 효과가 발동하지 않았습니다.`);
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
      }
      return;
    }
    case "장군": {
      if (!targetId) {
        log(draft, `${actor.displayName}: 지목할 상대가 없어 「장군」 효과가 발동하지 않았습니다.`);
        return;
      }
      const target = getPlayer(draft, targetId);
      const actorCard = actor.hand.pop();
      const targetCard = target.hand.pop();
      if (actorCard) target.hand.push(actorCard);
      if (targetCard) actor.hand.push(targetCard);
      log(draft, `${actor.displayName}과(와) ${target.displayName}이(가) 「장군」 효과로 손패를 교환합니다.`);
      return;
    }
    case "대신": {
      // Passive: handled separately via checkMinisterElimination before the
      // player chooses a card to play. Playing it directly has no extra effect.
      return;
    }
    case "공주": {
      // Discard-triggered elimination is handled by discardCard(); playing
      // it yourself has no additional effect beyond that.
      return;
    }
  }
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
    return true;
  }
  return false;
}
