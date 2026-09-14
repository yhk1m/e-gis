# 배경지도 확장 설계 (VWorld + 세계 지도)

2026-09-14

## 목적

배경지도를 4개(OSM·Esri 어두운 지도·위성·위성+라벨)에서 두 묶음 9개로 늘린다.
한국은 국토교통부 VWorld(한글·지번·건물명, 무료·키 필요), 세계는 키 없이 되는 오픈소스·Esri.

### 실측 근거 (서울 z12·z15 타일 직접 수신, 2026-09-14)

- 도시 축척(z15)까지 나오는 것: OSM 표준, OpenTopoMap, OSM Humanitarian, CyclOSM, Esri Dark Gray, Esri World Imagery
- z13까지만 나오는 것(제외): Esri World_Street_Map · World_Topo_Map · Light Gray · NatGeo(z12)
- CARTO light_all 은 "API KEY REQUIRED" 워터마크(제외). 라벨 전용 타일 voyager_only_labels 는 정상 → 위성+라벨은 유지
- VWorld 는 한국 밖이 거의 비어 있으므로 세계 지도를 함께 둔다. 기본값은 지금처럼 OSM 표준(키 없이도, 어디서나 나온다)

## 목록

| 묶음 | key | 라벨 | 소스 | 비고 |
|---|---|---|---|---|
| 한국 (VWorld) | `VW_BASE` | 일반 | `…/{키}/Base/{z}/{y}/{x}.png` | |
| | `VW_GRAY` | 회색 | `…/gray/….png` | 주제도 배경 |
| | `VW_MIDNIGHT` | 야간 | `…/midnight/….png` | 어두운 배경 |
| | `VW_SATELLITE` | 위성 | `…/Satellite/….jpeg` | |
| | `VW_HYBRID` | 위성 + 라벨 | Satellite 위에 `Hybrid/….png` 오버레이 | |
| 세계 | `OSM` | OSM 표준 | 기존 | 기본값 |
| | `OPENTOPO` | 지형도 (OpenTopoMap) | `https://{a-c}.tile.opentopomap.org/{z}/{x}/{y}.png`, maxZoom 17 | 등고선·음영기복 |
| | `SATELLITE` | 위성 (Esri) | 기존 | |
| | `SATELLITE_LABELS` | 위성 + 라벨 | 기존 (Esri 위성 + CARTO 라벨) | |
| | `ESRI_DARK` | 어두운 지도 (Esri) | 기존 | 흐름도 기본 어두운 배경 |
| (목록에 없음) | `NONE` | 없음 | 기존 | 3D 패널에서만 고를 수 있음 (지금과 같음) |

VWorld 타일 주소: `https://api.vworld.kr/req/wmts/1.0.0/{키}/{레이어}/{z}/{y}/{x}.{png|jpeg}`, 줌 6~19 (소스에 `minZoom: 6, maxZoom: 19`). 출처 표기 `© VWorld(국토교통부)`.
OpenTopoMap 출처 표기: `© OpenStreetMap contributors, SRTM | map style © OpenTopoMap (CC-BY-SA)`.
모든 소스는 `crossOrigin: 'anonymous'` (지도 내보내기 캔버스 오염 방지 — 기존 회귀 테스트가 지킨다).

## 구조

### `src/core/basemaps.js` (신규)

`MapManager.js` 안의 `BASEMAPS`·`REFERENCE_LABELS` 를 여기로 옮기고 형태를 통일한다.

```js
// 항목 하나의 모양
{ key, label, group: 'korea' | 'world', source: () => TileSource, labels?: () => TileSource }
```

- `labels` 가 있으면 "베이스 + 라벨 오버레이" 항목이다. 지금 `SATELLITE_LABELS` 만 특수처리하던 것을 이 규칙으로 일반화한다 (`VW_HYBRID` 도 같은 규칙).
- `export function getBasemapCatalog()` — 키 유무를 반영한 목록. `VITE_VWORLD_KEY` 가 비어 있으면 `korea` 묶음을 통째로 뺀다 → 키 문제로 지도가 깨지지 않는다.
- `export const DEFAULT_BASEMAP = 'OSM'`.
- `export function vworldTileUrl(layer, ext, key)` — URL 조립(테스트 대상).
- `NONE` 은 카탈로그에 있지만 `group: 'hidden'` 로 두어 팝오버 목록에는 안 나오고 3D 패널에만 나온다.

### `MapManager`

- `baseLayer` / `referenceLayer` 구조는 유지. `setBasemap(key)`:
  - 항목을 카탈로그에서 찾고, 없으면 `console.warn` 후 무시 (기존과 같음)
  - `NONE` 이면 베이스 숨김, 아니면 `baseLayer.setSource(item.source())`
  - `item.labels` 가 있으면 `referenceLayer.setSource(item.labels())` + 표시, 없으면 숨김
- `BasemapControl` 팝오버: 카탈로그를 묶음별로 그린다 — 묶음 제목(`한국 (VWorld)`, `세계`) + 항목 버튼. 강조 규칙은 "현재 ≠ DEFAULT_BASEMAP".
- `getAvailableBasemaps()` 는 카탈로그를 그대로 돌려준다 (3D 패널이 쓴다).

### 3D 패널 (`AppLayout.js` 의 `#view3d-basemap`, `View3DPanel.js`)

고정 4옵션 대신 `getAvailableBasemaps()` 로 `<optgroup>` 두 개 + `없음` 을 채운다. 값은 key. 나머지 동작(`controller.setBasemap(key)`)은 그대로.

### 흐름도 (`FlowPanel.js`)

어두운 배경 토글은 `ESRI_DARK` 유지 (세계 커버·키 불필요). 변경 없음.

### 키

- `VITE_VWORLD_KEY` — 로컬은 `.env.local`, 배포는 Vercel 프로젝트 환경변수(빌드 시 주입). `.env.example` 에 항목 추가.
- 키는 VWorld 쪽에서 도메인(Referer)으로 제한되므로 번들에 들어가도 된다. 사이트의 `Referrer-Policy: strict-origin-when-cross-origin` 은 origin 을 보내므로 검증을 통과한다.
- 서비스 URL 등록: `https://e-gis.kr`, `https://www.e-gis.kr`, `http://localhost:3000`.

### 개인정보 처리방침

제7조 5번(배경지도 타일 제공자)에 VWorld(국토교통부 공간정보오픈플랫폼)·OpenTopoMap 추가, 이전 국가에 대한민국 추가. 버전 1.3.1, 개정 이력 한 줄, PDF 재생성.

### 손대지 않는 것

CSP(`img-src https:` 로 타일 허용됨), 프로젝트 저장 형식(배경지도 키는 저장하지 않는다 — 지금과 같음), 내보내기(`baseLayer` 참조 그대로).

## 테스트

- `basemaps.test.js`: `vworldTileUrl` 조립; 키가 없으면 `korea` 묶음이 빠지고 `world` 는 남는다; 키가 있으면 5+5 항목; `labels` 가 있는 항목은 `VW_HYBRID`·`SATELLITE_LABELS` 뿐; 모든 소스·라벨 소스가 `crossOrigin: 'anonymous'` (기존 `MapManager.test.js` 를 이 파일로 옮긴다).
- `MapManager.setBasemap` 오버레이 규칙: 라벨 있는 항목 → `referenceLayer` 표시, 없는 항목 → 숨김, 모르는 키 → 변화 없음 (jsdom, OL 레이어 객체 실제 사용).
- 팝오버·3D 드롭다운은 헤드리스 렌더로 확인. VWorld 타일은 키 받은 뒤 로컬 육안 확인.
