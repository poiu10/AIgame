# AI Game

Phaser 3, TypeScript, Vite로 만드는 2D 브라우저 게임이다. 전체 소스 코드와
개발 기록을 같은 Git 저장소에서 관리하고 GitHub Pages에 자동 배포한다.

## 로컬 실행

Node.js 22 이상과 npm을 준비한 뒤 실행한다.

```bash
npm install
npm run dev
```

프로덕션 빌드를 확인하려면 다음 명령을 사용한다.

```bash
npm run build
npm run preview
```

## 프로젝트 문서

- 게임 구조와 기술 결정: [`docs/GAME_ARCHITECTURE.md`](docs/GAME_ARCHITECTURE.md)
- 저장소 작업 규칙: [`AGENTS.md`](AGENTS.md)

## GitHub Pages 배포

1. GitHub에서 빈 저장소를 만든다.
2. 이 로컬 저장소의 브랜치 이름을 `main`으로 맞춘다.
3. GitHub 저장소를 `origin`으로 추가하고 소스와 커밋을 푸시한다.
4. GitHub 저장소의 **Settings → Pages → Build and deployment → Source**에서
   **GitHub Actions**를 선택한다.
5. **Actions** 탭의 `Deploy game to GitHub Pages` 작업이 성공하는지 확인한다.

명령 예시는 다음과 같다. `<GITHUB_ID>`와 `<REPOSITORY>`는 실제 값으로
바꾼다.

```bash
git branch -M main
git add .
git commit -m "Initialize Phaser game architecture"
git remote add origin https://github.com/<GITHUB_ID>/<REPOSITORY>.git
git push -u origin main
```

배포 주소는 일반적으로 다음과 같다.

```text
https://<GITHUB_ID>.github.io/<REPOSITORY>/
```
