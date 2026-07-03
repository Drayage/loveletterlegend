# loveletterlegend

러브레터 스타일 카드게임 "LLS"의 카드 시트 PDF를 나중에 HTML 게임을 만들 때 참고할
간단한 JSON 카드 데이터베이스로 변환하는 도구입니다.

## 구성

```
pdfs/                    원본 카드 시트 PDF(part1~3), 룰북 PDF
scripts/pdf_to_db.py     PDF -> data/cards.json 변환 스크립트
scripts/requirements.txt Python 의존성
scripts/SETUP.md         설치 및 실행 방법
data/cards.json          변환 결과 (카드 데이터베이스, part1+2+3 전체 처리 완료: id 001~203)
tools/card-editor.html   카드 데이터베이스를 보면서 직접 수정·저장하는 편집기 (브라우저에서 열기만 하면 됨)
```

## 카드 편집기로 검수하기

OCR 결과에는 오류가 많아서(아래 "알려진 한계" 참고), `data/cards.json`을 직접 보면서 틀린 부분을
고치고 빠진 항목을 채워 넣을 수 있는 편집기를 만들어 뒀습니다. 서버 설치 없이 브라우저에서
`tools/card-editor.html` 파일을 더블클릭(또는 파일 탐색기에서 열기)하면 바로 사용할 수 있습니다.

1. `tools/card-editor.html`을 **Chrome/Edge**로 엽니다 (파일에 바로 저장하는 기능이 이 두
   브라우저에서만 지원됩니다. Firefox/Safari는 다운로드 방식으로 대체됩니다).
2. 상단 "cards.json 열기" 버튼으로 `data/cards.json`을 선택합니다.
3. 왼쪽 목록에서 카드를 고르면 오른쪽에 편집 화면이 나옵니다. 이름/카테고리/서브타입/능력·효과
   텍스트를 고치고, 맨 아래 "원본 OCR 텍스트"를 참고해 빠지거나 틀린 내용을 채워 넣으세요.
   화면 오른쪽 위 "검수 필요" 체크박스로 검수 완료 표시를 할 수 있습니다.
4. 왼쪽 위 필터(카테고리, "검수 필요만", 검색창)로 고칠 카드를 좁혀서 순서대로 처리하면 편합니다.
   `↑`/`↓`(또는 `j`/`k`) 키로 목록을 넘기고, `Ctrl/Cmd+S`로 저장할 수 있습니다.
5. 상단 "저장" 버튼을 누르면 **Chrome/Edge에서는 열었던 `data/cards.json` 파일에 바로 덮어씁니다**
   (다른 브라우저에서는 `cards.json`이 다운로드되니 기존 파일을 수동으로 교체하세요).

편집기는 순수 HTML/JS 파일이라 인터넷 연결이나 별도 서버 없이 로컬에서 그대로 동작합니다.

## 사용법

자세한 설치 방법은 [scripts/SETUP.md](scripts/SETUP.md)를 참고하세요.

```bash
sudo apt-get install -y tesseract-ocr tesseract-ocr-kor
pip install -r scripts/requirements.txt
python scripts/pdf_to_db.py pdfs/LLS_cards_part_1.pdf pdfs/LLS_cards_part_2.pdf pdfs/LLS_cards_part_3.pdf -o data/cards.json
```

**중요**: part 파일들은 항상 `part_1`부터 순서대로 함께 넘겨야 합니다 (`part_1 part_2 part_3` 순). id 계산과
페어링 보정(아래 참고)이 이 순서를 전제로 하드코딩되어 있어, part2/3만 단독으로 실행하면 id가 틀어집니다.

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
인쇄된 번호 자체를 OCR하는 것보다 이 방식이 훨씬 안정적이었습니다.

**"게임 : 정체" 모듈 카드는 번호를 공유합니다.** 예: 농부/양치기가 둘 다 033번, 사냥꾼/약초꾼이
둘 다 034번입니다(성별 변형이라 능력은 동일, 이름/그림만 다름 — 룰북에 "성별에 따른 효과의 차이는
없음"이라고 명시됨). 이 페어링은 순수 위치 기반 계산으로는 감지할 수 없어서, `LLS_cards_part_1.pdf`
4~5페이지를 직접 읽어 확인한 페어링을 `scripts/pdf_to_db.py`의 `ID_OVERRIDES`에 하드코딩하고,
그 이후 모든 카드 id에 상수 보정값(`ID_DRIFT_CORRECTION = 6`, `LLS_cards_part_2.pdf` 1페이지의
실제 인쇄 번호 058과 대조해 검증함)을 적용했습니다. 페어링된 카드는 이름을 `"농부 / 양치기"`
처럼 합쳐서 하나의 레코드로 저장합니다. **part2/3에 아직 확인하지 못한 추가 페어링이 있다면
그 지점부터 다시 id가 밀릴 수 있습니다** — 이름이 비정상적으로 겹치거나 `category`가
`게임 : 정체`류인 카드는 원본 PDF와 대조해보세요.

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
- **카드 하단 카테고리 라벨(게임/시나리오/캐릭터) 인식률이 특히 낮습니다** — 장식체 폰트를
  Tesseract가 잘 읽지 못해 `category: null`("미분류")로 남는 카드가 많습니다
  (현재 part1+part2 기준 약 70%). 이름/효과 텍스트는 있는데 카테고리만 없는 경우가 많으니,
  `raw_ocr_text`나 원본 PDF를 참고해 수동으로 채우는 걸 권장합니다.
- id 페어링 보정에 대해서는 위 "카드 id는..." 단락을 참고하세요.
- 진행 현황: part1+part2+part3 전체 처리 완료. id 001~203, 총 203장으로 룰북에 명시된
  카드 총수(203장)와 정확히 일치합니다 (id 누락/중복 없음, part3까지 추가 페어링 드리프트는
  발견되지 않음).
