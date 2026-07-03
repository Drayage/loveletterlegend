# Love Letter Legend — game

Phase 1: 기본 16장 카드로 플레이하는 러브레터 엔진 + AI 상대(2인).
자세한 로드맵은 저장소 루트의 `GAME_PLAN.md`를 참고하세요.

## 개발

```bash
npm install
npm run dev       # 로컬 개발 서버
npm test          # 엔진 유닛 테스트 (vitest)
npm run build     # 프로덕션 빌드 (GitHub Pages 배포용)
```

## 배포

`main` 브랜치의 `game/` 변경사항이 푸시되면 `.github/workflows/deploy.yml`이 자동으로
빌드해 GitHub Pages에 배포합니다. **처음 한 번은 저장소 Settings → Pages에서
Source를 "GitHub Actions"로 설정**해야 동작합니다.

## 구조

```
src/engine/   프레임워크 무관 순수 게임 로직 (rules.ts가 진입점)
src/ui/       React 컴포넌트
src/App.tsx   상태 관리 + AI 턴 자동 진행
```
