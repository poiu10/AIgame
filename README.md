# EchoBound

보이지 않는 지형과 적을 음파의 이동과 반사로 파악하는 Phaser 3 기반 사이드뷰
액션 플랫포머 프로토타입이다. 현재는 플레이어 이동과 전투, 플랫폼, 적 2종의
조우, 거리 감쇠 기반 연속 음파 반사를 검증하는 테스트 룸을 제공한다.

## 조작

- `A/D` 또는 방향키: 이동
- `Space`, `W` 또는 위 방향키: 점프
- `Shift`: 구르기
- `J`: 공격
- `R`: 재시작
- `P`: 개발용 강제 음파
- `F3`: 개발용 충돌체 표시

## 로컬 실행과 검증

Node.js 22 이상과 npm이 필요하다.

```bash
npm install
npm run dev
```

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
