# Geocoding 안내창 설계

2026-09-14

## 목적

학생이 주소·장소명 목록을 좌표로 바꿔 e-GIS에 올리는 흐름을 메뉴바 버튼 하나로 안내한다.
지오코딩 자체는 e-GIS 안에서 하지 않는다. 선생님이 배포한 구글 시트 지오코딩 도구
(Apps Script `Maps.newGeocoder()`)를 학생이 **각자 사본으로** 쓰는 기존 방식을 그대로 둔다.

### 왜 내장하지 않는가

Apps Script 지오코딩 한도는 스크립트 소유 계정 기준 하루 1,000건(개인 Gmail)이다.
e-GIS가 한 곳에서 호출하면 반 하나(30명 × 30건)로 바닥난다. 학생이 각자 사본을 만들면
한도가 학생 계정마다 따로 잡혀 인원이 늘어도 문제가 없다. 다른 제공처(VWorld·카카오)는
키 등록과 서버 중계가 필요하고, 주소와 장소명이 섞인 입력을 한 곳에서 처리하지 못한다.

## 동작

### 메뉴바 버튼

- 위치: "📂 데이터 불러오기" 오른쪽, GUIDE 링크 왼쪽.
- 라벨 `지오코딩`, 아이콘은 선 SVG 핀(이모지 사용 안 함).
- `data-action="geocoding"` → `main.js` 메뉴 액션에서 `geocodingPanel.show()`.

### 안내창 `GeocodingPanel`

제목: **Geocoding**

| 단계 | 문구 | 버튼 |
|---|---|---|
| ① 시트 사본 만들기 | 구글 계정으로 로그인한 뒤 "사본 만들기"를 누르면 내 드라이브에 복사됩니다. | **사본 만들기 ↗** — 새 탭으로 `https://docs.google.com/spreadsheets/d/{ID}/copy` |
| ② 주소 넣고 좌표 채우기 | `template` 시트 B열에 주소나 장소명을 넣고, C열에 `=GEOCODE(B2)`를 입력하면 위도·경도가 자동으로 채워집니다. 자세한 사용법은 시트 첫 장의 설명서를 보세요. | 없음 |
| ③ e-GIS로 가져오기 | 완성된 시트를 "링크가 있는 모든 사용자"로 공유한 뒤 시트 주소를 붙여 넣으면 포인트 레이어가 됩니다. | **구글 시트 불러오기** — 안내창을 닫고 데이터 불러오기 창을 스프레드시트 탭으로 연다 |

- 시트 ID: `1nW24wsVc_6RKL-rBxlUb5iS24MebZaQtAj4qYdlPmgw` (상수 `GEOCODING_SHEET_ID`).
- 닫기: X 버튼, 바깥 클릭, Esc.
- 외부 링크는 `window.open(url, '_blank', 'noopener')`.

## 코드 변경

| 파일 | 변경 |
|---|---|
| `src/ui/panels/GeocodingPanel.js` | 새 파일. `GEOCODING_SHEET_ID`, `geocodingCopyUrl()`, `GeocodingPanel { show, close }`, 싱글턴 `geocodingPanel` |
| `src/ui/layout/AppLayout.js` | 메뉴바 버튼 마크업 |
| `src/main.js` | `case 'geocoding'` |
| `src/ui/dialogs/BuiltinDataDialog.js` | `show(tab = 'basic')` — 열 때 탭을 고를 수 있게. 기존 호출은 인자 없이 그대로 |
| `src/styles/main.css` | 단계 목록 스타일 소량 |

손대지 않는 것: 백엔드, API 키, 개인정보 처리방침, CSP. 링크 이동뿐이라 새 데이터 흐름이 없다.

## 테스트

- `GeocodingPanel.test.js`: `geocodingCopyUrl()`이 시트 ID로 `/copy` 주소를 만든다; `show()`가 3단계와 두 버튼을 그린다; 사본 버튼이 `window.open`을 `_blank`·`noopener`로 부른다; 불러오기 버튼이 창을 닫고 `builtinDataDialog.show('sheets')`를 부른다.
- `BuiltinDataDialog.show('sheets')`가 스프레드시트 탭을 활성화하는지.
- 화면은 헤드리스 Chrome 렌더로 확인.
