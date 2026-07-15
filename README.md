# e-GIS - 교육용 GIS 웹 애플리케이션

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**🌐 서비스 주소: [e-gis.kr](https://e-gis.kr)**

## 소개

e-GIS는 GIS를 처음 접하는 교사와 학생들을 위한 교육용 GIS 웹 애플리케이션입니다.

> "GIS를 처음 접하는 사람이 두려움 없이 시작하고, 나중에 QGIS로 자연스럽게 넘어갈 수 있게 돕는 징검다리"

## 주요 특징

- 🌐 **제로 설치** - 웹 브라우저만 있으면 어디서든 사용 가능
- 🗺️ **QGIS 유사 인터페이스** - 메뉴바·툴바·레이어 패널·속성 테이블 구조로 QGIS 전환 시 빠른 적응
- 📱 **모바일·태블릿 반응형** - 휴대폰에서도 전 기능 사용 가능 (하단 시트 레이어 패널, 아이콘 메뉴, 접이식 툴바, 전체 화면 속성 테이블)
- ☁️ **클라우드 저장** - Supabase 로그인으로 프로젝트를 저장하고 어디서나 이어서 작업
- 🎨 **다크/라이트 테마** 지원

## 주요 기능

### 📂 데이터 불러오기
- **기본 데이터**: 내장 공간정보(시도/시군구/세계 GeoJSON), 래스터(광역자치단체별 DEM GeoTIFF), 속성정보(XLSX) — 카탈로그 자동 생성(`npm run catalog`)
- **스프레드시트**: 공개된 구글 스프레드시트 링크를 붙여넣어 속성 데이터(테이블 결합) 또는 좌표 데이터(포인트 레이어) 가져오기
- **실습 데이터**: 수업 실습 유형별 데이터셋 카탈로그 (`public/data/builtin/practice_catalog.json`, [가이드](docs/practice-data-guide.md))
- **파일 업로드**: GeoJSON, Shapefile(ZIP), GeoPackage(GPKG), DEM(GeoTIFF/IMG), CSV/XLSX 좌표 데이터 — 드래그 앤 드롭 지원

### 🗂️ 레이어 관리
- 표시/숨김, 드래그로 순서 변경, 이름 변경
- 스타일 편집: 면/선 색상, 불투명도, 선 두께·스타일(실선/파선/점선/일점쇄선), 래스터 불투명도
- 레이어 내보내기 (GeoJSON, SHP 등)

### 📋 속성 테이블
- 정렬, 다중 선택, 셀 편집, 피처 삭제
- 선택 피처 지도 하이라이트·이동
- **CSV 다운로드** (엑셀 한글 호환)
- 테이블 결합 (CSV/XLSX/구글시트의 속성을 키 컬럼으로 레이어에 결합)
- 필드 계산기

### ✏️ 그리기·편집
- 점/선/면, 멀티포인트/멀티라인/멀티폴리곤 그리기
- 피처 합치기(병합), 피처 자르기(선 분할), 선택 피처 삭제
- 이미지 오버레이 업로드 (PNG/JPG/SVG)

### 📐 측정·분석
- **측정**: 거리, 면적
- **벡터 분석**: 단계구분도, 도형표현도(차트맵), 히트맵, 카토그램, 버퍼 분석, 공간 연산, 등시선 분석, 최단경로 분석
- **래스터 분석**: 해발고도(지형음영), 경사도(Slope), 경사방향(Aspect), 래스터 계산기(값 필터), 등고선 생성

### 🖨️ 내보내기
- 지도 이미지(PNG/JPG), PDF 내보내기
- 레이어 데이터 내보내기 (GeoJSON, SHP 등)

### 🧭 지도 도구
- 위치 검색(지오코딩), 좌표계(EPSG) 변경, 축척 직접 입력
- 나침반 회전(0~360° 슬라이더), 현재 위치, 북마크 관리
- 프로젝트 저장/열기/자동 저장, 최근 파일

## 기술 스택

| 구분 | 기술 |
|------|------|
| 빌드/프론트엔드 | Vite 5, Vanilla JavaScript (프레임워크 없음) |
| 지도 | OpenLayers 9, proj4 |
| 백엔드 | Supabase (인증 + PostgreSQL) |
| 공간 분석 | Turf.js, geotiff.js, d3-contour, ngraph (경로 분석) |
| 데이터 파싱 | shpjs, sql.js(GPKG), SheetJS(XLSX), PapaParse(CSV/구글시트) |
| 시각화/내보내기 | Chart.js, D3, html2canvas, jsPDF |

## 시작하기

### 사전 요구사항

- Node.js 18+

### 설치

```bash
# 저장소 클론
git clone https://github.com/yhk1m/e-gis.git
cd e-gis

# 의존성 설치
npm install

# 개발 서버 실행 (http://localhost:3000)
npm run dev

# 프로덕션 빌드 (내장 데이터 카탈로그 생성 포함)
npm run build

# 테스트
npm test
```

> **Windows 한글 경로 참고**
> rollup의 Windows 네이티브 애드온이 경로에 비 ASCII 문자(한글 등)가 있으면
> 번들링 도중 크래시한다(`0xC0000409`, rollup 4.54~4.62 모두 재현).
> `npm run build`는 `scripts/build.cjs`를 거치며, 이 경우 폴더를 빈 드라이브 문자에
> 임시로 `subst` 매핑해 ASCII 경로에서 빌드한 뒤 매핑을 해제한다.
> ASCII 경로나 Linux/macOS(Vercel 포함)에서는 `vite build`를 그대로 실행한다.

### 내장 데이터 추가

```bash
# public/data/builtin/ 에 GeoJSON,
# public/data/builtin/raster/ 에 GeoTIFF,
# public/data/builtin/xlsx/ 에 XLSX 파일을 넣고
npm run catalog
```

### 환경 변수 설정

`.env.example`을 `.env`로 복사하고 값을 설정하세요:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

## 배포

- 프로덕션: [Vercel](https://vercel.com) — `npx vercel deploy --prod`
- 도메인: [e-gis.kr](https://e-gis.kr)

## 문서

- [요구사항 문서](docs/eGIS_Requirements.md)
- [실습 데이터 추가 가이드](docs/practice-data-guide.md)
- [MCP 설정 가이드](docs/MCP_Setup_Guide.md)

## 라이선스

이 프로젝트는 MIT 라이선스로 배포됩니다. 자세한 내용은 [LICENSE](LICENSE) 파일을 참조하세요.

## 기여

버그 리포트, 기능 제안, PR을 환영합니다!

## 문의

- 개발자: 김용현 (양정고등학교)
- 이메일: bgnlkim@gmail.com
- 유튜브: [비그늘](https://youtube.com/@rainshadow21)
- 커뮤니티: [네이버 카페](https://cafe.naver.com/egiskr)
