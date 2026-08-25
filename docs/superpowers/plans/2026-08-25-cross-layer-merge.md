# 다른 레이어끼리 피처 합치기 Implementation Plan

> **실행 완료 (2026-08-26).** 아래 코드 블록은 **계획 당시의 것**이고, 실제로 들어간 코드와
> 다르다. 구현 중 검토에서 두 군데를 고쳤다 — 수치 판별(`isNumericValue` → `isSummable`)과
> 새 레이어 색(자동 색 → 쓰이지 않는 팔레트 색). 이 문서를 그대로 다시 실행하면 고친 버그가
> 되살아난다. 최종 규칙은 설계 문서의 「수치 판별」·「새 레이어 색」과 실제 코드를 보라.
> 이 문서는 무엇을 계획했는지의 기록으로 남긴다.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 서로 다른 레이어의 폴리곤(·라인)을 함께 선택해 합칠 수 있게 하고, 그 결과는 원본을 그대로 둔 채 새 레이어로 추가한다.

**Architecture:** 지오메트리·속성·이름 규칙은 OL/DOM에 의존하지 않는 순수 모듈 `FeatureEditGeometry.js`에 두고 vitest로 검증한다. `FeatureEditTool.mergeSelected()`는 선택을 읽어 레이어 수로 분기하고(1개 → 제자리 병합, 2개 이상 → 새 레이어), 레이어 생성과 안내만 맡는다. 지금 구조를 그대로 따르는 변경이다.

**Tech Stack:** JavaScript (ES modules), OpenLayers 9, Turf 7, Vitest 4

설계 문서: `docs/superpowers/specs/2026-08-25-cross-layer-merge-design.md`

---

## File Structure

| 파일 | 역할 | 이 계획에서 |
|---|---|---|
| `src/tools/FeatureEditGeometry.js` | 합치기/자르기 순수 로직 (GeoJSON in → out) | `mergeAttributes` 확장, `mergedLayerName` 추가 |
| `src/tools/FeatureEditGeometry.test.js` | 위 모듈 단위 테스트 | **신규 생성** |
| `src/tools/FeatureEditTool.js` | 선택 읽기·레이어 조작·안내 | `mergeSelected` 분기, 헬퍼 2개 추가 |
| `src/ui/layout/AppLayout.js` | 툴바 버튼 마크업 | 툴팁 문구 |
| `src/main.js` | 도움말 본문, 디버그 노출 | 도움말 한 줄 추가, `__egisDebug` 에 `selectTool` |

**주의:** 이 저장소의 `src/**/*.js` 파일은 모두 첫 줄이 `// © 2026 김용현` 이다. Write 훅이 자동으로 넣어 주지만, 새로 만든 파일에 들어갔는지 확인할 것.

**테스트 실행:** 저장소 루트에서 `npm test` (= `vitest run`). 단일 파일은 `npx vitest run src/tools/FeatureEditGeometry.test.js`.

---

### Task 1: `mergeAttributes` — 필드 합집합

지금은 **첫 피처가 가진 필드만** 남는다. 다른 레이어에만 있는 필드가 조용히 사라지므로, 선택한 모든 피처의 필드를 모으도록 바꾼다.

**Files:**
- Create: `src/tools/FeatureEditGeometry.test.js`
- Modify: `src/tools/FeatureEditGeometry.js:11-30` (`mergeAttributes`)

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`src/tools/FeatureEditGeometry.test.js` 를 새로 만든다:

```javascript
// © 2026 김용현
import { describe, it, expect } from 'vitest';
import { mergeAttributes } from './FeatureEditGeometry.js';

describe('mergeAttributes', () => {
  it('숫자 필드는 합계로 모은다', () => {
    const merged = mergeAttributes([{ 인구: 530000 }, { 인구: 410000 }]);
    expect(merged.인구).toBe(940000);
  });

  it('한쪽 피처에만 있는 필드도 남긴다', () => {
    const merged = mergeAttributes([
      { 시군구: '강남구', 면적: 39.5 },
      { 시군구: '서초구', 비고: '관측소' }
    ]);
    expect(merged).toEqual({ 시군구: '강남구', 면적: 39.5, 비고: '관측소' });
  });

  it('한쪽에만 있는 숫자 필드는 없는 쪽을 0으로 친다', () => {
    const merged = mergeAttributes([{ 인구: 100 }, { 면적: 20 }]);
    expect(merged).toEqual({ 인구: 100, 면적: 20 });
  });

  it('어떤 필드가 숫자인지는 그 필드가 처음 등장한 피처로 판단한다', () => {
    // 두 번째 피처에서 처음 나온 '관측소수'가 숫자이므로 합계 대상이 된다
    const merged = mergeAttributes([{ 이름: '가' }, { 이름: '나', 관측소수: 3 }, { 관측소수: 4 }]);
    expect(merged.관측소수).toBe(7);
  });

  it('숫자가 아닌 필드는 값이 있는 첫 피처의 값을 쓴다', () => {
    const merged = mergeAttributes([{ 시군구: '' }, { 시군구: '서초구' }]);
    expect(merged.시군구).toBe('서초구');
  });

  it('아무 피처에도 값이 없으면 필드를 빈 값으로 남긴다', () => {
    const merged = mergeAttributes([{ 시군구: '' }, { 시군구: null }]);
    expect('시군구' in merged).toBe(true);
    expect(merged.시군구).toBe('');
  });

  it('스키마가 같고 빈 값이 없으면 기존 규칙과 결과가 같다', () => {
    const merged = mergeAttributes([
      { 시군구: '강남구', 인구: 530000 },
      { 시군구: '서초구', 인구: 410000 }
    ]);
    expect(merged).toEqual({ 시군구: '강남구', 인구: 940000 });
  });

  it('false 는 값이 있는 것으로 본다', () => {
    const merged = mergeAttributes([{ 사용중: false }, { 사용중: true }]);
    expect(merged.사용중).toBe(false);
  });
});
```

- [ ] **Step 2: 테스트를 돌려 실패를 확인한다**

Run: `npx vitest run src/tools/FeatureEditGeometry.test.js`

Expected: FAIL. 최소한 「한쪽 피처에만 있는 필드도 남긴다」와 「숫자가 아닌 필드는 값이 있는 첫 피처의 값을 쓴다」가 깨진다. 지금 구현은 첫 피처의 키만 보고, 빈 값도 그대로 쓴다.

- [ ] **Step 3: 구현한다**

`src/tools/FeatureEditGeometry.js` 의 `mergeAttributes` 를 JSDoc 주석까지 통째로 아래로 바꾼다:

```javascript
/** 값이 실제로 들어 있는지 (빈 문자열·null·undefined 는 없는 것으로 본다) */
function hasValue(v) {
  return v !== undefined && v !== null && String(v).trim() !== '';
}

/**
 * 여러 피처의 속성을 하나로 합친다.
 * 선택한 모든 피처의 필드를 모으고(합집합), 수치 필드는 합계,
 * 그 외 필드는 값이 있는 첫 피처의 값을 쓴다.
 *
 * 레이어를 넘나들며 합칠 때 한쪽 레이어에만 있는 필드가 사라지지 않게 하기 위한 규칙이다.
 * 어떤 필드가 수치인지는 그 필드가 처음 등장한 피처의 값으로 정한다
 * (레이어마다 타입이 다를 수 있어 기준이 필요하다).
 *
 * @param {Object[]} propsArray - 각 피처의 properties 객체 배열
 * @returns {Object}
 */
export function mergeAttributes(propsArray) {
  const list = (propsArray || []).map((p) => p || {});

  // 처음 등장한 순서를 지키려고 Map 을 쓴다. 값은 '수치 필드인가'
  const numeric = new Map();
  list.forEach((props) => {
    Object.keys(props).forEach((key) => {
      if (!numeric.has(key)) numeric.set(key, typeof props[key] === 'number');
    });
  });

  const result = {};
  numeric.forEach((isNumeric, key) => {
    if (isNumeric) {
      result[key] = list.reduce(
        (sum, p) => sum + (typeof p[key] === 'number' ? p[key] : 0),
        0
      );
    } else {
      const filled = list.find((p) => hasValue(p[key]));
      // 아무 피처에도 값이 없으면 그 필드를 가진 첫 피처의 (빈) 값을 그대로 둔다
      const fallback = list.find((p) => key in p);
      result[key] = filled ? filled[key] : fallback[key];
    }
  });

  return result;
}
```

- [ ] **Step 4: 테스트를 돌려 통과를 확인한다**

Run: `npx vitest run src/tools/FeatureEditGeometry.test.js`
Expected: PASS (8 tests)

- [ ] **Step 5: 전체 테스트로 회귀가 없는지 본다**

Run: `npm test`
Expected: 전부 PASS. 실패가 나오면 그 파일을 열어 원인을 확인하고, 이 변경 때문이면 고친 뒤 다시 돌린다.

- [ ] **Step 6: 커밋**

```bash
git add src/tools/FeatureEditGeometry.js src/tools/FeatureEditGeometry.test.js
git commit -m "feat: 피처 합치기 속성을 모든 필드의 합집합으로"
```

---

### Task 2: `mergedLayerName` — 새 레이어 이름 규칙

레이어를 넘나들며 합칠 때 만들 레이어의 이름을 짓는다. 순수 함수라 여기서 테스트로 못 박아 둔다.

**Files:**
- Modify: `src/tools/FeatureEditGeometry.js` (파일 끝에 함수 추가)
- Modify: `src/tools/FeatureEditGeometry.test.js` (import 수정 + describe 블록 추가)

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`src/tools/FeatureEditGeometry.test.js` 의 import 줄을 아래로 바꾸고

```javascript
import { mergeAttributes, mergedLayerName } from './FeatureEditGeometry.js';
```

파일 끝에 붙인다:

```javascript
describe('mergedLayerName', () => {
  it('레이어가 2개면 두 이름을 나란히 쓴다', () => {
    expect(mergedLayerName(['서울 자치구', '경기 시군'])).toBe('서울 자치구 + 경기 시군 병합');
  });

  it('레이어가 3개 이상이면 첫 이름과 나머지 개수로 줄인다', () => {
    expect(mergedLayerName(['서울', '경기', '인천'])).toBe('서울 외 2개 병합');
  });

  it('이름이 하나뿐이면 그 이름만 쓴다', () => {
    expect(mergedLayerName(['서울'])).toBe('서울 병합');
  });

  it('쓸 이름이 없으면 기본 이름을 쓴다', () => {
    expect(mergedLayerName([])).toBe('병합');
    expect(mergedLayerName(['', null])).toBe('병합');
  });
});
```

- [ ] **Step 2: 테스트를 돌려 실패를 확인한다**

Run: `npx vitest run src/tools/FeatureEditGeometry.test.js`
Expected: FAIL — `mergedLayerName is not a function`

- [ ] **Step 3: 구현한다**

`src/tools/FeatureEditGeometry.js` 파일 끝에 추가한다:

```javascript
/**
 * 레이어를 넘나들며 합친 결과에 붙일 레이어 이름을 만든다.
 * 목록에서 무엇을 합친 결과인지 바로 보이게 하는 것이 목적이라 길게 늘어놓지 않는다.
 *
 * @param {string[]} layerNames - 합치기에 참여한 레이어 이름 (등장 순서)
 * @returns {string} 예: '서울 + 경기 병합', '서울 외 2개 병합'
 */
export function mergedLayerName(layerNames) {
  const names = (layerNames || []).filter((n) => n && String(n).trim() !== '');
  if (names.length === 0) return '병합';
  if (names.length === 1) return `${names[0]} 병합`;
  if (names.length === 2) return `${names[0]} + ${names[1]} 병합`;
  return `${names[0]} 외 ${names.length - 1}개 병합`;
}
```

- [ ] **Step 4: 테스트를 돌려 통과를 확인한다**

Run: `npx vitest run src/tools/FeatureEditGeometry.test.js`
Expected: PASS (12 tests)

- [ ] **Step 5: 커밋**

```bash
git add src/tools/FeatureEditGeometry.js src/tools/FeatureEditGeometry.test.js
git commit -m "feat: 병합 결과 레이어 이름 규칙"
```

---

### Task 3: `mergeSelected` — 레이어 수로 분기

핵심 변경. 「같은 레이어의 피처만 합칠 수 있습니다」 거부를 없애고, 레이어가 여럿이면 결과를 새 레이어로 만든다.

**Files:**
- Modify: `src/tools/FeatureEditTool.js:20-25` (import 블록)
- Modify: `src/tools/FeatureEditTool.js:42-98` (`mergeSelected`)
- Modify: `src/main.js:1446` (`window.__egisDebug` — 실기 검증용 노출)

- [ ] **Step 1: import 에 `mergedLayerName` 을 넣는다**

`src/tools/FeatureEditTool.js` 의 기존 import 블록

```javascript
import {
  mergeGeoJSON,
  splitPolygonByLine,
  splitLineByLine,
  lineIntersectsFeature
} from './FeatureEditGeometry.js';
```

을 아래로 바꾼다:

```javascript
import {
  mergeGeoJSON,
  mergedLayerName,
  splitPolygonByLine,
  splitLineByLine,
  lineIntersectsFeature
} from './FeatureEditGeometry.js';
```

- [ ] **Step 2: `mergeSelected` 를 갈아끼운다**

`// ==================== 합치기 ====================` 아래의 `mergeSelected()` 전체(JSDoc 주석 포함, `// ==================== 자르기 ====================` 직전까지)를 아래로 바꾼다:

```javascript
  /**
   * 선택된 피처들을 하나로 합친다.
   *
   * 한 레이어 안에서 골랐으면 그 레이어에서 제자리로 합치고(원본 피처는 사라진다),
   * 여러 레이어에 걸쳐 골랐으면 원본은 그대로 둔 채 결과만 새 레이어로 만든다.
   * 어느 레이어에 넣을지 모호한 경우만 새 레이어로 푸는 것이다.
   */
  mergeSelected() {
    const selected = selectTool.getSelectedFeatures();
    if (selected.length < 2) {
      alert('합칠 피처를 2개 이상 선택하세요.\n(선택 도구로 Shift+클릭 또는 드래그)');
      return;
    }

    // 선택한 피처가 어느 레이어에 속하는지 등장 순서대로 모은다
    const layers = [];
    for (const f of selected) {
      const layerInfo = this.getLayerOfFeature(f);
      if (!layerInfo) {
        alert('피처가 속한 레이어를 찾을 수 없습니다.');
        return;
      }
      if (!layers.includes(layerInfo)) layers.push(layerInfo);
    }

    const gjs = selected.map((f) => this.featureToGeoJSON(f));

    // 타입 호환성 검사 (폴리곤끼리 또는 라인끼리)
    const family = this.geometryFamily(gjs[0]);
    if (family === 'point') {
      alert('포인트는 합칠 수 없습니다. 폴리곤 또는 라인을 선택하세요.');
      return;
    }
    if (!gjs.every((g) => this.geometryFamily(g) === family)) {
      alert('같은 종류의 피처(폴리곤끼리 또는 라인끼리)만 합칠 수 있습니다.');
      return;
    }

    try {
      const mergedGj = mergeGeoJSON(gjs);
      const newFeature = this.geoJSONToFeature(mergedGj);

      if (layers.length === 1) {
        this.replaceMergedInLayer(layers[0], selected, newFeature);
      } else {
        this.addMergedLayer(layers, newFeature, selected.length);
      }
    } catch (e) {
      alert('합치기 실패: ' + e.message);
    }
  }

  /**
   * 한 레이어 안에서 합칠 때: 원본 피처를 빼고 합친 피처를 그 레이어에 넣는다.
   */
  replaceMergedInLayer(layerInfo, selected, newFeature) {
    selected.forEach((f) => layerInfo.source.removeFeature(f));
    layerInfo.source.addFeature(newFeature);
    layerInfo.featureCount = layerInfo.source.getFeatures().length;

    // 결과를 다시 선택
    if (selectTool.selectedFeatures) {
      selectTool.selectedFeatures.clear();
      selectTool.selectedFeatures.push(newFeature);
    }

    eventBus.emit(Events.FEATURE_MODIFIED, { feature: newFeature });
    this.status(`피처 ${selected.length}개를 1개로 합쳤습니다.`);
  }

  /**
   * 여러 레이어에 걸쳐 합칠 때: 원본은 그대로 두고 결과만 새 레이어로 만든다.
   */
  addMergedLayer(layers, newFeature, featureCount) {
    const name = layerManager.uniqueName(mergedLayerName(layers.map((l) => l.name)));

    // 색을 넘기지 않아 자동 색이 잡힌다.
    // 원본이 지도에 그대로 남아 있어서, 원본과 같은 색이면 결과를 구분할 수 없다.
    layerManager.addLayer({
      name,
      type: 'vector',
      features: [newFeature]
    });

    // 원본이 남아 있으므로 선택을 풀어 둔다 (합쳐진 것처럼 보이면 헷갈린다)
    if (selectTool.selectedFeatures) selectTool.selectedFeatures.clear();

    this.status(`레이어 ${layers.length}개의 피처 ${featureCount}개를 합쳐 '${name}'을 만들었습니다.`);
  }
```

- [ ] **Step 3: 남아 있는 옛 코드가 없는지 확인한다**

Run: `grep -n "같은 레이어의 피처만" src/tools/FeatureEditTool.js`
Expected: 아무것도 안 나온다 (exit 1)

Run: `grep -n "replaceMergedInLayer\|addMergedLayer\|mergedLayerName" src/tools/FeatureEditTool.js`
Expected: `replaceMergedInLayer` 2줄(정의·호출), `addMergedLayer` 2줄(정의·호출), `mergedLayerName` 2줄(import·사용)

- [ ] **Step 4: 검증 하네스가 선택 도구에 닿게 `__egisDebug` 를 넓힌다**

`src/main.js:1446` 의

```javascript
window.__egisDebug = { projectManager, layerManager, exportPanel, isochroneTool, roadNetwork, measureTool };
```

을 아래로 바꾼다 (`selectTool` 추가):

```javascript
window.__egisDebug = { projectManager, layerManager, exportPanel, isochroneTool, roadNetwork, measureTool, selectTool };
```

`selectTool` 이 `src/main.js` 상단에 이미 import 되어 있는지 확인한다.
Run: `grep -n "import { selectTool }\|selectTool" src/main.js | head -3`
없으면 `import { selectTool } from './tools/SelectTool.js';` 를 다른 도구 import 옆에 추가한다.

- [ ] **Step 5: 전체 테스트와 빌드로 문법 오류를 잡는다**

Run: `npm test`
Expected: 전부 PASS (이 파일은 단위 테스트 대상이 아니지만 다른 테스트가 깨지지 않아야 한다)

Run: `rm -rf dist && npm run build`
Expected: 성공. `dist/` 가 만들어진다. (`dist` 를 안 지우면 조용히 exit 127 로 실패한다)

- [ ] **Step 6: 하네스로 실기 검증한다**

이 저장소에는 실기 검증 방법이 스킬로 정리되어 있다: **`Desktop/vibecoding/eGIS:verify`**
(`vite preview` + Electron 으로 진짜 앱을 띄워 사용자처럼 몬다). 그 규약을 그대로 따른다.

미리보기 서버를 띄운다:

```bash
npx vite preview --port 4173 &
curl -s -o /dev/null -w "%{http_code}" http://localhost:4173/     # 200 이어야 한다
```

하네스를 스크래치패드에 만든다 (**저장소에 커밋하지 않는다**).
파일명: `C:/Users/김용현/AppData/Local/Temp/merge-harness.js` (저장소 밖)

```javascript
const { app, BrowserWindow } = require('electron');

// 워치독 — 없으면 멈춰서 프로세스가 남는다
setTimeout(() => { console.error('TIMEOUT: 90초 안에 끝나지 않았다'); process.exit(2); }, 90000);

/** 왼쪽 아래 모서리가 (x, y)인 정사각 폴리곤 (EPSG:4326) */
function square(x, y, size = 0.1) {
  return [[[x, y], [x + size, y], [x + size, y + size], [x, y + size], [x, y]]];
}
function poly(coords, props) {
  return { type: 'Feature', geometry: { type: 'Polygon', coordinates: coords }, properties: props };
}
function fc(features) {
  return { type: 'FeatureCollection', features };
}

// 가레이어의 두 칸은 서로 붙어 있고, 나레이어는 가레이어의 두 번째 칸에 붙어 있다.
// 붙어 있어야 union 결과가 Polygon 하나로 나와 확인하기 쉽다.
const PROJECT = {
  version: '1.0',
  name: '병합 검증',
  layers: [
    {
      id: 'L-A', name: '가레이어', type: 'vector', geometryType: 'Polygon',
      features: fc([
        poly(square(127.0, 37.5), { 시군구: '강남구', 인구: 530000, 면적: 39.5 }),
        poly(square(127.1, 37.5), { 시군구: '서초구', 인구: 410000, 면적: 47.0 })
      ])
    },
    {
      id: 'L-B', name: '나레이어', type: 'vector', geometryType: 'Polygon',
      features: fc([poly(square(127.2, 37.5), { 시군구: '송파구', 인구: 670000, 비고: '관측소' })])
    },
    {
      id: 'L-C', name: '다레이어', type: 'vector', geometryType: 'Polygon',
      features: fc([poly(square(127.3, 37.5), { 시군구: '강동구', 인구: 460000 })])
    }
  ]
};

app.whenReady().then(async () => {
  const win = new BrowserWindow({ width: 1600, height: 1000, show: true });
  await win.loadURL('http://localhost:4173/');
  await new Promise((r) => setTimeout(r, 3000));

  const js = (code) => win.webContents.executeJavaScript(code);

  // alert 가 뜨면 Electron 이 멈춘다. 띄우지 말고 모아 둔다.
  await js(`(() => { window.__alerts = []; window.alert = (m) => window.__alerts.push(String(m)); })()`);

  const seed = () => js(`(async () => {
    await window.__egisDebug.projectManager.deserialize(${JSON.stringify(PROJECT)});
    document.querySelector('[data-tool="select"]').click();
    window.__alerts.length = 0;
    return window.__egisDebug.layerManager.getAllLayers().map((l) => l.name);
  })()`);

  /** [레이어이름, 인덱스] 목록을 선택에 담는다 (선택 도구가 켜져 있어야 한다) */
  const select = (picks) => js(`(() => {
    const d = window.__egisDebug;
    const sel = d.selectTool.selectedFeatures;
    sel.clear();
    const list = ${JSON.stringify(picks)};
    list.forEach(([layerName, index]) => {
      const layer = d.layerManager.getAllLayers().find((l) => l.name === layerName);
      sel.push(layer.source.getFeatures()[index]);
    });
    return sel.getLength();
  })()`);

  const clickMerge = () => js(`document.getElementById('btn-merge-features').click()`);

  const snapshot = () => js(`(() => {
    const d = window.__egisDebug;
    const mergedLayer = d.layerManager.getAllLayers().find((l) => l.name.includes('병합'));
    let merged = null;
    if (mergedLayer) {
      const f = mergedLayer.source.getFeatures()[0];
      const p = Object.assign({}, f.getProperties());
      delete p.geometry;
      merged = { name: mergedLayer.name, geometry: f.getGeometry().getType(), props: p };
    }
    return {
      layers: d.layerManager.getAllLayers().map((l) => ({
        name: l.name, color: l.color,
        count: l.source ? l.source.getFeatures().length : 0
      })),
      status: (document.getElementById('status-message') || {}).textContent,
      alerts: window.__alerts.slice(),
      merged
    };
  })()`);

  const results = [];

  // 1. 같은 레이어 안에서 — 제자리 병합, 새 레이어 없음 (기존 동작)
  await seed();
  await select([['가레이어', 0], ['가레이어', 1]]);
  await clickMerge();
  results.push(Object.assign({ 'case': '같은 레이어' }, await snapshot()));

  // 2. 다른 레이어끼리 — 원본 유지 + 새 레이어
  await seed();
  await select([['가레이어', 1], ['나레이어', 0]]);
  await clickMerge();
  results.push(Object.assign({ 'case': '다른 레이어 2개' }, await snapshot()));

  // 3. 레이어 3개 — 이름이 '가레이어 외 2개 병합'
  await seed();
  await select([['가레이어', 0], ['나레이어', 0], ['다레이어', 0]]);
  await clickMerge();
  results.push(Object.assign({ 'case': '레이어 3개' }, await snapshot()));

  console.log('RESULT ' + JSON.stringify(results, null, 2));
  app.quit();
});
```

Electron 은 `eStoryMap/node_modules` 에 있으므로 그 폴더에서 돌린다:

```bash
cd eStoryMap && npx electron "C:/Users/김용현/AppData/Local/Temp/merge-harness.js" 2>&1 | grep -viE "devtools|deprecat|GPU|cache_util|disk_cache|quota_database|Security Warning"
```

`RESULT` JSON 을 아래와 대조한다.

**1) 같은 레이어**

| 확인 | 기대 |
|---|---|
| `layers` | 가레이어 **count 1**, 나레이어 1, 다레이어 1 — **`병합` 이름의 레이어가 없다** |
| `merged` | `null` |
| `status` | `피처 2개를 1개로 합쳤습니다.` |
| `alerts` | `[]` |

**2) 다른 레이어 2개**

| 확인 | 기대 |
|---|---|
| `layers` | 가레이어 **count 2** (원본 그대로), 나레이어 1, 다레이어 1, **`가레이어 + 나레이어 병합` count 1** |
| `merged.geometry` | `Polygon` (두 칸이 붙어 있어 하나로 이어진다) |
| `merged.props` | `{ 시군구: '서초구', 인구: 1080000, 면적: 47, 비고: '관측소' }` — 인구는 합계, `비고` 는 나레이어에만 있던 필드 |
| `merged` 레이어 `color` | 가레이어·나레이어의 `color` 와 **다르다** |
| `status` | `레이어 2개의 피처 2개를 합쳐 '가레이어 + 나레이어 병합'을 만들었습니다.` |
| `alerts` | `[]` |

**3) 레이어 3개**

| 확인 | 기대 |
|---|---|
| `merged.name` | `가레이어 외 2개 병합` |
| `layers` | 가·나·다 레이어가 모두 원래 개수 그대로 |
| `alerts` | `[]` |

어긋나는 것이 하나라도 있으면 멈추고 무엇이 어떻게 달랐는지 보고한다.
`alerts` 에 문구가 쌓였다면 그 문구가 원인이다.

끝나면 미리보기 서버를 내리고 하네스 파일은 지운다 (저장소에 남기지 않는다).

- [ ] **Step 7: 커밋**

```bash
git add src/tools/FeatureEditTool.js src/main.js
git commit -m "feat: 다른 레이어의 피처도 합치기 — 결과는 새 레이어로"
```

---

### Task 4: 툴팁·도움말 문구

기능이 바뀌었는데 안내가 그대로면 사용자는 여전히 안 되는 줄 안다.

**Files:**
- Modify: `src/ui/layout/AppLayout.js:229`
- Modify: `src/main.js:1341-1349` (도움말 「6. 피처 선택 및 편집」)

- [ ] **Step 1: 툴바 버튼 툴팁을 고친다**

`src/ui/layout/AppLayout.js` 에서

```html
          <button class="btn-icon" id="btn-merge-features" title="피처 합치기 (선택한 피처들을 박음질하듯 하나로)">
```

을 아래로 바꾼다:

```html
          <button class="btn-icon" id="btn-merge-features" title="피처 합치기 (선택한 피처들을 박음질하듯 하나로. 다른 레이어끼리 합치면 새 레이어가 생깁니다)">
```

- [ ] **Step 2: 도움말에 한 줄 넣는다**

`src/main.js` 도움말 「6. 피처 선택 및 편집」 목록에서

```html
            <li><strong>복사/붙여넣기:</strong> Ctrl+C / Ctrl+V</li>
```

바로 뒤에 넣는다:

```html
            <li><strong>피처 합치기:</strong> 폴리곤(또는 라인) 2개 이상 선택 → 툴바의 합치기 버튼. 같은 레이어끼리는 그 자리에서 하나가 되고, <strong>다른 레이어끼리 합치면 원본은 그대로 두고 결과가 새 레이어로 추가</strong>됩니다.</li>
```

- [ ] **Step 3: 문구가 들어갔는지 확인한다**

Run: `grep -n "다른 레이어" src/ui/layout/AppLayout.js src/main.js`
Expected: 두 파일에서 각각 1줄씩 나온다

- [ ] **Step 4: 빌드로 마크업 오류를 잡는다**

Run: `npm run build`
Expected: 성공

- [ ] **Step 5: 커밋**

```bash
git add src/ui/layout/AppLayout.js src/main.js
git commit -m "docs: 다른 레이어끼리 합치기 안내를 툴팁과 도움말에"
```

---

## 하지 않는 것

- 원본 삭제 옵션 (체크박스·대화상자)
- 같은 레이어 합치기를 새 레이어 방식으로 바꾸는 것
- 포인트 합치기
- `mergeGeoJSON` 수정 — 레이어 개념이 없어 손댈 것이 없다
- `mergeSelected` 의 단위 테스트 — OL 선택·`alert`·DOM 에 얽혀 있다. Task 3 Step 5의 브라우저 확인으로 대신한다
