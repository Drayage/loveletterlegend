import guard from "../assets/cards/guard.jpg";
import clown from "../assets/cards/clown.jpg";
import knight from "../assets/cards/knight.jpg";
import priestess from "../assets/cards/priestess.jpg";
import wizard from "../assets/cards/wizard.jpg";
import general from "../assets/cards/general.jpg";
import minister from "../assets/cards/minister.jpg";
import princess from "../assets/cards/princess.jpg";
import king from "../assets/cards/extra/X. 왕.jpg";
import prince from "../assets/cards/extra/8. 왕자.jpg";
import villageGirl from "../assets/cards/extra/0. 마을소녀.jpg";
import recruit from "../assets/cards/extra/1. 신병.jpg";
import servant from "../assets/cards/extra/1. 시종.jpg";
import maid from "../assets/cards/extra/1. 시녀.jpg";
import clownApprentice from "../assets/cards/extra/2. 광대의 제자(남).jpg";
import clownApprenticeFemale from "../assets/cards/extra/2. 광대의 제자(여).jpg";
import fortuneTeller from "../assets/cards/extra/2. 점술사.jpg";
import actor from "../assets/cards/extra/9. 배우.jpg";
import dancer from "../assets/cards/extra/0. 무희.jpg";
import maskedKnight from "../assets/cards/extra/3. 복면기사.jpg";
import ladyKnight from "../assets/cards/extra/3. 여기사.jpg";
import merchant from "../assets/cards/extra/3. 상인.jpg";
import friar from "../assets/cards/extra/4. 수사.jpg";
import nun from "../assets/cards/extra/4. 수녀.jpg";
import butler from "../assets/cards/extra/4. 집사.jpg";
import witch from "../assets/cards/extra/5. 마녀.jpg";
import archmage15 from "../assets/cards/extra/5. 대마도사(15세).jpg";
import mouse from "../assets/cards/extra/0. 쥐.jpg";
import archmage20 from "../assets/cards/extra/5. 대마도사(20세).jpg";
import ladyGeneral from "../assets/cards/extra/6. 여장군.jpg";
import tactician from "../assets/cards/extra/6. 군사.jpg";
import regentMale from "../assets/cards/extra/7. 정무관(남자).jpg";
import regentFemale from "../assets/cards/extra/7. 정무관(여자).jpg";
import marchioness from "../assets/cards/extra/7. 여후작.jpg";
import wizardApprenticeCard from "../assets/cards/extra/5. 마술사의 도제.jpg";
import princessSecond from "../assets/cards/extra/8. 공주(둘째).jpg";
import princessThird from "../assets/cards/extra/8. 공주(셋째).jpg";
import countess from "../assets/cards/extra/8. 백작부인.jpg";
import nobleLady from "../assets/cards/extra/8. 귀족영애.jpg";
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
  왕자: prince,
  왕: king,
  마을소녀: villageGirl,
  신병: recruit,
  시종: servant,
  시녀: maid,
  광대의제자: clownApprentice,
  광대의제자여: clownApprenticeFemale,
  점술사: fortuneTeller,
  배우: actor,
  무희: dancer,
  복면기사: maskedKnight,
  여기사: ladyKnight,
  상인: merchant,
  수사: friar,
  수녀: nun,
  집사: butler,
  마녀: witch,
  대마도사15: archmage15,
  쥐: mouse,
  대마도사20: archmage20,
  여장군: ladyGeneral,
  군사: tactician,
  정무관남: regentMale,
  정무관여: regentFemale,
  여후작: marchioness,
  마술사의도제: wizardApprenticeCard,
  공주둘째: princessSecond,
  공주셋째: princessThird,
  백작부인: countess,
  귀족영애: nobleLady,
};
