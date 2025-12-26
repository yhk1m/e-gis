# eGIS - 교육용 GIS 웹 애플리케이션

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## 소개

eGIS는 GIS를 처음 접하는 교사와 학생들을 위한 교육용 GIS 웹 애플리케이션입니다.

> "GIS를 처음 접하는 사람이 두려움 없이 시작하고, 나중에 QGIS로 자연스럽게 넘어갈 수 있게 돕는 징검다리"

## 주요 특징

- 🌐 **제로 설치** - 웹 브라우저만 있으면 어디서든 사용 가능
- 📚 **인터랙티브 튜토리얼** - 단계별 학습 가이드 내장
- 🗺️ **QGIS 유사 인터페이스** - QGIS 전환 시 빠른 적응
- 📱 **태블릿 지원** - 연수 현장에서 활용 가능

## 기술 스택

| 구분 | 기술 |
|------|------|
| 프론트엔드 | HTML, CSS, JavaScript |
| 지도 | OpenLayers |
| 백엔드 | Supabase (PostgreSQL + PostGIS) |
| 분석 | Turf.js, geotiff.js |

## 주요 기능

### 레이어 관리
- SHP, GPKG, GeoJSON, GeoTIFF 업로드
- 레이어 순서 변경 및 스타일 설정

### 벡터 편집
- 점, 선, 면 그리기 및 수정
- 속성 테이블 편집
- 필드 계산기

### 공간 분석
- Buffer, Intersection
- 등시선 분석
- DEM 분석 (경사도, 향, 음영기복, 등고선)

### 시각화
- 단계구분도, 비례원
- 도형표현도 (파이차트, 막대그래프)
- 히트맵

### 내보내기
- 이미지 (PNG, JPG)
- PDF
- GeoJSON, SHP, GPKG

## 시작하기

### 사전 요구사항

- Node.js 18+
- npm 또는 yarn

### 설치

```bash
# 저장소 클론
git clone https://github.com/사용자명/eGIS.git
cd eGIS

# 의존성 설치
npm install

# 개발 서버 실행
npm run dev
```

### 환경 변수 설정

`.env.example`을 `.env`로 복사하고 값을 설정하세요:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

## 문서

- [요구사항 문서](docs/eGIS_Requirements.md)
- [MCP 설정 가이드](docs/MCP_Setup_Guide.md)

## 개발 로드맵

- [ ] **1단계 (MVP)**: 기본 지도, 레이어 관리, 벡터 그리기
- [ ] **2단계**: 공간 분석, 테이블 조인, 필드 계산기
- [ ] **3단계**: DEM 분석, 등시선, 도형표현도

## 라이선스

이 프로젝트는 MIT 라이선스로 배포됩니다. 자세한 내용은 [LICENSE](LICENSE) 파일을 참조하세요.

## 기여

버그 리포트, 기능 제안, PR을 환영합니다!

## 문의

- 개발자: 김용현
- 유튜브: [비그늘](https://youtube.com/@rainshadow21)

