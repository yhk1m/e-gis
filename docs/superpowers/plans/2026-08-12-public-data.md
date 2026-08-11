# 공공데이터 기능 구현 계획

설계서: `docs/superpowers/specs/2026-08-12-public-data-design.md`

> 이 저장소의 관례대로 **한 장 계획**으로 쓴다. 단계별 코드를 다 적지 않고, 파일 경계·순서·검증 지점·함정만 못박는다.

**목표:** 공공데이터포털 데이터를 e-GIS에서 포인트·격자·히트맵 레이어로 본다.

**순서 원칙:** 서비스키가 없어도 되는 것부터 만든다. 순수 함수(1·2) → 서버(3) → 화면(4~6) → 실키 검증(7).

---

## 파일 구조

| 파일 | 책임 | 신규/수정 |
|---|---|---|
| `src/tools/gridAggregate.js` | 포인트 배열 → 격자 칸별 집계 (순수) | 신규 |
| `api/_normalize.js` | 원본 응답 + 카탈로그 항목 → `items` (순수) | 신규 |
| `api/_catalog.js` | 등록된 API 정의. **서버 전용** | 신규 |
| `api/pubdata.js` | 키 보관·호출·캐시·오류 번역 | 신규 |
| `src/ui/dialogs/publicDataTab.js` | 탭 내용 전체 (목록·폼·미리보기·버튼) | 신규 |
| `src/ui/dialogs/BuiltinDataDialog.js` | 탭 버튼 1개 + 컨테이너 1개만 추가 | 수정 (1,056줄이라 내용은 넣지 않는다) |
| `vitest.config.js` | `include`에 `api/**/*.test.js` 추가 | 수정 |

---

## Task 1 — 격자 집계 (순수 함수)

**파일:** `src/tools/gridAggregate.js`, `src/tools/gridAggregate.test.js`

계약:
```js
aggregateToGrid(points, { cellSize, method, field })
// points: [{ x, y, props }]  (EPSG:3857 미터)
// method: 'count' | 'sum' | 'avg',  field: method가 count가 아닐 때 사용
// → [{ minX, minY, maxX, maxY, count, value }]   빈 칸은 포함하지 않는다
```

**격자 기준점은 좌표 원점(0,0)이다.** `floor(x / cellSize)`로 칸을 정한다. 데이터 최소 좌표를 기준으로 잡으면 데이터셋마다 격자가 어긋나 두 결과를 겹쳐 볼 수 없다. 원점 기준이면 언제 어떤 데이터를 넣어도 같은 칸에 떨어진다.

TDD 순서:
1. 점 3개가 같은 칸에 들어가면 칸 1개, count 3 — 실패 확인 후 구현
2. 칸 경계에 정확히 걸린 점은 **오른쪽/위 칸**에 들어간다 (`floor` 규칙을 테스트로 못박는다)
3. 데이터를 통째로 `cellSize`만큼 옮기면 칸도 정확히 하나씩 밀린다 (원점 기준임을 못박는 테스트)
4. `sum`/`avg`는 숫자로 못 읽는 값을 건너뛰고, 전부 못 읽으면 `value: null`
5. 빈 칸이 결과에 없다
6. `cellSize <= 0`이면 예외

커밋: `feat: 격자 집계 순수 함수`

---

## Task 2 — 응답 정규화 (순수 함수)

**파일:** `api/_normalize.js`, `api/_normalize.test.js`, `vitest.config.js` 수정

계약:
```js
normalize(raw, entry)   // entry = 카탈로그 항목
// → { items: [{ lon, lat, props }], count, skipped }
```

먼저 `vitest.config.js`의 `include`를 `['src/**/*.test.js', 'api/**/*.test.js']`로 바꾸고 빈 테스트가 잡히는지 확인한다.

TDD 순서:
1. `path`(예: `response.body.items`)로 배열을 찾는다. 중간 키가 없으면 빈 배열
2. 공공데이터포털이 **항목 1건일 때 배열이 아니라 객체**로 주는 경우가 있다 → 단일 객체도 배열로 감싼다
3. 좌표 필드가 비었거나 숫자가 아니면 제외하고 `skipped`를 센다
4. `props`는 좌표 필드를 뺀 나머지 전부
5. `epsg`는 그대로 실어 보낸다 (변환은 브라우저 몫)

픽스처는 실제 응답 모양을 본떠 `api/__fixtures__/`에 JSON으로 둔다.

커밋: `feat: 공공데이터 응답 정규화`

---

## Task 3 — 카탈로그 + 중계 함수

**파일:** `api/_catalog.js`, `api/pubdata.js`, `api/pubdata.test.js`

⚠️ **ESM 필수** — 루트 `package.json`이 `"type": "module"`이다. `export default async function handler(req, res)`. CommonJS로 쓰면 500이 난다.

테스트 가능하게 쪼갠다:
```js
// api/pubdata.js
export async function handle(query, { fetchFn, key })  // ← 테스트가 부르는 순수 로직
export default async function handler(req, res) { ... }  // ← Vercel 진입점, 얇게
```

검증 항목(테스트):
1. `?list=1` → 카탈로그의 `id`/`name`/`description`/`params`만 나온다. **`endpoint`·`lon`·`lat`가 응답에 없다**
2. 카탈로그에 없는 `id` → 400
3. 카탈로그에 정의되지 않은 파라미터 키는 무시된다
4. 원본이 오류 코드를 주면 한국어 안내 문장으로 바뀐다 (트래픽 초과 / 키 오류 / 점검)
5. 성공 시 `Cache-Control: s-maxage=600, stale-while-revalidate=3600`

카탈로그 첫 항목은 **형식만 갖춘 1개**를 넣고, 실제 값 확인은 Task 7에서 한다.

커밋: `feat: 공공데이터 중계 함수`

---

## Task 4 — 탭 자리 만들기

**파일:** `src/ui/dialogs/BuiltinDataDialog.js` 수정, `src/ui/dialogs/publicDataTab.js` 신규

1. 탭 버튼 `<button class="builtin-tab" data-tab="public">🌐 공공데이터</button>` 추가
2. 콘텐츠 컨테이너 추가 → `publicDataTab.render()` 위임
3. `TAB_FOOTER_TEXT`에 `public: '공공데이터포털 데이터를 실시간으로 불러옵니다'` 추가
4. `publicDataTab.js`는 `/api/pubdata?list=1`을 받아 목록만 그린다

수동 확인: `npm run dev` → 데이터 불러오기 → 탭 4개가 보이고 전환된다.
(이 시점엔 서버 함수가 로컬에 없으므로 목록은 "불러올 수 없음" 안내가 뜨면 정상 — 그 안내 문구도 이번에 만든다)

커밋: `feat: 데이터 불러오기에 공공데이터 탭 추가`

---

## Task 5 — 불러오기 → 포인트 레이어

**파일:** `src/ui/dialogs/publicDataTab.js`

1. 항목 선택 → `params` 정의대로 select/입력 폼 생성
2. `[불러오기]` → `/api/pubdata?id=...&...` → 미리보기(건수, 제외 건수, 상위 5행)
3. `[포인트로 추가]` → 피처 생성 → `layerManager.addLayer({ name, features, geometryType: 'Point' })`
   - 좌표 변환: `epsg === 4326`이면 `fromLonLat`, 아니면 `transform(coord, 'EPSG:'+epsg, 'EPSG:3857')`
   - 한국 TM 좌표계는 `CoordinateSystem.js`가 이미 proj4에 등록해 둔다 (`EPSG:5186` 등)
4. `props`는 피처 속성으로 그대로 넣는다 (속성 테이블·라벨·필드 계산기가 바로 먹는다)

로컬 확인: `vercel dev`로 서버 함수까지 띄워야 한다. 키는 `.env.local`에 `DATA_GO_KR_KEY=...`

커밋: `feat: 공공데이터 포인트 레이어 생성`

---

## Task 6 — 격자·히트맵 버튼

**파일:** `src/ui/dialogs/publicDataTab.js`

- `[격자 집계]` → 격자 크기(500m/1km/5km)·집계 방식 선택 → `aggregateToGrid()` → 칸마다 `new Polygon` → 폴리곤 레이어 1개.
  생성 후 `_choroplethConfig`를 붙이고 `choroplethTool`로 분류·범례를 건다 (**기존 규약 그대로** — 저장/복원이 공짜로 따라온다)
  칸이 20,000개를 넘으면 진행 전에 경고하고 셀 크기 조정을 유도한다
- `[히트맵]` → 포인트 레이어를 만든 뒤 `heatmapTool.createHeatmap(layerId, { hideSource: true, weight })`

수동 확인: 세 버튼이 각각 레이어를 1개씩 만들고, 새로고침 후 복원까지 되는지 본다.

커밋: `feat: 공공데이터 격자 집계·히트맵`

---

## Task 7 — 실 서비스키로 검증하고 배포

1. 공공데이터포털 활용신청 → 키 발급
2. 로컬 `.env.local`로 실제 응답을 받아 카탈로그 항목의 `path`/`lon`/`lat`/`epsg`를 **실측값으로 교정**
3. 유효 키 성공 응답에도 CORS 헤더가 붙는지 확인해 설계서 "나중에 볼 것"에 결과를 적는다
4. Vercel 환경변수 `DATA_GO_KR_KEY` 등록 → 배포 → 프로덕션에서 한 항목 불러오기까지 확인
5. `.vercelignore`에 `api`가 걸리지 않는지 확인한다 (지금은 `eStoryMap`만 제외)

커밋: `feat: 공공데이터 카탈로그 첫 항목`

---

## 함정 모음 (이 저장소 이력)

- 서버 함수는 **ESM**. CommonJS면 500
- `dist`가 남아 있으면 빌드가 조용히 실패한 이력이 있다 → 배포 전 클린 빌드
- 배포 직후 캐시 때문에 "안 바뀐 것처럼" 보인다 → 하드 새로고침으로 먼저 확인
- 격자 폴리곤 레이어는 새 폴리곤 기본값(면 100% 불투명·팔레트 색)을 받는다. 단계구분도 설정을 붙이면 분류색이 우선한다
