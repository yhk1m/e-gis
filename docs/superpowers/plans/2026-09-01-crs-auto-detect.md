# 좌표계 자동 감지 · EPSG:3857 변환 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 공간데이터를 가져올 때 원본 좌표계를 알아내 지도 좌표계(EPSG:3857)로 변환한다. 확신하면 조용히, 애매하면 후보를 본 지도에 미리 그려 고르게 한다.

**Architecture:** 로더마다 흩어진 감지 규칙을 순수 모듈 `CrsDetector` 한 곳으로 모은다. 좌표 크기로 짐작하는 대신 후보 좌표계로 4326에 되돌려 한국 영역에 떨어지는지 검증한다. 로더는 `crsResolver.resolveSourceCrs()` 하나만 호출하고, 다이얼로그는 `setCrsPrompt()`로 주입되므로 `core/`가 `ui/`를 import하지 않는다.

**Tech Stack:** Vanilla JS (ES modules), proj4, OpenLayers 9, vitest

**설계 문서:** `docs/superpowers/specs/2026-09-01-crs-auto-detect-design.md`

---

## 공통 규칙

**새 파일 첫 줄**은 반드시 `// © 2026 김용현` 이다. (전역 훅이 Write 도구로 만든 파일에 자동으로 넣는다. 셸로 만들었다면 직접 넣는다.)

**테스트 실행:** `npx vitest run <파일경로>`

**커밋 형식** — 각 Task의 커밋 단계는 이 형식을 쓴다. `<제목>`·`<본문>`만 Task마다 다르다.

```bash
git commit -F - << 'MSG'
<제목>

<본문>

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_018aB4YseejWtp6RkywB8PUy
MSG
```

**UI 테스트**는 파일 2번째 줄에 `// @vitest-environment jsdom` 을 넣는다 (`src/ui/panels/LayerPanel.stroke.test.js` 참조).

---

## 파일 구조

| 파일 | 책임 |
|---|---|
| `src/core/CoordinateSystem.js` (수정) | 좌표계 정의의 **유일한** 출처. proj4 등록, 목록 제공 |
| `src/core/CrsDetector.js` (신규) | 근거로부터 좌표계를 판정한다. 지도·DOM·비동기 없음. 순수 함수만 |
| `src/core/crsResolver.js` (신규) | 감지 결과를 좌표계 하나로 확정한다. 애매하면 주입된 프롬프트에 묻는다 |
| `src/ui/dialogs/CrsConfirmDialog.js` (신규) | 후보 선택 UI + 본 지도 임시 미리보기. `crsResolver`에 프롬프트로 등록된다 |
| `src/core/LayerManager.js` (수정) | `sourceCrs` 기록 |
| `src/loaders/*.js` (수정) | 근거를 모아 `resolveSourceCrs()`에 넘기고 결과를 `dataProjection`에 쓴다 |
| `src/ui/panels/CoordinateImportPanel.js` (수정) | 좌표계 선택 드롭다운 |
| `src/main.js` (수정) | 시작 시 다이얼로그를 프롬프트로 등록 |

의존 방향은 `ui → core → (proj4, ol)` 한 방향이다. `core/`는 `ui/`를 import하지 않는다.

---

## Task 1: 좌표계 정의를 한 곳으로 모으고 바로잡는다

지금 `CoordinateSystem.js`와 `ShapefileLoader.js`가 좌표계를 각각 등록하는데 **둘이 서로 다르다.**
`CoordinateSystem`의 `EPSG:5188`은 `lon_0=125`(서부원점 값)인데 EPSG:5188은 동해원점(`lon_0=131`)이다.
`ShapefileLoader.detectProjection`은 정의에도 없는 `EPSG:5185`를 반환해 변환이 조용히 깨진다.

**Files:**
- Modify: `src/core/CoordinateSystem.js:9-59` (`CRS_DEFINITIONS`), `getUnits` 아래에 `isSupported` 추가
- Test: `src/core/CoordinateSystem.test.js` (신규)

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`src/core/CoordinateSystem.test.js`:

```js
// © 2026 김용현
/**
 * 좌표계 정의 검증.
 *
 * 정의가 두 곳(CoordinateSystem·ShapefileLoader)에 흩어져 서로 어긋나 있었다.
 * 투영 원점을 역변환하면 (lon_0, lat_0)가 나온다는 성질로 각 정의를 못박는다.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import proj4 from 'proj4';
import { coordinateSystem } from './CoordinateSystem.js';

function originOf(code, x0, y0) {
  return proj4(code, 'EPSG:4326', [x0, y0]);
}

describe('좌표계 정의', () => {
  beforeAll(() => coordinateSystem.init());

  it('목록에 있는 좌표계는 모두 proj4에 등록된다', () => {
    const codes = coordinateSystem.getAvailableCRS().map((c) => c.code);
    expect(codes.length).toBeGreaterThan(10);
    for (const code of codes) {
      expect(proj4.defs(code), code).toBeTruthy();
    }
  });

  it('Korea 2000 원점 4종의 중앙경선이 EPSG 정의와 같다', () => {
    // 서부 125 · 중부 127 · 동부 129 · 동해 131
    expect(originOf('EPSG:5185', 200000, 600000)[0]).toBeCloseTo(125, 6);
    expect(originOf('EPSG:5186', 200000, 600000)[0]).toBeCloseTo(127, 6);
    expect(originOf('EPSG:5187', 200000, 600000)[0]).toBeCloseTo(129, 6);
    // 예전: 5188이 125(서부원점 값)로 정의돼 있었다
    expect(originOf('EPSG:5188', 200000, 600000)[0]).toBeCloseTo(131, 6);
  });

  it('UTM-K(5179)는 중앙경선 127.5, 원점 (1000000, 2000000)이다', () => {
    const [lon, lat] = originOf('EPSG:5179', 1000000, 2000000);
    expect(lon).toBeCloseTo(127.5, 6);
    expect(lat).toBeCloseTo(38, 6);
  });

  it('Korean 1985 중부(5174)는 2097보다 중앙경선이 0.0029도 동쪽이다', () => {
    const a = originOf('EPSG:5174', 200000, 500000)[0];
    const b = originOf('EPSG:2097', 200000, 500000)[0];
    expect(a - b).toBeCloseTo(0.0028902777778, 6);
  });

  it('UTM 52N은 중앙경선 129, UTM 51N은 123이다', () => {
    expect(originOf('EPSG:32652', 500000, 0)[0]).toBeCloseTo(129, 6);
    expect(originOf('EPSG:32651', 500000, 0)[0]).toBeCloseTo(123, 6);
  });

  it('서울시청을 각 좌표계로 보냈다 되돌리면 제자리다', () => {
    const seoul = [126.9784, 37.5667];
    for (const { code } of coordinateSystem.getAvailableCRS()) {
      const there = proj4('EPSG:4326', code, seoul);
      const back = proj4(code, 'EPSG:4326', there);
      expect(back[0], code).toBeCloseTo(seoul[0], 5);
      expect(back[1], code).toBeCloseTo(seoul[1], 5);
    }
  });

  it('isSupported는 정의에 있는 코드만 받아들인다', () => {
    expect(coordinateSystem.isSupported('EPSG:5186')).toBe(true);
    expect(coordinateSystem.isSupported('EPSG:9999')).toBe(false);
    expect(coordinateSystem.isSupported(null)).toBe(false);
  });
});
```

- [ ] **Step 2: 실패를 확인한다**

Run: `npx vitest run src/core/CoordinateSystem.test.js`
Expected: FAIL — 5185·32651·32652 등이 없어 `proj4.defs`가 undefined, 그리고 `isSupported is not a function`

- [ ] **Step 3: 정의를 교체한다**

`src/core/CoordinateSystem.js`의 `CRS_DEFINITIONS` 전체를 아래로 바꾼다.
**순서가 곧 우선순위다** — 역검증에서 후보가 여럿일 때 앞의 것이 기본 선택이 된다.

```js
// 한국에서 자주 쓰는 좌표계. 이 객체가 정의의 유일한 출처다.
// 로더에서 따로 proj4.defs를 부르지 않는다 — 두 곳에 두면 서로 어긋난다.
// 순서 = 우선순위. 역검증에서 후보가 여럿일 때 앞의 것이 기본값이 된다.
const CRS_DEFINITIONS = {
  'EPSG:4326': {
    name: 'WGS 84 (경위도)',
    proj4: '+proj=longlat +datum=WGS84 +no_defs',
    units: 'degrees'
  },
  'EPSG:3857': {
    name: 'Web Mercator',
    proj4: '+proj=merc +a=6378137 +b=6378137 +lat_ts=0 +lon_0=0 +x_0=0 +y_0=0 +k=1 +units=m +nadgrids=@null +wktext +no_defs',
    units: 'meters'
  },
  'EPSG:5179': {
    name: 'Korea 2000 / UTM-K (통합원점)',
    proj4: '+proj=tmerc +lat_0=38 +lon_0=127.5 +k=0.9996 +x_0=1000000 +y_0=2000000 +ellps=GRS80 +units=m +no_defs',
    units: 'meters'
  },
  'EPSG:5186': {
    name: 'Korea 2000 / 중부원점',
    proj4: '+proj=tmerc +lat_0=38 +lon_0=127 +k=1 +x_0=200000 +y_0=600000 +ellps=GRS80 +units=m +no_defs',
    units: 'meters'
  },
  'EPSG:5187': {
    name: 'Korea 2000 / 동부원점',
    proj4: '+proj=tmerc +lat_0=38 +lon_0=129 +k=1 +x_0=200000 +y_0=600000 +ellps=GRS80 +units=m +no_defs',
    units: 'meters'
  },
  'EPSG:5185': {
    name: 'Korea 2000 / 서부원점',
    proj4: '+proj=tmerc +lat_0=38 +lon_0=125 +k=1 +x_0=200000 +y_0=600000 +ellps=GRS80 +units=m +no_defs',
    units: 'meters'
  },
  'EPSG:5188': {
    // 예전에는 이 자리에 lon_0=125(서부원점 값)가 들어 있었다. EPSG:5188은 동해원점이다.
    name: 'Korea 2000 / 동해원점',
    proj4: '+proj=tmerc +lat_0=38 +lon_0=131 +k=1 +x_0=200000 +y_0=600000 +ellps=GRS80 +units=m +no_defs',
    units: 'meters'
  },
  'EPSG:5181': {
    // 5186과 원점은 같고 y_0만 다르다(50만/60만). 서울시 공원 등 옛 자료가 이 계열을 쓴다.
    name: 'Korea 2000 / 중부원점 (y_0=500000)',
    proj4: '+proj=tmerc +lat_0=38 +lon_0=127 +k=1 +x_0=200000 +y_0=500000 +ellps=GRS80 +units=m +no_defs',
    units: 'meters'
  },
  'EPSG:5174': {
    // 서울시 인허가(LOCALDATA) 자료가 쓰는 옛 좌표계. 병원 79곳을 위경도 자료와
    // 이름으로 대조해 확인했다 — 5174는 중앙값 21m, 5181은 314m, 2097은 259m였다.
    // towgs84 3파라미터는 그때 검증한 값이다. 7파라미터로 바꾸지 않는다.
    name: 'Korean 1985 / 중부원점 (서울 인허가)',
    proj4: '+proj=tmerc +lat_0=38 +lon_0=127.0028902777778 +k=1 +x_0=200000 +y_0=500000 +ellps=bessel +units=m +no_defs +towgs84=-115.8,474.99,674.11',
    units: 'meters'
  },
  'EPSG:2097': {
    name: 'Korean 1985 / 중부원점',
    proj4: '+proj=tmerc +lat_0=38 +lon_0=127 +k=1 +x_0=200000 +y_0=500000 +ellps=bessel +units=m +no_defs +towgs84=-115.8,474.99,674.11',
    units: 'meters'
  },
  'EPSG:5173': {
    name: 'Korean 1985 / 서부원점',
    proj4: '+proj=tmerc +lat_0=38 +lon_0=125.0028902777778 +k=1 +x_0=200000 +y_0=500000 +ellps=bessel +units=m +no_defs +towgs84=-115.8,474.99,674.11',
    units: 'meters'
  },
  'EPSG:5176': {
    name: 'Korean 1985 / 동부원점',
    proj4: '+proj=tmerc +lat_0=38 +lon_0=129.0028902777778 +k=1 +x_0=200000 +y_0=500000 +ellps=bessel +units=m +no_defs +towgs84=-115.8,474.99,674.11',
    units: 'meters'
  },
  'EPSG:5177': {
    name: 'Korean 1985 / 동해원점',
    proj4: '+proj=tmerc +lat_0=38 +lon_0=131.0028902777778 +k=1 +x_0=200000 +y_0=500000 +ellps=bessel +units=m +no_defs +towgs84=-115.8,474.99,674.11',
    units: 'meters'
  },
  'EPSG:5178': {
    name: 'Korean 1985 / UTM-K (통합원점)',
    proj4: '+proj=tmerc +lat_0=38 +lon_0=127.5 +k=0.9996 +x_0=1000000 +y_0=2000000 +ellps=bessel +units=m +no_defs +towgs84=-115.8,474.99,674.11',
    units: 'meters'
  },
  'EPSG:32652': {
    name: 'WGS 84 / UTM 52N',
    proj4: '+proj=utm +zone=52 +datum=WGS84 +units=m +no_defs',
    units: 'meters'
  },
  'EPSG:32651': {
    name: 'WGS 84 / UTM 51N',
    proj4: '+proj=utm +zone=51 +datum=WGS84 +units=m +no_defs',
    units: 'meters'
  }
};
```

같은 파일의 `getUnits` 메서드 아래에 더한다:

```js
  /**
   * 정의에 있는 좌표계인지 확인한다.
   * 파일이 알려준 EPSG 코드를 근거로 삼아도 되는지 판단하는 데 쓴다 —
   * 우리가 변환할 수 없는 좌표계라면 근거가 아니다.
   */
  isSupported(code) {
    return Boolean(code && CRS_DEFINITIONS[code]);
  }
```

- [ ] **Step 4: 통과를 확인한다**

Run: `npx vitest run src/core/CoordinateSystem.test.js`
Expected: PASS (7 tests)

- [ ] **Step 5: 커밋한다** (공통 커밋 형식)

제목: `fix: 좌표계 정의를 CoordinateSystem 한 곳으로 모으고 5188을 바로잡는다`

본문:
```
EPSG:5188이 lon_0=125(서부원점 값)로 정의돼 있었다. 동해원점은 131이다.
한국 실무에서 쓰는 좌표계 16종으로 세트를 넓히고, 투영 원점을 역변환하면
중앙경선이 나온다는 성질로 각 정의를 테스트에 못박는다.
```

```bash
git add src/core/CoordinateSystem.js src/core/CoordinateSystem.test.js
```

---

## Task 2: CrsDetector — 명시적 근거 읽기

`.prj`의 EPSG 코드, GeoPackage `srs_id`, GeoJSON `crs` 멤버를 읽는다.

**Files:**
- Create: `src/core/CrsDetector.js`
- Test: `src/core/CrsDetector.test.js` (신규)

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`src/core/CrsDetector.test.js`:

```js
// © 2026 김용현
/**
 * 좌표계 판정 검증.
 *
 * 명시적 근거(EPSG 코드) → 투영 파라미터 → 좌표 역검증 순으로 판정한다.
 * 이 파일은 그 순서와 각 단계의 경계를 못박는다.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { coordinateSystem } from './CoordinateSystem.js';
import {
  parseEpsgFromPrj,
  parseEpsgFromGeoJsonCrs,
  epsgFromNumber
} from './CrsDetector.js';

beforeAll(() => coordinateSystem.init());

// 국토지리정보원 자료에 흔한 형태. 안쪽 AUTHORITY(타원체·데이텀)가 먼저 나오고
// 좌표계 자신의 AUTHORITY가 맨 끝에 온다.
const PRJ_5186 = 'PROJCS["Korea_2000_Korea_Central_Belt",GEOGCS["GCS_Korea_2000",' +
  'DATUM["D_Korea_2000",SPHEROID["GRS_1980",6378137.0,298.257222101,AUTHORITY["EPSG","7019"]],' +
  'AUTHORITY["EPSG","6737"]],PRIMEM["Greenwich",0.0],UNIT["Degree",0.0174532925199433],' +
  'AUTHORITY["EPSG","4737"]],PROJECTION["Transverse_Mercator"],' +
  'PARAMETER["False_Easting",200000.0],PARAMETER["False_Northing",600000.0],' +
  'PARAMETER["Central_Meridian",127.0],PARAMETER["Scale_Factor",1.0],' +
  'PARAMETER["Latitude_Of_Origin",38.0],UNIT["Meter",1.0],AUTHORITY["EPSG","5186"]]';

describe('parseEpsgFromPrj', () => {
  it('맨 바깥 AUTHORITY를 읽는다 (안쪽 타원체 코드가 아니라)', () => {
    expect(parseEpsgFromPrj(PRJ_5186)).toBe('EPSG:5186');
  });

  it('AUTHORITY가 없으면 null이다', () => {
    const prj = 'PROJCS["Korea_2000_Korea_Central_Belt",PROJECTION["Transverse_Mercator"]]';
    expect(parseEpsgFromPrj(prj)).toBeNull();
  });

  it('정의에 없는 코드는 받아들이지 않는다', () => {
    // 값은 읽히지만 우리가 변환할 수 없는 좌표계다
    const prj = 'PROJCS["Belge_Lambert_72",AUTHORITY["EPSG","31370"]]';
    expect(parseEpsgFromPrj(prj)).toBeNull();
  });

  it('빈 값에 터지지 않는다', () => {
    expect(parseEpsgFromPrj(null)).toBeNull();
    expect(parseEpsgFromPrj('')).toBeNull();
  });
});

describe('parseEpsgFromGeoJsonCrs', () => {
  it('OGC URN 형식을 읽는다', () => {
    const crs = { type: 'name', properties: { name: 'urn:ogc:def:crs:EPSG::5186' } };
    expect(parseEpsgFromGeoJsonCrs(crs)).toBe('EPSG:5186');
  });

  it('짧은 형식을 읽는다', () => {
    const crs = { type: 'name', properties: { name: 'EPSG:5179' } };
    expect(parseEpsgFromGeoJsonCrs(crs)).toBe('EPSG:5179');
  });

  it('crs 멤버가 없으면 null이다', () => {
    expect(parseEpsgFromGeoJsonCrs(undefined)).toBeNull();
  });
});

describe('epsgFromNumber', () => {
  it('숫자 srs_id를 코드로 바꾼다', () => {
    expect(epsgFromNumber(5186)).toBe('EPSG:5186');
  });

  it('GeoTIFF의 user-defined(32767)는 근거가 아니다', () => {
    expect(epsgFromNumber(32767)).toBeNull();
  });

  it('정의에 없는 코드는 받아들이지 않는다', () => {
    expect(epsgFromNumber(31370)).toBeNull();
    expect(epsgFromNumber(0)).toBeNull();
    expect(epsgFromNumber(null)).toBeNull();
  });
});
```

- [ ] **Step 2: 실패를 확인한다**

Run: `npx vitest run src/core/CrsDetector.test.js`
Expected: FAIL — `Failed to resolve import "./CrsDetector.js"`

- [ ] **Step 3: 모듈을 만든다**

`src/core/CrsDetector.js`:

```js
// © 2026 김용현
/**
 * CrsDetector - 공간데이터의 원본 좌표계를 알아낸다.
 *
 * 지도·DOM·비동기에 의존하지 않는 순수 모듈이다. 로더 다섯 종(GeoJSON·Shapefile·
 * GeoPackage·표·DEM)이 형식마다 가진 근거를 이 한 곳에 넘기고 같은 규칙으로 판정받는다.
 *
 * 판정 순서:
 *   1. 명시적 근거 — .prj의 EPSG 코드, GeoPackage srs_id, GeoJSON crs 멤버
 *   2. .prj 투영 파라미터가 알려진 좌표계와 일치
 *   3. 좌표 역검증 — 후보로 4326에 되돌려 한국 영역에 떨어지는지 본다
 */
import { coordinateSystem } from './CoordinateSystem.js';

/**
 * 숫자 EPSG 코드를 'EPSG:xxxx' 로 바꾼다.
 * 우리가 변환할 수 없는 좌표계라면 근거로 삼지 않는다(null).
 * 32767은 GeoTIFF에서 "사용자 정의"를 뜻하므로 코드가 아니다.
 */
export function epsgFromNumber(value) {
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0 || n === 32767) return null;
  const code = 'EPSG:' + n;
  return coordinateSystem.isSupported(code) ? code : null;
}

/**
 * .prj(WKT)에서 좌표계 자신의 EPSG 코드를 읽는다.
 *
 * WKT는 타원체·데이텀·투영법이 저마다 AUTHORITY를 달고 있고, 좌표계 자신의
 * AUTHORITY는 맨 끝에 온다. 그래서 마지막 것을 쓴다.
 */
export function parseEpsgFromPrj(prj) {
  if (!prj || typeof prj !== 'string') return null;
  const matches = [...prj.matchAll(/AUTHORITY\s*\[\s*"EPSG"\s*,\s*"?(\d+)"?\s*\]/gi)];
  if (matches.length === 0) return null;
  return epsgFromNumber(matches[matches.length - 1][1]);
}

/**
 * GeoJSON의 crs 멤버를 읽는다.
 * 2016년 규격에서 빠졌지만 국내 공공데이터에는 아직 흔하다.
 * 'urn:ogc:def:crs:EPSG::5186' 과 'EPSG:5186' 둘 다 받는다.
 */
export function parseEpsgFromGeoJsonCrs(crs) {
  if (!crs) return null;
  const name = typeof crs === 'string' ? crs : crs?.properties?.name;
  if (typeof name !== 'string') return null;
  const m = name.match(/EPSG:{1,2}(\d+)/i);
  return m ? epsgFromNumber(m[1]) : null;
}
```

- [ ] **Step 4: 통과를 확인한다**

Run: `npx vitest run src/core/CrsDetector.test.js`
Expected: PASS (10 tests)

- [ ] **Step 5: 커밋한다** (공통 커밋 형식)

제목: `feat: 좌표계 명시적 근거(EPSG 코드) 읽기`

본문:
```
.prj의 맨 바깥 AUTHORITY, GeoPackage srs_id, GeoJSON crs 멤버를 읽는다.
정의에 없는 코드는 변환할 수 없으므로 근거로 삼지 않고 다음 단계로 넘긴다.
```

```bash
git add src/core/CrsDetector.js src/core/CrsDetector.test.js
```

---

## Task 3: CrsDetector — 투영 파라미터 매칭

EPSG 코드 없이 파라미터만 채워진 `.prj`(정부 자료에 흔하다)와 GeoTIFF GeoKeys를 처리한다.
비교 대상 표를 새로 하드코딩하지 않고 **`CRS_DEFINITIONS`의 proj4 문자열에서 파라미터를 뽑아** 쓴다.

**Files:**
- Modify: `src/core/CrsDetector.js` (파일 끝에 추가)
- Modify: `src/core/CrsDetector.test.js` (import 줄 수정 + 파일 끝에 추가)

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`src/core/CrsDetector.test.js`의 import 줄을 바꾼다:

```js
import {
  parseEpsgFromPrj,
  parseEpsgFromGeoJsonCrs,
  epsgFromNumber,
  parsePrjParams,
  matchByProjParams
} from './CrsDetector.js';
```

파일 끝에 붙인다:

```js
// EPSG 코드 없이 파라미터만 있는 .prj — 정부 배포 자료에 흔하다
const PRJ_5186_NO_AUTHORITY = 'PROJCS["Korea_2000_Korea_Central_Belt",GEOGCS["GCS_Korea_2000",' +
  'DATUM["D_Korea_2000",SPHEROID["GRS_1980",6378137.0,298.257222101]],PRIMEM["Greenwich",0.0],' +
  'UNIT["Degree",0.0174532925199433]],PROJECTION["Transverse_Mercator"],' +
  'PARAMETER["False_Easting",200000.0],PARAMETER["False_Northing",600000.0],' +
  'PARAMETER["Central_Meridian",127.0],PARAMETER["Scale_Factor",1.0],' +
  'PARAMETER["Latitude_Of_Origin",38.0],UNIT["Meter",1.0]]';

const PRJ_5174_NO_AUTHORITY = 'PROJCS["Korean_1985_Modified_Central_Belt",GEOGCS["GCS_Korean_Datum_1985",' +
  'DATUM["D_Korean_Datum_1985",SPHEROID["Bessel_1841",6377397.155,299.1528128]],PRIMEM["Greenwich",0.0],' +
  'UNIT["Degree",0.0174532925199433]],PROJECTION["Transverse_Mercator"],' +
  'PARAMETER["False_Easting",200000.0],PARAMETER["False_Northing",500000.0],' +
  'PARAMETER["Central_Meridian",127.0028902777778],PARAMETER["Scale_Factor",1.0],' +
  'PARAMETER["Latitude_Of_Origin",38.0],UNIT["Meter",1.0]]';

const PRJ_UTM52N = 'PROJCS["WGS_1984_UTM_Zone_52N",GEOGCS["GCS_WGS_1984",' +
  'DATUM["D_WGS_1984",SPHEROID["WGS_1984",6378137.0,298.257223563]],PRIMEM["Greenwich",0.0],' +
  'UNIT["Degree",0.0174532925199433]],PROJECTION["Transverse_Mercator"],' +
  'PARAMETER["False_Easting",500000.0],PARAMETER["False_Northing",0.0],' +
  'PARAMETER["Central_Meridian",129.0],PARAMETER["Scale_Factor",0.9996],' +
  'PARAMETER["Latitude_Of_Origin",0.0],UNIT["Meter",1.0]]';

describe('parsePrjParams', () => {
  it('WKT 파라미터와 타원체를 뽑는다', () => {
    expect(parsePrjParams(PRJ_5186_NO_AUTHORITY)).toEqual({
      lon0: 127, lat0: 38, x0: 200000, y0: 600000, k: 1, ellps: 'grs80'
    });
  });

  it('타원체 이름으로 bessel을 알아본다', () => {
    expect(parsePrjParams(PRJ_5174_NO_AUTHORITY).ellps).toBe('bessel');
  });

  it('투영 파라미터가 없으면 null이다', () => {
    expect(parsePrjParams('GEOGCS["GCS_WGS_1984"]')).toBeNull();
  });
});

describe('matchByProjParams', () => {
  it('EPSG 코드 없는 중부원점 .prj를 5186으로 맞춘다', () => {
    expect(matchByProjParams(parsePrjParams(PRJ_5186_NO_AUTHORITY))).toBe('EPSG:5186');
  });

  it('타원체가 다르면 갈린다 — bessel 127.00289는 5174다', () => {
    expect(matchByProjParams(parsePrjParams(PRJ_5174_NO_AUTHORITY))).toBe('EPSG:5174');
  });

  it('중앙경선 0.0029도 차이로 2097과 5174를 구분한다', () => {
    const p2097 = { lon0: 127, lat0: 38, x0: 200000, y0: 500000, k: 1, ellps: 'bessel' };
    expect(matchByProjParams(p2097)).toBe('EPSG:2097');
  });

  it('UTM 52N을 알아본다', () => {
    expect(matchByProjParams(parsePrjParams(PRJ_UTM52N))).toBe('EPSG:32652');
  });

  it('아는 좌표계와 안 맞으면 null이다', () => {
    const belgium = { lon0: 4.367, lat0: 90, x0: 150000, y0: 5400000, k: 1, ellps: 'grs80' };
    expect(matchByProjParams(belgium)).toBeNull();
  });

  it('빈 값에 터지지 않는다', () => {
    expect(matchByProjParams(null)).toBeNull();
  });
});
```

- [ ] **Step 2: 실패를 확인한다**

Run: `npx vitest run src/core/CrsDetector.test.js`
Expected: FAIL — `parsePrjParams is not a function`

- [ ] **Step 3: 구현한다**

`src/core/CrsDetector.js` 끝에 붙인다:

```js
/**
 * 타원체 이름을 한 낱말로 줄인다.
 * WKT('GRS_1980')와 proj4('+ellps=GRS80')의 표기가 달라 그대로는 비교되지 않는다.
 */
function normalizeEllipsoid(text) {
  if (!text) return null;
  const s = String(text).toLowerCase();
  if (s.includes('bessel')) return 'bessel';
  if (s.includes('grs')) return 'grs80';
  if (s.includes('wgs')) return 'wgs84';
  return null;
}

function numberFrom(text, pattern) {
  const m = text.match(pattern);
  return m ? parseFloat(m[1]) : undefined;
}

/**
 * .prj(WKT)에서 투영 파라미터를 뽑는다.
 * @returns {{lon0:number, lat0:number, x0:number, y0:number, k:number, ellps:string}|null}
 */
export function parsePrjParams(prj) {
  if (!prj || typeof prj !== 'string') return null;
  const lon0 = numberFrom(prj, /"?central_meridian"?\s*,\s*(-?[\d.]+)/i);
  const lat0 = numberFrom(prj, /"?latitude_of_origin"?\s*,\s*(-?[\d.]+)/i);
  const x0 = numberFrom(prj, /"?false_easting"?\s*,\s*(-?[\d.]+)/i);
  const y0 = numberFrom(prj, /"?false_northing"?\s*,\s*(-?[\d.]+)/i);
  const k = numberFrom(prj, /"?scale_factor"?\s*,\s*(-?[\d.]+)/i);
  if (lon0 === undefined || x0 === undefined || y0 === undefined) return null;
  const spheroid = prj.match(/SPHEROID\s*\[\s*"([^"]+)"/i);
  return {
    lon0,
    lat0: lat0 === undefined ? 0 : lat0,
    x0,
    y0,
    k: k === undefined ? 1 : k,
    ellps: normalizeEllipsoid(spheroid ? spheroid[1] : prj)
  };
}

/**
 * CRS_DEFINITIONS의 proj4 문자열에서 같은 모양의 파라미터를 뽑는다.
 * 비교용 표를 따로 두면 정의와 어긋나므로 정의에서 파생시킨다.
 */
function paramsOfDefinition(code) {
  const def = coordinateSystem.getCRSInfo(code);
  if (!def) return null;
  const s = def.proj4;
  const utm = s.match(/\+proj=utm[\s\S]*?\+zone=(\d+)/);
  if (utm) {
    return {
      lon0: 6 * Number(utm[1]) - 183,
      lat0: 0,
      x0: 500000,
      y0: 0,
      k: 0.9996,
      ellps: normalizeEllipsoid(s.includes('+datum=WGS84') ? 'wgs84' : s)
    };
  }
  // 경위도·메르카토르는 투영 파라미터로 맞출 대상이 아니다
  if (!s.includes('+proj=tmerc')) return null;
  const get = (key) => numberFrom(s, new RegExp('\\+' + key + '=(-?[\\d.]+)'));
  const ell = s.match(/\+ellps=(\w+)/);
  const lat0 = get('lat_0');
  const k = get('k');
  return {
    lon0: get('lon_0'),
    lat0: lat0 === undefined ? 0 : lat0,
    x0: get('x_0'),
    y0: get('y_0'),
    k: k === undefined ? 1 : k,
    ellps: normalizeEllipsoid(ell ? ell[1] : s)
  };
}

// 중앙경선 허용오차. 5174(127.0028902…)와 2097(127.0)의 차이가 0.00289도라
// 이보다 촘촘해야 둘이 갈린다.
const LON_TOLERANCE = 0.0005;

/**
 * 투영 파라미터로 좌표계를 맞춘다.
 * @param {{lon0:number, lat0:number, x0:number, y0:number, k:number, ellps:string}|null} params
 * @returns {string|null} 'EPSG:5186' 같은 코드, 못 맞추면 null
 */
export function matchByProjParams(params) {
  if (!params || typeof params.lon0 !== 'number') return null;
  for (const { code } of coordinateSystem.getAvailableCRS()) {
    const def = paramsOfDefinition(code);
    if (!def) continue;
    if (def.ellps && params.ellps && def.ellps !== params.ellps) continue;
    if (Math.abs(def.lon0 - params.lon0) > LON_TOLERANCE) continue;
    if (Math.abs(def.lat0 - params.lat0) > LON_TOLERANCE) continue;
    if (Math.abs(def.x0 - params.x0) > 1) continue;
    if (Math.abs(def.y0 - params.y0) > 1) continue;
    if (Math.abs(def.k - params.k) > 1e-6) continue;
    return code;
  }
  return null;
}
```

- [ ] **Step 4: 통과를 확인한다**

Run: `npx vitest run src/core/CrsDetector.test.js`
Expected: PASS (19 tests)

- [ ] **Step 5: 커밋한다** (공통 커밋 형식)

제목: `feat: 투영 파라미터로 좌표계 맞추기`

본문:
```
EPSG 코드 없이 파라미터만 채워진 .prj가 정부 자료에 흔하다.
비교 표를 새로 두지 않고 CRS_DEFINITIONS의 proj4 문자열에서 파라미터를 뽑아
대조한다 — 정의와 어긋날 여지를 없앤다.
중앙경선 허용오차는 0.0005도다. 5174와 2097이 0.0029도 차이로 갈린다.
```

```bash
git add src/core/CrsDetector.js src/core/CrsDetector.test.js
```

---

## Task 4: CrsDetector — 좌표 역검증과 detectCrs 통합

이 설계의 핵심이다. 좌표 크기로 짐작하지 않고, 후보 좌표계로 4326에 되돌려
결과가 한국 영역에 떨어지는지 본다.

**단위 온전성 검사를 함께 둔다.** 표본이 전부 경위도 범위(|x|≤180, |y|≤90) 안이면
미터 단위 좌표계를 후보에서 빼고, 하나라도 그 범위를 벗어나면 경위도 좌표계를 뺀다.
이게 없으면 파리 좌표 `[2.35, 48.85]`가 3857로도 "세계 안"이라 후보가 둘이 된다.

**Files:**
- Modify: `src/core/CrsDetector.js` (파일 끝에 추가 + 맨 위 import에 proj4 추가)
- Modify: `src/core/CrsDetector.test.js` (import 줄 수정 + 파일 끝에 추가)

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`src/core/CrsDetector.test.js`의 import를 바꾸고 `proj4`를 들여온다:

```js
import proj4 from 'proj4';
import {
  parseEpsgFromPrj,
  parseEpsgFromGeoJsonCrs,
  epsgFromNumber,
  parsePrjParams,
  matchByProjParams,
  detectCrs,
  sampleCoordsFromGeoJSON
} from './CrsDetector.js';
```

파일 끝에 붙인다:

```js
const SEOUL = [126.9784, 37.5667];      // 서울시청
const BUSAN = [129.0756, 35.1796];      // 부산시청
const PARIS = [2.3522, 48.8566];

// 위경도 지점을 해당 좌표계 값으로 옮긴다
function at(code, lonlat) {
  return proj4('EPSG:4326', code, lonlat);
}

describe('detectCrs — 명시적 근거 우선', () => {
  it('.prj의 EPSG 코드가 좌표보다 우선한다', () => {
    // 좌표는 5186처럼 생겼지만 .prj는 5179라고 말한다 → .prj를 따른다
    const r = detectCrs({
      prj: 'PROJCS["뭐든",AUTHORITY["EPSG","5179"]]',
      sampleCoords: [at('EPSG:5186', SEOUL)]
    });
    expect(r.crs).toBe('EPSG:5179');
    expect(r.confidence).toBe('certain');
  });

  it('GeoPackage srs_id를 따른다', () => {
    const r = detectCrs({ srsId: 5187, sampleCoords: [at('EPSG:5187', BUSAN)] });
    expect(r.crs).toBe('EPSG:5187');
    expect(r.confidence).toBe('certain');
  });

  it('EPSG 코드가 없으면 투영 파라미터로 정한다', () => {
    const r = detectCrs({
      prj: PRJ_5186_NO_AUTHORITY,
      sampleCoords: [at('EPSG:5186', SEOUL)]
    });
    expect(r.crs).toBe('EPSG:5186');
    expect(r.confidence).toBe('certain');
  });
});

describe('detectCrs — 좌표 역검증', () => {
  it('위경도 자료는 4326 하나로 확정된다', () => {
    const r = detectCrs({ sampleCoords: [SEOUL, BUSAN] });
    expect(r.crs).toBe('EPSG:4326');
    expect(r.confidence).toBe('certain');
  });

  it('TM 자료는 후보가 여럿이라 애매하다 — 5186과 5181이 함께 남는다', () => {
    // 5186과 5181은 y_0만 10만 다르다. 둘 다 한국 안에 떨어지므로
    // 좌표만으로는 갈릴 수 없다. 사용자가 미리보기로 고른다.
    const r = detectCrs({ sampleCoords: [at('EPSG:5186', SEOUL), at('EPSG:5186', BUSAN)] });
    expect(r.confidence).toBe('ambiguous');
    const codes = r.candidates.map((c) => c.crs);
    expect(codes).toContain('EPSG:5186');
    expect(codes).toContain('EPSG:5181');
    // 정의 순서상 5186이 앞이므로 기본 선택이 된다
    expect(r.crs).toBe('EPSG:5186');
  });

  it('후보마다 변환 결과 중심을 함께 준다 (미리보기 설명용)', () => {
    const r = detectCrs({ sampleCoords: [at('EPSG:5186', SEOUL)] });
    const picked = r.candidates.find((c) => c.crs === 'EPSG:5186');
    expect(picked.center[0]).toBeCloseTo(SEOUL[0], 3);
    expect(picked.center[1]).toBeCloseTo(SEOUL[1], 3);
    expect(picked.name).toContain('중부원점');
  });

  it('단위가 안 맞는 후보는 뺀다 — 경위도 값에 미터 좌표계를 주지 않는다', () => {
    const r = detectCrs({ sampleCoords: [PARIS] });
    expect(r.candidates.map((c) => c.crs)).not.toContain('EPSG:3857');
  });

  it('한국 밖이면 전 지구 범위로 한 번 더 거른다', () => {
    const r = detectCrs({ sampleCoords: [PARIS] });
    expect(r.crs).toBe('EPSG:4326');
    expect(r.confidence).toBe('certain');
    expect(r.reason).toContain('전 지구');
  });

  it('아무 근거도 없으면 unknown이고 기본값은 4326이다', () => {
    const r = detectCrs({ sampleCoords: [] });
    expect(r.confidence).toBe('unknown');
    expect(r.crs).toBe('EPSG:4326');
    expect(r.candidates.length).toBeGreaterThan(10);
  });

  it('말이 안 되는 좌표도 터지지 않는다', () => {
    const r = detectCrs({ sampleCoords: [[1e12, -1e12]] });
    expect(r.confidence).toBe('unknown');
  });
});

describe('sampleCoordsFromGeoJSON', () => {
  it('도형 종류와 상관없이 첫 좌표를 뽑는다', () => {
    const gj = {
      type: 'FeatureCollection',
      features: [
        { geometry: { type: 'Point', coordinates: [1, 2] } },
        { geometry: { type: 'LineString', coordinates: [[3, 4], [5, 6]] } },
        { geometry: { type: 'Polygon', coordinates: [[[7, 8], [9, 10]]] } },
        { geometry: { type: 'MultiPolygon', coordinates: [[[[11, 12], [13, 14]]]] } }
      ]
    };
    expect(sampleCoordsFromGeoJSON(gj)).toEqual([[1, 2], [3, 4], [7, 8], [11, 12]]);
  });

  it('개수 상한을 지킨다', () => {
    const features = Array.from({ length: 50 }, (_, i) => ({
      geometry: { type: 'Point', coordinates: [i, i] }
    }));
    expect(sampleCoordsFromGeoJSON({ features }, 20)).toHaveLength(20);
  });

  it('빈 값과 지오메트리 없는 피처를 건너뛴다', () => {
    expect(sampleCoordsFromGeoJSON(null)).toEqual([]);
    expect(sampleCoordsFromGeoJSON({ features: [{ geometry: null }, {}] })).toEqual([]);
  });
});
```

- [ ] **Step 2: 실패를 확인한다**

Run: `npx vitest run src/core/CrsDetector.test.js`
Expected: FAIL — `detectCrs is not a function`

- [ ] **Step 3: 구현한다**

`src/core/CrsDetector.js` 맨 위 import에 proj4를 더한다:

```js
import proj4 from 'proj4';
import { coordinateSystem } from './CoordinateSystem.js';
```

파일 끝에 붙인다:

```js
// 남한과 주변. 한국 자료가 압도적으로 많으므로 이 범위를 먼저 본다.
const KOREA_BOUNDS = { minLon: 124, maxLon: 132, minLat: 33, maxLat: 43 };
// 한국 안에서 후보가 하나도 안 남을 때(해외 자료) 쓰는 완화 범위
const WORLD_BOUNDS = { minLon: -180, maxLon: 180, minLat: -85, maxLat: 85 };

/**
 * 표본 좌표가 경위도처럼 생겼는지 본다.
 * 미터 좌표계 값은 이 범위를 훌쩍 넘고, 경위도 값은 절대 넘지 않는다.
 */
function looksLikeDegrees(coords) {
  return coords.every(([x, y]) => Math.abs(x) <= 180 && Math.abs(y) <= 90);
}

/**
 * 단위가 표본과 맞는 후보인지 본다.
 * 이 검사가 없으면 파리 좌표 [2.35, 48.85]가 3857로도 "세계 안"이라 후보가 둘이 된다.
 */
function unitsPlausible(code, degreeish) {
  const units = coordinateSystem.getCRSInfo(code)?.units;
  return degreeish ? units === 'degrees' : units === 'meters';
}

/**
 * 후보 좌표계로 표본을 4326에 되돌려, 결과가 주어진 범위 안에 떨어지는지 검증한다.
 * 좌표 크기로 짐작하는 대신 되돌려 확인하므로 범위가 겹치는 좌표계도 갈린다.
 *
 * @returns {Array<{crs:string, name:string, center:number[]}>} 살아남은 후보
 */
export function validateByReprojection(sampleCoords, bounds) {
  if (!Array.isArray(sampleCoords) || sampleCoords.length === 0) return [];
  const degreeish = looksLikeDegrees(sampleCoords);
  const survivors = [];

  for (const { code, name } of coordinateSystem.getAvailableCRS()) {
    if (!unitsPlausible(code, degreeish)) continue;

    let sumLon = 0;
    let sumLat = 0;
    let ok = true;

    for (const coord of sampleCoords) {
      let lon;
      let lat;
      try {
        [lon, lat] = proj4(code, 'EPSG:4326', coord);
      } catch (error) {
        ok = false;
        break;
      }
      if (!Number.isFinite(lon) || !Number.isFinite(lat) ||
          lon < bounds.minLon || lon > bounds.maxLon ||
          lat < bounds.minLat || lat > bounds.maxLat) {
        ok = false;
        break;
      }
      sumLon += lon;
      sumLat += lat;
    }

    if (ok) {
      survivors.push({
        crs: code,
        name,
        center: [sumLon / sampleCoords.length, sumLat / sampleCoords.length]
      });
    }
  }

  return survivors;
}

/** 후보를 하나도 못 좁혔을 때 사용자에게 보여줄 전체 목록 */
function allCandidates() {
  return coordinateSystem.getAvailableCRS().map(({ code, name }) => ({
    crs: code,
    name,
    center: null
  }));
}

function certain(crs, reason) {
  const info = coordinateSystem.getCRSInfo(crs);
  return {
    crs,
    confidence: 'certain',
    reason,
    candidates: [{ crs, name: info ? info.name : crs, center: null }]
  };
}

/**
 * 원본 좌표계를 판정한다.
 *
 * @param {Object} input - 형식마다 있는 근거만 넣는다
 * @param {string} [input.prj] - Shapefile .prj 내용(WKT)
 * @param {number} [input.srsId] - GeoPackage gpkg_geometry_columns.srs_id
 * @param {Object|string} [input.geojsonCrs] - GeoJSON crs 멤버
 * @param {number} [input.epsgCode] - GeoTIFF GeoKeys의 EPSG 코드
 * @param {Object} [input.projParams] - {lon0, lat0, x0, y0, k, ellps} (GeoTIFF GeoKeys 등)
 * @param {number[][]} [input.sampleCoords] - 원본 좌표계 그대로의 표본 좌표
 * @returns {{crs:string, confidence:'certain'|'ambiguous'|'unknown', reason:string,
 *            candidates:Array<{crs:string, name:string, center:number[]|null}>}}
 */
export function detectCrs(input = {}) {
  const { prj, srsId, geojsonCrs, epsgCode, projParams, sampleCoords = [] } = input;

  // 1. 명시적 근거
  const fromPrj = parseEpsgFromPrj(prj);
  if (fromPrj) return certain(fromPrj, '.prj의 EPSG 코드');

  const fromSrsId = epsgFromNumber(srsId);
  if (fromSrsId) return certain(fromSrsId, 'GeoPackage srs_id');

  const fromGeoJson = parseEpsgFromGeoJsonCrs(geojsonCrs);
  if (fromGeoJson) return certain(fromGeoJson, 'GeoJSON crs 멤버');

  const fromEpsgCode = epsgFromNumber(epsgCode);
  if (fromEpsgCode) return certain(fromEpsgCode, 'GeoTIFF EPSG 코드');

  // 2. 투영 파라미터
  const byParams = matchByProjParams(parsePrjParams(prj) || projParams || null);
  if (byParams) return certain(byParams, '투영 파라미터');

  // 3. 좌표 역검증
  let candidates = validateByReprojection(sampleCoords, KOREA_BOUNDS);
  let scope = '한국 영역';
  if (candidates.length === 0) {
    candidates = validateByReprojection(sampleCoords, WORLD_BOUNDS);
    scope = '전 지구 영역';
  }

  if (candidates.length === 1) {
    return {
      crs: candidates[0].crs,
      confidence: 'certain',
      reason: '좌표 역검증 (' + scope + '에 맞는 후보 하나)',
      candidates
    };
  }
  if (candidates.length > 1) {
    return {
      crs: candidates[0].crs,
      confidence: 'ambiguous',
      reason: '좌표 역검증 (' + scope + '에 맞는 후보 ' + candidates.length + '개)',
      candidates
    };
  }

  return {
    crs: 'EPSG:4326',
    confidence: 'unknown',
    reason: '판단할 근거가 없다',
    candidates: allCandidates()
  };
}

/**
 * GeoJSON에서 판정용 표본 좌표를 뽑는다.
 * 도형 종류마다 좌표 중첩 깊이가 달라 첫 좌표까지 파고든다.
 */
export function sampleCoordsFromGeoJSON(geojson, max = 20) {
  const features = geojson && geojson.features;
  if (!Array.isArray(features)) return [];
  const out = [];
  for (const feature of features) {
    let c = feature && feature.geometry && feature.geometry.coordinates;
    while (Array.isArray(c) && Array.isArray(c[0])) c = c[0];
    if (Array.isArray(c) && Number.isFinite(c[0]) && Number.isFinite(c[1])) {
      out.push([c[0], c[1]]);
    }
    if (out.length >= max) break;
  }
  return out;
}
```

- [ ] **Step 4: 통과를 확인한다**

Run: `npx vitest run src/core/CrsDetector.test.js`
Expected: PASS (32 tests)

- [ ] **Step 5: 커밋한다** (공통 커밋 형식)

제목: `feat: 좌표 역검증으로 좌표계를 판정한다`

본문:
```
후보 좌표계로 표본을 4326에 되돌려 한국 영역에 떨어지는지 본다.
크기로 짐작하던 방식과 달리 범위가 겹치는 좌표계도 갈린다.
표본이 경위도처럼 생겼으면 미터 좌표계를, 아니면 경위도 좌표계를 후보에서 빼
단위가 어긋난 후보가 살아남지 않게 한다.
5186과 5181처럼 원리상 갈릴 수 없는 짝은 ambiguous로 두고 사용자에게 넘긴다.
```

```bash
git add src/core/CrsDetector.js src/core/CrsDetector.test.js
```

---

## Task 5: crsResolver — 확정 지점 하나 만들기

로더가 다이얼로그를 몰라도 되게 한다. `core/`가 `ui/`를 import하면 의존이 뒤엉키므로
프롬프트를 주입받는다.

**Files:**
- Create: `src/core/crsResolver.js`
- Test: `src/core/crsResolver.test.js` (신규)

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`src/core/crsResolver.test.js`:

```js
// © 2026 김용현
/**
 * 좌표계 확정 지점 검증.
 *
 * 확신하면 묻지 않고, 애매하면 주입된 프롬프트에 묻는다.
 * 프롬프트가 없을 때(테스트·스크립트)도 동작해야 한다.
 */
import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import proj4 from 'proj4';
import { coordinateSystem } from './CoordinateSystem.js';
import { resolveSourceCrs, setCrsPrompt } from './crsResolver.js';

beforeAll(() => coordinateSystem.init());
beforeEach(() => setCrsPrompt(null));

const SEOUL = [126.9784, 37.5667];
let SEOUL_5186;
beforeAll(() => {
  SEOUL_5186 = proj4('EPSG:4326', 'EPSG:5186', SEOUL);
});

describe('resolveSourceCrs', () => {
  it('확신하면 프롬프트를 부르지 않는다', async () => {
    const prompt = vi.fn();
    setCrsPrompt(prompt);
    const r = await resolveSourceCrs({ srsId: 5186, sampleCoords: [SEOUL_5186] });
    expect(r.crs).toBe('EPSG:5186');
    expect(r.cancelled).toBe(false);
    expect(prompt).not.toHaveBeenCalled();
  });

  it('애매하면 프롬프트가 고른 값을 쓴다', async () => {
    const prompt = vi.fn().mockResolvedValue('EPSG:5181');
    setCrsPrompt(prompt);
    const r = await resolveSourceCrs({ sampleCoords: [SEOUL_5186] });
    expect(r.crs).toBe('EPSG:5181');
    expect(prompt).toHaveBeenCalledOnce();
    // 프롬프트는 판정 결과를 첫 인자로 받는다
    expect(prompt.mock.calls[0][0].confidence).toBe('ambiguous');
  });

  it('프롬프트가 취소하면 cancelled다', async () => {
    setCrsPrompt(vi.fn().mockResolvedValue(null));
    const r = await resolveSourceCrs({ sampleCoords: [SEOUL_5186] });
    expect(r.cancelled).toBe(true);
    expect(r.crs).toBeNull();
  });

  it('프롬프트가 없으면 최선의 후보로 진행한다', async () => {
    const r = await resolveSourceCrs({ sampleCoords: [SEOUL_5186] });
    expect(r.crs).toBe('EPSG:5186');
    expect(r.cancelled).toBe(false);
  });

  it('프롬프트가 터져도 가져오기를 막지 않는다', async () => {
    setCrsPrompt(vi.fn().mockRejectedValue(new Error('DOM 없음')));
    const r = await resolveSourceCrs({ sampleCoords: [SEOUL_5186] });
    expect(r.crs).toBe('EPSG:5186');
    expect(r.cancelled).toBe(false);
  });

  it('두 번째 인자(미리보기 재료)를 프롬프트에 그대로 넘긴다', async () => {
    const prompt = vi.fn().mockResolvedValue('EPSG:5186');
    setCrsPrompt(prompt);
    const context = { name: '학교', previewGeoJSON: { type: 'FeatureCollection', features: [] } };
    await resolveSourceCrs({ sampleCoords: [SEOUL_5186] }, context);
    expect(prompt.mock.calls[0][1]).toBe(context);
  });
});
```

- [ ] **Step 2: 실패를 확인한다**

Run: `npx vitest run src/core/crsResolver.test.js`
Expected: FAIL — `Failed to resolve import "./crsResolver.js"`

- [ ] **Step 3: 구현한다**

`src/core/crsResolver.js`:

```js
// © 2026 김용현
/**
 * crsResolver - 감지 결과를 좌표계 하나로 확정한다.
 *
 * 로더는 이 함수 하나만 부른다. 확신하면 그대로 쓰고, 애매하면 등록된 프롬프트
 * (CrsConfirmDialog)에 묻는다. 프롬프트를 주입받는 이유는 core/가 ui/를
 * import하지 않게 하기 위해서다 — 테스트에서도 DOM 없이 돈다.
 */
import { detectCrs } from './CrsDetector.js';

let promptFn = null;

/**
 * 애매할 때 물어볼 함수를 등록한다. main.js가 시작할 때 한 번 부른다.
 * @param {null|function(Object, Object): Promise<string|null>} fn
 *        (detection, context) => 고른 좌표계 코드 또는 null(취소)
 */
export function setCrsPrompt(fn) {
  promptFn = typeof fn === 'function' ? fn : null;
}

/**
 * 원본 좌표계를 확정한다.
 *
 * @param {Object} input - detectCrs에 넘길 근거
 * @param {Object} [context] - 프롬프트에 그대로 전달된다
 * @param {string} [context.name] - 레이어 이름 (다이얼로그 제목용)
 * @param {Object} [context.previewGeoJSON] - 원본 좌표 그대로의 GeoJSON (미리보기용)
 * @returns {Promise<{crs:string|null, cancelled:boolean, detection:Object}>}
 */
export async function resolveSourceCrs(input, context = {}) {
  const detection = detectCrs(input);

  if (detection.confidence === 'certain' || !promptFn) {
    return { crs: detection.crs, cancelled: false, detection };
  }

  let chosen;
  try {
    chosen = await promptFn(detection, context);
  } catch (error) {
    // 다이얼로그가 실패해도 가져오기 자체는 살린다 — 최선의 후보로 진행한다
    console.warn('좌표계 확인 창을 띄우지 못했다:', error);
    return { crs: detection.crs, cancelled: false, detection };
  }

  if (!chosen) return { crs: null, cancelled: true, detection };
  return { crs: chosen, cancelled: false, detection };
}
```

- [ ] **Step 4: 통과를 확인한다**

Run: `npx vitest run src/core/crsResolver.test.js`
Expected: PASS (6 tests)

- [ ] **Step 5: 커밋한다** (공통 커밋 형식)

제목: `feat: 좌표계 확정 지점(crsResolver) 추가`

본문:
```
로더는 resolveSourceCrs 하나만 부른다. 다이얼로그는 setCrsPrompt로 주입되므로
core/가 ui/를 import하지 않고, 테스트도 DOM 없이 돈다.
다이얼로그가 터져도 최선의 후보로 가져오기를 이어간다.
```

```bash
git add src/core/crsResolver.js src/core/crsResolver.test.js
```

---

## Task 6: LayerManager에 sourceCrs 기록

읽는 곳은 아직 없다. 나중에 「레이어 좌표계 다시 지정」을 만들 때 필요한 정보를
지금 남겨 둔다 (설계 문서 「범위 밖」 참조).

**Files:**
- Modify: `src/core/LayerManager.js:258-279` (`layerInfo` 객체)
- Test: `src/core/LayerManager.sourceCrs.test.js` (신규)

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`src/core/LayerManager.sourceCrs.test.js`:

```js
// © 2026 김용현
/**
 * 레이어가 원본 좌표계를 기억하는지 검증.
 *
 * 피처는 3857로 변환돼 저장되므로, 나중에 좌표계를 다시 지정하려면
 * 어디서 왔는지 알아야 한다. 지금은 기록만 한다.
 */
import { describe, it, expect } from 'vitest';
import Feature from 'ol/Feature';
import Point from 'ol/geom/Point';
import { layerManager } from './LayerManager.js';

function pointFeature() {
  return new Feature({ geometry: new Point([14135000, 4518000]) });
}

describe('레이어의 sourceCrs', () => {
  it('넘긴 원본 좌표계를 기억한다', () => {
    const id = layerManager.addLayer({
      name: '학교',
      features: [pointFeature()],
      sourceCrs: 'EPSG:5186'
    });
    expect(layerManager.getLayer(id).sourceCrs).toBe('EPSG:5186');
    layerManager.removeLayer(id);
  });

  it('안 넘기면 null이다 (그리기 도구로 만든 레이어 등)', () => {
    const id = layerManager.addLayer({ name: '그린 것', features: [pointFeature()] });
    expect(layerManager.getLayer(id).sourceCrs).toBeNull();
    layerManager.removeLayer(id);
  });
});
```

- [ ] **Step 2: 실패를 확인한다**

Run: `npx vitest run src/core/LayerManager.sourceCrs.test.js`
Expected: FAIL — `expected undefined to be 'EPSG:5186'`

- [ ] **Step 3: 구현한다**

`src/core/LayerManager.js`의 `layerInfo` 객체에서 `geometryType: geometryType,` 줄 바로 아래에 더한다:

```js
      geometryType: geometryType,
      // 가져올 때 판정한 원본 좌표계. 피처는 3857로 저장되므로 나중에
      // 좌표계를 다시 지정하려면 어디서 왔는지 알아야 한다. 지금은 기록만 한다.
      sourceCrs: options.sourceCrs || null,
      featureCount: featureCount,
```

- [ ] **Step 4: 통과를 확인한다**

Run: `npx vitest run src/core/LayerManager.sourceCrs.test.js`
Expected: PASS (2 tests)

- [ ] **Step 5: 커밋한다** (공통 커밋 형식)

제목: `feat: 레이어에 원본 좌표계를 기록한다`

본문:
```
피처는 3857로 변환돼 저장되므로 원본 좌표계를 잃으면 나중에 되돌릴 수 없다.
읽는 곳은 아직 없고 기록만 한다.
```

```bash
git add src/core/LayerManager.js src/core/LayerManager.sourceCrs.test.js
```

---

## Task 7: GeoJSONLoader 연결

지금은 `dataProjection: 'EPSG:4326'` 이 박혀 있어 TM 좌표 GeoJSON이 늘 어긋난다.

**Files:**
- Modify: `src/loaders/GeoJSONLoader.js:44-72` (`loadFromString`)
- Modify: `src/main.js:243` 부근 (취소 처리), `src/ui/panels/BrowserPanel.js:172` 부근
- Test: `src/loaders/GeoJSONLoader.test.js` (신규)

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`src/loaders/GeoJSONLoader.test.js`:

```js
// © 2026 김용현
/**
 * GeoJSON 로더의 좌표계 처리 검증.
 *
 * 예전에는 dataProjection이 EPSG:4326으로 박혀 있어 TM 좌표 자료가
 * 지구 반대편에 찍혔다.
 */
import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import proj4 from 'proj4';
import { fromLonLat } from 'ol/proj';
import { coordinateSystem } from '../core/CoordinateSystem.js';
import { setCrsPrompt } from '../core/crsResolver.js';
import { layerManager } from '../core/LayerManager.js';
import { geojsonLoader } from './GeoJSONLoader.js';

const SEOUL = [126.9784, 37.5667];

beforeAll(() => coordinateSystem.init());
beforeEach(() => setCrsPrompt(null));

function pointCollection(coords, extra = {}) {
  return {
    type: 'FeatureCollection',
    features: [{ type: 'Feature', geometry: { type: 'Point', coordinates: coords }, properties: {} }],
    ...extra
  };
}

// 레이어의 첫 피처 좌표(3857)를 꺼낸다
function firstCoordOf(layerId) {
  return layerManager.getLayer(layerId).source.getFeatures()[0].getGeometry().getCoordinates();
}

describe('GeoJSONLoader 좌표계', () => {
  it('위경도 자료는 그대로 제자리에 놓인다', async () => {
    const id = await geojsonLoader.loadFromString(pointCollection(SEOUL), '서울.geojson');
    const [x, y] = firstCoordOf(id);
    const [ex, ey] = fromLonLat(SEOUL);
    expect(x).toBeCloseTo(ex, 0);
    expect(y).toBeCloseTo(ey, 0);
    layerManager.removeLayer(id);
  });

  it('crs 멤버가 있으면 그 좌표계로 읽는다', async () => {
    const gj = pointCollection(proj4('EPSG:4326', 'EPSG:5186', SEOUL), {
      crs: { type: 'name', properties: { name: 'urn:ogc:def:crs:EPSG::5186' } }
    });
    const id = await geojsonLoader.loadFromString(gj, '중부원점.geojson');
    const [x, y] = firstCoordOf(id);
    const [ex, ey] = fromLonLat(SEOUL);
    expect(x).toBeCloseTo(ex, 0);
    expect(y).toBeCloseTo(ey, 0);
    layerManager.removeLayer(id);
  });

  it('판정한 좌표계를 레이어에 기록한다', async () => {
    const gj = pointCollection(SEOUL);
    const id = await geojsonLoader.loadFromString(gj, '서울.geojson');
    expect(layerManager.getLayer(id).sourceCrs).toBe('EPSG:4326');
    layerManager.removeLayer(id);
  });

  it('애매하면 프롬프트가 고른 좌표계를 쓴다', async () => {
    setCrsPrompt(vi.fn().mockResolvedValue('EPSG:5186'));
    const gj = pointCollection(proj4('EPSG:4326', 'EPSG:5186', SEOUL));
    const id = await geojsonLoader.loadFromString(gj, '수수께끼.geojson');
    const [x, y] = firstCoordOf(id);
    expect(x).toBeCloseTo(fromLonLat(SEOUL)[0], 0);
    expect(y).toBeCloseTo(fromLonLat(SEOUL)[1], 0);
    layerManager.removeLayer(id);
  });

  it('취소하면 레이어를 만들지 않고 null을 준다', async () => {
    setCrsPrompt(vi.fn().mockResolvedValue(null));
    const before = layerManager.getLayers().length;
    const gj = pointCollection(proj4('EPSG:4326', 'EPSG:5186', SEOUL));
    const id = await geojsonLoader.loadFromString(gj, '취소.geojson');
    expect(id).toBeNull();
    expect(layerManager.getLayers()).toHaveLength(before);
  });
});
```

> `layerManager.getLayers()`가 없으면 `layerManager.layers.size`로 바꾼다.
> `src/core/LayerManager.js`에서 실제 이름을 확인하고 맞춘다.

- [ ] **Step 2: 실패를 확인한다**

Run: `npx vitest run src/loaders/GeoJSONLoader.test.js`
Expected: FAIL — crs 멤버 테스트에서 좌표가 어긋난다 (지금은 무조건 4326으로 읽는다)

- [ ] **Step 3: 구현한다**

`src/loaders/GeoJSONLoader.js` 맨 위 import를 바꾼다:

```js
import GeoJSON from 'ol/format/GeoJSON';
import { layerManager } from '../core/LayerManager.js';
import { resolveSourceCrs } from '../core/crsResolver.js';
import { sampleCoordsFromGeoJSON } from '../core/CrsDetector.js';
```

`loadFromString`을 통째로 바꾼다:

```js
  /**
   * GeoJSON 문자열로부터 로드
   *
   * 좌표계를 판정해 3857로 변환한다. 애매하면 확인 창이 뜨므로 비동기다.
   * 호출자는 loadFromFile·loadFromUrl 둘뿐이고 이미 비동기다.
   *
   * @param {string|Object} geojsonStr - GeoJSON 문자열 또는 객체
   * @param {string} name - 레이어 이름
   * @returns {Promise<string|null>} 레이어 ID, 사용자가 좌표계 선택을 취소하면 null
   */
  async loadFromString(geojsonStr, name = '새 레이어') {
    const geojsonObj = typeof geojsonStr === 'string'
      ? JSON.parse(geojsonStr)
      : geojsonStr;

    const { crs, cancelled } = await resolveSourceCrs(
      {
        // crs 멤버는 2016년 규격에서 빠졌지만 국내 공공데이터에는 아직 흔하다
        geojsonCrs: geojsonObj.crs,
        sampleCoords: sampleCoordsFromGeoJSON(geojsonObj)
      },
      { name, previewGeoJSON: geojsonObj }
    );
    if (cancelled) return null;

    const features = this.format.readFeatures(geojsonObj, {
      dataProjection: crs,
      featureProjection: 'EPSG:3857'
    });

    if (features.length === 0) {
      throw new Error('GeoJSON에 피처가 없습니다.');
    }

    const layerName = name.replace(/\.(geojson|json)$/i, '');

    return layerManager.addLayer({
      name: layerName,
      type: 'vector',
      features: features,
      sourceCrs: crs
    });
  }
```

`loadFromFile`의 `reader.onload`를 비동기로 바꾼다 (같은 파일 안):

```js
      reader.onload = async (e) => {
        try {
          const content = e.target.result;
          const layerId = await this.loadFromString(content, file.name);
          resolve(layerId);
        } catch (error) {
          reject(new Error('GeoJSON 파싱 실패: ' + error.message));
        }
      };
```

`loadFromUrl`의 마지막 줄을 바꾼다:

```js
    return await this.loadFromString(geojsonStr, name);
```

- [ ] **Step 4: 취소를 "로드 완료"라고 말하지 않게 한다**

`src/main.js`의 `for (const file of others)` 루프에서 `await loadFileByExtension(file);` 줄을 바꾼다:

```js
            showStatusMessage('로딩 중: ' + file.name);
            const loadedId = await loadFileByExtension(file);
            if (loadedId === null) {
              showStatusMessage('좌표계 선택을 취소했습니다: ' + file.name);
              continue;
            }
            showStatusMessage(file.name + ' 로드 완료');
```

`src/ui/panels/BrowserPanel.js`에서도 파일을 로드하고 완료 메시지를 내는 자리에
같은 `null` 검사를 넣는다 (`geojsonLoader.loadFromFile` 호출 지점 근처, 172행 부근).

- [ ] **Step 5: 통과를 확인한다**

Run: `npx vitest run src/loaders/GeoJSONLoader.test.js`
Expected: PASS (5 tests)

- [ ] **Step 6: 커밋한다** (공통 커밋 형식)

제목: `fix: GeoJSON을 원본 좌표계로 읽는다`

본문:
```
dataProjection이 EPSG:4326으로 박혀 있어 TM 좌표 GeoJSON이 늘 어긋났다.
crs 멤버와 좌표 역검증으로 판정한 좌표계를 쓴다.
확인 창이 뜰 수 있어 loadFromString이 비동기가 됐다 — 호출자는 둘 다 이미 비동기다.
```

```bash
git add src/loaders/GeoJSONLoader.js src/loaders/GeoJSONLoader.test.js src/main.js src/ui/panels/BrowserPanel.js
```

---

## Task 8: ShapefileLoader 연결 — 레거시 감지 제거

`detectProjection`(문자열 부분일치)과 `guessProjectionFromExtent`(좌표 크기 추측),
그리고 중복 `proj4.defs` 등록을 지운다. 약 90줄이 줄어든다.

**Files:**
- Modify: `src/loaders/ShapefileLoader.js` (import부, `detectProjection`, `guessProjectionFromExtent`, `loadFromComponents`, `loadFromZip`, `createLayerFromGeoJSON`, `loadFromUrl`)
- Test: `src/loaders/ShapefileLoader.crs.test.js` (신규)

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`src/loaders/ShapefileLoader.crs.test.js`:

```js
// © 2026 김용현
/**
 * Shapefile 로더의 좌표계 처리 검증.
 *
 * shp 바이너리를 만들지 않고 createLayerFromGeoJSON에 직접 넣어 검증한다.
 * (shp 파싱은 shpjs의 몫이고, 여기서 볼 것은 좌표계 처리다.)
 *
 * 예전에는 .prj를 문자열 부분일치로 훑어 EPSG:5185를 반환했는데
 * 그 좌표계는 proj4에 등록조차 없어 변환이 조용히 깨졌다.
 */
import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import proj4 from 'proj4';
import { fromLonLat } from 'ol/proj';
import { coordinateSystem } from '../core/CoordinateSystem.js';
import { setCrsPrompt } from '../core/crsResolver.js';
import { layerManager } from '../core/LayerManager.js';
import { shapefileLoader } from './ShapefileLoader.js';

const SEOUL = [126.9784, 37.5667];

const PRJ_5186 = 'PROJCS["Korea_2000_Korea_Central_Belt",GEOGCS["GCS_Korea_2000",' +
  'DATUM["D_Korea_2000",SPHEROID["GRS_1980",6378137.0,298.257222101]],PRIMEM["Greenwich",0.0],' +
  'UNIT["Degree",0.0174532925199433]],PROJECTION["Transverse_Mercator"],' +
  'PARAMETER["False_Easting",200000.0],PARAMETER["False_Northing",600000.0],' +
  'PARAMETER["Central_Meridian",127.0],PARAMETER["Scale_Factor",1.0],' +
  'PARAMETER["Latitude_Of_Origin",38.0],UNIT["Meter",1.0],AUTHORITY["EPSG","5186"]]';

// 서부원점. 예전 코드가 EPSG:5185를 반환하면서 정의가 없어 깨지던 자리다.
const PRJ_5185 = 'PROJCS["Korea_2000_Korea_West_Belt",GEOGCS["GCS_Korea_2000",' +
  'DATUM["D_Korea_2000",SPHEROID["GRS_1980",6378137.0,298.257222101]],PRIMEM["Greenwich",0.0],' +
  'UNIT["Degree",0.0174532925199433]],PROJECTION["Transverse_Mercator"],' +
  'PARAMETER["False_Easting",200000.0],PARAMETER["False_Northing",600000.0],' +
  'PARAMETER["Central_Meridian",125.0],PARAMETER["Scale_Factor",1.0],' +
  'PARAMETER["Latitude_Of_Origin",38.0],UNIT["Meter",1.0],AUTHORITY["EPSG","5185"]]';

beforeAll(() => coordinateSystem.init());
beforeEach(() => setCrsPrompt(null));

function pointCollection(coords) {
  return {
    type: 'FeatureCollection',
    features: [{ type: 'Feature', geometry: { type: 'Point', coordinates: coords }, properties: {} }]
  };
}

function firstCoordOf(layerId) {
  return layerManager.getLayer(layerId).source.getFeatures()[0].getGeometry().getCoordinates();
}

describe('ShapefileLoader 좌표계', () => {
  it('.prj의 EPSG 코드로 읽는다', async () => {
    const gj = pointCollection(proj4('EPSG:4326', 'EPSG:5186', SEOUL));
    const id = await shapefileLoader.createLayerFromGeoJSON(gj, '학교', PRJ_5186);
    const [x, y] = firstCoordOf(id);
    expect(x).toBeCloseTo(fromLonLat(SEOUL)[0], 0);
    expect(y).toBeCloseTo(fromLonLat(SEOUL)[1], 0);
    layerManager.removeLayer(id);
  });

  it('서부원점(5185)도 변환된다 — 예전에는 정의가 없어 깨졌다', async () => {
    const gj = pointCollection(proj4('EPSG:4326', 'EPSG:5185', SEOUL));
    const id = await shapefileLoader.createLayerFromGeoJSON(gj, '서부', PRJ_5185);
    const [x, y] = firstCoordOf(id);
    expect(x).toBeCloseTo(fromLonLat(SEOUL)[0], 0);
    expect(y).toBeCloseTo(fromLonLat(SEOUL)[1], 0);
    layerManager.removeLayer(id);
  });

  it('.prj가 없으면 좌표 역검증으로 넘어간다', async () => {
    const prompt = vi.fn().mockResolvedValue('EPSG:5186');
    setCrsPrompt(prompt);
    const gj = pointCollection(proj4('EPSG:4326', 'EPSG:5186', SEOUL));
    const id = await shapefileLoader.createLayerFromGeoJSON(gj, 'prj없음', null);
    expect(prompt).toHaveBeenCalledOnce();
    expect(firstCoordOf(id)[0]).toBeCloseTo(fromLonLat(SEOUL)[0], 0);
    layerManager.removeLayer(id);
  });

  it('취소하면 레이어를 만들지 않는다', async () => {
    setCrsPrompt(vi.fn().mockResolvedValue(null));
    const gj = pointCollection(proj4('EPSG:4326', 'EPSG:5186', SEOUL));
    const id = await shapefileLoader.createLayerFromGeoJSON(gj, '취소', null);
    expect(id).toBeNull();
  });

  it('판정한 좌표계를 레이어에 기록한다', async () => {
    const gj = pointCollection(proj4('EPSG:4326', 'EPSG:5186', SEOUL));
    const id = await shapefileLoader.createLayerFromGeoJSON(gj, '기록', PRJ_5186);
    expect(layerManager.getLayer(id).sourceCrs).toBe('EPSG:5186');
    layerManager.removeLayer(id);
  });
});
```

- [ ] **Step 2: 실패를 확인한다**

Run: `npx vitest run src/loaders/ShapefileLoader.crs.test.js`
Expected: FAIL — `createLayerFromGeoJSON`의 세 번째 인자가 지금은 `sourceProj` 문자열이라 `.prj` WKT를 좌표계 코드로 쓰려다 어긋난다

- [ ] **Step 3: 레거시 감지를 지운다**

`src/loaders/ShapefileLoader.js` 맨 위 import 블록을 통째로 바꾼다.
**`proj4.defs` 호출 6줄과 `register(proj4)` 를 지운다** — 정의는 `CoordinateSystem`이 갖는다:

```js
/**
 * ShapefileLoader - Shapefile (.shp, .zip) 파일 로더
 * shpjs 라이브러리 사용
 *
 * 좌표계 판정은 CrsDetector가 한다. 예전에는 이 파일이 proj4.defs를 따로 등록하고
 * .prj를 문자열 부분일치로 훑었는데, CoordinateSystem의 정의와 어긋나 있었다.
 */

import shp from 'shpjs';
import GeoJSON from 'ol/format/GeoJSON';
import { layerManager } from '../core/LayerManager.js';
import { resolveSourceCrs } from '../core/crsResolver.js';
import { sampleCoordsFromGeoJSON } from '../core/CrsDetector.js';
```

`detectProjection` 메서드와 `guessProjectionFromExtent` 메서드를 통째로 지운다.

- [ ] **Step 4: createLayerFromGeoJSON이 판정까지 맡게 한다**

세 번째 인자를 `sourceProj`(코드)에서 `prj`(WKT 내용)로 바꾼다:

```js
  /**
   * GeoJSON 객체로부터 레이어 생성
   *
   * @param {Object} geojson - shpjs가 뱉은 GeoJSON (원본 좌표계 그대로)
   * @param {string} name - 레이어 이름
   * @param {string|null} prj - .prj 파일 내용(WKT). 없으면 좌표로 판정한다
   * @returns {Promise<string|null>} 레이어 ID, 취소하면 null
   */
  async createLayerFromGeoJSON(geojson, name, prj = null) {
    const { crs, cancelled } = await resolveSourceCrs(
      { prj, sampleCoords: sampleCoordsFromGeoJSON(geojson) },
      { name, previewGeoJSON: geojson }
    );
    if (cancelled) return null;

    const features = this.format.readFeatures(geojson, {
      dataProjection: crs,
      featureProjection: 'EPSG:3857'
    });

    if (features.length === 0) {
      throw new Error('Shapefile에 피처가 없습니다.');
    }

    const layerId = layerManager.addLayer({
      name: name,
      type: 'vector',
      features: features,
      sourceCrs: crs
    });

    // 레이어 범위로 지도 이동
    setTimeout(() => {
      layerManager.zoomToLayer(layerId);
    }, 100);

    return layerId;
  }
```

- [ ] **Step 5: 호출부 네 곳을 맞춘다**

`loadFromComponents`에서 좌표계 감지 블록(`let sourceProj = ...` 부터 `console.log('감지된 좌표계:', sourceProj);` 까지)을 지우고, 아래처럼 `components.prj`를 그대로 넘긴다:

```js
    const zipBlob = await zip.generateAsync({ type: 'arraybuffer' });
    const geojson = await shp(zipBlob);

    if (Array.isArray(geojson)) {
      const layerIds = [];
      for (let i = 0; i < geojson.length; i++) {
        const layerId = await this.createLayerFromGeoJSON(geojson[i], baseName + '_' + (i + 1), components.prj);
        if (layerId) layerIds.push(layerId);
      }
      return layerIds;
    }
    return await this.createLayerFromGeoJSON(geojson, baseName, components.prj);
```

`loadFromZip`에서도 감지 블록을 지우고 `prjContent`를 그대로 넘긴다:

```js
          const geojson = await shp(arrayBuffer);
          const name = file.name.replace('.zip', '');

          if (Array.isArray(geojson)) {
            const layerIds = [];
            for (let i = 0; i < geojson.length; i++) {
              const layerId = await this.createLayerFromGeoJSON(geojson[i], name + '_' + (i + 1), prjContent);
              if (layerId) layerIds.push(layerId);
            }
            resolve(layerIds);
          } else {
            resolve(await this.createLayerFromGeoJSON(geojson, name, prjContent));
          }
```

`loadFromUrl`의 두 호출에도 `await`를 붙인다 (`.prj`는 shpjs가 이미 반영하므로 세 번째 인자 없음):

```js
      if (Array.isArray(geojson)) {
        const layerIds = [];
        for (let i = 0; i < geojson.length; i++) {
          const layerId = await this.createLayerFromGeoJSON(geojson[i], name + '_' + (i + 1));
          if (layerId) layerIds.push(layerId);
        }
        return layerIds;
      }
      return await this.createLayerFromGeoJSON(geojson, name);
```

- [ ] **Step 6: 통과를 확인한다**

Run: `npx vitest run src/loaders/ShapefileLoader.crs.test.js`
Expected: PASS (5 tests)

전체 테스트도 돌려 회귀가 없는지 본다.

Run: `npm test`
Expected: 전부 PASS

- [ ] **Step 7: 커밋한다** (공통 커밋 형식)

제목: `refactor: Shapefile 좌표계 감지를 CrsDetector에 맡긴다`

본문:
```
detectProjection은 .prj를 문자열 부분일치로 훑어 정의에도 없는 EPSG:5185를
반환했고, 그때 변환이 조용히 깨졌다. guessProjectionFromExtent는 좌표 크기로
짐작해 5186과 5181을 구분하지 못했다. 둘 다 지운다.
proj4.defs 중복 등록도 없앤다 — 정의는 CoordinateSystem이 갖는다.
```

```bash
git add src/loaders/ShapefileLoader.js src/loaders/ShapefileLoader.crs.test.js
```

---

## Task 9: GeoPackageLoader 연결

`'EPSG:' + srs_id` 는 proj4에 없는 코드면 그대로 실패한다. 판정을 거치게 한다.

**Files:**
- Modify: `src/loaders/GeoPackageLoader.js:135-210` (`loadTable`)
- Test: `src/loaders/GeoPackageLoader.crs.test.js` (신규)

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`loadTable`은 sql.js 데이터베이스를 받으므로 좌표계 부분만 떼어 검증한다.
`loadTable`에서 GeoJSON을 만든 뒤 레이어를 만드는 부분을 `createLayerFromFeatures`로 뽑고 그걸 테스트한다.

`src/loaders/GeoPackageLoader.crs.test.js`:

```js
// © 2026 김용현
/**
 * GeoPackage 로더의 좌표계 처리 검증.
 *
 * 예전에는 'EPSG:' + srs_id 를 그대로 썼다. proj4에 없는 코드면 변환이 실패했다.
 */
import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import proj4 from 'proj4';
import { fromLonLat } from 'ol/proj';
import { coordinateSystem } from '../core/CoordinateSystem.js';
import { setCrsPrompt } from '../core/crsResolver.js';
import { layerManager } from '../core/LayerManager.js';
import { geopackageLoader } from './GeoPackageLoader.js';

const SEOUL = [126.9784, 37.5667];

beforeAll(() => coordinateSystem.init());
beforeEach(() => setCrsPrompt(null));

function featureList(coords) {
  return [{ type: 'Feature', geometry: { type: 'Point', coordinates: coords }, properties: {} }];
}

function firstCoordOf(layerId) {
  return layerManager.getLayer(layerId).source.getFeatures()[0].getGeometry().getCoordinates();
}

describe('GeoPackageLoader 좌표계', () => {
  it('srs_id를 좌표계로 쓴다', async () => {
    const id = await geopackageLoader.createLayerFromFeatures(
      featureList(proj4('EPSG:4326', 'EPSG:5186', SEOUL)), '가게', 5186
    );
    expect(firstCoordOf(id)[0]).toBeCloseTo(fromLonLat(SEOUL)[0], 0);
    layerManager.removeLayer(id);
  });

  it('우리가 모르는 srs_id면 좌표로 판정한다', async () => {
    const prompt = vi.fn().mockResolvedValue('EPSG:5186');
    setCrsPrompt(prompt);
    // 31370(벨기에)은 정의에 없다 → 근거로 삼지 않고 역검증으로 넘어간다
    const id = await geopackageLoader.createLayerFromFeatures(
      featureList(proj4('EPSG:4326', 'EPSG:5186', SEOUL)), '수수께끼', 31370
    );
    expect(prompt).toHaveBeenCalledOnce();
    expect(firstCoordOf(id)[0]).toBeCloseTo(fromLonLat(SEOUL)[0], 0);
    layerManager.removeLayer(id);
  });

  it('4326 자료는 묻지 않고 통과한다', async () => {
    const prompt = vi.fn();
    setCrsPrompt(prompt);
    const id = await geopackageLoader.createLayerFromFeatures(featureList(SEOUL), '위경도', 4326);
    expect(prompt).not.toHaveBeenCalled();
    expect(layerManager.getLayer(id).sourceCrs).toBe('EPSG:4326');
    layerManager.removeLayer(id);
  });

  it('취소하면 레이어를 만들지 않는다', async () => {
    setCrsPrompt(vi.fn().mockResolvedValue(null));
    const id = await geopackageLoader.createLayerFromFeatures(
      featureList(proj4('EPSG:4326', 'EPSG:5186', SEOUL)), '취소', 0
    );
    expect(id).toBeNull();
  });
});
```

- [ ] **Step 2: 실패를 확인한다**

Run: `npx vitest run src/loaders/GeoPackageLoader.crs.test.js`
Expected: FAIL — `createLayerFromFeatures is not a function`

- [ ] **Step 3: 구현한다**

`src/loaders/GeoPackageLoader.js` 맨 위 import에 더한다:

```js
import { resolveSourceCrs } from '../core/crsResolver.js';
import { sampleCoordsFromGeoJSON } from '../core/CrsDetector.js';
```

`loadTable`에서 `if (features.length === 0) { return null; }` 아래의
GeoJSON 생성 · `readFeatures` · `addLayer` 블록을 아래 한 줄로 바꾼다:

```js
    return await this.createLayerFromFeatures(features, baseName + ' - ' + table_name, srs_id);
```

`loadTable`을 `async` 로 바꾸고, 그 호출부에도 `await`를 붙인다
(같은 파일에서 `loadTable(` 을 부르는 곳을 모두 찾아 고친다).

파일에 메서드를 더한다:

```js
  /**
   * GeoJSON 피처 배열로부터 레이어를 만든다.
   *
   * srs_id는 근거로 쓰되 우리가 모르는 코드면 좌표 역검증으로 넘어간다.
   * 예전에는 'EPSG:' + srs_id 를 그대로 써서 변환이 실패했다.
   *
   * @param {Array} features - GeoJSON Feature 배열 (원본 좌표계 그대로)
   * @param {string} layerName - 레이어 이름
   * @param {number} srsId - gpkg_geometry_columns.srs_id
   * @returns {Promise<string|null>} 레이어 ID, 취소하면 null
   */
  async createLayerFromFeatures(features, layerName, srsId) {
    const geojson = { type: 'FeatureCollection', features: features };

    const { crs, cancelled } = await resolveSourceCrs(
      { srsId, sampleCoords: sampleCoordsFromGeoJSON(geojson) },
      { name: layerName, previewGeoJSON: geojson }
    );
    if (cancelled) return null;

    const olFeatures = this.format.readFeatures(geojson, {
      dataProjection: crs,
      featureProjection: 'EPSG:3857'
    });

    return layerManager.addLayer({
      name: layerName,
      type: 'vector',
      features: olFeatures,
      sourceCrs: crs
    });
  }
```

> `loadTable`의 기존 `addLayer` 호출이 넘기던 다른 옵션(있다면)을 위 호출에 그대로 옮긴다.
> 옮길 것이 없으면 위 코드가 전부다.

- [ ] **Step 4: 통과를 확인한다**

Run: `npx vitest run src/loaders/GeoPackageLoader.crs.test.js`
Expected: PASS (4 tests)

- [ ] **Step 5: 커밋한다** (공통 커밋 형식)

제목: `fix: GeoPackage srs_id를 검증해서 쓴다`

본문:
```
'EPSG:' + srs_id 를 그대로 써서 proj4에 없는 코드면 변환이 실패했다.
정의에 있는 코드만 근거로 삼고, 아니면 좌표 역검증으로 넘어간다.
레이어 생성부를 createLayerFromFeatures로 떼어 sql.js 없이 테스트한다.
```

```bash
git add src/loaders/GeoPackageLoader.js src/loaders/GeoPackageLoader.crs.test.js
```

---

## Task 10: CrsConfirmDialog — 본 지도 미리보기

후보를 고르면 본 지도에 임시 레이어로 즉시 그리고 그 범위로 이동한다.
**임시 레이어가 지도에 남는 것이 이 기능의 유일한 실패 모드다.** 확인·취소·ESC·
오버레이 클릭이 모두 `finish()` 하나를 거치게 해서 막는다.

**Files:**
- Create: `src/ui/dialogs/CrsConfirmDialog.js`
- Modify: `src/styles/main.css` (파일 끝에 추가)
- Modify: `src/main.js:18` 부근(import), `src/main.js:76` 부근(등록)
- Test: `src/ui/dialogs/CrsConfirmDialog.test.js` (신규)

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`src/ui/dialogs/CrsConfirmDialog.test.js`:

```js
// © 2026 김용현
// @vitest-environment jsdom
/**
 * 좌표계 확인 창 검증.
 *
 * 이 창의 유일한 실패 모드는 미리보기 임시 레이어가 지도에 남는 것이다.
 * 종료 경로(확인·취소·ESC·오버레이)마다 지워지는지 확인한다.
 */
import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest';
import proj4 from 'proj4';
import { coordinateSystem } from '../../core/CoordinateSystem.js';
import { mapManager } from '../../core/MapManager.js';
import { crsConfirmDialog } from './CrsConfirmDialog.js';

const SEOUL = [126.9784, 37.5667];

// 지도를 흉내낸다 — addLayer/removeLayer만 보면 된다
function fakeMap() {
  const layers = [];
  return {
    layers,
    addLayer: (l) => layers.push(l),
    removeLayer: (l) => {
      const i = layers.indexOf(l);
      if (i >= 0) layers.splice(i, 1);
    },
    getView: () => ({ fit: vi.fn() })
  };
}

let map;

beforeAll(() => coordinateSystem.init());

beforeEach(() => {
  map = fakeMap();
  vi.spyOn(mapManager, 'getMap').mockReturnValue(map);
  document.body.innerHTML = '';
});

afterEach(() => vi.restoreAllMocks());

const DETECTION = {
  crs: 'EPSG:5186',
  confidence: 'ambiguous',
  reason: '좌표 역검증 (한국 영역에 맞는 후보 2개)',
  candidates: [
    { crs: 'EPSG:5186', name: 'Korea 2000 / 중부원점', center: SEOUL },
    { crs: 'EPSG:5181', name: 'Korea 2000 / 중부원점 (y_0=500000)', center: [126.98, 38.47] }
  ]
};

function context() {
  return {
    name: '학교',
    previewGeoJSON: {
      type: 'FeatureCollection',
      features: [{
        type: 'Feature',
        geometry: { type: 'Point', coordinates: proj4('EPSG:4326', 'EPSG:5186', SEOUL) },
        properties: {}
      }]
    }
  };
}

describe('CrsConfirmDialog', () => {
  it('후보를 모두 그리고 첫 후보를 미리 보여준다', async () => {
    const promise = crsConfirmDialog.pick(DETECTION, context());
    expect(document.querySelectorAll('input[name="crs-candidate"]')).toHaveLength(2);
    expect(document.querySelector('input[name="crs-candidate"]').checked).toBe(true);
    expect(map.layers).toHaveLength(1);
    document.getElementById('crs-confirm-cancel').click();
    await promise;
  });

  it('확인하면 고른 좌표계를 주고 미리보기를 걷는다', async () => {
    const promise = crsConfirmDialog.pick(DETECTION, context());
    document.querySelector('input[value="EPSG:5181"]').click();
    document.getElementById('crs-confirm-apply').click();
    await expect(promise).resolves.toBe('EPSG:5181');
    expect(map.layers).toHaveLength(0);
    expect(document.querySelector('.crs-confirm-modal')).toBeNull();
  });

  it('취소하면 null을 주고 미리보기를 걷는다', async () => {
    const promise = crsConfirmDialog.pick(DETECTION, context());
    document.getElementById('crs-confirm-cancel').click();
    await expect(promise).resolves.toBeNull();
    expect(map.layers).toHaveLength(0);
  });

  it('ESC로 닫아도 미리보기를 걷는다', async () => {
    const promise = crsConfirmDialog.pick(DETECTION, context());
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await expect(promise).resolves.toBeNull();
    expect(map.layers).toHaveLength(0);
  });

  it('오버레이를 눌러 닫아도 미리보기를 걷는다', async () => {
    const promise = crsConfirmDialog.pick(DETECTION, context());
    document.querySelector('.crs-confirm-modal').click();
    await expect(promise).resolves.toBeNull();
    expect(map.layers).toHaveLength(0);
  });

  it('후보를 바꿔도 미리보기 레이어는 하나만 남는다', async () => {
    const promise = crsConfirmDialog.pick(DETECTION, context());
    document.querySelector('input[value="EPSG:5181"]').click();
    document.querySelector('input[value="EPSG:5186"]').click();
    expect(map.layers).toHaveLength(1);
    document.getElementById('crs-confirm-cancel').click();
    await promise;
  });

  it('후보에 없는 좌표계도 드롭다운으로 고를 수 있다', async () => {
    const promise = crsConfirmDialog.pick(DETECTION, context());
    const select = document.getElementById('crs-confirm-other');
    select.value = 'EPSG:5179';
    select.dispatchEvent(new Event('change', { bubbles: true }));
    document.getElementById('crs-confirm-apply').click();
    await expect(promise).resolves.toBe('EPSG:5179');
  });

  it('레이어 이름을 그대로 innerHTML에 넣지 않는다', async () => {
    const ctx = context();
    ctx.name = '<img src=x onerror=alert(1)>';
    const promise = crsConfirmDialog.pick(DETECTION, ctx);
    expect(document.querySelector('.crs-confirm-modal img')).toBeNull();
    document.getElementById('crs-confirm-cancel').click();
    await promise;
  });
});
```

- [ ] **Step 2: 실패를 확인한다**

Run: `npx vitest run src/ui/dialogs/CrsConfirmDialog.test.js`
Expected: FAIL — `Failed to resolve import "./CrsConfirmDialog.js"`

- [ ] **Step 3: 구현한다**

`src/ui/dialogs/CrsConfirmDialog.js`:

```js
// © 2026 김용현
/**
 * CrsConfirmDialog - 좌표계가 애매할 때 후보를 지도에 그려 보여주고 고르게 한다.
 *
 * 좌표계 코드를 몰라도 "어디에 찍히는지"로 판단할 수 있게 하는 것이 목적이다.
 * 후보를 고르면 본 지도에 임시 레이어로 즉시 그린다. LayerManager를 거치지 않고
 * map.addLayer로 직접 올리므로 레이어 패널·히스토리·자동저장에 흔적이 남지 않는다.
 *
 * 이 창의 유일한 실패 모드는 임시 레이어가 지도에 남는 것이다.
 * 확인·취소·ESC·오버레이 클릭이 모두 finish() 하나를 거치게 해서 막는다.
 */
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import GeoJSON from 'ol/format/GeoJSON';
import { Style, Fill, Stroke, Circle as CircleStyle } from 'ol/style';
import { mapManager } from '../../core/MapManager.js';
import { coordinateSystem } from '../../core/CoordinateSystem.js';
import { escapeHtml } from '../../utils/escapeHtml.js';

// 대용량에서도 즉시 반응하도록 표본만 그린다
const PREVIEW_LIMIT = 500;

const PREVIEW_STYLE = new Style({
  image: new CircleStyle({
    radius: 5,
    fill: new Fill({ color: 'rgba(255, 102, 0, 0.85)' }),
    stroke: new Stroke({ color: '#ffffff', width: 1.5 })
  }),
  fill: new Fill({ color: 'rgba(255, 102, 0, 0.25)' }),
  stroke: new Stroke({ color: '#ff6600', width: 2 })
});

// 위치 표시 아이콘 (선 SVG)
const PIN_ICON = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" ' +
  'stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">' +
  '<path d="M12 21s-7-6.2-7-11a7 7 0 1 1 14 0c0 4.8-7 11-7 11z"/><circle cx="12" cy="10" r="2.5"/></svg>';

class CrsConfirmDialog {
  constructor() {
    this.modal = null;
    this.previewLayer = null;
    this.resolve = null;
    this.onKeyDown = null;
    this.format = new GeoJSON();
  }

  /**
   * 후보를 보여주고 하나를 고르게 한다.
   *
   * @param {Object} detection - CrsDetector.detectCrs 결과
   * @param {Object} context - { name, previewGeoJSON }
   * @returns {Promise<string|null>} 고른 좌표계 코드, 취소하면 null
   */
  pick(detection, context = {}) {
    // 앞선 창이 남아 있으면 취소로 닫는다 (겹쳐 뜨지 않게)
    if (this.modal) this.finish(null);

    return new Promise((resolve) => {
      this.resolve = resolve;
      this.previewGeoJSON = this.samplePreview(context.previewGeoJSON);
      this.render(detection, context.name || '새 레이어');
      this.bindEvents();
      this.showPreview(detection.crs);
    });
  }

  /** 미리보기는 표본만 그린다 — 수만 개를 그리면 창이 뜨는 데 시간이 걸린다 */
  samplePreview(geojson) {
    const features = geojson && Array.isArray(geojson.features) ? geojson.features : [];
    return { type: 'FeatureCollection', features: features.slice(0, PREVIEW_LIMIT) };
  }

  render(detection, name) {
    const rows = detection.candidates.map((candidate, index) => {
      const place = candidate.center
        ? '경도 ' + candidate.center[0].toFixed(4) + ', 위도 ' + candidate.center[1].toFixed(4)
        : '위치 미상';
      return '<label class="crs-candidate">' +
        '<input type="radio" name="crs-candidate" value="' + escapeHtml(candidate.crs) + '"' +
        (index === 0 ? ' checked' : '') + '>' +
        '<span class="crs-candidate-body">' +
          '<span class="crs-candidate-name">' + escapeHtml(candidate.name) + '</span>' +
          '<span class="crs-candidate-code">' + escapeHtml(candidate.crs) + '</span>' +
          '<span class="crs-candidate-place">' + PIN_ICON + escapeHtml(place) + '</span>' +
        '</span>' +
      '</label>';
    }).join('');

    const options = coordinateSystem.getAvailableCRS().map((crs) =>
      '<option value="' + escapeHtml(crs.code) + '">' +
      escapeHtml(crs.name + ' (' + crs.code + ')') + '</option>'
    ).join('');

    this.modal = document.createElement('div');
    this.modal.className = 'modal-overlay crs-confirm-modal active';
    this.modal.innerHTML =
      '<div class="modal-content crs-confirm-content">' +
        '<div class="modal-header">' +
          '<h3>좌표계 확인 — ' + escapeHtml(name) + '</h3>' +
          '<button class="modal-close" id="crs-confirm-close">&times;</button>' +
        '</div>' +
        '<div class="modal-body">' +
          '<p class="crs-confirm-reason">' + escapeHtml(detection.reason) +
            '. 고르면 지도에 그려 보여줍니다.</p>' +
          '<div class="crs-candidate-list">' + rows + '</div>' +
          '<div class="form-group">' +
            '<label for="crs-confirm-other">목록에 없다면 직접 고르기</label>' +
            '<select id="crs-confirm-other"><option value="">선택 안 함</option>' + options + '</select>' +
          '</div>' +
        '</div>' +
        '<div class="modal-footer">' +
          '<button class="btn btn-secondary" id="crs-confirm-cancel">취소</button>' +
          '<button class="btn btn-primary" id="crs-confirm-apply">이 좌표계로 가져오기</button>' +
        '</div>' +
      '</div>';

    document.body.appendChild(this.modal);
  }

  bindEvents() {
    const select = this.modal.querySelector('#crs-confirm-other');

    this.modal.querySelectorAll('input[name="crs-candidate"]').forEach((radio) => {
      radio.addEventListener('change', () => {
        select.value = '';
        this.showPreview(radio.value);
      });
    });

    select.addEventListener('change', () => {
      if (!select.value) return;
      this.modal.querySelectorAll('input[name="crs-candidate"]').forEach((r) => { r.checked = false; });
      this.showPreview(select.value);
    });

    this.modal.querySelector('#crs-confirm-apply')
      .addEventListener('click', () => this.finish(this.selectedCrs()));
    this.modal.querySelector('#crs-confirm-cancel')
      .addEventListener('click', () => this.finish(null));
    this.modal.querySelector('#crs-confirm-close')
      .addEventListener('click', () => this.finish(null));

    // 오버레이(창 바깥) 클릭
    this.modal.addEventListener('click', (e) => {
      if (e.target === this.modal) this.finish(null);
    });

    this.onKeyDown = (e) => {
      if (e.key === 'Escape') this.finish(null);
    };
    document.addEventListener('keydown', this.onKeyDown);
  }

  selectedCrs() {
    const select = this.modal.querySelector('#crs-confirm-other');
    if (select && select.value) return select.value;
    const radio = this.modal.querySelector('input[name="crs-candidate"]:checked');
    return radio ? radio.value : null;
  }

  /** 고른 좌표계로 본 지도에 임시로 그리고 그 범위로 이동한다 */
  showPreview(crs) {
    this.clearPreview();

    const map = mapManager.getMap();
    if (!map || !crs) return;

    let features;
    try {
      features = this.format.readFeatures(this.previewGeoJSON, {
        dataProjection: crs,
        featureProjection: 'EPSG:3857'
      });
    } catch (error) {
      console.warn('미리보기 변환 실패:', crs, error);
      return;
    }
    if (features.length === 0) return;

    const source = new VectorSource({ features });
    this.previewLayer = new VectorLayer({
      source,
      style: PREVIEW_STYLE,
      // 레이어 패널에 뜨지 않도록 LayerManager를 거치지 않는다
      zIndex: 9999
    });
    map.addLayer(this.previewLayer);

    const extent = source.getExtent();
    if (extent && Number.isFinite(extent[0])) {
      map.getView().fit(extent, { padding: [80, 80, 80, 80], maxZoom: 16, duration: 300 });
    }
  }

  clearPreview() {
    if (!this.previewLayer) return;
    const map = mapManager.getMap();
    if (map) map.removeLayer(this.previewLayer);
    this.previewLayer = null;
  }

  /**
   * 모든 종료 경로가 여기를 지난다. 미리보기를 걷고, 창을 닫고, 약속을 지킨다.
   * 경로를 하나로 모으는 것이 이 창의 안전장치다.
   */
  finish(result) {
    this.clearPreview();

    if (this.onKeyDown) {
      document.removeEventListener('keydown', this.onKeyDown);
      this.onKeyDown = null;
    }
    if (this.modal) {
      this.modal.remove();
      this.modal = null;
    }
    const resolve = this.resolve;
    this.resolve = null;
    if (resolve) resolve(result || null);
  }
}

export const crsConfirmDialog = new CrsConfirmDialog();
```

- [ ] **Step 4: 스타일을 더한다**

`src/styles/main.css` 끝에 붙인다:

```css
/* 좌표계 확인 창 — 후보를 고르면 본 지도에 미리 그린다 */
.crs-confirm-content {
  max-width: 460px;
}

.crs-confirm-reason {
  margin: 0 0 12px;
  font-size: 13px;
  color: var(--text-secondary);
}

.crs-candidate-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 16px;
}

.crs-candidate {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 10px 12px;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  cursor: pointer;
}

.crs-candidate:hover {
  border-color: var(--primary-color);
}

.crs-candidate-body {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.crs-candidate-name {
  font-weight: 600;
}

.crs-candidate-code,
.crs-candidate-place {
  font-size: 12px;
  color: var(--text-secondary);
}

.crs-candidate-place {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
```

> `--text-secondary`·`--border-color`·`--primary-color` 이름이 `src/styles/variables.css`와
> 다르면 그 파일의 실제 이름으로 바꾼다.

- [ ] **Step 5: main.js에 등록한다**

`src/main.js` import 블록에 더한다:

```js
import { setCrsPrompt } from './core/crsResolver.js';
import { crsConfirmDialog } from './ui/dialogs/CrsConfirmDialog.js';
```

`initApp` 안 `coordinateSystem.init();` 바로 아래에 더한다:

```js
  // 좌표계가 애매할 때 물어볼 창을 등록한다.
  // core/는 ui/를 모르므로 여기서 이어 붙인다.
  setCrsPrompt((detection, context) => crsConfirmDialog.pick(detection, context));
```

- [ ] **Step 6: 통과를 확인한다**

Run: `npx vitest run src/ui/dialogs/CrsConfirmDialog.test.js`
Expected: PASS (8 tests)

- [ ] **Step 7: 커밋한다** (공통 커밋 형식)

제목: `feat: 좌표계가 애매하면 지도에 미리 그려 고르게 한다`

본문:
```
후보를 라디오로 고르면 본 지도에 임시 레이어로 즉시 그리고 그 범위로 이동한다.
LayerManager를 거치지 않고 map.addLayer로 올려 레이어 패널·히스토리·자동저장에
흔적을 남기지 않는다. 표본 500개만 그려 대용량에서도 즉시 반응한다.
확인·취소·ESC·오버레이 클릭이 모두 finish() 하나를 지나 임시 레이어를 걷는다.
```

```bash
git add src/ui/dialogs/CrsConfirmDialog.js src/ui/dialogs/CrsConfirmDialog.test.js src/styles/main.css src/main.js
```

---

## Task 11: 표(CSV·Excel) 좌표계 선택

지금은 무조건 `fromLonLat`이라 TM 좌표 표는 위경도 범위 검사에 걸려 전 행이 버려진다.

**Files:**
- Modify: `src/loaders/TableLoader.js` (import, `createPointLayer`)
- Modify: `src/ui/panels/CoordinateImportPanel.js` (모달 HTML, 이벤트, `createLayer`)
- Test: `src/loaders/TableLoader.crs.test.js` (신규)

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`src/loaders/TableLoader.crs.test.js`:

```js
// © 2026 김용현
/**
 * 표 좌표 가져오기의 좌표계 처리 검증.
 *
 * 예전에는 무조건 위경도로 봤다. TM 좌표 표는 범위 검사(-90~90)에 걸려
 * 전 행이 버려지고 "유효한 좌표가 있는 행이 없습니다"만 떴다.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import proj4 from 'proj4';
import { fromLonLat } from 'ol/proj';
import { coordinateSystem } from '../core/CoordinateSystem.js';
import { layerManager } from '../core/LayerManager.js';
import { tableLoader } from './TableLoader.js';

const SEOUL = [126.9784, 37.5667];

beforeAll(() => coordinateSystem.init());

function firstCoordOf(layerId) {
  return layerManager.getLayer(layerId).source.getFeatures()[0].getGeometry().getCoordinates();
}

describe('TableLoader 좌표계', () => {
  it('기본은 위경도다 (기존 동작)', () => {
    tableLoader.data = [{ 위도: SEOUL[1], 경도: SEOUL[0], 이름: '시청' }];
    const { layerId, featureCount } = tableLoader.createPointLayer('위도', '경도', '시청');
    expect(featureCount).toBe(1);
    expect(firstCoordOf(layerId)[0]).toBeCloseTo(fromLonLat(SEOUL)[0], 0);
    layerManager.removeLayer(layerId);
    tableLoader.clear();
  });

  it('TM 좌표계를 고르면 그 좌표계로 변환한다', () => {
    const [x, y] = proj4('EPSG:4326', 'EPSG:5186', SEOUL);
    tableLoader.data = [{ Y: y, X: x, 이름: '시청' }];
    const { layerId, featureCount } = tableLoader.createPointLayer('Y', 'X', '시청', 'EPSG:5186');
    expect(featureCount).toBe(1);
    const [mx, my] = firstCoordOf(layerId);
    expect(mx).toBeCloseTo(fromLonLat(SEOUL)[0], 0);
    expect(my).toBeCloseTo(fromLonLat(SEOUL)[1], 0);
    layerManager.removeLayer(layerId);
    tableLoader.clear();
  });

  it('TM 좌표를 위경도로 읽지 않는다 — 예전에는 전 행이 버려졌다', () => {
    const [x, y] = proj4('EPSG:4326', 'EPSG:5186', SEOUL);
    tableLoader.data = [{ Y: y, X: x }];
    expect(() => tableLoader.createPointLayer('Y', 'X', '버려짐')).toThrow(/유효한 좌표/);
    tableLoader.clear();
  });

  it('레이어에 원본 좌표계를 기록한다', () => {
    const [x, y] = proj4('EPSG:4326', 'EPSG:5186', SEOUL);
    tableLoader.data = [{ Y: y, X: x }];
    const { layerId } = tableLoader.createPointLayer('Y', 'X', '기록', 'EPSG:5186');
    expect(layerManager.getLayer(layerId).sourceCrs).toBe('EPSG:5186');
    layerManager.removeLayer(layerId);
    tableLoader.clear();
  });
});
```

- [ ] **Step 2: 실패를 확인한다**

Run: `npx vitest run src/loaders/TableLoader.crs.test.js`
Expected: FAIL — TM 테스트에서 "유효한 좌표가 있는 행이 없습니다"

- [ ] **Step 3: 구현한다**

`src/loaders/TableLoader.js` 맨 위 import에 더한다:

```js
import proj4 from 'proj4';
```

`createPointLayer`의 시그니처와 좌표 변환부를 바꾼다:

```js
  /**
   * 좌표 컬럼으로 포인트 레이어를 만든다.
   *
   * @param {string} latColumn - 위도(Y) 컬럼
   * @param {string} lonColumn - 경도(X) 컬럼
   * @param {string} layerName - 레이어 이름
   * @param {string} sourceCrs - 좌표 컬럼의 좌표계. 기본은 위경도
   */
  createPointLayer(latColumn, lonColumn, layerName = null, sourceCrs = 'EPSG:4326') {
    if (!this.data || !latColumn || !lonColumn) {
      throw new Error("데이터와 좌표 컬럼을 지정해주세요.");
    }

    const isLonLat = sourceCrs === 'EPSG:4326';
    const features = [];
    let skippedCount = 0;

    for (const row of this.data) {
      const lat = parseFloat(row[latColumn]);
      const lon = parseFloat(row[lonColumn]);

      if (isNaN(lat) || isNaN(lon)) {
        skippedCount++;
        continue;
      }

      // 위경도 범위 검사는 위경도일 때만 뜻이 있다.
      // TM 좌표(수십만 m)에 이 검사를 걸면 전 행이 버려진다.
      if (isLonLat && (lat < -90 || lat > 90 || lon < -180 || lon > 180)) {
        skippedCount++;
        continue;
      }

      let coords;
      try {
        coords = isLonLat
          ? fromLonLat([lon, lat])
          : proj4(sourceCrs, 'EPSG:3857', [lon, lat]);
      } catch (error) {
        skippedCount++;
        continue;
      }
      if (!Number.isFinite(coords[0]) || !Number.isFinite(coords[1])) {
        skippedCount++;
        continue;
      }

      const point = new Point(coords);
```

(이후 `const feature = new Feature(...)` 부터는 그대로 둔다.)

같은 메서드 끝의 `layerManager.addLayer` 호출에 `sourceCrs`를 더한다:

```js
    const layerId = layerManager.addLayer({
      name: name,
      features: features,
      geometryType: 'Point',
      sourceCrs: sourceCrs
    });
```

- [ ] **Step 4: 패널에 드롭다운을 단다**

`src/ui/panels/CoordinateImportPanel.js` 맨 위 import에 더한다:

```js
import { coordinateSystem } from '../../core/CoordinateSystem.js';
import { detectCrs } from '../../core/CrsDetector.js';
```

`getModalHTML`의 `<label for="coord-layer-name">` 폼그룹 **앞에** 폼그룹 하나를 끼운다:

```js
          '<div class="form-group">' +
            '<label for="coord-crs">좌표계</label>' +
            '<select id="coord-crs">' + this.crsOptions() + '</select>' +
          '</div>' +
```

클래스에 메서드를 더한다:

```js
  /** 좌표계 드롭다운 항목 */
  crsOptions() {
    return coordinateSystem.getAvailableCRS().map((crs) =>
      '<option value="' + crs.code + '">' + crs.name + ' (' + crs.code + ')</option>'
    ).join('');
  }

  /**
   * 고른 컬럼의 값으로 좌표계를 추측해 드롭다운 기본값을 맞춘다.
   * 확신이 없으면 손대지 않는다 — 사용자가 이미 고른 값을 덮지 않기 위해서다.
   */
  suggestCrs() {
    const latCol = document.getElementById('coord-lat-column').value;
    const lonCol = document.getElementById('coord-lon-column').value;
    if (!latCol || !lonCol || !tableLoader.data) return;

    const sampleCoords = [];
    for (const row of tableLoader.data.slice(0, 20)) {
      const x = parseFloat(row[lonCol]);
      const y = parseFloat(row[latCol]);
      if (Number.isFinite(x) && Number.isFinite(y)) sampleCoords.push([x, y]);
    }

    const detection = detectCrs({ sampleCoords });
    if (detection.confidence === 'unknown') return;
    document.getElementById('coord-crs').value = detection.crs;
  }
```

`bindEvents`에서 컬럼 선택이 바뀔 때 `suggestCrs`를 부른다.
`latSelect`·`lonSelect`의 `change` 처리에 한 줄씩 더한다:

```js
    latSelect.addEventListener('change', () => this.suggestCrs());
    lonSelect.addEventListener('change', () => this.suggestCrs());
```

> 이미 `change` 리스너가 붙어 있으면 그 안에서 `this.suggestCrs();` 를 부른다.

`createLayer`에서 고른 좌표계를 넘긴다:

```js
    const sourceCrs = document.getElementById('coord-crs').value || 'EPSG:4326';
    ...
      const result = tableLoader.createPointLayer(latCol, lonCol, layerName, sourceCrs);
```

`src/ui/dialogs/BuiltinDataDialog.js:498`의 `createPointLayer` 호출은 구글시트 위경도
전용이므로 그대로 둔다 (네 번째 인자를 안 넘기면 위경도가 기본이다).

- [ ] **Step 5: 통과를 확인한다**

Run: `npx vitest run src/loaders/TableLoader.crs.test.js`
Expected: PASS (4 tests)

- [ ] **Step 6: 커밋한다** (공통 커밋 형식)

제목: `feat: 표 좌표 가져오기에 좌표계 선택을 단다`

본문:
```
무조건 위경도로 봐서 TM 좌표 표는 범위 검사에 걸려 전 행이 버려졌다.
좌표계를 고를 수 있게 하고, 고른 컬럼 값으로 기본값을 추측해 맞춘다.
위경도 범위 검사는 위경도를 골랐을 때만 건다.
```

```bash
git add src/loaders/TableLoader.js src/loaders/TableLoader.crs.test.js src/ui/panels/CoordinateImportPanel.js
```

---

## Task 12: DEMLoader 감지 위임

DEM은 픽셀을 다시 투영하지 않고 bbox만 변환한다 — 그 동작은 그대로 두고
**좌표계 판정만** CrsDetector에 맡긴다. `matchKoreanTM`이 `lon=125`를 `EPSG:5188`로
보내던 것도 여기서 함께 바로잡힌다 (125는 서부원점 5185다).

**Files:**
- Modify: `src/loaders/DEMLoader.js:92-120` (`matchKoreanTM` 삭제), `:143-165` (판정부)
- Test: `src/loaders/DEMLoader.crs.test.js` (신규)

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`src/loaders/DEMLoader.crs.test.js`:

```js
// © 2026 김용현
/**
 * DEM 좌표계 판정 검증.
 *
 * GeoTIFF GeoKeys를 CrsDetector가 읽을 모양으로 바꾸는 부분을 본다.
 * 예전 matchKoreanTM은 중앙경선 125를 EPSG:5188로 보냈다 — 5188은 동해원점(131)이고
 * 125는 서부원점(5185)이다.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { coordinateSystem } from '../core/CoordinateSystem.js';
import { geoKeysToParams } from './DEMLoader.js';
import { matchByProjParams } from '../core/CrsDetector.js';

beforeAll(() => coordinateSystem.init());

function tmGeoKeys(lon, fn = 600000, k = 1) {
  return {
    ProjCoordTransGeoKey: 1,
    GeogSemiMajorAxisGeoKey: 6378137,
    ProjNatOriginLongGeoKey: lon,
    ProjNatOriginLatGeoKey: 38,
    ProjFalseEastingGeoKey: 200000,
    ProjFalseNorthingGeoKey: fn,
    ProjScaleAtNatOriginGeoKey: k
  };
}

describe('geoKeysToParams', () => {
  it('GeoKeys를 CrsDetector가 읽는 모양으로 바꾼다', () => {
    expect(geoKeysToParams(tmGeoKeys(127))).toEqual({
      lon0: 127, lat0: 38, x0: 200000, y0: 600000, k: 1, ellps: 'grs80'
    });
  });

  it('중앙경선 125는 서부원점(5185)이다 — 예전에는 5188로 갔다', () => {
    expect(matchByProjParams(geoKeysToParams(tmGeoKeys(125)))).toBe('EPSG:5185');
  });

  it('중앙경선 131은 동해원점(5188)이다', () => {
    expect(matchByProjParams(geoKeysToParams(tmGeoKeys(131)))).toBe('EPSG:5188');
  });

  it('UTM-K(127.5, k=0.9996)를 알아본다', () => {
    const keys = tmGeoKeys(127.5, 2000000, 0.9996);
    keys.ProjFalseEastingGeoKey = 1000000;
    expect(matchByProjParams(geoKeysToParams(keys))).toBe('EPSG:5179');
  });

  it('횡축 메르카토르가 아니면 null이다', () => {
    expect(geoKeysToParams({ ProjCoordTransGeoKey: 8 })).toBeNull();
    expect(geoKeysToParams(null)).toBeNull();
  });
});
```

- [ ] **Step 2: 실패를 확인한다**

Run: `npx vitest run src/loaders/DEMLoader.crs.test.js`
Expected: FAIL — `geoKeysToParams is not exported`

- [ ] **Step 3: 구현한다**

`src/loaders/DEMLoader.js` 맨 위 import에 더한다:

```js
import { detectCrs } from '../core/CrsDetector.js';
```

`matchKoreanTM` 메서드를 통째로 지우고, 파일 안(클래스 밖)에 함수를 더한다:

```js
/**
 * GeoTIFF GeoKeys를 CrsDetector가 읽는 파라미터 모양으로 바꾼다.
 * 정부 GeoTIFF는 EPSG 코드를 비워 두고 파라미터만 채워 오는 일이 흔하다.
 *
 * @returns {{lon0:number, lat0:number, x0:number, y0:number, k:number, ellps:string}|null}
 */
export function geoKeysToParams(geoKeys) {
  // ProjCoordTransGeoKey 1 = 횡축 메르카토르. 한국 좌표계는 모두 여기 해당한다.
  if (!geoKeys || geoKeys.ProjCoordTransGeoKey !== 1) return null;

  const a = geoKeys.GeogSemiMajorAxisGeoKey;
  let ellps = null;
  if (a === undefined) ellps = null;
  else if (Math.abs(a - 6378137) < 0.1) ellps = 'grs80';
  else if (Math.abs(a - 6377397.155) < 0.1) ellps = 'bessel';

  const lon0 = geoKeys.ProjNatOriginLongGeoKey;
  const x0 = geoKeys.ProjFalseEastingGeoKey;
  const y0 = geoKeys.ProjFalseNorthingGeoKey;
  if (lon0 === undefined || x0 === undefined || y0 === undefined) return null;

  return {
    lon0,
    lat0: geoKeys.ProjNatOriginLatGeoKey === undefined ? 0 : geoKeys.ProjNatOriginLatGeoKey,
    x0,
    y0,
    k: geoKeys.ProjScaleAtNatOriginGeoKey === undefined ? 1 : geoKeys.ProjScaleAtNatOriginGeoKey,
    ellps
  };
}
```

`createDEMLayer`에서 좌표계 판정 블록(`let sourceProj = null;` 부터
`sourceProj = this.matchKoreanTM(geoKeys);` 를 닫는 `}` 까지)을 아래로 바꾼다:

```js
    let extent = bbox;

    // 좌표계 판정은 CrsDetector가 한다 — 다른 로더와 같은 규칙을 쓴다.
    // GeoTIFF는 EPSG 코드를 비워 두고 파라미터만 채워 오는 일이 흔하다.
    const detection = detectCrs({
      epsgCode: geoKeys && (geoKeys.ProjectedCSTypeGeoKey || geoKeys.GeographicTypeGeoKey),
      projParams: geoKeysToParams(geoKeys),
      sampleCoords: [[bbox[0], bbox[1]], [bbox[2], bbox[3]]]
    });
    const sourceProj = detection.confidence === 'unknown' ? null : detection.crs;
```

(이 아래의 `guessProjection`·`toMercator`·`if (!sourceProj)` 분기는 **그대로 둔다** —
판정이 안 될 때의 마지막 방어선이다.)

`console.log('DEM 좌표계:', ...)` 줄은 판정 근거도 함께 남기게 바꾼다:

```js
    console.log('DEM 좌표계:', sourceProj || '정의되지 않음', detection.reason, 'bbox:', bbox);
```

- [ ] **Step 4: 통과를 확인한다**

Run: `npx vitest run src/loaders/DEMLoader.crs.test.js`
Expected: PASS (5 tests)

- [ ] **Step 5: 커밋한다** (공통 커밋 형식)

제목: `fix: DEM 좌표계 판정을 CrsDetector에 맡긴다`

본문:
```
matchKoreanTM이 중앙경선 125를 EPSG:5188로 보냈다. 125는 서부원점(5185)이고
5188은 동해원점(131)이다. 판정을 다른 로더와 같은 규칙으로 모은다.
픽셀 재투영 없이 bbox만 변환하는 기존 동작과 마지막 방어선은 그대로 둔다.
```

```bash
git add src/loaders/DEMLoader.js src/loaders/DEMLoader.crs.test.js
```

---

## Task 13: 전체 회귀와 실기 검증

테스트가 통과해도 "실제로 제자리에 그려지는지"는 앱을 띄워 봐야 안다.

**Files:** 없음 (검증만)

- [ ] **Step 1: 전체 테스트**

Run: `npm test`
Expected: 전부 PASS

- [ ] **Step 2: 빌드**

Run: `rm -rf dist && npm run build`
Expected: 오류 없이 끝난다 (`dist`를 안 지우면 조용히 실패한다)

- [ ] **Step 3: 앱을 띄워 확인한다**

`.claude/skills/verify` 스킬(`Skill` 도구로 `Desktop/vibecoding/eGIS:verify`)을 따른다.
하네스로 확인할 것:

1. **위경도 GeoJSON** — 서울 한 점짜리 GeoJSON을 넣고 서울에 찍히는지, 확인 창이 **안** 뜨는지
2. **TM GeoJSON** — 같은 점을 EPSG:5186 좌표로 바꾼 GeoJSON을 넣고 확인 창이 뜨는지,
   후보를 고르면 지도에 주황색 미리보기가 나타나고 그 위치로 이동하는지
3. **취소** — 취소를 누르면 레이어가 안 생기고 **미리보기도 지도에서 사라지는지**
   (`window.__egisDebug.layerManager` 로 레이어 수를 세고, 지도 레이어 수도 함께 본다)
4. **상태바 좌표계 메뉴** — 좌표계가 16종으로 늘었으니 메뉴가 화면을 넘치지 않는지 본다.
   넘치면 목록에 스크롤을 준다 (`max-height` + `overflow-y: auto`)

- [ ] **Step 4: 확인 결과를 커밋한다** (고친 것이 있을 때만, 공통 커밋 형식)

---

## 자체 검토 결과

계획을 설계 문서와 대조해 확인한 것:

| 설계 항목 | 담당 Task |
|---|---|
| 좌표계 정의 세트 보강 · 5188 오류 | Task 1 |
| 명시적 근거 (prj·srs_id·crs 멤버·GeoTIFF 코드) | Task 2 |
| 투영 파라미터 매칭 | Task 3 |
| 역방향 검증 · confidence 3단계 · 전 지구 완화 | Task 4 |
| 확신하면 조용히 / 애매하면 묻기 | Task 5 |
| `sourceCrs` 기록 | Task 6 (기록), Task 7~11 (전달) |
| GeoJSON · Shapefile · GeoPackage · 표 · DEM 연결 | Task 7 · 8 · 9 · 11 · 12 |
| 미리보기 다이얼로그 · 단일 `cleanup()` | Task 10 |
| 취소하면 레이어를 만들지 않는다 | Task 7 · 8 · 9 (테스트 포함) |
| 표본 500개만 그리기 | Task 10 |
| 이모지 없이 선 SVG | Task 10 (`PIN_ICON`) |

**설계에 없던 추가 결정 하나** — Task 4의 *단위 온전성 검사*. 표본이 전부 경위도
범위 안이면 미터 좌표계를, 아니면 경위도 좌표계를 후보에서 뺀다. 이게 없으면
해외 위경도 자료가 3857 후보와 함께 남아 쓸데없이 확인 창이 뜬다.
설계 문서의 「역방향 검증」 절에도 이 규칙을 적어 둔다.
