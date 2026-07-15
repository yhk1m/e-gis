# 단계구분도·카토그램 테두리 색 제어 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 단계구분도와 카토그램에서 테두리 색을 사용자가 정할 수 있게 한다. "테두리를 분류색에 동기화" 체크박스를 두고, 해제하면 단일 색을 쓴다.

**Architecture:** `layerInfo.strokeSyncToFill` 플래그를 추가하고 `updateLayerStyle`의 단계구분도 분기를 조건부로 바꾼다. 카토그램은 `updateLayerStyle` 분기가 아예 없어 편집 시 분류색이 파괴되므로 분기를 신설한다 — 이게 버그 수정을 겸한다. 순환 import를 피하려고 기존 `cfg.tool` 관례를 카토그램에 확장한다.

**Tech Stack:** Vanilla JS (ES modules), OpenLayers 9, vitest + jsdom

**설계 문서:** `docs/superpowers/specs/2026-07-15-stroke-sync-design.md`

---

## 배경: 왜 카토그램이 특별한가

카토그램 레이어의 `type`은 `'cartogram'`이 아니라 **`'vector'`**다(`CartogramTool.js:205`).
코드베이스는 `_cartogramConfig` 존재 여부로 카토그램을 식별한다.

결과적으로 `setLayerColor`의 `type === 'choropleth'` 가드를 통과하고,
`updateLayerStyle`에는 카토그램 분기가 없어 일반 경로로 떨어져
**분류색 스타일 함수를 단색 Style로 덮어쓴다.** 프로브 실측:

```
applyCartogramStyle 직후 스타일: function   (속성값 기반 분류색)
setLayerColor 후    스타일: object     (단색 — 분류색 파괴)
```

## 파일 구조

| 파일 | 변경 |
|------|------|
| `src/core/LayerManager.js` | `STYLE_FIELDS` export, `strokeSyncToFill` 기본값, `isClassified` 헬퍼, 가드 2개, 단계구분도 분기 수정, 카토그램 분기 신설 |
| `src/core/ProjectManager.js` | `STYLE_FIELDS` import, `strokeSyncToFill` 직렬화 1줄 |
| `src/core/AutoSaveManager.js` | `STYLE_FIELDS` import |
| `src/core/StateManager.js` | `strokeSyncToFill` 직렬화 1줄 |
| `src/tools/CartogramTool.js` | `cartogramStyle(config, styleOpts)`, `applyCartogramStyle` 위임, 생성 3곳 헬퍼 |
| `src/ui/panels/LayerPanel.js` | 체크박스 추가, 면 색상 숨김, 선 색상 비활성 연동 |
| `src/core/LayerManager.stroke.test.js` (신규) | 스타일 계산 테스트 |
| `src/core/AutoSaveManager.restore.test.js` | 왕복 테스트 1개 추가 |

---

### Task 1: `STYLE_FIELDS` 상수 추출 (동작 변화 없음)

같은 7개 필드 배열이 3곳에 복제돼 있다. Task 2에서 여기에 필드를 추가하는데,
한 곳만 빠뜨리면 "복원하면 체크가 풀리는" 버그가 조용히 생긴다. 먼저 통일한다.

**이 태스크는 순수 리팩터링이다. 동작이 바뀌면 안 된다.**

**Files:**
- Modify: `src/core/LayerManager.js`
- Modify: `src/core/ProjectManager.js:290`
- Modify: `src/core/AutoSaveManager.js:271`

- [ ] **Step 1: `LayerManager.js`에 상수 추가**

`src/core/LayerManager.js`의 `COLOR_PALETTE` 상수 **바로 위**에 추가한다
(현재 `COLOR_PALETTE`는 import 블록 다음, 11행부터 시작):

```js
/**
 * 레이어별 스타일 메타데이터 필드.
 *
 * 복제·복원 경로가 공유한다. 여기 빠뜨린 필드는 프로젝트를 다시 열면 조용히
 * 기본값으로 돌아간다. 새 스타일 필드를 추가하면 반드시 여기에도 넣을 것.
 * (직렬화 쪽은 배열이 아니라 개별 속성 나열이므로 StateManager.saveLayer와
 *  ProjectManager의 저장 코드도 함께 고쳐야 한다.)
 */
export const STYLE_FIELDS = [
  'strokeColor', 'fillColor', 'fillOpacity', 'strokeOpacity',
  'strokeWidth', 'strokeDash', 'pointRadius'
];
```

- [ ] **Step 2: `duplicateLayer`에서 사용**

`src/core/LayerManager.js:457`의 이 줄을 삭제한다:

```js
      const styleFields = ['strokeColor', 'fillColor', 'fillOpacity', 'strokeOpacity', 'strokeWidth', 'strokeDash', 'pointRadius'];
```

그리고 바로 아래 두 줄에서 `styleFields`를 `STYLE_FIELDS`로 바꾼다:

```js
      const customized = STYLE_FIELDS.some((k) => info[k] !== undefined && info[k] !== copy[k]);
      STYLE_FIELDS.forEach((k) => { if (info[k] !== undefined) copy[k] = info[k]; });
```

- [ ] **Step 3: `ProjectManager.js`에서 사용**

`src/core/ProjectManager.js:5`의 이 줄을:

```js
import { layerManager } from './LayerManager.js';
```

이렇게 바꾼다:

```js
import { layerManager, STYLE_FIELDS } from './LayerManager.js';
```

`ProjectManager.js:290`의 이 줄을 삭제한다:

```js
        const styleFields = ['strokeColor', 'fillColor', 'fillOpacity', 'strokeOpacity', 'strokeWidth', 'strokeDash', 'pointRadius'];
```

아래 두 줄의 `styleFields`를 `STYLE_FIELDS`로 바꾼다:

```js
          const customized = STYLE_FIELDS.some(k => layerData[k] !== undefined && layerData[k] !== layerInfo[k]);
          STYLE_FIELDS.forEach(k => { if (layerData[k] !== undefined) layerInfo[k] = layerData[k]; });
```

- [ ] **Step 4: `AutoSaveManager.js`에서 사용**

`src/core/AutoSaveManager.js:6`의 이 줄을:

```js
import { layerManager } from './LayerManager.js';
```

이렇게 바꾼다:

```js
import { layerManager, STYLE_FIELDS } from './LayerManager.js';
```

`AutoSaveManager.js:271`의 이 줄을 삭제한다:

```js
    const styleFields = ['strokeColor', 'fillColor', 'fillOpacity', 'strokeOpacity', 'strokeWidth', 'strokeDash', 'pointRadius'];
```

아래 두 줄의 `styleFields`를 `STYLE_FIELDS`로 바꾼다:

```js
      const customized = STYLE_FIELDS.some(k => layerData[k] !== undefined && layerData[k] !== restoredLayer[k]);
      STYLE_FIELDS.forEach(k => { if (layerData[k] !== undefined) restoredLayer[k] = layerData[k]; });
```

- [ ] **Step 5: 기존 테스트가 그대로 통과하는지 확인**

Run: `npm test`

Expected: PASS — 19개 그대로. 동작이 바뀌지 않는 리팩터링이므로 숫자가 같아야 한다.

- [ ] **Step 6: import 해석 확인**

Run: `npx esbuild src/main.js --bundle --format=esm --platform=browser --external:fs --external:path --external:crypto --outfile=/dev/null`

Expected: exit 0. `nul.css` 파일이 생기면 지운다 (`rm -f nul.css`).

**`npm run build`를 돌리지 말 것** — 이 PC의 한글 경로에서 rollup 네이티브가 크래시한다.
`scripts/build.cjs`가 우회하지만 느리므로 이 태스크엔 불필요하다.

- [ ] **Step 7: 커밋**

```bash
git add src/core/LayerManager.js src/core/ProjectManager.js src/core/AutoSaveManager.js
git commit -m "refactor: 스타일 필드 목록을 STYLE_FIELDS 상수로 통일

같은 7개 배열이 duplicateLayer·ProjectManager·AutoSaveManager 세 곳에
복제돼 있었다. 새 필드 추가 시 한 곳만 빠뜨리면 복원할 때 조용히
기본값으로 돌아가는 버그가 된다."
```

---

### Task 2: `strokeSyncToFill` 필드와 저장·복원

**Files:**
- Modify: `src/core/LayerManager.js`
- Modify: `src/core/StateManager.js`
- Modify: `src/core/ProjectManager.js`
- Test: `src/core/AutoSaveManager.restore.test.js`

- [ ] **Step 1: 실패하는 테스트 작성**

`src/core/AutoSaveManager.restore.test.js`의 `serializeLike` 함수에 필드를 추가한다.
현재 함수 안 `pointRadius: layerInfo.pointRadius,` 줄 바로 아래에 넣는다:

```js
    strokeSyncToFill: layerInfo.strokeSyncToFill,
```

그리고 파일 맨 끝 `});` 앞(마지막 `it` 블록 뒤)에 테스트를 추가한다:

```js
  it('strokeSyncToFill이 복원 후에도 유지된다', async () => {
    const originalId = layerManager.addLayer({
      name: '동기화 해제 레이어',
      features: [new Feature({ geometry: new Point([0, 0]) })],
      color: COLOR
    });
    const original = layerManager.getLayer(originalId);

    // 기본값은 true여야 한다
    expect(original.strokeSyncToFill).toBe(true);

    // 사용자가 동기화를 끈다
    original.strokeSyncToFill = false;

    const restoredId = await autoSaveManager.restoreLayer(serializeLike(original));
    expect(layerManager.getLayer(restoredId).strokeSyncToFill).toBe(false);
  });
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

Run: `npm test`

Expected: FAIL — `expected undefined to be true` (`addLayer`가 아직 이 필드를 안 만든다)

- [ ] **Step 3: `addLayer` 기본값 추가**

`src/core/LayerManager.js`의 `layerInfo` 객체 리터럴(현재 161-178행)에서
`strokeDash: "solid",` 줄 **바로 아래**에 추가한다:

```js
      strokeSyncToFill: true,
```

- [ ] **Step 4: `STYLE_FIELDS`에 추가**

Task 1에서 만든 상수에 필드를 넣는다:

```js
export const STYLE_FIELDS = [
  'strokeColor', 'fillColor', 'fillOpacity', 'strokeOpacity',
  'strokeWidth', 'strokeDash', 'pointRadius', 'strokeSyncToFill'
];
```

- [ ] **Step 5: 자동저장 직렬화에 추가**

`src/core/StateManager.js`의 `saveLayer` 안 `layerData` 객체에서
`pointRadius: layerInfo.pointRadius,` 줄 바로 아래에 추가한다:

```js
          strokeSyncToFill: layerInfo.strokeSyncToFill,
```

- [ ] **Step 6: .egis 직렬화에 추가**

`src/core/ProjectManager.js`에서 `pointRadius: layer.pointRadius` 줄
(현재 121행, 세부 스타일 블록의 마지막)을 이렇게 바꾼다:

```js
          pointRadius: layer.pointRadius,
          strokeSyncToFill: layer.strokeSyncToFill
```

- [ ] **Step 7: 테스트 통과 확인**

Run: `npm test`

Expected: PASS — 20개 (기존 19 + 새 1개)

- [ ] **Step 8: 커밋**

```bash
git add src/core/LayerManager.js src/core/StateManager.js src/core/ProjectManager.js src/core/AutoSaveManager.restore.test.js
git commit -m "feat: strokeSyncToFill 필드 추가 (기본 true)

단계구분도·카토그램의 테두리를 분류색에 동기화할지 여부.
저장 2곳(StateManager·ProjectManager)과 복원 3곳(STYLE_FIELDS 공유)에 반영."
```

---

### Task 3: `isClassified` 헬퍼와 가드 수정

**Files:**
- Modify: `src/core/LayerManager.js`
- Test: `src/core/LayerManager.stroke.test.js` (신규)

- [ ] **Step 1: 실패하는 테스트 작성**

`src/core/LayerManager.stroke.test.js` 생성:

```js
// @vitest-environment jsdom
/**
 * 분류 레이어(단계구분도·카토그램)의 스타일 가드 검증.
 *
 * 분류색은 분류 설정이 소유한다. 사용자가 바꿀 수 있는 건 투명도와 테두리뿐이다.
 * setLayerColor는 분류 레이어에서 무시되어야 하고(카토그램은 이걸 안 막으면
 * 분류색 스타일 함수가 단색으로 덮여 파괴된다), setLayerStrokeColor는
 * 반대로 단계구분도에서도 동작해야 한다(기존에는 막혀 있었다).
 */
import { describe, it, expect, beforeEach } from 'vitest';
import Feature from 'ol/Feature.js';
import Polygon from 'ol/geom/Polygon.js';
import { layerManager } from './LayerManager.js';

function square(pop) {
  return new Feature({
    geometry: new Polygon([[[0, 0], [100, 0], [100, 100], [0, 100], [0, 0]]]),
    pop
  });
}

describe('isClassified / 스타일 가드', () => {
  beforeEach(() => {
    layerManager.getAllLayers().slice().forEach(l => layerManager.removeLayer(l.id));
  });

  it('일반 벡터 레이어는 분류 레이어가 아니다', () => {
    const id = layerManager.addLayer({ name: '일반', features: [square(1)], color: '#3388ff' });
    expect(layerManager.isClassified(layerManager.getLayer(id))).toBe(false);
  });

  it('_cartogramConfig가 있으면 type이 vector여도 분류 레이어다', () => {
    const id = layerManager.addLayer({
      name: '카토그램', type: 'vector', features: [square(1)], color: '#3388ff'
    });
    const info = layerManager.getLayer(id);
    info._cartogramConfig = { attribute: 'pop', colors: ['#fff', '#000'], breaks: [0, 1, 2] };
    expect(layerManager.isClassified(info)).toBe(true);
  });

  it('setLayerColor는 분류 레이어에서 무시된다', () => {
    const id = layerManager.addLayer({
      name: '카토그램', type: 'vector', features: [square(1)], color: '#3388ff'
    });
    const info = layerManager.getLayer(id);
    info._cartogramConfig = { attribute: 'pop', colors: ['#fff', '#000'], breaks: [0, 1, 2] };

    layerManager.setLayerColor(id, '#ff0000');

    expect(info.color).toBe('#3388ff');
  });

  it('setLayerStrokeColor는 단계구분도에서도 동작한다', () => {
    const id = layerManager.addLayer({
      name: '단계구분도', type: 'choropleth', features: [square(1)], color: '#3388ff'
    });

    layerManager.setLayerStrokeColor(id, '#ff0000');

    expect(layerManager.getLayer(id).strokeColor).toBe('#ff0000');
  });
});
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

Run: `npm test`

Expected: FAIL — `layerManager.isClassified is not a function`

- [ ] **Step 3: `isClassified` 헬퍼 추가**

`src/core/LayerManager.js`의 `getLineDash` 메서드(38-40행) **바로 위**에 추가한다:

```js
  /**
   * 분류 레이어인가 (단계구분도·카토그램).
   *
   * 이런 레이어는 채우기 색을 분류 설정이 소유한다. 사용자는 투명도와 테두리만 바꾼다.
   * 카토그램은 type이 'cartogram'이 아니라 'vector'라(CartogramTool.js:205)
   * type만 봐서는 못 잡는다. 설정 객체의 존재로 식별한다.
   */
  isClassified(layerInfo) {
    if (!layerInfo) return false;
    return layerInfo.type === 'choropleth' || !!layerInfo._cartogramConfig;
  }
```

- [ ] **Step 4: `setLayerColor` 가드 확장**

`src/core/LayerManager.js`의 `setLayerColor`에서 이 줄을:

```js
    // 단계구분도는 색상 변경 무시 (색상은 분류별로 고정)
    if (layerInfo.type === 'choropleth') return;
```

이렇게 바꾼다:

```js
    // 분류 레이어는 채우기 색을 분류 설정이 소유한다 (단계구분도·카토그램).
    // 카토그램에서 이걸 막지 않으면 분류색 스타일 함수가 단색으로 덮여 파괴된다.
    if (this.isClassified(layerInfo)) return;
```

- [ ] **Step 5: `setLayerStrokeColor` 가드 제거**

`src/core/LayerManager.js`의 `setLayerStrokeColor`에서 이 두 줄을 **삭제**한다:

```js
    if (layerInfo.type === 'choropleth') return;
```

(빈 줄도 함께 정리한다. 테두리 색을 바꿀 수 있게 하는 것이 이 작업의 목적이므로
이 가드가 남아 있으면 기능이 성립하지 않는다.)

- [ ] **Step 6: `setLayerFillColor` 가드도 확장**

`src/core/LayerManager.js:516`의 이 줄을:

```js
    if (layerInfo.type === 'choropleth') return;
```

이렇게 바꾼다:

```js
    // 분류 레이어는 채우기 색을 분류 설정이 소유한다 (단계구분도·카토그램).
    if (this.isClassified(layerInfo)) return;
```

`setLayerColor`와 같은 이유다. UI에서 면 색상 섹션을 감추더라도(Task 7)
도구·복원 경로에서 호출될 수 있으므로 가드를 남긴다.

- [ ] **Step 7: 테스트 통과 확인**

Run: `npm test`

Expected: PASS — 24개 (기존 20 + 새 4개)

- [ ] **Step 8: 커밋**

```bash
git add src/core/LayerManager.js src/core/LayerManager.stroke.test.js
git commit -m "fix: 분류 레이어의 채우기 색 가드를 카토그램까지 확장

카토그램은 type이 'vector'라 choropleth 가드를 통과했다. 그 결과
색을 바꾸면 분류색 스타일 함수가 단색 Style로 덮여 파괴됐다.
isClassified 헬퍼로 두 타입을 함께 막는다.

반대로 setLayerStrokeColor의 choropleth 가드는 제거했다.
테두리 색을 바꿀 수 있게 하는 것이 목적이다."
```

---

### Task 4: 단계구분도 렌더링 (동기화 + 선 스타일)

**Files:**
- Modify: `src/core/LayerManager.js:571-599`
- Test: `src/core/LayerManager.stroke.test.js`

- [ ] **Step 1: 실패하는 테스트 작성**

`src/core/LayerManager.stroke.test.js`의 import에 `choroplethTool`을 추가한다:

```js
import { choroplethTool } from '../tools/ChoroplethTool.js';
```

파일 끝에 describe 블록을 추가한다:

```js
/** 단계구분도 설정을 붙인 레이어를 만든다 */
function makeChoropleth() {
  const id = layerManager.addLayer({
    name: '단계구분도',
    type: 'choropleth',
    features: [square(10)],
    color: '#3388ff'
  });
  const info = layerManager.getLayer(id);
  info._choroplethConfig = {
    attribute: 'pop',
    breaks: [0, 50, 100],
    colors: ['#ffffcc', '#800026'],
    tool: choroplethTool
  };
  return { id, info };
}

/** 스타일 함수를 실행해 stroke 정보를 뽑는다 */
function strokeOf(info) {
  const styleFn = info.olLayer.getStyle();
  const style = styleFn(info.source.getFeatures()[0]);
  return {
    color: style.getStroke().getColor(),
    width: style.getStroke().getWidth(),
    lineDash: style.getStroke().getLineDash()
  };
}

describe('단계구분도 테두리', () => {
  beforeEach(() => {
    layerManager.getAllLayers().slice().forEach(l => layerManager.removeLayer(l.id));
  });

  it('기본(동기화 ON)은 분류색을 어둡게 한 색이다', () => {
    const { id, info } = makeChoropleth();
    layerManager.updateLayerStyle(id);

    // pop=10 → breaks [0,50,100]의 첫 구간 → colors[0] = '#ffffcc'
    expect(strokeOf(info).color).toBe(choroplethTool.darkenColor('#ffffcc'));
  });

  it('strokeSyncToFill이 undefined여도 동기화 ON으로 동작한다', () => {
    const { id, info } = makeChoropleth();
    delete info.strokeSyncToFill;
    layerManager.updateLayerStyle(id);

    expect(strokeOf(info).color).toBe(choroplethTool.darkenColor('#ffffcc'));
  });

  it('동기화를 끄면 지정한 단일 색을 쓴다', () => {
    const { id, info } = makeChoropleth();
    info.strokeSyncToFill = false;
    info.strokeColor = '#ff0000';
    layerManager.updateLayerStyle(id);

    expect(strokeOf(info).color).toBe('#ff0000');
  });

  it('선 스타일(dash)이 반영된다', () => {
    const { id, info } = makeChoropleth();
    info.strokeDash = 'dashed';
    layerManager.updateLayerStyle(id);

    expect(strokeOf(info).lineDash).not.toBeNull();
  });
});
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

Run: `npm test`

Expected: FAIL — 동기화 OFF 테스트가 `expected '#d7d7a4' to be '#ff0000'` 같은 형태로,
dash 테스트가 `expected null not to be null`로 실패한다.
(기본 동기화 ON 테스트 2개는 이미 통과할 수 있다 — 현재 동작이 그렇기 때문이다.)

- [ ] **Step 3: 단계구분도 분기 수정**

`src/core/LayerManager.js`의 단계구분도 분기(571-599행) 전체를 아래로 교체한다:

```js
    // 단계구분도: 분류별 색상 유지, 투명도/테두리만 반영
    if (layerInfo.type === 'choropleth' && layerInfo._choroplethConfig) {
      const cfg = layerInfo._choroplethConfig;
      const fillOpacity = layerInfo.fillOpacity !== undefined ? layerInfo.fillOpacity : 0.7;
      const strokeWidth = layerInfo.strokeWidth || 1;
      const lineDash = this.getLineDash(layerInfo.strokeDash || "solid");
      // undefined(기존 레이어·기존 저장본)를 기본 ON으로 흡수한다
      const syncStroke = layerInfo.strokeSyncToFill !== false;
      const strokeColor = layerInfo.strokeColor || '#666';
      const styleFn = function(feature) {
        const val = parseFloat(feature.get(cfg.attribute));
        if (isNaN(val)) {
          return new Style({
            fill: new Fill({ color: 'rgba(128,128,128,' + fillOpacity + ')' }),
            stroke: new Stroke({
              color: syncStroke ? '#666' : strokeColor,
              width: strokeWidth,
              lineDash: lineDash
            })
          });
        }
        const colorIdx = cfg.tool.getColorIndex(val, cfg.breaks);
        const color = cfg.colors[colorIdx] || cfg.colors[0];
        return new Style({
          fill: new Fill({ color: cfg.tool.hexToRgba(color, fillOpacity) }),
          stroke: new Stroke({
            color: syncStroke ? cfg.tool.darkenColor(color) : strokeColor,
            width: strokeWidth,
            lineDash: lineDash
          })
        });
      };
      const olLayer = layerInfo.olLayer;
      if (olLayer && olLayer._hasLabel && olLayer._originalStyle) {
        olLayer._originalStyle = styleFn;
        eventBus.emit('label:refresh', { layerId });
      } else if (olLayer) {
        olLayer.setStyle(styleFn);
      }
      eventBus.emit(Events.LAYER_STYLE_CHANGED, { layerId });
      return;
    }
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npm test`

Expected: PASS — 28개 (기존 24 + 새 4개)

- [ ] **Step 5: 커밋**

```bash
git add src/core/LayerManager.js src/core/LayerManager.stroke.test.js
git commit -m "feat: 단계구분도 테두리 색 동기화 토글 + 선 스타일 반영

strokeSyncToFill이 false면 분류색을 따르지 않고 지정한 단일 색을 쓴다.
undefined는 기본 ON으로 흡수해 기존 레이어의 모습을 유지한다.
선 스타일(dash)은 지금까지 UI에만 있고 반영되지 않는 죽은 컨트롤이었다."
```

---

### Task 5: 카토그램 렌더링 (분기 신설 + 분류 파괴 버그 수정)

**Files:**
- Modify: `src/tools/CartogramTool.js`
- Modify: `src/core/LayerManager.js`
- Test: `src/core/LayerManager.stroke.test.js`

- [ ] **Step 1: 실패하는 테스트 작성**

`src/core/LayerManager.stroke.test.js`의 import에 `cartogramTool`을 추가한다:

```js
import { cartogramTool } from '../tools/CartogramTool.js';
```

파일 끝에 추가한다:

```js
/** 카토그램 설정을 붙인 레이어를 만든다 (CartogramTool이 하는 것과 같은 형태) */
function makeCartogram() {
  const id = layerManager.addLayer({
    name: '카토그램',
    type: 'vector',
    features: [square(10)],
    color: '#3388ff'
  });
  const info = layerManager.getLayer(id);
  info._cartogramConfig = {
    attribute: 'pop',
    colors: ['#ffffcc', '#800026'],
    breaks: [0, 50, 100],
    showLabels: false
  };
  info.fillOpacity = 0.85;
  info.strokeColor = '#333';
  info.strokeWidth = 1;
  cartogramTool.applyCartogramStyle(id);
  return { id, info };
}

describe('카토그램 스타일', () => {
  beforeEach(() => {
    layerManager.getAllLayers().slice().forEach(l => layerManager.removeLayer(l.id));
  });

  it('setLayerColor를 해도 분류색 스타일 함수가 유지된다', () => {
    const { id, info } = makeCartogram();
    expect(typeof info.olLayer.getStyle()).toBe('function');

    layerManager.setLayerColor(id, '#ff0000');

    // 단색 Style 객체로 덮이면 분류가 파괴된 것이다
    expect(typeof info.olLayer.getStyle()).toBe('function');
  });

  it('기본(동기화 ON)은 분류색을 어둡게 한 색이다', () => {
    const { info } = makeCartogram();
    expect(strokeOf(info).color).toBe(choroplethTool.darkenColor('#ffffcc'));
  });

  it('동기화를 끄면 지정한 단일 색을 쓴다', () => {
    const { id, info } = makeCartogram();
    info.strokeSyncToFill = false;
    info.strokeColor = '#00ff00';
    layerManager.updateLayerStyle(id);

    expect(strokeOf(info).color).toBe('#00ff00');
  });

  it('fillOpacity 변경이 반영된다', () => {
    const { id, info } = makeCartogram();
    info.fillOpacity = 0.4;
    layerManager.updateLayerStyle(id);

    const style = info.olLayer.getStyle()(info.source.getFeatures()[0]);
    expect(style.getFill().getColor()).toContain('0.4');
  });
});
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

Run: `npm test`

Expected: FAIL — `setLayerColor를 해도...` 테스트가
`expected 'object' to be 'function'`으로 실패한다. 이것이 보고된 버그다.

- [ ] **Step 3: `cartogramStyle` 시그니처 확장**

`src/tools/CartogramTool.js`의 `cartogramStyle` 메서드 전체를 교체한다:

```js
  /**
   * 카토그램 레이어 스타일 함수 (속성값 기반 — 저장/복원 시에도 색 유지)
   *
   * @param {Object} config - { attribute, colors, breaks, showLabels }
   * @param {Object} [styleOpts] - layerInfo에서 온 사용자 스타일.
   *   { fillOpacity, strokeWidth, strokeColor, syncStroke, lineDash }
   *   생략하면 카토그램 고유 기본값(0.85 / 1 / '#333' / 동기화 ON)을 쓴다.
   */
  cartogramStyle(config, styleOpts = {}) {
    const self = this;
    const { attribute, colors, breaks, showLabels } = config;
    const fillOpacity = styleOpts.fillOpacity !== undefined ? styleOpts.fillOpacity : 0.85;
    const strokeWidth = styleOpts.strokeWidth || 1;
    const strokeColor = styleOpts.strokeColor || '#333';
    const syncStroke = styleOpts.syncStroke !== false;
    const lineDash = styleOpts.lineDash !== undefined ? styleOpts.lineDash : null;

    return function (feature) {
      const val = parseFloat(feature.get(attribute));
      const color = colors[self.cartoColorIndex(val, breaks, colors.length)] || colors[0];
      return new Style({
        fill: new Fill({ color: self.hexToRgba(color, fillOpacity) }),
        stroke: new Stroke({
          color: syncStroke ? choroplethTool.darkenColor(color) : strokeColor,
          width: strokeWidth,
          lineDash: lineDash
        }),
        text: showLabels ? new Text({
          text: String(feature.get('name') || feature.get('NAME') || ''),
          font: 'bold 11px sans-serif',
          fill: new Fill({ color: '#333' }),
          stroke: new Stroke({ color: '#fff', width: 3 }),
          overflow: true
        }) : undefined
      });
    };
  }
```

`darkenColor`는 `ChoroplethTool.js:503`에만 있는데, 이 파일이 이미
`choroplethTool`을 import하고 있으므로(`CartogramTool.js:15`) 그대로 쓴다.

- [ ] **Step 4: `applyCartogramStyle`을 `updateLayerStyle`로 위임**

`src/tools/CartogramTool.js`의 `applyCartogramStyle` 전체를 교체한다:

```js
  /**
   * 저장된 카토그램 스타일 재적용 (복원용)
   *
   * 실제 스타일 계산은 LayerManager.updateLayerStyle의 카토그램 분기가 한다.
   * 여기서는 도구 참조만 심어 준다 — LayerManager는 도구를 import할 수 없으므로
   * (CartogramTool이 layerManager를 import해서 순환이 된다) 설정 객체에
   * 참조를 담아 전달하는 기존 관례를 따른다(_choroplethConfig.tool과 동일).
   */
  applyCartogramStyle(layerId) {
    const layerInfo = layerManager.getLayer(layerId);
    if (!layerInfo || !layerInfo._cartogramConfig || !layerInfo.olLayer) return;
    layerInfo._cartogramConfig.tool = this;
    layerManager.updateLayerStyle(layerId);
  }
```

- [ ] **Step 5: `updateLayerStyle`에 카토그램 분기 신설**

`src/core/LayerManager.js`에서 단계구분도 분기가 끝나는 `}` 바로 다음,
등고선 분기(`if (layerInfo._contourConfig)`) **앞에** 추가한다:

```js
    // 카토그램: 분류색은 설정이 소유. 사용자는 투명도·테두리만 바꾼다.
    // type이 'cartogram'이 아니라 'vector'라(CartogramTool.js:205) 위 분기에 안 걸린다.
    // 설정 존재로 식별한다(_contourConfig와 같은 방식).
    // tool 참조는 CartogramTool.applyCartogramStyle이 심는다 — 순환 import 회피.
    if (layerInfo._cartogramConfig && layerInfo._cartogramConfig.tool) {
      const cfg = layerInfo._cartogramConfig;
      if (layerInfo.olLayer) {
        layerInfo.olLayer.setStyle(cfg.tool.cartogramStyle(cfg, {
          fillOpacity: layerInfo.fillOpacity !== undefined ? layerInfo.fillOpacity : 0.85,
          strokeWidth: layerInfo.strokeWidth || 1,
          strokeColor: layerInfo.strokeColor || '#333',
          syncStroke: layerInfo.strokeSyncToFill !== false,
          lineDash: this.getLineDash(layerInfo.strokeDash || "solid")
        }));
      }
      eventBus.emit(Events.LAYER_STYLE_CHANGED, { layerId });
      return;
    }
```

- [ ] **Step 6: 테스트 통과 확인**

Run: `npm test`

Expected: PASS — 32개 (기존 28 + 새 4개)

- [ ] **Step 7: import 해석 확인**

Run: `npx esbuild src/main.js --bundle --format=esm --platform=browser --external:fs --external:path --external:crypto --outfile=/dev/null`

Expected: exit 0. 순환 import를 만들지 않았는지 확인하는 의미도 있다.
`rm -f nul.css`로 뒷정리한다.

- [ ] **Step 8: 커밋**

```bash
git add src/tools/CartogramTool.js src/core/LayerManager.js src/core/LayerManager.stroke.test.js
git commit -m "fix: 카토그램 편집 시 분류색이 파괴되던 문제 + 테두리 제어

updateLayerStyle에 카토그램 분기가 없어 일반 경로로 떨어지면서
분류색 스타일 함수를 단색 Style로 덮어썼다. type이 'vector'라
choropleth 분기에 걸리지 않는 것이 원인이다.

분기를 신설하고 하드코딩(0.85/#333/1)을 layerInfo에서 읽게 했다.
LayerManager는 도구를 import할 수 없으므로(순환) 기존 cfg.tool
관례를 확장했다."
```

---

### Task 6: 카토그램 생성 시 스타일 메타데이터 심기

지금은 렌더링만 0.85인데 `layerInfo.fillOpacity`는 `addLayer` 기본값 0.3이라
**패널이 거짓말을 한다.** Task 5에서 `layerInfo`를 읽게 됐으므로 이걸 맞춰야 한다.

**Files:**
- Modify: `src/tools/CartogramTool.js`

- [ ] **Step 1: 헬퍼 추가**

`src/tools/CartogramTool.js`의 `applyCartogramStyle` **바로 위**에 추가한다:

```js
  /**
   * 생성된 카토그램 레이어에 설정과 스타일 메타데이터를 심고 스타일을 적용한다.
   *
   * Dorling·NonContiguous·Contiguous 세 생성 경로가 공유한다.
   * fillOpacity 등을 layerInfo에 심어야 레이어 패널의 표시값과 실제 렌더링이 일치하고
   * 저장·복원에도 실린다.
   */
  attachCartogram(layerId, config) {
    const layerInfo = layerManager.getLayer(layerId);
    if (!layerInfo) return;
    layerInfo._cartogramConfig = config;
    layerInfo.fillOpacity = 0.85;
    layerInfo.strokeColor = '#333';   // 동기화를 끄면 쓰일 기본값
    layerInfo.strokeWidth = 1;
    this.applyCartogramStyle(layerId);
  }
```

- [ ] **Step 2: 생성 3곳에서 사용**

`src/tools/CartogramTool.js`의 **211-212행(Dorling)**, **351-352행(NonContiguous)**,
**488-489행(Contiguous)** 이 모두 아래와 같은 두 줄이다:

```js
    const newLayerInfo = layerManager.getLayer(newLayerId);
    if (newLayerInfo) newLayerInfo._cartogramConfig = config;
```

세 곳 모두 이 한 줄로 교체한다:

```js
    this.attachCartogram(newLayerId, config);
```

**주의:** 아래에서 위 순서로 교체하면 줄 번호가 밀리지 않는다 (489 → 352 → 212).
또는 `_cartogramConfig = config` 로 검색해 하나씩 처리한다.

- [ ] **Step 3: 교체가 다 됐는지 확인**

Run: `grep -n "_cartogramConfig = config" src/tools/CartogramTool.js`

Expected: `attachCartogram` 안의 한 줄(`layerInfo._cartogramConfig = config;`)만 남는다.
`if (newLayerInfo) newLayerInfo._cartogramConfig = config;` 형태가 남아 있으면 놓친 것이다.

또한 `newLayerInfo` 변수를 더 이상 쓰지 않게 된 곳이 있으면 함께 지운다.
(생성부에서 `newLayerInfo`를 범례 등 다른 용도로도 쓰고 있으면 남겨 둔다 —
교체 후 해당 함수를 읽고 판단할 것.)

- [ ] **Step 4: 기존 테스트가 통과하는지 확인**

Run: `npm test`

Expected: PASS — 32개 그대로.

- [ ] **Step 5: 커밋**

```bash
git add src/tools/CartogramTool.js
git commit -m "fix: 카토그램 생성 시 스타일 메타데이터를 layerInfo에 심기

렌더링은 0.85인데 layerInfo.fillOpacity는 addLayer 기본값 0.3이라
레이어 패널이 거짓말을 하고 있었다. 생성 3곳이 반복하던 패턴을
attachCartogram 헬퍼로 묶었다."
```

---

### Task 7: LayerPanel UI

**Files:**
- Modify: `src/ui/panels/LayerPanel.js`

- [ ] **Step 1: 폴리곤 섹션을 분류 레이어 기준으로 분기**

`src/ui/panels/LayerPanel.js`의 폴리곤 분기(`else if (isPolygon) {`, 약 627행)에서
**면 색상 섹션**(약 628-634행)을 찾는다:

```js
      // 면 색상
      const fillColorItems = colors.map(function(color) {
        return "<div class=\"color-item" + (color === currentFillColor ? " active" : "") + "\" data-fill-color=\"" + color + "\" style=\"background-color: " + color + "\"></div>";
      }).join("");

      html += "<div class=\"style-section\"><label>면 색상:</label><div class=\"color-picker-grid\">" + fillColorItems + "</div>";
      html += "<div class=\"color-picker-custom\"><input type=\"color\" value=\"" + currentFillColor + "\" class=\"fill-color-input\"></div></div>";
```

이렇게 교체한다:

```js
      // 면 색상 — 분류 레이어(단계구분도·카토그램)는 분류 설정이 색을 소유하므로 감춘다.
      // 단계구분도에서는 원래 눌러도 아무 일이 없었고, 카토그램에서는 분류를 파괴했다.
      const isClassified = layerManager.isClassified(layer);
      if (isClassified) {
        html += "<div class=\"style-section\" style=\"font-size:12px;color:var(--text-secondary,#888)\">면 색상은 분류 설정이 결정합니다.</div>";
      } else {
        const fillColorItems = colors.map(function(color) {
          return "<div class=\"color-item" + (color === currentFillColor ? " active" : "") + "\" data-fill-color=\"" + color + "\" style=\"background-color: " + color + "\"></div>";
        }).join("");

        html += "<div class=\"style-section\"><label>면 색상:</label><div class=\"color-picker-grid\">" + fillColorItems + "</div>";
        html += "<div class=\"color-picker-custom\"><input type=\"color\" value=\"" + currentFillColor + "\" class=\"fill-color-input\"></div></div>";
      }
```

- [ ] **Step 2: 동기화 체크박스 추가**

같은 폴리곤 분기에서 **선 색상 섹션 바로 앞**(약 640행 `// 선 색상` 주석 앞)에 추가한다:

```js
      // 테두리 동기화 — 분류 레이어에만 의미가 있다
      const syncOn = layer.strokeSyncToFill !== false;
      if (isClassified) {
        html += "<div class=\"style-section\"><label class=\"stroke-sync-label\">";
        html += "<input type=\"checkbox\" class=\"stroke-sync-checkbox\"" + (syncOn ? " checked" : "") + "> 테두리를 분류색에 동기화";
        html += "</label></div>";
      }
```

- [ ] **Step 3: 선 색상 섹션을 동기화 상태와 연동**

같은 분기의 선 색상 섹션(약 640-646행)을 찾는다:

```js
      // 선 색상
      const strokeColorItems = colors.map(function(color) {
        return "<div class=\"color-item" + (color === currentStrokeColor ? " active" : "") + "\" data-stroke-color=\"" + color + "\" style=\"background-color: " + color + "\"></div>";
      }).join("");

      html += "<div class=\"style-section\"><label>선 색상:</label><div class=\"color-picker-grid\">" + strokeColorItems + "</div>";
      html += "<div class=\"color-picker-custom\"><input type=\"color\" value=\"" + currentStrokeColor + "\" class=\"stroke-color-input\"></div></div>";
```

이렇게 교체한다:

```js
      // 선 색상 — 분류 레이어에서 동기화가 켜져 있으면 분류색을 따르므로 비활성
      const strokeDisabled = isClassified && syncOn;
      const strokeColorItems = colors.map(function(color) {
        return "<div class=\"color-item" + (color === currentStrokeColor ? " active" : "") + "\" data-stroke-color=\"" + color + "\" style=\"background-color: " + color + "\"></div>";
      }).join("");

      html += "<div class=\"style-section stroke-color-section\"" + (strokeDisabled ? " style=\"opacity:0.4;pointer-events:none\"" : "") + ">";
      html += "<label>선 색상:</label><div class=\"color-picker-grid\">" + strokeColorItems + "</div>";
      html += "<div class=\"color-picker-custom\"><input type=\"color\" value=\"" + currentStrokeColor + "\" class=\"stroke-color-input\"></div></div>";
```

- [ ] **Step 4: 체크박스 이벤트 바인딩**

`src/ui/panels/LayerPanel.js`에서 `var strokeColorInput = picker.querySelector(".stroke-color-input");`
(약 810행)를 찾아 그 **바로 앞**에 추가한다:

```js
    var syncCheckbox = picker.querySelector(".stroke-sync-checkbox");
    if (syncCheckbox) {
      syncCheckbox.addEventListener("change", function(e) {
        var info = layerManager.getLayer(layerId);
        if (!info) return;
        info.strokeSyncToFill = e.target.checked;
        layerManager.updateLayerStyle(layerId);
        // 선 색상 섹션 활성/비활성 갱신
        var section = picker.querySelector(".stroke-color-section");
        if (section) {
          section.style.opacity = e.target.checked ? "0.4" : "";
          section.style.pointerEvents = e.target.checked ? "none" : "";
        }
      });
    }
```

- [ ] **Step 5: 기존 테스트가 통과하는지 확인**

Run: `npm test`

Expected: PASS — 32개 그대로. (`LayerPanel`은 테스트가 없으므로 깨지지만 않으면 된다.)

- [ ] **Step 6: import 해석 확인**

Run: `npx esbuild src/main.js --bundle --format=esm --platform=browser --external:fs --external:path --external:crypto --outfile=/dev/null`

Expected: exit 0. 그 뒤 `rm -f nul.css`.

- [ ] **Step 7: 커밋**

```bash
git add src/ui/panels/LayerPanel.js
git commit -m "feat: 레이어 패널에 테두리 동기화 체크박스

분류 레이어에서 면 색상 섹션을 감추고(분류 설정이 소유) 그 자리에
안내 문구를 둔다. 동기화가 켜져 있으면 선 색상 섹션을 비활성화한다."
```

---

### Task 8: 수동 검증

단위 테스트는 스타일 계산만 덮는다. UI와 실제 지도는 눈으로 봐야 한다.

**Files:** 없음 (검증만)

- [ ] **Step 1: 개발 서버 실행**

Run: `npm run dev`

- [ ] **Step 2: 단계구분도**

폴리곤 레이어(예: 내장 시도 경계)에 속성을 붙여 단계구분도를 만든다.
레이어 패널에서 해당 레이어의 스타일 편집을 연다.

확인:
- **면 색상 섹션이 없고** "면 색상은 분류 설정이 결정합니다" 문구가 보인다
- "테두리를 분류색에 동기화"가 **체크된 상태**이고 선 색상 섹션이 흐리게(비활성) 보인다
- 체크를 풀면 선 색상이 활성화되고, 색을 고르면 **모든 셀의 테두리가 그 색**이 된다
- 다시 체크하면 분류색을 어둡게 한 테두리로 돌아온다
- 선 스타일을 파선으로 바꾸면 **실제로 파선이 된다** (기존에는 안 먹혔다)

- [ ] **Step 3: 카토그램 — 보고된 버그**

카토그램(Dorling)을 만들고 레이어 패널에서 스타일 편집을 연다.

확인:
- 면 색상 섹션이 없다
- **면 불투명도를 바꿔도 분류색이 유지된다** (이게 원래 보고된 "색상 변경하면 단계구분이 풀린다" 버그)
- 동기화를 풀고 선 색상을 바꾸면 테두리만 바뀐다

- [ ] **Step 4: 저장/복원 왕복**

동기화를 끄고 선 색상을 지정한 뒤:
- **새로고침 → 복원하기** → 체크가 풀린 상태와 선 색상이 유지되는지
- 프로젝트를 `.egis`로 저장 → 다시 열기 → 동일하게 유지되는지

- [ ] **Step 5: 일반 레이어에 영향이 없는지**

평범한 폴리곤 레이어의 스타일 편집을 연다.

확인: 면 색상 섹션이 **그대로 있고**, 동기화 체크박스는 **없다**.

- [ ] **Step 6: 레이어 복제**

카토그램 레이어를 복제한다(레이어 패널의 복제 기능).

확인: 복제본도 분류색이 유지된다.
`duplicateLayer:462`가 `{ ...info._cartogramConfig }`로 얕은 복사를 하는데
이 스프레드가 `tool` 참조까지 옮기므로 동작해야 한다. **코드 수정은 필요 없고
확인만 한다.** 복제본이 단색으로 나오면 `tool`이 안 넘어간 것이다.

- [ ] **Step 7: 기존 저장 프로젝트의 카토그램 (알려진 변화)**

이번 변경 **이전에** 저장해 둔 카토그램이 있으면 열어 본다.

Expected: 채우기가 **이전보다 투명하게** 보인다. 하드코딩 0.85를 무시하고
저장된 `fillOpacity`(`addLayer` 기본값 0.3)를 읽기 때문이다. 버그가 아니라
설계 문서 "기존 동작 변화" 2번에 기록된 의도된 결과다. 패널이 줄곧 30%라고
표시해 왔으므로 표시와 실제가 일치하게 된 것이다. 슬라이더로 되돌릴 수 있다.

이 변화가 실제로 거슬리는지 사용자에게 확인한다.

- [ ] **Step 8: 결과 기록**

발견한 문제를 이 파일 아래 "검증 결과" 절에 적는다. 전부 통과하면 통과했다고 적는다.

---

## 검증 결과

(Task 8 수행 후 기록)
