# 설치 안내

이 스크립트는 카드 시트 PDF를 이미지로 변환한 뒤 OCR로 텍스트를 읽습니다.
Python 패키지 외에 시스템에 Tesseract OCR(한국어 언어팩 포함)이 설치되어 있어야 합니다.

## 시스템 패키지 (Ubuntu/Debian)

```bash
sudo apt-get update
sudo apt-get install -y tesseract-ocr tesseract-ocr-kor
```

## Python 패키지

```bash
pip install -r scripts/requirements.txt
```

## 실행

```bash
python scripts/pdf_to_db.py pdfs/LLS_cards_part_1.pdf -o data/cards.json
```

여러 파트를 한 번에 합치려면 파일을 순서대로 나열합니다.

```bash
python scripts/pdf_to_db.py pdfs/LLS_cards_part_1.pdf pdfs/LLS_cards_part_2.pdf pdfs/LLS_cards_part_3.pdf -o data/cards.json
```
