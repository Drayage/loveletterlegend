# Love Letter Legend — 스토리 캠페인 카드게임

React + TypeScript + Vite. 소스는 `game/`, 빌드 산출물이 저장소 루트로 배포됨(GitHub Pages).

## 파일 지도 / 명령어

- `game/src/` — 소스. **루트의 index.html/assets/는 빌드 산출물 — 직접 수정 금지.**
- `game/`에서: `npm run dev` / `npm run build`(tsc + vite) / `npm run lint`(oxlint) / `npm test`(vitest)
- `data/cards.json` — 카드 데이터, `tools/card-editor.html` — 편집 툴
- `GAME_PLAN.md` — 기획 문서

## 규칙 (이 저장소 최다 반복 버그: 이벤트 플로우 교착)

스토리 이벤트 × AI 턴 × 라운드 전환이 얽히는 곳에서 교착 수정만 15커밋 이상 나왔다.
관련 코드를 만질 때:

- **단일 이벤트 큐 + 명시적 블로킹 상태** 원칙을 유지할 것. 즉흥적으로 개별 게이트를
  추가하지 말고 기존 큐/플로우 상태에 편입시킨다.
- 그 큐가 실제로 사는 곳은 `game/src/engine/flow.ts`의 `session.flowState`
  (`queue`/`kind`/`acks`)이며, 우선순위는 그 파일의 BUILD ORDER 한 곳에만 적혀 있다.
  AI 자동 진행은 `engine/flowDriver.ts`의 `runAIStep` 하나뿐이고, UI는 큐의 머리
  (`isFlowHead`)만 보고 렌더한다. 새 팝업/선택 단계는 큐에 이벤트 종류를 추가하는
  방식으로만 넣는다.
- 수정 전에 flow status 디버그 탭으로 현재 상태 전이를 확인하고, 수정 후
  "라운드 종료 → 스토리 이벤트 → 다음 라운드 시작" 전체 사이클을 실제로 돌려볼 것.
- AI 선택은 사용자의 pending 모달/라운드 결과 확인이 끝날 때까지 블로킹된다 —
  이 순서를 깨는 변경 금지.

## 검증

- 커밋 전: `game/`에서 `npm run lint && npm test`, 배포 반영 시 `npm run build`.
