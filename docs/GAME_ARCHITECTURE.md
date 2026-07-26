# 게임 구조 문서

이 문서는 프로젝트 구조와 주요 기술 결정을 기록하는 살아 있는 문서다.
코드 구조, 게임 흐름, 상태 모델 또는 배포 방식이 바뀌면 같은 변경에서 이
문서도 함께 갱신한다.

## 1. 기술 스택

- 게임 엔진: Phaser 3
- 언어: TypeScript
- 개발 및 빌드: Vite
- 게임 화면: Phaser Canvas/WebGL
- HUD와 메뉴: HTML/CSS DOM 오버레이
- 배포: GitHub Actions를 통한 GitHub Pages 정적 배포

## 2. 설계 원칙

1. 게임 규칙과 저장 가능한 상태는 Phaser 객체와 분리한다.
2. Scene은 입력 전달, 화면 구성, 카메라, 애니메이션과 이펙트를 담당한다.
3. 규칙 변경은 `src/game/simulation`의 시스템을 통해 수행한다.
4. 입력은 물리 키가 아닌 명시적인 액션으로 변환한다.
5. 에셋은 매니페스트의 안정적인 키로 참조한다.
6. 텍스트가 많거나 반응형이어야 하는 HUD와 메뉴는 DOM으로 만든다.

## 3. 디렉터리 구조

```text
.
├─ .github/workflows/       # GitHub Pages 자동 배포
├─ docs/
│  └─ GAME_ARCHITECTURE.md  # 현재 문서
├─ public/assets/           # 빌드 과정에서 그대로 복사되는 게임 에셋
├─ src/
│  ├─ game/
│  │  ├─ assets/            # 에셋 매니페스트와 키
│  │  ├─ content/           # 맵, 아이템, 조우 등 제작 데이터
│  │  ├─ input/             # 액션 정의
│  │  └─ simulation/
│  │     ├─ state.ts        # 저장 가능한 게임 상태
│  │     ├─ rules/          # 순수 규칙과 판정
│  │     └─ systems/        # 이동, 전투, 진행 등 상태 변경 시스템
│  ├─ phaser/
│  │  ├─ adapters/          # 게임 상태와 Phaser 사이의 연결 계층
│  │  ├─ scenes/            # Scene 생명주기와 화면 흐름
│  │  └─ view/              # 스프라이트, 카메라, 이펙트
│  ├─ ui/                   # DOM 기반 HUD, 메뉴, 오버레이
│  └─ main.ts               # 애플리케이션 진입점
├─ index.html
├─ package.json
├─ tsconfig.json
└─ vite.config.ts
```

아직 필요하지 않은 디렉터리는 실제 구현을 추가할 때 생성한다.

## 4. 런타임 흐름

```text
브라우저 입력
  → GameScene이 InputActions로 변환
  → simulation system이 GameState 변경
  → GameScene이 최신 상태를 Phaser 오브젝트에 반영
  → DOM UI가 표시용 상태를 구독해 HUD 갱신
```

`GameState`가 게임 규칙의 기준이며 Phaser의 Sprite, Tween, Camera는 언제든
다시 만들 수 있는 화면 상태로 취급한다.

## 5. Scene 구성

- `BootScene`: 에셋 로딩과 초기화 후 다음 Scene으로 전환한다.
- `GameScene`: 입력을 액션으로 변환하고 시뮬레이션과 화면을 연결한다.
- 이후 필요 시 `MenuScene`, `ResultScene`, `DebugScene`을 별도 추가한다.

Scene 사이에서 임의의 전역 객체를 공유하지 않는다. 장기 상태는 시뮬레이션
상태 또는 명시적인 세션 저장소를 통해 전달한다.

## 6. 상태 및 저장

현재 상태 모델은 플레이어 위치만 포함하는 최소 프로토타입이다. 저장 기능을
추가할 때는 Phaser 객체가 아니라 직렬화 가능한 `GameState`만 저장한다.
GitHub Pages에는 서버가 없으므로 로컬 저장은 `localStorage`를 기본값으로 한다.

## 7. 에셋 정책

- 정적 파일은 `public/assets` 아래에 도메인별로 저장한다.
- 게임 코드에서는 `src/game/assets/manifest.ts`의 키를 사용한다.
- 원본 에셋과 라이선스 또는 출처 정보도 저장소에 포함한다.
- 대용량 에셋을 추가하기 전에 압축과 브라우저 로딩 비용을 검토한다.

## 8. 배포

`main` 브랜치에 푸시하면 `.github/workflows/deploy.yml`이 다음 작업을 수행한다.

1. 의존성 설치
2. TypeScript 검사와 Vite 프로덕션 빌드
3. `dist` 결과물을 GitHub Pages 아티팩트로 업로드
4. Pages 환경에 배포

Vite의 `base`는 상대 경로로 설정되어 프로젝트 저장소 경로에서도 에셋이
정상적으로 로드된다.

## 9. 현재 구현 상태

- [x] Phaser, TypeScript, Vite 초기 구성
- [x] BootScene과 GameScene
- [x] 렌더러와 분리된 최소 GameState 및 이동 시스템
- [x] 키보드 방향키와 WASD 액션 매핑
- [x] DOM HUD 예시
- [x] GitHub Pages 배포 워크플로
- [ ] 실제 게임 장르와 핵심 플레이 루프
- [ ] 에셋 로딩 매니페스트
- [ ] 저장 및 불러오기
- [ ] 모바일 또는 게임패드 입력
- [ ] 자동화 테스트와 브라우저 플레이테스트

## 10. 변경 기록

- 2026-07-26: 초기 Phaser 3 + TypeScript + Vite 구조를 확정하고 최소 이동
  프로토타입 및 GitHub Pages 배포 경로를 추가했다.
