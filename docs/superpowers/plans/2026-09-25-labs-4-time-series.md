# 실험실 4단계 — 시계열 단계구분도 + 애니메이션 저장 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 주제도 메뉴에 **시계열 단계구분도**(실험 `time-series`)를 붙인다. 연도별 숫자 열 여러 개를 골라 구간을 **한 번만** 계산해 고정한 단계구분도를 만들고, 지도 아래 슬라이더로 연도를 넘기거나 자동 재생하며, 그 변화를 GIF 또는 동영상(MP4/WebM)으로 저장한다.

**Architecture:** 시계열은 새 레이어 종류가 아니라 **단계구분도 설정에 `timeSeries: { fields, index }` 를 더한 것**이다. 연도 이동 = `cfg.attribute` 를 바꾸고 `layerManager.updateLayerStyle` 을 부르는 일이라 저장·복원·내보내기·3D 가 모두 기존 경로를 그대로 탄다. 순수 계산(`timeSeriesModel.js`, `animationExport.js` 의 순수 함수)은 노드에서 테스트하고, DOM·OpenLayers 를 아는 조립부(`TimeSeriesTool`, 패널, 대화상자)는 jsdom 과 Electron 하네스로 본다. 애니메이션 프레임은 html2canvas 가 아니라 3D 가 쓰는 `composeMapCanvas`(OL 캔버스 합성)로 뽑고, 범례는 `ExportTool.drawLegend` 로 얹는다.

**Tech Stack:** Vanilla JS(ES modules), OpenLayers 9, vitest(노드 기본, DOM 테스트만 `@vitest-environment jsdom`), `gifenc`(새 의존성, MIT), `MediaRecorder` + `canvas.captureStream(0)`, Vite, Electron 하네스(`.claude/skills/verify`).

**Spec:** `docs/superpowers/specs/2026-09-25-labs-design.md` — 「4단계 — 시계열 단계구분도」 절(애니메이션 저장 포함)과 「공통」 절. 이 계획서와 스펙이 어긋나면 스펙이 맞다.

**선행:** 0단계(껍데기: `src/labs/labs.js`·`registry.js`·`__egisDebug.labs`)와 1단계(`class-fill`)가 `main` 에 병합돼 있어야 한다. 1단계는 `ChoroplethTool.apply` 를 "설정만 심고 `layerManager.updateLayerStyle` 을 부르는" 한 곳 빌더로 바꾸고, `StateManager.saveLayer`·`ProjectManager.serialize` 의 `choroplethConfig` 에 `fills` 를 더한다. 이 계획서는 그 자리에 `timeSeries` 를 더하고 `apply` 에 `options.breaks` 확장을 붙인다. **아래 코드·줄 번호가 1단계 계획서나 실제 구현과 다르면 그쪽(실제 파일)이 맞다** — 파일을 읽고 같은 자리에 맞춘다.

---

## 실행 방법 (서브에이전트)

- 저장소: `C:/Users/김용현/Desktop/vibecoding/eGIS`. 브랜치 `labs-time-series` 를 `main` 에서 딴다 (`git checkout -b labs-time-series main`).
- **작업(Task)마다 새 Fable 5.1 서브에이전트**를 띄운다(`superpowers:subagent-driven-development`). 구현자·스펙 검토자·코드 검토자 모두 **Fable 5.1**(세션 모델 그대로, `model` 지정 없이 fork/general-purpose). 한 작업이 끝나면 스펙 준수 검토 → 코드 품질 검토 → 다음 작업.
- 서브에이전트에게 넘길 것: 이 파일의 해당 Task 전체 본문 + 스펙 경로 + "코드는 그대로 쓰되 실제 파일과 줄이 어긋나면 파일을 읽고 맞춘다".
- 커밋은 반드시 파일을 지정해서(`git add <파일들>`), `git add -A` 금지. 작성자는 매번 `git -c user.name=yhk1m -c user.email=83273992+yhk1m@users.noreply.github.com commit …` (Vercel 이 다른 이메일의 커밋을 막는다).
- Write 훅이 새 파일 머리에 `// © 2026 김용현` 을 넣는다. 지우지 않는다. 아래 코드 블록에도 그 줄을 적어 두었으니 중복되면 하나만 남긴다.
- 테스트: `npm test` (vitest run). 빌드: `rm -rf dist && npm run build`. 화면: Task 12 의 Electron 하네스.
- 이모지는 UI 에 넣지 않는다. 아이콘은 선 SVG.
- 끝나면 `superpowers:finishing-a-development-branch` 로 `main` 병합 → `/cpd` 배포.

## 파일 구조

| 파일 | 역할 |
|---|---|
| `src/tools/timeSeriesModel.js` (새) | 순수: 연도 필드 감지, 값 합치기, 다음 인덱스, 부제, 파생 레이어 이름, 직렬화 레코드 |
| `src/tools/timeSeriesModel.test.js` (새) | 위 규칙 테스트 |
| `src/tools/ChoroplethTool.js` (수정) | `apply(…, options)` 에 `breaks`·`name`·`title` 확장 |
| `src/tools/ChoroplethTool.presetBreaks.test.js` (새) | jsdom: 미리 계산한 구간이 그대로 쓰이는지 |
| `src/core/StateManager.js`, `src/core/ProjectManager.js` (수정) | `choroplethConfig.timeSeries` 직렬화 |
| `src/core/LayerManager.js` (수정) | 레이어 복제 시 `timeSeries` 깊은 복사 |
| `src/core/AutoSaveManager.js`, `src/utils/EventBus.js` (수정) | 자동 복원 완료 이벤트 `STATE_RESTORED` |
| `src/core/AutoSaveManager.timeSeries.test.js` (새) | jsdom: 복원된 레이어에 `timeSeries` 가 살아 있는지 |
| `src/labs/labMenu.js` (새) + `labMenu.test.js` | `[data-lab]` 메뉴 항목을 `labs` 상태로 숨기고 보이기 |
| `src/tools/TimeSeriesTool.js` (새) + `TimeSeriesTool.test.js` (jsdom) | apply · setIndex · play/pause · 슬라이더 컨트롤 · 복원 |
| `src/ui/panels/TimeSeriesPanel.js` (새) + `TimeSeriesPanel.test.js` (jsdom) | 설정 모달 |
| `src/tools/animationExport.js` (새) + `animationExport.test.js` | 순수: mime 선택·확장자·라벨 배치·파일명·지연 (브라우저 API 없음) |
| `src/tools/animationExportCanvas.js` (새) | 캔버스·브라우저: 프레임 캡처(composeMapCanvas+drawLegend+라벨)·GIF(gifenc)·동영상(MediaRecorder) |
| `src/utils/saveFile.js` (수정) | `saveBlobAs(filename, blob)` |
| `src/ui/panels/AnimationExportDialog.js` (새) + `AnimationExportDialog.test.js` (jsdom) | 저장 대화상자(형식·배율·유지·라벨·범례·진행률·취소) |
| `src/ui/layout/AppLayout.js` (수정) | 주제도 메뉴 항목 `data-lab="time-series"` |
| `src/styles/main.css` (수정), `src/styles/glass.css` (수정) | 슬라이더 컨트롤 박스·대화상자·숨김 메뉴 규칙 |
| `src/main.js` (수정) | import·메뉴 액션·복원 훅·저장 훅·`__egisDebug.timeSeriesTool` |
| `src/labs/registry.js` (수정) | `time-series` 항목 |
| `docs/사용설명서.md` (수정) | 1-14 실험실 절에 시계열 문단 |
| `scripts/verify/labs-time-series.cjs` (새) | Electron 하네스 |
| `package.json`, `package-lock.json` (수정) | `gifenc` |

---

### Task 1: 순수 모듈 `timeSeriesModel.js`

**Files:**
- Create: `src/tools/timeSeriesModel.js`
- Test: `src/tools/timeSeriesModel.test.js`

- [ ] **Step 1: 실패하는 테스트 작성**

`src/tools/timeSeriesModel.test.js`:

```js
// © 2026 김용현
/**
 * 시계열 단계구분도의 순수 규칙.
 * - 연도 필드는 이름이 19xx/20xx 로 시작하는 것 (스펙: /^(19|20)\d{2}/).
 * - 구간은 선택한 모든 필드의 값을 합쳐 한 번만 계산한다 → unionValues 는 숫자만 모아 정렬.
 * - 슬라이더는 끝에서 처음으로 돌아간다(nextIndex).
 * - 직렬화 레코드는 원본과 참조를 공유하지 않는다.
 */
import { describe, it, expect } from 'vitest';
import {
  detectYearFields, unionValues, nextIndex, subtitleFor, derivedLayerName,
  timeSeriesRecord, normalizeTimeSeries, MAX_TIME_SERIES_FIELDS
} from './timeSeriesModel.js';

function feat(props) {
  return { get: (k) => props[k] };
}

describe('detectYearFields', () => {
  it('19xx·20xx 로 시작하는 이름만 고르고 순서를 지킨다', () => {
    expect(detectYearFields(['name', '2015', '2020_pop', '1995년', 'pop2010', '3000'])).toEqual(['2015', '2020_pop', '1995년']);
  });
  it('없으면 빈 배열', () => {
    expect(detectYearFields(['a', 'b'])).toEqual([]);
    expect(detectYearFields([])).toEqual([]);
  });
});

describe('unionValues', () => {
  it('모든 필드의 숫자 값을 합쳐 오름차순으로 돌려준다', () => {
    const features = [feat({ '2015': 10, '2020': '30' }), feat({ '2015': 20, '2020': null }), feat({ '2015': 'x', '2020': 5 })];
    expect(unionValues(features, ['2015', '2020'])).toEqual([5, 10, 20, 30]);
  });
  it('필드나 피처가 없으면 빈 배열', () => {
    expect(unionValues([], ['2015'])).toEqual([]);
    expect(unionValues([feat({ a: 1 })], [])).toEqual([]);
  });
});

describe('nextIndex', () => {
  it('끝에서 처음으로 돌아간다', () => {
    expect(nextIndex(0, 3)).toBe(1);
    expect(nextIndex(2, 3)).toBe(0);
    expect(nextIndex(5, 0)).toBe(0);
  });
});

describe('subtitleFor', () => {
  it('필드 이름과 위치를 적는다', () => {
    expect(subtitleFor('2015', 0, 6)).toBe('2015 (1/6)');
  });
});

describe('derivedLayerName', () => {
  it('원본_시계열_첫필드~끝필드', () => {
    expect(derivedLayerName('서울 자치구', ['2015', '2020', '2025'])).toBe('서울 자치구_시계열_2015~2025');
  });
});

describe('timeSeriesRecord / normalizeTimeSeries', () => {
  it('레코드는 깊은 복사이고 없으면 undefined', () => {
    const ts = { fields: ['2015', '2020'], index: 1 };
    const rec = timeSeriesRecord(ts);
    expect(rec).toEqual(ts);
    expect(rec.fields).not.toBe(ts.fields);
    expect(timeSeriesRecord(undefined)).toBeUndefined();
    expect(timeSeriesRecord({ fields: ['x'] })).toBeUndefined();   // 필드 2개 미만은 시계열이 아니다
  });

  it('복원값을 정돈한다: 문자열 필드만, 인덱스는 범위 안, 30개 제한', () => {
    expect(normalizeTimeSeries({ fields: ['2015', 7, '2020'], index: 9 })).toEqual({ fields: ['2015', '2020'], index: 1 });
    expect(normalizeTimeSeries({ fields: ['2015', '2020'], index: -3 })).toEqual({ fields: ['2015', '2020'], index: 0 });
    expect(normalizeTimeSeries({ fields: ['2015'] })).toBeNull();
    expect(normalizeTimeSeries(null)).toBeNull();
    const many = Array.from({ length: 40 }, (_, i) => String(1990 + i));
    expect(normalizeTimeSeries({ fields: many, index: 0 }).fields).toHaveLength(MAX_TIME_SERIES_FIELDS);
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run src/tools/timeSeriesModel.test.js`
Expected: FAIL — `Failed to resolve import "./timeSeriesModel.js"`.

- [ ] **Step 3: 구현**

`src/tools/timeSeriesModel.js`:

```js
// © 2026 김용현
/**
 * 시계열 단계구분도 — 순수 규칙.
 *
 * DOM·OpenLayers 를 모른다. 피처는 `get(key)` 만 있으면 된다(OL Feature 도 맞는다).
 * 시계열은 단계구분도 설정(_choroplethConfig)에 `timeSeries: { fields, index }` 를 더한 것이다.
 * 설계: docs/superpowers/specs/2026-09-25-labs-design.md 「4단계」
 */

/** 한 시계열에 넣을 수 있는 필드 수 (스펙: 30개까지) */
export const MAX_TIME_SERIES_FIELDS = 30;

/** 연도로 시작하는 필드 이름 — 스펙의 「연도 자동 선택」 규칙 */
export const YEAR_FIELD_RE = /^(19|20)\d{2}/;

/**
 * @param {string[]} fields 속성 이름 목록(속성 순서)
 * @returns {string[]} 연도로 시작하는 이름들, 같은 순서
 */
export function detectYearFields(fields) {
  return (fields || []).filter((f) => YEAR_FIELD_RE.test(String(f)));
}

/**
 * 선택한 모든 필드의 숫자 값을 합쳐 오름차순으로.
 * 구간을 연도 사이에 공유하려면 이 배열로 한 번만 계산해야 한다.
 */
export function unionValues(features, fields) {
  const values = [];
  for (const feature of features || []) {
    for (const field of fields || []) {
      const raw = feature.get(field);
      if (raw === null || raw === undefined || raw === '') continue;
      const num = typeof raw === 'number' ? raw : parseFloat(raw);
      if (Number.isFinite(num)) values.push(num);
    }
  }
  return values.sort((a, b) => a - b);
}

/** 재생 중 다음 칸 — 끝에서 처음으로 */
export function nextIndex(index, count) {
  if (!(count > 0)) return 0;
  return (index + 1) % count;
}

/** 범례 부제: 현재 필드와 위치 */
export function subtitleFor(field, index, count) {
  return `${field} (${index + 1}/${count})`;
}

/** 파생 레이어 이름 규칙 — 스펙: 원본_시계열_첫필드~끝필드 */
export function derivedLayerName(sourceName, fields) {
  return `${sourceName}_시계열_${fields[0]}~${fields[fields.length - 1]}`;
}

/**
 * 저장용 레코드(깊은 복사). 시계열이 아니면 undefined 라 JSON 에서 빠진다.
 * StateManager.saveLayer 와 ProjectManager.serialize 가 같은 함수를 쓴다.
 */
export function timeSeriesRecord(ts) {
  if (!ts || !Array.isArray(ts.fields) || ts.fields.length < 2) return undefined;
  return { fields: ts.fields.slice(), index: Number.isInteger(ts.index) ? ts.index : 0 };
}

/**
 * 복원값 정돈 — 저장본이 손상됐거나 옛 형식이어도 앱이 죽지 않게.
 * @returns {{fields: string[], index: number}|null}
 */
export function normalizeTimeSeries(raw) {
  if (!raw || !Array.isArray(raw.fields)) return null;
  const fields = raw.fields.filter((f) => typeof f === 'string' && f.length > 0).slice(0, MAX_TIME_SERIES_FIELDS);
  if (fields.length < 2) return null;
  const index = Number.isInteger(raw.index) ? Math.max(0, Math.min(fields.length - 1, raw.index)) : 0;
  return { fields, index };
}
```

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run src/tools/timeSeriesModel.test.js`
Expected: PASS (9 tests).

- [ ] **Step 5: 커밋**

```bash
git add src/tools/timeSeriesModel.js src/tools/timeSeriesModel.test.js
git -c user.name=yhk1m -c user.email=83273992+yhk1m@users.noreply.github.com commit -m "feat(time-series): 순수 규칙 — 연도 필드·값 합치기·인덱스·이름·직렬화"
```

---

### Task 2: `ChoroplethTool.apply` 에 미리 계산한 구간(`options.breaks`)·이름·제목 확장

**Files:**
- Modify: `src/tools/ChoroplethTool.js:180-270` (`apply`; 1단계가 바꾼 뒤의 실제 위치는 파일을 읽고 맞춘다)
- Test: `src/tools/ChoroplethTool.presetBreaks.test.js` (jsdom)

- [ ] **Step 1: 실패하는 테스트 작성**

`src/tools/ChoroplethTool.presetBreaks.test.js`:

```js
// © 2026 김용현
// @vitest-environment jsdom
/**
 * 시계열은 연도 사이에 구간을 공유해야 하므로 apply 에 미리 계산한 구간을 넘긴다.
 * 넘긴 구간은 그대로 쓰이고, 파생 레이어 이름·범례 제목도 지정할 수 있어야 한다.
 * (스펙 4단계: "ChoroplethTool.apply 에 options.breaks 를 받는 확장 하나")
 */
import { describe, it, expect, beforeEach } from 'vitest';
import Feature from 'ol/Feature.js';
import Polygon from 'ol/geom/Polygon.js';
import { layerManager } from '../core/LayerManager.js';
import { choroplethTool } from './ChoroplethTool.js';

function cell(props) {
  return new Feature({
    geometry: new Polygon([[[0, 0], [100, 0], [100, 100], [0, 100], [0, 0]]]),
    ...props
  });
}

function sourceLayer() {
  return layerManager.addLayer({
    name: '구',
    type: 'vector',
    features: [cell({ '2015': 10, '2020': 40 }), cell({ '2015': 20, '2020': 80 }), cell({ '2015': 30, '2020': 120 })]
  });
}

beforeEach(() => {
  document.body.innerHTML = '<div id="map"></div>';
  layerManager.getAllLayers().slice().forEach((l) => layerManager.removeLayer(l.id));
});

describe('ChoroplethTool.apply options.breaks', () => {
  it('넘긴 구간을 계산하지 않고 그대로 쓴다', () => {
    const id = sourceLayer();
    const breaks = [0, 40, 80, 120];
    const result = choroplethTool.apply(id, '2015', 'blues', 'equalInterval', 3, { breaks });
    expect(result.breaks).toEqual(breaks);
    expect(result.breaks).not.toBe(breaks);                    // 복사본
    const cfg = layerManager.getLayer(result.layerId)._choroplethConfig;
    expect(cfg.breaks).toEqual(breaks);
    expect(cfg.colors).toHaveLength(3);
  });

  it('구간을 안 넘기면 예전처럼 값에서 계산한다', () => {
    const id = sourceLayer();
    const result = choroplethTool.apply(id, '2015', 'blues', 'equalInterval', 2, {});
    expect(result.breaks).toEqual([10, 20, 30]);
  });

  it('name·title 을 지정할 수 있고, 없으면 예전 규칙', () => {
    const id = sourceLayer();
    const a = choroplethTool.apply(id, '2015', 'blues', 'equalInterval', 3, { name: '구_시계열_2015~2020', title: '구 (2015~2020)' });
    expect(layerManager.getLayer(a.layerId).name).toBe('구_시계열_2015~2020');
    expect(layerManager.getLayer(a.layerId)._choroplethConfig.title).toBe('구 (2015~2020)');
    const b = choroplethTool.apply(id, '2020', 'blues', 'equalInterval', 3, {});
    expect(layerManager.getLayer(b.layerId).name).toBe('구_단계구분_2020');
    expect(layerManager.getLayer(b.layerId)._choroplethConfig.title).toBe('구 (2020)');
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run src/tools/ChoroplethTool.presetBreaks.test.js`
Expected: FAIL — 첫 테스트에서 `result.breaks` 가 `[10, 20, 30, …]`(값에서 계산한 것)이라 `toEqual([0,40,80,120])` 실패, 셋째 테스트에서 이름이 `구_단계구분_2015`.

- [ ] **Step 3: 구현**

`src/tools/ChoroplethTool.js` 의 `apply` 에서 세 곳을 바꾼다. (1단계 이후 `apply` 가 스타일 함수를 직접 만들지 않고 `updateLayerStyle` 을 부르더라도 아래 세 곳은 그대로 있다 — 없으면 같은 뜻의 자리를 찾는다.)

(1) 옵션 풀기 — `const { reverse = false, customColors = null } = options;` 를:

```js
    const {
      reverse = false,
      customColors = null,
      breaks: presetBreaks = null,   // 시계열: 연도 사이에 공유할, 미리 계산한 구간
      name = null,                    // 파생 레이어 이름(없으면 원본_단계구분_속성)
      title = null                    // 범례 제목(없으면 원본 (속성))
    } = options;
```

(2) 구간 계산 — 

```js
    const values = this.getAttributeValues(layerId, attribute);
    if (values.length === 0) return false;
    const breaks = this.calculateBreaks(values, numClasses, method);
```
를:

```js
    const usePreset = Array.isArray(presetBreaks) && presetBreaks.length >= 2;
    const values = this.getAttributeValues(layerId, attribute);
    if (values.length === 0 && !usePreset) return false;
    const breaks = usePreset ? presetBreaks.slice() : this.calculateBreaks(values, numClasses, method);
```

(3) 이름·제목 — `layerManager.addLayer({ name: \`${sourceLayer.name}_단계구분_${attribute}\`, …` 의 `name` 을 `name: name || \`${sourceLayer.name}_단계구분_${attribute}\`,` 로, `_choroplethConfig` 의 `title: \`${sourceLayer.name} (${attribute})\`` 를 `title: title || \`${sourceLayer.name} (${attribute})\`` 로.

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run src/tools/ChoroplethTool.presetBreaks.test.js src/tools/ChoroplethTool.joinedAttrs.test.js`
Expected: PASS (5 tests).

- [ ] **Step 5: 커밋**

```bash
git add src/tools/ChoroplethTool.js src/tools/ChoroplethTool.presetBreaks.test.js
git -c user.name=yhk1m -c user.email=83273992+yhk1m@users.noreply.github.com commit -m "feat(choropleth): apply 에 미리 계산한 구간·이름·제목 옵션"
```

---

### Task 3: `timeSeries` 직렬화·복제·복원 + 자동 복원 완료 이벤트

**Files:**
- Modify: `src/core/StateManager.js:171-183` (choroplethConfig 직렬화)
- Modify: `src/core/ProjectManager.js:136-142` (choroplethConfig 직렬화)
- Modify: `src/core/LayerManager.js:572` (복제 얕은 복사)
- Modify: `src/core/AutoSaveManager.js:262-267` (`restoreState` 끝), `src/core/AutoSaveManager.js:308-313` (복원 시 정돈)
- Modify: `src/core/ProjectManager.js:309-311` (복원 시 정돈)
- Modify: `src/utils/EventBus.js:95-97` (`STATE_RESTORED`)
- Test: `src/core/AutoSaveManager.timeSeries.test.js` (jsdom)

- [ ] **Step 1: 실패하는 테스트 작성**

`src/core/AutoSaveManager.timeSeries.test.js`:

```js
// © 2026 김용현
// @vitest-environment jsdom
/**
 * 자동 저장 복원이 단계구분도 설정의 timeSeries 를 살려 두는지.
 * 복원 직후에는 저장된 인덱스의 정적 단계구분도로 서고, 컨트롤은 STATE_RESTORED 를 듣는
 * main.js 가 되살린다(TimeSeriesTool.restoreControls). 여기서는 설정과 이벤트만 본다.
 * 스텁은 AutoSaveManager.restore.test.js 와 같은 이유로 같은 것을 심는다.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import GeoJSON from 'ol/format/GeoJSON.js';

globalThis.indexedDB = {
  open: () => ({ onerror: null, onsuccess: null, onupgradeneeded: null })
};
HTMLCanvasElement.prototype.getContext = function () {
  return {
    canvas: this,
    createLinearGradient: () => ({ addColorStop: () => {} }),
    fillRect: () => {},
    getImageData: (x, y, w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }),
    set fillStyle(_v) {},
    get fillStyle() { return '#000'; }
  };
};
vi.mock('../tools/FlowTool.js', () => ({
  flowTool: { restoreFlow: vi.fn((layerData) => layerData.id) }
}));

const { layerManager } = await import('./LayerManager.js');
const { autoSaveManager } = await import('./AutoSaveManager.js');
const { stateManager } = await import('./StateManager.js');
const { eventBus, Events } = await import('../utils/EventBus.js');

const SQUARE = {
  type: 'FeatureCollection',
  features: [
    { type: 'Feature', geometry: { type: 'Polygon', coordinates: [[[126.9, 37.5], [127.0, 37.5], [127.0, 37.6], [126.9, 37.6], [126.9, 37.5]]] }, properties: { '2015': 10, '2020': 30 } },
    { type: 'Feature', geometry: { type: 'Polygon', coordinates: [[[127.0, 37.5], [127.1, 37.5], [127.1, 37.6], [127.0, 37.6], [127.0, 37.5]]] }, properties: { '2015': 20, '2020': 60 } }
  ]
};

function savedTimeSeriesLayer() {
  return {
    id: 'ts-derived',
    name: '구_시계열_2015~2020',
    type: 'choropleth',
    geometryType: 'Polygon',
    color: '#3b82f6',
    visible: true,
    features: SQUARE,
    choroplethConfig: {
      attribute: '2020',
      breaks: [0, 30, 60],
      colors: ['#deebf7', '#2171b5'],
      title: '구 (2015~2020)',
      unit: '', format: 'comma', rounding: 0,
      timeSeries: { fields: ['2015', 7, '2020'], index: 5 }    // 일부러 지저분한 저장본
    }
  };
}

beforeEach(() => {
  document.body.innerHTML = '<div id="map"></div>';
  layerManager.getAllLayers().slice().forEach((l) => layerManager.removeLayer(l.id));
});

describe('restoreLayer + timeSeries', () => {
  it('설정에 정돈된 timeSeries 가 붙고 attribute 는 저장값 그대로', async () => {
    await autoSaveManager.restoreLayer(savedTimeSeriesLayer());
    const info = layerManager.getLayer('ts-derived');
    expect(info).toBeTruthy();
    expect(info._choroplethConfig.timeSeries).toEqual({ fields: ['2015', '2020'], index: 1 });
    expect(info._choroplethConfig.attribute).toBe('2020');
    expect(document.getElementById('choropleth-legend-ts-derived')).toBeTruthy();
  });

  it('timeSeries 가 없거나 망가졌으면 붙이지 않는다', async () => {
    const data = savedTimeSeriesLayer();
    data.choroplethConfig.timeSeries = { fields: ['2015'] };
    await autoSaveManager.restoreLayer(data);
    expect(layerManager.getLayer('ts-derived')._choroplethConfig.timeSeries).toBeUndefined();
  });
});

describe('restoreState', () => {
  it('끝나면 STATE_RESTORED 를 한 번 낸다', async () => {
    vi.spyOn(stateManager, 'getMapState').mockReturnValue(null);
    vi.spyOn(stateManager, 'getAllLayers').mockResolvedValue([savedTimeSeriesLayer()]);
    const cb = vi.fn();
    eventBus.on(Events.STATE_RESTORED, cb);
    await autoSaveManager.restoreState();
    expect(cb).toHaveBeenCalledTimes(1);
    expect(cb).toHaveBeenCalledWith({ layerCount: 1 });
    eventBus.off(Events.STATE_RESTORED, cb);
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run src/core/AutoSaveManager.timeSeries.test.js`
Expected: FAIL — 첫 테스트는 `timeSeries` 가 정돈 없이 `{ fields: ['2015', 7, '2020'], index: 5 }` 그대로라 실패, 셋째는 `Events.STATE_RESTORED` 가 `undefined` 라 실패.

- [ ] **Step 3: 이벤트 상수**

`src/utils/EventBus.js` 의 `PROJECT_NEW: 'project:new',` 아래에:

```js
  // 자동 저장 복원이 모든 레이어를 되살린 뒤 (실험 기능이 컨트롤을 되살릴 때 듣는다)
  STATE_RESTORED: 'state:restored',
```

- [ ] **Step 4: `AutoSaveManager.restoreState` 끝에 이벤트**

`console.log('상태 복원 완료');` 바로 뒤(같은 `try` 안):

```js
      eventBus.emit(Events.STATE_RESTORED, { layerCount: savedLayers.length });
```

`AutoSaveManager.js` 머리에 `eventBus, Events` import 가 이미 있다(`bindEvents` 가 쓴다). 없으면 `import { eventBus, Events } from '../utils/EventBus.js';` 를 더한다.

- [ ] **Step 5: 복원 시 `timeSeries` 정돈 (AutoSaveManager·ProjectManager 두 곳)**

`src/core/AutoSaveManager.js` 머리에 `import { normalizeTimeSeries } from '../tools/timeSeriesModel.js';`,
`src/core/ProjectManager.js` 머리에 `import { normalizeTimeSeries, timeSeriesRecord } from '../tools/timeSeriesModel.js';` (Step 6 의 직렬화도 쓴다).

`src/core/AutoSaveManager.js` `restoreLayer` 의

```js
        restoredLayer._choroplethConfig = {
          ...layerData.choroplethConfig,
          tool: choroplethTool
        };
```
바로 뒤에:

```js
        // 시계열: 저장본이 지저분해도 정돈된 값만 붙인다. 없으면 정적 단계구분도.
        const ts = normalizeTimeSeries(layerData.choroplethConfig.timeSeries);
        if (ts) restoredLayer._choroplethConfig.timeSeries = ts;
        else delete restoredLayer._choroplethConfig.timeSeries;
```

`src/core/ProjectManager.js` `deserialize` 의 `layerInfo._choroplethConfig = { ...layerData.choroplethConfig, tool: choroplethTool };` 바로 뒤에 같은 네 줄(변수 이름은 `layerInfo`):

```js
            const ts = normalizeTimeSeries(layerData.choroplethConfig.timeSeries);
            if (ts) layerInfo._choroplethConfig.timeSeries = ts;
            else delete layerInfo._choroplethConfig.timeSeries;
```

- [ ] **Step 6: 직렬화 두 곳**

`src/core/StateManager.js` `saveLayer` 의 `choroplethConfig = { … controlsHidden: cfg.controlsHidden };` 객체에 마지막 항목으로 (1단계가 넣은 `fills` 뒤):

```js
        timeSeries: timeSeriesRecord(cfg.timeSeries)
```

`src/core/StateManager.js` 머리에 `import { timeSeriesRecord } from '../tools/timeSeriesModel.js';`.

`src/core/ProjectManager.js` `serialize` 의 `base.choroplethConfig = { … rounding: cfg.rounding, controlsHidden: cfg.controlsHidden };` 에도 같은 항목:

```js
            timeSeries: timeSeriesRecord(cfg.timeSeries)
```

(`undefined` 는 JSON 에서 빠지므로 시계열이 아닌 레이어의 저장본은 바뀌지 않는다.)

- [ ] **Step 7: 복제 시 깊은 복사**

`src/core/LayerManager.js` 의 `if (info._choroplethConfig) copy._choroplethConfig = { ...info._choroplethConfig };` 를:

```js
      if (info._choroplethConfig) {
        copy._choroplethConfig = { ...info._choroplethConfig };
        // 얕은 복사는 배열·객체를 공유한다 — 복제본의 연도를 넘기면 원본도 따라 움직인다
        if (info._choroplethConfig.timeSeries) {
          copy._choroplethConfig.timeSeries = {
            fields: info._choroplethConfig.timeSeries.fields.slice(),
            index: info._choroplethConfig.timeSeries.index
          };
        }
      }
```

(1단계가 같은 자리에 `fills` 깊은 복사를 넣었다면 그 블록 안에 `timeSeries` 줄만 더한다.)

- [ ] **Step 8: 통과 확인**

Run: `npx vitest run src/core/`
Expected: 전부 PASS (새 3 tests 포함).

- [ ] **Step 9: 커밋**

```bash
git add src/core/StateManager.js src/core/ProjectManager.js src/core/LayerManager.js src/core/AutoSaveManager.js src/utils/EventBus.js src/core/AutoSaveManager.timeSeries.test.js
git -c user.name=yhk1m -c user.email=83273992+yhk1m@users.noreply.github.com commit -m "feat(time-series): choroplethConfig.timeSeries 저장·복원·복제, 자동 복원 완료 이벤트"
```

---

### Task 4: 실험 메뉴 항목 숨김 `labMenu.js` + 주제도 메뉴 마크업

**Files:**
- Create: `src/labs/labMenu.js`
- Test: `src/labs/labMenu.test.js`
- Modify: `src/ui/layout/AppLayout.js:127` (단계구분도 항목 뒤)
- Modify: `src/styles/main.css:166` 부근 (`.dropdown-item` 규칙 뒤)

- [ ] **Step 1: 실패하는 테스트 작성**

`src/labs/labMenu.test.js`:

```js
// © 2026 김용현
/**
 * data-lab="<id>" 가 붙은 메뉴 항목은 그 실험이 켜졌을 때만 보인다.
 * 켜고 끄면 바로 반영된다(새로고침 불필요).
 */
import { describe, it, expect } from 'vitest';
import { bindLabMenuItems } from './labMenu.js';
import { Labs } from './labs.js';

function fakeItem(id) {
  return { dataset: { lab: id }, hidden: true };
}

describe('bindLabMenuItems', () => {
  it('초기 상태를 적용하고 변경을 따른다', () => {
    const labs = new Labs();
    labs.init({ knownIds: ['time-series', 'globe'], search: '?lab=globe' });
    const ts = fakeItem('time-series');
    const globe = fakeItem('globe');
    const off = bindLabMenuItems(labs, [ts, globe]);
    expect(ts.hidden).toBe(true);
    expect(globe.hidden).toBe(false);

    labs.set('time-series', true);
    expect(ts.hidden).toBe(false);
    labs.set('time-series', false);
    expect(ts.hidden).toBe(true);

    off();
    labs.set('time-series', true);
    expect(ts.hidden).toBe(true);   // 해제 뒤엔 안 따른다
  });

  it('모르는 id 항목은 항상 숨긴다', () => {
    const labs = new Labs();
    labs.init({ knownIds: ['globe'] });
    const item = fakeItem('retired');
    bindLabMenuItems(labs, [item]);
    expect(item.hidden).toBe(true);
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run src/labs/labMenu.test.js`
Expected: FAIL — `Failed to resolve import "./labMenu.js"`.

- [ ] **Step 3: 구현**

`src/labs/labMenu.js`:

```js
// © 2026 김용현
/**
 * 실험 기능의 메뉴 항목 — `data-lab="<id>"` 가 붙은 요소를 labs 상태로 숨기고 보인다.
 * 승격할 때는 마크업에서 data-lab 과 hidden 만 지우면 된다.
 */

/**
 * @param {import('./labs.js').Labs} labs
 * @param {ArrayLike<{dataset: {lab: string}, hidden: boolean}>} items 기본은 document 의 [data-lab] 전부
 * @returns {() => void} 해제 함수
 */
export function bindLabMenuItems(labs, items = document.querySelectorAll('[data-lab]')) {
  const list = Array.from(items);
  const apply = () => list.forEach((el) => { el.hidden = !labs.isOn(el.dataset.lab); });
  apply();
  return labs.onChange(apply);
}
```

- [ ] **Step 4: 메뉴 마크업**

`src/ui/layout/AppLayout.js` 의 `<div class="dropdown-item" data-action="analysis-choropleth">단계구분도</div>` 바로 아래에:

```html
                <div class="dropdown-item" data-action="analysis-time-series" data-lab="time-series" hidden>시계열 단계구분도</div>
```

- [ ] **Step 5: 숨김 CSS**

`src/styles/main.css` 의 `.dropdown-item { … }` 블록 바로 뒤에 (`display:flex` 등이 `hidden` 속성을 이길 수 있으므로 명시):

```css
/* 실험 기능 메뉴 항목 — 실험이 꺼져 있으면 hidden */
.dropdown-item[hidden] {
  display: none;
}
```

- [ ] **Step 6: 통과 확인**

Run: `npx vitest run src/labs/`
Expected: PASS.

- [ ] **Step 7: 커밋**

```bash
git add src/labs/labMenu.js src/labs/labMenu.test.js src/ui/layout/AppLayout.js src/styles/main.css
git -c user.name=yhk1m -c user.email=83273992+yhk1m@users.noreply.github.com commit -m "feat(labs): data-lab 메뉴 항목 숨김, 주제도 메뉴에 시계열 단계구분도"
```

---

### Task 5: `TimeSeriesTool.js` — 적용·연도 이동·재생·슬라이더 컨트롤·복원

**Files:**
- Create: `src/tools/TimeSeriesTool.js`
- Test: `src/tools/TimeSeriesTool.test.js` (jsdom)

- [ ] **Step 1: 실패하는 테스트 작성**

`src/tools/TimeSeriesTool.test.js`:

```js
// © 2026 김용현
// @vitest-environment jsdom
/**
 * 시계열 도구: 구간은 모든 필드를 합쳐 한 번만 계산해 고정하고, 연도 이동은
 * cfg.attribute 만 바꾼다. 컨트롤은 #map 안에 하나만 산다.
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import Feature from 'ol/Feature.js';
import Polygon from 'ol/geom/Polygon.js';
import { layerManager } from '../core/LayerManager.js';
import { eventBus, Events } from '../utils/EventBus.js';
import { timeSeriesTool, BASE_INTERVAL_MS } from './TimeSeriesTool.js';

function cell(props) {
  return new Feature({
    geometry: new Polygon([[[0, 0], [100, 0], [100, 100], [0, 100], [0, 0]]]),
    ...props
  });
}

function sourceLayer() {
  return layerManager.addLayer({
    name: '구',
    type: 'vector',
    features: [
      cell({ name: 'a', '2015': 10, '2020': 40, '2025': 70 }),
      cell({ name: 'b', '2015': 20, '2020': 50, '2025': 80 }),
      cell({ name: 'c', '2015': 30, '2020': 60, '2025': 90 })
    ]
  });
}

beforeEach(() => {
  document.body.innerHTML = '<div id="map"></div>';
  timeSeriesTool.detach();
  layerManager.getAllLayers().slice().forEach((l) => layerManager.removeLayer(l.id));
});

afterEach(() => {
  vi.useRealTimers();
});

describe('apply', () => {
  it('모든 필드의 값을 합쳐 구간을 한 번 계산하고 timeSeries 를 심는다', () => {
    const id = sourceLayer();
    const derivedId = timeSeriesTool.apply({ layerId: id, fields: ['2015', '2020', '2025'], method: 'equalInterval', numClasses: 4, colorRamp: 'blues' });
    const info = layerManager.getLayer(derivedId);
    expect(info.name).toBe('구_시계열_2015~2025');
    expect(info._choroplethConfig.breaks).toEqual([10, 30, 50, 70, 90]);   // 10~90 을 4등분
    expect(info._choroplethConfig.timeSeries).toEqual({ fields: ['2015', '2020', '2025'], index: 0 });
    expect(info._choroplethConfig.attribute).toBe('2015');
    expect(info._choroplethConfig.title).toBe('구 (2015~2025)');
  });

  it('필드가 2개 미만이면 null', () => {
    const id = sourceLayer();
    expect(timeSeriesTool.apply({ layerId: id, fields: ['2015'] })).toBeNull();
  });

  it('컨트롤을 #map 에 만들고 range 의 max 는 필드 수 - 1', () => {
    const id = sourceLayer();
    timeSeriesTool.apply({ layerId: id, fields: ['2015', '2020', '2025'] });
    const box = document.getElementById('time-series-controls');
    expect(box).toBeTruthy();
    expect(box.querySelector('#ts-range').max).toBe('2');
    expect(box.querySelector('#ts-field').textContent).toBe('2015');
  });
});

describe('setIndex / step', () => {
  it('attribute 와 범례 부제·슬라이더를 바꾸고 LAYER_STYLE_CHANGED 를 낸다', () => {
    const id = sourceLayer();
    const derivedId = timeSeriesTool.apply({ layerId: id, fields: ['2015', '2020', '2025'] });
    const cb = vi.fn();
    eventBus.on(Events.LAYER_STYLE_CHANGED, cb);
    timeSeriesTool.setIndex(2);
    const cfg = layerManager.getLayer(derivedId)._choroplethConfig;
    expect(cfg.attribute).toBe('2025');
    expect(cfg.timeSeries.index).toBe(2);
    expect(cb).toHaveBeenCalledWith({ layerId: derivedId });
    expect(document.querySelector('#choropleth-legend-' + derivedId + ' .choropleth-legend-subtitle').textContent).toBe('2025 (3/3)');
    expect(document.getElementById('ts-range').value).toBe('2');
    eventBus.off(Events.LAYER_STYLE_CHANGED, cb);
  });

  it('범위를 벗어난 인덱스는 잘린다, step 은 끝에서 처음으로', () => {
    const id = sourceLayer();
    const derivedId = timeSeriesTool.apply({ layerId: id, fields: ['2015', '2020'] });
    timeSeriesTool.setIndex(9);
    expect(layerManager.getLayer(derivedId)._choroplethConfig.attribute).toBe('2020');
    timeSeriesTool.step();
    expect(layerManager.getLayer(derivedId)._choroplethConfig.attribute).toBe('2015');
  });

  it('range 입력이 setIndex 로 이어진다', () => {
    const id = sourceLayer();
    const derivedId = timeSeriesTool.apply({ layerId: id, fields: ['2015', '2020', '2025'] });
    const range = document.getElementById('ts-range');
    range.value = '1';
    range.dispatchEvent(new Event('input', { bubbles: true }));
    expect(layerManager.getLayer(derivedId)._choroplethConfig.attribute).toBe('2020');
  });
});

describe('play / pause / speed', () => {
  it('BASE_INTERVAL_MS / speed 마다 한 칸 간다', () => {
    vi.useFakeTimers();
    const id = sourceLayer();
    const derivedId = timeSeriesTool.apply({ layerId: id, fields: ['2015', '2020', '2025'] });
    timeSeriesTool.setSpeed(2);
    timeSeriesTool.play();
    expect(timeSeriesTool.isPlaying()).toBe(true);
    expect(document.getElementById('ts-play').getAttribute('aria-pressed')).toBe('true');
    vi.advanceTimersByTime(BASE_INTERVAL_MS / 2);
    expect(layerManager.getLayer(derivedId)._choroplethConfig.attribute).toBe('2020');
    vi.advanceTimersByTime(BASE_INTERVAL_MS / 2);
    expect(layerManager.getLayer(derivedId)._choroplethConfig.attribute).toBe('2025');
    timeSeriesTool.pause();
    vi.advanceTimersByTime(BASE_INTERVAL_MS * 3);
    expect(layerManager.getLayer(derivedId)._choroplethConfig.attribute).toBe('2025');
    expect(timeSeriesTool.isPlaying()).toBe(false);
  });
});

describe('detach / 레이어 삭제 / 복원', () => {
  it('detach 는 컨트롤을 없애고 재생을 멈춘다', () => {
    vi.useFakeTimers();
    const id = sourceLayer();
    timeSeriesTool.apply({ layerId: id, fields: ['2015', '2020'] });
    timeSeriesTool.play();
    timeSeriesTool.detach();
    expect(document.getElementById('time-series-controls')).toBeNull();
    expect(timeSeriesTool.isPlaying()).toBe(false);
    expect(timeSeriesTool.layerId).toBeNull();
  });

  it('대상 레이어가 삭제되면 조용히 끝난다', () => {
    const id = sourceLayer();
    const derivedId = timeSeriesTool.apply({ layerId: id, fields: ['2015', '2020'] });
    layerManager.removeLayer(derivedId);
    expect(document.getElementById('time-series-controls')).toBeNull();
    expect(timeSeriesTool.layerId).toBeNull();
  });

  it('restoreControls 는 timeSeries 가 있는 레이어를 찾아 컨트롤을 되살린다', () => {
    const id = sourceLayer();
    const derivedId = timeSeriesTool.apply({ layerId: id, fields: ['2015', '2020', '2025'] });
    timeSeriesTool.setIndex(1);
    timeSeriesTool.detach();
    expect(timeSeriesTool.restoreControls()).toBe(derivedId);
    expect(document.getElementById('ts-field').textContent).toBe('2020');
    expect(layerManager.getLayer(derivedId)._choroplethConfig.attribute).toBe('2020');
  });

  it('restoreControls 는 대상이 없으면 null', () => {
    sourceLayer();
    expect(timeSeriesTool.restoreControls()).toBeNull();
  });

  it('저장 버튼은 onSave 훅을 부른다', () => {
    const id = sourceLayer();
    const derivedId = timeSeriesTool.apply({ layerId: id, fields: ['2015', '2020'] });
    const onSave = vi.fn();
    timeSeriesTool.onSave = onSave;
    document.getElementById('ts-save').click();
    expect(onSave).toHaveBeenCalledWith(derivedId);
    timeSeriesTool.onSave = null;
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run src/tools/TimeSeriesTool.test.js`
Expected: FAIL — `Failed to resolve import "./TimeSeriesTool.js"`.

- [ ] **Step 3: 구현**

`src/tools/TimeSeriesTool.js`:

```js
// © 2026 김용현
/**
 * TimeSeriesTool - 시계열 단계구분도 (실험실 `time-series`)
 *
 * 시계열은 단계구분도 설정에 timeSeries: { fields, index } 를 더한 것이다.
 * - apply: 모든 필드 값을 합쳐 구간을 한 번만 계산 → choroplethTool.apply(…, { breaks }) → 설정에 timeSeries.
 * - setIndex: cfg.attribute = fields[i] → layerManager.updateLayerStyle (LAYER_STYLE_CHANGED 가 자동 저장을 깨운다)
 *             → 범례 부제 갱신 → 슬라이더 갱신.
 * - 컨트롤은 #map 안 지도 아래 가운데, 한 번에 하나(가장 최근 시계열 레이어).
 * 저장(애니메이션)은 onSave 훅으로 밖(main.js → AnimationExportDialog)에 맡긴다 — 대화상자가
 * 이 도구를 import 하므로 여기서 대화상자를 import 하면 순환이 된다.
 * 설계: docs/superpowers/specs/2026-09-25-labs-design.md 「4단계」
 */
import { layerManager } from '../core/LayerManager.js';
import { eventBus, Events } from '../utils/EventBus.js';
import { choroplethTool } from './ChoroplethTool.js';
import {
  unionValues, nextIndex, subtitleFor, derivedLayerName, MAX_TIME_SERIES_FIELDS
} from './timeSeriesModel.js';

/** 1× 재생 간격 (스펙: 1.2초, 반복) */
export const BASE_INTERVAL_MS = 1200;
export const SPEEDS = [0.5, 1, 2];

const ICON_PLAY = `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><polygon points="6 4 20 12 6 20"/></svg>`;
const ICON_PAUSE = `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="5" y="4" width="5" height="16"/><rect x="14" y="4" width="5" height="16"/></svg>`;
const ICON_CLOSE = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;

class TimeSeriesTool {
  constructor() {
    this.layerId = null;
    this.controls = null;
    this.timer = null;
    this.speed = 1;
    /** @type {((layerId: string) => void)|null} 저장 버튼 훅 — main.js 가 넣는다 */
    this.onSave = null;

    eventBus.on(Events.LAYER_REMOVED, (data) => {
      if (data && data.layerId === this.layerId) this.detach();
    });
  }

  /**
   * @param {{layerId: string, fields: string[], method?: string, numClasses?: number,
   *          colorRamp?: string, reverse?: boolean, customColors?: string[]|null}} options
   * @returns {string|null} 파생 레이어 id
   */
  apply({ layerId, fields, method = 'equalInterval', numClasses = 5, colorRamp = 'blues', reverse = false, customColors = null }) {
    const source = layerManager.getLayer(layerId);
    if (!source || !source.source) return null;
    const list = (fields || []).slice(0, MAX_TIME_SERIES_FIELDS);
    if (list.length < 2) return null;

    // 구간은 모든 연도의 값을 합쳐 한 번만 — 연도 사이 비교가 되려면 구간이 같아야 한다
    const values = unionValues(source.source.getFeatures(), list);
    if (values.length === 0) return null;
    const breaks = choroplethTool.calculateBreaks(values, numClasses, method);

    const result = choroplethTool.apply(layerId, list[0], colorRamp, method, numClasses, {
      reverse,
      customColors,
      breaks,
      name: derivedLayerName(source.name, list),
      title: `${source.name} (${list[0]}~${list[list.length - 1]})`
    });
    if (!result) return null;

    const info = layerManager.getLayer(result.layerId);
    info._choroplethConfig.timeSeries = { fields: list, index: 0 };
    this.attachControls(result.layerId);
    this.setIndex(0);
    return result.layerId;
  }

  /** 시계열 설정(없으면 null) */
  config(layerId = this.layerId) {
    const info = layerId ? layerManager.getLayer(layerId) : null;
    const cfg = info && info._choroplethConfig;
    return cfg && cfg.timeSeries ? cfg : null;
  }

  setIndex(index) {
    const cfg = this.config();
    if (!cfg) return;
    const n = cfg.timeSeries.fields.length;
    const idx = Math.max(0, Math.min(n - 1, Number.isInteger(index) ? index : 0));
    cfg.timeSeries.index = idx;
    cfg.attribute = cfg.timeSeries.fields[idx];
    layerManager.updateLayerStyle(this.layerId);   // LAYER_STYLE_CHANGED → 자동 저장
    this.updateLegendSubtitle(cfg);
    this.renderControls(cfg);
  }

  step() {
    const cfg = this.config();
    if (!cfg) return;
    this.setIndex(nextIndex(cfg.timeSeries.index, cfg.timeSeries.fields.length));
  }

  isPlaying() {
    return this.timer !== null;
  }

  play() {
    if (!this.config()) return;
    this.pause();
    this.timer = setInterval(() => this.step(), BASE_INTERVAL_MS / this.speed);
    this.renderControls(this.config());
  }

  pause() {
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
    const cfg = this.config();
    if (cfg) this.renderControls(cfg);
  }

  setSpeed(speed) {
    this.speed = SPEEDS.includes(speed) ? speed : 1;
    if (this.isPlaying()) this.play();   // 새 간격으로 다시
  }

  /** 범례 제목 아래 부제 — 없으면 만든다 (ChoroplethTool.createLegend 는 부제를 안 만든다) */
  updateLegendSubtitle(cfg) {
    const legend = document.getElementById(`choropleth-legend-${this.layerId}`);
    if (!legend) return;
    let sub = legend.querySelector('.choropleth-legend-subtitle');
    if (!sub) {
      sub = document.createElement('div');
      sub.className = 'choropleth-legend-subtitle';
      const title = legend.querySelector('.choropleth-legend-title');
      if (title) title.insertAdjacentElement('afterend', sub);
      else legend.prepend(sub);
    }
    sub.textContent = subtitleFor(cfg.attribute, cfg.timeSeries.index, cfg.timeSeries.fields.length);
  }

  /** 컨트롤 박스를 #map 에 만든다 (이미 있으면 갈아 끼운다) */
  attachControls(layerId) {
    this.detach();
    const map = document.getElementById('map');
    if (!map) { this.layerId = layerId; return; }
    this.layerId = layerId;

    const box = document.createElement('div');
    box.className = 'time-series-controls';
    box.id = 'time-series-controls';
    box.innerHTML = `
      <button type="button" class="btn-icon ts-play" id="ts-play" title="재생" aria-pressed="false">${ICON_PLAY}</button>
      <input type="range" id="ts-range" min="0" max="0" step="1" value="0" aria-label="연도">
      <span class="time-series-field" id="ts-field"></span>
      <select id="ts-speed" aria-label="재생 속도">
        ${SPEEDS.map((s) => `<option value="${s}"${s === this.speed ? ' selected' : ''}>${s}×</option>`).join('')}
      </select>
      <button type="button" class="btn btn-sm btn-outline" id="ts-save">저장</button>
      <button type="button" class="btn-icon" id="ts-close" title="닫기">${ICON_CLOSE}</button>
    `;
    map.appendChild(box);
    this.controls = box;

    box.querySelector('#ts-play').addEventListener('click', () => (this.isPlaying() ? this.pause() : this.play()));
    box.querySelector('#ts-range').addEventListener('input', (e) => {
      this.pause();
      this.setIndex(parseInt(e.target.value, 10));
    });
    box.querySelector('#ts-speed').addEventListener('change', (e) => this.setSpeed(parseFloat(e.target.value)));
    box.querySelector('#ts-save').addEventListener('click', () => {
      this.pause();
      if (this.onSave) this.onSave(this.layerId);
    });
    box.querySelector('#ts-close').addEventListener('click', () => this.detach());

    const cfg = this.config();
    if (cfg) this.renderControls(cfg);
  }

  renderControls(cfg) {
    if (!this.controls || !cfg) return;
    const { fields, index } = cfg.timeSeries;
    const range = this.controls.querySelector('#ts-range');
    range.max = String(fields.length - 1);
    range.value = String(index);
    this.controls.querySelector('#ts-field').textContent = fields[index];
    const play = this.controls.querySelector('#ts-play');
    const playing = this.isPlaying();
    play.innerHTML = playing ? ICON_PAUSE : ICON_PLAY;
    play.title = playing ? '일시정지' : '재생';
    play.setAttribute('aria-pressed', playing ? 'true' : 'false');
  }

  /** 컨트롤을 없애고 재생을 멈춘다. 레이어(정적 단계구분도)는 그대로 둔다. */
  detach() {
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
    if (this.controls) {
      this.controls.remove();
      this.controls = null;
    }
    this.layerId = null;
  }

  /**
   * 복원 뒤(PROJECT_LOADED·STATE_RESTORED) 또는 실험을 켤 때: timeSeries 가 있는
   * 레이어(위에서부터 첫 번째)를 찾아 컨트롤을 되살린다.
   * @returns {string|null} 되살린 레이어 id
   */
  restoreControls() {
    const layers = layerManager.getAllLayers().slice().reverse();
    const target = layers.find((l) => l._choroplethConfig && l._choroplethConfig.timeSeries);
    if (!target) return null;
    this.attachControls(target.id);
    this.setIndex(target._choroplethConfig.timeSeries.index);
    return target.id;
  }
}

export const timeSeriesTool = new TimeSeriesTool();
```

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run src/tools/TimeSeriesTool.test.js`
Expected: PASS (12 tests).

- [ ] **Step 5: 커밋**

```bash
git add src/tools/TimeSeriesTool.js src/tools/TimeSeriesTool.test.js
git -c user.name=yhk1m -c user.email=83273992+yhk1m@users.noreply.github.com commit -m "feat(time-series): 도구 — 구간 고정 적용·연도 이동·재생·슬라이더 컨트롤·복원"
```

---

### Task 6: 설정 모달 `TimeSeriesPanel.js`

**Files:**
- Create: `src/ui/panels/TimeSeriesPanel.js`
- Test: `src/ui/panels/TimeSeriesPanel.test.js` (jsdom)

- [ ] **Step 1: 실패하는 테스트 작성**

`src/ui/panels/TimeSeriesPanel.test.js`:

```js
// © 2026 김용현
// @vitest-environment jsdom
/**
 * 시계열 설정 창: 폴리곤 + 숫자 필드 2개 이상인 레이어만, 필드 체크 목록은 속성 순서,
 * 「연도 자동 선택」은 19xx/20xx 로 시작하는 필드만 켠다, 적용은 timeSeriesTool.apply 에
 * 체크 순서대로 넘긴다.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import Feature from 'ol/Feature.js';
import Polygon from 'ol/geom/Polygon.js';
import Point from 'ol/geom/Point.js';
import { layerManager } from '../../core/LayerManager.js';
import { timeSeriesTool } from '../../tools/TimeSeriesTool.js';
import { timeSeriesPanel } from './TimeSeriesPanel.js';

function cell(props) {
  return new Feature({ geometry: new Polygon([[[0, 0], [100, 0], [100, 100], [0, 100], [0, 0]]]), ...props });
}

function polygonLayer() {
  return layerManager.addLayer({
    name: '구',
    type: 'vector',
    features: [cell({ name: 'a', '2015': 1, '2020': 2, area: 3, '2025': 4 }), cell({ name: 'b', '2015': 5, '2020': 6, area: 7, '2025': 8 })]
  });
}

beforeEach(() => {
  document.body.innerHTML = '<div id="map"></div>';
  timeSeriesPanel.close();
  timeSeriesTool.detach();
  layerManager.getAllLayers().slice().forEach((l) => layerManager.removeLayer(l.id));
  vi.restoreAllMocks();
});

describe('TimeSeriesPanel.compatibleLayers', () => {
  it('폴리곤이고 숫자 필드가 2개 이상인 레이어만', () => {
    const poly = polygonLayer();
    layerManager.addLayer({ name: '점', type: 'vector', features: [new Feature({ geometry: new Point([0, 0]), '2015': 1, '2020': 2 })] });
    layerManager.addLayer({ name: '한 필드', type: 'vector', features: [cell({ '2015': 1 })] });
    expect(timeSeriesPanel.compatibleLayers().map((l) => l.id)).toEqual([poly]);
  });
});

describe('TimeSeriesPanel UI', () => {
  it('없으면 alert 만, 있으면 창과 필드 체크 목록(속성 순서)', () => {
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
    timeSeriesPanel.show();
    expect(alertSpy).toHaveBeenCalled();
    expect(document.querySelector('.time-series-modal')).toBeNull();

    polygonLayer();
    timeSeriesPanel.show();
    const boxes = Array.from(document.querySelectorAll('.ts-field-check'));
    // JS 객체는 정수 모양 키('2015')를 문자 키보다 앞에, 오름차순으로 둔다 — OL Feature 도 그렇다.
    // 연도 열은 자연히 시간순이 되므로 그대로 둔다.
    expect(boxes.map((b) => b.value)).toEqual(['2015', '2020', '2025', 'area']);
    expect(boxes.every((b) => !b.checked)).toBe(true);
  });

  it('연도 자동 선택은 연도 필드만 켠다', () => {
    polygonLayer();
    timeSeriesPanel.show();
    document.getElementById('ts-auto-years').click();
    const checked = Array.from(document.querySelectorAll('.ts-field-check:checked')).map((b) => b.value);
    expect(checked).toEqual(['2015', '2020', '2025']);
  });

  it('적용은 체크한 필드를 속성 순서로 넘기고 창을 닫는다', () => {
    const id = polygonLayer();
    timeSeriesPanel.show();
    const applySpy = vi.spyOn(timeSeriesTool, 'apply').mockReturnValue('derived');
    document.getElementById('ts-auto-years').click();
    document.getElementById('ts-classes').value = '4';
    document.getElementById('ts-classes').dispatchEvent(new Event('input', { bubbles: true }));
    document.getElementById('ts-method').value = 'quantile';
    document.getElementById('ts-apply').click();
    expect(applySpy).toHaveBeenCalledWith({
      layerId: id, fields: ['2015', '2020', '2025'], method: 'quantile', numClasses: 4,
      colorRamp: 'blues', reverse: false, customColors: null
    });
    expect(document.querySelector('.time-series-modal')).toBeNull();
  });

  it('필드가 2개 미만이면 alert 하고 적용하지 않는다', () => {
    polygonLayer();
    timeSeriesPanel.show();
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
    const applySpy = vi.spyOn(timeSeriesTool, 'apply');
    document.querySelector('.ts-field-check[value="2015"]').click();
    document.getElementById('ts-apply').click();
    expect(alertSpy).toHaveBeenCalled();
    expect(applySpy).not.toHaveBeenCalled();
  });

  it('커스텀 팔레트를 고르면 색 입력이 넘어간다', () => {
    const id = polygonLayer();
    timeSeriesPanel.show();
    const applySpy = vi.spyOn(timeSeriesTool, 'apply').mockReturnValue('derived');
    document.getElementById('ts-auto-years').click();
    const ramp = document.getElementById('ts-ramp');
    ramp.value = 'custom';
    ramp.dispatchEvent(new Event('change', { bubbles: true }));
    expect(document.getElementById('ts-custom-colors').style.display).toBe('block');
    document.getElementById('ts-apply').click();
    const call = applySpy.mock.calls[0][0];
    expect(call.colorRamp).toBe('custom');
    expect(call.customColors).toEqual(['#ffffcc', '#fd8d3c', '#800026']);
    expect(id).toBe(call.layerId);
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run src/ui/panels/TimeSeriesPanel.test.js`
Expected: FAIL — `Failed to resolve import "./TimeSeriesPanel.js"`.

- [ ] **Step 3: 구현**

`src/ui/panels/TimeSeriesPanel.js`:

```js
// © 2026 김용현
/**
 * TimeSeriesPanel - 시계열 단계구분도 설정 창 (실험실 `time-series`)
 *
 * ChoroplethPanel 과 같은 모달 규약(.choropleth-modal / .choropleth-content 스타일 재사용).
 * 레이어(폴리곤·숫자 필드 2개 이상) → 필드 체크 목록(속성 순서) + 연도 자동 선택 →
 * 분류 방법·구간 수·팔레트(기존 램프 + 커스텀) → 적용(timeSeriesTool.apply).
 * 설계: docs/superpowers/specs/2026-09-25-labs-design.md 「4단계」
 */
import { choroplethTool } from '../../tools/ChoroplethTool.js';
import { timeSeriesTool } from '../../tools/TimeSeriesTool.js';
import { detectYearFields, MAX_TIME_SERIES_FIELDS } from '../../tools/timeSeriesModel.js';
import { layerManager } from '../../core/LayerManager.js';
import { buildLayerOptions, resolveInitialLayerId, isVectorLayer } from '../../utils/layerSelect.js';
import { escapeHtml } from '../../utils/escapeHtml.js';

const DEFAULT_CUSTOM = ['#ffffcc', '#fd8d3c', '#800026'];

function isPolygonLayer(layer) {
  return /Polygon$/.test(String(layer.geometryType || ''));
}

class TimeSeriesPanel {
  constructor() {
    this.modal = null;
    this.currentLayerId = null;
  }

  /** 폴리곤이고 숫자 필드가 2개 이상인 벡터 레이어 */
  compatibleLayers() {
    return layerManager.getAllLayers().filter(
      (l) => isVectorLayer(l) && isPolygonLayer(l) && choroplethTool.getNumericAttributes(l.id).length >= 2
    );
  }

  show(layerId = null) {
    const layers = this.compatibleLayers();
    if (layers.length === 0) {
      alert('시계열 단계구분도를 적용할 수 있는 레이어가 없습니다.\n(숫자형 속성이 2개 이상인 면 레이어가 필요합니다)');
      return;
    }
    this.currentLayerId = resolveInitialLayerId(layers, layerId || layerManager.getSelectedLayerId()) || layers[0].id;
    this.render(layers);
  }

  render(layers) {
    this.close();
    const rampOptions = choroplethTool.getColorRamps().map((r) => `<option value="${r}">${r}</option>`).join('');
    const methodOptions = Object.entries(choroplethTool.getClassificationMethods())
      .map(([k, v]) => `<option value="${k}">${v}</option>`).join('');

    this.modal = document.createElement('div');
    this.modal.className = 'choropleth-modal time-series-modal';
    this.modal.innerHTML = `
      <div class="choropleth-content time-series-content">
        <div class="choropleth-header">
          <h3>시계열 단계구분도</h3>
          <button class="choropleth-close" id="ts-close-panel" aria-label="닫기">&times;</button>
        </div>
        <div class="choropleth-body">
          <p class="time-series-intro">연도별 열을 골라 구간을 한 번만 계산해 고정합니다. 적용 뒤 지도 아래 슬라이더로 연도를 넘깁니다.</p>
          <div class="choropleth-form-group">
            <label for="ts-layer">레이어</label>
            <select id="ts-layer">${buildLayerOptions(layers, { selectedId: this.currentLayerId })}</select>
          </div>
          <div class="choropleth-form-group">
            <div class="time-series-fields-head">
              <label>필드 (순서 = 속성 순서, 최대 ${MAX_TIME_SERIES_FIELDS}개)</label>
              <button type="button" class="btn btn-sm btn-outline" id="ts-auto-years">연도 자동 선택</button>
            </div>
            <div class="time-series-fields" id="ts-fields"></div>
          </div>
          <div class="choropleth-form-group">
            <label for="ts-method">분류 방법</label>
            <select id="ts-method">${methodOptions}</select>
          </div>
          <div class="choropleth-form-group">
            <label for="ts-classes">분류 수</label>
            <input type="range" id="ts-classes" min="3" max="8" value="5">
            <span id="ts-classes-value">5</span>
          </div>
          <div class="choropleth-form-group">
            <label for="ts-ramp">색상 팔레트</label>
            <select id="ts-ramp">${rampOptions}<option value="custom">커스텀</option></select>
            <div class="color-ramp-preview-container">
              <div id="ts-ramp-preview" class="color-ramp-preview"></div>
              <div class="color-ramp-preview-labels"><span>낮음</span><span>높음</span></div>
            </div>
          </div>
          <div class="choropleth-form-group choropleth-reverse-group">
            <label class="checkbox-label"><input type="checkbox" id="ts-reverse"><span>색상 반전 (높은 값 → 낮은 색상)</span></label>
          </div>
          <div class="choropleth-form-group custom-colors-group" id="ts-custom-colors" style="display:none;">
            <label>커스텀 색상 (시작 → 끝)</label>
            <div class="custom-color-inputs" id="ts-custom-inputs">
              ${DEFAULT_CUSTOM.map((c) => `<input type="color" class="custom-color-input" value="${c}">`).join('')}
            </div>
            <div class="custom-color-actions">
              <button type="button" class="btn btn-sm" id="ts-add-color">+ 색상 추가</button>
              <button type="button" class="btn btn-sm" id="ts-remove-color">- 색상 제거</button>
            </div>
          </div>
        </div>
        <div class="choropleth-footer">
          <button class="btn btn-primary" id="ts-apply">적용</button>
        </div>
      </div>
    `;
    document.body.appendChild(this.modal);
    this.bindEvents();
    this.renderFields();
    this.updatePreview();
  }

  bindEvents() {
    const q = (sel) => this.modal.querySelector(sel);
    q('#ts-close-panel').addEventListener('click', () => this.close());
    q('#ts-layer').addEventListener('change', (e) => {
      this.currentLayerId = e.target.value || null;
      this.renderFields();
    });
    q('#ts-auto-years').addEventListener('click', () => this.autoSelectYears());
    q('#ts-classes').addEventListener('input', (e) => {
      q('#ts-classes-value').textContent = e.target.value;
      this.updatePreview();
    });
    q('#ts-ramp').addEventListener('change', () => {
      q('#ts-custom-colors').style.display = q('#ts-ramp').value === 'custom' ? 'block' : 'none';
      this.updatePreview();
    });
    q('#ts-reverse').addEventListener('change', () => this.updatePreview());
    q('#ts-add-color').addEventListener('click', () => this.addCustomColor());
    q('#ts-remove-color').addEventListener('click', () => this.removeCustomColor());
    this.modal.querySelectorAll('#ts-custom-inputs .custom-color-input').forEach((input) => {
      input.addEventListener('input', () => this.updatePreview());
    });
    q('#ts-apply').addEventListener('click', () => this.apply());
    this._escHandler = (e) => { if (e.key === 'Escape') this.close(); };
    document.addEventListener('keydown', this._escHandler);
  }

  renderFields() {
    const box = this.modal.querySelector('#ts-fields');
    const fields = this.currentLayerId ? choroplethTool.getNumericAttributes(this.currentLayerId) : [];
    box.innerHTML = fields.map((f) => `
      <label class="time-series-field-row">
        <input type="checkbox" class="ts-field-check" value="${escapeHtml(f)}">
        <span>${escapeHtml(f)}</span>
      </label>`).join('');
  }

  autoSelectYears() {
    const years = new Set(detectYearFields(this.checkedOrder().all));
    this.modal.querySelectorAll('.ts-field-check').forEach((b) => { b.checked = years.has(b.value); });
  }

  /** 체크 목록을 속성 순서로 — all: 전부, checked: 체크된 것 */
  checkedOrder() {
    const boxes = Array.from(this.modal.querySelectorAll('.ts-field-check'));
    return { all: boxes.map((b) => b.value), checked: boxes.filter((b) => b.checked).map((b) => b.value) };
  }

  customColors() {
    return Array.from(this.modal.querySelectorAll('#ts-custom-inputs .custom-color-input')).map((i) => i.value);
  }

  addCustomColor() {
    const container = this.modal.querySelector('#ts-custom-inputs');
    if (container.querySelectorAll('.custom-color-input').length >= 8) return;
    const input = document.createElement('input');
    input.type = 'color';
    input.className = 'custom-color-input';
    input.value = '#ff0000';
    input.addEventListener('input', () => this.updatePreview());
    container.appendChild(input);
    this.updatePreview();
  }

  removeCustomColor() {
    const container = this.modal.querySelector('#ts-custom-inputs');
    const inputs = container.querySelectorAll('.custom-color-input');
    if (inputs.length <= 2) return;
    container.removeChild(inputs[inputs.length - 1]);
    this.updatePreview();
  }

  updatePreview() {
    const ramp = this.modal.querySelector('#ts-ramp').value;
    const reverse = this.modal.querySelector('#ts-reverse').checked;
    const n = parseInt(this.modal.querySelector('#ts-classes').value, 10) || 5;
    let colors;
    if (ramp === 'custom') {
      const custom = this.customColors();
      colors = custom.length >= 2 ? choroplethTool.interpolateColors(custom, n) : custom;
    } else {
      colors = choroplethTool.sampleColorRamp(choroplethTool.getColorRampColors(ramp), n);
    }
    const shown = reverse ? [...colors].reverse() : colors;
    this.modal.querySelector('#ts-ramp-preview').innerHTML = shown.map((c) => `<div class="color-ramp-item" style="background:${c}"></div>`).join('');
  }

  apply() {
    if (!this.currentLayerId) { alert('먼저 레이어를 선택해주세요.'); return; }
    const { checked } = this.checkedOrder();
    if (checked.length < 2) { alert('필드를 2개 이상 선택해주세요.'); return; }
    if (checked.length > MAX_TIME_SERIES_FIELDS) { alert(`필드는 ${MAX_TIME_SERIES_FIELDS}개까지만 고를 수 있습니다.`); return; }

    const ramp = this.modal.querySelector('#ts-ramp').value;
    const derivedId = timeSeriesTool.apply({
      layerId: this.currentLayerId,
      fields: checked,
      method: this.modal.querySelector('#ts-method').value,
      numClasses: parseInt(this.modal.querySelector('#ts-classes').value, 10) || 5,
      colorRamp: ramp,
      reverse: this.modal.querySelector('#ts-reverse').checked,
      customColors: ramp === 'custom' ? this.customColors() : null
    });
    if (!derivedId) { alert('시계열 단계구분도 적용에 실패했습니다. 선택한 필드에 숫자 값이 없습니다.'); return; }
    this.close();
  }

  close() {
    if (this._escHandler) {
      document.removeEventListener('keydown', this._escHandler);
      this._escHandler = null;
    }
    if (this.modal) {
      this.modal.remove();
      this.modal = null;
    }
  }
}

export const timeSeriesPanel = new TimeSeriesPanel();
```

`src/utils/layerSelect.js` 에 `isVectorLayer`·`buildLayerOptions`·`resolveInitialLayerId` 가 export 돼 있다(ChoroplethTool·ChoroplethPanel 이 쓴다). `layerManager.getSelectedLayerId` 는 ChoroplethPanel 이 쓰는 그대로.

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run src/ui/panels/TimeSeriesPanel.test.js`
Expected: PASS (6 tests).

- [ ] **Step 5: 커밋**

```bash
git add src/ui/panels/TimeSeriesPanel.js src/ui/panels/TimeSeriesPanel.test.js
git -c user.name=yhk1m -c user.email=83273992+yhk1m@users.noreply.github.com commit -m "feat(time-series): 설정 창 — 필드 체크 목록·연도 자동 선택·분류·팔레트"
```

---

### Task 7: `main.js` 배선 + 컨트롤 CSS

**Files:**
- Modify: `src/main.js` — import 묶음(69행 `View3DPanel` 뒤), `labs.init` 뒤(0단계가 넣은 `bindLabsButton` 다음), `handleMenuAction` 의 `case 'analysis-choropleth'` 뒤(803행), `__egisDebug`(1347행)
- Modify: `src/styles/main.css` — `.view3d-num-wrap input { … }` 블록 뒤(5335행 부근)
- Modify: `src/styles/glass.css` — 지도 위 부유 요소 목록

- [ ] **Step 1: import**

`import { View3DPanel } from './ui/panels/View3DPanel.js';` 아래에:

```js
import { timeSeriesPanel } from './ui/panels/TimeSeriesPanel.js';
import { timeSeriesTool } from './tools/TimeSeriesTool.js';
import { bindLabMenuItems } from './labs/labMenu.js';
```

(`labs` 와 `eventBus, Events` 는 이미 import 돼 있다 — 0단계와 기존 코드.)

- [ ] **Step 2: 실험 배선**

0단계가 넣은 `bindLabsButton(labs, document.getElementById('labs-toggle'));` 바로 뒤에:

```js
  // 실험 메뉴 항목(data-lab) 숨김/표시 — 켜고 끄면 바로 반영
  bindLabMenuItems(labs);

  // 시계열: 실험을 켜면 이미 있는 시계열 레이어의 컨트롤을 되살리고, 끄면 컨트롤만 걷는다
  // (레이어는 저장된 연도의 정적 단계구분도로 남는다)
  labs.onChange((id, on) => {
    if (id !== 'time-series') return;
    if (on) timeSeriesTool.restoreControls();
    else timeSeriesTool.detach();
  });
  // 복원 뒤(프로젝트 열기·자동 복원 완료) 컨트롤 되살리기
  const restoreTimeSeries = () => { if (labs.isOn('time-series')) timeSeriesTool.restoreControls(); };
  eventBus.on(Events.PROJECT_LOADED, restoreTimeSeries);
  eventBus.on(Events.STATE_RESTORED, restoreTimeSeries);
  eventBus.on(Events.PROJECT_NEW, () => timeSeriesTool.detach());
```

주의: `autoSaveManager.init()` 은 `mapManager.init` 뒤에 불리는데 위 코드는 `layout.render()` 직후(그보다 앞)에 놓이므로 `STATE_RESTORED` 를 놓치지 않는다.

- [ ] **Step 3: 메뉴 액션**

`handleMenuAction` 의

```js
    case 'analysis-choropleth':
      choroplethPanel.show();
      break;
```
바로 뒤에:

```js
    case 'analysis-time-series':
      if (!labs.isOn('time-series')) break;   // 메뉴가 숨겨져 있어도 단축 경로로 올 수 있다
      timeSeriesPanel.show();
      break;
```

- [ ] **Step 4: 디버그 노출**

`window.__egisDebug = { …, labs, … }` 에 `timeSeriesTool` 을 더한다:

> 다른 단계가 먼저 병합돼 `__egisDebug` 에 항목이 더 있으면 그 항목은 그대로 두고 **여기 것만 더한다**(아래 줄은 0단계 직후 모습이다). 이미 같은 이름이 있으면 중복해서 넣지 않는다.

```js
window.__egisDebug = { projectManager, layerManager, exportPanel, isochroneTool, roadNetwork, measureTool, selectTool, historyManager, mapManager, labs, timeSeriesTool, get view3dPanel() { return view3dPanel; } };
```

(0단계·2단계가 더한 항목이 있으면 그대로 두고 `timeSeriesTool` 만 끼운다.)

- [ ] **Step 5: 컨트롤 CSS**

`src/styles/main.css` 의 `.view3d-num-wrap input { … }` 블록 뒤에:

```css
/* ===== 시계열 단계구분도 (실험실 time-series) ===== */
/* 지도 아래 가운데 슬라이더 박스 */
.time-series-controls {
  position: absolute;
  left: 50%;
  bottom: 44px;
  transform: translateX(-50%);
  z-index: 110;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  background: var(--map-overlay-bg);
  box-shadow: var(--shadow-md);
  font-size: var(--font-size-sm);
  color: var(--text-primary);
  max-width: calc(100% - 32px);
}

.time-series-controls input[type="range"] {
  width: 220px;
  min-width: 120px;
}

.time-series-field {
  min-width: 64px;
  font-weight: 600;
  text-align: center;
  font-variant-numeric: tabular-nums;
}

.time-series-controls select {
  font-size: var(--font-size-xs);
  padding: 2px 4px;
}

.time-series-controls .btn-outline {
  background: transparent;
  border: 1px solid var(--color-primary);
  color: var(--color-primary);
}

.time-series-controls .btn-icon[aria-pressed="true"] {
  color: var(--color-primary);
}

/* 내보내기·3D 캡처에 찍히지 않게 */
body.exporting .time-series-controls {
  display: none;
}

/* 설정 창 — ChoroplethPanel 규약 위에 필드 목록만 더한다 */
.time-series-content {
  width: 400px;
}

.time-series-intro {
  font-size: var(--font-size-sm);
  color: var(--text-secondary);
  margin: 0 0 var(--spacing-md);
  line-height: 1.5;
}

.time-series-fields-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--spacing-sm);
  margin-bottom: 4px;
}

.time-series-fields-head .btn-outline {
  background: transparent;
  border: 1px solid var(--color-primary);
  color: var(--color-primary);
}

.time-series-fields {
  max-height: 180px;
  overflow-y: auto;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  padding: 4px 8px;
  background: var(--bg-input);
}

.time-series-field-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 3px 0;
  font-size: var(--font-size-sm);
  cursor: pointer;
}

.time-series-field-row input {
  margin: 0;
}

@media (max-width: 768px) {
  .time-series-controls input[type="range"] {
    width: 120px;
  }
}
```

- [ ] **Step 6: 글래스 목록**

`src/styles/glass.css` 에서 지도 위 부유 요소 선택자 묶음이 나오는 **세 곳**(기본·`pointer: coarse`·`prefers-reduced-transparency`) 각각의 `[data-surface="glass"] .view3d-panel` 줄 뒤에 `,` 로 이어 한 줄을 더한다:

```css
[data-surface="glass"] .time-series-controls
```

(콤마 위치: 앞 줄 끝에 `,` 를 붙이고 새 줄을 넣는다. 세 묶음 모두.)

- [ ] **Step 7: 전체 테스트·빌드**

Run: `npm test`
Expected: 모두 PASS.

Run: `rm -rf dist && npm run build`
Expected: 성공.

- [ ] **Step 8: 커밋**

```bash
git add src/main.js src/styles/main.css src/styles/glass.css
git -c user.name=yhk1m -c user.email=83273992+yhk1m@users.noreply.github.com commit -m "feat(time-series): main.js 배선(메뉴·복원·실험 토글)과 슬라이더 컨트롤 스타일"
```

---

### Task 8: `gifenc` 설치 + `saveBlobAs` + `animationExport.js` 순수 부분

**Files:**
- Modify: `package.json`, `package-lock.json`
- Modify: `src/utils/saveFile.js:30` 뒤
- Create: `src/tools/animationExport.js` (순수 함수 먼저; 캔버스 함수는 Task 9)
- Test: `src/tools/animationExport.test.js`

- [ ] **Step 1: 설치**

```bash
npm i gifenc
grep -n gifenc package.json
```
Expected: `"gifenc": "^1.0.3"` 같은 줄이 `dependencies` 에 있다.

- [ ] **Step 2: 실패하는 테스트 작성**

`src/tools/animationExport.test.js`:

```js
// © 2026 김용현
/**
 * 애니메이션 저장의 순수 규칙 — 브라우저 API(MediaRecorder·canvas)는 주입받거나 안 쓴다.
 * - mime 우선순위: mp4(avc1) → webm(vp9) → webm. 지원 판정 함수를 주입.
 * - 파일 확장자는 실제 mime 을 따른다(PowerPoint 는 WebM 을 못 넣으므로 사용자가 알아야 한다).
 * - 연도 라벨은 왼쪽 위, 크기는 짧은 변에 비례하되 배율에 따라 커진다.
 */
import { describe, it, expect } from 'vitest';
import {
  pickMimeType, extensionFor, labelLayout, animationFilename, frameDelayMs, MIME_CANDIDATES
} from './animationExport.js';

describe('pickMimeType', () => {
  it('mp4 avc1 → webm vp9 → webm 순으로 처음 지원되는 것', () => {
    expect(pickMimeType((m) => m === 'video/webm')).toBe('video/webm');
    expect(pickMimeType((m) => m.startsWith('video/webm'))).toBe('video/webm;codecs=vp9');
    expect(pickMimeType(() => true)).toBe('video/mp4;codecs=avc1');
    expect(MIME_CANDIDATES[0]).toBe('video/mp4;codecs=avc1');
  });
  it('아무것도 지원 안 하거나 판정이 던지면 null', () => {
    expect(pickMimeType(() => false)).toBeNull();
    expect(pickMimeType(() => { throw new Error('x'); })).toBeNull();
    expect(pickMimeType(null)).toBeNull();
  });
});

describe('extensionFor', () => {
  it('mime → 확장자', () => {
    expect(extensionFor('video/mp4;codecs=avc1')).toBe('mp4');
    expect(extensionFor('video/webm;codecs=vp9')).toBe('webm');
    expect(extensionFor('video/webm')).toBe('webm');
    expect(extensionFor(null)).toBe('gif');
  });
});

describe('labelLayout', () => {
  it('왼쪽 위, 짧은 변의 6%(최소 18·최대 64)에 배율을 곱한다', () => {
    const a = labelLayout(1000, 600, 1);
    expect(a.x).toBe(16);
    expect(a.y).toBe(16);
    expect(a.fontSize).toBe(36);
    expect(a.font).toBe('bold 36px "Malgun Gothic", sans-serif');
    expect(labelLayout(200, 100, 1).fontSize).toBe(18);
    expect(labelLayout(4000, 3000, 1).fontSize).toBe(64);
    const b = labelLayout(2000, 1200, 2);
    expect(b.fontSize).toBe(72);
    expect(b.x).toBe(32);
    expect(b.padX).toBe(20);
  });
});

describe('animationFilename', () => {
  it('레이어이름_시계열.확장자, 파일 이름에 못 쓰는 글자는 _', () => {
    expect(animationFilename('서울 자치구_시계열_2015~2025', 'gif')).toBe('서울 자치구_시계열_2015~2025_시계열.gif');
    expect(animationFilename('a/b:c', 'mp4')).toBe('a_b_c_시계열.mp4');
    expect(animationFilename('', 'webm')).toBe('지도_시계열.webm');
  });
});

describe('frameDelayMs', () => {
  it('초 → ms, 최소 100', () => {
    expect(frameDelayMs(1.2)).toBe(1200);
    expect(frameDelayMs(0.01)).toBe(100);
    expect(frameDelayMs('abc')).toBe(1200);
  });
});
```

- [ ] **Step 3: 실패 확인**

Run: `npx vitest run src/tools/animationExport.test.js`
Expected: FAIL — `Failed to resolve import "./animationExport.js"`.

- [ ] **Step 4: 구현 (순수 부분)**

`src/tools/animationExport.js`:

```js
// © 2026 김용현
/**
 * 시계열 애니메이션 저장 — GIF(gifenc) · 동영상(MediaRecorder).
 *
 * 이 파일은 순수 규칙만 — 브라우저 API 없이 노드에서 테스트한다.
 * 캔버스·MediaRecorder 를 쓰는 captureFrames·encodeGif·recordVideo 는 animationExportCanvas.js.
 * 설계: docs/superpowers/specs/2026-09-25-labs-design.md 「애니메이션 저장」
 */

/** MediaRecorder mime 우선순위 — mp4 가 되면 PowerPoint 에 바로 넣을 수 있다 */
export const MIME_CANDIDATES = ['video/mp4;codecs=avc1', 'video/webm;codecs=vp9', 'video/webm'];

/**
 * @param {(mime: string) => boolean} isTypeSupported 보통 MediaRecorder.isTypeSupported
 * @returns {string|null} 처음 지원되는 mime, 없으면 null(동영상 선택지를 숨긴다)
 */
export function pickMimeType(isTypeSupported) {
  if (typeof isTypeSupported !== 'function') return null;
  for (const mime of MIME_CANDIDATES) {
    try {
      if (isTypeSupported(mime)) return mime;
    } catch {
      // 판정이 던지는 브라우저도 있다 — 다음 후보로
    }
  }
  return null;
}

/** 저장 버튼에 보여 줄 실제 확장자 */
export function extensionFor(mime) {
  if (!mime) return 'gif';
  return mime.startsWith('video/mp4') ? 'mp4' : 'webm';
}

/**
 * 연도 라벨 배치 — 왼쪽 위, 큰 글자.
 * @param {number} width 프레임 픽셀 너비(이미 배율이 곱해진 값)
 * @param {number} height
 * @param {number} scale 배율(1·2). 여백·글자 최소·최대에 곱한다
 */
export function labelLayout(width, height, scale = 1) {
  const fontSize = Math.round(Math.max(18 * scale, Math.min(64 * scale, Math.min(width, height) * 0.06)));
  return {
    x: 16 * scale,
    y: 16 * scale,
    padX: 10 * scale,
    padY: 6 * scale,
    fontSize,
    font: `bold ${fontSize}px "Malgun Gothic", sans-serif`,
    color: '#111111',
    background: 'rgba(255, 255, 255, 0.85)'
  };
}

/** 파일 이름: 레이어이름_시계열.확장자 (파일 이름에 못 쓰는 글자는 _) */
export function animationFilename(layerName, ext) {
  const base = String(layerName || '').replace(/[\\/:*?"<>|]/g, '_').trim() || '지도';
  return `${base}_시계열.${ext}`;
}

/** 프레임 유지 시간(초) → ms. 이상한 값은 1.2초, 최소 100ms */
export function frameDelayMs(seconds) {
  const s = Number(seconds);
  if (!Number.isFinite(s) || s <= 0) return 1200;
  return Math.max(100, Math.round(s * 1000));
}
```

- [ ] **Step 5: `saveBlobAs`**

`src/utils/saveFile.js` 끝에:

```js

/**
 * saveBlobAs - 이진 파일 저장 (GIF·동영상)
 *
 * 데스크톱 브릿지는 텍스트만 받으므로(saveTextFile) 여기서는 브라우저 다운로드만 쓴다.
 * 데스크톱 앱의 e-GIS 탭에서는 blob 다운로드가 조용히 실패할 수 있다 — 시계열 저장은
 * 웹(브라우저)에서 하라고 설명서에 적는다.
 * @returns {Promise<boolean>} 항상 true (브라우저는 취소를 알려주지 않는다)
 */
export async function saveBlobAs(filename, blob) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  // 다운로드가 시작되기 전에 해제하면 일부 브라우저가 빈 파일을 만든다
  setTimeout(() => URL.revokeObjectURL(url), 10000);
  return true;
}
```

- [ ] **Step 6: 통과 확인**

Run: `npx vitest run src/tools/animationExport.test.js`
Expected: PASS (6 tests).

- [ ] **Step 7: 커밋**

```bash
git add package.json package-lock.json src/utils/saveFile.js src/tools/animationExport.js src/tools/animationExport.test.js
git -c user.name=yhk1m -c user.email=83273992+yhk1m@users.noreply.github.com commit -m "feat(time-series): gifenc 추가, saveBlobAs, 애니메이션 저장 순수 규칙(mime·라벨·파일명)"
```

---

### Task 9: 프레임 캡처·GIF·동영상 + 저장 대화상자

**Files:**
- Create: `src/tools/animationExportCanvas.js` (브라우저 전용 — 순수 모듈과 분리해 노드 테스트가 OpenLayers 를 끌고 오지 않게)
- Create: `src/ui/panels/AnimationExportDialog.js`
- Test: `src/ui/panels/AnimationExportDialog.test.js` (jsdom)
- Modify: `src/main.js` (저장 훅), `src/styles/main.css` (대화상자)

- [ ] **Step 1: 실패하는 테스트 작성**

`src/ui/panels/AnimationExportDialog.test.js`:

```js
// © 2026 김용현
// @vitest-environment jsdom
/**
 * 저장 대화상자: MediaRecorder 가 없으면 동영상 선택지를 숨긴다, 만들기 버튼에 실제
 * 확장자를 적는다, 만들기는 capture → encode → save 순으로 주입된 함수를 부르고 진행률을
 * 보이며, 취소는 AbortController 를 중단시키고 파일을 만들지 않는다.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AnimationExportDialog } from './AnimationExportDialog.js';

function deps(overrides = {}) {
  return {
    layerName: '구_시계열_2015~2025',
    fields: ['2015', '2020', '2025'],
    speed: 1,
    isTypeSupported: () => false,
    hasMediaRecorder: false,
    beforeCapture: vi.fn(async () => {}),
    captureFrames: vi.fn(async ({ onProgress }) => { onProgress(1, 3); onProgress(2, 3); onProgress(3, 3); return ['f1', 'f2', 'f3']; }),
    encodeGif: vi.fn(async () => new Blob(['gif'], { type: 'image/gif' })),
    recordVideo: vi.fn(async () => new Blob(['vid'], { type: 'video/webm' })),
    saveBlobAs: vi.fn(async () => true),
    onMessage: vi.fn(),
    ...overrides
  };
}

beforeEach(() => { document.body.innerHTML = ''; });

describe('AnimationExportDialog', () => {
  it('MediaRecorder 가 없으면 GIF 만, 버튼 글자는 GIF 만들기', () => {
    const d = new AnimationExportDialog(deps());
    d.show();
    expect(document.querySelector('.anim-export-modal')).toBeTruthy();
    expect(document.querySelector('#anim-format-video')).toBeNull();
    expect(document.querySelector('#anim-run').textContent).toBe('GIF 만들기');
    expect(document.querySelector('#anim-hold').value).toBe('1.2');
    d.close();
  });

  it('MediaRecorder 가 있고 mp4 를 지원하면 동영상 선택지와 MP4 글자', () => {
    const d = new AnimationExportDialog(deps({ hasMediaRecorder: true, isTypeSupported: () => true, speed: 2 }));
    d.show();
    expect(document.querySelector('#anim-hold').value).toBe('0.6');
    document.querySelector('#anim-format-video').click();
    expect(document.querySelector('#anim-run').textContent).toBe('MP4 만들기');
    document.querySelector('#anim-format-gif').click();
    expect(document.querySelector('#anim-run').textContent).toBe('GIF 만들기');
    d.close();
  });

  it('만들기: beforeCapture → captureFrames → encodeGif → saveBlobAs, 진행률 표시', async () => {
    const p = deps();
    const d = new AnimationExportDialog(p);
    d.show();
    document.querySelector('#anim-scale').value = '2';
    document.querySelector('#anim-label').checked = false;
    await d.run();
    expect(p.beforeCapture).toHaveBeenCalled();
    expect(p.captureFrames).toHaveBeenCalledWith(expect.objectContaining({ scale: 2, includeLabel: false, includeLegend: true }));
    expect(p.encodeGif).toHaveBeenCalledWith(['f1', 'f2', 'f3'], 1200, expect.anything());
    expect(p.saveBlobAs).toHaveBeenCalledWith('구_시계열_2015~2025_시계열.gif', expect.any(Blob));
    expect(document.querySelector('.anim-export-modal')).toBeNull();   // 끝나면 닫힌다
  });

  it('동영상은 recordVideo 와 실제 확장자', async () => {
    const p = deps({ hasMediaRecorder: true, isTypeSupported: (m) => m === 'video/webm' });
    const d = new AnimationExportDialog(p);
    d.show();
    document.querySelector('#anim-format-video').click();
    expect(document.querySelector('#anim-run').textContent).toBe('WEBM 만들기');
    await d.run();
    expect(p.recordVideo).toHaveBeenCalledWith(['f1', 'f2', 'f3'], 1200, 'video/webm', expect.anything());
    expect(p.saveBlobAs).toHaveBeenCalledWith('구_시계열_2015~2025_시계열.webm', expect.any(Blob));
  });

  it('취소하면 signal 이 중단되고 저장하지 않는다', async () => {
    let seenSignal = null;
    const p = deps({
      captureFrames: vi.fn(async ({ signal, onProgress }) => {
        seenSignal = signal;
        onProgress(1, 3);
        document.querySelector('#anim-cancel').click();
        if (signal.aborted) throw new DOMException('취소', 'AbortError');
        return [];
      })
    });
    const d = new AnimationExportDialog(p);
    d.show();
    await d.run();
    expect(seenSignal.aborted).toBe(true);
    expect(p.encodeGif).not.toHaveBeenCalled();
    expect(p.saveBlobAs).not.toHaveBeenCalled();
    expect(document.querySelector('.anim-export-modal')).toBeNull();
  });

  it('실패하면 상태줄 메시지를 내고 닫는다', async () => {
    const p = deps({ captureFrames: vi.fn(async () => { throw new Error('외부 이미지 때문에 캔버스를 읽을 수 없습니다'); }) });
    const d = new AnimationExportDialog(p);
    d.show();
    await d.run();
    expect(p.onMessage).toHaveBeenCalledWith('애니메이션 저장 실패: 외부 이미지 때문에 캔버스를 읽을 수 없습니다');
    expect(p.saveBlobAs).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run src/ui/panels/AnimationExportDialog.test.js`
Expected: FAIL — `Failed to resolve import "./AnimationExportDialog.js"`.

- [ ] **Step 3: 캔버스 부분 — `src/tools/animationExportCanvas.js`**

```js
// © 2026 김용현
/**
 * 시계열 애니메이션 저장 — 브라우저 부분 (프레임 캡처 · GIF · 동영상).
 *
 * 순수 규칙(mime·라벨 배치·파일명)은 animationExport.js 에 있다. 이 파일은 OpenLayers·
 * 캔버스·MediaRecorder 를 쓰므로 노드 테스트가 없고, 대화상자(jsdom)는 주입으로 이 함수들을
 * 흉내 낸다. 실제 동작은 Electron 하네스(GIF)와 배포 뒤 크롬(MP4)에서 본다.
 *
 * 프레임은 html2canvas 가 아니라 3D 가 쓰는 composeMapCanvas(OL 레이어 캔버스 합성)로 뽑는다.
 * 배경 타일은 익명 CORS 라 캔버스가 오염되지 않는다. 오염됐으면(외부 이미지 오버레이 등)
 * getImageData 가 던지므로 그때 사용자에게 이유를 적고 멈춘다.
 * 설계: docs/superpowers/specs/2026-09-25-labs-design.md 「애니메이션 저장」
 */
import { mapManager } from '../core/MapManager.js';
import { layerManager } from '../core/LayerManager.js';
import { composeMapCanvas } from '../view3d/mapTexture.js';
import { exportTool } from './ExportTool.js';
import { buildLegendModel } from './legendModel.js';
import { labelLayout } from './animationExport.js';

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function abortError() {
  return new DOMException('취소', 'AbortError');
}

/** 지도 한 프레임이 다 그려질 때까지 (타일이 안 오면 3초 뒤 그냥 간다) */
function waitRender(map) {
  return new Promise((resolve) => {
    let done = false;
    const finish = () => { if (!done) { done = true; resolve(); } };
    map.once('rendercomplete', finish);
    map.render();
    setTimeout(finish, 3000);
  });
}

/** 오염된 캔버스면 getImageData 가 던진다 — 미리 확인해 이유를 사용자 말로 바꾼다 */
function assertReadable(canvas) {
  try {
    canvas.getContext('2d').getImageData(0, 0, 1, 1);
  } catch {
    throw new Error('외부 이미지 때문에 캔버스를 읽을 수 없습니다');
  }
}

function drawLabel(ctx, text, width, height, scale) {
  const L = labelLayout(width, height, scale);
  ctx.save();
  ctx.font = L.font;
  ctx.textBaseline = 'top';
  ctx.textAlign = 'left';
  const w = ctx.measureText(text).width;
  ctx.fillStyle = L.background;
  ctx.fillRect(L.x, L.y, w + L.padX * 2, L.fontSize + L.padY * 2);
  ctx.fillStyle = L.color;
  ctx.fillText(text, L.x + L.padX, L.y + L.padY);
  ctx.restore();
}

/**
 * 연도마다 지도 캔버스를 뽑는다. 끝나면 슬라이더를 원래 자리로 돌린다.
 *
 * @param {{tool: {config: Function, setIndex: Function}, layerId: string, scale: number,
 *          includeLegend: boolean, includeLabel: boolean,
 *          onProgress?: (done: number, total: number) => void, signal?: AbortSignal}} options
 * @returns {Promise<HTMLCanvasElement[]>}
 */
export async function captureFrames({ tool, layerId, scale = 1, includeLegend = true, includeLabel = true, onProgress, signal }) {
  const map = mapManager.getMap();
  const mapEl = document.getElementById('map');
  const layerInfo = layerManager.getLayer(layerId);
  const cfg = tool.config(layerId);
  if (!map || !mapEl || !layerInfo || !cfg) throw new Error('시계열 레이어가 없습니다');

  const { fields } = cfg.timeSeries;
  const startIndex = cfg.timeSeries.index;
  // OL 이 그린 해상도(기기 픽셀비)에 배율을 곱한다 — composeMapCanvas 는 뷰포트×pixelRatio 로 뽑는다
  const k = (window.devicePixelRatio || 1) * scale;
  const frames = [];

  try {
    for (let i = 0; i < fields.length; i++) {
      if (signal && signal.aborted) throw abortError();
      tool.setIndex(i);
      await waitRender(map);

      const canvas = composeMapCanvas(mapEl, { size: map.getSize(), pixelRatio: k, maxSize: 4096 });
      if (!canvas) throw new Error('지도 캔버스를 합칠 수 없습니다');
      assertReadable(canvas);

      const ctx = canvas.getContext('2d');
      if (includeLegend) {
        const model = buildLegendModel(layerInfo);
        if (model) {
          exportTool.drawLegend(ctx, { models: [model], showHeader: false, x: 0.02, y: 0.6 }, canvas.width, canvas.height, k);
        }
      }
      if (includeLabel) drawLabel(ctx, fields[i], canvas.width, canvas.height, k);

      frames.push(canvas);
      if (onProgress) onProgress(i + 1, fields.length);
    }
  } finally {
    tool.setIndex(startIndex);
  }
  return frames;
}

/**
 * GIF — gifenc 로 오프라인 인코딩. 유지 시간 = 프레임 지연, 무한 반복.
 * gifenc 는 이때 처음 내려받는다(동적 import) — 저장 안 하는 사용자 비용 0.
 */
export async function encodeGif(frames, delayMs, signal) {
  const { GIFEncoder, quantize, applyPalette } = await import('gifenc');
  const gif = GIFEncoder();
  for (const canvas of frames) {
    if (signal && signal.aborted) throw abortError();
    const { width, height } = canvas;
    const rgba = canvas.getContext('2d').getImageData(0, 0, width, height).data;
    const palette = quantize(rgba, 256);
    const index = applyPalette(rgba, palette);
    gif.writeFrame(index, width, height, { palette, delay: delayMs, repeat: 0 });
    await sleep(0);   // 화면(진행률)이 숨 쉴 틈
  }
  gif.finish();
  return new Blob([gif.bytes()], { type: 'image/gif' });
}

/**
 * 동영상 — 오프스크린 캔버스 captureStream(0) + MediaRecorder.
 * 프레임마다 requestFrame() 뒤 유지 시간만큼 기다리므로 녹화는 실시간이다.
 */
export async function recordVideo(frames, delayMs, mimeType, signal) {
  if (!frames.length) throw new Error('프레임이 없습니다');
  const canvas = document.createElement('canvas');
  canvas.width = frames[0].width;
  canvas.height = frames[0].height;
  const ctx = canvas.getContext('2d');
  const stream = canvas.captureStream(0);
  const track = stream.getVideoTracks()[0];
  const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 8_000_000 });
  const chunks = [];
  recorder.ondataavailable = (e) => { if (e.data && e.data.size > 0) chunks.push(e.data); };
  const stopped = new Promise((resolve, reject) => {
    recorder.onstop = resolve;
    recorder.onerror = (e) => reject(e.error || new Error('녹화에 실패했습니다'));
  });

  recorder.start();
  try {
    for (const frame of frames) {
      if (signal && signal.aborted) throw abortError();
      ctx.drawImage(frame, 0, 0);
      if (track.requestFrame) track.requestFrame();
      await sleep(delayMs);
    }
    // 마지막 프레임이 잘리지 않게 한 번 더
    ctx.drawImage(frames[frames.length - 1], 0, 0);
    if (track.requestFrame) track.requestFrame();
    await sleep(150);
  } finally {
    recorder.stop();
    track.stop();
  }
  await stopped;
  return new Blob(chunks, { type: mimeType.split(';')[0] });
}
```

> `animationExport.js`(순수)에는 이 파일을 import 하지 않는다 — 방향은 캔버스 → 순수 한쪽뿐이다.

- [ ] **Step 4: 대화상자**

`src/ui/panels/AnimationExportDialog.js`:

```js
// © 2026 김용현
/**
 * AnimationExportDialog - 시계열 애니메이션 저장 (GIF · MP4/WebM)
 *
 * 브라우저 API·캡처·인코딩·저장은 전부 생성자로 주입받아 jsdom 에서 흐름만 테스트한다.
 * 실제 배선은 main.js 의 openAnimationExport(layerId) 가 한다.
 * 설계: docs/superpowers/specs/2026-09-25-labs-design.md 「애니메이션 저장」
 */
import { escapeHtml } from '../../utils/escapeHtml.js';
import { pickMimeType, extensionFor, animationFilename, frameDelayMs } from '../../tools/animationExport.js';
import { BASE_INTERVAL_MS } from '../../tools/TimeSeriesTool.js';

export class AnimationExportDialog {
  /**
   * @param {{layerName: string, fields: string[], speed: number,
   *          hasMediaRecorder: boolean, isTypeSupported: Function,
   *          beforeCapture: () => Promise<void>,
   *          captureFrames: Function, encodeGif: Function, recordVideo: Function,
   *          saveBlobAs: Function, onMessage: (msg: string) => void}} deps
   */
  constructor(deps) {
    this.d = deps;
    this.modal = null;
    this.controller = null;
    this.mime = deps.hasMediaRecorder ? pickMimeType(deps.isTypeSupported) : null;
  }

  show() {
    this.close();
    const holdDefault = (BASE_INTERVAL_MS / (this.d.speed || 1) / 1000).toFixed(1);
    const videoOption = this.mime
      ? `<label class="anim-radio"><input type="radio" name="anim-format" id="anim-format-video" value="video"><span>동영상 (${extensionFor(this.mime).toUpperCase()})</span></label>`
      : '';

    this.modal = document.createElement('div');
    this.modal.className = 'modal-overlay anim-export-modal active';
    this.modal.innerHTML = `
      <div class="modal-content anim-export-content" role="dialog" aria-labelledby="anim-title">
        <div class="modal-header">
          <h3 id="anim-title">애니메이션 저장</h3>
          <button class="modal-close" id="anim-close" aria-label="닫기">&times;</button>
        </div>
        <div class="modal-body">
          <p class="anim-intro">${escapeHtml(this.d.layerName)} · ${this.d.fields.length}개 연도</p>
          <div class="anim-row">
            <span class="anim-label">형식</span>
            <label class="anim-radio"><input type="radio" name="anim-format" id="anim-format-gif" value="gif" checked><span>GIF</span></label>
            ${videoOption}
          </div>
          <div class="anim-row">
            <label class="anim-label" for="anim-scale">배율</label>
            <select id="anim-scale"><option value="1">1×</option><option value="2">2×</option></select>
          </div>
          <div class="anim-row">
            <label class="anim-label" for="anim-hold">프레임 유지(초)</label>
            <input type="number" id="anim-hold" min="0.1" max="10" step="0.1" value="${holdDefault}">
          </div>
          <div class="anim-row">
            <label class="anim-check"><input type="checkbox" id="anim-label" checked><span>연도 라벨 포함</span></label>
            <label class="anim-check"><input type="checkbox" id="anim-legend" checked><span>범례 포함</span></label>
          </div>
          <div class="anim-progress" id="anim-progress" hidden></div>
        </div>
        <div class="modal-footer anim-footer">
          <button class="btn btn-secondary" id="anim-cancel">취소</button>
          <button class="btn btn-primary" id="anim-run">GIF 만들기</button>
        </div>
      </div>
    `;
    document.body.appendChild(this.modal);

    this.modal.querySelector('#anim-close').addEventListener('click', () => this.cancel());
    this.modal.querySelector('#anim-cancel').addEventListener('click', () => this.cancel());
    this.modal.querySelectorAll('input[name="anim-format"]').forEach((r) => {
      r.addEventListener('change', () => this.updateRunLabel());
    });
    this.modal.querySelector('#anim-run').addEventListener('click', () => this.run());
    this._escHandler = (e) => { if (e.key === 'Escape') this.cancel(); };
    document.addEventListener('keydown', this._escHandler);
    this.updateRunLabel();
  }

  format() {
    const video = this.modal && this.modal.querySelector('#anim-format-video');
    return video && video.checked ? 'video' : 'gif';
  }

  updateRunLabel() {
    const ext = this.format() === 'video' ? extensionFor(this.mime) : 'gif';
    this.modal.querySelector('#anim-run').textContent = `${ext.toUpperCase()} 만들기`;
  }

  setProgress(text) {
    const el = this.modal && this.modal.querySelector('#anim-progress');
    if (!el) return;
    el.hidden = !text;
    el.textContent = text || '';
  }

  /** 만들기 — 진행 중에는 입력을 잠그고 취소만 남긴다 */
  async run() {
    if (!this.modal || this.controller) return;
    const format = this.format();
    const scale = parseInt(this.modal.querySelector('#anim-scale').value, 10) || 1;
    const delayMs = frameDelayMs(this.modal.querySelector('#anim-hold').value);
    const includeLabel = this.modal.querySelector('#anim-label').checked;
    const includeLegend = this.modal.querySelector('#anim-legend').checked;
    const ext = format === 'video' ? extensionFor(this.mime) : 'gif';
    const filename = animationFilename(this.d.layerName, ext);

    this.controller = new AbortController();
    const { signal } = this.controller;
    this.modal.querySelectorAll('input, select, #anim-run').forEach((el) => { el.disabled = true; });
    this.setProgress(`준비 중…`);

    try {
      await this.d.beforeCapture();
      const frames = await this.d.captureFrames({
        scale, includeLabel, includeLegend, signal,
        onProgress: (done, total) => this.setProgress(`${done}/${total} 프레임`)
      });
      if (signal.aborted) throw new DOMException('취소', 'AbortError');
      this.setProgress(format === 'video' ? '녹화 중… (실시간)' : 'GIF 만드는 중…');
      const blob = format === 'video'
        ? await this.d.recordVideo(frames, delayMs, this.mime, signal)
        : await this.d.encodeGif(frames, delayMs, signal);
      if (signal.aborted) throw new DOMException('취소', 'AbortError');
      await this.d.saveBlobAs(filename, blob);
      this.d.onMessage(`${filename} 저장`);
    } catch (error) {
      if (!(error && error.name === 'AbortError')) {
        console.error('애니메이션 저장 실패', error);
        this.d.onMessage(`애니메이션 저장 실패: ${error && error.message ? error.message : error}`);
      }
    } finally {
      this.controller = null;
      this.close();
    }
  }

  /** 진행 중이면 중단(만들던 것은 버린다), 아니면 그냥 닫는다 */
  cancel() {
    if (this.controller) {
      this.controller.abort();
      this.setProgress('취소 중…');
      return;   // run() 의 finally 가 닫는다
    }
    this.close();
  }

  close() {
    if (this._escHandler) {
      document.removeEventListener('keydown', this._escHandler);
      this._escHandler = null;
    }
    if (this.modal) {
      this.modal.remove();
      this.modal = null;
    }
  }
}
```

- [ ] **Step 5: `main.js` 저장 훅**

`src/main.js` import 묶음(Task 7 에서 넣은 줄 아래)에:

```js
import { AnimationExportDialog } from './ui/panels/AnimationExportDialog.js';
import { captureFrames, encodeGif, recordVideo } from './tools/animationExportCanvas.js';
import { saveBlobAs } from './utils/saveFile.js';
```

(`saveTextAs` 를 이미 import 하고 있으면 그 줄에 `saveBlobAs` 를 더한다.)

Task 7 Step 2 에서 넣은 시계열 배선 블록 끝에:

```js
  // 슬라이더의 「저장」 → 애니메이션 저장 대화상자. 3D·지구본이 켜져 있으면 먼저 끈다
  // (지구본은 2단계 산출물 — 없으면 옵셔널 호출이 그냥 지나간다).
  timeSeriesTool.onSave = (layerId) => {
    const cfg = timeSeriesTool.config(layerId);
    const info = layerManager.getLayer(layerId);
    if (!cfg || !info) return;
    const dialog = new AnimationExportDialog({
      layerName: info.name,
      fields: cfg.timeSeries.fields,
      speed: timeSeriesTool.speed,
      hasMediaRecorder: typeof window.MediaRecorder === 'function',
      isTypeSupported: (m) => window.MediaRecorder && window.MediaRecorder.isTypeSupported(m),
      beforeCapture: async () => {
        if (view3dPanel && view3dPanel.controller) await view3dPanel.toggle();
        window.__egisDebug?.globePanel?.exit?.();
      },
      captureFrames: (opts) => captureFrames({ tool: timeSeriesTool, layerId, ...opts }),
      encodeGif,
      recordVideo,
      saveBlobAs,
      onMessage: showStatusMessage
    });
    dialog.show();
  };
```

`view3dPanel` 은 `let view3dPanel = null;` 로 파일 아래에 선언돼 있고 `initApp` 안에서 대입된다 — 화살표 함수가 부를 때는 이미 있다.

- [ ] **Step 6: 대화상자 CSS**

`src/styles/main.css` 의 Task 7 시계열 블록 끝(`@media (max-width: 768px) { … }` 앞)에:

```css
/* 애니메이션 저장 대화상자 */
.anim-export-modal .anim-export-content {
  width: 420px;
  max-width: 92vw;
  background: var(--bg-panel);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-lg);
}

.anim-intro {
  font-size: var(--font-size-sm);
  color: var(--text-secondary);
  margin: 0 0 var(--spacing-md);
}

.anim-row {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
  margin-bottom: var(--spacing-sm);
  font-size: var(--font-size-sm);
}

.anim-label {
  min-width: 110px;
  color: var(--text-secondary);
}

.anim-radio,
.anim-check {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
}

.anim-row input[type="number"] {
  width: 80px;
  padding: 4px 6px;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  background: var(--bg-input);
  color: var(--text-primary);
}

.anim-progress {
  margin-top: var(--spacing-md);
  padding: 8px 10px;
  border-radius: var(--radius-sm);
  background: var(--bg-app);
  font-size: var(--font-size-sm);
  color: var(--text-primary);
  font-variant-numeric: tabular-nums;
}

.anim-footer {
  display: flex;
  justify-content: flex-end;
  gap: var(--spacing-sm);
  padding: var(--spacing-md) var(--spacing-lg);
  border-top: 1px solid var(--border-color);
}
```

`.modal-overlay`·`.modal-content`·`.modal-header`·`.modal-body`·`.modal-close` 는 GeocodingPanel·LabPanel 이 쓰는 기존 규칙이다(`grep -n "\.modal-overlay" src/styles/main.css` 로 확인).

- [ ] **Step 7: 통과 확인·빌드**

Run: `npx vitest run src/ui/panels/AnimationExportDialog.test.js`
Expected: PASS (6 tests).

Run: `npm test && rm -rf dist && npm run build`
Expected: 전부 PASS, 빌드 성공. 빌드 로그에 `gifenc` 청크가 따로 생긴다(동적 import).

- [ ] **Step 8: 커밋**

```bash
git add src/tools/animationExportCanvas.js src/ui/panels/AnimationExportDialog.js src/ui/panels/AnimationExportDialog.test.js src/main.js src/styles/main.css
git -c user.name=yhk1m -c user.email=83273992+yhk1m@users.noreply.github.com commit -m "feat(time-series): 애니메이션 저장 — 프레임 캡처·GIF(gifenc)·동영상(MediaRecorder)·대화상자"
```

---

### Task 10: 레지스트리 항목 + 사용 설명서

**Files:**
- Modify: `src/labs/registry.js` (`EXPERIMENTS` 배열), `src/labs/registry.test.js`
- Modify: `docs/사용설명서.md` — `## 1-14. 실험실` 절의 마지막 `### …` 문단 뒤, `## 1-15. 팁과 단축키` 앞의 `---` 위

- [ ] **Step 1: 레지스트리 테스트에 한 줄**

`src/labs/registry.test.js` 의 `it('0단계에는 glass 가 들어 있다', …)` 뒤에:

```js
  it('4단계에는 time-series 가 들어 있다', () => {
    expect(EXPERIMENT_IDS).toContain('time-series');
  });
```

Run: `npx vitest run src/labs/registry.test.js`
Expected: FAIL — `expected [ 'glass', … ] to include 'time-series'`.

- [ ] **Step 2: 항목 추가**

`src/labs/registry.js` 의 `EXPERIMENTS` 배열 **마지막**에(다른 단계가 넣은 항목 뒤):

```js
  {
    id: 'time-series',
    name: '시계열 단계구분도',
    summary: '연도별 열을 슬라이더로 넘기며 변화를 보고, GIF·동영상으로 저장합니다.',
    since: '2026-09'
  }
```

Run: `npx vitest run src/labs/`
Expected: PASS.

- [ ] **Step 3: 설명서**

`docs/사용설명서.md` 의 1-14 절에서, 마지막 `### …` 실험 문단이 끝나고 `## 1-15. 팁과 단축키` 로 넘어가는 `---` **바로 위**에:

```md
### 시계열 단계구분도

**주제도 › 시계열 단계구분도**(실험을 켰을 때만 보입니다)에서 면 레이어와 연도별 숫자 열을 여러 개 고르면, 모든 연도의 값을 합쳐 **구간을 한 번만** 계산해 고정한 단계구분도가 만들어집니다. 연도마다 구간이 같아야 색이 비교되기 때문입니다. 「연도 자동 선택」은 이름이 연도(19xx·20xx)로 시작하는 열을 골라 줍니다.

- 지도 아래 슬라이더로 연도를 넘기고, 재생 버튼으로 자동 반복(1.2초 간격, 0.5×·1×·2×)합니다. 범례 아래에 지금 연도가 적힙니다.
- 슬라이더의 **저장**으로 연도별 화면을 **GIF** 또는 **동영상**(MP4가 되는 브라우저에서는 MP4, 아니면 WebM — 버튼에 실제 확장자가 적힙니다)으로 내려받습니다. 배율(1×·2×), 프레임 유지 시간, 연도 라벨·범례 포함을 고를 수 있습니다. 동영상은 실시간으로 녹화되어 연도 10개 × 1.2초면 약 12초 걸립니다. PowerPoint에는 MP4만 넣을 수 있습니다.
- 시계열 레이어는 자동 저장·프로젝트 파일에 함께 저장되고, 다시 열면 마지막 연도의 단계구분도로 복원됩니다(실험이 켜져 있으면 슬라이더도 되살아납니다). 필드는 30개까지, 저장은 웹 브라우저에서 하세요(데스크톱 앱에서는 이진 파일 다운로드가 되지 않을 수 있습니다).
```

- [ ] **Step 4: 빌드로 반영 확인**

Run: `rm -rf dist && npm run build && grep -c "시계열 단계구분도" dist/guide.html`
Expected: `1` 이상.

- [ ] **Step 5: 커밋**

```bash
git add src/labs/registry.js src/labs/registry.test.js docs/사용설명서.md
git -c user.name=yhk1m -c user.email=83273992+yhk1m@users.noreply.github.com commit -m "feat(labs): time-series 실험 등록, 설명서 1-14 시계열 문단"
```

---

### Task 11: Electron 하네스로 화면 검증

**Files:**
- Create: `scripts/verify/labs-time-series.cjs`

내장 데이터에는 연도 열이 여러 개인 폴리곤 자료가 없다(속성 자료도 단일 시점). 하네스는 내장 「서울 자치구」 GeoJSON 을 페이지 안에서 fetch 해 연도 열 6개(2015·2017·…·2025)를 붙인 뒤 `__egisDebug.projectManager.deserialize` 로 올린다(verify 스킬의 프로젝트 왕복 경로).

- [ ] **Step 1: 빌드·프리뷰**

```bash
cd "C:/Users/김용현/Desktop/vibecoding/eGIS"
rm -rf dist && npm run build
npx vite preview --port 4173 &
curl -s -o /dev/null -w "%{http_code}" http://localhost:4173/
```
Expected: `200`.

- [ ] **Step 2: 하네스 작성**

`scripts/verify/labs-time-series.cjs`:

```js
// © 2026 김용현
/**
 * 실험실 4단계(시계열 단계구분도) 화면 검증 — 사용자처럼 메뉴와 슬라이더를 누른다.
 * 실행: cd eStoryMap && npx electron ../scripts/verify/labs-time-series.cjs
 * 결과: scripts/verify/out/ts-*.png, out/ts-download.gif 와 콘솔 판정
 */
const { app, BrowserWindow, session } = require('electron');
const fs = require('fs');
const path = require('path');

const OUT = path.join(__dirname, 'out');
fs.mkdirSync(OUT, { recursive: true });
setTimeout(() => { console.error('WATCHDOG'); process.exit(2); }, 180000);

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function capture(win, name) {
  let png = Buffer.alloc(0);
  for (let i = 0; i < 5 && png.length === 0; i++) {
    win.focus();
    await wait(1500);
    png = (await win.capturePage()).toPNG();
  }
  fs.writeFileSync(path.join(OUT, `${name}.png`), png);
  console.log('captured', name, png.length);
}

function check(name, ok) {
  console.log(ok ? 'PASS' : 'FAIL', name);
  if (!ok) process.exitCode = 1;
}

/** 서울 자치구에 가상 연도 열 6개를 붙여 프로젝트로 올린다 (페이지 안에서 실행) */
const LOAD_DATA = `(async () => {
  const gj = await fetch('/data/builtin/practice/Area%20Data/%ED%96%89%EC%A0%95%EA%B2%BD%EA%B3%84/%EC%84%9C%EC%9A%B8%20%EC%9E%90%EC%B9%98%EA%B5%AC.geojson').then(r => r.json());
  const YEARS = ['2015', '2017', '2019', '2021', '2023', '2025'];
  gj.features.forEach((f, i) => {
    const base = 200000 + i * 15000;
    YEARS.forEach((y, k) => { f.properties[y] = Math.round(base * (1 + 0.06 * k * ((i % 3) - 1)) + (i * 7919) % 30000); });
  });
  await __egisDebug.projectManager.deserialize({
    version: '1.0', name: 'ts-harness',
    layers: [{ id: 'ts-src', name: '서울 자치구', type: 'vector', geometryType: 'MultiPolygon', color: '#3b82f6', visible: true, features: gj }]
  });
  return __egisDebug.layerManager.getAllLayers().length;
})()`;

app.whenReady().then(async () => {
  const win = new BrowserWindow({ width: 1600, height: 1000, show: true });
  const js = (c) => win.webContents.executeJavaScript(c);

  // 다운로드 가로채기 — GIF 저장 확인용
  let downloaded = null;
  session.defaultSession.on('will-download', (event, item) => {
    const target = path.join(OUT, 'ts-download' + path.extname(item.getFilename()));
    item.setSavePath(target);
    item.once('done', (e, state) => {
      downloaded = { state, name: item.getFilename(), size: fs.existsSync(target) ? fs.statSync(target).size : 0 };
    });
  });

  await win.loadURL('http://localhost:4173/');
  await wait(3000);
  await js(`localStorage.setItem('egis_last_visit', new Date(Date.now() + 9*3600e3).toISOString().slice(0,10))`);

  // 1. 실험 꺼짐: 메뉴 항목이 숨겨져 있다
  check('menu item hidden when off', await js(`document.querySelector('[data-action="analysis-time-series"]').hidden === true`));

  // 2. 자료 올리기 → 실험 켜기 → 메뉴 항목 보임
  check('data loaded', (await js(LOAD_DATA)) === 1);
  await js(`__egisDebug.labs.set('time-series', true)`);
  await wait(300);
  check('menu item visible when on', await js(`document.querySelector('[data-action="analysis-time-series"]').hidden === false`));

  // 3. 메뉴 → 설정 창 → 연도 자동 선택 → 적용
  await js(`document.querySelector('[data-menu="thematic-map"] .menu-button').click()`);
  await wait(200);
  await js(`document.querySelector('[data-action="analysis-time-series"]').click()`);
  await wait(400);
  check('panel opened', await js(`!!document.querySelector('.time-series-modal')`));
  await js(`document.getElementById('ts-auto-years').click()`);
  check('6 year fields checked', (await js(`document.querySelectorAll('.ts-field-check:checked').length`)) === 6);
  await capture(win, 'ts-01-panel');
  await js(`document.getElementById('ts-apply').click()`);
  await wait(800);
  check('derived layer created', await js(`__egisDebug.layerManager.getAllLayers().some(l => l.name === '서울 자치구_시계열_2015~2025')`));
  check('controls shown', await js(`!!document.getElementById('time-series-controls') && document.getElementById('ts-field').textContent === '2015'`));
  check('legend subtitle', await js(`(document.querySelector('.choropleth-legend .choropleth-legend-subtitle') || {}).textContent === '2015 (1/6)'`));
  await capture(win, 'ts-02-year-2015');

  // 4. 슬라이더 이동 → 색이 바뀌고 부제가 따라온다
  await js(`(() => { const r = document.getElementById('ts-range'); r.value = '3'; r.dispatchEvent(new Event('input', { bubbles: true })); })()`);
  await wait(600);
  check('slider moved to 2021', await js(`document.getElementById('ts-field').textContent === '2021' && __egisDebug.timeSeriesTool.config().attribute === '2021'`));
  await capture(win, 'ts-03-year-2021');
  await js(`(() => { const r = document.getElementById('ts-range'); r.value = '5'; r.dispatchEvent(new Event('input', { bubbles: true })); })()`);
  await wait(600);
  await capture(win, 'ts-04-year-2025');

  // 5. 재생: 1.2초 뒤 한 칸(끝에서 처음으로)
  await js(`document.getElementById('ts-play').click()`);
  await wait(1500);
  check('play wrapped to 2015', await js(`document.getElementById('ts-field').textContent === '2015' && document.getElementById('ts-play').getAttribute('aria-pressed') === 'true'`));
  await js(`document.getElementById('ts-play').click()`);
  await wait(200);
  check('paused', await js(`document.getElementById('ts-play').getAttribute('aria-pressed') === 'false'`));

  // 6. 새로고침 → 자동 복원 → 컨트롤이 되살아난다 (복원 대화상자는 「복원하기」)
  await js(`(() => { const r = document.getElementById('ts-range'); r.value = '2'; r.dispatchEvent(new Event('input', { bubbles: true })); })()`);
  await wait(3000);   // 자동 저장 디바운스 1초 + IndexedDB 쓰기
  await win.loadURL('http://localhost:4173/');
  await wait(2500);
  await js(`document.getElementById('restore-yes') && document.getElementById('restore-yes').click()`);
  await wait(4000);
  check('restored layer has timeSeries', await js(`__egisDebug.layerManager.getAllLayers().some(l => l._choroplethConfig && l._choroplethConfig.timeSeries && l._choroplethConfig.timeSeries.index === 2)`));
  check('controls restored at 2019', await js(`!!document.getElementById('time-series-controls') && document.getElementById('ts-field').textContent === '2019'`));
  await capture(win, 'ts-05-restored');

  // 7. GIF 저장 (다운로드 가로채기)
  await js(`document.getElementById('ts-save').click()`);
  await wait(400);
  check('export dialog', await js(`!!document.querySelector('.anim-export-modal') && document.getElementById('anim-run').textContent === 'GIF 만들기'`));
  await capture(win, 'ts-06-export-dialog');
  await js(`document.getElementById('anim-run').click()`);
  for (let i = 0; i < 40 && !downloaded; i++) await wait(500);
  check('gif downloaded', !!downloaded && downloaded.state === 'completed' && /\\.gif$/.test(downloaded.name) && downloaded.size > 10000);
  console.log('download', JSON.stringify(downloaded));
  check('slider back to 2019 after export', await js(`document.getElementById('ts-field').textContent === '2019'`));

  // 8. 끄기 → 컨트롤·메뉴 항목 사라지고 레이어는 정적으로 남는다
  await js(`__egisDebug.labs.set('time-series', false)`);
  await wait(300);
  check('controls removed when off', await js(`!document.getElementById('time-series-controls')`));
  check('menu hidden again', await js(`document.querySelector('[data-action="analysis-time-series"]').hidden === true`));
  check('layer still there', await js(`__egisDebug.layerManager.getAllLayers().some(l => l.name === '서울 자치구_시계열_2015~2025')`));
  await capture(win, 'ts-07-off');

  // 뒷정리: 다음 실행이 복원 창을 안 만나게
  await js(`__egisDebug.layerManager.getAllLayers().slice().forEach(l => __egisDebug.layerManager.removeLayer(l.id))`);
  await wait(500);
  app.quit();
});
```

- [ ] **Step 3: 실행**

```bash
cd "C:/Users/김용현/Desktop/vibecoding/eGIS/eStoryMap" && npx electron ../scripts/verify/labs-time-series.cjs 2>&1 | grep -viE "devtools|deprecat|GPU|cache_util|disk_cache|quota_database|Security Warning"
```
Expected: `PASS` 19줄, `FAIL` 0줄, `scripts/verify/out/ts-0*.png` 7장, `ts-download.gif`. 캡처를 열어 확인할 것:
- `ts-01-panel`: 필드 목록에 연도 6개가 체크돼 있고 이모지가 없다.
- `ts-02`·`ts-03`·`ts-04`: 자치구 색이 연도마다 달라지고 **범례 구간은 같다**(구간 고정), 부제가 `2015 (1/6)`·`2021 (4/6)`·`2025 (6/6)`.
- 슬라이더 박스가 지도 아래 가운데, 범례와 겹치지 않는다.
- `ts-download.gif` 를 열어 6프레임이 1.2초씩 반복되고 왼쪽 위에 연도, 범례가 찍혀 있다.
- `ts-07-off`: 슬라이더 박스만 사라지고 지도·범례는 그대로.

동영상은 하네스로 못 본다(Electron 의 MediaRecorder mp4 지원이 크롬과 다르다). Task 12 배포 뒤 실제 크롬에서 `MP4 만들기` 를 한 번 눌러 파일이 열리는지 본다.

- [ ] **Step 4: 프리뷰 종료·커밋**

프리뷰 서버를 끝낸다. `scripts/verify/.gitignore` 에 `out/` 이 이미 있다(0단계).

```bash
git add scripts/verify/labs-time-series.cjs
git -c user.name=yhk1m -c user.email=83273992+yhk1m@users.noreply.github.com commit -m "test(time-series): 실험실 4단계 Electron 하네스"
```

---

### Task 12: 마무리

- [ ] **Step 1: 전체 확인**

```bash
npm test
rm -rf dist && npm run build
git status --short
```
Expected: 테스트 전부 PASS, 빌드 성공, 작업 트리 깨끗.

- [ ] **Step 2: 실험 끄면 정식 화면과 같은지**

`ts-07-off.png` 에서 슬라이더 박스·메뉴 항목 외에 달라진 곳이 없어야 한다. 시계열이 아닌 단계구분도(`주제도 › 단계구분도`)를 하나 만들어 저장·새로고침해 예전처럼 복원되는지도 본다(`timeSeries` 가 `undefined` 라 저장본이 바뀌지 않아야 한다).

- [ ] **Step 3: 병합·배포·실제 확인**

`superpowers:finishing-a-development-branch` → `main` 병합 → `/cpd`. 배포 뒤 `https://www.e-gis.kr/?lab=time-series` 로 열어(하드 새로고침):
1. 서울 자치구 + 연도 열이 있는 CSV 를 테이블 결합해 시계열을 만든다.
2. 슬라이더·재생·GIF 저장, 그리고 크롬에서 **MP4 만들기**(버튼 글자가 MP4 인지, 파일이 PowerPoint 에 들어가는지).
3. 3D 를 켠 채 저장을 누르면 3D 가 먼저 꺼지는지.

---

## 스펙 대조 (자체 검토)

| 스펙 항목 | 작업 |
|---|---|
| 주제도 메뉴 항목 `data-lab="time-series"`, 실험 꺼지면 숨김, 즉시 반영 | Task 4, 7 |
| 패널: 레이어(폴리곤·숫자 필드 2개 이상) · 필드 체크(속성 순서) · 연도 자동 선택 `/^(19|20)\d{2}/` · 분류 방법 · 구간 수 · 팔레트(램프+커스텀) · 적용 | Task 1, 6 |
| 구간을 모든 필드 값으로 한 번만 계산해 고정, `apply` 의 `options.breaks` 확장 | Task 1(unionValues), 2, 5 |
| 파생 레이어 이름 `원본_시계열_첫필드~끝필드`, `cfg.timeSeries = { fields, index: 0 }` | Task 1, 5 |
| 슬라이더 컨트롤(range·현재 필드·재생/일시정지 1.2초 반복·속도 0.5/1/2×·닫기), 단계 이동 = attribute → updateLayerStyle → 부제 → LAYER_STYLE_CHANGED | Task 5 |
| 저장·복원: `choroplethConfig.timeSeries` 직렬화, 복원 직후 정적, PROJECT_LOADED·자동 복원 완료 이벤트로 컨트롤 되살림 | Task 3, 7 |
| 저장 버튼 → 대화상자(형식·배율·유지·라벨·범례·진행률·취소) | Task 9 |
| 프레임: setIndex → rendercomplete → composeMapCanvas → drawLegend + 연도 라벨 | Task 9 |
| GIF = gifenc(지연·무한 반복), 동영상 = captureStream(0)+MediaRecorder(mime 우선순위, 실제 확장자 표시, 실시간) | Task 8, 9 |
| 스펙의 `animationExport.js` 한 파일을 순수(`animationExport.js`)와 브라우저(`animationExportCanvas.js`) 둘로 나눔 — 노드 테스트가 OL 을 끌고 오지 않게 | Task 8, 9 |
| `saveBlobAs`, 파일명 `레이어이름_시계열.ext` | Task 8 |
| 제한: 필드 30개, 3D·지구본 먼저 끄기, 시계열 레이어에만 | Task 1, 6, 9 |
| 오류: MediaRecorder 없으면 GIF 만, 캔버스 오염 시 상태줄 메시지·중단, 취소 시 폐기 | Task 9 |
| 레지스트리 항목(구현된 단계에서만), 설명서 1-14 문단 | Task 10 |
| 순수 모듈 테스트 먼저, 하네스 시나리오(켜기→사용→캡처→끄기→복구) | 각 Task, Task 11 |
| 개인정보 방침 변경 없음 | 해당 없음(확인만) |

코드를 읽다 발견한, 스펙과 다른 사실:
- 스펙은 "범례 부제(`choropleth-legend-subtitle`) 갱신"이라 하지만 그 클래스는 CSS(`main.css:2775`)에만 있고 `ChoroplethTool.createLegend` 는 부제 요소를 만들지 않는다. → `TimeSeriesTool.updateLegendSubtitle` 이 없으면 만들어 넣는다(Task 5). `ChoroplethTool` 은 건드리지 않는다.
- 자동 복원(`AutoSaveManager.restoreState`)에는 완료 이벤트가 없다 → 스펙대로 `STATE_RESTORED` 를 더했다(Task 3).
- `composeMapCanvas` 의 `pixelRatio` 는 "OL 이 그린 해상도"라 배율 2× 는 `devicePixelRatio × 2` 로 넘긴다(Task 9). 기기 픽셀비가 1인 화면에서 2× 는 확대일 뿐 더 선명해지지는 않는다 — 설명서에는 적지 않았다(사용자가 결과를 보고 판단).
- 데스크톱 브릿지(`window.egisDesktop.saveTextFile`)는 텍스트만 받는다 → `saveBlobAs` 는 브라우저 다운로드만 쓰고 설명서에 "웹에서 저장"을 적었다(Task 8, 10).

## 구현하며 바뀐 점

- Task 5: `#ts-range` 핸들러는 값을 먼저 읽고 `pause()` 한다(멈추면서 값이 되돌아가던 결함). 구간 수는 `naturalBreaks` 가 감당하는 만큼으로 캡.
- Task 9: `encodeGif`/`recordVideo` 는 `{ signal, onProgress }` 옵션 객체를 받는다(계획은 signal 만). `beforeCapture` 는 `__egisDebug` 대신 실제 패널 API(`globePanel.exitIfActive()`, `swipePanel.close()`, `view3dPanel.toggle()`, `timeSeriesTool.pause()`)를 쓴다. 추가 보강: 도구가 다른 레이어에 붙어 있으면 캡처 거부, 지도 크기는 첫 프레임 뒤 한 번만 재고 바뀌면 중단, `rendercomplete` 3초 폴백 + 리스너 정리, MediaRecorder 생성 실패 시 트랙 정지, 프레임 유지 시간 상한 10초(GIF 16비트 지연 랩 방지), 인코딩 진행률. 2× 배율은 OL 이 DPR 로만 그리므로 지도 픽셀은 업스케일이고 범례·라벨만 선명하다.
- Task 9: 파일 이름 — 시계열 레이어 이름에 이미 `_시계열` 이 있으면 접미사를 다시 붙이지 않는다(`서울 자치구_시계열_2015~2025.gif`).
- Task 11: 하네스는 `builtinDataManager` 대신 builtin GeoJSON 을 직접 받아 연도 열 6개(`2015`…`2025`, 이름이 19xx/20xx 로 시작해야 자동 선택에 걸린다)를 붙여 `projectManager.deserialize` 로 넣는다. 다운로드는 `HTMLAnchorElement.prototype.click` 패치로 가로채 GIF 를 페이지 안에서 파싱한다(프레임 6, 지연 120cs, 1983×1259). MP4 는 헤드리스에서 못 본다 — 배포 뒤 실제 Chrome 에서 한 번 확인.
- 하네스가 드러낸 기존 결함(이 단계 밖, 별도 수정 필요): `AutoSaveManager` 가 복원 확인 창이 떠 있는 동안 시작 `moveend` 로 기본 뷰(줌 7)를 `eGIS_mapState` 에 덮어써, 2초 넘게 기다렸다가 「복원」을 누르면 저장된 뷰가 사라진다. `promptRestore` 전에 `isRestoring` 을 세우는 식으로 막아야 한다.
