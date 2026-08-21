# 선택 피처 속성 카드 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 선택 도구로 고른 피처의 속성을 지도 위 카드 하나에 모아 보여준다.

**Architecture:** 순수 로직(`featureInfoModel.js`)과 렌더(`FeatureInfoCard.js`)를 나눈다. 카드는 범례와 같은 방식으로 `#map` 안의 절대배치 DOM 이고 `makeDraggable` 로 옮긴다. 툴바 버튼과 이벤트 배선은 `main.js` 가 맡는다.

**Tech Stack:** Vanilla ES modules, OpenLayers, Vite, Vitest

설계서: `docs/superpowers/specs/2026-08-21-feature-info-card-design.md`

---

### Task 1: 속성 카드 모델

**Files:**
- Create: `src/ui/featureInfoModel.js`
- Test: `src/ui/featureInfoModel.test.js`

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`src/ui/featureInfoModel.test.js`:

```js
// © 2026 김용현
import { describe, it, expect } from 'vitest';
import { buildFeatureInfoSections } from './featureInfoModel.js';

// OL Feature 대역 — getProperties() 와 ol_uid 만 있으면 모델이 돈다
function fakeFeature(props, uid) {
  return { ol_uid: uid, getProperties: () => props };
}

const noDeps = { findLayer: () => null, getLabelField: () => null };

describe('buildFeatureInfoSections', () => {
  it('선택이 없으면 빈 배열', () => {
    expect(buildFeatureInfoSections([], noDeps)).toEqual([]);
    expect(buildFeatureInfoSections(null, noDeps)).toEqual([]);
  });

  it('geometry 는 속성 목록에서 빠진다', () => {
    const f = fakeFeature({ geometry: { getType: () => 'Point' }, 이름: '서울' }, '1');
    const [section] = buildFeatureInfoSections([f], noDeps);
    expect(section.attributes.map(a => a.name)).toEqual(['이름']);
  });

  it('geometry 가 아닌 이름으로 들어온 도형 값도 빠진다', () => {
    const f = fakeFeature({ geom: { getType: () => 'Polygon' }, 인구: 100 }, '1');
    const [section] = buildFeatureInfoSections([f], noDeps);
    expect(section.attributes.map(a => a.name)).toEqual(['인구']);
  });

  it('빈 값은 - 로 나온다', () => {
    const f = fakeFeature({ a: null, b: undefined, c: '', d: '  ', e: 0 }, '1');
    const [section] = buildFeatureInfoSections([f], noDeps);
    expect(section.attributes).toEqual([
      { name: 'a', value: '-' },
      { name: 'b', value: '-' },
      { name: 'c', value: '-' },
      { name: 'd', value: '-' },
      { name: 'e', value: '0' }
    ]);
  });

  it('제목: 레이어에 설정된 라벨 필드를 가장 먼저 쓴다', () => {
    const f = fakeFeature({ 이름: '무시됨', 별칭: '한강' }, '1');
    const deps = {
      findLayer: () => ({ id: 'L1', name: '하천' }),
      getLabelField: () => '별칭'
    };
    expect(buildFeatureInfoSections([f], deps)[0].title).toBe('한강');
  });

  it('제목: 라벨 필드가 없으면 이름 후보 필드를 쓴다', () => {
    const f = fakeFeature({ code: 11, 이름: '서울특별시' }, '1');
    expect(buildFeatureInfoSections([f], noDeps)[0].title).toBe('서울특별시');
  });

  it('제목: 이름 후보도 없으면 첫 문자열 속성을 쓴다', () => {
    const f = fakeFeature({ 인구: 9411440, 구분: '광역시' }, '1');
    expect(buildFeatureInfoSections([f], noDeps)[0].title).toBe('광역시');
  });

  it('제목: 쓸 문자열이 하나도 없으면 피처 N', () => {
    const f1 = fakeFeature({ 인구: 100 }, '1');
    const f2 = fakeFeature({ 인구: 200 }, '2');
    const sections = buildFeatureInfoSections([f1, f2], noDeps);
    expect(sections.map(s => s.title)).toEqual(['피처 1', '피처 2']);
  });

  it('라벨 필드 값이 비어 있으면 다음 후보로 넘어간다', () => {
    const f = fakeFeature({ 별칭: '', 이름: '서울' }, '1');
    const deps = { findLayer: () => ({ id: 'L1', name: '행정구역' }), getLabelField: () => '별칭' };
    expect(buildFeatureInfoSections([f], deps)[0].title).toBe('서울');
  });

  it('서로 다른 레이어를 섞어 골라도 각 섹션에 제 레이어명이 붙는다', () => {
    const a = fakeFeature({ 이름: '서울' }, '1');
    const b = fakeFeature({ 이름: '한강' }, '2');
    const deps = {
      findLayer: (f) => (f === a ? { id: 'L1', name: '행정구역' } : { id: 'L2', name: '하천' }),
      getLabelField: () => null
    };
    const sections = buildFeatureInfoSections([a, b], deps);
    expect(sections.map(s => s.layerName)).toEqual(['행정구역', '하천']);
  });

  it('key 는 ol_uid 를 쓴다 (접힘 상태를 기억하는 기준)', () => {
    const f = fakeFeature({ 이름: '서울' }, '42');
    expect(buildFeatureInfoSections([f], noDeps)[0].key).toBe('42');
  });
});
```

- [ ] **Step 2: 실패를 확인한다**

Run: `npx vitest run src/ui/featureInfoModel.test.js`

Expected: FAIL — `Failed to resolve import "./featureInfoModel.js"`

- [ ] **Step 3: 모델을 구현한다**

`src/ui/featureInfoModel.js`:

```js
// © 2026 김용현
/**
 * featureInfoModel - 선택한 피처를 속성 카드가 그릴 수 있는 형태로 바꾼다.
 *
 * DOM 과 OpenLayers 에 기대지 않는 순수 로직이라 여기서 단위 테스트한다.
 * (legendModel.js 와 같은 분리 방식)
 */

// 라벨 필드가 없을 때 제목으로 쓸 이름 후보. 앞에 있는 것부터 찾는다.
const NAME_FIELD_CANDIDATES = [
  'name', 'NAME', 'Name', '이름', '명칭', '지명', 'title',
  '시도명', '시군구명', '읍면동명', 'adm_nm', 'SIG_KOR_NM'
];

/**
 * @param {Array} features - 선택된 피처 (선택 순서)
 * @param {{findLayer:Function, getLabelField:Function}} deps
 * @returns {Array<{key:string, title:string, layerName:string, attributes:Array<{name:string,value:string}>}>}
 */
export function buildFeatureInfoSections(features, deps = {}) {
  const findLayer = deps.findLayer || (() => null);
  const getLabelField = deps.getLabelField || (() => null);

  return (features || []).map((feature, index) => {
    const entries = rawEntries(feature);
    const layer = findLayer(feature) || null;
    const labelField = layer ? getLabelField(layer.id) : null;

    return {
      key: featureKey(feature, index),
      title: pickTitle(entries, labelField, index),
      layerName: layer && layer.name ? layer.name : '',
      attributes: entries.map((e) => ({ name: e.name, value: displayValue(e.raw) }))
    };
  });
}

/** 도형을 뺀 속성 목록 (원본 값 그대로) */
function rawEntries(feature) {
  const props = feature && typeof feature.getProperties === 'function'
    ? feature.getProperties()
    : {};

  return Object.keys(props)
    .filter((name) => name !== 'geometry')
    .filter((name) => !isGeometryValue(props[name]))
    .map((name) => ({ name, raw: props[name] }));
}

// geometryName 을 바꾼 레이어에서는 도형이 'geometry' 가 아닌 이름으로 들어온다.
function isGeometryValue(value) {
  return !!value && typeof value === 'object' && typeof value.getType === 'function';
}

function displayValue(raw) {
  if (raw === null || raw === undefined) return '-';
  const text = String(raw).trim();
  return text === '' ? '-' : text;
}

function pickTitle(entries, labelField, index) {
  const valueOf = (name) => {
    const hit = entries.find((e) => e.name === name);
    if (!hit) return null;
    const text = displayValue(hit.raw);
    return text === '-' ? null : text;
  };

  if (labelField) {
    const byLabel = valueOf(labelField);
    if (byLabel) return byLabel;
  }

  for (const candidate of NAME_FIELD_CANDIDATES) {
    const byName = valueOf(candidate);
    if (byName) return byName;
  }

  const firstText = entries.find((e) => typeof e.raw === 'string' && e.raw.trim() !== '');
  if (firstText) return firstText.raw.trim();

  return `피처 ${index + 1}`;
}

function featureKey(feature, index) {
  if (feature && feature.ol_uid !== undefined && feature.ol_uid !== null) {
    return String(feature.ol_uid);
  }
  if (feature && typeof feature.getId === 'function' && feature.getId() !== undefined) {
    return String(feature.getId());
  }
  return `idx-${index}`;
}
```

- [ ] **Step 4: 통과를 확인한다**

Run: `npx vitest run src/ui/featureInfoModel.test.js`

Expected: PASS (11 tests)

- [ ] **Step 5: 커밋**

```bash
git add src/ui/featureInfoModel.js src/ui/featureInfoModel.test.js
git commit -m "feat: 선택 피처 속성 카드 모델"
```

---

### Task 2: 카드 스타일

**Files:**
- Modify: `src/styles/main.css` — `.choropleth-legend {` 정의 바로 앞

- [ ] **Step 1: CSS 를 추가한다**

```css
/* 선택 피처 속성 카드 — 범례와 같은 지도 오버레이.
   좌측 상단이 기본 위치다 (우측 상단은 줌·나침반·배경지도, 좌·우 하단은 범례·축척바가 쓴다) */
.feature-info-card {
  position: absolute;
  top: 10px;
  left: 10px;
  z-index: 100;
  width: 260px;
  max-width: calc(100% - 20px);
  max-height: 60%;
  display: flex;
  flex-direction: column;
  background: var(--bg-panel);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-md);
  font-size: var(--font-size-sm);
  overflow: hidden;
}

.feature-info-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--spacing-sm);
  padding: var(--spacing-xs) var(--spacing-sm);
  border-bottom: 1px solid var(--border-color);
  flex-shrink: 0;
}

.feature-info-title {
  font-weight: 600;
  color: var(--text-primary);
}

.feature-info-close {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 18px;
  line-height: 1;
  padding: 0 4px;
  color: var(--text-secondary);
}

.feature-info-close:hover {
  color: var(--text-primary);
}

.feature-info-body {
  overflow-y: auto;
  overscroll-behavior: contain;
}

.feature-info-section + .feature-info-section {
  border-top: 1px solid var(--border-color);
}

.feature-info-section-header {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  padding: var(--spacing-xs) var(--spacing-sm);
  background: none;
  border: none;
  cursor: pointer;
  text-align: left;
  color: var(--text-primary);
  font-size: var(--font-size-sm);
}

.feature-info-caret {
  color: var(--text-muted);
  flex-shrink: 0;
}

.feature-info-name {
  font-weight: 600;
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.feature-info-layer {
  font-size: var(--font-size-xs);
  color: var(--text-muted);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  padding: 0 4px;
  flex-shrink: 0;
  max-width: 90px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.feature-info-attrs {
  margin: 0;
  padding: 0 var(--spacing-sm) var(--spacing-xs);
}

.feature-info-row {
  display: flex;
  gap: var(--spacing-sm);
  padding: 2px 0;
}

.feature-info-row dt {
  flex: 0 0 88px;
  color: var(--text-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.feature-info-row dd {
  margin: 0;
  flex: 1;
  min-width: 0;
  color: var(--text-primary);
  word-break: break-word;
}

.feature-info-section.collapsed .feature-info-attrs {
  display: none;
}
```

- [ ] **Step 2: 커밋**

```bash
git add src/styles/main.css
git commit -m "feat: 속성 카드 스타일"
```

---

### Task 3: 카드 컴포넌트

**Files:**
- Create: `src/ui/FeatureInfoCard.js`

- [ ] **Step 1: 컴포넌트를 구현한다**

```js
// © 2026 김용현
/**
 * FeatureInfoCard - 선택한 피처의 속성을 지도 위 카드로 보여준다.
 *
 * 속성테이블은 패널이라 피처를 고르는 동안 최소화되거나 가려진다.
 * 이 카드는 범례(ChoroplethTool.createLegend)와 같은 지도 오버레이라 그 문제가 없다.
 *
 * 보이는 조건: 선택 도구 활성 AND 버튼 ON AND 선택 피처 1개 이상
 */

import { escapeHtml } from '../utils/escapeHtml.js';
import { makeDraggable } from '../utils/DraggableElement.js';
import { buildFeatureInfoSections } from './featureInfoModel.js';
import { layerManager } from '../core/LayerManager.js';
import { labelTool } from '../tools/LabelTool.js';
import { selectTool } from '../tools/SelectTool.js';

class FeatureInfoCard {
  constructor() {
    this.el = null;
    this.enabled = false;
    this.collapsed = new Set();   // 접어둔 섹션 key
    this.position = null;         // 드래그로 옮긴 위치 { left, top }
    this.onChange = null;         // 툴바 버튼 상태 동기화 콜백
  }

  isEnabled() {
    return this.enabled;
  }

  setEnabled(on) {
    const next = !!on;
    if (this.enabled === next) {
      this.refresh();
      return;
    }
    this.enabled = next;
    if (!next) this.collapsed.clear();
    this.refresh();
    if (typeof this.onChange === 'function') this.onChange();
  }

  /** 표시 조건을 다시 따져 카드를 그리거나 지운다 */
  refresh() {
    const features = selectTool.getIsActive() ? selectTool.getSelectedFeatures() : [];

    if (!this.enabled || features.length === 0) {
      this.remove();
      return;
    }

    this.render(features);
  }

  render(features) {
    const sections = buildFeatureInfoSections(features, {
      findLayer: (feature) => this.findLayer(feature),
      getLabelField: (layerId) => {
        const config = labelTool.getLabelConfig(layerId);
        return config && config.field ? config.field : null;
      }
    });

    const el = this.ensureElement();
    if (!el) return;

    const titleEl = el.querySelector('.feature-info-title');
    if (titleEl) titleEl.textContent = `속성 정보 (${sections.length}개 선택)`;

    const body = el.querySelector('.feature-info-body');
    const scrollTop = body.scrollTop;
    body.innerHTML = sections.map((section) => this.sectionHtml(section)).join('');
    body.scrollTop = scrollTop;
  }

  sectionHtml(section) {
    const isCollapsed = this.collapsed.has(section.key);
    const rows = section.attributes.map((attr) => `
        <div class="feature-info-row">
          <dt title="${escapeHtml(attr.name)}">${escapeHtml(attr.name)}</dt>
          <dd>${escapeHtml(attr.value)}</dd>
        </div>`).join('');

    return `
      <section class="feature-info-section${isCollapsed ? ' collapsed' : ''}" data-key="${escapeHtml(section.key)}">
        <button type="button" class="feature-info-section-header">
          <span class="feature-info-caret">${isCollapsed ? '▸' : '▾'}</span>
          <span class="feature-info-name" title="${escapeHtml(section.title)}">${escapeHtml(section.title)}</span>
          ${section.layerName ? `<span class="feature-info-layer" title="${escapeHtml(section.layerName)}">${escapeHtml(section.layerName)}</span>` : ''}
        </button>
        <dl class="feature-info-attrs">${rows}</dl>
      </section>`;
  }

  ensureElement() {
    if (this.el && this.el.isConnected) return this.el;

    const mapContainer = document.getElementById('map');
    if (!mapContainer) return null;

    const el = document.createElement('div');
    el.className = 'feature-info-card';
    el.innerHTML = `
      <div class="feature-info-header">
        <span class="feature-info-title">속성 정보</span>
        <button type="button" class="feature-info-close" title="닫기">&times;</button>
      </div>
      <div class="feature-info-body"></div>`;

    // 마지막으로 옮긴 자리에 다시 띄운다
    if (this.position) {
      el.style.left = this.position.left;
      el.style.top = this.position.top;
      el.style.right = 'auto';
      el.style.bottom = 'auto';
    }

    el.querySelector('.feature-info-close').addEventListener('click', () => {
      this.setEnabled(false);
    });

    // 섹션 헤더 클릭 → 접기/펼치기
    el.querySelector('.feature-info-body').addEventListener('click', (event) => {
      const header = event.target.closest('.feature-info-section-header');
      if (!header) return;
      const section = header.closest('.feature-info-section');
      const key = section && section.dataset.key;
      if (!key) return;

      if (this.collapsed.has(key)) this.collapsed.delete(key);
      else this.collapsed.add(key);

      section.classList.toggle('collapsed');
      const caret = section.querySelector('.feature-info-caret');
      if (caret) caret.textContent = this.collapsed.has(key) ? '▸' : '▾';
    });

    mapContainer.appendChild(el);
    makeDraggable(el, () => mapContainer);

    this.el = el;
    return el;
  }

  remove() {
    if (!this.el) return;
    // 다시 띄울 때 같은 자리에 오도록 위치를 기억한다
    if (this.el.style.left) {
      this.position = { left: this.el.style.left, top: this.el.style.top };
    }
    this.el.remove();
    this.el = null;
  }

  /** 피처가 속한 레이어 찾기 (SelectTool 과 같은 방식) */
  findLayer(feature) {
    const layers = layerManager.getAllLayers();
    for (const layerInfo of layers) {
      if (!layerInfo || !layerInfo.source || typeof layerInfo.source.hasFeature !== 'function') continue;
      if (layerInfo.source.hasFeature(feature)) {
        return { id: layerInfo.id, name: layerInfo.name };
      }
    }
    return null;
  }
}

export const featureInfoCard = new FeatureInfoCard();
```

- [ ] **Step 2: 빌드가 깨지지 않는지 확인한다**

Run: `npm run build`

Expected: `✓ built in ...` (오류 없음)

- [ ] **Step 3: 커밋**

```bash
git add src/ui/FeatureInfoCard.js
git commit -m "feat: 선택 피처 속성 카드 컴포넌트"
```

---

### Task 4: 툴바 버튼과 배선

**Files:**
- Modify: `src/ui/layout/AppLayout.js` — 선택 그룹, `data-tool="select"` 버튼 바로 뒤
- Modify: `src/main.js` — import 추가 · 선택 액션 배선부

- [ ] **Step 1: 툴바에 버튼을 넣는다**

`data-tool="select"` 버튼의 닫는 `</button>` 바로 다음 줄:

```html
          <button class="btn-icon" id="btn-feature-info" title="선택한 피처 속성 보기" style="display:none">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="16" x2="12" y2="12"></line>
              <line x1="12" y1="8" x2="12.01" y2="8"></line>
            </svg>
          </button>
```

- [ ] **Step 2: main.js 에 import 를 추가한다**

`import { selectTool } from './tools/SelectTool.js';` 다음 줄:

```js
import { featureInfoCard } from './ui/FeatureInfoCard.js';
```

- [ ] **Step 3: 버튼을 배선한다**

`// 피처 합치기` 주석 블록 바로 앞에 넣는다:

```js
  // 속성정보 보기 — 선택 도구가 켜져 있는 동안에만 나타나는 토글
  const btnFeatureInfo = document.getElementById('btn-feature-info');
  if (btnFeatureInfo) {
    const syncFeatureInfoBtn = () => {
      btnFeatureInfo.classList.toggle('active', featureInfoCard.isEnabled());
    };
    featureInfoCard.onChange = syncFeatureInfoBtn;

    btnFeatureInfo.addEventListener('click', () => {
      featureInfoCard.setEnabled(!featureInfoCard.isEnabled());
    });

    const hideFeatureInfo = () => {
      btnFeatureInfo.style.display = 'none';
      featureInfoCard.setEnabled(false);
    };

    eventBus.on(Events.TOOL_ACTIVATED, ({ tool }) => {
      if (tool !== 'select') return;
      btnFeatureInfo.style.display = '';
      syncFeatureInfoBtn();
    });

    eventBus.on(Events.TOOL_DEACTIVATED, ({ tool }) => {
      if (tool !== 'select') return;
      hideFeatureInfo();
    });

    eventBus.on(Events.PROJECT_NEW, () => hideFeatureInfo());
  }
```

- [ ] **Step 4: 선택이 바뀔 때 카드를 갱신한다**

바꾸기 전:

```js
  // 선택 개수가 바뀌면 버튼 표시/숨김
  eventBus.on(Events.SELECTION_CHANGED, ({ count }) => {
    const display = count > 0 ? '' : 'none';
    if (btnClearSel) btnClearSel.style.display = display;
    if (btnDeleteSel) btnDeleteSel.style.display = display;
  });
```

바꾼 뒤:

```js
  // 선택 개수가 바뀌면 버튼 표시/숨김 + 속성 카드 갱신
  eventBus.on(Events.SELECTION_CHANGED, ({ count }) => {
    const display = count > 0 ? '' : 'none';
    if (btnClearSel) btnClearSel.style.display = display;
    if (btnDeleteSel) btnDeleteSel.style.display = display;
    featureInfoCard.refresh();
  });
```

- [ ] **Step 5: 전체 테스트와 빌드를 돌린다**

Run: `npm test`

Expected: 385 tests passed (기존 374 + 신규 11)

Run: `npm run build`

Expected: `✓ built in ...`

- [ ] **Step 6: 커밋**

```bash
git add src/ui/layout/AppLayout.js src/main.js
git commit -m "feat: 속성정보 보기 버튼과 카드 배선"
```

---

### Task 5: 브라우저 확인

**Files:** 없음 (검증만)

- [ ] **Step 1: 개발 서버를 띄운다**

Run: `npm run dev -- --port 3001 --strictPort`

Expected: `Local: http://localhost:3001/`

- [ ] **Step 2: 헤드리스 Chrome 으로 버튼 표시 규칙을 확인한다**

프로젝트 루트에 임시 확인 페이지를 만들어 iframe 으로 앱을 띄우고, 선택 도구를 켰다 껐다 하며 `#btn-feature-info` 의 표시 상태를 읽는다. 확인이 끝나면 그 파일은 지운다.

| 상태 | `#btn-feature-info` |
|---|---|
| 처음 | 숨김 |
| 선택 도구 켬 | 보임 |
| 선택 도구 끔 | 숨김 |

- [ ] **Step 3: 실제 데이터로 눈으로 확인한다 (사용자)**

데이터를 불러온 뒤:

1. 선택 도구를 켜면 오른쪽에 ⓘ 버튼이 나타난다
2. ⓘ 를 켜고 피처를 클릭하면 좌측 상단에 카드가 뜬다
3. Shift+클릭으로 여러 개 고르면 섹션이 쌓인다
4. 섹션 제목을 누르면 접히고, 선택을 바꿔도 접힌 상태가 남는다
5. 카드를 드래그해 옮긴 뒤 선택을 바꿔도 자리가 유지된다
6. ⓘ 를 끄거나 선택 도구를 끄면 카드가 사라진다

- [ ] **Step 4: 개발 서버를 정리한다**

3001 포트를 쓰는 node 프로세스를 종료하고 포트가 닫혔는지 확인한다.
