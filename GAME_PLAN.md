# Love Letter Legend — 게임 개발 계획

`data/cards.json`(203장, 검수 완료)을 기반으로 웹 게임을 만드는 계획입니다.
싱글플레이(vs AI) + 온라인 멀티플레이(Firebase), GitHub Pages 배포.

## 게임 구조 요약

- **라운드 진행**: 표준 러브레터 규칙(카드 1장 뽑고 1장 내고 효과 처리, 낮은 숫자 탈락/숫자 비교). "게임" 카테고리 카드(74장: 기본 16 + 정체 6 + 축제 8 + 기타)가 여기 쓰임.
- **8라운드 = 1게임**: 라운드 종료마다 "이야기 보관소"의 시나리오 카드 종료 효과가 발동 → 카드 공개/제거/문구 변경.
- **진행 트리거**: 시계 토큰 누적 → "역사 N" 시나리오 공개. 편지 토큰 누적 → 캐릭터와의 호감도, 8라운드 뒤 스토리북 엔딩 판정.
- **카드 상호 참조**: 203장 중 73장(36%)이 다른 카드 id를 직접 참조(`[024] 공개`, 카드 제거 등), 20장은 조건부로 **카드 자신의 문구가 바뀜**. 즉 정적 텍스트가 아니라 서로 연결된 상태 머신 — 범용 액션 인터프리터가 필요한 이유.

## 확정된 결정사항

| 항목 | 결정 |
|---|---|
| 프론트엔드 | Vite + React + TypeScript |
| 온라인 동기화 | Firebase (Firestore + Auth 익명 로그인) |
| 배포 | GitHub Actions → GitHub Pages |
| 초기 플레이어 수 | 2인 (나 vs AI 1명), 이후 확장 |
| 초기 개발 범위(v1) | 로드맵 1~2단계: 기본 러브레터 + 캐릭터/호감도 |
| AI | 딥러닝 없이 휴리스틱(공개 정보 기반 확률 추정 + 기대값) |
| 멀티플레이 신뢰모델 | 클라이언트 신뢰 기반 (서버 권위 검증은 추후 확장 지점으로 남김) |

## 프로젝트 구조 (신규)

```
game/                      # Vite + React 앱 (신규 디렉토리)
  src/
    engine/                # 규칙 엔진 (프레임워크 무관, 순수 로직 — 테스트 용이)
      types.ts             # Card, GameState, Action, Player 타입
      actions.ts           # 액션 인터프리터: reveal/remove/addToken/rewriteText/...
      rules.ts             # 라운드 진행, 승패 판정, 탈락 처리
      ai.ts                # AI 봇 로직
    data/
      cards.ts             # data/cards.json을 게임 엔진용 스키마로 변환한 결과 (빌드 시 생성 또는 수동 큐레이션)
    ui/                     # React 컴포넌트 (카드, 손패, 버림더미, 이야기 보관소, 스토리북)
    firebase/               # Firestore 방/세션 연동 (2단계 이후)
    App.tsx
  package.json
  vite.config.ts
.github/workflows/deploy.yml   # GH Pages 자동 배포
```

기존 `data/cards.json`(OCR+수동 검수 결과)은 **원본 참고 자료로 유지**하고, 게임 엔진이 실제로 소비하는 데이터는 `game/src/data/cards.ts`에 별도로 둡니다 — `cards.json`의 자연어 효과 텍스트를 구조화된 액션으로 변환하는 작업이 필요하기 때문입니다 (아래 참고).

## 핵심 설계: 카드 효과를 데이터로 표현하기

`cards.json`의 `ability`/`effects[].text`는 사람이 읽는 자연어입니다. 이걸 그대로 코드에서 파싱하지 않고, 소수의 액션 타입으로 구조화합니다. 예:

```ts
type Action =
  | { type: "revealCards"; ids: string[] }
  | { type: "removeCard"; id: string }
  | { type: "addCardToDeck"; id: string }
  | { type: "addToken"; token: "letter" | "clock" | "success" | "fail"; target: "self" | "card"; targetId?: string; amount: number }
  | { type: "rewriteCardText"; id: string; newAbility: string }
  | { type: "eliminatePlayer"; player: "self" | "other" }
  | { type: "compareHands" }
  | { type: "swapHands" }
  // ... 러브레터 기본 카드 효과들

type EffectCondition =
  | { type: "tokenCount"; token: string; target: string; op: ">="; value: number }
  | { type: "handCard"; rank: number }
  | { type: "always" }

interface CardEffect {
  tag: "등장" | "시작" | "도중" | "중요" | "지속" | "종료" | null;
  condition?: EffectCondition;
  actions: Action[];
}
```

`cards.json`의 65장 시나리오 + 64장 캐릭터 카드 효과를 이 형태로 옮기는 게 실제 콘텐츠 작업의 핵심입니다 — **코드가 아니라 데이터 입력 작업**이라 시간이 걸립니다. 그래서 로드맵을 아래처럼 나눠서, 필요한 카드부터 순서대로 구조화합니다 (전체 203장을 한 번에 다 하지 않음).

## 로드맵

### Phase 1 — 코어 엔진 + 기본 16장 (MVP) ✅ 완료
- 표준 러브레터 규칙 엔진: 덱 셔플/드로우, 손패 2장 중 1장 플레이, 각 기본 카드(경비병~공주) 효과 구현, 탈락/라운드 종료/승자 판정. (`game/src/engine/rules.ts`, `effects.ts`)
- 2인용(나 vs AI) 로컬 플레이 완성 (`game/src/App.tsx`).
- **AI 로직**: 공개 정보(버림 더미, 공개 제거 카드) 기반 카드 확률 추정 + 카드별 기대값 휴리스틱으로 낼 카드/대상/추측 결정. (`game/src/engine/ai.ts`)
- UI: 손패, 덱/버림 더미, 공개 제거 카드, 대상·추측 선택 프롬프트, 진행 로그, 승패 화면.
- **검증 완료**: 엔진 유닛 테스트 7개 통과(100회 AI vs AI 랜덤 플레이 포함), Playwright로 실제 브라우저에서 사람 vs AI 라운드를 끝까지 플레이해 마술사/경비병/대신 효과와 라운드 종료 판정이 정상 동작함을 확인. `npm run build` 정상 동작(GitHub Pages 배포 가능).
- **아직 안 한 것**: 기사/장군/승려/공주 효과는 코드는 있으나 이번 수동 테스트에서 직접 유도해보진 않음(유닛 테스트의 100회 랜덤 플레이로 간접 커버). GitHub Pages는 `.github/workflows/deploy.yml`을 추가했지만 `main` 브랜치 push 기준이라 이 작업 브랜치에서는 아직 배포되지 않음 — 저장소 Settings → Pages에서 Source를 "GitHub Actions"로 설정하는 1회성 수동 작업도 필요.

### Phase 2 — 캐릭터/호감도 레이어 (합의된 v1 목표)
- 8라운드 게임 루프, "이야기 보관소" 개념 도입.
- 캐릭터 카드(64장) 중 **기본 시작 캐릭터들만** 우선 구조화 (예: 잉그리드 공주/아레스 왕자 — 이미 원문 확인 완료, id 018~022).
- 편지 토큰 누적 로직 + 8라운드 종료 후 "가장 편지 토큰이 많은 캐릭터" 엔딩 판정 (스토리북 텍스트는 이후 단계에서 채움, 우선 "OO 루트 엔딩" 정도로 표시).
- 최소한의 시나리오 카드(017 "시간" 등 진행 트리거만) 연결 — 전체 65장 시나리오를 다 넣지 않고, 캐릭터 언락에 필요한 최소 경로만.
- **완료 기준**: 8라운드를 끝까지 플레이해서 엔딩(캐릭터 루트)까지 도달 가능.

### Phase 3 — 스토리 본편 확장 (v1 이후)
- 시나리오/캐릭터 나머지 카드를 액션 데이터로 순차 변환, 역사 N 챕터 전체 연결.

### Phase 4 — 확장 모듈
- 정체(성별 변형 역할)/축제(라운드 변형 규칙)/공주왕자(대체 주인공) 모듈을 온오프 가능한 규칙으로 추가.

### Phase 5 — Firebase 온라인 멀티플레이
- Firebase 프로젝트 생성, 익명 Auth.
- Firestore에 `rooms/{roomId}` 문서: 참가자, 현재 상태(덱 순서는 방장 클라이언트가 셔플해 시드만 공유하거나 전체 순서를 문서에 저장), 턴 순서.
- 각 클라이언트가 자기 턴에 액션을 계산해 Firestore에 diff 반영, 나머지 클라이언트는 `onSnapshot`으로 구독.
- 재접속/방 나가기 처리, 간단한 로비 UI(방 생성/입장 코드).

### Phase 6 — 배포/마무리
- `.github/workflows/deploy.yml`: push 시 `npm run build` → `gh-pages` 브랜치 배포.
- Firebase 설정 키는 공개 리포지토리에서도 안전한 값(클라이언트 API 키는 공개돼도 되지만 Firestore 보안 규칙으로 접근 제어)이므로 `.env` 대신 빌드에 포함해도 무방 — 단 보안 규칙 설정은 필수로 짚고 넘어감.

## 검증 방법
- Phase 1: 유닛 테스트(엔진 로직, Vitest)로 각 기본 카드 효과를 검증하고, 브라우저에서 실제로 AI와 한 판 플레이.
- Phase 2: 8라운드 풀 플레이 스모크 테스트, 엔딩 판정 로직 케이스 테스트.
- Phase 5: 두 브라우저 탭(또는 두 기기)으로 같은 방에 접속해 턴 동기화 확인.

## 다음 액션
이 계획대로라면 **바로 다음 할 일은 Phase 1**: `game/` 디렉토리에 Vite+React+TS 프로젝트를 새로 만들고, 러브레터 코어 엔진 + 기본 16장 + AI를 구현하는 것입니다. 승인하시면 바로 시작하겠습니다.
