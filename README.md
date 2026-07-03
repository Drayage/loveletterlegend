# loveletterlegend

러브레터 스타일 카드게임 "LLS"의 카드 시트 PDF를 나중에 HTML 게임을 만들 때 참고할
간단한 JSON 카드 데이터베이스로 변환하는 도구입니다.

## 구성

```
pdfs/                    원본 카드 시트 PDF, 룰북 PDF
scripts/pdf_to_db.py     PDF -> data/cards.json 변환 스크립트
scripts/requirements.txt Python 의존성
scripts/SETUP.md         설치 및 실행 방법
data/cards.json          변환 결과 (카드 데이터베이스)
```

## 사용법

자세한 설치 방법은 [scripts/SETUP.md](scripts/SETUP.md)를 참고하세요.

```bash
sudo apt-get install -y tesseract-ocr tesseract-ocr-kor
pip install -r scripts/requirements.txt
python scripts/pdf_to_db.py pdfs/LLS_cards_part_1.pdf -o data/cards.json
```

## 카드 시트 PDF에 대해

이 PDF는 텍스트 레이어가 없는 완전히 래스터화(이미지화)된 인쇄용 시트입니다.
그래서 스크립트는 각 페이지를 이미지로 렌더링하고, 카드 9장(3열 x 3행) 단위로
잘라 OCR(Tesseract, 한국어)로 텍스트를 읽습니다.

카드 종류(게임/시나리오/캐릭터)와 카드 안의 아이콘·태그 체계는 공식 룰북
(`pdfs/LLS_Rules415.pdf`)을 기준으로 정의했습니다.

## data/cards.json 형식

```json
{
  "cards": [
    {
      "id": "001",
      "category": "게임",
      "subtype": null,
      "rank": 1,
      "name": "경비병",
      "ability": "다른 플레이어를 지목한 뒤...",
      "trigger": "play",
      "count": 5,
      "needs_review": false,
      "raw_ocr_text": "...",
      "source_file": "LLS_cards_part_1.pdf",
      "source_page": 1
    },
    {
      "id": "017",
      "category": "시나리오",
      "subtype": null,
      "name": "시간",
      "effects": [{ "tag": "시작", "text": "..." }],
      "needs_review": false,
      "raw_ocr_text": "...",
      "source_file": "LLS_cards_part_1.pdf",
      "source_page": 2
    }
  ],
  "by_category": { "게임": ["001", "..."], "시나리오": ["..."], "캐릭터": ["..."] }
}
```

카드 id는 시트 상의 위치(페이지당 9장, 왼쪽→오른쪽·위→아래 순서)로 계산합니다.
인쇄된 번호 자체를 OCR하는 것보다 이 방식이 훨씬 안정적이었습니다. 단, "게임 : 정체"
모듈처럼 카드 한 쌍(남/여 버전)이 번호를 공유하는 경우는 정확히 구분되지 않을 수 있습니다.

## 알려진 한계 (중요 — 결과물은 검수가 필요한 초안입니다)

- **OCR은 완벽하지 않습니다.** 특히 카드 하단의 `카테고리` 라벨(게임/시나리오/캐릭터)이나
  일부 카드의 명칭은 장식체 폰트 때문에 인식되지 않을 수 있습니다.
- `needs_review: true`로 표시된 카드는 이름/카테고리/효과 중 하나 이상을 제대로
  읽지 못한 경우입니다. `raw_ocr_text` 필드에 원본 OCR 결과가 남아 있으니, 원본
  PDF와 대조해 수동으로 보정하세요.
- 시나리오/캐릭터 카드의 효과는 태그(등장/시작/도중/중요/지속/종료) 중 `S`(시작),
  `E`(종료), `!`(중요)만 텍스트로 인식 가능합니다. 나머지 태그(⚡ 등장, 📖 도중,
  🔄 지속)는 순수 그래픽 아이콘이라 OCR로 잡히지 않으므로 `tag: null`로 남고
  본문 텍스트만 보존됩니다.
- 카드 효과 안의 토큰 아이콘(편지 ✉ / 시계 🕐 / 성공 / 실패 💧)도 그래픽이라
  텍스트로 변환되지 않고 원본 OCR 텍스트에서 누락될 수 있습니다.
- `pdfs/LLS_cards_part_2.pdf`, `pdfs/LLS_cards_part_3.pdf`가 준비되면 같은 방식으로
  실행해 `data/cards.json`에 이어서 합칠 수 있습니다 (스크립트에 파일을 여러 개
  나열하면 됩니다).
