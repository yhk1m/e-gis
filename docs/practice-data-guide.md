# 실습 데이터 추가 가이드

'데이터 불러오기' → '📂 실습 데이터' 탭에 표시되는 데이터셋을 추가하는 방법입니다.

실습 데이터 탭은 데이터 형태별 여섯 섹션으로 이루어집니다. 섹션의 순서와 이름은
`public/data/builtin/practice_catalog.json`의 그룹 순서를 그대로 따릅니다.

| 섹션 | 실제 폴더 | 등록 방법 |
|---|---|---|
| 📍 Point Data(점) | `practice/Point Data/` | `practice_catalog.json`에 직접 등록 |
| 📏 Line Data(선) | `practice/Line Data/` | `practice_catalog.json`에 직접 등록 |
| 🟩 Area Data(면) | `practice/Area Data/` (행정경계는 `행정경계/` 하위 폴더) | `practice_catalog.json`에 직접 등록 |
| 🏔 Raster Data(래스터) | `raster/` | 파일만 넣고 `npm run catalog` (자동 생성) |
| 🔀 Flow Data(흐름) | `practice/Flow Data/` | `practice_catalog.json`에 직접 등록 (`type: "flow"`, 긴 형식 또는 행렬형 XLSX/CSV) |
| 📊 Attribute Data(속성정보) | `practice/Attribute Data/` | `practice_catalog.json`에 직접 등록 |

## 1. 데이터 파일 넣기

실습용 파일을 `public/data/builtin/practice/<섹션 폴더>/` 에 넣습니다.
섹션 안에서 다시 묶고 싶으면(예: Area Data의 행정경계) 하위 폴더를 만들고
데이터셋에 `folder` 필드를 적습니다.

| 데이터 유형 | 파일 형식 | 동작 |
|---|---|---|
| `spatial` | GeoJSON (`.geojson`) | 클릭 시 벡터 레이어로 추가 |
| `coordinate` | 엑셀 (`.xlsx`) 또는 CSV (`.csv`) | 위도·경도 열로 포인트 레이어 생성 (`latColumn`/`lonColumn` 지정) |
| `flow` | 엑셀 (`.xlsx`) 또는 CSV (`.csv`) | 클릭 시 주제도 › 흐름도 패널이 열리고 표가 채워짐 (출발·도착·양 세 열, 또는 행=전출지·열=전입지 행렬) |
| `attribute` | 엑셀 (`.xlsx`) 또는 CSV (`.csv`) | 클릭 시 미리보기 → 테이블 결합 |

래스터(GeoTIFF)는 `public/data/builtin/raster/` 에 `광역자치단체명 시군구명.tif` 형식으로 넣고
`npm run catalog`를 실행하면 `raster_catalog.json`이 만들어지고 광역자치단체별 폴더로 묶여 표시됩니다.

## 2. 카탈로그에 등록

`public/data/builtin/practice_catalog.json`은 **그룹(섹션) 배열** 안에 각 그룹의 **datasets 배열**이 들어가는 구조입니다.

```json
[
  {
    "id": "point-data",
    "name": "Point Data(점)",
    "icon": "📍",
    "description": "점(포인트) 형태의 실습 데이터",
    "datasets": [
      {
        "id": "school-locations",
        "name": "학교 위치",
        "description": "관내 학교 위경도 목록",
        "type": "coordinate",
        "file": "practice/Point Data/schools.xlsx",
        "latColumn": "위도",
        "lonColumn": "경도",
        "source": "학교알리미"
      }
    ]
  },
  {
    "id": "area-data",
    "name": "Area Data(면)",
    "icon": "🟩",
    "datasets": [
      {
        "id": "korea-sigungu",
        "name": "대한민국 시군구",
        "description": "252개 시군구 경계 (2025)",
        "type": "spatial",
        "folder": "행정경계",
        "file": "practice/Area Data/행정경계/대한민국 시군구.geojson",
        "source": "KOSTAT (통계청)"
      }
    ]
  },
  {
    "id": "raster-data",
    "name": "Raster Data(래스터)",
    "icon": "🏔",
    "type": "raster",
    "description": "광역자치단체별 DEM GeoTIFF"
  },
  {
    "id": "attribute-data",
    "name": "Attribute Data(속성정보)",
    "icon": "📊",
    "datasets": [
      {
        "id": "sido-population-2025",
        "name": "시도별 인구 (2025)",
        "description": "2025년 시도별 주민등록 인구",
        "type": "attribute",
        "file": "practice/Attribute Data/sido_population_2025.xlsx",
        "keyColumn": "행정구역",
        "source": "KOSIS"
      }
    ]
  }
]
```

### 필드 설명

**그룹 (섹션)**
- `id` — 영문 고유 ID
- `name` — 섹션 헤더에 표시되는 이름
- `icon` — (선택) 이름 앞에 붙는 이모지, 없으면 📂
- `description` — (선택) 섹션을 펼쳤을 때 상단에 표시되는 설명
- `type` — `"raster"`를 적으면 `datasets` 대신 `raster_catalog.json`의 래스터 목록이 그 자리에 표시됩니다
- `datasets` — 데이터셋 배열 (비어 있으면 "아직 등록된 데이터가 없습니다" 표시)

**데이터셋**
- `id` — 영문 고유 ID (전체에서 유일해야 함)
- `name` — 표시 이름
- `description` — (선택) 설명
- `type` — `spatial` | `coordinate` | `attribute` | `flow`
- `file` — `public/data/builtin/` 기준 상대 경로 (예: `practice/Area Data/행정경계/대한민국 시군구.geojson`)
- `folder` — (선택) 같은 값끼리 섹션 안에서 접이식 폴더로 묶임 (예: `행정경계`)
- `keyColumn` — (선택, attribute 전용) 테이블 결합 시 기본 선택될 키 컬럼
- `latColumn` / `lonColumn` — (coordinate 전용) 위도·경도가 든 열 이름
- `source` — (선택) 출처 배지로 표시

## 3. 확인

`npm run dev` 후 '데이터 불러오기' → '실습 데이터' 탭에서 확인합니다.
검색창은 이름·설명·폴더명으로 여섯 섹션을 한꺼번에 찾습니다.
`practice_catalog.json`은 `npm run catalog`를 실행해도 덮어쓰이지 않습니다 (래스터 카탈로그만 생성).
