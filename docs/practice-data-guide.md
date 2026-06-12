# 실습 데이터 추가 가이드

'데이터 불러오기' → '🎓 실습 데이터' 탭에 표시되는 데이터셋을 추가하는 방법입니다.

## 1. 데이터 파일 넣기

실습용 파일을 `public/data/builtin/practice/` 폴더에 넣습니다.

| 데이터 유형 | 파일 형식 | 동작 |
|---|---|---|
| `spatial` | GeoJSON (`.geojson`) | 클릭 시 벡터 레이어로 추가 |
| `raster` | GeoTIFF (`.tif`) | 클릭 시 래스터 레이어로 추가 |
| `attribute` | 엑셀 (`.xlsx`) | 클릭 시 미리보기 → 테이블 결합 |

## 2. 카탈로그에 등록

`public/data/builtin/practice_catalog.json`에 실습 유형과 데이터셋을 추가합니다.
**실습 유형(그룹) 배열** 안에 각 유형의 **datasets 배열**이 들어가는 구조입니다.

```json
[
  {
    "id": "population-analysis",
    "name": "인구 분석 실습",
    "description": "시도별 인구 데이터로 단계구분도 만들기",
    "datasets": [
      {
        "id": "sido-population-2025",
        "name": "시도별 인구 (2025)",
        "description": "2025년 시도별 주민등록 인구",
        "type": "attribute",
        "file": "practice/sido_population_2025.xlsx",
        "keyColumn": "행정구역",
        "source": "KOSIS"
      },
      {
        "id": "school-locations",
        "name": "학교 위치",
        "description": "관내 학교 포인트 데이터",
        "type": "spatial",
        "file": "practice/schools.geojson",
        "source": "학교알리미"
      }
    ]
  }
]
```

### 필드 설명

**실습 유형 (그룹)**
- `id` — 영문 고유 ID
- `name` — 탭에 표시되는 실습 이름
- `description` — (선택) 실습 설명, 그룹 펼침 시 상단에 표시
- `datasets` — 데이터셋 배열

**데이터셋**
- `id` — 영문 고유 ID (전체에서 유일해야 함)
- `name` — 표시 이름
- `description` — (선택) 설명
- `type` — `spatial` | `attribute` | `raster`
- `file` — `public/data/builtin/` 기준 상대 경로 (예: `practice/schools.geojson`)
- `keyColumn` — (선택, attribute 전용) 테이블 결합 시 기본 선택될 키 컬럼
- `source` — (선택) 출처 배지로 표시

## 3. 확인

`npm run dev` 후 '데이터 불러오기' → '실습 데이터' 탭에서 확인합니다.
카탈로그 파일은 `npm run catalog` 실행 시에도 덮어쓰이지 않습니다 (`_catalog.json` 파일은 스캔에서 제외됨).
