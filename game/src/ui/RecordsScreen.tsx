import { useState } from "react";
import { RANK8_SLOTS } from "../engine/session";
import type { CharacterSlotId } from "../engine/session";
import { loadRecords, endingRecordKey, parseEndingRecordKey, type GameRecords } from "../persistence/records";
import { ALL_IDENTITY_NAMES, resolveEndingForPlayer, targetSlotsForIdentity } from "../engine/endings";
import { TRUE_ENDING_TEXT, SAME_SEX_ENDINGS } from "../data/endings";
import {
  ENDING_IMAGES,
  characterEndingImageKey,
  noMatchEndingImageKey,
  sameSexEndingImageKey,
} from "../data/endingImages";
import { SLOT_INFO } from "./slotInfo";
import { EndingScene } from "./EndingScene";
import "./RecordsScreen.css";

interface RecordsScreenProps {
  onBack: () => void;
}

interface ReplayPayload {
  title: string;
  text: string;
  imageSrc?: string;
}

interface IdentityAchievements {
  slots: Set<CharacterSlotId>;
  noMatchCount: number;
  sameSexCount: number;
}

/** endingsAchieved의 평평한 (정체|슬롯) 키 맵을, resolveEndingForPlayer로
 * 다시 판정해 정체별 "달성한 종류"로 정리한다 -- 여러 슬롯이 전부 같은
 * "동성" 텍스트로 이어질 수 있어(정체의 기본 상대 그룹과 반대되는 슬롯은
 * 전부 동일 텍스트), 그런 경우들은 하나로 합쳐서 보여준다. */
function summarizeAchievements(records: GameRecords): Record<string, IdentityAchievements> {
  const result: Record<string, IdentityAchievements> = {};
  for (const name of ALL_IDENTITY_NAMES) result[name] = { slots: new Set(), noMatchCount: 0, sameSexCount: 0 };
  for (const [key, count] of Object.entries(records.endingsAchieved)) {
    if (!count || count <= 0) continue;
    const { identityName, slot } = parseEndingRecordKey(key);
    const bucket = result[identityName];
    if (!bucket) continue;
    const resolved = resolveEndingForPlayer(identityName, slot);
    if (resolved.kind === "noMatch") bucket.noMatchCount += count;
    else if (resolved.kind === "sameSex") bucket.sameSexCount += count;
    else if (slot) bucket.slots.add(slot);
  }
  return result;
}

/** "기록보관실" -- 지금까지 재생해 본 엔딩을 다시 볼 수 있는 갤러리.
 * 진엔딩은 정체와 무관하게 텍스트가 공용이라 8번 캐릭터별로 한 번만
 * 모아 보여주고, 일반엔딩은 정체×맺어진 캐릭터 조합마다 텍스트가 달라
 * 정체별 섹션으로 나눠 보여준다 (see engine/endings.ts's
 * resolveEndingForPlayer). 달성한 칸을 누르면 그 엔딩을 다시 재생한다. */
export function RecordsScreen({ onBack }: RecordsScreenProps) {
  const records = loadRecords();
  const achievements = summarizeAchievements(records);
  const [replay, setReplay] = useState<ReplayPayload | null>(null);

  if (replay) {
    return <EndingScene title={replay.title} text={replay.text} imageSrc={replay.imageSrc} onDone={() => setReplay(null)} />;
  }

  function renderTrueEndingCard(slot: CharacterSlotId) {
    const info = SLOT_INFO[slot];
    const count = records.trueEndingsSeen[slot] ?? 0;
    const unlocked = count > 0;
    return (
      <button
        key={slot}
        type="button"
        className={`records-screen__card${unlocked ? " records-screen__card--unlocked" : ""}`}
        disabled={!unlocked}
        onClick={() =>
          setReplay({ title: `${info.name} · 진엔딩`, text: TRUE_ENDING_TEXT, imageSrc: ENDING_IMAGES.trueEnding })
        }
      >
        <div className="records-screen__portrait">
          {unlocked && info.art ? (
            <img src={info.art} alt={info.name} />
          ) : (
            <span className="records-screen__silhouette">?</span>
          )}
        </div>
        <span className="records-screen__name">{unlocked ? info.name : "???"}</span>
        {unlocked && <span className="records-screen__true-ending">★ {count}회</span>}
      </button>
    );
  }

  function renderCharacterCard(identityName: string, slot: CharacterSlotId) {
    const info = SLOT_INFO[slot];
    const count = records.endingsAchieved[endingRecordKey(identityName, slot)] ?? 0;
    const unlocked = count > 0;
    return (
      <button
        key={slot}
        type="button"
        className={`records-screen__card${unlocked ? " records-screen__card--unlocked" : ""}`}
        disabled={!unlocked}
        onClick={() =>
          setReplay({
            title: info.name,
            text: resolveEndingForPlayer(identityName, slot).text,
            imageSrc: ENDING_IMAGES[characterEndingImageKey(identityName, slot)],
          })
        }
      >
        <div className="records-screen__portrait">
          {unlocked && info.art ? (
            <img src={info.art} alt={info.name} />
          ) : (
            <span className="records-screen__silhouette">?</span>
          )}
        </div>
        <span className="records-screen__name">{unlocked ? info.name : "???"}</span>
        {unlocked && <span className="records-screen__count">{count}회</span>}
      </button>
    );
  }

  function renderSpecialCard(identityName: string, kind: "noMatch" | "sameSex", count: number) {
    const label = kind === "noMatch" ? "이루어진 상대 없음" : "동성";
    const unlocked = count > 0;
    return (
      <button
        key={kind}
        type="button"
        className={`records-screen__card${unlocked ? " records-screen__card--unlocked" : ""}`}
        disabled={!unlocked}
        onClick={() => {
          if (kind === "noMatch") {
            setReplay({
              title: label,
              text: resolveEndingForPlayer(identityName, null).text,
              imageSrc: ENDING_IMAGES[noMatchEndingImageKey(identityName)],
            });
            return;
          }
          setReplay({
            title: label,
            // 동성 엔딩은 어느 슬롯으로 도달했든 정체당 텍스트가 하나뿐이다.
            text: SAME_SEX_ENDINGS[identityName] ?? "",
            imageSrc: ENDING_IMAGES[sameSexEndingImageKey(identityName)],
          });
        }}
      >
        <div className="records-screen__portrait">
          <span className="records-screen__silhouette">{unlocked ? "♥" : "?"}</span>
        </div>
        <span className="records-screen__name">{unlocked ? label : "???"}</span>
        {unlocked && <span className="records-screen__count">{count}회</span>}
      </button>
    );
  }

  return (
    <div className="records-screen">
      <h1 className="records-screen__title">기록보관실</h1>
      <p className="records-screen__summary">
        지금까지 {records.sessionsPlayed}번 플레이했습니다.
        {records.lastPlayedAt && ` (최근: ${new Date(records.lastPlayedAt).toLocaleDateString()})`}
      </p>
      <p className="records-screen__note">
        달성한 칸을 누르면 그 엔딩을 다시 볼 수 있습니다. 진엔딩은 정체와 무관하게 8번 캐릭터별로 하나씩,
        일반엔딩은 그때 골랐던 정체마다 따로 모입니다.
      </p>

      <section className="records-screen__section">
        <p className="records-screen__section-title">진엔딩</p>
        <div className="records-screen__grid">{RANK8_SLOTS.map(renderTrueEndingCard)}</div>
      </section>

      {ALL_IDENTITY_NAMES.map((identityName) => {
        const targets = targetSlotsForIdentity(identityName);
        const bucket = achievements[identityName];
        const unlockedCount = bucket.slots.size + (bucket.noMatchCount > 0 ? 1 : 0) + (bucket.sameSexCount > 0 ? 1 : 0);
        const totalCount = targets.length + 2;
        return (
          <section className="records-screen__section" key={identityName}>
            <p className="records-screen__section-title">
              {identityName} <span className="records-screen__section-progress">{unlockedCount} / {totalCount}</span>
            </p>
            <div className="records-screen__grid">
              {targets.map((slot) => renderCharacterCard(identityName, slot))}
              {renderSpecialCard(identityName, "noMatch", bucket.noMatchCount)}
              {renderSpecialCard(identityName, "sameSex", bucket.sameSexCount)}
            </div>
          </section>
        );
      })}

      <button type="button" className="records-screen__back-btn" onClick={onBack}>
        뒤로
      </button>
    </div>
  );
}
