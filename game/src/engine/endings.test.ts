import { describe, expect, it } from "vitest";
import {
  resolveEndingForPlayer,
  trueEndingSuccessCardCount,
  shuffleTrueEndingDeck,
  identityGenderOf,
  trueEndingIdentityGenderForSlot,
  TRUE_ENDING_DECK_SIZE,
} from "./endings";
import { CHARACTER_ENDINGS, NO_MATCH_ENDINGS, SAME_SEX_ENDINGS } from "../data/endings";
import { ALL_SLOTS, RANK8_SLOTS } from "./session";
import type { CharacterSlotId } from "./types";

const MALE_IDENTITIES = ["농부", "사냥꾼", "견습기사", "학생", "여행자", "남작"];
const FEMALE_IDENTITIES = ["양치기", "약초꾼", "호위", "여학생", "순례자", "여자작"];
const ALL_IDENTITIES = [...MALE_IDENTITIES, ...FEMALE_IDENTITIES];

describe("엔딩 데이터 완전성 (data/endings.ts)", () => {
  it("모든 정체가 없음/동성 텍스트를 갖고 있다", () => {
    for (const identity of ALL_IDENTITIES) {
      expect(NO_MATCH_ENDINGS[identity], `${identity} 없음 텍스트`).toBeTruthy();
      expect(SAME_SEX_ENDINGS[identity], `${identity} 동성 텍스트`).toBeTruthy();
    }
  });

  it("모든 (정체, 상대 슬롯) 조합에 대해 resolveEndingForPlayer가 빈 텍스트를 내지 않는다", () => {
    for (const identity of ALL_IDENTITIES) {
      for (const slot of ALL_SLOTS) {
        const resolved = resolveEndingForPlayer(identity, slot);
        expect(resolved.text, `${identity} x ${slot} (${resolved.kind})`).not.toBe("");
      }
      expect(resolveEndingForPlayer(identity, null).text).not.toBe("");
    }
  });

  it("남성향 정체는 남성향 슬롯과 매칭되면 동성 엔딩, 여성향 슬롯과 매칭되면 캐릭터 엔딩을 낸다", () => {
    const farmer = resolveEndingForPlayer("농부", "잉그리드공주");
    expect(farmer.kind).toBe("character");
    expect(farmer.text).toBe(CHARACTER_ENDINGS["농부"]!["잉그리드공주"]);

    const farmerMismatch = resolveEndingForPlayer("농부", "아레스왕자");
    expect(farmerMismatch.kind).toBe("sameSex");
    expect(farmerMismatch.text).toBe(SAME_SEX_ENDINGS["농부"]);
  });

  it("여성향 정체는 반대로 동작한다", () => {
    const shepherd = resolveEndingForPlayer("양치기", "아레스왕자");
    expect(shepherd.kind).toBe("character");

    const shepherdMismatch = resolveEndingForPlayer("양치기", "잉그리드공주");
    expect(shepherdMismatch.kind).toBe("sameSex");
  });

  it("null 슬롯(맺어진 상대 없음)은 항상 noMatch", () => {
    const resolved = resolveEndingForPlayer("농부", null);
    expect(resolved.kind).toBe("noMatch");
    expect(resolved.trueEndingEligible).toBe(false);
  });

  it("8번 캐릭터(RANK8_SLOTS)와 정상 매칭된 경우에만 진엔딩 도전 자격이 있다", () => {
    for (const slot of RANK8_SLOTS) {
      const identity = ["잉그리드공주", "루나공주", "마가렛공주"].includes(slot) ? "농부" : "양치기";
      const resolved = resolveEndingForPlayer(identity, slot as CharacterSlotId);
      expect(resolved.kind, slot).toBe("character");
      expect(resolved.trueEndingEligible, slot).toBe(true);
    }
    // 8번이 아닌 캐릭터는 정상 매칭이어도 도전 자격이 없다.
    expect(resolveEndingForPlayer("농부", "시녀메이블").trueEndingEligible).toBe(false);
  });
});

describe("진엔딩 CG의 남/여 정체 분기", () => {
  it("정체 이름으로 남캐/여캐를 정확히 구분한다", () => {
    for (const identity of MALE_IDENTITIES) expect(identityGenderOf(identity)).toBe("male");
    for (const identity of FEMALE_IDENTITIES) expect(identityGenderOf(identity)).toBe("female");
  });

  it("8번 캐릭터 슬롯별로 진엔딩에 도달하는 정체의 성별이 고정돼 있다", () => {
    for (const slot of RANK8_SLOTS) {
      const gender = trueEndingIdentityGenderForSlot(slot as CharacterSlotId);
      const identity = gender === "male" ? "농부" : "양치기";
      // 이 슬롯에 그 성별의 정체를 매칭하면 실제로 "character"(정상 매칭)
      // 이어야 한다 -- 슬롯별 진엔딩 CG를 고를 때 이 함수 하나로 정체
      // 이름 없이도 올바른 성별을 알 수 있다는 것을 보증한다.
      expect(resolveEndingForPlayer(identity, slot as CharacterSlotId).kind).toBe("character");
      // 반대 성별 정체를 매칭하면 동성(진엔딩 대상 아님)이어야 한다.
      const oppositeIdentity = gender === "male" ? "양치기" : "농부";
      expect(resolveEndingForPlayer(oppositeIdentity, slot as CharacterSlotId).kind).toBe("sameSex");
    }
  });
});

describe("진엔딩 성공 카드 개수 공식", () => {
  it("빠른 라운드일수록 성공 카드가 많다", () => {
    expect(trueEndingSuccessCardCount(2, false, false)).toBe(4);
    expect(trueEndingSuccessCardCount(4, false, false)).toBe(3);
    expect(trueEndingSuccessCardCount(6, false, false)).toBe(2);
    expect(trueEndingSuccessCardCount(8, false, false)).toBe(1);
  });

  it("이미 진엔딩을 본 적 있으면 속도와 무관하게 1개로 제한된다", () => {
    expect(trueEndingSuccessCardCount(2, true, false)).toBe(1);
    expect(trueEndingSuccessCardCount(2, true, true)).toBe(1);
  });

  it("진엔딩은 못 봤지만 일반엔딩만 본 적 있으면 +2 (최대 4개로 clamp)", () => {
    expect(trueEndingSuccessCardCount(8, false, true)).toBe(3);
    expect(trueEndingSuccessCardCount(2, false, true)).toBe(4); // 4+2=6 -> clamp 4
  });

  it("결과는 항상 1~4 사이 (5장 중 최소 1장은 실패 카드)", () => {
    for (let round = 1; round <= 12; round++) {
      for (const seenTrue of [true, false]) {
        for (const seenNormal of [true, false]) {
          const count = trueEndingSuccessCardCount(round, seenTrue, seenNormal);
          expect(count).toBeGreaterThanOrEqual(1);
          expect(count).toBeLessThanOrEqual(4);
        }
      }
    }
  });
});

describe("성공/실패 카드 셔플", () => {
  it("항상 5장이고 성공 카드 개수가 정확하다", () => {
    for (let successCount = 0; successCount <= 5; successCount++) {
      const deck = shuffleTrueEndingDeck(successCount);
      expect(deck).toHaveLength(TRUE_ENDING_DECK_SIZE);
      expect(deck.filter((c) => c === "성공")).toHaveLength(successCount);
      expect(deck.filter((c) => c === "실패")).toHaveLength(TRUE_ENDING_DECK_SIZE - successCount);
    }
  });
});
