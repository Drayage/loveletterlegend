import guard from "../assets/cards/guard.jpg";
import clown from "../assets/cards/clown.jpg";
import knight from "../assets/cards/knight.jpg";
import priestess from "../assets/cards/priestess.jpg";
import wizard from "../assets/cards/wizard.jpg";
import general from "../assets/cards/general.jpg";
import minister from "../assets/cards/minister.jpg";
import princess from "../assets/cards/princess.jpg";
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
};
