# eStoryMap M2: DEM/래스터 이식 (경로① .egis 임베드 + 경로② 생 GeoTIFF) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `.egis`에 임베드된 래스터(dem/analysis)를 지도에 그리고(경로①), 생 GeoTIFF(.tif)를 Electron `fs`로 읽어 같은 렌더 파이프라인으로 그린다(경로②). e-GIS `DEMLoader`/`RasterAnalysisTool`의 렌더 알맹이를 **탈싱글턴**으로 이식한다.

**Architecture:** 렌더 파이프라인을 순수부 3층(`rasterDecode` 디코딩 → `rasterColor` 색 → `rasterPixels` 픽셀 매핑)과 OL 접착부(`DemRenderer` = ImageLayer+ImageCanvasSource)로 분리한다. 원본 `buildDEMLayer`의 `layerManager`/`mapManager`/범례(DOM)/eventBus 의존은 전부 제거하고 **레이어 생성만** 남긴다. 두 경로는 `buildRasterLayer` 이후 렌더 코드 1벌을 공유한다(상위 스펙 §1c).

**Tech Stack:** 기존 스택(Electron 30 + Vite 5 + Vanilla JS + OL 9 + Vitest/jsdom) + **geotiff `^2.1.0` + proj4 `^2.20.2`** (경로②에서 추가, e-GIS와 동일 버전).

---

## 이 계획의 범위 (중요)

상위 스펙 `eStoryMap-PLAN.md`(repo 루트)의 **M2만** 다룬다. 다음은 **의도적으로 연기(YAGNI)**:

- **범례**(DEMLoader.createLegend / RasterAnalysisTool.createLegend) — e-GIS 에디터 UI. eStoryMap의 페이지 UI(M3+)에서 필요해질 때 별도 설계.
- **recolorFilter**(필터 레이어 색 변경) — 저작 기능, M3+.
- **encodeRasterMeta**(직렬화 쓰기) — eStoryMap은 `.egis`를 읽기만 함. `.esm` 저장은 M6.
- `SourceRegistry`(여러 소스 관리) — M3. M1과 동일하게 "`.egis`/`.tif` 열기 = 전체 교체" 시맨틱 유지(`clearEgisLayers`). `.tif` 레이어도 `egisLayerId`를 받으므로 다음 `.egis`/`.tif` 열기 시 함께 제거된다 — M3에서 소스 단위 관리로 대체될 임시 규칙.
- relief `shadeData`의 TypedArray 재복원 — JSON 왕복 후 숫자 키 객체가 되지만 인덱싱은 동일하게 동작(원본 e-GIS도 동일 상황). 성능 최적화는 필요해질 때.

M2 완료 기준: "**래스터가 든 `.egis`를 열면 DEM·분석 레이어가 보이고, 생 `.tif`를 열면 DEM이 보인다.**"

## 이식 원본과 확정 사실 (실측 완료)

아래는 e-GIS 소스를 직접 읽어 확인한 사실이다(2026-07-02).

1. **`.egis` 래스터 인코딩**(`src/core/ProjectManager.js` `encodeRasterMeta`): 래스터 레이어는
   `{ ...base, rasterKind: 'dem'|'analysis', raster: { ...demData, data: <인코딩된 밴드> } }`.
   밴드 인코딩은 두 형태: `{__encoding:'base64', dtype:'Float32Array'등, base64:'...'}` 또는 `{__encoding:'array', dtype:'Array', values:[...]}`. 복원은 `decodeRasterMeta` — dtype으로 TypedArray 생성자 선택, 미지 dtype은 `Float32Array` 폴백.
2. **demData 형태**(`DEMLoader.createDEMLayer` 산출): `{ data, width, height, extent(EPSG:3857), minVal, maxVal, noDataValue }`.
   **analysisData 형태**(`RasterAnalysisTool.createResultLayer`): `{ data, width, height, extent, noDataValue, colorScheme, ...metadata }` — metadata에 `minVal/maxVal/fillColorRgb/shadeData/metric/min/max` 등이 스킴별로 들어감.
3. **복원 규약**(`ProjectManager.deserialize`): `rasterKind==='dem' && raster` → `demLoader.buildDEMLayer(decodeRasterMeta(raster), name, {doFit:false})`; `'analysis'` → `rasterAnalysisTool.buildAnalysisLayer(...)`; 그 외(`'unknown'`/데이터 없음) → **console.warn 후 스킵**. 이후 `visible:false`와 `opacity`(숫자면 `setOpacity`)를 복원.
4. **buildDEMLayer의 싱글턴 의존**(제거 대상): `layerManager.addLayer/getLayer`, `mapManager.fitExtent`(doFit), `createLegend`(DOM `#map`+`makeDraggable`), `eventBus`. **이식할 알맹이는 OL 레이어 생성부만**: `new ImageLayer({ source: new ImageCanvasSource({ canvasFunction, ratio: 1 }), extent, opacity: 0.8 })` (analysis는 opacity 0.9).
5. **렌더 루프**(`renderDEM`/`renderAnalysisResult` — 사실상 동일 루프): 화면 픽셀 (x,y) → 지도좌표 → 그리드 셀 (gx,gy) 역매핑 후 색 결정. **size는 OL이 부동소수점으로 줄 수 있어 `Math.round` 정수 고정 필수**(Uint8ClampedArray 비정수 인덱스 쓰기 무시 함정 — 원본 주석). 차이는 색 결정뿐:
   - DEM: `(value-minVal)/(maxVal-minVal)` 정규화 → 8스톱 색 램프 보간(`getColorForValue`). 투명 조건: `noDataValue`/NaN/비유한.
   - analysis: 투명 조건에 **`value === -1`(마스크)** 추가. `colorScheme==='filter'` → `fillColorRgb || [227,23,10]` 단색; `'relief'` → elevation 색 × 음영(`shadeData[i]`, `0.35+0.65*clamp(s)`); 그 외 → `getColorForScheme(value, scheme, minVal, maxVal)` (grayscale/elevation/slope/aspect, default 회색).
6. **opacity**: `.egis` 래스터 레이어의 `opacity`에 이미 저장돼 있음(직렬화 시 dem 0.8/analysis 0.9가 기본). M1의 `parseEgisDoc`이 opacity를 정규화(기본 1)하므로 `buildRasterLayer`는 `layerData.opacity`만 적용하면 원본과 일치.
7. **생 GeoTIFF CRS 결정**(`createDEMLayer` 상단부): ① `geoKeys.ProjectedCSTypeGeoKey`(32767=user-defined 제외) → ② `GeographicTypeGeoKey` → ③ `ProjCoordTransGeoKey===1`이면 TM 파라미터로 한국 좌표계 추론(`matchKoreanTM`: 5186 중부/5187 동부/5188 서부/5179 UTM-K, GRS80 장반경 검사) → ④ 그래도 없으면 bbox 값으로 추측(`guessProjection`: 4326/3857/UTM). 3857 정렬: `transformExtent(bbox, sourceProj, 'EPSG:3857')`, 4326 추측 시 수동 웹메르카토르 변환(`toMercator`). **한국 TM 변환에는 proj4 등록 필요** — `CoordinateSystem.js`의 defs를 이식.
8. `noDataValue = image.getGDALNoData() || -9999`. min/max는 노데이터/NaN/비유한 제외 스캔.
9. M1의 `parseEgisDoc.normalizeLayer`는 이미 `rasterKind`/`raster`를 보존한다 — 파서 수정 불필요.

## File Structure

앱 루트: `C:/Users/김용현/Desktop/vibecoding/eGIS/eStoryMap/` (이하 상대경로).

| 파일 | 책임 |
|---|---|
| `src/core/rasterDecode.js` | **순수**: `.egis` 래스터 밴드(base64/array) → TypedArray 복원. |
| `src/core/rasterColor.js` | **순수**: DEM 색 램프 + analysis 색 스킴(hypsometric/hsl/slope/aspect…). |
| `src/core/rasterPixels.js` | **순수**: 그리드→화면 픽셀 RGBA 루프 + dem/analysis별 colorAt 팩토리. |
| `src/core/DemRenderer.js` | **OL 접착**: ImageLayer+ImageCanvasSource 빌드(탈싱글턴), `canBuildRasterLayer` 가드. |
| `src/core/proj.js` | proj4 한국 TM(5179/5186~5188) 등록(부수효과 모듈). |
| `src/core/geotiffParse.js` | **순수**: GeoTIFF 이미지 → demData(CRS 추론·extent 3857 정렬·min/max). |
| `src/core/GeoTiffLoader.js` | 오케스트레이션: ArrayBuffer → 파싱 → 레이어 → 지도 반영. |
| Modify: `src/core/EgisLoader.js` | 래스터 분기 추가(dem/analysis 빌드, unknown 스킵), `rasterCount` 보고. |
| Modify: `src/core/MapView.js` | `unionExtent` 추출 — ImageLayer 명시 extent도 fit 대상에 포함. |
| Modify: `src/main.js` | 상태 문구(벡터·래스터·스킵), `.tif 열기` 배선. |
| Modify: `index.html` | `.tif 열기` 버튼. |
| Modify: `electron/main.js`, `electron/preload.js` | `tif:import` IPC(파일 다이얼로그+ArrayBuffer 반환), `window.egisFS.importTif`. |
| Test: `src/core/{rasterDecode,rasterColor,rasterPixels,DemRenderer,geotiffParse}.test.js` | 신규 단위 테스트. |
| Modify: `src/core/{EgisLoader,MapView}.test.js` | 래스터 배선·unionExtent 테스트 추가. |
| `fixtures/sample_dem.egis` | 스모크용: dem 1 + analysis(slope) 1 + unknown 1. |

핵심 경계: **순수부(rasterDecode/rasterColor/rasterPixels/geotiffParse)** 는 Vitest로 검증, **OL·캔버스 접착부(DemRenderer의 canvasFunction, GeoTiffLoader)** 는 구성만 단위 테스트하고 실제 렌더는 수동 스모크로 검증한다(M0–M1과 동일 원칙 — jsdom에는 2D 캔버스가 없다).

현재 테스트 기준선: **30개**(egisParse 13 · egisLayers 10 · EgisLoader 5 · MapView 2). 완료 시 **75개**.

---

## Task 1: 래스터 밴드 디코딩 (순수, TDD)

**Files:**
- Test: `src/core/rasterDecode.test.js`
- Create: `src/core/rasterDecode.js`

- [ ] **Step 1: 실패하는 테스트 작성** — `src/core/rasterDecode.test.js`

아래 base64는 실제로 `Float32Array([0,100,200,300, 150,250,350,450, 400,500,600,700])`를 인코딩한 값이다(검증 완료).

```js
// © 2026 김용현
import { describe, it, expect } from 'vitest';
import { decodeRasterMeta } from './rasterDecode.js';

// Float32Array [0,100,200,300, 150,250,350,450, 400,500,600,700]
const F32_B64 = 'AAAAAAAAyEIAAEhDAACWQwAAFkMAAHpDAACvQwAA4UMAAMhDAAD6QwAAFkQAAC9E';

describe('decodeRasterMeta', () => {
  it('base64 인코딩을 dtype에 맞는 TypedArray로 복원한다', () => {
    const out = decodeRasterMeta({
      data: { __encoding: 'base64', dtype: 'Float32Array', base64: F32_B64 },
      width: 4, height: 3,
    });
    expect(out.data).toBeInstanceOf(Float32Array);
    expect(Array.from(out.data)).toEqual([0, 100, 200, 300, 150, 250, 350, 450, 400, 500, 600, 700]);
  });

  it('Int16Array 등 다른 dtype도 복원한다', () => {
    // Int16Array [1, 2, 3]
    const out = decodeRasterMeta({ data: { __encoding: 'base64', dtype: 'Int16Array', base64: 'AQACAAMA' } });
    expect(out.data).toBeInstanceOf(Int16Array);
    expect(Array.from(out.data)).toEqual([1, 2, 3]);
  });

  it('알 수 없는 dtype은 Float32Array로 폴백한다', () => {
    const out = decodeRasterMeta({ data: { __encoding: 'base64', dtype: 'WeirdArray', base64: F32_B64 } });
    expect(out.data).toBeInstanceOf(Float32Array);
  });

  it("__encoding 'array'는 values 배열을 그대로 쓴다", () => {
    const out = decodeRasterMeta({ data: { __encoding: 'array', dtype: 'Array', values: [1, 2, 3] } });
    expect(out.data).toEqual([1, 2, 3]);
  });

  it('메타필드는 보존하고 원본 객체는 변경하지 않는다', () => {
    const encoded = {
      data: { __encoding: 'array', values: [1] },
      extent: [0, 0, 1, 1], colorScheme: 'slope', minVal: 0,
    };
    const out = decodeRasterMeta(encoded);
    expect(out.extent).toEqual([0, 0, 1, 1]);
    expect(out.colorScheme).toBe('slope');
    expect(encoded.data.__encoding).toBe('array'); // 원본 불변
    expect(out).not.toBe(encoded);
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run src/core/rasterDecode.test.js`
Expected: FAIL — `rasterDecode.js` 모듈 없음.

- [ ] **Step 3: 최소 구현** — `src/core/rasterDecode.js`

```js
// © 2026 김용현
// eStoryMap/src/core/rasterDecode.js
// .egis 래스터 밴드(base64/array) → TypedArray 복원 — 순수 함수.
// 이식 원본: e-GIS src/core/ProjectManager.js decodeRasterMeta.

const TYPED_ARRAY_CTORS = {
  Int8Array, Uint8Array, Uint8ClampedArray,
  Int16Array, Uint16Array, Int32Array, Uint32Array,
  Float32Array, Float64Array,
};

/**
 * encodeRasterMeta로 직렬화된 래스터 객체를 demData/analysisData 형태로 복원한다.
 * data에 __encoding이 없으면(이미 디코딩된 경우) 그대로 둔다.
 * @param {object} encoded - .egis 레이어의 raster 객체
 * @returns {object} data가 TypedArray/배열로 복원된 얕은 복사본
 */
export function decodeRasterMeta(encoded) {
  const result = { ...encoded };
  const d = encoded.data;

  if (d && d.__encoding === 'base64') {
    const binary = atob(d.base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    const Ctor = TYPED_ARRAY_CTORS[d.dtype] || Float32Array;
    result.data = new Ctor(bytes.buffer);
  } else if (d && d.__encoding === 'array') {
    result.data = d.values;
  }

  return result;
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run src/core/rasterDecode.test.js`
Expected: PASS (5 tests).

- [ ] **Step 5: 커밋**

```bash
git add eStoryMap/src/core/rasterDecode.js eStoryMap/src/core/rasterDecode.test.js
git commit -m "feat(eStoryMap): M2 .egis 래스터 밴드 디코드 rasterDecode(순수)"
```

---

## Task 2: 래스터 색상 (순수, TDD)

**Files:**
- Test: `src/core/rasterColor.test.js`
- Create: `src/core/rasterColor.js`

- [ ] **Step 1: 실패하는 테스트 작성** — `src/core/rasterColor.test.js`

```js
// © 2026 김용현
import { describe, it, expect } from 'vitest';
import { demColor, hypsometricColor, hslToRgb, getColorForScheme } from './rasterColor.js';

describe('demColor (DEM 8스톱 램프)', () => {
  it('0은 램프 시작(진녹)', () => {
    expect(demColor(0)).toEqual([0, 97, 71]);
  });
  it('1은 흰색(고산)', () => {
    expect(demColor(1)).toEqual([255, 255, 255]);
  });
  it('스톱 사이는 선형 보간(0.075 = 0~0.15의 중점)', () => {
    expect(demColor(0.075)).toEqual([17, 118, 53]);
  });
  it('범위 밖은 양끝으로 클램프', () => {
    expect(demColor(-0.5)).toEqual([0, 97, 71]);
    expect(demColor(1.5)).toEqual([255, 255, 255]);
  });
});

describe('hypsometricColor', () => {
  it('정지점 색을 그대로 반환한다(0/0.5/1)', () => {
    expect(hypsometricColor(0)).toEqual([38, 115, 0]);
    expect(hypsometricColor(0.5)).toEqual([240, 220, 130]);
    expect(hypsometricColor(1)).toEqual([245, 245, 245]);
  });
});

describe('hslToRgb', () => {
  it('h=0, s=70, l=50 → 빨강 계열', () => {
    expect(hslToRgb(0, 70, 50)).toEqual([217, 38, 38]);
  });
});

describe('getColorForScheme', () => {
  it('grayscale은 값 그대로 회색조', () => {
    expect(getColorForScheme(128, 'grayscale')).toEqual([128, 128, 128]);
  });
  it('elevation은 min~max 정규화 후 hypsometric', () => {
    expect(getColorForScheme(0, 'elevation', 0, 100)).toEqual([38, 115, 0]);
    expect(getColorForScheme(100, 'elevation', 0, 100)).toEqual([245, 245, 245]);
  });
  it('slope 최소값은 녹색 [0,128,0]', () => {
    expect(getColorForScheme(0, 'slope', 0, 45)).toEqual([0, 128, 0]);
  });
  it('aspect는 방위각 → HSL 색', () => {
    expect(getColorForScheme(90, 'aspect')).toEqual([128, 217, 38]);
  });
  it('알 수 없는 스킴은 회색', () => {
    expect(getColorForScheme(10, 'nope')).toEqual([128, 128, 128]);
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run src/core/rasterColor.test.js`
Expected: FAIL — `rasterColor.js` 없음.

- [ ] **Step 3: 최소 구현** — `src/core/rasterColor.js`

```js
// © 2026 김용현
// eStoryMap/src/core/rasterColor.js
// 래스터 색상 — 순수 함수. 이식 원본: e-GIS src/loaders/DEMLoader.js
// (DEFAULT_COLOR_RAMP, getColorForValue) + src/tools/RasterAnalysisTool.js
// (getColorForScheme, hypsometricColor, hslToRgb).

/** DEM 고도 램프 (저지대 진녹 → 고산 흰색). e-GIS DEFAULT_COLOR_RAMP. */
export const DEM_COLOR_RAMP = [
  { value: 0, color: [0, 97, 71] },
  { value: 0.15, color: [34, 139, 34] },
  { value: 0.3, color: [154, 205, 50] },
  { value: 0.45, color: [255, 255, 0] },
  { value: 0.6, color: [255, 165, 0] },
  { value: 0.75, color: [255, 69, 0] },
  { value: 0.9, color: [139, 69, 19] },
  { value: 1.0, color: [255, 255, 255] },
];

/** 정규화값(0~1) → 램프 선형 보간 색. e-GIS DEMLoader.getColorForValue 이식. */
export function rampColor(ramp, normalized) {
  for (let i = 0; i < ramp.length - 1; i++) {
    if (normalized >= ramp[i].value && normalized <= ramp[i + 1].value) {
      const ratio = (normalized - ramp[i].value) / (ramp[i + 1].value - ramp[i].value);
      const c1 = ramp[i].color;
      const c2 = ramp[i + 1].color;
      return [
        Math.round(c1[0] + (c2[0] - c1[0]) * ratio),
        Math.round(c1[1] + (c2[1] - c1[1]) * ratio),
        Math.round(c1[2] + (c2[2] - c1[2]) * ratio),
      ];
    }
  }
  if (normalized <= 0) return ramp[0].color;
  return ramp[ramp.length - 1].color;
}

export function demColor(normalized) {
  return rampColor(DEM_COLOR_RAMP, normalized);
}

/** 해발고도(hypsometric) 색 — t(0~1). e-GIS RasterAnalysisTool 이식. */
export function hypsometricColor(t) {
  const stops = [
    [0.0, [38, 115, 0]],
    [0.25, [128, 180, 60]],
    [0.5, [240, 220, 130]],
    [0.75, [160, 110, 60]],
    [1.0, [245, 245, 245]],
  ];
  for (let i = 0; i < stops.length - 1; i++) {
    const [t0, c0] = stops[i];
    const [t1, c1] = stops[i + 1];
    if (t <= t1) {
      const f = (t1 - t0) === 0 ? 0 : (t - t0) / (t1 - t0);
      return [
        Math.round(c0[0] + (c1[0] - c0[0]) * f),
        Math.round(c0[1] + (c1[1] - c0[1]) * f),
        Math.round(c0[2] + (c1[2] - c0[2]) * f),
      ];
    }
  }
  return stops[stops.length - 1][1];
}

/** HSL → RGB. e-GIS RasterAnalysisTool 이식. */
export function hslToRgb(h, s, l) {
  s /= 100;
  l /= 100;
  const k = (n) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [Math.round(255 * f(0)), Math.round(255 * f(8)), Math.round(255 * f(4))];
}

/** analysis colorScheme별 색. e-GIS RasterAnalysisTool.getColorForScheme 이식. */
export function getColorForScheme(value, scheme, minVal = 0, maxVal = 255) {
  switch (scheme) {
    case 'grayscale': {
      const gray = Math.round(value);
      return [gray, gray, gray];
    }
    case 'elevation': {
      const range = (maxVal - minVal) || 1;
      let t = (value - minVal) / range;
      t = Math.max(0, Math.min(1, t));
      return hypsometricColor(t);
    }
    case 'slope': {
      // 녹색(완만) → 노랑 → 빨강(급경사)
      const normalized = (value - minVal) / (maxVal - minVal);
      if (normalized < 0.33) {
        const t = normalized / 0.33;
        return [Math.round(t * 255), Math.round(128 + t * 127), 0];
      }
      if (normalized < 0.66) {
        const t = (normalized - 0.33) / 0.33;
        return [255, Math.round(255 - t * 128), 0];
      }
      const t = (normalized - 0.66) / 0.34;
      return [Math.round(255 - t * 128), Math.round(127 - t * 127), 0];
    }
    case 'aspect': {
      const hue = (value / 360) * 360;
      return hslToRgb(hue, 70, 50);
    }
    default:
      return [128, 128, 128];
  }
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run src/core/rasterColor.test.js`
Expected: PASS (11 tests).

- [ ] **Step 5: 커밋**

```bash
git add eStoryMap/src/core/rasterColor.js eStoryMap/src/core/rasterColor.test.js
git commit -m "feat(eStoryMap): M2 래스터 색상 rasterColor — DEM 램프+analysis 스킴(순수)"
```

---

## Task 3: 픽셀 매핑 루프 (순수, TDD)

**Files:**
- Test: `src/core/rasterPixels.test.js`
- Create: `src/core/rasterPixels.js`

- [ ] **Step 1: 실패하는 테스트 작성** — `src/core/rasterPixels.test.js`

```js
// © 2026 김용현
import { describe, it, expect } from 'vitest';
import { computeRasterPixels, demColorAt, analysisColorAt } from './rasterPixels.js';
import { DEM_COLOR_RAMP } from './rasterColor.js';

// 2×2 그리드: [10, 20 / 30, 40], extent [0,0,2,2] (윗행이 북쪽)
const GRID = {
  data: new Float32Array([10, 20, 30, 40]),
  width: 2, height: 2,
  extent: [0, 0, 2, 2],
};

describe('computeRasterPixels', () => {
  it('view=extent, size=그리드 크기면 각 픽셀이 해당 셀 값으로 칠해진다', () => {
    const pixels = computeRasterPixels(GRID, [0, 0, 2, 2], [2, 2], (v) => [v, 0, 0]);
    // 픽셀 (0,0) = 북서 셀 = data[0] = 10
    expect(pixels[0]).toBe(10);
    expect(pixels[3]).toBe(255); // alpha
    // 픽셀 (1,1) = 남동 셀 = data[3] = 40
    const p = (1 * 2 + 1) * 4;
    expect(pixels[p]).toBe(40);
    expect(pixels[p + 3]).toBe(255);
  });

  it('colorAt이 null을 반환하면 투명 픽셀', () => {
    const pixels = computeRasterPixels(GRID, [0, 0, 2, 2], [2, 2],
      (v) => (v === 10 ? null : [1, 2, 3]));
    expect(pixels[3]).toBe(0);        // (0,0) 투명
    expect(pixels[7]).toBe(255);      // (1,0) 칠해짐
  });

  it('그리드 범위 밖 화면 영역은 투명', () => {
    // view가 그리드보다 넓음: 픽셀 (0,0)은 그리드 왼쪽 밖
    const pixels = computeRasterPixels(GRID, [-2, -2, 2, 2], [2, 2], () => [9, 9, 9]);
    expect(pixels[3]).toBe(0);        // (0,0) 밖 → 투명
    expect(pixels[7]).toBe(255);      // (1,0)은 그리드 안(북서 셀)
  });
});

describe('demColorAt', () => {
  const dem = { minVal: 0, maxVal: 700, noDataValue: -9999 };
  it('min→램프 시작색, max→흰색', () => {
    const colorAt = demColorAt(dem);
    expect(colorAt(0)).toEqual(DEM_COLOR_RAMP[0].color);
    expect(colorAt(700)).toEqual([255, 255, 255]);
  });
  it('노데이터/NaN/비유한은 null(투명)', () => {
    const colorAt = demColorAt(dem);
    expect(colorAt(-9999)).toBeNull();
    expect(colorAt(NaN)).toBeNull();
    expect(colorAt(Infinity)).toBeNull();
  });
});

describe('analysisColorAt', () => {
  it('filter 스킴은 fillColorRgb 단색(없으면 기본 빨강)', () => {
    expect(analysisColorAt({ colorScheme: 'filter', noDataValue: -9999, fillColorRgb: [1, 2, 3] })(5, 0))
      .toEqual([1, 2, 3]);
    expect(analysisColorAt({ colorScheme: 'filter', noDataValue: -9999 })(5, 0))
      .toEqual([227, 23, 10]);
  });
  it('value === -1은 마스크(투명)', () => {
    const colorAt = analysisColorAt({ colorScheme: 'slope', noDataValue: -9999, minVal: 0, maxVal: 45 });
    expect(colorAt(-1, 0)).toBeNull();
  });
  it('relief는 elevation 색에 음영을 곱한다(shade=1이면 그대로)', () => {
    const colorAt = analysisColorAt({
      colorScheme: 'relief', noDataValue: -9999, minVal: 0, maxVal: 100,
      shadeData: [1, 0],
    });
    expect(colorAt(0, 0)).toEqual([38, 115, 0]);       // shade 1 → 원색
    expect(colorAt(0, 1)).toEqual([13, 40, 0]);        // shade 0 → ×0.35
  });
  it('일반 스킴은 getColorForScheme에 위임(slope 0 → 녹색)', () => {
    const colorAt = analysisColorAt({ colorScheme: 'slope', noDataValue: -9999, minVal: 0, maxVal: 45 });
    expect(colorAt(0, 0)).toEqual([0, 128, 0]);
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run src/core/rasterPixels.test.js`
Expected: FAIL — `rasterPixels.js` 없음.

- [ ] **Step 3: 최소 구현** — `src/core/rasterPixels.js`

```js
// © 2026 김용현
// eStoryMap/src/core/rasterPixels.js
// 래스터 그리드 → 화면 픽셀(RGBA) 매핑 — 순수 함수. 캔버스/OL 의존 없음.
// 이식 원본: e-GIS DEMLoader.renderDEM + RasterAnalysisTool.renderAnalysisResult의
// 공통 루프를 하나로 통합하고, 색 결정만 colorAt 콜백으로 분리.
import { demColor, getColorForScheme } from './rasterColor.js';

/**
 * @param {{data:ArrayLike<number>, width:number, height:number, extent:number[]}} grid
 * @param {number[]} viewExtent - 렌더 대상 화면 범위(EPSG:3857)
 * @param {number[]} size - [w, h] 정수 픽셀 크기
 * @param {(value:number, dataIndex:number) => (number[]|null)} colorAt - null이면 투명
 * @returns {Uint8ClampedArray} RGBA (w*h*4)
 */
export function computeRasterPixels(grid, viewExtent, size, colorAt) {
  const [w, h] = size;
  const { data, width, height, extent } = grid;
  const pixels = new Uint8ClampedArray(w * h * 4); // 기본 0 = 투명

  const gridW = extent[2] - extent[0];
  const gridH = extent[3] - extent[1];
  const viewW = viewExtent[2] - viewExtent[0];
  const viewH = viewExtent[3] - viewExtent[1];

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const mapX = viewExtent[0] + (x / w) * viewW;
      const mapY = viewExtent[3] - (y / h) * viewH;
      const gx = Math.floor(((mapX - extent[0]) / gridW) * width);
      const gy = Math.floor(((extent[3] - mapY) / gridH) * height);
      if (gx < 0 || gx >= width || gy < 0 || gy >= height) continue;

      const dataIndex = gy * width + gx;
      const color = colorAt(data[dataIndex], dataIndex);
      if (!color) continue;

      const p = (y * w + x) * 4;
      pixels[p] = color[0];
      pixels[p + 1] = color[1];
      pixels[p + 2] = color[2];
      pixels[p + 3] = 255;
    }
  }
  return pixels;
}

/** DEM용 colorAt: min~max 정규화 후 고도 램프. (원본 renderDEM의 색 결정부) */
export function demColorAt(demData) {
  const { minVal, maxVal, noDataValue } = demData;
  const range = (maxVal - minVal) || 1;
  return (value) => {
    if (value === noDataValue || Number.isNaN(value) || !Number.isFinite(value)) return null;
    return demColor((value - minVal) / range);
  };
}

/** analysis용 colorAt: colorScheme별 분기. (원본 renderAnalysisResult의 색 결정부) */
export function analysisColorAt(analysisData) {
  const { noDataValue, colorScheme, minVal, maxVal } = analysisData;
  return (value, dataIndex) => {
    // value === -1은 analysis 결과의 마스크 값 (원본과 동일)
    if (value === noDataValue || Number.isNaN(value) || !Number.isFinite(value) || value === -1) {
      return null;
    }
    if (colorScheme === 'filter') {
      return analysisData.fillColorRgb || [227, 23, 10];
    }
    if (colorScheme === 'relief') {
      // 고도색 × 음영. shadeData는 JSON 왕복 후 TypedArray가 아닌
      // 숫자 키 객체일 수 있으나 인덱싱은 동일하게 동작(원본도 동일 상황).
      const base = getColorForScheme(value, 'elevation', minVal, maxVal);
      let s = analysisData.shadeData ? analysisData.shadeData[dataIndex] : 1;
      if (!Number.isFinite(s)) s = 1;
      const shade = 0.35 + 0.65 * Math.max(0, Math.min(1, s));
      return [
        Math.round(base[0] * shade),
        Math.round(base[1] * shade),
        Math.round(base[2] * shade),
      ];
    }
    return getColorForScheme(value, colorScheme, minVal, maxVal);
  };
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run src/core/rasterPixels.test.js`
Expected: PASS (9 tests).

- [ ] **Step 5: 커밋**

```bash
git add eStoryMap/src/core/rasterPixels.js eStoryMap/src/core/rasterPixels.test.js
git commit -m "feat(eStoryMap): M2 픽셀 매핑 rasterPixels — 공유 루프+dem/analysis colorAt(순수)"
```

---

## Task 4: DemRenderer — OL 래스터 레이어 빌드 (탈싱글턴)

**Files:**
- Test: `src/core/DemRenderer.test.js`
- Create: `src/core/DemRenderer.js`

> `canvasFunction` 내부(캔버스 생성·putImageData)는 jsdom에 2D 컨텍스트가 없어 단위 테스트 불가 — 픽셀 계산은 Task 3에서 이미 커버됐고, 캔버스 접착은 Task 6 스모크로 검증. 여기서는 **레이어 구성(메타·visible·opacity·extent)** 과 `canBuildRasterLayer` 가드만 테스트한다.

- [ ] **Step 1: 실패하는 테스트 작성** — `src/core/DemRenderer.test.js`

```js
// © 2026 김용현
import { describe, it, expect } from 'vitest';
import { buildRasterLayer, canBuildRasterLayer } from './DemRenderer.js';

const DEM_LAYER_DATA = {
  id: 'L_dem', name: '고도', type: 'raster', rasterKind: 'dem',
  visible: false, color: '#3b82f6', opacity: 0.8, features: null,
  raster: {
    data: new Float32Array([0, 100, 200, 700]),
    width: 2, height: 2,
    extent: [0, 0, 100, 100],
    minVal: 0, maxVal: 700, noDataValue: -9999,
  },
};

describe('buildRasterLayer', () => {
  it('dem 래스터 → ImageLayer(메타·visible·opacity·extent 반영)', () => {
    const layer = buildRasterLayer(DEM_LAYER_DATA);
    expect(layer.get('egisLayerId')).toBe('L_dem');
    expect(layer.get('egisLayerName')).toBe('고도');
    expect(layer.getVisible()).toBe(false);
    expect(layer.getOpacity()).toBe(0.8);
    expect(layer.getExtent()).toEqual([0, 0, 100, 100]);
    expect(layer.getSource()).toBeTruthy();
  });

  it('analysis 래스터도 빌드된다', () => {
    const layer = buildRasterLayer({
      ...DEM_LAYER_DATA, id: 'L_sl', rasterKind: 'analysis', visible: true, opacity: 0.9,
      raster: { ...DEM_LAYER_DATA.raster, colorScheme: 'slope', minVal: 0, maxVal: 45 },
    });
    expect(layer.get('egisLayerId')).toBe('L_sl');
    expect(layer.getOpacity()).toBe(0.9);
  });
});

describe('canBuildRasterLayer', () => {
  it('dem/analysis + 완전한 raster만 true', () => {
    expect(canBuildRasterLayer(DEM_LAYER_DATA)).toBe(true);
    expect(canBuildRasterLayer({ ...DEM_LAYER_DATA, rasterKind: 'unknown' })).toBe(false);
    expect(canBuildRasterLayer({ ...DEM_LAYER_DATA, raster: {} })).toBe(false);
    expect(canBuildRasterLayer({ ...DEM_LAYER_DATA, raster: null })).toBe(false);
    expect(canBuildRasterLayer({ type: 'vector' })).toBe(false);
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run src/core/DemRenderer.test.js`
Expected: FAIL — `DemRenderer.js` 없음.

- [ ] **Step 3: 최소 구현** — `src/core/DemRenderer.js`

```js
// © 2026 김용현
// eStoryMap/src/core/DemRenderer.js
// .egis 래스터(dem/analysis) → OL ImageLayer(ImageCanvasSource).
// 이식 원본: e-GIS DEMLoader.buildDEMLayer + RasterAnalysisTool.buildAnalysisLayer.
// 원본의 layerManager/mapManager/범례(DOM)/eventBus 의존은 제거 — 레이어 생성만(탈싱글턴).
import ImageLayer from 'ol/layer/Image';
import ImageCanvasSource from 'ol/source/ImageCanvas';
import { decodeRasterMeta } from './rasterDecode.js';
import { computeRasterPixels, demColorAt, analysisColorAt } from './rasterPixels.js';

/** 정규화된 레이어가 복원 가능한 래스터인지. (unknown/데이터 결손은 e-GIS처럼 스킵) */
export function canBuildRasterLayer(layerData) {
  if (!layerData || layerData.type !== 'raster') return false;
  if (layerData.rasterKind !== 'dem' && layerData.rasterKind !== 'analysis') return false;
  const r = layerData.raster;
  return !!(r && r.data && r.width > 0 && r.height > 0
    && Array.isArray(r.extent) && r.extent.length === 4);
}

/** 픽셀 계산(순수) 결과를 캔버스로 옮기는 접착부. */
function renderToCanvas(raster, colorAt, viewExtent, size) {
  // size는 OL이 부동소수점으로 전달할 수 있음 → 정수 고정 (원본 renderDEM 주의사항)
  const w = Math.round(size[0]);
  const h = Math.round(size[1]);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  const pixels = computeRasterPixels(raster, viewExtent, [w, h], colorAt);
  ctx.putImageData(new ImageData(pixels, w, h), 0, 0);
  return canvas;
}

/**
 * 정규화된 래스터 레이어 데이터(egisParse 산출) → OL ImageLayer.
 * raster.data가 이미 TypedArray면(생 .tif 경로) decodeRasterMeta는 그대로 통과시킨다.
 */
export function buildRasterLayer(layerData) {
  const raster = decodeRasterMeta(layerData.raster);
  const colorAt = layerData.rasterKind === 'dem'
    ? demColorAt(raster)
    : analysisColorAt(raster);
  const layer = new ImageLayer({
    source: new ImageCanvasSource({
      canvasFunction: (viewExtent, resolution, pixelRatio, size) =>
        renderToCanvas(raster, colorAt, viewExtent, size),
      ratio: 1,
    }),
    extent: raster.extent,
    visible: layerData.visible,
    opacity: layerData.opacity,
  });
  layer.set('egisLayerId', layerData.id);
  layer.set('egisLayerName', layerData.name);
  return layer;
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run src/core/DemRenderer.test.js`
Expected: PASS (3 tests).

- [ ] **Step 5: 커밋**

```bash
git add eStoryMap/src/core/DemRenderer.js eStoryMap/src/core/DemRenderer.test.js
git commit -m "feat(eStoryMap): M2 DemRenderer — ImageCanvas 래스터 레이어 빌드(탈싱글턴)"
```

---

## Task 5: MapView fit이 래스터 extent도 포함하도록 확장

**Files:**
- Modify: `src/core/MapView.test.js`
- Modify: `src/core/MapView.js`

ImageLayer는 벡터와 달리 소스가 아닌 **레이어에 명시 extent**를 가진다. `fitToLayers`의 합집합 계산을 `unionExtent`로 추출해 둘 다 지원한다.

- [ ] **Step 1: 실패하는 테스트 추가** — `src/core/MapView.test.js`

파일 상단 import를 아래로 교체:

```js
// © 2026 김용현
import { describe, it, expect } from 'vitest';
import { MapView, unionExtent } from './MapView.js';
import { buildVectorLayer } from './egisLayers.js';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import ImageLayer from 'ol/layer/Image';
import Feature from 'ol/Feature';
import Point from 'ol/geom/Point';
import { isEmpty } from 'ol/extent';
```

파일 끝에 describe 추가:

```js
describe('unionExtent', () => {
  it('벡터 소스 extent와 ImageLayer 명시 extent를 합친다', () => {
    const vec = new VectorLayer({
      source: new VectorSource({ features: [new Feature(new Point([10, 20]))] }),
    });
    const img = new ImageLayer({ extent: [0, 0, 5, 5] });
    expect(unionExtent([vec, img])).toEqual([0, 0, 10, 20]);
  });

  it('빈 배열이면 empty extent', () => {
    expect(isEmpty(unionExtent([]))).toBe(true);
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run src/core/MapView.test.js`
Expected: FAIL — `unionExtent` export 없음. (기존 2 tests는 PASS)

- [ ] **Step 3: 구현** — `src/core/MapView.js`의 `fitToLayers`를 아래로 교체하고, 클래스 밖에 `unionExtent`를 추가:

```js
/** 레이어들의 범위 합집합. ImageLayer는 명시 extent, 벡터는 소스 extent 사용. */
export function unionExtent(olLayers) {
  const ext = createEmpty();
  for (const l of olLayers) {
    const layerExt = typeof l.getExtent === 'function' ? l.getExtent() : null;
    if (layerExt) {
      extend(ext, layerExt);
      continue;
    }
    const src = l.getSource && l.getSource();
    if (src && src.getExtent) extend(ext, src.getExtent());
  }
  return ext;
}
```

클래스 내부 `fitToLayers`:

```js
  /** 주어진 OL 레이어들(벡터·래스터)의 합집합 범위로 맞춤. */
  fitToLayers(olLayers) {
    const ext = unionExtent(olLayers);
    if (!isEmpty(ext) && Number.isFinite(ext[0])) {
      // maxZoom 가드: 포인트 하나뿐인 extent(면적 0)에서 maxZoom(19)까지 박히는 것 방지.
      this.map.getView().fit(ext, { padding: [40, 40, 40, 40], duration: 300, maxZoom: 16 });
    }
  }
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run src/core/MapView.test.js`
Expected: PASS (4 tests).

- [ ] **Step 5: 커밋**

```bash
git add eStoryMap/src/core/MapView.js eStoryMap/src/core/MapView.test.js
git commit -m "feat(eStoryMap): M2 MapView unionExtent — 래스터 extent 포함 fit"
```

---

## Task 6: 경로① — EgisLoader 래스터 배선 + 픽스처 + 스모크

**Files:**
- Modify: `src/core/EgisLoader.test.js`
- Modify: `src/core/EgisLoader.js`
- Modify: `src/main.js` (상태 문구)
- Create: `fixtures/sample_dem.egis`

- [ ] **Step 1: 실패하는 테스트 추가** — `src/core/EgisLoader.test.js`

기존 테스트 `'벡터가 아닌 레이어는 스킵하고 개수를 보고한다'`의 **이름만** `'복원 불가 래스터는 스킵하고 개수를 보고한다'`로 바꾼다(내용 유지 — `raster: {}`는 데이터 결손이라 여전히 스킵됨). 그리고 파일 끝(describe 안)에 추가:

```js
  const DEM_RASTER = {
    id: 'L_dem', name: '고도', type: 'raster', rasterKind: 'dem',
    visible: true, opacity: 0.8,
    raster: {
      data: {
        __encoding: 'base64', dtype: 'Float32Array',
        base64: 'AAAAAAAAyEIAAEhDAACWQwAAFkMAAHpDAACvQwAA4UMAAMhDAAD6QwAAFkQAAC9E',
      },
      width: 4, height: 3, extent: [0, 0, 400, 300],
      minVal: 0, maxVal: 700, noDataValue: -9999,
    },
  };

  it('dem 래스터를 ImageLayer로 로드하고 rasterCount로 보고한다', () => {
    const mv = fakeMapView();
    const result = loadEgisIntoMap({
      version: '1.0', view: { center: [129.0, 35.1], zoom: 8 }, layers: [DEM_RASTER],
    }, mv);
    expect(result.rasterCount).toBe(1);
    expect(result.skipped).toBe(0);
    expect(mv.called('addLayer')).toHaveLength(1);
    expect(mv.called('addLayer')[0][1].get('egisLayerId')).toBe('L_dem');
  });

  it('rasterKind unknown은 스킵한다', () => {
    const mv = fakeMapView();
    const result = loadEgisIntoMap({
      version: '1.0', view: { center: [129.0, 35.1], zoom: 8 },
      layers: [{ id: 'L_u', name: '미상', type: 'raster', rasterKind: 'unknown' }],
    }, mv);
    expect(result.rasterCount).toBe(0);
    expect(result.skipped).toBe(1);
    expect(mv.called('addLayer')).toHaveLength(0);
  });

  it('view가 없으면 래스터도 fit 폴백 대상에 포함된다', () => {
    const mv = fakeMapView();
    const result = loadEgisIntoMap({ version: '1.0', layers: [DEM_RASTER] }, mv);
    expect(mv.called('setView')).toHaveLength(0);
    expect(mv.called('fitToLayers')).toHaveLength(1);
    expect(mv.called('fitToLayers')[0][1]).toEqual(result.layers);
  });
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run src/core/EgisLoader.test.js`
Expected: FAIL — 새 3개 실패(`rasterCount` undefined, 래스터가 스킵됨). 기존 5개는 PASS.

- [ ] **Step 3: 구현** — `src/core/EgisLoader.js`의 `loadEgisIntoMap`을 아래로 교체:

```js
// © 2026 김용현
// eStoryMap/src/core/EgisLoader.js
// .egis 원본 JSON → 지도에 벡터·래스터 레이어 반영.
import { parseEgisDoc } from './egisParse.js';
import { buildVectorLayer } from './egisLayers.js';
import { buildRasterLayer, canBuildRasterLayer } from './DemRenderer.js';

/**
 * @param {object} rawJson - JSON.parse된 .egis
 * @param {import('./MapView.js').MapView} mapView
 * @returns {{name:string, vectorCount:number, rasterCount:number, skipped:number, layers:object[]}}
 */
export function loadEgisIntoMap(rawJson, mapView) {
  const doc = parseEgisDoc(rawJson);
  mapView.clearEgisLayers(); // 재로드 시 이전 레이어 누적 방지

  const olLayers = [];
  let vectorCount = 0;
  let rasterCount = 0;
  let skipped = 0;

  for (const layerData of doc.layers) {
    let olLayer;
    if (layerData.type === 'vector') {
      olLayer = buildVectorLayer(layerData);
      vectorCount++;
    } else if (canBuildRasterLayer(layerData)) {
      olLayer = buildRasterLayer(layerData);
      rasterCount++;
    } else {
      skipped++; // rasterKind 'unknown' 또는 복원 데이터 결손 (e-GIS deserialize와 동일 정책)
      continue;
    }
    mapView.addLayer(olLayer);
    olLayers.push(olLayer);
  }

  // 저장된 카메라(작성자 시점)가 최우선. 없을 때만 레이어 범위로 폴백,
  // 그마저 없으면 MapView 초기 카메라(한국 중심) 유지.
  if (doc.view) {
    mapView.setView(doc.view.center, doc.view.zoom);
  } else if (olLayers.length) {
    mapView.fitToLayers(olLayers);
  }

  return { name: doc.name, vectorCount, rasterCount, skipped, layers: olLayers };
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run src/core/EgisLoader.test.js`
Expected: PASS (8 tests).

- [ ] **Step 5: 상태 문구 갱신** — `src/main.js`의 `.egis 열기` 핸들러 try 블록을 아래로 교체:

```js
  try {
    const raw = JSON.parse(picked.text);
    const result = loadEgisIntoMap(raw, mapView);
    const parts = [];
    if (result.vectorCount) parts.push(`벡터 ${result.vectorCount}개`);
    if (result.rasterCount) parts.push(`래스터 ${result.rasterCount}개`);
    const skippedNote = result.skipped ? ` (복원 불가 ${result.skipped}개 건너뜀)` : '';
    status.textContent = `${picked.filename} — ${parts.join('·') || '레이어 없음'} 로드${skippedNote}`;
  } catch (e) {
    status.textContent = `불러오기 실패: ${e.message}`;
    console.error(e);
  }
```

- [ ] **Step 6: 스모크 픽스처 작성** — `fixtures/sample_dem.egis`

부산 부근에 DEM(서쪽)과 경사도 analysis(동쪽)가 나란히 놓인다. base64 두 개 모두 실제 인코딩 값(검증 완료): dem은 `[0,100,…,700]`(4×3), slope는 `[0,5,…,45]`(4×3). extent는 경위도 129.0~129.2 / 35.1~35.2의 EPSG:3857 값.

```json
{
  "version": "1.0",
  "name": "샘플 DEM 부산",
  "created": "2026-07-02T00:00:00.000Z",
  "view": { "center": [129.1, 35.15], "zoom": 11 },
  "displayCRS": "EPSG:3857",
  "layers": [
    {
      "id": "L_dem",
      "name": "고도 예시",
      "type": "raster",
      "geometryType": "Raster",
      "visible": true,
      "color": "#3b82f6",
      "opacity": 0.8,
      "rasterKind": "dem",
      "raster": {
        "data": {
          "__encoding": "base64",
          "dtype": "Float32Array",
          "base64": "AAAAAAAAyEIAAEhDAACWQwAAFkMAAHpDAACvQwAA4UMAAMhDAAD6QwAAFkQAAC9E"
        },
        "width": 4,
        "height": 3,
        "extent": [14360214.31, 4177479.06, 14371346.26, 4191093.67],
        "minVal": 0,
        "maxVal": 700,
        "noDataValue": -9999
      }
    },
    {
      "id": "L_slope",
      "name": "경사 예시",
      "type": "raster",
      "geometryType": "Raster",
      "visible": true,
      "color": "#3b82f6",
      "opacity": 0.9,
      "rasterKind": "analysis",
      "raster": {
        "data": {
          "__encoding": "base64",
          "dtype": "Float32Array",
          "base64": "AAAAAAAAoEAAACBBAABwQQAAoEEAAMhBAADwQQAADEIAABhCAAAgQgAAKEIAADRC"
        },
        "width": 4,
        "height": 3,
        "extent": [14371346.26, 4177479.06, 14382478.21, 4191093.67],
        "noDataValue": -9999,
        "colorScheme": "slope",
        "minVal": 0,
        "maxVal": 45,
        "metric": "경사도",
        "min": 0,
        "max": 45
      }
    },
    {
      "id": "L_unknown",
      "name": "복원불가 예시",
      "type": "raster",
      "rasterKind": "unknown"
    }
  ]
}
```

- [ ] **Step 7: 수동 스모크 (경로① 완료 판정)**

Run: `npm run dev`
Expected(육안 확인):
1. `.egis 열기` → `fixtures/sample_dem.egis` 선택.
2. 부산 부근(줌 11)에 **왼쪽: 고도 램프(녹→황→갈→흰 그라데이션) 사각형, 오른쪽: 경사 색(녹→노랑→빨강) 사각형**이 반투명하게 보인다.
3. 상태줄: `sample_dem.egis — 래스터 2개 로드 (복원 불가 1개 건너뜀)`.
4. `fixtures/sample.egis`(M1 벡터 픽스처)를 이어서 열면 래스터가 사라지고 벡터만 남는다(교체 시맨틱).
5. (선택) 실제 e-GIS에서 DEM/분석 레이어를 포함해 내보낸 `.egis`로 재확인.

- [ ] **Step 8: 전체 테스트 확인**

Run: `npm test`
Expected: PASS (63 tests). (기존 30 + Task 1~5의 30 + 이 Task의 3)

- [ ] **Step 9: 커밋**

```bash
git add eStoryMap/src/core/EgisLoader.js eStoryMap/src/core/EgisLoader.test.js eStoryMap/src/main.js eStoryMap/fixtures/sample_dem.egis
git commit -m "feat(eStoryMap): M2 경로① .egis 래스터(dem/analysis) 로드 배선 + DEM 픽스처"
```

---

## Task 7: 경로② 준비 — 의존성 + proj4 등록 + GeoTIFF 파싱 (순수, TDD)

**Files:**
- Modify: `package.json` (geotiff, proj4)
- Create: `src/core/proj.js`
- Test: `src/core/geotiffParse.test.js`
- Create: `src/core/geotiffParse.js`

- [ ] **Step 1: 의존성 설치** (e-GIS와 동일 버전 라인)

Run: `npm install geotiff@^2.1.0 proj4@^2.20.2`
Expected: `package.json` dependencies에 `geotiff`, `proj4` 추가, 에러 없음.

- [ ] **Step 2: proj4 등록 모듈 작성** — `src/core/proj.js` (e-GIS `CoordinateSystem.js`의 defs 발췌)

```js
// © 2026 김용현
// eStoryMap/src/core/proj.js
// 한국 TM 좌표계 proj4 정의 등록(부수효과 모듈). 이식 원본: e-GIS CoordinateSystem.js.
// 생 GeoTIFF(경로②)의 transformExtent(한국TM → 3857)에 필요.
import proj4 from 'proj4';
import { register } from 'ol/proj/proj4';

const KOREAN_CRS_DEFS = {
  'EPSG:5179': '+proj=tmerc +lat_0=38 +lon_0=127.5 +k=0.9996 +x_0=1000000 +y_0=2000000 +ellps=GRS80 +units=m +no_defs',
  'EPSG:5186': '+proj=tmerc +lat_0=38 +lon_0=127 +k=1 +x_0=200000 +y_0=600000 +ellps=GRS80 +units=m +no_defs',
  'EPSG:5187': '+proj=tmerc +lat_0=38 +lon_0=129 +k=1 +x_0=200000 +y_0=600000 +ellps=GRS80 +units=m +no_defs',
  'EPSG:5188': '+proj=tmerc +lat_0=38 +lon_0=125 +k=1 +x_0=200000 +y_0=600000 +ellps=GRS80 +units=m +no_defs',
};

for (const [code, def] of Object.entries(KOREAN_CRS_DEFS)) {
  if (!proj4.defs(code)) proj4.defs(code, def);
}
register(proj4);
```

- [ ] **Step 3: 실패하는 테스트 작성** — `src/core/geotiffParse.test.js`

```js
// © 2026 김용현
import { describe, it, expect } from 'vitest';
import { fromLonLat } from 'ol/proj';
import {
  matchKoreanTM, inferSourceProjection, guessProjectionFromBbox,
  toMercatorExtent, extentTo3857, computeMinMax, demDataFromGeoTiff,
} from './geotiffParse.js';

const TM_BASE = {
  GeogSemiMajorAxisGeoKey: 6378137,
  ProjNatOriginLatGeoKey: 38,
  ProjFalseEastingGeoKey: 200000,
  ProjFalseNorthingGeoKey: 600000,
  ProjScaleAtNatOriginGeoKey: 1,
};

describe('matchKoreanTM', () => {
  it('중부원점(lon 127) → EPSG:5186', () => {
    expect(matchKoreanTM({ ...TM_BASE, ProjNatOriginLongGeoKey: 127 })).toBe('EPSG:5186');
  });
  it('동부(129)/서부(125) → 5187/5188', () => {
    expect(matchKoreanTM({ ...TM_BASE, ProjNatOriginLongGeoKey: 129 })).toBe('EPSG:5187');
    expect(matchKoreanTM({ ...TM_BASE, ProjNatOriginLongGeoKey: 125 })).toBe('EPSG:5188');
  });
  it('UTM-K 파라미터 → EPSG:5179', () => {
    expect(matchKoreanTM({
      GeogSemiMajorAxisGeoKey: 6378137,
      ProjNatOriginLongGeoKey: 127.5, ProjNatOriginLatGeoKey: 38,
      ProjFalseEastingGeoKey: 1000000, ProjFalseNorthingGeoKey: 2000000,
      ProjScaleAtNatOriginGeoKey: 0.9996,
    })).toBe('EPSG:5179');
  });
  it('타원체가 GRS80이 아니거나 파라미터 불일치면 null', () => {
    expect(matchKoreanTM({ ...TM_BASE, GeogSemiMajorAxisGeoKey: 6377397, ProjNatOriginLongGeoKey: 127 })).toBeNull();
    expect(matchKoreanTM({ ...TM_BASE, ProjNatOriginLongGeoKey: 128 })).toBeNull();
  });
});

describe('inferSourceProjection', () => {
  it('ProjectedCSTypeGeoKey 우선, 32767(user-defined)은 무시하고 TM 추론', () => {
    expect(inferSourceProjection({ ProjectedCSTypeGeoKey: 5186 })).toBe('EPSG:5186');
    expect(inferSourceProjection({ GeographicTypeGeoKey: 4326 })).toBe('EPSG:4326');
    expect(inferSourceProjection({
      ProjCoordTransGeoKey: 1, ...TM_BASE, ProjNatOriginLongGeoKey: 127,
    })).toBe('EPSG:5186');
    expect(inferSourceProjection(null)).toBeNull();
  });
});

describe('guessProjectionFromBbox', () => {
  it('경위도/웹메르카토르/UTM/불명 순으로 추측한다', () => {
    expect(guessProjectionFromBbox([129.0, 35.1, 129.1, 35.2])).toBe('EPSG:4326');
    expect(guessProjectionFromBbox([14360214, 4177479, 14371346, 4191094])).toBe('EPSG:3857');
    expect(guessProjectionFromBbox([200000, 600000, 210000, 610000])).toBe('UTM');
    expect(guessProjectionFromBbox([-5e7, -5e7, 5e7, 5e7])).toBeNull();
  });
});

describe('toMercatorExtent', () => {
  it('4326 bbox를 웹메르카토르로 수동 변환(OL fromLonLat과 일치)', () => {
    const ext = toMercatorExtent([129.0, 35.1, 129.1, 35.2]);
    const min = fromLonLat([129.0, 35.1]);
    const max = fromLonLat([129.1, 35.2]);
    expect(Math.abs(ext[0] - min[0])).toBeLessThan(1);
    expect(Math.abs(ext[1] - min[1])).toBeLessThan(1);
    expect(Math.abs(ext[2] - max[0])).toBeLessThan(1);
    expect(Math.abs(ext[3] - max[1])).toBeLessThan(1);
  });
});

describe('extentTo3857', () => {
  it('이미 3857이면 그대로', () => {
    const bbox = [14360214, 4177479, 14371346, 4191094];
    expect(extentTo3857(bbox, 'EPSG:3857')).toBe(bbox);
  });
  it('sourceProj가 없고 4326 형태면 수동 변환 폴백', () => {
    const ext = extentTo3857([129.0, 35.1, 129.1, 35.2], null);
    expect(Math.abs(ext[0] - fromLonLat([129.0, 35.1])[0])).toBeLessThan(1);
  });
  it('EPSG:5186은 proj4 등록으로 실제 변환된다(원점 검증)', () => {
    // 5186 원점 (200000, 600000) = 경위도 (127, 38)
    const ext = extentTo3857([200000, 600000, 201000, 601000], 'EPSG:5186');
    const [ox, oy] = fromLonLat([127, 38]);
    expect(Math.abs(ext[0] - ox)).toBeLessThan(50);
    expect(Math.abs(ext[1] - oy)).toBeLessThan(50);
  });
});

describe('computeMinMax', () => {
  it('노데이터/NaN/비유한 값을 제외하고 계산한다', () => {
    const { minVal, maxVal } = computeMinMax(
      new Float32Array([10, -9999, 20, NaN, 40, Infinity]), -9999);
    expect(minVal).toBe(10);
    expect(maxVal).toBe(40);
  });
});

describe('demDataFromGeoTiff', () => {
  const fakeImage = (over = {}) => ({
    readRasters: async () => [new Float32Array([10, 20, -9999, 40])],
    getWidth: () => 2,
    getHeight: () => 2,
    getBoundingBox: () => [129.0, 35.1, 129.1, 35.2],
    getGeoKeys: () => ({ GeographicTypeGeoKey: 4326 }),
    getGDALNoData: () => null,
    ...over,
  });

  it('GeoTIFF 이미지 → demData(extent는 3857로 정렬, GDAL 노데이터 기본 -9999)', async () => {
    const dem = await demDataFromGeoTiff(fakeImage());
    expect(dem.width).toBe(2);
    expect(dem.height).toBe(2);
    expect(dem.noDataValue).toBe(-9999);
    expect(dem.minVal).toBe(10);
    expect(dem.maxVal).toBe(40);
    expect(Math.abs(dem.extent[0] - fromLonLat([129.0, 35.1])[0])).toBeLessThan(1);
    expect(dem.data).toBeInstanceOf(Float32Array);
  });
});
```

- [ ] **Step 4: 테스트 실패 확인**

Run: `npx vitest run src/core/geotiffParse.test.js`
Expected: FAIL — `geotiffParse.js` 없음.

- [ ] **Step 5: 최소 구현** — `src/core/geotiffParse.js`

```js
// © 2026 김용현
// eStoryMap/src/core/geotiffParse.js
// GeoTIFF 이미지 → demData — CRS 추론과 extent 3857 정렬. geotiff.js Image
// 인터페이스에만 의존(순수). 이식 원본: e-GIS DEMLoader.createDEMLayer 상단부
// (matchKoreanTM / guessProjection / toMercator / min-max 스캔).
import { transformExtent } from 'ol/proj';
import './proj.js'; // 한국 TM(5179/5186~5188) 등록 (부수효과)

/** 한국 TM 좌표계 추론 — EPSG 코드가 user-defined(32767)일 때 TM 파라미터로 판별. */
export function matchKoreanTM(geoKeys) {
  // GRS80 타원체 (한국 좌표계의 공통)
  const a = geoKeys.GeogSemiMajorAxisGeoKey;
  if (a && Math.abs(a - 6378137) > 0.1) return null;

  const lon = geoKeys.ProjNatOriginLongGeoKey;
  const lat = geoKeys.ProjNatOriginLatGeoKey;
  const fe = geoKeys.ProjFalseEastingGeoKey;
  const fn = geoKeys.ProjFalseNorthingGeoKey;
  const k = geoKeys.ProjScaleAtNatOriginGeoKey ?? 1;
  const near = (x, target, tol = 0.001) => x !== undefined && Math.abs(x - target) < tol;

  if (near(lat, 38) && near(fe, 200000) && near(fn, 600000) && near(k, 1)) {
    if (near(lon, 127)) return 'EPSG:5186';
    if (near(lon, 129)) return 'EPSG:5187';
    if (near(lon, 125)) return 'EPSG:5188';
  }
  if (near(lat, 38) && near(lon, 127.5) && near(fe, 1000000) && near(fn, 2000000) && near(k, 0.9996)) {
    return 'EPSG:5179';
  }
  return null;
}

/** GeoKeys → 소스 좌표계('EPSG:xxxx' | null). */
export function inferSourceProjection(geoKeys) {
  if (!geoKeys) return null;
  if (geoKeys.ProjectedCSTypeGeoKey && geoKeys.ProjectedCSTypeGeoKey !== 32767) {
    return `EPSG:${geoKeys.ProjectedCSTypeGeoKey}`;
  }
  if (geoKeys.GeographicTypeGeoKey && geoKeys.GeographicTypeGeoKey !== 32767) {
    return `EPSG:${geoKeys.GeographicTypeGeoKey}`;
  }
  // 정부 GeoTIFF에서 흔히 EPSG 코드 없이 TM 파라미터만 채워짐
  if (geoKeys.ProjCoordTransGeoKey === 1) return matchKoreanTM(geoKeys);
  return null;
}

/** bbox 값으로 좌표계 추측. */
export function guessProjectionFromBbox(bbox) {
  const [minX, minY, maxX, maxY] = bbox;
  if (minX >= -180 && maxX <= 180 && minY >= -90 && maxY <= 90) return 'EPSG:4326';
  if (Math.abs(minX) > 180 && Math.abs(maxX) < 20037509 &&
      Math.abs(minY) > 90 && Math.abs(maxY) < 20037509) return 'EPSG:3857';
  if (minX > 100000 && maxX < 1000000 && minY > 0) return 'UTM';
  return null;
}

/** 4326 bbox → 3857 수동 웹메르카토르 변환(원본 toMercator). */
export function toMercatorExtent(bbox) {
  const toM = (lon, lat) => {
    const x = lon * 20037508.34 / 180;
    let y = Math.log(Math.tan((90 + lat) * Math.PI / 360)) / (Math.PI / 180);
    y = y * 20037508.34 / 180;
    return [x, y];
  };
  const min = toM(bbox[0], bbox[1]);
  const max = toM(bbox[2], bbox[3]);
  return [min[0], min[1], max[0], max[1]];
}

/** bbox를 EPSG:3857로 정렬. 변환 실패 시 bbox 추측 폴백(원본 createDEMLayer 흐름). */
export function extentTo3857(bbox, sourceProj) {
  if (sourceProj === 'EPSG:3857') return bbox;
  if (sourceProj) {
    try {
      return transformExtent(bbox, sourceProj, 'EPSG:3857');
    } catch (e) {
      console.warn('좌표계 변환 실패, bbox로 추측:', e);
    }
  }
  const guessed = guessProjectionFromBbox(bbox);
  if (guessed === 'EPSG:4326') return toMercatorExtent(bbox);
  return bbox; // 3857 추정이거나 알 수 없음 — 그대로 사용(원본 동작)
}

/** 밴드에서 min/max 계산(노데이터·NaN·비유한 제외). */
export function computeMinMax(data, noDataValue) {
  let minVal = Infinity;
  let maxVal = -Infinity;
  for (let i = 0; i < data.length; i++) {
    const v = data[i];
    if (v !== noDataValue && !Number.isNaN(v) && Number.isFinite(v)) {
      if (v < minVal) minVal = v;
      if (v > maxVal) maxVal = v;
    }
  }
  return { minVal, maxVal };
}

/** GeoTIFF 이미지 객체 → demData. */
export async function demDataFromGeoTiff(image) {
  const rasters = await image.readRasters();
  const data = rasters[0]; // 첫 밴드 = 고도
  const width = image.getWidth();
  const height = image.getHeight();
  const bbox = image.getBoundingBox();
  const sourceProj = inferSourceProjection(image.getGeoKeys());
  const extent = extentTo3857(bbox, sourceProj);
  const noDataValue = image.getGDALNoData() || -9999;
  const { minVal, maxVal } = computeMinMax(data, noDataValue);
  return { data, width, height, extent, minVal, maxVal, noDataValue };
}
```

- [ ] **Step 6: 테스트 통과 확인**

Run: `npx vitest run src/core/geotiffParse.test.js`
Expected: PASS (12 tests).

- [ ] **Step 7: 커밋**

```bash
git add eStoryMap/package.json eStoryMap/package-lock.json eStoryMap/src/core/proj.js eStoryMap/src/core/geotiffParse.js eStoryMap/src/core/geotiffParse.test.js
git commit -m "feat(eStoryMap): M2 경로② GeoTIFF 파싱 geotiffParse + 한국TM proj4 등록(순수)"
```

---

## Task 8: 경로② — 생 .tif 열기 배선 + 스모크 (M2 완료)

**Files:**
- Create: `src/core/GeoTiffLoader.js`
- Modify: `electron/main.js`, `electron/preload.js`, `index.html`, `src/main.js`

> `GeoTiffLoader`는 geotiff.js 바이너리 파싱을 조립만 하는 접착부라 단위 테스트하지 않는다(실제 .tif 바이트 필요 — 파싱 로직은 Task 7에서 fake image로 커버됨). M0–M1의 `MapView`/`EgisLoader` 스모크 원칙과 동일.

- [ ] **Step 1: `src/core/GeoTiffLoader.js` 작성**

```js
// © 2026 김용현
// eStoryMap/src/core/GeoTiffLoader.js
// 생 GeoTIFF(ArrayBuffer) → DEM 레이어로 지도 반영 (경로②).
// buildRasterLayer 이후는 경로①과 렌더 코드 1벌 공유(상위 스펙 §1c).
import * as GeoTIFF from 'geotiff';
import { demDataFromGeoTiff } from './geotiffParse.js';
import { buildRasterLayer } from './DemRenderer.js';

/**
 * @param {ArrayBuffer} arrayBuffer - .tif 파일 내용
 * @param {string} filename - 원본 파일명(레이어 이름으로 사용)
 * @param {import('./MapView.js').MapView} mapView
 * @returns {Promise<{name:string, layer:object}>}
 */
export async function loadGeoTiffIntoMap(arrayBuffer, filename, mapView) {
  const tiff = await GeoTIFF.fromArrayBuffer(arrayBuffer);
  const image = await tiff.getImage();
  const demData = await demDataFromGeoTiff(image); // data가 TypedArray라 decode는 통과
  const name = filename.replace(/\.(tif|tiff|geotiff|img)$/i, '');
  const layer = buildRasterLayer({
    id: `L_tif_${name}`,
    name,
    type: 'raster',
    rasterKind: 'dem',
    visible: true,
    opacity: 0.8, // e-GIS DEM 기본 불투명도
    raster: demData,
  });
  mapView.addLayer(layer);
  mapView.fitToLayers([layer]);
  return { name, layer };
}
```

- [ ] **Step 2: IPC 핸들러 추가** — `electron/main.js`의 `egis:import` 핸들러 아래에 추가:

```js
// 생 GeoTIFF 열기 (경로② — renderer가 geotiff.js로 파싱)
ipcMain.handle('tif:import', async () => {
  if (!mainWindow) return null;
  const r = await dialog.showOpenDialog(mainWindow, {
    title: 'GeoTIFF 파일 열기',
    filters: [{ name: 'GeoTIFF', extensions: ['tif', 'tiff', 'geotiff', 'img'] }],
    properties: ['openFile'],
  });
  if (r.canceled || !r.filePaths[0]) return null;
  const buf = await fsp.readFile(r.filePaths[0]);
  return {
    filename: path.basename(r.filePaths[0]),
    // Node Buffer는 풀 ArrayBuffer의 뷰일 수 있어 정확한 구간만 잘라 전달
    data: buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength),
  };
});
```

- [ ] **Step 3: preload에 노출** — `electron/preload.js`의 `egisFS`에 한 줄 추가:

```js
  importTif: () => ipcRenderer.invoke('tif:import'),            // → {filename, data:ArrayBuffer} | null
```

- [ ] **Step 4: 툴바 버튼 추가** — `index.html`의 `btn-import` 버튼 다음 줄에:

```html
        <button id="btn-tif" type="button">.tif 열기</button>
```

- [ ] **Step 5: renderer 배선** — `src/main.js` 상단 import에 추가:

```js
import { loadGeoTiffIntoMap } from './core/GeoTiffLoader.js';
```

`btn-folder` 핸들러 앞에 추가:

```js
document.getElementById('btn-tif').addEventListener('click', async () => {
  const picked = await window.egisFS.importTif();
  if (!picked) return;
  status.textContent = `${picked.filename} 파싱 중…`;
  try {
    const result = await loadGeoTiffIntoMap(picked.data, picked.filename, mapView);
    status.textContent = `${picked.filename} — DEM 레이어 로드 (${result.name})`;
  } catch (e) {
    status.textContent = `GeoTIFF 로드 실패: ${e.message}`;
    console.error(e);
  }
});
```

- [ ] **Step 6: 수동 스모크 (경로② 완료 판정)**

Run: `npm run dev`
Expected(육안 확인):
1. `.tif 열기` → 실제 DEM GeoTIFF 선택(e-GIS에서 쓰던 파일. 한국 TM(5186 등)·4326·3857 아무거나).
2. 지도가 해당 범위로 fit되고 **고도 색 램프**가 보인다.
3. 상태줄: `<파일명> — DEM 레이어 로드 (...)`.
4. 이어서 `.egis 열기`를 하면 `.tif` 레이어도 함께 교체된다(전체 교체 시맨틱 — M3에서 소스 단위 관리로 대체 예정).
5. 좌표계 없는 파일도 bbox 추측으로 대략 맞는 위치에 표시되면 정상(원본 e-GIS와 동일 동작).

- [ ] **Step 7: 전체 테스트 최종 확인**

Run: `npm test`
Expected: PASS (75 tests).

- [ ] **Step 8: 커밋**

```bash
git add eStoryMap/src/core/GeoTiffLoader.js eStoryMap/electron/main.js eStoryMap/electron/preload.js eStoryMap/index.html eStoryMap/src/main.js
git commit -m "feat(eStoryMap): M2 경로② 생 GeoTIFF 열기 — GeoTiffLoader + tif:import IPC"
```

---

## Self-Review

**1. 스펙 커버리지 (M2 범위, 상위 스펙 §1c·§7 M2·§8.2):**
- "DemRenderer 탈싱글턴화" → Task 4 (`layerManager`/`mapManager`/범례/eventBus 제거, 레이어 생성만). ✓
- "경로①(.egis 임베드) 먼저" → Task 1(decode)+2(색)+3(픽셀)+4(빌드)+6(배선). `decodeRasterMeta → buildDEMLayer` 규약 이식, geotiff.js 안 거침. ✓
- "경로②(생 .tif + GeoTiffLoader) 이어서" → Task 7(파싱·CRS)+8(IPC·배선). `transformExtent` 3857 정렬(§8.1) + 한국 TM proj4 등록. ✓
- 스펙 §1 파싱 규칙의 analysis(`buildAnalysisLayer`)·`rasterKind:'unknown'` 스킵·`visible/opacity` 보존 → Task 3(analysisColorAt)+4(빌드)+6(가드·스킵 카운트, opacity는 M1 수정으로 레이어 옵션 적용). ✓
- "두 경로 모두 buildDEMLayer 이후 렌더 1벌 공유" → 두 경로 다 `buildRasterLayer` 사용. ✓

**2. 플레이스홀더 스캔:** "TODO/적절히/나중에 채움" 없음 — 모든 코드 단계에 실제 코드·실제 base64(검증 완료)·정확한 기대값 포함. ✓

**3. 타입/이름 일관성:** `decodeRasterMeta`(rasterDecode) · `demColor/getColorForScheme/hypsometricColor/hslToRgb`(rasterColor) · `computeRasterPixels/demColorAt/analysisColorAt`(rasterPixels) · `buildRasterLayer/canBuildRasterLayer`(DemRenderer) · `unionExtent`(MapView) · `demDataFromGeoTiff/extentTo3857/matchKoreanTM/inferSourceProjection/guessProjectionFromBbox/toMercatorExtent/computeMinMax`(geotiffParse) · `loadGeoTiffIntoMap`(GeoTiffLoader) · preload `importTif` ↔ main `tif:import` 채널 일치. `loadEgisIntoMap` 반환 `{name, vectorCount, rasterCount, skipped, layers}`를 Task 6의 main.js가 그대로 사용. ✓

**미해결(구현 중 실측):**
- jsdom에서 `ol/layer/Image`·`ol/source/ImageCanvas` **생성**이 문제없는지 → Task 4 첫 실행에서 확인(렌더는 안 하므로 통과 기대. M1에서 ResizeObserver 스텁은 이미 확보됨).
- `tif:import`의 ArrayBuffer가 IPC 구조화 복제를 거쳐 renderer에서 `GeoTIFF.fromArrayBuffer`에 그대로 들어가는지 → Task 8 스모크에서 확인. 문제 시 renderer에서 `new Uint8Array(data).buffer`로 재래핑.
- 대형 .tif(수천×수천)의 픽셀 루프 성능 — 원본 e-GIS와 동일한 화면 크기 기준 루프라 동등 성능 기대. 문제 시 M2 범위 밖(다운샘플은 백로그).
