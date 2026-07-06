# Love Letter Legend game

러브레터 기반 싱글 플레이 카드 게임입니다. React + Vite로 만든 게임 UI와 `src/engine`의 순수 게임 로직으로 구성되어 있습니다.

## 로컬 실행

저장소 루트가 아니라 `game` 폴더에서 실행합니다.

```bash
cd game
npm install
npm run dev
```

개발 서버가 뜨면 터미널에 표시되는 주소로 접속합니다. 기본 주소는 보통 `http://localhost:5173` 입니다.

## 확인 명령

```bash
cd game
npm test
npm run build
```

`npm test`는 엔진/세션 테스트를 실행하고, `npm run build`는 GitHub Pages에 올릴 정적 파일을 `game/dist`에 생성합니다.

## GitHub Pages 배포

이 저장소는 GitHub Pages 프로젝트 사이트로 배포됩니다.

배포 주소:

```text
https://drayage.github.io/loveletterlegend/
```

처음 한 번은 GitHub 저장소에서 아래 설정을 해주세요.

1. 저장소 `Settings`로 이동
2. `Pages` 메뉴 선택
3. `Build and deployment`의 `Source`를 `GitHub Actions`로 설정

이후 `main` 브랜치에 `game/**` 또는 `.github/workflows/deploy.yml` 변경이 push되면 `.github/workflows/deploy.yml`이 자동으로 테스트, 빌드, 배포를 실행합니다.

## 구조

```text
src/engine/   프레임워크와 분리된 게임 로직
src/ui/       React UI 컴포넌트
src/App.tsx   세션 상태 관리와 AI 진행 흐름
```
