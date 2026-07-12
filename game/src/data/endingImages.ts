// 엔딩 컷신용 이미지 -- 지금은 준비된 이미지가 하나도 없어 전부 비어
// 있다(EndingScene은 값이 undefined면 자동으로 플레이스홀더를 보여준다).
// 나중에 이미지 파일이 생기면: 위에서 import한 뒤 ENDING_IMAGES에 해당
// 키로 값만 채우면 즉시 반영된다 -- 다른 코드는 손댈 필요 없다.
//
// import farmerIngrid from "../assets/endings/농부-잉그리드공주.jpg";
// import trueEndingMale from "../assets/endings/진엔딩-남캐.jpg";
// export const ENDING_IMAGES: Partial<Record<EndingImageKey, string>> = {
//   [characterEndingImageKey("농부", "잉그리드공주")]: farmerIngrid,
//   [trueEndingImageKey("male")]: trueEndingMale,
// };
import type { CharacterSlotId } from "../engine/session";
import type { IdentityGender } from "../engine/endings";

export type EndingImageKey =
  | `character:${string}:${CharacterSlotId}`
  | `noMatch:${string}`
  | `sameSex:${string}`
  | `trueEnding:${IdentityGender}`;

export function characterEndingImageKey(identityName: string, slot: CharacterSlotId): EndingImageKey {
  return `character:${identityName}:${slot}`;
}

export function noMatchEndingImageKey(identityName: string): EndingImageKey {
  return `noMatch:${identityName}`;
}

export function sameSexEndingImageKey(identityName: string): EndingImageKey {
  return `sameSex:${identityName}`;
}

/** 진엔딩 CG는 텍스트와 달리 정체가 남캐인지 여캐인지에 따라 그림이
 * 다르다(같은 문구를 남/여 두 버전 삽화로). */
export function trueEndingImageKey(gender: IdentityGender): EndingImageKey {
  return `trueEnding:${gender}`;
}

export const ENDING_IMAGES: Partial<Record<EndingImageKey, string>> = {};
