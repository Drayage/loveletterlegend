import guard from "../assets/cards/guard.jpg";
import clown from "../assets/cards/clown.jpg";
import knight from "../assets/cards/knight.jpg";
import priestess from "../assets/cards/priestess.jpg";
import wizard from "../assets/cards/wizard.jpg";
import general from "../assets/cards/general.jpg";
import minister from "../assets/cards/minister.jpg";
import princess from "../assets/cards/princess.jpg";
import king from "../assets/cards/extra/X. 왕.jpg";
import recruit from "../assets/cards/extra/1. 신병.jpg";
import clownApprentice from "../assets/cards/extra/2. 광대의 제자(남).jpg";
import fortuneTeller from "../assets/cards/extra/2. 점술사.jpg";
import maskedKnight from "../assets/cards/extra/3. 복면기사.jpg";
import merchant from "../assets/cards/extra/3. 상인.jpg";
import friar from "../assets/cards/extra/4. 수사.jpg";
import nun from "../assets/cards/extra/4. 수녀.jpg";
import ladyGeneral from "../assets/cards/extra/6. 여장군.jpg";
import tactician from "../assets/cards/extra/6. 군사.jpg";
import regentMale from "../assets/cards/extra/7. 정무관(남자).jpg";
import regentFemale from "../assets/cards/extra/7. 정무관(여자).jpg";
import marchioness from "../assets/cards/extra/7. 여후작.jpg";
import type { CardName } from "../engine/types";

// Custom illustrations (replacing the earlier PDF-cropped art) provided by
// the user; resized/compressed for the web bundle but otherwise unedited.
export const CARD_ART: Record<CardName, string> = {
  경비병: guard,
  광대: clown,
  기사: knight,
  승려: priestess,
  마술사: wizard,
  장군: general,
  대신: minister,
  공주: princess,
  왕: king,
  신병: recruit,
  광대의제자: clownApprentice,
  점술사: fortuneTeller,
  복면기사: maskedKnight,
  상인: merchant,
  수사: friar,
  수녀: nun,
  여장군: ladyGeneral,
  군사: tactician,
  정무관남: regentMale,
  정무관여: regentFemale,
  여후작: marchioness,
};
