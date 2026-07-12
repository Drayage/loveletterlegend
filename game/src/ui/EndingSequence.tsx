import { useEffect, useState } from "react";
import { seedArchiveCard, type SessionState } from "../engine/session";
import type { ArchiveCardState, CharacterSlotId } from "../engine/types";
import {
  resolveEndingForPlayer,
  trueEndingSuccessCardCount,
  shuffleTrueEndingDeck,
  identityGenderOf,
  type ResolvedEnding,
  type TrueEndingCard,
} from "../engine/endings";
import { TRUE_ENDING_TEXT, TRUE_ENDING_FAIL_TEXT } from "../data/endings";
import { loadRecords, trueEndingHistoryFor } from "../persistence/records";
import {
  ENDING_IMAGES,
  characterEndingImageKey,
  noMatchEndingImageKey,
  sameSexEndingImageKey,
  trueEndingImageKey,
} from "../data/endingImages";
import { slotDisplayName } from "./slotInfo";
import { EndingScene } from "./EndingScene";
import { TrueEndingDraw } from "./TrueEndingDraw";
import { TrueEndingFailModal } from "./TrueEndingFailModal";
import { StoryEventModal } from "./StoryEventModal";

interface EndingSequenceProps {
  session: SessionState;
  humanId: string;
  /** 시퀀스가 끝까지 재생된 뒤 정확히 한 번 호출된다 -- 호출부가 이
   * 결과로 기록(persistence/records.ts)을 남기고 다음 화면으로 넘어간다.
   * identityName은 032(정체)를 받아본 적 없는 경우에만 null. */
  onComplete: (identityName: string | null, endingSlot: CharacterSlotId | null, wasTrueEnding: boolean) => void;
}

interface EndingSetup {
  identityName: string;
  slot: CharacterSlotId | null;
  resolved: ResolvedEnding;
  /** 8번 캐릭터와 정상 매칭됐을 때만 채워진다. */
  deck: TrueEndingCard[] | null;
  /** deck이 있을 때만 채워진다 -- 진엔딩 도전 전에 항상 보여주는 「역사 9
   * 운명의 순간」 카드. 세션이 "10개 편지" 조기 종료 경로로 끝나면 이
   * 카드가 플레이 중 한 번도 실제로 공개되지 않았을 수 있어(050의 "held
   * 8 + 최다" 조건과는 별개 트리거), archiveHistory에 없으면 표시용으로
   * 새로 만든다 (see engine/session.ts's seedArchiveCard). */
  introCard: ArchiveCardState | null;
}

/** 세션/기록을 컴포넌트가 마운트되는 시점 딱 한 번만 읽어 시퀀스 구성을
 * 확정한다 -- 이 화면은 세션 종료마다 한 번 마운트-언마운트되는 1회성
 * 화면이라 재계산할 필요가 없다. */
function computeSetup(session: SessionState, humanId: string): EndingSetup | null {
  const identityFace = session.playerIdentityFaces[humanId];
  if (!identityFace) return null;
  const slot = session.playerEndings?.[humanId] ?? null;
  const resolved = resolveEndingForPlayer(identityFace.name, slot);
  let deck: TrueEndingCard[] | null = null;
  let introCard: ArchiveCardState | null = null;
  if (resolved.trueEndingEligible && slot) {
    const history = trueEndingHistoryFor(loadRecords(), slot);
    const successCount = trueEndingSuccessCardCount(
      session.roundNumber,
      history.hasSeenTrueEndingBefore,
      history.hasSeenNormalEndingOnlyBefore
    );
    deck = shuffleTrueEndingDeck(successCount);
    introCard = session.archiveHistory["051"] ?? seedArchiveCard("051");
  }
  return { identityName: identityFace.name, slot, resolved, deck, introCard };
}

type Step = "intro" | "draw" | "trueScene" | "failLine" | "resultScene";

/** 「역사 9 운명의 순간」(8번 캐릭터와 맺어진 경우의 성공/실패 카드 뽑기)과
 * 그 결과에 따른 비주얼노벨풍 엔딩 컷신을 이어서 재생하는 오케스트레이터.
 * 사람 플레이어(humanId) 전용 -- AI 상대의 엔딩은 SessionEndScreen의 요약
 * 텍스트로만 보여준다 (스토리북을 펼쳐 자기 엔딩을 확인한다는 원작 콘셉트
 * 자체가 플레이어 개인의 것이라, 여럿에게 같은 연출을 반복할 이유가 없다). */
export function EndingSequence({ session, humanId, onComplete }: EndingSequenceProps) {
  const [setup] = useState(() => computeSetup(session, humanId));
  const [step, setStep] = useState<Step>(setup?.deck ? "intro" : "resultScene");

  useEffect(() => {
    // 032(정체)를 한 번도 못 받아본 채 세션이 끝난 경우엔 재생할 엔딩
    // 텍스트가 아예 없다 -- 곧바로 완료 처리하고 기존 SessionEndScreen
    // 요약으로 넘어간다.
    if (!setup) onComplete(null, null, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!setup) return null;
  const { identityName, slot, resolved, deck, introCard } = setup;
  const displayTitle = slot ? slotDisplayName(slot) : "이루어진 상대가 없음";

  if (step === "intro" && introCard) {
    return (
      <StoryEventModal
        cards={[introCard]}
        clockTokens={session.clockTokens}
        onNext={() => setStep("draw")}
      />
    );
  }

  if (step === "draw" && deck) {
    return (
      <TrueEndingDraw
        deck={deck}
        onResolved={(result) => setStep(result === "성공" ? "trueScene" : "failLine")}
      />
    );
  }

  if (step === "trueScene") {
    return (
      <EndingScene
        title={`${displayTitle} · 진엔딩`}
        imageSrc={ENDING_IMAGES[trueEndingImageKey(identityGenderOf(identityName))]}
        text={TRUE_ENDING_TEXT}
        onDone={() => onComplete(identityName, slot, true)}
      />
    );
  }

  if (step === "failLine") {
    return <TrueEndingFailModal text={TRUE_ENDING_FAIL_TEXT} onNext={() => setStep("resultScene")} />;
  }

  const imageKey =
    resolved.kind === "noMatch"
      ? noMatchEndingImageKey(identityName)
      : resolved.kind === "sameSex"
        ? sameSexEndingImageKey(identityName)
        : characterEndingImageKey(identityName, slot as CharacterSlotId);

  return (
    <EndingScene
      title={displayTitle}
      imageSrc={ENDING_IMAGES[imageKey]}
      text={resolved.text}
      onDone={() => onComplete(identityName, slot, false)}
      doneLabel="결과 보기"
    />
  );
}
