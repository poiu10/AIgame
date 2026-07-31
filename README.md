# EchoBound

보이지 않는 지형과 적을 음파의 이동과 반사로 파악하는 Phaser 3 기반 사이드뷰
액션 플랫포머 프로토타입이다. 튜토리얼에서 복도를 통해 1스테이지로 전환되며,
맵 전환 체크포인트와 게임과 동일한 스키마를 쓰는 외부 맵 에디터를 제공한다.

## 조작

- `A/D` 또는 방향키: 이동
- `Space`, `W` 또는 위 방향키: 점프
- `Shift`: 구르기
- `J`: 공격
- `R`: 가장 최근 맵 전환 체크포인트로 복귀

## 로컬 실행과 검증

Node.js 22 이상과 npm이 필요하다.

```bash
npm install
npm run dev
```

게임은 `http://localhost:5173/`, 외부 맵 에디터는
`http://localhost:5173/editor.html`에서 연다. 에디터의 `JSON 생성` 결과는 다시
불러올 수 있고, `TypeScript 생성` 결과는 `src/game/content`에 그대로 옮겨
스테이지 레지스트리에 등록할 수 있다.

자동화 테스트와 프로덕션 빌드는 다음 명령으로 확인한다.

```bash
npm test
npm run build
npm run preview
```

## 프로젝트 문서

- 게임 구조와 기술 결정: [`docs/GAME_ARCHITECTURE.md`](docs/GAME_ARCHITECTURE.md)
- 저장소 작업 규칙: [`AGENTS.md`](AGENTS.md)

`main` 브랜치에 푸시하면 GitHub Actions가 게임을 GitHub Pages에 자동
배포한다.
