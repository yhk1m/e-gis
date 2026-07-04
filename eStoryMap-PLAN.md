# eStoryMap v2 — PLAN.md

> 기존 e-GIS 내 `eStorymap/` 구현은 폐기하고 백지에서 재설계.
> **Electron 데스크톱 앱**으로 독립. .egis 프로젝트 파일과 생 GeoTIFF를 데이터 소스로, 페이지별 레이어 on/off로 슬라이드를 만드는 지도 스토리텔링 도구.
> 로컬(`~/Desktop/eStoryMap/`)에 `.esm` 자동 저장 + Supabase 로그인 시 e-GIS 프로젝트 연동·클라우드 동기화(하이브리드).

---

## 0. 결정 사항 (확정)

| 항목 | 결정 |
|---|---|
| 데이터 소스 | **.egis 파일 + 생 GeoTIFF(.tif) 직접 로드.** (Electron `fs`로 원본 래스터 파싱 가능) |
| 렌더링 엔진 | **OpenLayers 9** (e-GIS 본체와 통일). MapLibre 방향 폐기. |
| 앱 형태 | **Electron 데스크톱 앱** (AI-checker·SHcore 패턴). 웹 모듈 아님. |
| 스택 | Electron + Vite + Vanilla JS + geotiff.js (e-GIS 코어 이식) |
| 저장 | **로컬 `.esm` 자동 저장(기본) + Supabase 클라우드 동기화(옵션).** 하이브리드. |
| 로그인 | **e-GIS와 동일 Supabase 프로젝트 공유** → 계정·프로젝트 연동 |
| e-GIS 연동 | 로그인 시 e-GIS `projects` 테이블에서 **내 .egis를 클라우드로 직접 불러오기** |
| 저작 주체 | **학생이 직접 저작하는 빌더** |
| 출력 형태 | **프레젠테이션(4:3)** + **보고서(A4)** |
| 페이지 단위 | 페이지 = 슬라이드 = 보고서 한 섹션 (동일 데이터, 다른 셸) |
| 본문 포맷 | **마크다운 저장**(marked + DOMPurify). MVP는 순수 마크다운 입력, 서식 툴바는 v2 |
| 페이지별 스타일 | `overrides`는 **v2**. MVP는 레이어 on/off(visible)만. 스키마 자리만 확보 |
| 저장 위치 | **`~/Desktop/eStoryMap/` 고정** + 앱 내 "폴더 열기" 버튼. 경로 변경은 v2 |

---

## 1. .egis 포맷 (재확인 — 재작성 아님)

.egis = JSON (`application/json`, 확장자만 .egis). e-GIS `ProjectManager.serialize()` 산물.

```jsonc
{
  "version": "...",
  "name": "프로젝트명",
  "created": "ISO8601",
  "view":  { "center": [x, y], "zoom": 7.2 },   // EPSG:3857 좌표
  "displayCRS": "EPSG:...",
  "layers": [
    { "id","name","type":"vector","geometryType","visible",
      "color","opacity",
      "features": { /* GeoJSON FC, EPSG:4326 저장 */ } },
    { "id","name","type":"raster","rasterKind":"dem|analysis|unknown",
      "raster": { /* base64 인코딩 메타/데이터 */ } }
  ]
}
```

**파싱 규칙 (e-GIS deserialize에서 이식):**
- 벡터: `GeoJSON.readFeatures(features, { featureProjection:'EPSG:3857', dataProjection:'EPSG:4326' })`
- 래스터 DEM: `demLoader.buildDEMLayer(decodeRasterMeta(...))`
- 래스터 analysis: `rasterAnalysisTool.buildAnalysisLayer(...)`
- `rasterKind:'unknown'` → 복원 불가, 스킵
- 레이어별 `color / opacity / visible` 보존

**e-GIS 대비 결정적 차이:**
e-GIS deserialize는 "기존 레이어 전부 제거 → 하나의 프로젝트만 복원"(단일 프로젝트 전제).
eStoryMap은 **여러 소스 동시 로드 + 페이지마다 visible 토글**.
→ 파싱은 소스 추가 시 1회, OL 레이어를 전부 메모리에 생성해두고 이후 `olLayer.setVisible()`로만 제어.

---

## 1b. 소스 획득 경로 (3종)

| 경로 | 방법 | 비고 |
|---|---|---|
| **A. 로컬 .egis 파일** | Electron `fs`로 `.egis` 열기 → JSON 파싱 | 기존 방식 |
| **B. e-GIS 클라우드** | 로그인 후 `projects` 테이블 `select` → 내 .egis 목록에서 선택 | **파일 주고받기 불필요** (§4b) |
| **C. 생 GeoTIFF** | Electron `fs`로 `.tif` 읽기 → geotiff.js 파싱 → DEM 레이어 | .egis 없이 래스터 단독 추가 |

세 경로 모두 최종적으로 `SourceRegistry`에 `{sourceId, layerId}→olLayer` 형태로 등록되어 이후 동일하게 취급됨.

## 1c. DEM(래스터) 이원 경로

DEM 렌더링 알맹이는 e-GIS `DEMLoader.buildDEMLayer`에서 이식 — OL `ImageLayer`(ImageCanvasSource)로 캔버스에 그리는 부분은 그대로 재사용. 단, e-GIS 원본은 `layerManager.addLayer`/`mapManager.fitExtent` 싱글턴에 의존하므로 **eStoryMap 전용 래퍼의 동등 메서드로 교체**해 이식.

- **경로 ①(.egis 임베드):** `.egis`의 `raster`(base64) → `decodeRasterMeta` → `buildDEMLayer`. **geotiff.js 안 거침**(이미 디코딩된 데이터).
- **경로 ②(생 .tif):** Electron `fs`로 파일 읽기 → `geotiff.js`로 `demData` 생성 → 동일한 `buildDEMLayer`로 렌더. e-GIS의 원본 GeoTIFF 로딩 로직(`DEMLoader` 상단부) 이식.

두 경로 모두 `buildDEMLayer` 이후는 동일 → 렌더 코드 1벌 공유.

---

## 2. 데이터 모델 (StoryMapDoc)

핵심 통찰: **각 .egis 레이어에 이미 `id`가 있으므로, 페이지는 지오데이터를 복제하지 않고 `layerId` 참조 + visible 상태만 저장.**

```jsonc
StoryMapDoc {
  "meta": {
    "id": "uuid",
    "title": "...",
    "mode": "presentation" | "report",   // 열람 기본 모드(에디터에서 토글 가능)
    "created", "updated"
  },

  "sources": [                            // 업로드된 .egis 풀
    {
      "sourceId": "src_1",
      "filename": "부산_인구.egis",
      "egis": { /* .egis 원본 JSON 통째로 임베드 */ }
    }
  ],

  "pages": [
    {
      "id": "page_1",
      "title": "1. 인구 분포",
      "camera": { "center": [x,y], "zoom": 8.5 },   // .egis view 포맷 재사용
      "layerVisibility": [                          // 페이지별 체크 상태 (핵심)
        { "sourceId": "src_1", "layerId": "L_a", "visible": true },
        { "sourceId": "src_1", "layerId": "L_b", "visible": false }
      ],
      "overrides": {                                // (v2) 페이지별 스타일 덮어쓰기 — MVP 미사용, 자리만 확보
        "L_a": { "opacity": 0.6 }
      },
      "content": {
        "heading": "부산의 인구 분포",
        "body": "마크다운 또는 플레인 텍스트",
        "caption": "지도 하단 캡션"
      }
    }
  ]
}
```

**설계 원칙**
- 지오데이터는 `sources`에 딱 1벌. 페이지는 `layerId`만 가리킴 → 문서 크기 최소화, 편집 안전.
- 카메라 포맷은 .egis `view`({center, zoom})와 동일하게 유지 → 상호 변환 불필요.
- `overrides`는 페이지별로 원본 .egis 스타일을 덮어쓰는 얕은 diff (없으면 원본 스타일). **MVP 미구현 — v2.** 렌더러에는 override 적용 지점만 열어둠.

**저장:** 로컬 `~/Desktop/eStoryMap/{title}.esm` (JSON). §3b 참조.

---

## 3. 아키텍처 (Electron)

Electron 3-프로세스 구조. renderer는 e-GIS 코어(OL 파싱)를 이식, main은 파일시스템 담당.

```
eStoryMap/                       // Electron 앱 루트
├─ electron/
│  ├─ main.js            // BrowserWindow 생성, 앱 생명주기
│  ├─ preload.js         // contextBridge로 안전한 fs API 노출
│  └─ fileService.js     // ~/Desktop/eStoryMap/ 관리, 읽기/쓰기/목록
├─ src/                          // renderer (Vite 빌드)
│  ├─ core/
│  │  ├─ EgisLoader.js       // .egis 파싱 → OL 레이어 (ProjectManager 이식)
│  │  ├─ GeoTiffLoader.js    // 생 .tif → demData → buildDEMLayer (DEMLoader 이식)
│  │  ├─ DemRenderer.js      // buildDEMLayer 알맹이(ImageCanvasSource) 이식·탈싱글턴화
│  │  ├─ SourceRegistry.js   // 여러 소스 관리, {sourceId,layerId}→olLayer
│  │  ├─ StoryDoc.js         // StoryMapDoc 상태(단일 진실원) + dirty 추적
│  │  ├─ StoryMapRenderer.js // 현 페이지 → OL map 반영 (setVisible/animate)
│  │  ├─ AuthManager.js      // Supabase Auth (e-GIS SupabaseManager 이식)
│  │  ├─ CloudSync.js        // e-gistory 테이블 저장/불러오기 (projects read는 M7에서 폐기)
│  │  └─ LocalStore.js       // preload API 통해 .esm 자동 저장/열기
│  ├─ editor/
│  │  ├─ SourcePanel.js      // 좌: 소스 추가(.egis/클라우드/.tif) + 레이어 트리 체크박스
│  │  ├─ PageList.js         // 좌하: 페이지 리스트 추가/복제/삭제/정렬
│  │  ├─ CanvasStage.js      // 중앙: OL 지도 + "이 위치로 캡처" 버튼
│  │  └─ ContentEditor.js    // 우: heading/body(마크다운)/caption 편집
│  ├─ viewer/
│  │  ├─ PresentationShell.js // 4:3 풀블리드 지도 + 오버레이 카드
│  │  └─ ReportShell.js       // A4 지도 figure + 본문 + PDF 출력
│  ├─ shared/
│  │  └─ CameraAnimator.js    // OL view.animate 래핑, easing 커스텀
│  └─ main.js (renderer entry)
└─ package.json          // electron-builder 설정
```

**프로세스 경계 (보안):**
- renderer는 `fs` 직접 접근 불가. `preload.js`가 `contextBridge`로 화이트리스트 API만 노출:
  `window.egisFS.saveProject(name, json)`, `.loadProject(name)`, `.listProjects()`, `.importEgis()`.
- `nodeIntegration: false`, `contextIsolation: true` 유지.

**렌더링 파이프라인 (핵심, 변동 없음):**
1. .egis 로드 시: `EgisLoader`가 각 레이어 → OL Layer 생성, `SourceRegistry`에 등록. 전부 map에 add하되 visible=false.
2. 페이지 전환: `StoryMapRenderer`가 페이지 `layerVisibility`대로 `setVisible` 토글 (+ `overrides` 적용은 v2). 카메라 이동은 renderer가 아니라 **전환 이벤트(main.js onSelect)에서만** `CameraAnimator.flyTo` 호출 — renderer는 체크 토글마다 실행되므로 재비행 방지(M4 확정).
3. 지오데이터 재파싱 없음 → 전환 가볍고 빠름.

---

## 3b. 로컬 저장 / 자동 저장

```
~/Desktop/eStoryMap/            // main 프로세스가 최초 실행 시 자동 생성
├─ 부산인구이야기.esm            // 프로젝트 1개 = .esm 파일 (JSON)
├─ 기후변화.esm
└─ .backups/                    // (선택) 타임스탬프 백업
```

- **`.esm` = StoryMapDoc JSON** (sources의 .egis 임베드 포함). Electron이라 용량 걱정 없음(§6에서 Supabase jsonb 한계 이슈 소멸).
- **자동 저장:** StoryDoc이 dirty 되면 디바운스(예: 2초) 후 `window.egisFS.saveProject()` 호출 → main이 `.esm`에 기록. 저장 중/완료 상태 표시.
- **폴더 자동 생성:** `fileService.js`가 앱 기동 시 `app.getPath('desktop')/eStoryMap` 없으면 `fs.mkdirSync`. **경로 고정**(변경은 v2).
- **"폴더 열기" 버튼:** 앱 내에서 `shell.openPath()`로 저장 폴더를 파일탐색기에 바로 열어 학생이 파일 위치를 쉽게 찾게 함.
- **백업(선택):** 저장 시 직전 버전을 `.backups/{name}-{timestamp}.esm`로 남겨 실수 복구.
- 열기: `listProjects()`로 `.esm` 목록 → 시작 화면에서 선택. "최근 프로젝트" 자동 열기 옵션.

**클라우드 동기화 (옵션, 로그인 시):**
- 저장 기본값은 로컬 `.esm`. 로그인 상태면 "클라우드에 저장" 토글로 Supabase `e-gistory` 테이블에도 upsert(§6b).
- 로컬 우선 원칙: 오프라인이어도 항상 로컬 저장은 됨. 클라우드는 온라인일 때 백그라운드 동기화.
- 충돌은 MVP에서 `updated_at` 최신 우선(last-write-wins). 세밀한 머지는 v2.

---

## 4. 에디터 UX 흐름

```
┌──────────┬─────────────────────────┬──────────┐
│ SOURCE   │      CANVAS STAGE       │ CONTENT  │
│          │                         │          │
│ [+.egis] │   ┌─────────────────┐   │ 제목     │
│ ▸부산인구 │   │                 │   │ [_____]  │
│   ☑ 인구  │   │   OL 지도       │   │ 본문     │
│   ☐ 경계  │   │  (현재 페이지)  │   │ [_____]  │
│ ▸전국DEM  │   │                 │   │ 캡션     │
│   ☑ 고도  │   └─────────────────┘   │ [_____]  │
│          │  [📷 현재 화면을 이 페이지 카메라로]│
├──────────┤                         │          │
│ PAGES    │                         │          │
│ 1.인구분포│                         │          │
│ 2.고도    │                         │          │
│ [+ 페이지]│                         │          │
└──────────┴─────────────────────────┴──────────┘
        [프레젠테이션 미리보기] [보고서 미리보기] [저장]
```

**핵심 인터랙션:**
- SOURCE 트리의 체크박스 = **현재 선택된 페이지의** `layerVisibility` 편집. 페이지를 바꾸면 체크 상태가 그 페이지 것으로 갱신됨.
- CANVAS에서 지도를 이동/줌 → "📷 이 위치로" 버튼으로 현재 페이지 `camera`에 저장.
- PAGES에서 페이지 추가 시 직전 페이지의 레이어/카메라를 복제(연속 편집 편의).

---

## 4b. 로그인 & e-GIS 연동

**인증:** e-GIS `SupabaseManager`의 auth 부분 이식 → `signInWithPassword` / `signInWithGoogle`. **동일 Supabase 프로젝트**를 바라보므로 e-GIS 계정으로 그대로 로그인(계정 공유). 세션은 Electron main 프로세스(또는 OS 키체인)에 안전 저장, 재실행 시 자동 로그인.

**e-GIS 프로젝트 불러오기 (핵심 연동):**
e-GIS는 .egis를 Supabase `projects` 테이블에 저장함 — 구조 확인됨:
```
projects { id, user_id, name, data(=.egis JSON 통째), updated_at }, unique(user_id, name)
```
→ eStoryMap이 로그인 후:
1. `projects.select('id, name, updated_at').eq('user_id', me)` → 내 e-GIS 프로젝트 목록 표시
2. 선택 시 `projects.select('*')` → `data` 필드가 곧 .egis JSON → **파일 다운로드 없이 바로 소스로 로드**
3. 이후 `EgisLoader` 파싱 경로는 로컬 .egis와 100% 동일

효과: 학생이 e-GIS에서 지도 저장 → eStoryMap 로그인 → 목록에서 골라 스토리맵 제작. **파일 주고받기 단계 소멸.**

**권한:** `projects`는 읽기만(내 것). eStoryMap 결과물은 별도 `e-gistory` 테이블(§6b)에 저장 → e-GIS 데이터 오염 없음.

---

## 5. 뷰어 모드

### 프레젠테이션 (4:3, 1024×768 기준)
- 지도 풀블리드 배경, `content.heading` + `body`(마크다운 렌더)가 반투명 카드로 오버레이(위치 선택 가능).
- ← → / Space / 클릭으로 페이지 전환 → `CameraAnimator`로 카메라 이동 애니메이션.
- 하단 페이지 인디케이터(● ● ○).
- 전체화면(Fullscreen API), 종횡비 4:3 레터박스 고정.

### 보고서 (A4 210×297mm 세로)
- 페이지마다: `heading` → 지도 figure(고정 높이) → `body` → `caption` 순 세로 흐름.
- 스크롤 연속 열람, `@media print` + `@page { size: A4 }`로 인쇄 대응.
- **PDF 출력**: e-GIS가 이미 쓰는 html2canvas + jsPDF 재사용. 지도는 페이지별로 카메라 세팅 후 캔버스 캡처 → 이미지로 삽입.

두 셸은 **동일한 `pages` 데이터**를 읽고 레이아웃만 다름.

---

## 6. 저장 포맷 (`.esm`)

Electron 로컬 저장이라 DB·RLS 불필요. 프로젝트 1개 = `.esm` 파일 1개 = StoryMapDoc JSON 그대로.

```
~/Desktop/eStoryMap/부산인구이야기.esm
```

```jsonc
{ /* = StoryMapDoc (§2). sources[].egis에 .egis 원본 임베드 */ }
```

- Electron `fs`라 파일 크기 제한 실질적 무제한 → **DEM 래스터 base64를 그냥 임베드해도 OK** (Supabase jsonb 한계 이슈 소멸).
- 파일명 = `meta.title` (중복/특수문자 새니타이즈는 `fileService`에서 처리).
- 이식성: `.esm` 하나만 복사하면 다른 PC에서 그대로 열림(sources 임베드 덕분).

## 6b. 클라우드 저장 테이블 (옵션)

로그인 + 클라우드 동기화 시에만 사용. e-GIS `projects`와 **분리된 전용 테이블** (오염 방지).

```sql
create table "e-gistory" (  -- 테이블명 2026-07-04 사용자 지시로 storymaps→e-gistory (하이픈이라 따옴표 식별자 필수)
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id),
  title text not null,
  doc jsonb not null,                  -- StoryMapDoc 전체(sources 임베드)
  updated_at timestamptz default now(),
  unique(user_id, title)               -- e-GIS projects와 동일 패턴
);
-- RLS: user_id = auth.uid()
```

주의: `doc`에 DEM base64가 여러 개 임베드되면 jsonb가 커질 수 있음. 로컬 `.esm`은 무제한이지만 클라우드 동기화 시엔 크기 확인 필요 → 대용량이면 클라우드 저장 시 래스터 제외 옵션 검토(v2).

---

## 7. 구현 순서 (마일스톤)

- **M0 — Electron 셸:** main/preload/renderer 골격, `~/Desktop/eStoryMap/` 자동 생성, `contextBridge` fs API. 빈 창 + Vite 연동.
- **M1 — 소스 로딩(벡터):** `EgisLoader` + `SourceRegistry`. 로컬 .egis 열기 → OL 지도 표시. 벡터 이식 검증.
- **M2 — DEM 이식:** `DemRenderer` 탈싱글턴화. 경로①(.egis 임베드) 먼저, 경로②(생 .tif + `GeoTiffLoader`) 이어서.
- **M3 — 문서/페이지:** `StoryDoc` + PageList + SourcePanel 체크박스 연동. 페이지 전환 시 visible 토글.
- **M4 — 카메라:** "이 위치로 캡처" + `CameraAnimator`. 페이지 전환 애니메이션.
- **M5 — 콘텐츠:** ContentEditor(heading/body/caption). body는 마크다운(marked 렌더 + DOMPurify 살균).
- **M6 — 로컬 자동 저장:** `LocalStore` + 디바운스 + 시작 화면(목록/열기) + 백업 + "폴더 열기" 버튼.
- **M7 — 로그인:** `AuthManager`(이메일/비밀번호, supabase-js npm 번들) + 시작 화면 로그인 영역. 가입은 e-GIS 웹 안내. ~~CloudSync/e-GIS projects 로드~~ 폐기 — e-GIS 본체가 클라우드 프로젝트 저장을 제거해(ece5de2, CloudPanel "클라우드 저장 기능 제거됨") projects 테이블은 데드 데이터. 설계: `docs/superpowers/specs/2026-07-04-m7-auth-design.md`.
- **M8 — 클라우드 동기화:** `e-gistory` 테이블 저장/불러오기(옵션 토글) + RLS + 시작 화면 클라우드 목록. 설계: `docs/superpowers/specs/2026-07-04-m8-cloudsync-design.md`.
- **M9 — 프레젠테이션 셸:** 4:3 뷰어 + 키보드 전환 + 전체화면.
- **M10 — 보고서 셸:** A4 레이아웃 + PDF 출력.
- **M11 — 패키징:** electron-builder로 win/mac 빌드.

---

## 8. 확인 필요 (구현 중 검증)

> 설계 결정은 모두 확정됨. 아래는 이식·구현 단계에서 실측/검증이 필요한 항목.

1. **좌표계 정렬**: ~~.egis `view.center`는 EPSG:3857 전제~~ → **M1 실측 확정: EPSG:4326 경위도**(e-GIS `MapManager.getCenter()`가 `toLonLat` 반환). `page.camera`도 동일 포맷(M4). 생 GeoTIFF는 자체 CRS → `transformExtent`로 3857 정렬(M2에서 이식 완료).
2. **DemRenderer 탈싱글턴화**: e-GIS `buildDEMLayer`가 `layerManager`/`mapManager` 싱글턴 의존 → 전용 래퍼 주입식으로 리팩터링. M2 핵심 작업.
3. **클라우드 DEM 용량**: 로컬 `.esm`은 무제한이나 `e-gistory.doc` jsonb에 DEM base64 다수 임베드 시 부담 → 대용량이면 클라우드 저장 시 래스터 제외 옵션(v2).
4. **오프라인/온라인 시작 화면 분기**: ~~로그인 안 한 로컬 전용 모드 vs 로그인 클라우드 모드의 진입 UX~~ → **M7 설계로 해소(2026-07-04)**: 시작 화면 하단 auth 섹션 3상태(로그아웃 폼/로그인 표시/오프라인 에러 라인), 로그인 없이 로컬 기능 전부 동작.

## 8b. v2 백로그 (확정 연기)

- 페이지별 스타일 `overrides` UI + 렌더 적용
- 본문 서식 툴바(마크다운 문법 없이 굵게/목록/제목)
- 저장 폴더 경로 변경 기능
- 클라우드 충돌 세밀 머지(현재 last-write-wins)
