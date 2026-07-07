import farmer from "../assets/cards/extra/정체. 농부.jpg";
import shepherd from "../assets/cards/extra/정체. 양치기.jpg";
import hunter from "../assets/cards/extra/정체. 사냥꾼.jpg";
import herbalist from "../assets/cards/extra/정체. 약초꾼.jpg";
import squire from "../assets/cards/extra/정체. 견습기사.jpg";
import guard from "../assets/cards/extra/정체. 호위.jpg";
import student from "../assets/cards/extra/정체. 학생.jpg";
import schoolgirl from "../assets/cards/extra/정체. 여학생.jpg";
import traveler from "../assets/cards/extra/정체. 여행자.jpg";
import pilgrim from "../assets/cards/extra/정체. 순례자.jpg";
import baron from "../assets/cards/extra/정체. 남작.jpg";
import baroness from "../assets/cards/extra/정체. 여자작.jpg";

export type IdentityVariantId = "male" | "female";

export interface IdentityVariant {
  id: IdentityVariantId;
  name: string;
  art: string;
}

export const IDENTITY_VARIANTS: Record<string, [IdentityVariant, IdentityVariant]> = {
  "033": [
    { id: "male", name: "농부", art: farmer },
    { id: "female", name: "양치기", art: shepherd },
  ],
  "034": [
    { id: "male", name: "사냥꾼", art: hunter },
    { id: "female", name: "약초꾼", art: herbalist },
  ],
  "035": [
    { id: "male", name: "견습기사", art: squire },
    { id: "female", name: "호위", art: guard },
  ],
  "036": [
    { id: "male", name: "학생", art: student },
    { id: "female", name: "여학생", art: schoolgirl },
  ],
  "037": [
    { id: "male", name: "여행자", art: traveler },
    { id: "female", name: "순례자", art: pilgrim },
  ],
  "038": [
    { id: "male", name: "남작", art: baron },
    { id: "female", name: "여자작", art: baroness },
  ],
};
