# 배경지도 확장 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 배경지도를 "한국 (VWorld) 5종 + 세계 5종" 카탈로그로 바꾸고, 팝오버·3D 패널이 그 카탈로그를 그린다.

**Architecture:** `MapManager.js` 안의 `BASEMAPS`·`REFERENCE_LABELS` 를 `src/core/basemaps.js` 카탈로그로 옮긴다. 항목은 `{ key, label, group, source(), labels?() }` 한 모양이고, `labels` 가 있으면 라벨 오버레이 항목이다(지금 `SATELLITE_LABELS` 특수처리를 규칙으로 일반화). VWorld 키는 `VITE_VWORLD_KEY` 로 받고, 없으면 한국 묶음이 빠진다.

**Tech Stack:** OpenLayers 9 (`ol/source/OSM`, `ol/source/XYZ`, `ol/layer/Tile`), Vite env, Vitest. 설계: `docs/superpowers/specs/2026-09-14-basemap-catalog-design.md`

---

## 파일 구조

| 파일 | 역할 |
|---|---|
| `src/core/basemaps.js` (신규) | 카탈로그·묶음·기본값·VWorld URL 조립·조회 함수 |
| `src/core/basemaps.test.js` (신규) | 카탈로그 규칙 검증. 기존 `src/core/MapManager.test.js`(crossOrigin 회귀)를 여기로 흡수하고 그 파일은 지운다 |
| `src/core/MapManager.js` | 카탈로그 사용, `setBasemap` 오버레이 일반화, 팝오버 묶음 렌더 |
| `src/core/MapManager.setBasemap.test.js` (신규) | 오버레이 규칙 검증 |
| `src/ui/layout/AppLayout.js` | 3D 패널 배경지도 `<select>` 를 비워 두고 JS 가 채우게 |
| `src/ui/panels/View3DPanel.js` | `fillBasemapOptions()` |
| `src/styles/main.css` | 팝오버 묶음 제목 스타일 |
| `.env.example` | `VITE_VWORLD_KEY` 항목 |
| `src/ui/panels/PrivacyPolicyPanel.js` | 제7조 5번 제공자 추가, 1.3.1 |
| `public/privacy-policy.pdf`, `개인정보 처리방침(e-GIS).pdf` | 재생성 |

주의: Write 훅이 새 js 파일 맨 위에 `// © 2026 김용현` 헤더를 넣는다. 그대로 둔다.

---

### Task 1: 카탈로그 모듈 `basemaps.js`

**Files:**
- Create: `src/core/basemaps.js`
- Create: `src/core/basemaps.test.js`
- Delete: `src/core/MapManager.test.js` (내용을 새 테스트로 옮김)

- [ ] **Step 1: 실패하는 테스트 작성** — `src/core/basemaps.test.js`

```js
/**
 * 배경지도 카탈로그 규칙.
 *
 * - VWorld 키가 없으면 한국 묶음이 통째로 빠져야 한다 (키 문제로 지도가 깨지지 않게)
 * - 라벨 오버레이 항목은 위성+라벨 둘뿐이다
 * - 배경 타일을 crossOrigin 없이 받으면 지도 캔버스가 오염돼(tainted canvas)
 *   지도 내보내기의 canvas.toDataURL() 이 SecurityError 로 막힌다.
 *   위성 · 위성+라벨에서 실제로 내보내기가 통째로 실패했던 회귀를 잠근다.
 */
import { describe, it, expect } from 'vitest';
import {
  getBasemapCatalog, findBasemap, vworldTileUrl, BASEMAP_GROUPS, DEFAULT_BASEMAP
} from './basemaps.js';

const KEY = 'TESTKEY123';

describe('vworldTileUrl', () => {
  it('VWorld WMTS 타일 주소를 조립한다 (z/y/x 순서)', () => {
    expect(vworldTileUrl('Base', 'png', KEY))
      .toBe(`https://api.vworld.kr/req/wmts/1.0.0/${KEY}/Base/{z}/{y}/{x}.png`);
    expect(vworldTileUrl('Satellite', 'jpeg', KEY))
      .toBe(`https://api.vworld.kr/req/wmts/1.0.0/${KEY}/Satellite/{z}/{y}/{x}.jpeg`);
  });
});

describe('getBasemapCatalog', () => {
  it('키가 없으면 한국 묶음이 빠지고 세계 묶음만 남는다', () => {
    const keys = getBasemapCatalog({ vworldKey: '' }).map((b) => b.key);
    expect(keys.filter((k) => k.startsWith('VW_'))).toHaveLength(0);
    expect(keys).toEqual(['OSM', 'OPENTOPO', 'SATELLITE', 'SATELLITE_LABELS', 'ESRI_DARK', 'NONE']);
  });

  it('키가 있으면 한국 5종이 앞에 온다', () => {
    const keys = getBasemapCatalog({ vworldKey: KEY }).map((b) => b.key);
    expect(keys.slice(0, 5)).toEqual(['VW_BASE', 'VW_GRAY', 'VW_MIDNIGHT', 'VW_SATELLITE', 'VW_HYBRID']);
    expect(keys).toHaveLength(11);
  });

  it('묶음은 korea·world 두 개이고 NONE 은 hidden 이라 목록에 안 나온다', () => {
    expect(BASEMAP_GROUPS.map((g) => g.id)).toEqual(['korea', 'world']);
    const none = findBasemap('NONE', { vworldKey: KEY });
    expect(none.group).toBe('hidden');
    for (const b of getBasemapCatalog({ vworldKey: KEY })) {
      if (b.key !== 'NONE') expect(['korea', 'world']).toContain(b.group);
    }
  });

  it('라벨 오버레이가 있는 항목은 VW_HYBRID 와 SATELLITE_LABELS 뿐이다', () => {
    const withLabels = getBasemapCatalog({ vworldKey: KEY }).filter((b) => b.labels).map((b) => b.key);
    expect(withLabels.sort()).toEqual(['SATELLITE_LABELS', 'VW_HYBRID']);
  });

  it('VWorld 소스는 키가 든 주소를 쓰고 줌 6~19 로 제한한다', () => {
    const base = findBasemap('VW_BASE', { vworldKey: KEY }).source();
    expect(base.getUrls()[0]).toContain(`/${KEY}/Base/`);
    expect(base.getTileGrid().getMinZoom()).toBe(6);
    expect(base.getTileGrid().getMaxZoom()).toBe(19);
  });

  it('기본값은 키 없이도 있는 OSM 이다', () => {
    expect(DEFAULT_BASEMAP).toBe('OSM');
    expect(findBasemap(DEFAULT_BASEMAP, { vworldKey: '' })).not.toBeNull();
  });

  it('모르는 키는 null', () => {
    expect(findBasemap('NOPE', { vworldKey: KEY })).toBeNull();
  });
});

describe('배경 타일 crossOrigin', () => {
  const entries = getBasemapCatalog({ vworldKey: KEY });

  it.each(entries.map((b) => [b.key, b]))('%s 소스는 익명 CORS 로 타일을 받는다', (key, def) => {
    expect(def.source().crossOrigin).toBe('anonymous');
    if (def.labels) expect(def.labels().crossOrigin).toBe('anonymous');
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run src/core/basemaps.test.js`
Expected: FAIL — `Failed to resolve import "./basemaps.js"`

- [ ] **Step 3: 구현** — `src/core/basemaps.js`

```js
/**
 * 배경지도 카탈로그
 *
 * 두 묶음이다. 한국은 국토교통부 VWorld(한글·지번·건물명, 키 필요, 한국 밖은 비어 있음),
 * 세계는 키 없이 되는 OSM·OpenTopoMap·Esri. 기본값은 키 없이도 어디서나 나오는 OSM.
 *
 * 항목 모양: { key, label, group, source(), labels?() }
 *  - labels 가 있으면 "베이스 + 라벨 오버레이" 항목이다 (위성 위에 지명·도로명).
 *  - group 'hidden' 은 팝오버 목록에는 안 나오고 3D 패널에서만 고를 수 있다 (NONE).
 *
 * 왜 뺐나 (2026-09-14 서울 z12·z15 타일 실측):
 *  - Esri World_Street_Map / World_Topo_Map / Light Gray 는 한국이 z13 까지만 나온다.
 *  - CARTO light_all / dark_all 은 키 없이는 "API KEY REQUIRED" 워터마크가 찍힌다.
 *    (라벨 전용 타일 voyager_only_labels 는 정상이라 위성+라벨에 계속 쓴다)
 *
 * 설계: docs/superpowers/specs/2026-09-14-basemap-catalog-design.md
 */
import OSM from 'ol/source/OSM';
import XYZ from 'ol/source/XYZ';

// 배경 타일은 예외 없이 익명 CORS 로 받는다.
// crossOrigin 을 주지 않으면 타일 이미지가 캔버스를 오염시켜(tainted canvas)
// 지도 내보내기의 canvas.toDataURL() 이 SecurityError 로 막힌다.
// ol/source/OSM 만 기본값이 'anonymous' 이고 ol/source/XYZ 는 지정하지 않으면 null 이다.
const TILE_CROSS_ORIGIN = 'anonymous';

export const DEFAULT_BASEMAP = 'OSM';

/** 빌드 때 주입되는 VWorld 인증키 (.env.local / Vercel 환경변수). 없으면 한국 묶음이 빠진다. */
export const VWORLD_KEY = import.meta.env.VITE_VWORLD_KEY || '';

export const BASEMAP_GROUPS = [
  { id: 'korea', label: '한국 (VWorld)' },
  { id: 'world', label: '세계' }
];

/** VWorld WMTS 타일 주소. 경로가 z/y/x 순서라 OL 기본({z}/{x}/{y})과 다르다. */
export function vworldTileUrl(layer, ext, key) {
  return `https://api.vworld.kr/req/wmts/1.0.0/${key}/${layer}/{z}/{y}/{x}.${ext}`;
}

const VWORLD_ATTRIBUTION = '&copy; <a href="https://www.vworld.kr/">VWorld</a>(국토교통부)';

// VWorld 는 줌 6~19 만 제공한다. 그 밖의 줌은 요청하지 않는다 (404 대신 빈 화면).
const vworldSource = (layer, ext, key) => () => new XYZ({
  url: vworldTileUrl(layer, ext, key),
  minZoom: 6,
  maxZoom: 19,
  crossOrigin: TILE_CROSS_ORIGIN,
  attributions: VWORLD_ATTRIBUTION
});

function koreaBasemaps(key) {
  return [
    { key: 'VW_BASE', label: '일반', group: 'korea', source: vworldSource('Base', 'png', key) },
    { key: 'VW_GRAY', label: '회색', group: 'korea', source: vworldSource('gray', 'png', key) },
    { key: 'VW_MIDNIGHT', label: '야간', group: 'korea', source: vworldSource('midnight', 'png', key) },
    { key: 'VW_SATELLITE', label: '위성', group: 'korea', source: vworldSource('Satellite', 'jpeg', key) },
    {
      key: 'VW_HYBRID', label: '위성 + 라벨', group: 'korea',
      source: vworldSource('Satellite', 'jpeg', key),
      labels: vworldSource('Hybrid', 'png', key)
    }
  ];
}

const esriImagery = () => new XYZ({
  url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
  maxZoom: 19,
  crossOrigin: TILE_CROSS_ORIGIN,
  attributions: '&copy; Esri'
});

// 라벨(지명/도로명) 오버레이 타일 — 위성+라벨 모드에서만 표시
// Esri World_Boundaries_and_Places 는 광역 지명만 있어 확대 시 라벨이 사라지므로,
// 거리·동네까지 촘촘한 CARTO(OSM 기반) 라벨 전용 타일을 쓴다.
// voyager_only_labels: 도로·지명이 서로 다른 색(+흰 외곽선)이라 위성 위에서 잘 보임.
// @2x 레티나 타일(tilePixelRatio:2)로 고해상도 화면에서도 선명.
const cartoLabels = () => new XYZ({
  url: 'https://{a-d}.basemaps.cartocdn.com/rastertiles/voyager_only_labels/{z}/{x}/{y}@2x.png',
  tilePixelRatio: 2,
  maxZoom: 20,
  crossOrigin: TILE_CROSS_ORIGIN,
  attributions: '&copy; <a href="https://carto.com/">CARTO</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
});

const WORLD_BASEMAPS = [
  {
    key: 'OSM', label: 'OSM 표준', group: 'world',
    source: () => new OSM({ crossOrigin: TILE_CROSS_ORIGIN })
  },
  {
    key: 'OPENTOPO', label: '지형도 (OpenTopoMap)', group: 'world',
    source: () => new XYZ({
      url: 'https://{a-c}.tile.opentopomap.org/{z}/{x}/{y}.png',
      maxZoom: 17,
      crossOrigin: TILE_CROSS_ORIGIN,
      attributions: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, SRTM | map style &copy; <a href="https://opentopomap.org/">OpenTopoMap</a> (CC-BY-SA)'
    })
  },
  { key: 'SATELLITE', label: '위성 (Esri)', group: 'world', source: esriImagery },
  { key: 'SATELLITE_LABELS', label: '위성 + 라벨', group: 'world', source: esriImagery, labels: cartoLabels },
  {
    key: 'ESRI_DARK', label: '어두운 지도 (Esri)', group: 'world',
    source: () => new XYZ({
      url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}',
      maxZoom: 16,
      crossOrigin: TILE_CROSS_ORIGIN,
      attributions: '&copy; Esri, HERE, Garmin, OpenStreetMap contributors'
    })
  },
  {
    key: 'NONE', label: '없음', group: 'hidden',
    source: () => new XYZ({ url: '', crossOrigin: TILE_CROSS_ORIGIN })
  }
];

/**
 * 키 유무를 반영한 카탈로그. 한국 묶음은 키가 있을 때만 들어간다.
 * @param {{ vworldKey?: string }} [opts]
 */
export function getBasemapCatalog({ vworldKey = VWORLD_KEY } = {}) {
  return [...(vworldKey ? koreaBasemaps(vworldKey) : []), ...WORLD_BASEMAPS];
}

/** 키로 항목 찾기. 없으면 null. */
export function findBasemap(key, opts) {
  return getBasemapCatalog(opts).find((b) => b.key === key) || null;
}
```

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run src/core/basemaps.test.js`
Expected: 모두 통과 (`getUrls()`/`getTileGrid()` 는 OL XYZ 의 공개 메서드다)

- [ ] **Step 5: 옛 테스트 삭제 후 커밋**

```bash
git rm -q src/core/MapManager.test.js
git add src/core/basemaps.js src/core/basemaps.test.js
git commit -m "feat(basemap): 카탈로그 모듈 — VWorld 5종 + 세계 5종, 키 없으면 한국 묶음 제외"
```

(이 시점에 `MapManager.js` 는 아직 자체 `BASEMAPS` 를 쓰므로 앱은 그대로 돈다.)

---

### Task 2: MapManager 가 카탈로그를 쓰고 오버레이를 일반화

**Files:**
- Modify: `src/core/MapManager.js` (BasemapControl 클래스, `BASEMAPS`/`REFERENCE_LABELS` 정의, `init`, `setBasemap`, `getAvailableBasemaps`)
- Create: `src/core/MapManager.setBasemap.test.js`
- Modify: `src/styles/main.css` (`.egis-basemap-panel .egis-basemap-option` 규칙 뒤)

- [ ] **Step 1: 실패하는 테스트 작성** — `src/core/MapManager.setBasemap.test.js`

```js
// @vitest-environment jsdom
/**
 * setBasemap 의 오버레이 규칙.
 * 라벨이 있는 항목이면 referenceLayer 를 그 라벨 소스로 켜고, 없으면 끈다.
 * 모르는 키는 아무것도 바꾸지 않는다.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import TileLayer from 'ol/layer/Tile';
import { MapManager } from './MapManager.js';

let mm;

beforeEach(() => {
  // init() 없이 레이어만 꽂는다 — setBasemap 은 지도 객체를 쓰지 않는다
  mm = new MapManager();
  mm.baseLayer = new TileLayer();
  mm.referenceLayer = new TileLayer({ visible: false });
  mm.currentBasemap = 'OSM';
});

describe('MapManager.setBasemap', () => {
  it('라벨 없는 항목: 베이스 소스만 바뀌고 라벨 레이어는 꺼진다', () => {
    mm.setBasemap('OPENTOPO');
    expect(mm.getBasemap()).toBe('OPENTOPO');
    expect(mm.baseLayer.getVisible()).toBe(true);
    expect(mm.baseLayer.getSource().getUrls()[0]).toContain('opentopomap.org');
    expect(mm.referenceLayer.getVisible()).toBe(false);
  });

  it('라벨 있는 항목: 라벨 레이어에 라벨 소스가 들어가고 켜진다', () => {
    mm.setBasemap('SATELLITE_LABELS');
    expect(mm.referenceLayer.getVisible()).toBe(true);
    expect(mm.referenceLayer.getSource().getUrls()[0]).toContain('voyager_only_labels');
    expect(mm.baseLayer.getSource().getUrls()[0]).toContain('World_Imagery');
  });

  it('라벨 있는 항목에서 없는 항목으로 돌아오면 라벨 레이어가 꺼진다', () => {
    mm.setBasemap('SATELLITE_LABELS');
    mm.setBasemap('ESRI_DARK');
    expect(mm.referenceLayer.getVisible()).toBe(false);
  });

  it('NONE: 베이스가 숨고 라벨도 꺼진다', () => {
    mm.setBasemap('SATELLITE_LABELS');
    mm.setBasemap('NONE');
    expect(mm.baseLayer.getVisible()).toBe(false);
    expect(mm.referenceLayer.getVisible()).toBe(false);
    expect(mm.getBasemap()).toBe('NONE');
  });

  it('모르는 키는 무시된다', () => {
    mm.setBasemap('OPENTOPO');
    mm.setBasemap('NOPE');
    expect(mm.getBasemap()).toBe('OPENTOPO');
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run src/core/MapManager.setBasemap.test.js`
Expected: FAIL — `OPENTOPO` 케이스에서 `Unknown basemap` 경고 후 `expected 'OSM' to be 'OPENTOPO'`

- [ ] **Step 3: MapManager 수정**

3-a. import 에 추가 (`import { MapScaleBar } …` 뒤):

```js
import { getBasemapCatalog, findBasemap, BASEMAP_GROUPS, DEFAULT_BASEMAP } from './basemaps.js';
```

3-b. `BasemapControl` 클래스에서 `const options = [ … ]` 와 `panel.innerHTML = options.map(…)` 를 아래로 바꾼다 (묶음 제목 + 항목):

```js
    const panel = document.createElement('div');
    panel.className = 'egis-basemap-panel';
    panel.hidden = true;
    panel.innerHTML = BasemapControl.panelHTML();
```

그리고 클래스 안에 정적 메서드를 추가한다 (`togglePanel()` 위):

```js
  /** 묶음 제목 + 항목 버튼. 키가 없어 한국 묶음이 비면 그 제목도 안 그린다. */
  static panelHTML() {
    const catalog = getBasemapCatalog();
    return BASEMAP_GROUPS.map((group) => {
      const items = catalog.filter((b) => b.group === group.id);
      if (!items.length) return '';
      return `
        <div class="egis-basemap-group-title">${group.label}</div>
        ${items.map((b) =>
          `<button type="button" class="egis-basemap-option" data-key="${b.key}">${b.label}</button>`
        ).join('')}
      `;
    }).join('');
  }
```

3-c. `updateActive()` 의 강조 규칙을 바꾼다:

```js
    // 기본(OSM)이 아닌 배경을 쓰는 동안 버튼을 강조한다
    this.button.classList.toggle('active', current !== DEFAULT_BASEMAP);
```

3-d. `MapManager` 클래스 위에 있던 `TILE_CROSS_ORIGIN` 상수, `BASEMAPS`, `REFERENCE_LABELS` 정의(주석 포함)를 **모두 삭제**한다. `OSM`·`XYZ` import 는 더 이상 안 쓰면 함께 지운다 (`grep -n "new OSM\|new XYZ" src/core/MapManager.js` 로 확인).

3-e. `init()` 에서 레이어 생성을 바꾼다:

```js
    const { center = [127.5, 36.5], zoom = 7, basemap = DEFAULT_BASEMAP } = options;
    const initial = findBasemap(basemap) || findBasemap(DEFAULT_BASEMAP);

    // 기본 배경 레이어 생성
    this.baseLayer = new TileLayer({
      source: initial.source(),
      properties: { name: 'basemap', type: 'base' }
    });

    // 라벨(지명/도로명) 오버레이 레이어 — 라벨이 있는 항목(위성+라벨)에서만 표시.
    // 소스는 항목마다 다르므로 setBasemap 이 그때그때 꽂는다.
    // zIndex 0.5: 베이스맵(0) 위 · 사용자 데이터(1+) 아래에 위치
    this.referenceLayer = new TileLayer({
      source: initial.labels ? initial.labels() : null,
      visible: !!initial.labels,
      zIndex: 0.5,
      properties: { name: 'reference', type: 'base' }
    });
```

(`this.currentBasemap = basemap;` 줄은 `this.currentBasemap = initial.key;` 로.)

3-f. `setBasemap()` 전체를 바꾼다:

```js
  /**
   * 배경지도 변경
   * @param {string} basemapKey - 카탈로그 키 (basemaps.js)
   */
  setBasemap(basemapKey) {
    const item = findBasemap(basemapKey);
    if (!item) {
      console.warn(`Unknown basemap: ${basemapKey}`);
      return;
    }

    if (item.key === 'NONE') {
      this.baseLayer.setVisible(false);
    } else {
      this.baseLayer.setVisible(true);
      this.baseLayer.setSource(item.source());
    }

    // 라벨 오버레이: 항목에 labels 가 있을 때만 그 소스로 켠다
    if (this.referenceLayer) {
      if (item.labels && item.key !== 'NONE') {
        this.referenceLayer.setSource(item.labels());
        this.referenceLayer.setVisible(true);
      } else {
        this.referenceLayer.setVisible(false);
      }
    }

    this.currentBasemap = item.key;
    if (this.basemapControl) this.basemapControl.updateActive();
  }
```

3-g. `getAvailableBasemaps()` 를 바꾼다:

```js
  /**
   * 사용 가능한 배경지도 목록 (카탈로그 그대로 — 3D 패널이 optgroup 을 그린다)
   */
  getAvailableBasemaps() {
    return getBasemapCatalog().map(({ key, label, group }) => ({ key, label, group }));
  }
```

3-h. `src/styles/main.css` 의 `.egis-basemap-panel .egis-basemap-option.active { … }` 규칙 뒤에 추가:

```css
/* 팝오버 묶음 제목 (한국 (VWorld) / 세계) */
.egis-basemap-panel .egis-basemap-group-title {
  padding: 6px 14px 2px;
  font-size: var(--font-size-xs);
  font-weight: 600;
  color: var(--text-muted);
  white-space: nowrap;
}

.egis-basemap-panel .egis-basemap-group-title + .egis-basemap-option {
  margin-top: 0;
}
```

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run src/core/MapManager.setBasemap.test.js src/core/basemaps.test.js`
Expected: 모두 통과

Run: `npx vitest run`
Expected: 전체 통과 (`MapManager.test.js` 삭제분 빼고 새 테스트가 더해짐)

- [ ] **Step 5: 커밋**

```bash
git add src/core/MapManager.js src/core/MapManager.setBasemap.test.js src/styles/main.css
git commit -m "feat(basemap): MapManager 가 카탈로그를 쓰고 라벨 오버레이를 항목 규칙으로 일반화, 팝오버 묶음 제목"
```

---

### Task 3: 3D 패널 드롭다운을 카탈로그로 채우기

**Files:**
- Modify: `src/ui/layout/AppLayout.js` (`#view3d-basemap` 의 고정 `<option>` 4개 제거)
- Modify: `src/ui/panels/View3DPanel.js` (`init()` 과 3D 켤 때)

- [ ] **Step 1: 마크업** — `AppLayout.js` 에서

```html
                <select id="view3d-basemap">
                  <option value="OSM">일반지도</option>
                  <option value="SATELLITE">위성</option>
                  <option value="SATELLITE_LABELS">위성 + 라벨</option>
                  <option value="NONE">없음</option>
                </select>
```

을

```html
                <select id="view3d-basemap"></select>
```

으로 바꾼다 (JS 가 채운다).

- [ ] **Step 2: View3DPanel** — `fillTerrainOptions()` 앞에 메서드 추가:

```js
  /** 배경지도 드롭다운을 카탈로그로 채운다 (묶음별 optgroup + 없음) */
  fillBasemapOptions() {
    const catalog = this.mapManager.getAvailableBasemaps();
    const groups = [
      { id: 'korea', label: '한국 (VWorld)' },
      { id: 'world', label: '세계' }
    ];
    const optgroups = groups.map((g) => {
      const items = catalog.filter((b) => b.group === g.id);
      if (!items.length) return '';
      const options = items.map((b) => `<option value="${b.key}">${escapeHtml(b.label)}</option>`).join('');
      return `<optgroup label="${g.label}">${options}</optgroup>`;
    }).join('');
    const none = catalog.find((b) => b.key === 'NONE');
    this.basemapSelect.innerHTML = optgroups + (none ? `<option value="NONE">${escapeHtml(none.label)}</option>` : '');
  }
```

`escapeHtml` 은 이 파일에 이미 있는지 확인한다 (`grep -n "function escapeHtml\|import.*escapeHtml" src/ui/panels/View3DPanel.js`). 없으면 `fillTerrainOptions` 가 쓰는 것과 같은 출처에서 가져온다.

그리고 3D 를 켜는 코드에서

```js
      this.fillTerrainOptions();
      this.basemapSelect.value = this.mapManager.getBasemap?.() || 'OSM';
```

를

```js
      this.fillTerrainOptions();
      this.fillBasemapOptions();
      this.basemapSelect.value = this.mapManager.getBasemap?.() || 'OSM';
```

으로 바꾼다.

- [ ] **Step 3: 확인**

Run: `npx vitest run`
Expected: 전체 통과

- [ ] **Step 4: 커밋**

```bash
git add src/ui/layout/AppLayout.js src/ui/panels/View3DPanel.js
git commit -m "feat(view3d): 배경지도 드롭다운을 카탈로그(묶음별)로 채운다"
```

---

### Task 4: 키 설정 파일과 개인정보 처리방침 1.3.1

**Files:**
- Modify: `.env.example`
- Modify: `src/ui/panels/PrivacyPolicyPanel.js` (버전·최종 수정·제7조 5번·개정 이력)
- Regenerate: `public/privacy-policy.pdf`, `개인정보 처리방침(e-GIS).pdf`

- [ ] **Step 1: `.env.example` 끝에 추가**

```
# VWorld(국토교통부) 배경지도 인증키 — vworld.kr 오픈API 에서 발급, 서비스 URL 에 도메인 등록.
# 비워 두면 배경지도 목록에서 "한국 (VWorld)" 묶음이 빠진다.
VITE_VWORLD_KEY=
```

- [ ] **Step 2: 방침 본문** — `src/ui/panels/PrivacyPolicyPanel.js`

`PRIVACY_POLICY_VERSION = '1.3.0'` → `'1.3.1'`, `lastUpdated: '2026년 9월 14일'` 은 실제 배포일로.

제7조 5번 블록을 바꾼다:

```
<strong>5. 배경지도 타일 제공자 — 국토교통부 브이월드(VWorld), OpenStreetMap Foundation, OpenTopoMap, CARTO, Esri</strong>
• 위탁하는 업무 내용: 배경지도 타일(일반·회색·야간 지도, 지형도, 위성 영상, 지명 라벨) 제공
• 이전되는 항목: 접속 IP 주소, 접속 도메인, 화면에 표시 중인 지도 영역(타일 좌표·확대 수준) 등 접속 정보
• 이전 국가: 대한민국(브이월드), 영국 등(OpenStreetMap Foundation), 독일(OpenTopoMap), 미국(CARTO, Esri) (서버 소재지)
• 이전 시기 및 방법: 지도를 표시하는 동안 브라우저가 타일을 요청하는 시점에 네트워크를 통한 전송
• 개인정보 보유 및 이용기간: 요청 처리 시까지 (각 제공자의 정책에 따름)
```

제12조 ① 의 `현재 버전(1.3.0)은 2026년 9월 14일부터` → `현재 버전(1.3.1)은 {배포일}부터`, 개정 이력 끝에 한 줄:

```
• 1.3.1 ({배포일}): 배경지도 타일 제공자에 국토교통부 브이월드(VWorld)·OpenTopoMap 추가
```

- [ ] **Step 3: PDF 재생성** (이전 세션과 같은 절차)

```bash
node scripts/build.cjs && node scripts/prerender-privacy.js
npx vite preview --port 4173 --strictPort &      # 배경
"/c/Program Files/Google/Chrome/Application/chrome.exe" --headless=new --disable-gpu --no-first-run \
  --user-data-dir="$(cygpath -w "$TMP/chrome-pdf")" --virtual-time-budget=15000 --no-pdf-header-footer \
  --print-to-pdf="$(cygpath -w "$TMP/privacy-policy.pdf")" "http://localhost:4173/privacy.html"
cp "$TMP/privacy-policy.pdf" public/privacy-policy.pdf
cp "$TMP/privacy-policy.pdf" "개인정보 처리방침(e-GIS).pdf"
```

확인: PDF 텍스트에 `버전: 1.3.1` 과 `브이월드` 가 있고 `PDF 다운로드` 는 없다 (PyMuPDF 로 추출).

- [ ] **Step 4: 커밋**

```bash
git add .env.example src/ui/panels/PrivacyPolicyPanel.js public/privacy-policy.pdf "개인정보 처리방침(e-GIS).pdf"
git commit -m "privacy: 1.3.1 — 배경지도 타일 제공자에 VWorld·OpenTopoMap 추가, PDF 재생성"
```

---

### Task 5: 화면 확인과 마무리

- [ ] **Step 1: 팝오버 렌더 확인** — `.env.local` 에 `VITE_VWORLD_KEY=TESTKEY` 를 임시로 넣고 `npx vite --port 3000` 후 헤드리스 Chrome 으로 `http://localhost:3000/` 을 찍는다 (지도 오른쪽 위 레이어 버튼을 눌러야 팝오버가 보이므로, 하네스에서 `document.querySelector('.egis-basemap > button').click()` 을 실행하거나 팝오버 `hidden` 을 풀어 찍는다). 확인: 제목 두 줄, 한국 5·세계 5, 현재 항목 강조.
  키를 지운 상태로 한 번 더 찍어 "세계" 묶음만 나오는지 확인한다.

- [ ] **Step 2: 3D 드롭다운 확인** — 같은 하네스에서 `#view3d-basemap` 의 `innerHTML` 에 `optgroup` 두 개와 `없음` 이 있는지 콘솔로 확인.

- [ ] **Step 3: 전체 테스트·빌드**

Run: `npx vitest run` → 전체 통과
Run: `node scripts/build.cjs` → 오류 없음

- [ ] **Step 4: 실제 키 확인** (키를 받은 뒤) — `.env.local` 에 진짜 키를 넣고 로컬에서 VWorld 일반·야간·위성+라벨이 실제로 그려지는지 육안 확인. 403 이면 VWorld 서비스 URL 등록(localhost 포함)을 다시 본다.

---

## 자체 점검

- 스펙 커버리지: 카탈로그·키 유무(Task 1) · setBasemap 일반화·팝오버 묶음(Task 2) · 3D 드롭다운(Task 3) · `.env.example`·방침 1.3.1·PDF(Task 4) · 화면·실키 확인(Task 5) · 흐름도 `ESRI_DARK` 유지(변경 없음) · CSP 변경 없음 — 빠진 항목 없음.
- 이름 일치: `getBasemapCatalog({ vworldKey })`, `findBasemap(key, opts)`, `vworldTileUrl(layer, ext, key)`, `BASEMAP_GROUPS`, `DEFAULT_BASEMAP`, 항목 필드 `key/label/group/source/labels`, DOM 클래스 `egis-basemap-group-title` — 태스크 간 동일.
