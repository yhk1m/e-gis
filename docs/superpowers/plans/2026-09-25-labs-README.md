# 실험실(Labs) 구현 계획 — 실행 안내

설계: `docs/superpowers/specs/2026-09-25-labs-design.md`
작성일: 2026-09-25

## 계획서 목록과 순서

| 순서 | 계획서 | 실험 id | 브랜치 | 선행 |
|---|---|---|---|---|
| 0 | `2026-09-25-labs-0-shell-glass.md` | (껍데기) + `glass` | `labs-shell` | 없음 |
| 1 | `2026-09-25-labs-1-class-fill.md` | `class-fill` | `labs-class-fill` | 0 이 `main` 에 병합 |
| 2 | `2026-09-25-labs-2-globe.md` | `globe` | `labs-globe` | 0, 1 |
| 3 | `2026-09-25-labs-3-swipe.md` | `swipe` | `labs-swipe` | 0 |
| 4 | `2026-09-25-labs-4-time-series.md` | `time-series` | `labs-time-series` | 0, 1 |

0단계가 먼저다. 그 뒤 1과 3은 서로 독립이라 동시에 진행할 수 있다. 2와 4는 1단계의 `fillFor`·`fills` 규약을 쓰므로 1이 `main` 에 들어간 뒤 시작한다.

## 어떻게 돌리나

각 계획서를 새 세션에서 연 뒤 다음을 그대로 한다.

1. `superpowers:using-git-worktrees` 로 계획서가 지정한 브랜치의 워크트리를 만든다.
2. `superpowers:subagent-driven-development` 를 부른다. **작업(Task) 하나마다 새 서브에이전트**를 띄우고, 끝나면 스펙 준수 검토 서브에이전트 → 코드 품질 검토 서브에이전트를 거친 뒤 다음 작업으로 간다.
3. 구현자·검토자 모델은 **Fable 5.1**(세션 모델 그대로). `model` 을 낮춰 지정하지 않는다.
4. 서브에이전트 프롬프트에는 계획서의 그 Task 본문 전체, 스펙 경로, 저장소 경로, 그리고 "코드 블록은 그대로 쓰되 실제 파일과 줄 번호가 어긋나면 파일을 읽고 맞춘다"를 넣는다.
5. 마지막 Task(하네스 검증)까지 끝나면 `superpowers:finishing-a-development-branch` → `main` 병합 → `/cpd` 로 배포.

## 저장소 규칙 (모든 단계 공통)

- 저장소 `C:/Users/김용현/Desktop/vibecoding/eGIS`. 테스트 `npm test`, 빌드 `rm -rf dist && npm run build`(한글 경로 우회 래퍼가 들어 있다).
- 커밋은 파일을 지정해서 `git add <파일>`. `git add -A` 금지.
- 커밋 작성자는 매번 `git -c user.name=yhk1m -c user.email=83273992+yhk1m@users.noreply.github.com commit …`. 다른 이메일이면 Vercel 배포가 막힌다.
- Write 훅이 새 파일 머리에 `// © 2026 김용현` 을 넣는다. 지우지 않는다.
- UI 에 이모지 금지. 아이콘은 선 SVG.
- 순수 모듈은 테스트를 먼저 쓴다(vitest, 노드 환경). DOM 이 필요한 테스트만 파일 첫 줄에 `// @vitest-environment jsdom`.
- 화면은 `.claude/skills/verify` 의 Electron 하네스로 본다. 하네스는 `scripts/verify/<단계>.cjs` 에 두고 캡처(`scripts/verify/out/`)는 커밋하지 않는다.
- 조회수 카운터를 건드리지 않게 하네스 첫머리에서 `localStorage.egis_last_visit` 를 오늘(KST)로 둔다.
- 스펙과 계획서가 어긋나면 스펙이 맞다. 스펙에 없는 결정을 해야 하면 계획서 끝 「구현하며 바뀐 점」에 적는다.

## 완료 기준 (단계마다)

- `npm test` 전부 통과, 빌드 성공.
- 하네스 시나리오 PASS 와 캡처 확인: 실험 켜기 → 기능 사용 → 끄기 → 정식 화면과 차이 없음.
- `docs/사용설명서.md` 1-14 실험실 절에 그 실험 문단 추가.
- 레지스트리(`src/labs/registry.js`)에 그 실험 항목 추가 — 구현이 끝난 단계에서만.
- `main` 병합·배포 뒤 `https://www.e-gis.kr/?lab=<id>` 로 실제 확인.
