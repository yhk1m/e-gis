# 실험실 1단계 — 구간 채움 편집기(`class-fill`) 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 단계구분도(격자 포함) 범례의 색 칸을 눌러 구간마다 **단색·패턴(사선·점·격자)·이미지·질감** 채움을 고를 수 있게 한다. 지도·범례·PNG 내보내기·저장/복원·복제가 같은 채움을 쓴다. 실험 `class-fill` 이 꺼져 있으면 범례 클릭이 아무 일도 하지 않는다.

**Architecture:** 채움 사양은 `_choroplethConfig.fills[i]` 한 곳(없으면 지금과 같음). 순수 모듈 `classFill.js` 가 "무엇을 그릴지"(`planFill` → ops 목록)를 만들고, 캔버스 모듈 `classFillCanvas.js` 가 그 목록을 타일로 그려 `CanvasPattern` 으로 바꾼다(`fillFor`). `ChoroplethTool.apply` 와 `LayerManager.updateLayerStyle` 에 둘로 갈라진 단계구분도 스타일 함수를 `updateLayerStyle` 한 곳으로 합치고, 그 한 곳이 `cfg.tool.classFillColor(cfg, i, fillOpacity)` 로 채움을 받는다. 팝오버(`ClassFillPopover`)는 `choroplethTool.setClassFill / setClassColor / setAllFills` 만 부른다. 실험 가드는 `src/labs/classFillBinding.js` 하나 — 승격 = 이 바인딩의 `labs.isOn` 검사 삭제.

**Tech Stack:** Vanilla JS(ES modules), OpenLayers 9(`Fill.color` 에 `CanvasPattern`), Canvas 2D, vitest(노드 환경, DOM 테스트만 `@vitest-environment jsdom`), Vite, Electron 하네스(`.claude/skills/verify`).

**Spec:** `docs/superpowers/specs/2026-09-25-labs-design.md` — 「1단계 — 구간 채움 편집기」와 「공통」. 이 계획서와 스펙이 어긋나면 스펙이 맞다.

**스펙 보충(이 계획서에서 정한 것):**
- `image` 사양에 `width`·`height`(재인코딩된 픽셀 크기)를 더한다. 스타일 함수는 동기라 타일 크기를 이미지를 다시 디코딩하지 않고 알아야 한다.
- `fillFor` 는 동기다. 이미지가 아직 디코딩 전이면 기준색 `rgba` 를 돌려주고, 디코딩이 끝나면 `onFillAssetsReady` 구독자(ChoroplethTool)가 그 레이어를 다시 스타일링한다.
- 캔버스 2D 컨텍스트가 없으면(jsdom·비정상 환경) `fillFor` 는 예외 없이 기준색 `rgba` 문자열로 물러선다. 그래서 jsdom 테스트는 "문자열로 물러선다"까지만 검증하고, 실제 패턴은 Task 11 하네스가 본다.
- 사선 각도는 `0·45·90·135` 넷만(타일이 이음매 없이 반복되는 각도).
- 질감 타일은 흰 바탕에 회색 표식을 그린 뒤 기준색을 `multiply` 로 틴트한다(강도 0 → 정확히 기준색). `strength` 는 표식의 진하기.

---

## 실행 방법 (서브에이전트)

- 저장소: `C:/Users/김용현/Desktop/vibecoding/eGIS`. 0단계가 `main` 에 병합된 뒤 브랜치 `labs-class-fill` 을 `main` 에서 딴다 (`git checkout -b labs-class-fill main`).
- **작업(Task)마다 새 서브에이전트**를 띄운다(`superpowers:subagent-driven-development`). 구현자·스펙 검토자·코드 검토자 모두 **Fable 5.1**(세션 모델 그대로, `model` 지정 없이 fork/general-purpose). 한 작업이 끝나면 스펙 준수 검토 → 코드 품질 검토 → 다음 작업.
- 서브에이전트에게 넘길 것: 이 파일의 해당 Task 전체 본문 + 스펙 경로 + "코드는 그대로 쓰되 실제 파일과 줄이 어긋나면 파일을 읽고 맞춘다".
- 커밋은 반드시 파일을 지정해서(`git add <파일들>`), `git add -A` 금지. 작성자는 매번 `git -c user.name=yhk1m -c user.email=83273992+yhk1m@users.noreply.github.com commit …` (Vercel 이 다른 이메일의 커밋을 막는다).
- Write 훅이 새 파일 머리에 `// © 2026 김용현` 을 넣는다. 지우지 않는다. 아래 코드 블록에도 그 줄을 적어 두었으니 중복되면 하나만 남긴다.
- 테스트: `npm test` (vitest run). 빌드: `rm -rf dist && npm run build`. 화면: Task 11 의 Electron 하네스.
- 이모지는 UI 에 넣지 않는다. 아이콘은 선 SVG.
- 끝나면 `superpowers:finishing-a-development-branch` 로 `main` 병합 → `/cpd` 배포.

## 파일 구조

| 파일 | 역할 |
|---|---|
| `src/tools/classFill.js` (새) | 순수. `normalizeFill`·`planFill`·`presetFills`·`mulberry32`·`fillSpecBytes` |
| `src/tools/classFill.test.js` (새) | 사양 정규화·그리기 계획·프리셋 |
| `src/tools/classFillCanvas.js` (새) | 캔버스. `renderFillCanvas`·`fillFor`·`tileDataUrl`·`loadImage`·`onFillAssetsReady`·`reencodeImageFile` |
| `src/tools/classFillCanvas.test.js` (새) | 가짜 캔버스로 ops → 호출 검증, 컨텍스트 없을 때 물러섬 |
| `src/tools/choroplethConfigSerial.js` (새) | 순수. `serializeChoroplethConfig`·`cloneChoroplethConfig` (StateManager·ProjectManager·복제가 공유) |
| `src/tools/choroplethConfigSerial.test.js` (새) | 직렬화 왕복·깊은 복사 |
| `src/tools/ChoroplethTool.js` (수정) | `apply` 는 설정만 심고 `updateLayerStyle` 호출, `classFillColor`, 범례 칸 `data-class`·타일, `setClassFill`·`setClassColor`·`setAllFills`·`refreshLegendItems`, `onLegendColorClick` 훅 |
| `src/tools/ChoroplethTool.legend.test.js` (새) | jsdom: 범례 칸·편집 API·클릭 훅 |
| `src/core/LayerManager.js` (수정) | 스타일 함수의 채움을 `cfg.tool.classFillColor` 에서, 복제 시 `fills` 깊은 복사 |
| `src/core/LayerManager.classFill.test.js` (새) | jsdom: 채움 없으면 예전과 같은 `rgba`, `apply` 결과 두께 1·투명도 0.7 |
| `src/core/StateManager.js` (수정) | `choroplethConfig` 직렬화를 `serializeChoroplethConfig` 로 |
| `src/core/ProjectManager.js` (수정) | 같음 |
| `src/tools/legendModel.js` (수정) | `makeSymbol` 에 `fill` |
| `src/tools/legendModel.test.js` (수정) | `fill` 검증 추가 |
| `src/tools/ExportTool.js` (수정) | `drawLegendSymbol` 이 `fill` 있으면 패턴으로 칠함 |
| `src/ui/panels/ClassFillPopover.js` (새) | 팝오버 UI |
| `src/ui/panels/ClassFillPopover.test.js` (새) | jsdom: 탭·입력 → 도구 호출, 프리셋·되돌리기·닫기 |
| `src/styles/classFill.css` (새) | 범례 칸 호버·팝오버 스타일 |
| `src/styles/main.css` (수정) | `@import './classFill.css'` |
| `src/labs/classFillBinding.js` (새) | 실험 가드: `#map.labs-class-fill` 클래스, `onLegendColorClick` 연결 |
| `src/labs/classFillBinding.test.js` (새) | 켜고 끄기 |
| `src/labs/registry.js` (수정) | `class-fill` 항목 |
| `src/main.js` (수정) | 바인딩 호출, `__egisDebug` 에 `choroplethTool`·`builtinDataManager`·`classFillPopover` |
| `docs/사용설명서.md` (수정) | 1-14 실험실 절에 「구간 채움 편집」 문단 |
| `scripts/verify/labs-class-fill.cjs` (새) | Electron 하네스 |

## 고정 규약 (2·4단계가 그대로 쓴다)

```js
// _choroplethConfig.fills[i]  — 없거나 { kind: 'solid' } 면 colors[i] 단색(지금과 같음)
{ kind: 'solid' }
{ kind: 'hatch', angle: 0|45|90|135, spacing: 4..24, width: 0.5..6, color: '#rrggbb', background: 'class'|'none'|'#rrggbb' }
{ kind: 'dots',  spacing: 4..24, radius: 0.5..6, color, background }
{ kind: 'cross', spacing: 4..24, width: 0.5..6, color, background }
{ kind: 'image', dataUrl: 'data:image/png;base64,…', width, height, scale: 0.25..4, opacity: 0..1 }
{ kind: 'texture', name: 'paper'|'gloss'|'sand'|'forest'|'water', strength: 0..1 }

// src/tools/classFill.js (순수)
planFill(spec, baseColor, fillOpacity = 1, { pixelScale = 1, seed = 7 } = {})
  → { size: [w, h] | 0, background: '#rrggbb' | 'rgba(…)' | null, fallback: 'rgba(…)', ops: [...] }
     ops: { op:'rect', x,y,w,h,color } | { op:'line', x1,y1,x2,y2,color,width } | { op:'circle', x,y,r,color }
          | { op:'path', points:[[x,y]…], color, width } | { op:'image', dataUrl,x,y,w,h,opacity }
          | { op:'tint', color, alpha }  (multiply)  | { op:'alpha', value }  (destination-in — 레이어 투명도)
normalizeFill(spec) → 위 형태로 채움·범위 제한(모르면 { kind:'solid' })
presetFills('bw-hatch'|'dots-density'|'texture-uniform', n) → fills[n] (모르면 null)

// src/tools/classFillCanvas.js (캔버스)
fillFor(spec, baseColor, fillOpacity = 1, pixelScale = 1) → 'rgba(…)' | CanvasPattern
  - 단색이면 문자열. 패턴이면 CanvasPattern 을 메모(키 = JSON([normalizeFill(spec) 의 dataUrl 을 #img<n> 으로 바꾼 것, baseColor, fillOpacity, pixelScale]), 최대 200개, 넘치면 비움).
  - 이미지가 아직 안 읽혔거나 2D 컨텍스트가 없으면 plan.fallback(기준색 rgba) 문자열.
onFillAssetsReady(cb) → 해제 함수. 이미지 디코딩이 끝날 때마다 호출.
renderFillCanvas(plan, { createCanvas, getImage }) → canvas | null
tileDataUrl(spec, baseColor, size = 24) → 'data:image/png;base64,…' | null  (범례 칸)
reencodeImageFile(file, maxSide = 256) → Promise<{ dataUrl, width, height }>

// ChoroplethTool
classFillColor(cfg, classIndex, fillOpacity) → fillFor(cfg.fills?.[classIndex], cfg.colors[classIndex] || cfg.colors[0], fillOpacity, 1)
setClassFill(layerId, classIndex, spec) · setClassColor(layerId, classIndex, hex) · setAllFills(layerId, fills|null) → boolean
onLegendColorClick = ({ layerId, classIndex, anchor }) => void | null   // 바인딩이 심는 훅
```

---

### Task 1: 순수 모듈 `classFill.js` — 사양 정규화·그리기 계획·프리셋

**Files:**
- Create: `src/tools/classFill.js`
- Test: `src/tools/classFill.test.js`

- [ ] **Step 1: 실패하는 테스트 작성**

`src/tools/classFill.test.js`:

```js
// © 2026 김용현
/**
 * 구간 채움 계획(순수). 캔버스 없이 "무엇을 그릴지"만 검증한다.
 * - 정규화: 빠진 값은 기본값, 범위 밖은 잘라내고, 모르는 종류는 단색.
 * - 계획: 단색은 ops 없이 rgba, 패턴은 타일 크기·배경·잉크·마지막 alpha 가 맞다.
 * - 질감: 같은 시드면 같은 ops(지도·범례·내보내기가 같은 무늬).
 * - 프리셋: 구간이 높을수록 촘촘하다.
 */
import { describe, it, expect } from 'vitest';
import {
  normalizeFill, planFill, presetFills, mulberry32, fillSpecBytes, isSolid,
  FILL_KINDS, TEXTURE_NAMES, HATCH_ANGLES, PRESET_NAMES, TEXTURE_TILE
} from './classFill.js';

const PNG = 'data:image/png;base64,iVBORw0KGgo=';

describe('normalizeFill', () => {
  it('없거나 모르는 종류는 단색', () => {
    expect(normalizeFill(undefined)).toEqual({ kind: 'solid' });
    expect(normalizeFill(null)).toEqual({ kind: 'solid' });
    expect(normalizeFill({ kind: 'zebra' })).toEqual({ kind: 'solid' });
    expect(isSolid({ kind: 'solid' })).toBe(true);
    expect(isSolid({ kind: 'hatch' })).toBe(false);
  });

  it('사선은 기본값을 채우고 각도는 넷 중 하나로', () => {
    expect(normalizeFill({ kind: 'hatch' })).toEqual({
      kind: 'hatch', angle: 45, spacing: 8, width: 2, color: '#333333', background: 'class'
    });
    expect(normalizeFill({ kind: 'hatch', angle: 30 }).angle).toBe(45);
    expect(normalizeFill({ kind: 'hatch', angle: 135 }).angle).toBe(135);
    expect(HATCH_ANGLES).toEqual([0, 45, 90, 135]);
  });

  it('범위를 벗어난 값은 잘라낸다', () => {
    const f = normalizeFill({ kind: 'dots', spacing: 99, radius: -1, color: 'red', background: 'blue' });
    expect(f).toEqual({ kind: 'dots', spacing: 24, radius: 0.5, color: '#333333', background: 'class' });
    expect(normalizeFill({ kind: 'cross', background: 'none' }).background).toBe('none');
    expect(normalizeFill({ kind: 'cross', background: '#ff0000' }).background).toBe('#ff0000');
  });

  it('이미지는 dataUrl 이 없으면 단색, 있으면 크기·배율·불투명도를 채운다', () => {
    expect(normalizeFill({ kind: 'image' })).toEqual({ kind: 'solid' });
    expect(normalizeFill({ kind: 'image', dataUrl: 'http://x/y.png' })).toEqual({ kind: 'solid' });
    expect(normalizeFill({ kind: 'image', dataUrl: PNG, width: 64, height: 32 })).toEqual({
      kind: 'image', dataUrl: PNG, width: 64, height: 32, scale: 1, opacity: 1
    });
    expect(normalizeFill({ kind: 'image', dataUrl: PNG, scale: 9 }).scale).toBe(4);
  });

  it('질감은 이름·강도', () => {
    expect(normalizeFill({ kind: 'texture' })).toEqual({ kind: 'texture', name: 'paper', strength: 0.5 });
    expect(normalizeFill({ kind: 'texture', name: 'lava', strength: 3 })).toEqual({ kind: 'texture', name: 'paper', strength: 1 });
    expect(TEXTURE_NAMES).toEqual(['paper', 'gloss', 'sand', 'forest', 'water']);
    expect(FILL_KINDS).toEqual(['solid', 'hatch', 'dots', 'cross', 'image', 'texture']);
  });
});

describe('planFill', () => {
  it('단색은 ops 없이 기준색 rgba', () => {
    const p = planFill({ kind: 'solid' }, '#ff0000', 0.7);
    expect(p).toEqual({ size: 0, background: 'rgba(255, 0, 0, 0.7)', fallback: 'rgba(255, 0, 0, 0.7)', ops: [] });
    expect(planFill(undefined, '#ff0000', 0.7)).toEqual(p);
  });

  it('기준색이 이상하면 회색으로', () => {
    expect(planFill(undefined, 'red', 1).background).toBe('rgba(128, 128, 128, 1)');
  });

  it('점: 타일 = 간격, 가운데 원 하나, 배경은 기준색, 마지막에 alpha', () => {
    const p = planFill({ kind: 'dots', spacing: 10, radius: 2 }, '#112233', 0.5);
    expect(p.size).toEqual([10, 10]);
    expect(p.background).toBe('#112233');
    expect(p.fallback).toBe('rgba(17, 34, 51, 0.5)');
    expect(p.ops).toEqual([
      { op: 'circle', x: 5, y: 5, r: 2, color: '#333333' },
      { op: 'alpha', value: 0.5 }
    ]);
  });

  it('배경 none 은 배경 없음·fallback 은 투명, 직접 색은 그 색', () => {
    expect(planFill({ kind: 'dots', background: 'none' }, '#112233', 1).background).toBeNull();
    expect(planFill({ kind: 'dots', background: 'none' }, '#112233', 1).fallback).toBe('rgba(0, 0, 0, 0)');
    expect(planFill({ kind: 'dots', background: '#ffffff' }, '#112233', 1).background).toBe('#ffffff');
  });

  it('pixelScale 은 간격·굵기·반지름을 같이 키운다', () => {
    const p = planFill({ kind: 'dots', spacing: 8, radius: 1.5 }, '#112233', 1, { pixelScale: 2 });
    expect(p.size).toEqual([16, 16]);
    expect(p.ops[0].r).toBe(3);
  });

  it('격자: 가로·세로 선 하나씩', () => {
    const p = planFill({ kind: 'cross', spacing: 8, width: 1 }, '#112233', 1);
    expect(p.ops.filter((o) => o.op === 'line')).toEqual([
      { op: 'line', x1: 0, y1: 4, x2: 8, y2: 4, color: '#333333', width: 1 },
      { op: 'line', x1: 4, y1: 0, x2: 4, y2: 8, color: '#333333', width: 1 }
    ]);
  });

  it('사선 0·90 은 타일 = 간격에 선 하나, 45·135 는 타일 = 간격×√2 에 선 셋', () => {
    const h0 = planFill({ kind: 'hatch', angle: 0, spacing: 8, width: 2 }, '#112233', 1);
    expect(h0.size).toEqual([8, 8]);
    expect(h0.ops[0]).toEqual({ op: 'line', x1: 0, y1: 4, x2: 8, y2: 4, color: '#333333', width: 2 });
    const h90 = planFill({ kind: 'hatch', angle: 90, spacing: 8, width: 2 }, '#112233', 1);
    expect(h90.ops[0]).toEqual({ op: 'line', x1: 4, y1: 0, x2: 4, y2: 8, color: '#333333', width: 2 });

    const h45 = planFill({ kind: 'hatch', angle: 45, spacing: 8, width: 2 }, '#112233', 1);
    expect(h45.size).toEqual([11, 11]);
    const lines = h45.ops.filter((o) => o.op === 'line');
    expect(lines).toHaveLength(3);
    // x + y = T 가 가운데 선: (0,T)→(T,0) 를 굵기만큼 늘린 것
    expect(lines[1]).toEqual({ op: 'line', x1: -2, y1: 13, x2: 13, y2: -2, color: '#333333', width: 2 });

    const h135 = planFill({ kind: 'hatch', angle: 135, spacing: 8, width: 2 }, '#112233', 1);
    const l135 = h135.ops.filter((o) => o.op === 'line');
    // x - y = 0 이 가운데 선: (0,0)→(T,T)
    expect(l135[1]).toEqual({ op: 'line', x1: -2, y1: -2, x2: 13, y2: 13, color: '#333333', width: 2 });
  });

  it('이미지: 타일 = 크기×배율×pixelScale, 배경 없음, image 뒤 alpha', () => {
    const p = planFill({ kind: 'image', dataUrl: PNG, width: 100, height: 50, scale: 0.5, opacity: 0.8 }, '#112233', 0.6, { pixelScale: 2 });
    expect(p.size).toEqual([100, 50]);
    expect(p.background).toBeNull();
    expect(p.fallback).toBe('rgba(17, 34, 51, 0.6)');
    expect(p.ops).toEqual([
      { op: 'image', dataUrl: PNG, x: 0, y: 0, w: 100, h: 50, opacity: 0.8 },
      { op: 'alpha', value: 0.6 }
    ]);
  });

  it('질감: 흰 바탕 + 표식 + multiply 틴트 + alpha, 같은 시드는 같은 결과', () => {
    const a = planFill({ kind: 'texture', name: 'paper', strength: 0.5 }, '#3366cc', 0.7);
    const b = planFill({ kind: 'texture', name: 'paper', strength: 0.5 }, '#3366cc', 0.7);
    expect(a).toEqual(b);
    expect(a.size).toEqual([TEXTURE_TILE, TEXTURE_TILE]);
    expect(a.background).toBe('#ffffff');
    expect(a.ops.at(-2)).toEqual({ op: 'tint', color: '#3366cc', alpha: 1 });
    expect(a.ops.at(-1)).toEqual({ op: 'alpha', value: 0.7 });
    expect(a.ops.length).toBeGreaterThan(50);

    const c = planFill({ kind: 'texture', name: 'paper', strength: 0.5 }, '#3366cc', 0.7, { seed: 99 });
    expect(c.ops).not.toEqual(a.ops);
  });

  it('질감 다섯 가지가 모두 계획을 내고 강도 0 이면 표식이 보이지 않는다', () => {
    for (const name of TEXTURE_NAMES) {
      const p = planFill({ kind: 'texture', name, strength: 0.5 }, '#3366cc', 1);
      expect(p.ops.length).toBeGreaterThan(2);
      const zero = planFill({ kind: 'texture', name, strength: 0 }, '#3366cc', 1);
      const inks = zero.ops.filter((o) => o.op !== 'tint' && o.op !== 'alpha').map((o) => o.color);
      inks.forEach((c) => expect(c).toMatch(/, 0\)$|, 0\.000\)$/));
    }
  });

  it('광택은 바탕이 회색이고 흰 띠를 그린다', () => {
    const p = planFill({ kind: 'texture', name: 'gloss', strength: 1 }, '#3366cc', 1);
    expect(p.background).toBe('#cfcfcf');
    expect(p.ops.some((o) => o.op === 'line' && o.color.startsWith('rgba(255, 255, 255'))).toBe(true);
  });
});

describe('mulberry32', () => {
  it('같은 시드는 같은 수열, 0 이상 1 미만', () => {
    const a = mulberry32(42); const b = mulberry32(42);
    const xs = Array.from({ length: 5 }, () => a());
    expect(Array.from({ length: 5 }, () => b())).toEqual(xs);
    xs.forEach((x) => { expect(x).toBeGreaterThanOrEqual(0); expect(x).toBeLessThan(1); });
    expect(mulberry32(43)()).not.toBe(xs[0]);
  });
});

describe('presetFills', () => {
  it('bw-hatch 는 높은 구간일수록 간격이 좁고 배경이 없다', () => {
    const fills = presetFills('bw-hatch', 5);
    expect(fills).toHaveLength(5);
    fills.forEach((f) => { expect(f.kind).toBe('hatch'); expect(f.background).toBe('none'); expect(f.color).toBe('#222222'); });
    expect(fills[0].spacing).toBe(20);
    expect(fills[4].spacing).toBe(6);
    expect(fills[2].spacing).toBeLessThan(fills[1].spacing);
  });

  it('dots-density 는 점 간격이 좁아지고 구간 색을 깐다', () => {
    const fills = presetFills('dots-density', 3);
    expect(fills.map((f) => f.kind)).toEqual(['dots', 'dots', 'dots']);
    expect(fills.map((f) => f.spacing)).toEqual([18, 12, 6]);
    expect(fills[0].background).toBe('class');
  });

  it('texture-uniform 은 전부 종이 질감, 구간 하나면 가장 촘촘, 모르는 이름은 null', () => {
    expect(presetFills('texture-uniform', 2)).toEqual([
      { kind: 'texture', name: 'paper', strength: 0.5 },
      { kind: 'texture', name: 'paper', strength: 0.5 }
    ]);
    expect(presetFills('bw-hatch', 1)[0].spacing).toBe(6);
    expect(presetFills('nope', 3)).toBeNull();
    expect(PRESET_NAMES).toEqual(['bw-hatch', 'dots-density', 'texture-uniform']);
  });
});

describe('fillSpecBytes', () => {
  it('이미지만 크기를 세고 나머지는 0', () => {
    expect(fillSpecBytes({ kind: 'hatch' })).toBe(0);
    expect(fillSpecBytes({ kind: 'image', dataUrl: 'data:image/png;base64,' + 'A'.repeat(4000) })).toBe(3000);
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run src/tools/classFill.test.js`
Expected: FAIL — `Failed to resolve import "./classFill.js"`.

- [ ] **Step 3: 구현**

`src/tools/classFill.js`:

```js
// © 2026 김용현
/**
 * 구간 채움(class fill) — 순수 모듈.
 *
 * 단계구분도 구간 하나를 무엇으로 칠할지(_choroplethConfig.fills[i])를 정규화하고,
 * 캔버스 없이 "그리기 명령 목록"(plan)을 만든다. 실제로 그리는 것은
 * classFillCanvas.renderFillCanvas 다 — view3d/mapTexture.planComposition 과 같은 분리라
 * 노드에서 그대로 테스트된다.
 *
 * 질감은 이미지 파일 없이 고정 시드 난수로 만든다. 같은 사양이면 지도·범례·내보내기가
 * 같은 무늬를 낸다. 틴트는 흰 바탕의 회색 표식 위에 기준색을 multiply 로 얹는다 —
 * 강도 0 이면 정확히 기준색이라 범례와 어긋나지 않는다.
 * 설계: docs/superpowers/specs/2026-09-25-labs-design.md 「1단계」
 */
import { hexToRgba } from '../utils/colorRamp.js';

export const FILL_KINDS = ['solid', 'hatch', 'dots', 'cross', 'image', 'texture'];
export const TEXTURE_NAMES = ['paper', 'gloss', 'sand', 'forest', 'water'];
export const HATCH_ANGLES = [0, 45, 90, 135];
export const PRESET_NAMES = ['bw-hatch', 'dots-density', 'texture-uniform'];
/** 질감 타일 한 변(픽셀, pixelScale 1 기준) */
export const TEXTURE_TILE = 64;
/** 이미지 채움 재인코딩 긴 변 */
export const IMAGE_MAX_SIDE = 256;

const DEFAULT_INK = '#333333';

function clamp(value, lo, hi, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(hi, Math.max(lo, n));
}

function isHex(s) {
  return typeof s === 'string' && /^#[0-9a-fA-F]{6}$/.test(s);
}

function normalizeBackground(bg) {
  if (bg === 'none') return 'none';
  if (isHex(bg)) return bg;
  return 'class';
}

export function isSolid(spec) {
  return !spec || spec.kind === 'solid' || !FILL_KINDS.includes(spec.kind);
}

/**
 * 빠진 값을 채우고 범위를 제한한다. 모르는 종류·깨진 이미지는 단색.
 */
export function normalizeFill(spec) {
  if (isSolid(spec)) return { kind: 'solid' };
  const color = isHex(spec.color) ? spec.color : DEFAULT_INK;
  switch (spec.kind) {
    case 'hatch':
      return {
        kind: 'hatch',
        angle: HATCH_ANGLES.includes(Number(spec.angle)) ? Number(spec.angle) : 45,
        spacing: clamp(spec.spacing, 4, 24, 8),
        width: clamp(spec.width, 0.5, 6, 2),
        color,
        background: normalizeBackground(spec.background)
      };
    case 'dots':
      return {
        kind: 'dots',
        spacing: clamp(spec.spacing, 4, 24, 8),
        radius: clamp(spec.radius, 0.5, 6, 1.6),
        color,
        background: normalizeBackground(spec.background)
      };
    case 'cross':
      return {
        kind: 'cross',
        spacing: clamp(spec.spacing, 4, 24, 8),
        width: clamp(spec.width, 0.5, 6, 1.5),
        color,
        background: normalizeBackground(spec.background)
      };
    case 'image':
      if (typeof spec.dataUrl !== 'string' || !spec.dataUrl.startsWith('data:image/')) return { kind: 'solid' };
      return {
        kind: 'image',
        dataUrl: spec.dataUrl,
        width: Math.round(clamp(spec.width, 1, IMAGE_MAX_SIDE, IMAGE_MAX_SIDE)),
        height: Math.round(clamp(spec.height, 1, IMAGE_MAX_SIDE, IMAGE_MAX_SIDE)),
        scale: clamp(spec.scale, 0.25, 4, 1),
        opacity: clamp(spec.opacity, 0, 1, 1)
      };
    case 'texture':
      return {
        kind: 'texture',
        name: TEXTURE_NAMES.includes(spec.name) ? spec.name : 'paper',
        strength: clamp(spec.strength, 0, 1, 0.5)
      };
    default:
      return { kind: 'solid' };
  }
}

/** 고정 시드 난수 (mulberry32). 같은 시드 → 같은 수열. */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 사선 한 묶음 — 타일 T 를 가로지르는 선 셋(양옆 이웃 타일과 이어진다). */
function diagonalLines(T, width, color, angle) {
  const e = width;   // 끝을 굵기만큼 늘려 이음매의 빈 틈을 막는다
  const lines = [];
  for (let k = 0; k <= 2; k++) {
    if (angle === 45) {
      // x + y = kT : (kT - T, T) → (kT, 0)
      lines.push({ op: 'line', x1: k * T - T - e, y1: T + e, x2: k * T + e, y2: -e, color, width });
    } else {
      // x - y = (k-1)T : ((k-1)T, 0) → (kT, T)
      lines.push({ op: 'line', x1: (k - 1) * T - e, y1: -e, x2: k * T + e, y2: T + e, color, width });
    }
  }
  return lines;
}

/**
 * 표식 하나를 타일 가장자리 너머로도 복제해 이음매를 없앤다.
 * @returns {Array<[number, number]>} 그릴 위치들
 */
function wrapped(x, y, r, T) {
  const xs = [x];
  const ys = [y];
  if (x - r < 0) xs.push(x + T);
  if (x + r > T) xs.push(x - T);
  if (y - r < 0) ys.push(y + T);
  if (y + r > T) ys.push(y - T);
  const out = [];
  xs.forEach((px) => ys.forEach((py) => out.push([px, py])));
  return out;
}

/**
 * 질감 표식 목록. 흰 바탕 위의 회색·검정·흰색 표식이며, 뒤에서 기준색으로 틴트된다.
 * strength 는 표식의 진하기(알파). 0 이면 전부 알파 0.
 */
function textureOps(name, strength, T, k, seed) {
  const rnd = mulberry32(seed);
  const ink = (v) => `rgba(0, 0, 0, ${(Math.min(1, v * strength * 2)).toFixed(3)})`;
  const light = (v) => `rgba(255, 255, 255, ${(Math.min(1, v * strength * 2)).toFixed(3)})`;
  const ops = [];

  if (name === 'paper') {
    for (let i = 0; i < 350; i++) {
      ops.push({ op: 'rect', x: Math.floor(rnd() * T), y: Math.floor(rnd() * T), w: k, h: k, color: ink(0.06 + rnd() * 0.1) });
    }
    return ops;
  }

  if (name === 'gloss') {
    // 회색 바탕(planFill 이 정한다) 위에 흰 사선 띠 — 틴트 뒤 기준색이 밝게 스치는 느낌
    const bands = [[0.15, 6], [0.4, 3], [0.7, 8]];
    bands.forEach(([pos, w]) => {
      const c = pos * T * 2;
      for (let j = -1; j <= 1; j++) {
        const off = j * T * 2;
        ops.push({ op: 'line', x1: c + off - T, y1: T, x2: c + off, y2: 0, color: light(0.45), width: w * k });
      }
    });
    return ops;
  }

  if (name === 'sand') {
    for (let i = 0; i < 90; i++) {
      const r = 0.7 * k;
      wrapped(rnd() * T, rnd() * T, r, T).forEach(([x, y]) => ops.push({ op: 'circle', x, y, r, color: ink(0.18) }));
    }
    for (let i = 0; i < 30; i++) {
      const r = 1.4 * k;
      wrapped(rnd() * T, rnd() * T, r, T).forEach(([x, y]) => ops.push({ op: 'circle', x, y, r, color: ink(0.12) }));
    }
    return ops;
  }

  if (name === 'forest') {
    for (let i = 0; i < 14; i++) {
      const r = 3 * k;
      wrapped(rnd() * T, rnd() * T, r * 2, T).forEach(([x, y]) => {
        ops.push({ op: 'circle', x, y, r, color: ink(0.22) });
        ops.push({ op: 'line', x1: x, y1: y + r, x2: x, y2: y + r * 2, color: ink(0.3), width: k });
      });
    }
    return ops;
  }

  // water — 가로 물결 다섯 줄. 주기 = T 라 옆 타일과 이어진다.
  const rows = 5;
  for (let j = 0; j < rows; j++) {
    const y0 = (j + 0.5) * (T / rows);
    const phase = rnd() * Math.PI * 2;
    const points = [];
    for (let s = 0; s <= 16; s++) {
      const x = (s / 16) * T;
      points.push([x, y0 + Math.sin((x / T) * Math.PI * 2 + phase) * 1.5 * k]);
    }
    ops.push({ op: 'path', points, color: ink(0.18), width: k });
  }
  return ops;
}

/**
 * 채움 사양 → 그리기 계획. 캔버스를 쓰지 않는다.
 *
 * @param {Object|undefined} spec   fills[i]
 * @param {string} baseColor        구간 기준색 '#rrggbb' (colors[i])
 * @param {number} fillOpacity      레이어 채움 투명도 0~1
 * @param {{pixelScale?: number, seed?: number}} options  pixelScale 은 내보내기 배율
 * @returns {{size: number[]|0, background: string|null, fallback: string, ops: Object[]}}
 */
export function planFill(spec, baseColor, fillOpacity = 1, { pixelScale = 1, seed = 7 } = {}) {
  const f = normalizeFill(spec);
  const base = isHex(baseColor) ? baseColor : '#808080';
  const alpha = clamp(fillOpacity, 0, 1, 1);
  const k = clamp(pixelScale, 0.25, 8, 1);
  const baseRgba = hexToRgba(base, alpha);
  const alphaOp = { op: 'alpha', value: alpha };

  if (f.kind === 'solid') return { size: 0, background: baseRgba, fallback: baseRgba, ops: [] };

  if (f.kind === 'image') {
    const w = Math.max(1, Math.round(f.width * f.scale * k));
    const h = Math.max(1, Math.round(f.height * f.scale * k));
    return {
      size: [w, h],
      background: null,
      fallback: baseRgba,
      ops: [{ op: 'image', dataUrl: f.dataUrl, x: 0, y: 0, w, h, opacity: f.opacity }, alphaOp]
    };
  }

  if (f.kind === 'texture') {
    const T = Math.round(TEXTURE_TILE * k);
    const background = f.name === 'gloss' ? '#cfcfcf' : '#ffffff';
    return {
      size: [T, T],
      background,
      fallback: baseRgba,
      ops: [...textureOps(f.name, f.strength, T, k, seed), { op: 'tint', color: base, alpha: 1 }, alphaOp]
    };
  }

  // hatch · dots · cross
  const background = f.background === 'none' ? null : (f.background === 'class' ? base : f.background);
  const fallback = background === null ? 'rgba(0, 0, 0, 0)' : hexToRgba(background, alpha);
  const s = f.spacing * k;

  if (f.kind === 'dots') {
    const T = Math.round(s);
    return { size: [T, T], background, fallback, ops: [{ op: 'circle', x: T / 2, y: T / 2, r: f.radius * k, color: f.color }, alphaOp] };
  }

  const width = f.width * k;
  if (f.kind === 'cross') {
    const T = Math.round(s);
    return {
      size: [T, T], background, fallback,
      ops: [
        { op: 'line', x1: 0, y1: T / 2, x2: T, y2: T / 2, color: f.color, width },
        { op: 'line', x1: T / 2, y1: 0, x2: T / 2, y2: T, color: f.color, width },
        alphaOp
      ]
    };
  }

  // hatch
  if (f.angle === 0 || f.angle === 90) {
    const T = Math.round(s);
    const line = f.angle === 0
      ? { op: 'line', x1: 0, y1: T / 2, x2: T, y2: T / 2, color: f.color, width }
      : { op: 'line', x1: T / 2, y1: 0, x2: T / 2, y2: T, color: f.color, width };
    return { size: [T, T], background, fallback, ops: [line, alphaOp] };
  }
  const T = Math.round(s * Math.SQRT2);
  return { size: [T, T], background, fallback, ops: [...diagonalLines(T, width, f.color, f.angle), alphaOp] };
}

/**
 * 모든 구간에 한꺼번에 거는 프리셋. 구간이 높을수록 촘촘하다.
 * @returns {Object[]|null} fills 또는 모르는 이름이면 null
 */
export function presetFills(name, n) {
  const count = Math.max(1, Math.floor(n));
  const t = (i) => (count > 1 ? i / (count - 1) : 1);
  const spacingAt = (i, from, to) => Math.round(from + (to - from) * t(i));
  if (name === 'bw-hatch') {
    return Array.from({ length: count }, (_, i) => ({
      kind: 'hatch', angle: 45, spacing: spacingAt(i, 20, 6), width: 1.5, color: '#222222', background: 'none'
    }));
  }
  if (name === 'dots-density') {
    return Array.from({ length: count }, (_, i) => ({
      kind: 'dots', spacing: spacingAt(i, 18, 6), radius: 1.4, color: '#222222', background: 'class'
    }));
  }
  if (name === 'texture-uniform') {
    return Array.from({ length: count }, () => ({ kind: 'texture', name: 'paper', strength: 0.5 }));
  }
  return null;
}

/** 저장 크기 안내용 — 이미지 dataUrl 의 대략적인 바이트 수(base64 → 3/4). 나머지는 0. */
export function fillSpecBytes(spec) {
  if (!spec || spec.kind !== 'image' || typeof spec.dataUrl !== 'string') return 0;
  const comma = spec.dataUrl.indexOf(',');
  const payload = comma >= 0 ? spec.dataUrl.length - comma - 1 : spec.dataUrl.length;
  return Math.floor(payload * 3 / 4);
}
```

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run src/tools/classFill.test.js`
Expected: PASS (21 tests). 45° 타일 크기는 `Math.round(8 * √2) = 11`. 광택 검사에서 `color.startsWith('rgba(255, 255, 255')` 가 맞는지 확인.

- [ ] **Step 5: 커밋**

```bash
git add src/tools/classFill.js src/tools/classFill.test.js
git -c user.name=yhk1m -c user.email=83273992+yhk1m@users.noreply.github.com commit -m "feat(labs): 구간 채움 계획 모듈 — 사양 정규화·패턴/질감 ops·프리셋"
```

---

### Task 2: 캔버스 모듈 `classFillCanvas.js` — 타일 그리기·`fillFor`·범례 타일·이미지 재인코딩

**Files:**
- Create: `src/tools/classFillCanvas.js`
- Test: `src/tools/classFillCanvas.test.js` (jsdom — `Image`·`document` 가 필요하다)

- [ ] **Step 1: 실패하는 테스트 작성**

`src/tools/classFillCanvas.test.js`:

```js
// @vitest-environment jsdom
// © 2026 김용현
/**
 * 계획(ops) → 캔버스 호출. jsdom 에는 2D 컨텍스트가 없으므로
 * - renderFillCanvas 는 주입한 가짜 캔버스로 "어떤 호출을 하는지"를 검증하고
 * - fillFor 는 컨텍스트가 없을 때 기준색 문자열로 물러서는지를 검증한다.
 * 실제 패턴 픽셀은 Electron 하네스(scripts/verify/labs-class-fill.cjs)가 본다.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderFillCanvas, fillFor, tileDataUrl, onFillAssetsReady, clearFillCache, imageIdOf } from './classFillCanvas.js';
import { planFill } from './classFill.js';

function fakeCanvas(w, h) {
  const calls = [];
  const ctx = new Proxy({}, {
    get(_, prop) {
      if (prop === 'calls') return calls;
      return (...args) => { calls.push([prop, ...args]); };
    },
    set(_, prop, value) { calls.push(['set', prop, value]); return true; }
  });
  return { width: w, height: h, calls, getContext: () => ctx, toDataURL: () => 'data:image/png;base64,FAKE' };
}

beforeEach(() => { clearFillCache(); });

describe('renderFillCanvas', () => {
  it('배경을 깔고 ops 를 순서대로 그리며 마지막 alpha 는 destination-in', () => {
    const plan = planFill({ kind: 'dots', spacing: 10, radius: 2 }, '#112233', 0.5);
    const made = [];
    const canvas = renderFillCanvas(plan, { createCanvas: (w, h) => { const c = fakeCanvas(w, h); made.push(c); return c; } });
    expect(canvas).toBe(made[0]);
    expect(canvas.width).toBe(10);
    const calls = canvas.calls;
    expect(calls).toContainEqual(['set', 'fillStyle', '#112233']);
    expect(calls).toContainEqual(['fillRect', 0, 0, 10, 10]);
    expect(calls).toContainEqual(['arc', 5, 5, 2, 0, Math.PI * 2]);
    const alphaIdx = calls.findIndex((c) => c[0] === 'set' && c[1] === 'globalCompositeOperation' && c[2] === 'destination-in');
    expect(alphaIdx).toBeGreaterThan(0);
    expect(calls.slice(alphaIdx)).toContainEqual(['set', 'fillStyle', 'rgba(0,0,0,0.5)']);
  });

  it('alpha 1 이면 destination-in 을 하지 않는다', () => {
    const plan = planFill({ kind: 'cross' }, '#112233', 1);
    const canvas = renderFillCanvas(plan, { createCanvas: fakeCanvas });
    expect(canvas.calls.some((c) => c[2] === 'destination-in')).toBe(false);
  });

  it('이미지가 아직 없으면 image op 을 건너뛴다', () => {
    const plan = planFill({ kind: 'image', dataUrl: 'data:image/png;base64,AA==', width: 10, height: 10 }, '#112233', 1);
    const canvas = renderFillCanvas(plan, { createCanvas: fakeCanvas, getImage: () => null });
    expect(canvas.calls.some((c) => c[0] === 'drawImage')).toBe(false);
    const img = { naturalWidth: 10 };
    const canvas2 = renderFillCanvas(plan, { createCanvas: fakeCanvas, getImage: () => img });
    expect(canvas2.calls).toContainEqual(['drawImage', img, 0, 0, 10, 10]);
  });

  it('틴트는 multiply 로 타일 전체를 칠한다', () => {
    const plan = planFill({ kind: 'texture', name: 'paper' }, '#3366cc', 1);
    const canvas = renderFillCanvas(plan, { createCanvas: fakeCanvas });
    const i = canvas.calls.findIndex((c) => c[0] === 'set' && c[1] === 'globalCompositeOperation' && c[2] === 'multiply');
    expect(i).toBeGreaterThan(0);
    expect(canvas.calls.slice(i, i + 6)).toContainEqual(['set', 'fillStyle', '#3366cc']);
  });

  it('컨텍스트가 없으면 null', () => {
    const plan = planFill({ kind: 'cross' }, '#112233', 1);
    expect(renderFillCanvas(plan, { createCanvas: () => ({ width: 8, height: 8, getContext: () => null }) })).toBeNull();
  });
});

describe('fillFor', () => {
  beforeEach(() => {
    // jsdom 은 getContext 를 "Not implemented" 로 죽인다 — 조용히 null 로
    HTMLCanvasElement.prototype.getContext = () => null;
  });

  it('단색은 rgba 문자열', () => {
    expect(fillFor(undefined, '#ff0000', 0.7)).toBe('rgba(255, 0, 0, 0.7)');
    expect(fillFor({ kind: 'solid' }, '#ff0000', 0.7)).toBe('rgba(255, 0, 0, 0.7)');
  });

  it('컨텍스트가 없으면 패턴 대신 fallback 문자열, 예외 없음', () => {
    expect(fillFor({ kind: 'hatch' }, '#ff0000', 0.7)).toBe('rgba(255, 0, 0, 0.7)');
    expect(fillFor({ kind: 'hatch', background: 'none' }, '#ff0000', 0.7)).toBe('rgba(0, 0, 0, 0)');
    expect(fillFor({ kind: 'texture' }, '#ff0000', 0.7)).toBe('rgba(255, 0, 0, 0.7)');
  });

  it('이미지는 읽기를 시작하고 그동안 기준색을 준다', () => {
    const src = 'data:image/png;base64,iVBORw0KGgo=';
    const spy = vi.fn();
    const off = onFillAssetsReady(spy);
    expect(fillFor({ kind: 'image', dataUrl: src, width: 4, height: 4 }, '#00ff00', 1)).toBe('rgba(0, 255, 0, 1)');
    expect(imageIdOf(src)).toBe(imageIdOf(src));
    expect(imageIdOf(src)).not.toBe(imageIdOf(src + 'x'));
    off();
  });
});

describe('tileDataUrl', () => {
  it('컨텍스트가 없으면 null', () => {
    HTMLCanvasElement.prototype.getContext = () => null;
    expect(tileDataUrl({ kind: 'hatch' }, '#ff0000')).toBeNull();
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run src/tools/classFillCanvas.test.js`
Expected: FAIL — `Failed to resolve import "./classFillCanvas.js"`.

- [ ] **Step 3: 구현**

`src/tools/classFillCanvas.js`:

```js
// © 2026 김용현
/**
 * 구간 채움 — 캔버스 쪽.
 *
 * classFill.planFill 이 만든 명령 목록을 타일 캔버스에 그리고(renderFillCanvas),
 * 그 타일을 OpenLayers Fill 이 그대로 받는 CanvasPattern 으로 바꾼다(fillFor).
 * 스타일 함수는 피처마다 불리므로 패턴은 사양 키로 메모한다.
 *
 * 이미지 채움은 디코딩이 비동기다. fillFor 는 동기여야 하므로(OL 스타일 함수)
 * 아직 안 읽힌 이미지는 기준색으로 물러서고, 읽히면 onFillAssetsReady 구독자
 * (ChoroplethTool)가 그 레이어를 다시 스타일링한다.
 *
 * 2D 컨텍스트가 없는 환경(jsdom)에서는 예외 없이 기준색 문자열로 물러선다.
 */
import { planFill, normalizeFill, IMAGE_MAX_SIDE } from './classFill.js';

const PATTERN_CACHE_MAX = 200;

/** dataUrl → HTMLImageElement | 'loading' | 'error' */
const imageCache = new Map();
/** dataUrl → 짧은 id (메모 키에 200KB 문자열을 넣지 않기 위해) */
const imageIds = new Map();
const readyListeners = new Set();
let patternCache = new Map();
let scratchCanvas = null;

function defaultCreateCanvas(width, height) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

export function imageIdOf(dataUrl) {
  if (!imageIds.has(dataUrl)) imageIds.set(dataUrl, imageIds.size + 1);
  return imageIds.get(dataUrl);
}

export function getCachedImage(dataUrl) {
  const v = imageCache.get(dataUrl);
  return v && typeof v === 'object' ? v : null;
}

/**
 * 이미지 디코딩이 끝날 때마다 부른다.
 * @returns {() => void} 해제 함수
 */
export function onFillAssetsReady(cb) {
  readyListeners.add(cb);
  return () => readyListeners.delete(cb);
}

/** 테스트·메모리 정리용 */
export function clearFillCache() {
  patternCache = new Map();
}

/**
 * dataUrl 을 한 번만 디코딩한다. 끝나면 패턴 메모를 비우고 구독자에게 알린다.
 * @returns {Promise<HTMLImageElement|null>}
 */
export function loadImage(dataUrl) {
  const cached = imageCache.get(dataUrl);
  if (cached && typeof cached === 'object') return Promise.resolve(cached);
  if (cached === 'error') return Promise.resolve(null);
  if (cached === 'loading') {
    return new Promise((resolve) => {
      const off = onFillAssetsReady(() => { off(); resolve(getCachedImage(dataUrl)); });
    });
  }
  imageCache.set(dataUrl, 'loading');
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      imageCache.set(dataUrl, img);
      clearFillCache();
      readyListeners.forEach((cb) => cb());
      resolve(img);
    };
    img.onerror = () => {
      imageCache.set(dataUrl, 'error');
      readyListeners.forEach((cb) => cb());
      resolve(null);
    };
    img.src = dataUrl;
  });
}

/**
 * 계획을 타일 캔버스에 그린다.
 * @param {ReturnType<typeof planFill>} plan
 * @param {{createCanvas?: Function, getImage?: Function}} deps  테스트 주입용
 * @returns {HTMLCanvasElement|null} 컨텍스트가 없으면 null
 */
export function renderFillCanvas(plan, { createCanvas = defaultCreateCanvas, getImage = getCachedImage } = {}) {
  const [w, h] = Array.isArray(plan.size) ? plan.size : [plan.size || 1, plan.size || 1];
  const canvas = createCanvas(Math.max(1, w), Math.max(1, h));
  const ctx = canvas.getContext && canvas.getContext('2d');
  if (!ctx) return null;

  if (plan.background) {
    ctx.fillStyle = plan.background;
    ctx.fillRect(0, 0, w, h);
  }

  for (const o of plan.ops) {
    ctx.save();
    switch (o.op) {
      case 'rect':
        ctx.fillStyle = o.color;
        ctx.fillRect(o.x, o.y, o.w, o.h);
        break;
      case 'line':
        ctx.strokeStyle = o.color;
        ctx.lineWidth = o.width;
        ctx.lineCap = 'butt';
        ctx.beginPath();
        ctx.moveTo(o.x1, o.y1);
        ctx.lineTo(o.x2, o.y2);
        ctx.stroke();
        break;
      case 'circle':
        ctx.fillStyle = o.color;
        ctx.beginPath();
        ctx.arc(o.x, o.y, o.r, 0, Math.PI * 2);
        ctx.fill();
        break;
      case 'path':
        ctx.strokeStyle = o.color;
        ctx.lineWidth = o.width;
        ctx.lineJoin = 'round';
        ctx.beginPath();
        o.points.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
        ctx.stroke();
        break;
      case 'image': {
        const img = getImage(o.dataUrl);
        if (img) {
          ctx.globalAlpha = o.opacity;
          ctx.drawImage(img, o.x, o.y, o.w, o.h);
        }
        break;
      }
      case 'tint':
        ctx.globalCompositeOperation = 'multiply';
        ctx.globalAlpha = o.alpha;
        ctx.fillStyle = o.color;
        ctx.fillRect(0, 0, w, h);
        break;
      case 'alpha':
        if (o.value < 1) {
          ctx.globalCompositeOperation = 'destination-in';
          ctx.fillStyle = `rgba(0,0,0,${o.value})`;
          ctx.fillRect(0, 0, w, h);
        }
        break;
      default:
        break;
    }
    ctx.restore();
  }
  return canvas;
}

function patternKey(normalized, baseColor, fillOpacity, pixelScale) {
  const keySpec = normalized.kind === 'image'
    ? { ...normalized, dataUrl: `#img${imageIdOf(normalized.dataUrl)}` }
    : normalized;
  return JSON.stringify([keySpec, baseColor, fillOpacity, pixelScale]);
}

function scratchContext() {
  if (!scratchCanvas) scratchCanvas = defaultCreateCanvas(1, 1);
  return scratchCanvas.getContext && scratchCanvas.getContext('2d');
}

/**
 * OpenLayers Fill.color 에 넣을 값.
 * @returns {string|CanvasPattern} 단색·물러섬은 'rgba(…)', 패턴은 CanvasPattern
 */
export function fillFor(spec, baseColor, fillOpacity = 1, pixelScale = 1) {
  const normalized = normalizeFill(spec);
  const plan = planFill(normalized, baseColor, fillOpacity, { pixelScale });
  if (plan.ops.length === 0) return plan.background;

  const key = patternKey(normalized, baseColor, fillOpacity, pixelScale);
  const cached = patternCache.get(key);
  if (cached) return cached;

  if (normalized.kind === 'image' && !getCachedImage(normalized.dataUrl)) {
    loadImage(normalized.dataUrl);   // 끝나면 onFillAssetsReady → 다시 스타일링
    return plan.fallback;
  }

  const ctx = scratchContext();
  if (!ctx) return plan.fallback;
  const tile = renderFillCanvas(plan);
  if (!tile) return plan.fallback;

  const pattern = ctx.createPattern(tile, 'repeat');
  if (!pattern) return plan.fallback;
  if (patternCache.size >= PATTERN_CACHE_MAX) patternCache.clear();
  patternCache.set(key, pattern);
  return pattern;
}

/**
 * 범례 색 칸에 넣을 작은 타일(불투명, 화면 배율 1).
 * @returns {string|null} data URL. 컨텍스트가 없거나 이미지가 아직이면 null.
 */
export function tileDataUrl(spec, baseColor, size = 24) {
  const normalized = normalizeFill(spec);
  if (normalized.kind === 'solid') return null;
  if (normalized.kind === 'image' && !getCachedImage(normalized.dataUrl)) {
    loadImage(normalized.dataUrl);
    return null;
  }
  const tile = renderFillCanvas(planFill(normalized, baseColor, 1, { pixelScale: 1 }));
  if (!tile) return null;
  const out = defaultCreateCanvas(size, size);
  const ctx = out.getContext && out.getContext('2d');
  if (!ctx) return null;
  const pattern = ctx.createPattern(tile, 'repeat');
  if (!pattern) return null;
  ctx.fillStyle = pattern;
  ctx.fillRect(0, 0, size, size);
  return out.toDataURL('image/png');
}

/**
 * 업로드 이미지(PNG·JPG·SVG)를 긴 변 maxSide 픽셀 PNG 로 다시 인코딩한다.
 * .egis 와 IndexedDB 크기를 잡기 위해서다.
 * @returns {Promise<{dataUrl: string, width: number, height: number}>}
 */
export function reencodeImageFile(file, maxSide = IMAGE_MAX_SIDE) {
  return new Promise((resolve, reject) => {
    if (!file || !/^image\//.test(file.type || '')) {
      reject(new Error('이미지 파일이 아닙니다.'));
      return;
    }
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const nw = img.naturalWidth || img.width;
      const nh = img.naturalHeight || img.height;
      if (!(nw > 0) || !(nh > 0)) {
        reject(new Error('이미지 크기를 알 수 없습니다.'));
        return;
      }
      const ratio = Math.min(1, maxSide / Math.max(nw, nh));
      const width = Math.max(1, Math.round(nw * ratio));
      const height = Math.max(1, Math.round(nh * ratio));
      const canvas = defaultCreateCanvas(width, height);
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('캔버스를 쓸 수 없습니다.'));
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);
      try {
        resolve({ dataUrl: canvas.toDataURL('image/png'), width, height });
      } catch (e) {
        reject(new Error('이미지를 변환할 수 없습니다.'));
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('이미지를 읽을 수 없습니다.'));
    };
    img.src = url;
  });
}
```

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run src/tools/classFillCanvas.test.js`
Expected: PASS (9 tests). jsdom 이 `Image` 로드에서 `Not implemented` 를 콘솔에 찍어도 실패는 아니다.

- [ ] **Step 5: 커밋**

```bash
git add src/tools/classFillCanvas.js src/tools/classFillCanvas.test.js
git -c user.name=yhk1m -c user.email=83273992+yhk1m@users.noreply.github.com commit -m "feat(labs): 구간 채움 캔버스 — 타일 렌더·CanvasPattern 메모·범례 타일·이미지 재인코딩"
```

---

### Task 3: 렌더링 경로 통합 — `apply` 는 설정만, 스타일 함수는 `updateLayerStyle` 한 곳

지금 단계구분도 스타일 함수가 `ChoroplethTool.apply`(208~223행)와 `LayerManager.updateLayerStyle`(701~738행) 두 곳에 있다. `apply` 는 테두리 두께 1 로, `updateLayerStyle` 은 `strokeWidthOf(layerInfo, 1)`(addLayer 기본 2)로 그려서 **투명도를 한 번 만지면 테두리가 두꺼워지는** 기존 불일치가 있다. `apply` 가 `strokeWidth = 1` 을 심고 `updateLayerStyle` 을 부르게 하면 처음 모습은 지금과 같고 이후에도 변하지 않는다.

**Files:**
- Modify: `src/tools/ChoroplethTool.js:6-15` (import), `:180-270` (`apply`), `:470-482` 뒤(`classFillColor`)
- Modify: `src/core/LayerManager.js:724` (채움)
- Test: `src/core/LayerManager.classFill.test.js` (jsdom)

- [ ] **Step 1: 실패하는 테스트 작성**

`src/core/LayerManager.classFill.test.js`:

```js
// © 2026 김용현
// @vitest-environment jsdom
/**
 * 단계구분도 채움 경로.
 * - fills 가 없으면 예전과 똑같은 rgba 문자열(동작 불변).
 * - apply() 가 만든 레이어는 두께 1·투명도 0.7 (예전 apply 의 스타일 함수와 같다).
 * - fills 가 있으면 classFillColor 를 거친다 — jsdom 엔 2D 컨텍스트가 없어 기준색 문자열로
 *   물러서지만 예외는 없어야 한다. 실제 패턴은 하네스가 본다.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import Feature from 'ol/Feature.js';
import Polygon from 'ol/geom/Polygon.js';
import { layerManager } from './LayerManager.js';
import { choroplethTool } from '../tools/ChoroplethTool.js';

HTMLCanvasElement.prototype.getContext = () => null;

function square(pop) {
  return new Feature({
    geometry: new Polygon([[[0, 0], [100, 0], [100, 100], [0, 100], [0, 0]]]),
    pop
  });
}

function styleOf(info) {
  const styleFn = info.olLayer.getStyle();
  return styleFn(info.source.getFeatures()[0]);
}

function makeChoropleth(fills) {
  const id = layerManager.addLayer({ name: '단계구분도', type: 'choropleth', features: [square(10)], color: '#3388ff' });
  const info = layerManager.getLayer(id);
  info._choroplethConfig = { attribute: 'pop', breaks: [0, 50, 100], colors: ['#ffffcc', '#800026'], tool: choroplethTool };
  if (fills) info._choroplethConfig.fills = fills;
  info.fillOpacity = 0.7;
  return { id, info };
}

beforeEach(() => {
  layerManager.getAllLayers().slice().forEach((l) => layerManager.removeLayer(l.id));
});

describe('updateLayerStyle 채움', () => {
  it('fills 가 없으면 기준색 rgba 문자열', () => {
    const { id, info } = makeChoropleth();
    layerManager.updateLayerStyle(id);
    expect(styleOf(info).getFill().getColor()).toBe('rgba(255, 255, 204, 0.7)');
  });

  it('fills 가 있으면 classFillColor 를 거치고 컨텍스트가 없으면 문자열로 물러선다', () => {
    const { id, info } = makeChoropleth([{ kind: 'hatch' }, { kind: 'solid' }]);
    const spy = vi.spyOn(choroplethTool, 'classFillColor');
    layerManager.updateLayerStyle(id);
    const color = styleOf(info).getFill().getColor();
    expect(spy).toHaveBeenCalledWith(info._choroplethConfig, 0, 0.7);
    expect(color).toBe('rgba(255, 255, 204, 0.7)');
    spy.mockRestore();
  });

  it('classFillColor 는 구간 밖 인덱스면 첫 색을 쓴다', () => {
    const cfg = { colors: ['#ffffcc', '#800026'] };
    expect(choroplethTool.classFillColor(cfg, 5, 1)).toBe('rgba(255, 255, 204, 1)');
  });
});

describe('ChoroplethTool.apply → updateLayerStyle', () => {
  it('파생 레이어는 두께 1·투명도 0.7 로 그려지고 채움은 rgba 문자열', () => {
    const srcId = layerManager.addLayer({ name: '원본', type: 'vector', features: [square(10), square(90)], color: '#3388ff' });
    const result = choroplethTool.apply(srcId, 'pop', 'blues', 'equalInterval', 2);
    expect(result).toBeTruthy();
    const info = layerManager.getLayer(result.layerId);
    expect(info.fillOpacity).toBe(0.7);
    expect(info.strokeWidth).toBe(1);
    const style = styleOf(info);
    expect(style.getStroke().getWidth()).toBe(1);
    expect(style.getFill().getColor()).toBe(choroplethTool.hexToRgba(result.colors[0], 0.7));
    expect(style.getStroke().getColor()).toBe(choroplethTool.darkenColor(result.colors[0]));
  });

  it('값이 숫자가 아니면 회색', () => {
    const srcId = layerManager.addLayer({ name: '원본', type: 'vector', features: [square('x'), square(90)], color: '#3388ff' });
    const result = choroplethTool.apply(srcId, 'pop', 'blues', 'equalInterval', 2);
    const info = layerManager.getLayer(result.layerId);
    expect(styleOf(info).getFill().getColor()).toBe('rgba(128,128,128,0.7)');
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run src/core/LayerManager.classFill.test.js`
Expected: FAIL — `classFillColor is not a function`, `strokeWidth` 가 2.

- [ ] **Step 3: `ChoroplethTool.js` 수정**

import 묶음(6~15행)에 한 줄:

```js
import { fillFor } from "./classFillCanvas.js";
```

`apply` 에서 208~223행(`const self = this;` 부터 `styleFunction` 끝까지)을 지우고, 236행을 `const newOlLayer = new VectorLayer({ source: newSource });` 로 바꾸고, 251~264행을 다음으로 바꾼다:

```js
    // 단계구분도 설정을 layerInfo에 심는다. 스타일 함수는 LayerManager.updateLayerStyle 한 곳이
    // 만든다(투명도·테두리·구간 채움이 모두 거기서 나온다).
    const newLayerInfo = layerManager.getLayer(newLayerId);
    if (newLayerInfo) {
      newLayerInfo._choroplethConfig = {
        attribute,
        breaks,
        colors: selectedColors,
        tool: this,
        title: `${sourceLayer.name} (${attribute})`,
        unit: '',
        format: 'comma',
        rounding: 0
      };
      newLayerInfo.fillOpacity = 0.7;
      newLayerInfo.strokeWidth = 1;   // 예전 apply 의 스타일 함수와 같은 두께 (addLayer 기본은 2)
      layerManager.updateLayerStyle(newLayerId);
    }
```

`darkenColor` 메서드(477~482행) 바로 뒤에:

```js
  /**
   * 구간 하나의 채움 — LayerManager.updateLayerStyle 이 Fill.color 에 넣는다.
   * fills 가 없으면 지금처럼 rgba 문자열, 있으면 CanvasPattern(실험 class-fill).
   */
  classFillColor(cfg, classIndex, fillOpacity) {
    const base = cfg.colors[classIndex] || cfg.colors[0];
    return fillFor(cfg.fills ? cfg.fills[classIndex] : undefined, base, fillOpacity, 1);
  }
```

- [ ] **Step 4: `LayerManager.js` 수정**

724행 `fill: new Fill({ color: cfg.tool.hexToRgba(color, fillOpacity) }),` 를:

```js
          fill: new Fill({ color: cfg.tool.classFillColor(cfg, colorIdx, fillOpacity) }),
```

- [ ] **Step 5: 통과 확인**

Run: `npx vitest run src/core/LayerManager.classFill.test.js src/core/LayerManager.stroke.test.js`
Expected: 둘 다 PASS. `stroke.test.js` 가 깨지면 `classFillColor` 가 문자열을 돌려주지 않는 것이다.

- [ ] **Step 6: 커밋**

```bash
git add src/tools/ChoroplethTool.js src/core/LayerManager.js src/core/LayerManager.classFill.test.js
git -c user.name=yhk1m -c user.email=83273992+yhk1m@users.noreply.github.com commit -m "refactor(choropleth): 스타일 함수를 updateLayerStyle 한 곳으로, 채움은 classFillColor 에서"
```

---

### Task 4: 직렬화·복원·복제 — `fills` 왕복과 깊은 복사

**Files:**
- Create: `src/tools/choroplethConfigSerial.js`
- Test: `src/tools/choroplethConfigSerial.test.js`
- Modify: `src/core/StateManager.js:170-183`, `src/core/ProjectManager.js:136-142`, `src/core/LayerManager.js:572`

- [ ] **Step 1: 실패하는 테스트 작성**

`src/tools/choroplethConfigSerial.test.js`:

```js
// © 2026 김용현
/**
 * 단계구분도 설정의 저장 모양. 자동 저장(StateManager)·.egis(ProjectManager)·복제가
 * 같은 함수를 쓴다 — 갈라지면 한쪽에서만 fills 가 사라진다.
 * tool 참조는 절대 실리지 않는다(순환·직렬화 불가).
 */
import { describe, it, expect } from 'vitest';
import { serializeChoroplethConfig, cloneChoroplethConfig } from './choroplethConfigSerial.js';

const base = {
  attribute: 'pop', breaks: [0, 50, 100], colors: ['#ffffcc', '#800026'],
  title: '제목', unit: '명', format: 'comma', rounding: 0, controlsHidden: false,
  tool: { name: 'tool' }
};

describe('serializeChoroplethConfig', () => {
  it('null 은 null', () => {
    expect(serializeChoroplethConfig(null)).toBeNull();
  });

  it('tool 을 빼고 필드를 그대로 싣는다, fills 가 없으면 키도 없다', () => {
    const out = serializeChoroplethConfig(base);
    expect(out).toEqual({
      attribute: 'pop', breaks: [0, 50, 100], colors: ['#ffffcc', '#800026'],
      title: '제목', unit: '명', format: 'comma', rounding: 0, controlsHidden: false
    });
    expect('tool' in out).toBe(false);
    expect('fills' in out).toBe(false);
  });

  it('fills 가 있으면 복사해서 싣고, 전부 단색이면 싣지 않는다', () => {
    const fills = [{ kind: 'hatch', spacing: 8 }, { kind: 'solid' }];
    const out = serializeChoroplethConfig({ ...base, fills });
    expect(out.fills).toEqual(fills);
    expect(out.fills).not.toBe(fills);
    expect(out.fills[0]).not.toBe(fills[0]);
    expect('fills' in serializeChoroplethConfig({ ...base, fills: [{ kind: 'solid' }, null] })).toBe(false);
  });

  it('JSON 왕복 뒤에도 같다', () => {
    const out = serializeChoroplethConfig({ ...base, fills: [{ kind: 'dots', spacing: 6 }, { kind: 'solid' }] });
    expect(JSON.parse(JSON.stringify(out))).toEqual(out);
  });
});

describe('cloneChoroplethConfig', () => {
  it('얕은 복사 + fills 깊은 복사, tool 은 같은 참조', () => {
    const fills = [{ kind: 'hatch' }, { kind: 'solid' }];
    const src = { ...base, fills };
    const copy = cloneChoroplethConfig(src);
    expect(copy).not.toBe(src);
    expect(copy.tool).toBe(src.tool);
    expect(copy.fills).toEqual(fills);
    expect(copy.fills).not.toBe(fills);
    expect(copy.fills[0]).not.toBe(fills[0]);
    expect('fills' in cloneChoroplethConfig(base)).toBe(false);
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run src/tools/choroplethConfigSerial.test.js`
Expected: FAIL — `Failed to resolve import "./choroplethConfigSerial.js"`.

- [ ] **Step 3: 구현**

`src/tools/choroplethConfigSerial.js`:

```js
// © 2026 김용현
/**
 * 단계구분도 설정(_choroplethConfig)의 저장·복사 규약.
 *
 * 자동 저장(StateManager.saveLayer)·.egis(ProjectManager.serialize)·레이어 복제
 * (LayerManager.duplicateLayer)가 모두 여기를 거친다. tool 참조는 싣지 않는다.
 * 복원은 `{ ...saved, tool }` 로 펼치므로 여기 실린 키가 그대로 돌아온다.
 */

function hasRealFill(fills) {
  return Array.isArray(fills) && fills.some((f) => f && f.kind && f.kind !== 'solid');
}

/** fills 배열의 깊은 복사. 빈 자리는 단색으로. */
export function cloneFills(fills) {
  return fills.map((f) => (f ? { ...f } : { kind: 'solid' }));
}

/**
 * 저장용 평문 객체. fills 는 실제 채움이 하나라도 있을 때만 싣는다.
 * @returns {Object|null}
 */
export function serializeChoroplethConfig(cfg) {
  if (!cfg) return null;
  const out = {
    attribute: cfg.attribute,
    breaks: cfg.breaks,
    colors: cfg.colors,
    title: cfg.title,
    unit: cfg.unit,
    format: cfg.format,
    rounding: cfg.rounding,
    controlsHidden: cfg.controlsHidden
  };
  if (hasRealFill(cfg.fills)) out.fills = cloneFills(cfg.fills);
  return out;
}

/** 복제용 — 얕은 복사에 fills 만 깊게. tool 은 같은 참조를 둔다. */
export function cloneChoroplethConfig(cfg) {
  const copy = { ...cfg };
  if (Array.isArray(cfg.fills)) copy.fills = cloneFills(cfg.fills);
  return copy;
}
```

- [ ] **Step 4: 세 곳에서 쓰기**

`src/core/StateManager.js` — import 묶음에 `import { serializeChoroplethConfig } from '../tools/choroplethConfigSerial.js';` 를 더하고, 170~183행(`// 단계구분도 설정 직렬화 (tool 참조 제외)` 부터 `}` 까지)을:

```js
    // 단계구분도 설정 직렬화 (tool 참조 제외, fills 포함) — .egis·복제와 같은 규약
    const choroplethConfig = serializeChoroplethConfig(layerInfo._choroplethConfig);
```

`src/core/ProjectManager.js` — import 묶음에 같은 import 를 더하고, 136~142행(`if (layer._choroplethConfig) { … }`)을:

```js
        if (layer._choroplethConfig) {
          base.choroplethConfig = serializeChoroplethConfig(layer._choroplethConfig);
        }
```

`src/core/LayerManager.js` — import 묶음에 `import { cloneChoroplethConfig } from '../tools/choroplethConfigSerial.js';` 를 더하고, 572행을:

```js
      if (info._choroplethConfig) copy._choroplethConfig = cloneChoroplethConfig(info._choroplethConfig);
```

복원 쪽(`ProjectManager.js:310`, `AutoSaveManager.js:310`)은 `{ ...layerData.choroplethConfig, tool }` 로 펼치므로 손대지 않는다 — `fills` 가 그대로 따라온다.

- [ ] **Step 5: 통과 확인**

Run: `npm test`
Expected: 전부 PASS (`AutoSaveManager.restore.test.js` 포함).

- [ ] **Step 6: 커밋**

```bash
git add src/tools/choroplethConfigSerial.js src/tools/choroplethConfigSerial.test.js src/core/StateManager.js src/core/ProjectManager.js src/core/LayerManager.js
git -c user.name=yhk1m -c user.email=83273992+yhk1m@users.noreply.github.com commit -m "feat(choropleth): 설정 직렬화를 한 곳으로 — fills 저장·복원·복제 깊은 복사"
```

---

### Task 5: 내보내기 범례 — `legendModel.makeSymbol` 에 `fill`, `ExportTool.drawLegendSymbol` 패턴

**Files:**
- Modify: `src/tools/legendModel.js:71-88` (`makeSymbol`), `:104-118` (`classifiedItems`)
- Modify: `src/tools/legendModel.test.js` (끝에 describe 추가)
- Modify: `src/tools/ExportTool.js:7-10` (import), `:661-700` (`drawLegendSymbol`)

- [ ] **Step 1: 실패하는 테스트 추가**

`src/tools/legendModel.test.js` 끝에:

```js
describe('buildLegendModel — 구간 채움(fills)', () => {
  it('fills 가 없으면 fill 은 null', () => {
    const model = buildLegendModel(makeLayer({
      type: 'choropleth',
      _choroplethConfig: { attribute: 'pop', breaks: [0, 50, 100], colors: ['#ffffcc', '#800026'] }
    }));
    expect(model.items[0].symbol.fill).toBeNull();
    expect(buildLegendModel(makeLayer()).items[0].symbol.fill).toBeNull();
  });

  it('fills 가 있으면 구간마다 그 사양을 싣는다', () => {
    const fills = [{ kind: 'hatch', spacing: 8 }, { kind: 'solid' }];
    const model = buildLegendModel(makeLayer({
      type: 'choropleth',
      _choroplethConfig: { attribute: 'pop', breaks: [0, 50, 100], colors: ['#ffffcc', '#800026'], fills }
    }));
    expect(model.items[0].symbol.fill).toEqual({ kind: 'hatch', spacing: 8 });
    expect(model.items[0].symbol.fillColor).toBe('#ffffcc');
    expect(model.items[1].symbol.fill).toEqual({ kind: 'solid' });
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run src/tools/legendModel.test.js`
Expected: 새 테스트 2개 FAIL — `expected undefined to be null`.

- [ ] **Step 3: `legendModel.js` 수정**

`makeSymbol` 을 다음으로 바꾼다(71~88행):

```js
/**
 * 레이어 스타일을 기호로 옮긴다.
 *
 * 분류 색(classColor)을 주면 주제도의 구간 기호가 된다. 이때 테두리는 지도와 같은 규칙을
 * 따른다 — 테두리 동기화가 켜져 있으면(기본) 구간 색을 어둡게 한 색, 꺼져 있으면 레이어의
 * 테두리 색. 지도(LayerManager.updateLayerStyle)가 그렇게 그리므로 범례도 같아야 한다.
 *
 * classFill 은 구간 채움 사양(_choroplethConfig.fills[i]). 없으면 null — 단색.
 * ExportTool.drawLegendSymbol 이 fill 이 있으면 같은 타일을 패턴으로 칠한다.
 */
function makeSymbol(layerInfo, classColor, classFill = null) {
  const fillColor = classColor || layerInfo.fillColor || layerInfo.color;
  // undefined(기존 레이어·기존 저장본)를 기본 ON으로 흡수한다 — 지도와 같은 판정
  const syncStroke = layerInfo.strokeSyncToFill !== false;

  return {
    kind: symbolKind(layerInfo.geometryType),
    fillColor,
    fill: classFill || null,
    fillOpacity: layerInfo.fillOpacity,
    strokeColor: classColor && syncStroke
      ? darkenColor(classColor)
      : (layerInfo.strokeColor || layerInfo.color),
    strokeOpacity: layerInfo.strokeOpacity,
    strokeWidth: layerInfo.strokeWidth,
    strokeDash: layerInfo.strokeDash,
    pointRadius: layerInfo.pointRadius
  };
}
```

`classifiedItems` 의 구조 분해와 `makeSymbol` 호출(105행, 113행)을:

```js
  const { breaks, colors = [], fills = null, unit = '', format = 'comma', rounding = 0 } = config;
  …
      symbol: makeSymbol(layerInfo, colors[i], fills ? fills[i] : null)
```

- [ ] **Step 4: `ExportTool.js` 수정**

import 묶음(7~10행) 뒤에:

```js
import { planFill } from './classFill.js';
import { renderFillCanvas } from './classFillCanvas.js';
```

`drawLegendSymbol` 의 구조 분해에 `fill = null,` 을 더하고(`fillColor = '#3b82f6',` 다음 줄), `ctx.fillStyle = this.hexToRgba(fillColor, fillOpacity);` 바로 뒤에:

```js
    // 구간 채움(실험 class-fill): 지도와 같은 타일을 내보내기 배율로 다시 그려 패턴으로 칠한다
    if (fill && fill.kind && fill.kind !== 'solid') {
      const tile = renderFillCanvas(planFill(fill, fillColor, fillOpacity, { pixelScale: scale }));
      const pattern = tile ? ctx.createPattern(tile, 'repeat') : null;
      if (pattern) ctx.fillStyle = pattern;
    }
```

- [ ] **Step 5: 통과 확인·빌드**

Run: `npx vitest run src/tools/legendModel.test.js`
Expected: PASS.

Run: `rm -rf dist && npm run build`
Expected: 성공.

- [ ] **Step 6: 커밋**

```bash
git add src/tools/legendModel.js src/tools/legendModel.test.js src/tools/ExportTool.js
git -c user.name=yhk1m -c user.email=83273992+yhk1m@users.noreply.github.com commit -m "feat(export): 범례 기호에 구간 채움 사양 실어 패턴으로 그림"
```

---

### Task 6: `ChoroplethTool` 범례 칸·편집 API·클릭 훅

**Files:**
- Modify: `src/tools/ChoroplethTool.js` — import(6~15행), 생성자(36~55행), `createLegend` 328행, `renderLegendItems`(341~356행), `attachLegendEditors`(364~436행, `rerenderItems` 404행), 새 메서드
- Test: `src/tools/ChoroplethTool.legend.test.js` (jsdom)

- [ ] **Step 1: 실패하는 테스트 작성**

`src/tools/ChoroplethTool.legend.test.js`:

```js
// © 2026 김용현
// @vitest-environment jsdom
/**
 * 범례 색 칸과 구간 채움 편집 API.
 * - 색 칸마다 data-class 가 붙고, 칸을 누르면 onLegendColorClick 훅이 (layerId, classIndex, anchor) 를 받는다.
 *   훅이 없으면(실험 꺼짐) 아무 일도 없다.
 * - setClassFill / setClassColor / setAllFills 는 설정을 바꾸고 스타일·범례를 다시 그린다.
 * - 전부 단색이 되면 fills 키를 지운다(저장본이 불필요하게 커지지 않게).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import Feature from 'ol/Feature.js';
import Polygon from 'ol/geom/Polygon.js';
import { layerManager } from '../core/LayerManager.js';
import { choroplethTool } from './ChoroplethTool.js';
import { eventBus, Events } from '../utils/EventBus.js';

HTMLCanvasElement.prototype.getContext = () => null;

function square(pop) {
  return new Feature({ geometry: new Polygon([[[0, 0], [100, 0], [100, 100], [0, 100], [0, 0]]]), pop });
}

function makeChoropleth() {
  const id = layerManager.addLayer({ name: '단계구분도', type: 'choropleth', features: [square(10), square(90)], color: '#3388ff' });
  const info = layerManager.getLayer(id);
  info._choroplethConfig = {
    attribute: 'pop', breaks: [0, 50, 100], colors: ['#ffffcc', '#800026'], tool: choroplethTool,
    title: '제목', unit: '', format: 'comma', rounding: 0
  };
  info.fillOpacity = 0.7;
  choroplethTool.createLegend(id, '단계구분도', 'pop', info._choroplethConfig.breaks, info._choroplethConfig.colors);
  return { id, info, legend: document.getElementById(`choropleth-legend-${id}`) };
}

beforeEach(() => {
  layerManager.getAllLayers().slice().forEach((l) => layerManager.removeLayer(l.id));
  document.body.innerHTML = '<div id="map"></div>';
  choroplethTool.onLegendColorClick = null;
});

describe('범례 색 칸', () => {
  it('칸마다 data-class 가 붙고 배경은 구간 색', () => {
    const { legend } = makeChoropleth();
    const swatches = legend.querySelectorAll('.choropleth-legend-color');
    expect(swatches).toHaveLength(2);
    expect(swatches[0].dataset.class).toBe('0');
    expect(swatches[1].dataset.class).toBe('1');
    // jsdom(cssstyle) 은 hex 를 rgb() 로 바꾼다 — 어느 쪽이든 통과
    expect(swatches[1].style.background).toMatch(/#800026|rgb\(128, 0, 38\)/);
  });

  it('칸을 누르면 훅이 불리고, 훅이 없으면 조용하다', () => {
    const { id, legend } = makeChoropleth();
    const sw = legend.querySelectorAll('.choropleth-legend-color')[1];
    expect(() => sw.click()).not.toThrow();
    const hook = vi.fn();
    choroplethTool.onLegendColorClick = hook;
    sw.click();
    expect(hook).toHaveBeenCalledWith({ layerId: id, classIndex: 1, anchor: sw });
  });

  it('범례 항목을 다시 그려도 클릭이 살아 있다(위임)', () => {
    const { id, legend } = makeChoropleth();
    const hook = vi.fn();
    choroplethTool.onLegendColorClick = hook;
    choroplethTool.refreshLegendItems(id);
    legend.querySelectorAll('.choropleth-legend-color')[0].click();
    expect(hook).toHaveBeenCalledWith(expect.objectContaining({ classIndex: 0 }));
  });
});

describe('편집 API', () => {
  it('setClassFill 은 fills 를 만들고 스타일 변경 이벤트를 낸다', () => {
    const { id, info } = makeChoropleth();
    const changed = vi.fn();
    eventBus.on(Events.LAYER_STYLE_CHANGED, changed);
    expect(choroplethTool.setClassFill(id, 1, { kind: 'hatch', spacing: 99 })).toBe(true);
    expect(info._choroplethConfig.fills).toEqual([{ kind: 'solid' }, expect.objectContaining({ kind: 'hatch', spacing: 24 })]);
    expect(changed).toHaveBeenCalledWith(expect.objectContaining({ layerId: id }));
    eventBus.off(Events.LAYER_STYLE_CHANGED, changed);
  });

  it('전부 단색으로 돌아가면 fills 키를 지운다', () => {
    const { id, info } = makeChoropleth();
    choroplethTool.setClassFill(id, 0, { kind: 'dots' });
    choroplethTool.setClassFill(id, 0, { kind: 'solid' });
    expect('fills' in info._choroplethConfig).toBe(false);
  });

  it('구간 밖 인덱스·없는 레이어는 false', () => {
    const { id } = makeChoropleth();
    expect(choroplethTool.setClassFill(id, 2, { kind: 'dots' })).toBe(false);
    expect(choroplethTool.setClassFill('nope', 0, { kind: 'dots' })).toBe(false);
  });

  it('setClassColor 는 colors 를 새 배열로 바꾸고 범례 칸 색도 바뀐다', () => {
    const { id, info, legend } = makeChoropleth();
    const before = info._choroplethConfig.colors;
    expect(choroplethTool.setClassColor(id, 0, '#123456')).toBe(true);
    expect(info._choroplethConfig.colors).not.toBe(before);
    expect(info._choroplethConfig.colors[0]).toBe('#123456');
    expect(legend.querySelectorAll('.choropleth-legend-color')[0].style.background).toMatch(/#123456|rgb\(18, 52, 86\)/);
    expect(choroplethTool.setClassColor(id, 0, 'red')).toBe(false);
  });

  it('setAllFills 는 목록을 정규화해 걸고 null 이면 지운다', () => {
    const { id, info } = makeChoropleth();
    expect(choroplethTool.setAllFills(id, [{ kind: 'hatch' }, { kind: 'cross', width: 100 }])).toBe(true);
    expect(info._choroplethConfig.fills[1].width).toBe(6);
    expect(choroplethTool.setAllFills(id, null)).toBe(true);
    expect('fills' in info._choroplethConfig).toBe(false);
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run src/tools/ChoroplethTool.legend.test.js`
Expected: FAIL — `dataset.class` 가 undefined, `setClassFill is not a function`.

- [ ] **Step 3: 구현**

import 묶음에(Task 3 의 `fillFor` 줄을 고쳐서):

```js
import { fillFor, tileDataUrl, onFillAssetsReady } from "./classFillCanvas.js";
import { normalizeFill, isSolid } from "./classFill.js";
```

생성자(36~55행) 의 `this.sourceByDerived = new Map();` 뒤에:

```js
    /** 범례 색 칸 클릭 훅 — labs/classFillBinding 이 실험이 켜졌을 때 심는다. null 이면 아무 일도 없다. */
    this.onLegendColorClick = null;

    // 이미지 채움 디코딩이 끝나면 그 이미지를 쓰는 레이어를 다시 그린다 (fillFor 는 동기라 기다릴 수 없다)
    onFillAssetsReady(() => {
      layerManager.getAllLayers().forEach((l) => {
        const fills = l._choroplethConfig && l._choroplethConfig.fills;
        if (fills && fills.some((f) => f && f.kind === 'image')) this.restyle(l.id);
      });
    });
```

`createLegend` 328행을:

```js
    this.renderLegendItems(legendEl, breaks, colors, unit, format, rounding, cfg.fills);
```

`renderLegendItems`(341~356행)를:

```js
  renderLegendItems(legendEl, breaks, colors, unit, format, rounding = 0, fills = null) {
    const itemsEl = legendEl.querySelector('.choropleth-legend-items');
    if (!itemsEl) return;
    let html = '';
    for (let i = 0; i < breaks.length - 1; i++) {
      const minVal = formatNumber(breaks[i], format, rounding);
      const maxVal = formatNumber(breaks[i + 1], format, rounding);
      const range = `${minVal} - ${maxVal}`;
      const fill = fills ? fills[i] : null;
      const tile = isSolid(fill) ? null : tileDataUrl(fill, colors[i], 24);
      const style = tile
        ? `background-color:${colors[i]};background-image:url(${tile})`
        : `background:${colors[i]}`;
      html += `
        <div class="choropleth-legend-item">
          <span class="choropleth-legend-color" data-class="${i}" style="${style}"></span>
          <span class="choropleth-legend-label">${range}${unit ? ' ' + this.escapeHtml(unit) : ''}</span>
        </div>`;
    }
    itemsEl.innerHTML = html;
  }
```

`attachLegendEditors` 의 `rerenderItems`(401~405행)를:

```js
    const rerenderItems = () => this.refreshLegendItems(layerId);
```

그리고 같은 메서드의 `persist` 정의 바로 뒤에(371행 앞) 클릭 위임을 넣는다:

```js
    // 색 칸 클릭 → 훅. 항목이 다시 그려져도 살아 있도록 컨테이너에 위임한다.
    const itemsEl = legendEl.querySelector('.choropleth-legend-items');
    if (itemsEl) {
      itemsEl.addEventListener('click', (e) => {
        const swatch = e.target.closest && e.target.closest('.choropleth-legend-color');
        if (!swatch || typeof this.onLegendColorClick !== 'function') return;
        this.onLegendColorClick({ layerId, classIndex: Number(swatch.dataset.class), anchor: swatch });
      });
    }
```

`removeLegend` 앞에 새 메서드들:

```js
  /** 레이어의 단계구분도 설정 (없으면 null) */
  configOf(layerId) {
    const layerInfo = layerManager.getLayer(layerId);
    return (layerInfo && layerInfo._choroplethConfig) || null;
  }

  /** 범례 항목만 설정대로 다시 그린다 */
  refreshLegendItems(layerId) {
    const legendEl = this.legends.get(layerId);
    const cfg = this.configOf(layerId);
    if (!legendEl || !cfg) return;
    this.renderLegendItems(legendEl, cfg.breaks, cfg.colors, cfg.unit || '', cfg.format || 'comma', cfg.rounding || 0, cfg.fills || null);
  }

  /** 스타일 함수 재구성(LAYER_STYLE_CHANGED 발행 포함) + 범례 갱신 */
  restyle(layerId) {
    layerManager.updateLayerStyle(layerId);
    this.refreshLegendItems(layerId);
  }

  /**
   * 구간 하나의 채움 사양을 바꾼다 (실험 class-fill).
   * 전부 단색이면 fills 키를 지워 저장본을 예전 모양으로 되돌린다.
   * @returns {boolean}
   */
  setClassFill(layerId, classIndex, spec) {
    const cfg = this.configOf(layerId);
    if (!cfg || !Number.isInteger(classIndex) || classIndex < 0 || classIndex >= cfg.colors.length) return false;
    const fills = cfg.fills ? cfg.fills.slice() : cfg.colors.map(() => ({ kind: 'solid' }));
    fills[classIndex] = normalizeFill(spec);
    if (fills.every(isSolid)) delete cfg.fills;
    else cfg.fills = fills;
    this.restyle(layerId);
    return true;
  }

  /** 구간 하나의 기준색을 바꾼다. colors 는 새 배열로(복제본과 공유하지 않게). */
  setClassColor(layerId, classIndex, hex) {
    const cfg = this.configOf(layerId);
    if (!cfg || !/^#[0-9a-fA-F]{6}$/.test(String(hex)) || classIndex < 0 || classIndex >= cfg.colors.length) return false;
    const colors = cfg.colors.slice();
    colors[classIndex] = hex.toLowerCase();
    cfg.colors = colors;
    this.restyle(layerId);
    return true;
  }

  /** 모든 구간의 채움을 한꺼번에 (프리셋). null 이면 팔레트로 되돌린다. */
  setAllFills(layerId, fills) {
    const cfg = this.configOf(layerId);
    if (!cfg) return false;
    if (!Array.isArray(fills) || fills.every(isSolid)) delete cfg.fills;
    else cfg.fills = cfg.colors.map((_, i) => normalizeFill(fills[i]));
    this.restyle(layerId);
    return true;
  }
```

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run src/tools/ChoroplethTool.legend.test.js src/core/LayerManager.classFill.test.js src/core/LayerManager.stroke.test.js`
Expected: 전부 PASS (legend 8 · classFill 5 · stroke 기존).

- [ ] **Step 5: 커밋**

```bash
git add src/tools/ChoroplethTool.js src/tools/ChoroplethTool.legend.test.js
git -c user.name=yhk1m -c user.email=83273992+yhk1m@users.noreply.github.com commit -m "feat(choropleth): 범례 칸 data-class·타일, setClassFill/setClassColor/setAllFills, 클릭 훅"
```

---

### Task 7: 팝오버 `ClassFillPopover.js` + `classFill.css`

**Files:**
- Create: `src/ui/panels/ClassFillPopover.js`, `src/styles/classFill.css`
- Modify: `src/styles/main.css:5-8` (`@import`, 0단계가 넣은 `glass.css` 줄 뒤)
- Test: `src/ui/panels/ClassFillPopover.test.js` (jsdom)

- [ ] **Step 1: 실패하는 테스트 작성**

`src/ui/panels/ClassFillPopover.test.js`:

```js
// @vitest-environment jsdom
// © 2026 김용현
/**
 * 구간 채움 팝오버. 도구(choroplethTool)를 주입받아 "어떤 호출을 하는지"만 본다.
 * 캔버스가 없는 jsdom 에서는 질감 미리보기 타일이 단색으로 물러선다.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ClassFillPopover } from './ClassFillPopover.js';

HTMLCanvasElement.prototype.getContext = () => null;

function fakeTool(cfg) {
  return {
    cfg,
    configOf: () => cfg,
    setClassFill: vi.fn(() => true),
    setClassColor: vi.fn(() => true),
    setAllFills: vi.fn(() => true)
  };
}

function setup(fills) {
  document.body.innerHTML = `
    <div id="map" style="position:relative;width:800px;height:600px">
      <div class="choropleth-legend"><div class="choropleth-legend-items">
        <span class="choropleth-legend-color" data-class="0"></span>
        <span class="choropleth-legend-color" data-class="1"></span>
      </div></div>
    </div>`;
  const cfg = { attribute: 'pop', breaks: [0, 50, 100], colors: ['#ffffcc', '#800026'] };
  if (fills) cfg.fills = fills;
  const tool = fakeTool(cfg);
  const popover = new ClassFillPopover({ tool });
  const anchor = document.querySelectorAll('.choropleth-legend-color')[1];
  return { tool, popover, anchor };
}

const change = (el, value) => { el.value = value; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); };

beforeEach(() => { document.body.innerHTML = ''; });

describe('ClassFillPopover', () => {
  it('열면 #map 안에 뜨고 종류 탭 넷, 채움이 없으면 단색 탭', () => {
    const { popover, anchor } = setup();
    popover.open({ layerId: 'L', classIndex: 1, anchor });
    const el = document.querySelector('#map .class-fill-popover');
    expect(el).not.toBeNull();
    expect(el.querySelectorAll('.class-fill-kind')).toHaveLength(4);
    expect(el.querySelector('.class-fill-kind[aria-selected="true"]').dataset.kind).toBe('solid');
    expect(el.querySelector('.class-fill-title').textContent).toBe('2구간 채움');
    expect(el.querySelector('.cf-color').value).toBe('#800026');
    popover.close();
    expect(document.querySelector('.class-fill-popover')).toBeNull();
  });

  it('기존 채움이 있으면 그 탭과 값으로 연다', () => {
    const { popover, anchor } = setup([{ kind: 'solid' }, { kind: 'dots', spacing: 12, radius: 2, color: '#111111', background: 'none' }]);
    popover.open({ layerId: 'L', classIndex: 1, anchor });
    const el = document.querySelector('.class-fill-popover');
    expect(el.querySelector('.class-fill-kind[aria-selected="true"]').dataset.kind).toBe('pattern');
    expect(el.querySelector('.cf-ptype').value).toBe('dots');
    expect(el.querySelector('.cf-spacing').value).toBe('12');
    expect(el.querySelector('.cf-bg').value).toBe('none');
    popover.close();
  });

  it('단색 입력 → setClassColor', () => {
    const { tool, popover, anchor } = setup();
    popover.open({ layerId: 'L', classIndex: 1, anchor });
    change(document.querySelector('.cf-color'), '#123456');
    expect(tool.setClassColor).toHaveBeenCalledWith('L', 1, '#123456');
    popover.close();
  });

  it('패턴 탭에서 값을 바꾸면 setClassFill(hatch …)', () => {
    const { tool, popover, anchor } = setup();
    popover.open({ layerId: 'L', classIndex: 0, anchor });
    document.querySelector('.class-fill-kind[data-kind="pattern"]').click();
    expect(tool.setClassFill).toHaveBeenLastCalledWith('L', 0, expect.objectContaining({ kind: 'hatch' }));
    change(document.querySelector('.cf-spacing'), '6');
    change(document.querySelector('.cf-angle'), '135');
    expect(tool.setClassFill).toHaveBeenLastCalledWith('L', 0, expect.objectContaining({ kind: 'hatch', spacing: 6, angle: 135 }));
    change(document.querySelector('.cf-ptype'), 'dots');
    expect(tool.setClassFill).toHaveBeenLastCalledWith('L', 0, expect.objectContaining({ kind: 'dots' }));
    expect(document.querySelector('.cf-row-angle').hidden).toBe(true);
    expect(document.querySelector('.cf-row-radius').hidden).toBe(false);
    popover.close();
  });

  it('배경 "직접" 을 고르면 색 입력이 보이고 그 색이 실린다', () => {
    const { tool, popover, anchor } = setup();
    popover.open({ layerId: 'L', classIndex: 0, anchor });
    document.querySelector('.class-fill-kind[data-kind="pattern"]').click();
    change(document.querySelector('.cf-bg'), 'custom');
    expect(document.querySelector('.cf-bgcolor').hidden).toBe(false);
    change(document.querySelector('.cf-bgcolor'), '#00ff00');
    expect(tool.setClassFill).toHaveBeenLastCalledWith('L', 0, expect.objectContaining({ background: '#00ff00' }));
    popover.close();
  });

  it('질감 탭: 타일 다섯, 누르면 setClassFill(texture), 강도 반영', () => {
    const { tool, popover, anchor } = setup();
    popover.open({ layerId: 'L', classIndex: 0, anchor });
    document.querySelector('.class-fill-kind[data-kind="texture"]').click();
    const tiles = document.querySelectorAll('.cf-texture');
    expect(tiles).toHaveLength(5);
    tiles[3].click();
    expect(tool.setClassFill).toHaveBeenLastCalledWith('L', 0, { kind: 'texture', name: 'forest', strength: 0.5 });
    change(document.querySelector('.cf-strength'), '0.8');
    expect(tool.setClassFill).toHaveBeenLastCalledWith('L', 0, { kind: 'texture', name: 'forest', strength: 0.8 });
    popover.close();
  });

  it('이미지 탭: 파일 없으면 배율·불투명도 입력이 잠기고 크기 표시는 비어 있다', () => {
    const { popover, anchor } = setup();
    popover.open({ layerId: 'L', classIndex: 0, anchor });
    document.querySelector('.class-fill-kind[data-kind="image"]').click();
    expect(document.querySelector('.cf-file')).not.toBeNull();
    expect(document.querySelector('.cf-iscale').disabled).toBe(true);
    expect(document.querySelector('.cf-isize').textContent).toBe('');
    popover.close();
  });

  it('프리셋 적용 → setAllFills(구간 수만큼), 되돌리기 → setAllFills(null)', () => {
    const { tool, popover, anchor } = setup();
    popover.open({ layerId: 'L', classIndex: 0, anchor });
    change(document.querySelector('.class-fill-preset'), 'bw-hatch');
    document.querySelector('.class-fill-preset-apply').click();
    expect(tool.setAllFills).toHaveBeenCalledWith('L', expect.arrayContaining([expect.objectContaining({ kind: 'hatch' })]));
    expect(tool.setAllFills.mock.calls[0][1]).toHaveLength(2);
    document.querySelector('.class-fill-reset').click();
    expect(tool.setAllFills).toHaveBeenLastCalledWith('L', null);
    popover.close();
  });

  it('Esc·바깥 클릭·닫기 버튼으로 닫힌다, 앵커 클릭은 닫지 않는다', () => {
    const { popover, anchor } = setup();
    popover.open({ layerId: 'L', classIndex: 0, anchor });
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(document.querySelector('.class-fill-popover')).toBeNull();

    popover.open({ layerId: 'L', classIndex: 0, anchor });
    anchor.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    expect(document.querySelector('.class-fill-popover')).not.toBeNull();
    document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    expect(document.querySelector('.class-fill-popover')).toBeNull();

    popover.open({ layerId: 'L', classIndex: 0, anchor });
    document.querySelector('.class-fill-close').click();
    expect(document.querySelector('.class-fill-popover')).toBeNull();
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run src/ui/panels/ClassFillPopover.test.js`
Expected: FAIL — `Failed to resolve import "./ClassFillPopover.js"`.

- [ ] **Step 3: 팝오버 구현**

`src/ui/panels/ClassFillPopover.js`:

```js
// © 2026 김용현
/**
 * ClassFillPopover - 범례 색 칸 옆에 뜨는 구간 채움 편집 팝오버 (실험 class-fill)
 *
 * 채움 종류 넷(단색·패턴·이미지·질감)을 탭으로 고르고, 바꾸는 즉시
 * choroplethTool.setClassFill / setClassColor 로 지도·범례에 반영한다.
 * 아래에 "모든 구간에 프리셋"과 "팔레트로 되돌리기".
 * 지도 컨테이너(#map) 안에 절대 위치로 뜨고, 바깥 클릭·Esc 로 닫힌다.
 * 되돌리기(HistoryManager)는 범위 밖.
 * 설계: docs/superpowers/specs/2026-09-25-labs-design.md 「1단계」
 */
import { choroplethTool } from '../../tools/ChoroplethTool.js';
import { normalizeFill, presetFills, fillSpecBytes, TEXTURE_NAMES, HATCH_ANGLES } from '../../tools/classFill.js';
import { tileDataUrl, reencodeImageFile } from '../../tools/classFillCanvas.js';
import { eventBus, Events } from '../../utils/EventBus.js';
import { escapeHtml } from '../../utils/escapeHtml.js';

const KIND_TABS = [
  { kind: 'solid', label: '단색' },
  { kind: 'pattern', label: '패턴' },
  { kind: 'image', label: '이미지' },
  { kind: 'texture', label: '질감' }
];

const TEXTURE_LABELS = { paper: '종이', gloss: '광택', sand: '모래', forest: '숲', water: '물' };
const PRESET_LABELS = { 'bw-hatch': '흑백 인쇄용 사선(밀도 단계)', 'dots-density': '점 밀도 단계', 'texture-uniform': '종이 질감 통일' };

const CLOSE_ICON = `
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
  </svg>`;

function tabOf(spec) {
  if (!spec || spec.kind === 'solid') return 'solid';
  if (spec.kind === 'image' || spec.kind === 'texture') return spec.kind;
  return 'pattern';
}

function formatBytes(bytes) {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
  return `${Math.max(1, Math.round(bytes / 1024))}KB`;
}

function status(message) {
  const el = document.getElementById('status-message');
  if (!el) return;
  el.textContent = message;
  setTimeout(() => { if (el.textContent === message) el.textContent = '준비'; }, 3000);
}

export class ClassFillPopover {
  constructor({ tool = choroplethTool } = {}) {
    this.tool = tool;
    this.el = null;
    this.layerId = null;
    this.classIndex = -1;
    this.anchor = null;
    this.tab = 'solid';
    /** 탭마다 마지막 사양을 기억해 탭을 오가도 값이 유지되게 */
    this.drafts = {};
    this._onKey = null;
    this._onDown = null;
    this._onRemoved = null;
  }

  open({ layerId, classIndex, anchor }) {
    this.close();
    const cfg = this.tool.configOf(layerId);
    if (!cfg || !anchor) return;
    const map = document.getElementById('map');
    if (!map) return;

    this.layerId = layerId;
    this.classIndex = classIndex;
    this.anchor = anchor;
    const current = normalizeFill(cfg.fills ? cfg.fills[classIndex] : null);
    this.tab = tabOf(current);
    this.drafts = { [this.tab]: current };

    this.el = document.createElement('div');
    this.el.className = 'class-fill-popover';
    this.el.setAttribute('role', 'dialog');
    this.el.setAttribute('aria-label', '구간 채움');
    this.el.innerHTML = `
      <div class="class-fill-head">
        <span class="class-fill-title">${classIndex + 1}구간 채움</span>
        <button type="button" class="class-fill-close" aria-label="닫기">${CLOSE_ICON}</button>
      </div>
      <div class="class-fill-kinds" role="tablist">
        ${KIND_TABS.map((t) => `<button type="button" class="class-fill-kind" role="tab" data-kind="${t.kind}" aria-selected="${t.kind === this.tab}">${t.label}</button>`).join('')}
      </div>
      <div class="class-fill-body"></div>
      <div class="class-fill-foot">
        <div class="class-fill-row">
          <select class="class-fill-preset" aria-label="모든 구간에 프리셋">
            <option value="">모든 구간에 프리셋…</option>
            ${Object.keys(PRESET_LABELS).map((k) => `<option value="${k}">${PRESET_LABELS[k]}</option>`).join('')}
          </select>
          <button type="button" class="btn btn-sm class-fill-preset-apply">적용</button>
        </div>
        <button type="button" class="btn btn-sm btn-outline class-fill-reset">팔레트로 되돌리기</button>
      </div>`;
    map.appendChild(this.el);
    this.renderBody();
    this.bind();
    this.position(map);
  }

  /* ---------- 본문 ---------- */

  currentSpec() {
    return this.drafts[this.tab] || this.defaultSpecFor(this.tab);
  }

  defaultSpecFor(tab) {
    if (tab === 'pattern') return normalizeFill({ kind: 'hatch' });
    if (tab === 'texture') return normalizeFill({ kind: 'texture' });
    if (tab === 'image') return { kind: 'solid' };   // 파일을 고르기 전까지는 단색
    return { kind: 'solid' };
  }

  baseColor() {
    const cfg = this.tool.configOf(this.layerId);
    return (cfg && cfg.colors[this.classIndex]) || '#808080';
  }

  renderBody() {
    const body = this.el.querySelector('.class-fill-body');
    const spec = this.currentSpec();
    const base = this.baseColor();

    if (this.tab === 'solid') {
      body.innerHTML = `
        <div class="class-fill-row"><label>색 <input type="color" class="cf-color" value="${base}"></label></div>`;
      body.querySelector('.cf-color').addEventListener('input', (e) => {
        this.tool.setClassColor(this.layerId, this.classIndex, e.target.value);
      });
      return;
    }

    if (this.tab === 'pattern') {
      const p = spec.kind === 'solid' ? this.defaultSpecFor('pattern') : spec;
      const isHatch = p.kind === 'hatch';
      const isDots = p.kind === 'dots';
      const customBg = p.background !== 'class' && p.background !== 'none';
      body.innerHTML = `
        <div class="class-fill-row"><label>종류
          <select class="cf-ptype">
            <option value="hatch">사선</option><option value="dots">점</option><option value="cross">격자</option>
          </select></label>
          <label>색 <input type="color" class="cf-pcolor" value="${p.color}"></label></div>
        <div class="class-fill-row"><label>간격 <input type="range" class="cf-spacing" min="4" max="24" step="1" value="${p.spacing}"><span class="cf-val cf-spacing-val">${p.spacing}</span></label></div>
        <div class="class-fill-row cf-row-width"><label>굵기 <input type="range" class="cf-width" min="0.5" max="6" step="0.5" value="${isDots ? 1.5 : p.width}"><span class="cf-val cf-width-val">${isDots ? 1.5 : p.width}</span></label></div>
        <div class="class-fill-row cf-row-radius"><label>점 크기 <input type="range" class="cf-radius" min="0.5" max="6" step="0.1" value="${isDots ? p.radius : 1.6}"><span class="cf-val cf-radius-val">${isDots ? p.radius : 1.6}</span></label></div>
        <div class="class-fill-row cf-row-angle"><label>각도
          <select class="cf-angle">${HATCH_ANGLES.map((a) => `<option value="${a}">${a}°</option>`).join('')}</select></label></div>
        <div class="class-fill-row"><label>배경
          <select class="cf-bg">
            <option value="class">구간 색</option><option value="none">없음</option><option value="custom">직접</option>
          </select></label>
          <input type="color" class="cf-bgcolor" value="${customBg ? p.background : '#ffffff'}" aria-label="배경 색"></div>`;
      body.querySelector('.cf-ptype').value = p.kind;
      body.querySelector('.cf-angle').value = String(isHatch ? p.angle : 45);
      body.querySelector('.cf-bg').value = customBg ? 'custom' : p.background;
      this.syncPatternRows();
      const apply = () => {
        const kind = body.querySelector('.cf-ptype').value;
        const bgSel = body.querySelector('.cf-bg').value;
        const background = bgSel === 'custom' ? body.querySelector('.cf-bgcolor').value : bgSel;
        const next = normalizeFill({
          kind,
          color: body.querySelector('.cf-pcolor').value,
          spacing: Number(body.querySelector('.cf-spacing').value),
          width: Number(body.querySelector('.cf-width').value),
          radius: Number(body.querySelector('.cf-radius').value),
          angle: Number(body.querySelector('.cf-angle').value),
          background
        });
        this.drafts.pattern = next;
        this.syncPatternRows();
        this.tool.setClassFill(this.layerId, this.classIndex, next);
      };
      body.querySelectorAll('select, input').forEach((el) => {
        el.addEventListener('input', () => { this.showRangeValues(); apply(); });
        el.addEventListener('change', () => { this.showRangeValues(); apply(); });
      });
      return;
    }

    if (this.tab === 'image') {
      const img = spec.kind === 'image' ? spec : null;
      body.innerHTML = `
        <div class="class-fill-row"><label class="cf-file-label">이미지 파일 <input type="file" class="cf-file" accept="image/png,image/jpeg,image/svg+xml"></label></div>
        <div class="class-fill-row"><label>배율 <input type="range" class="cf-iscale" min="0.25" max="4" step="0.25" value="${img ? img.scale : 1}" ${img ? '' : 'disabled'}><span class="cf-val cf-iscale-val">${img ? img.scale : 1}</span></label></div>
        <div class="class-fill-row"><label>불투명도 <input type="range" class="cf-iopacity" min="0" max="1" step="0.05" value="${img ? img.opacity : 1}" ${img ? '' : 'disabled'}><span class="cf-val cf-iopacity-val">${img ? img.opacity : 1}</span></label></div>
        <div class="class-fill-row class-fill-note"><span class="cf-isize">${img ? `저장 크기 약 ${formatBytes(fillSpecBytes(img))}` : ''}</span></div>`;
      body.querySelector('.cf-file').addEventListener('change', async (e) => {
        const file = e.target.files && e.target.files[0];
        if (!file) return;
        try {
          const { dataUrl, width, height } = await reencodeImageFile(file);
          const prev = this.drafts.image && this.drafts.image.kind === 'image' ? this.drafts.image : {};
          const next = normalizeFill({ kind: 'image', dataUrl, width, height, scale: prev.scale, opacity: prev.opacity });
          this.drafts.image = next;
          this.tool.setClassFill(this.layerId, this.classIndex, next);
          if (this.el) this.renderBody();
        } catch (err) {
          status(err.message || '이미지를 읽을 수 없습니다.');
        }
      });
      const applyRanges = () => {
        if (!this.drafts.image || this.drafts.image.kind !== 'image') return;
        const next = normalizeFill({
          ...this.drafts.image,
          scale: Number(body.querySelector('.cf-iscale').value),
          opacity: Number(body.querySelector('.cf-iopacity').value)
        });
        this.drafts.image = next;
        this.tool.setClassFill(this.layerId, this.classIndex, next);
      };
      body.querySelectorAll('.cf-iscale, .cf-iopacity').forEach((el) => {
        el.addEventListener('input', () => { this.showRangeValues(); applyRanges(); });
      });
      return;
    }

    // texture
    const t = spec.kind === 'texture' ? spec : this.defaultSpecFor('texture');
    body.innerHTML = `
      <div class="class-fill-textures">
        ${TEXTURE_NAMES.map((name) => {
          const tile = tileDataUrl({ kind: 'texture', name, strength: 0.7 }, base, 32);
          const style = tile ? `background-image:url(${tile})` : `background:${base}`;
          return `<button type="button" class="cf-texture" data-name="${name}" aria-pressed="${name === t.name}" title="${TEXTURE_LABELS[name]}">
            <span class="cf-texture-tile" style="${style}"></span><span class="cf-texture-label">${TEXTURE_LABELS[name]}</span></button>`;
        }).join('')}
      </div>
      <div class="class-fill-row"><label>강도 <input type="range" class="cf-strength" min="0" max="1" step="0.05" value="${t.strength}"><span class="cf-val cf-strength-val">${t.strength}</span></label></div>`;
    const applyTexture = (name) => {
      const next = { kind: 'texture', name, strength: Number(body.querySelector('.cf-strength').value) };
      this.drafts.texture = next;
      body.querySelectorAll('.cf-texture').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.name === name)));
      this.tool.setClassFill(this.layerId, this.classIndex, next);
    };
    body.querySelectorAll('.cf-texture').forEach((b) => b.addEventListener('click', () => applyTexture(b.dataset.name)));
    body.querySelector('.cf-strength').addEventListener('input', () => {
      this.showRangeValues();
      const pressed = body.querySelector('.cf-texture[aria-pressed="true"]');
      applyTexture(pressed ? pressed.dataset.name : t.name);
    });
  }

  /** 패턴 종류에 따라 각도·굵기·점 크기 행을 보이고 숨긴다 */
  syncPatternRows() {
    const body = this.el.querySelector('.class-fill-body');
    const kind = body.querySelector('.cf-ptype').value;
    body.querySelector('.cf-row-angle').hidden = kind !== 'hatch';
    body.querySelector('.cf-row-width').hidden = kind === 'dots';
    body.querySelector('.cf-row-radius').hidden = kind !== 'dots';
    body.querySelector('.cf-bgcolor').hidden = body.querySelector('.cf-bg').value !== 'custom';
  }

  showRangeValues() {
    this.el.querySelectorAll('input[type="range"]').forEach((r) => {
      const out = r.parentElement.querySelector('.cf-val');
      if (out) out.textContent = r.value;
    });
  }

  /* ---------- 공통 ---------- */

  bind() {
    this.el.querySelector('.class-fill-close').addEventListener('click', () => this.close());

    this.el.querySelectorAll('.class-fill-kind').forEach((btn) => {
      btn.addEventListener('click', () => this.switchTab(btn.dataset.kind));
    });

    this.el.querySelector('.class-fill-preset-apply').addEventListener('click', () => {
      const name = this.el.querySelector('.class-fill-preset').value;
      const cfg = this.tool.configOf(this.layerId);
      if (!name || !cfg) return;
      const fills = presetFills(name, cfg.colors.length);
      if (!fills) return;
      this.tool.setAllFills(this.layerId, fills);
      this.drafts = {};
      this.drafts[tabOf(fills[this.classIndex])] = normalizeFill(fills[this.classIndex]);
      this.switchTab(tabOf(fills[this.classIndex]), { silent: true });
    });

    this.el.querySelector('.class-fill-reset').addEventListener('click', () => {
      this.tool.setAllFills(this.layerId, null);
      this.drafts = {};
      this.switchTab('solid', { silent: true });
    });

    this._onKey = (e) => { if (e.key === 'Escape') this.close(); };
    document.addEventListener('keydown', this._onKey);

    this._onDown = (e) => {
      if (!this.el) return;
      if (this.el.contains(e.target)) return;
      if (this.anchor && (e.target === this.anchor || this.anchor.contains(e.target))) return;
      this.close();
    };
    document.addEventListener('mousedown', this._onDown);

    this._onRemoved = (data) => { if (data && data.layerId === this.layerId) this.close(); };
    eventBus.on(Events.LAYER_REMOVED, this._onRemoved);
  }

  /**
   * 탭 전환. silent 가 아니면 그 탭의 기본 사양을 바로 적용한다
   * (패턴 탭을 누르는 순간 지도에 사선이 보여야 "무엇이 바뀌는지" 알 수 있다).
   */
  switchTab(kind, { silent = false } = {}) {
    if (!this.el) return;
    this.tab = kind;
    this.el.querySelectorAll('.class-fill-kind').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.kind === kind)));
    if (!silent) {
      if (kind === 'solid') {
        this.tool.setClassFill(this.layerId, this.classIndex, { kind: 'solid' });
      } else if (kind === 'pattern' || kind === 'texture') {
        const next = this.drafts[kind] || this.defaultSpecFor(kind);
        this.drafts[kind] = next;
        this.tool.setClassFill(this.layerId, this.classIndex, next);
      } else if (kind === 'image' && this.drafts.image && this.drafts.image.kind === 'image') {
        this.tool.setClassFill(this.layerId, this.classIndex, this.drafts.image);
      }
    }
    this.renderBody();
  }

  /** 앵커(색 칸) 오른쪽에 붙이되 지도 밖으로 나가면 안쪽으로 당긴다 */
  position(map) {
    const mapRect = map.getBoundingClientRect();
    const a = this.anchor.getBoundingClientRect();
    let left = a.right - mapRect.left + 8;
    let top = a.top - mapRect.top - 8;
    const w = this.el.offsetWidth || 280;
    const h = this.el.offsetHeight || 320;
    if (left + w > mapRect.width - 8) left = Math.max(8, a.left - mapRect.left - w - 8);
    if (top + h > mapRect.height - 8) top = Math.max(8, mapRect.height - h - 8);
    this.el.style.left = `${Math.round(left)}px`;
    this.el.style.top = `${Math.round(top)}px`;
  }

  close() {
    if (this._onKey) { document.removeEventListener('keydown', this._onKey); this._onKey = null; }
    if (this._onDown) { document.removeEventListener('mousedown', this._onDown); this._onDown = null; }
    if (this._onRemoved) { eventBus.off(Events.LAYER_REMOVED, this._onRemoved); this._onRemoved = null; }
    if (this.el) { this.el.remove(); this.el = null; }
    this.anchor = null;
  }
}

export const classFillPopover = new ClassFillPopover();
```

> `eventBus.off` 가 없는 시그니처면(`EventBus.js` 를 읽어 확인) `on` 이 돌려주는 해제 함수를 쓴다.

- [ ] **Step 4: CSS**

`src/styles/classFill.css`:

```css
/**
 * 구간 채움 편집 (실험 class-fill)
 * - #map.labs-class-fill: 실험이 켜졌을 때만 범례 색 칸이 눌리는 것처럼 보인다.
 * - .class-fill-popover: 범례 옆 팝오버. 지도 내보내기 캡처에는 찍히지 않는다.
 */

#map.labs-class-fill .choropleth-legend-color {
  cursor: pointer;
}

#map.labs-class-fill .choropleth-legend-color:hover {
  outline: 2px solid var(--color-primary);
  outline-offset: 1px;
}

.class-fill-popover {
  position: absolute;
  z-index: 120;
  width: 280px;
  padding: var(--spacing-sm) var(--spacing-md) var(--spacing-md);
  background: var(--bg-panel);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-lg);
  font-size: var(--font-size-xs);
  color: var(--text-primary);
}

body.exporting .class-fill-popover {
  display: none !important;
}

.class-fill-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--spacing-sm);
}

.class-fill-title {
  font-size: var(--font-size-sm);
  font-weight: 600;
}

.class-fill-close {
  border: none;
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  padding: 2px;
  line-height: 0;
}

.class-fill-close:hover {
  color: var(--text-primary);
}

.class-fill-kinds {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 2px;
  padding: 2px;
  margin-bottom: var(--spacing-sm);
  background: var(--bg-app);
  border-radius: var(--radius-sm);
}

.class-fill-kind {
  border: none;
  background: transparent;
  color: var(--text-secondary);
  padding: 5px 0;
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-size: var(--font-size-xs);
}

.class-fill-kind[aria-selected="true"] {
  background: var(--bg-panel);
  color: var(--color-primary);
  font-weight: 600;
  box-shadow: var(--shadow-sm);
}

.class-fill-row {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  margin-bottom: 6px;
}

.class-fill-row[hidden] {
  display: none;
}

.class-fill-row label {
  display: flex;
  align-items: center;
  gap: 6px;
  flex: 1;
  min-width: 0;
  color: var(--text-secondary);
}

.class-fill-row input[type="range"] {
  flex: 1;
  min-width: 0;
}

.class-fill-row input[type="color"] {
  width: 28px;
  height: 22px;
  padding: 0;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  background: transparent;
}

.class-fill-row input[type="color"][hidden] {
  display: none;
}

.class-fill-row select {
  font-size: var(--font-size-xs);
  padding: 3px 4px;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  background: var(--bg-input);
  color: var(--text-primary);
}

.cf-val {
  min-width: 2.5em;
  text-align: right;
  color: var(--text-muted);
  font-variant-numeric: tabular-nums;
}

.class-fill-note {
  color: var(--text-muted);
  min-height: 1em;
}

.cf-file-label input {
  font-size: var(--font-size-xs);
  max-width: 190px;
}

.class-fill-textures {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 4px;
  margin-bottom: 6px;
}

.cf-texture {
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  background: var(--bg-app);
  padding: 3px;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  color: var(--text-secondary);
  font-size: 10px;
}

.cf-texture[aria-pressed="true"] {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 1px var(--color-primary);
  color: var(--color-primary);
}

.cf-texture-tile {
  width: 32px;
  height: 32px;
  border-radius: 2px;
  border: 1px solid var(--border-color);
  background-size: 32px 32px;
}

.class-fill-foot {
  margin-top: var(--spacing-sm);
  padding-top: var(--spacing-sm);
  border-top: 1px solid var(--border-color);
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.class-fill-foot .class-fill-preset {
  flex: 1;
  min-width: 0;
  font-size: var(--font-size-xs);
  padding: 3px 4px;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  background: var(--bg-input);
  color: var(--text-primary);
}

.class-fill-foot .btn-outline {
  background: transparent;
  border: 1px solid var(--color-primary);
  color: var(--color-primary);
}
```

`src/styles/main.css` import 묶음(0단계가 넣은 `@import './glass.css';` 뒤)에:

```css
@import './classFill.css';
```

- [ ] **Step 5: 통과 확인·빌드**

Run: `npx vitest run src/ui/panels/ClassFillPopover.test.js`
Expected: PASS (9 tests).

Run: `rm -rf dist && npm run build`
Expected: 성공.

- [ ] **Step 6: 커밋**

```bash
git add src/ui/panels/ClassFillPopover.js src/ui/panels/ClassFillPopover.test.js src/styles/classFill.css src/styles/main.css
git -c user.name=yhk1m -c user.email=83273992+yhk1m@users.noreply.github.com commit -m "feat(labs): 구간 채움 팝오버 — 단색·패턴·이미지·질감, 프리셋, 되돌리기"
```

---

### Task 8: 실험 가드 바인딩 + `main.js` 배선 + 레지스트리

**Files:**
- Create: `src/labs/classFillBinding.js`, `src/labs/classFillBinding.test.js`
- Modify: `src/labs/registry.js` (`EXPERIMENTS`), `src/main.js` (import·초기화·`__egisDebug`)

- [ ] **Step 1: 실패하는 테스트 작성**

`src/labs/classFillBinding.test.js`:

```js
// © 2026 김용현
/**
 * 실험 class-fill 의 가드는 여기 한 곳이다.
 * 켜지면 #map 에 labs-class-fill 클래스가 붙고 범례 클릭 훅이 팝오버를 연다.
 * 꺼지면 클래스가 빠지고 열려 있던 팝오버가 닫히며 훅은 아무 일도 하지 않는다.
 * 승격할 때는 labs.isOn 검사를 지우면 된다.
 */
import { describe, it, expect, vi } from 'vitest';
import { bindClassFill, CLASS_FILL_ID, MAP_CLASS } from './classFillBinding.js';
import { Labs } from './labs.js';

function fakeMap() {
  const set = new Set();
  return { set, classList: { toggle: (c, on) => { if (on) set.add(c); else set.delete(c); }, contains: (c) => set.has(c) } };
}

function make(search = '') {
  const labs = new Labs();
  labs.init({ knownIds: ['glass', CLASS_FILL_ID], search });
  const mapEl = fakeMap();
  const tool = { onLegendColorClick: null };
  const popover = { open: vi.fn(), close: vi.fn() };
  const off = bindClassFill(labs, { mapEl, tool, popover });
  return { labs, mapEl, tool, popover, off };
}

describe('bindClassFill', () => {
  it('꺼진 채 시작하면 클래스 없음, 훅은 열지 않는다', () => {
    const { mapEl, tool, popover } = make();
    expect(mapEl.classList.contains(MAP_CLASS)).toBe(false);
    expect(typeof tool.onLegendColorClick).toBe('function');
    tool.onLegendColorClick({ layerId: 'L', classIndex: 0, anchor: {} });
    expect(popover.open).not.toHaveBeenCalled();
  });

  it('켜면 클래스가 붙고 훅이 팝오버를 연다', () => {
    const { labs, mapEl, tool, popover } = make();
    labs.set(CLASS_FILL_ID, true);
    expect(mapEl.classList.contains(MAP_CLASS)).toBe(true);
    const info = { layerId: 'L', classIndex: 2, anchor: {} };
    tool.onLegendColorClick(info);
    expect(popover.open).toHaveBeenCalledWith(info);
  });

  it('?lab= 으로 켜진 채 시작하면 바로 클래스가 붙는다', () => {
    const { mapEl } = make(`?lab=${CLASS_FILL_ID}`);
    expect(mapEl.classList.contains(MAP_CLASS)).toBe(true);
  });

  it('끄면 클래스가 빠지고 팝오버가 닫힌다, 다른 실험은 영향 없음', () => {
    const { labs, mapEl, popover } = make(`?lab=${CLASS_FILL_ID}`);
    labs.set('glass', true);
    expect(mapEl.classList.contains(MAP_CLASS)).toBe(true);
    labs.set(CLASS_FILL_ID, false);
    expect(mapEl.classList.contains(MAP_CLASS)).toBe(false);
    expect(popover.close).toHaveBeenCalled();
  });

  it('해제하면 훅이 지워지고 클래스도 빠진다', () => {
    const { labs, mapEl, tool, off } = make(`?lab=${CLASS_FILL_ID}`);
    off();
    expect(tool.onLegendColorClick).toBeNull();
    expect(mapEl.classList.contains(MAP_CLASS)).toBe(false);
    labs.set(CLASS_FILL_ID, true);
    expect(mapEl.classList.contains(MAP_CLASS)).toBe(false);
  });

  it('mapEl 이 없어도 예외 없음', () => {
    const labs = new Labs();
    labs.init({ knownIds: [CLASS_FILL_ID] });
    expect(() => bindClassFill(labs, { mapEl: null, tool: {}, popover: { open() {}, close() {} } })).not.toThrow();
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run src/labs/classFillBinding.test.js`
Expected: FAIL — `Failed to resolve import "./classFillBinding.js"`.

- [ ] **Step 3: 바인딩 구현**

`src/labs/classFillBinding.js`:

```js
// © 2026 김용현
/**
 * 실험 class-fill 의 켜고 끄기 — 가드는 여기 한 곳.
 *
 * - #map 에 labs-class-fill 클래스 (CSS 가 범례 색 칸에 손 모양·호버 테두리를 준다)
 * - choroplethTool.onLegendColorClick 훅에 팝오버 열기를 심는다. 클릭 시점에 isOn 을 보므로
 *   범례를 다시 만들 필요 없이 켜고 끄는 즉시 반영된다.
 * 승격 = 아래 isOn 검사와 registry 항목 삭제.
 */

export const CLASS_FILL_ID = 'class-fill';
export const MAP_CLASS = 'labs-class-fill';

/**
 * @param {import('./labs.js').Labs} labs
 * @param {{mapEl: Element|null, tool: Object, popover: {open: Function, close: Function}}} deps
 * @returns {() => void} 해제 함수
 */
export function bindClassFill(labs, { mapEl, tool, popover }) {
  const apply = (on) => {
    if (mapEl && mapEl.classList) mapEl.classList.toggle(MAP_CLASS, on);
    if (!on && popover) popover.close();
  };

  apply(labs.isOn(CLASS_FILL_ID));
  tool.onLegendColorClick = (info) => {
    if (labs.isOn(CLASS_FILL_ID)) popover.open(info);
  };
  const off = labs.onChange((id, on) => {
    if (id === CLASS_FILL_ID) apply(on);
  });

  return () => {
    off();
    tool.onLegendColorClick = null;
    apply(false);
  };
}
```

- [ ] **Step 4: 레지스트리**

`src/labs/registry.js` 의 `EXPERIMENTS` 배열, `glass` 항목 뒤에:

```js
  {
    id: 'class-fill',
    name: '구간 채움 편집',
    summary: '범례의 색 칸을 눌러 구간마다 색·패턴·이미지·질감을 바꿉니다.',
    since: '2026-09'
  }
```

- [ ] **Step 5: `main.js` 배선**

import 묶음(0단계가 넣은 `import { bindLabsButton } from './labs/labsButton.js';` 아래):

```js
import { bindClassFill } from './labs/classFillBinding.js';
import { classFillPopover } from './ui/panels/ClassFillPopover.js';
import { choroplethTool } from './tools/ChoroplethTool.js';
import { builtinDataManager } from './core/BuiltinDataManager.js';
```

(`choroplethTool`·`builtinDataManager` 가 이미 import 돼 있으면 중복하지 않는다.)

0단계가 넣은 `bindLabsButton(labs, document.getElementById('labs-toggle'));` 바로 뒤:

```js
  bindClassFill(labs, { mapEl: document.getElementById('map'), tool: choroplethTool, popover: classFillPopover });
```

`window.__egisDebug = { … }` 객체에 `choroplethTool, builtinDataManager, classFillPopover` 를 더한다(하네스가 단계구분도를 만들고 팝오버를 확인하기 위해):

> 다른 단계가 먼저 병합돼 `__egisDebug` 에 항목이 더 있으면 그 항목은 그대로 두고 **여기 것만 더한다**(아래 줄은 0단계 직후 모습이다). 이미 같은 이름이 있으면 중복해서 넣지 않는다.

```js
window.__egisDebug = { projectManager, layerManager, exportPanel, isochroneTool, roadNetwork, measureTool, selectTool, historyManager, mapManager, labs, choroplethTool, builtinDataManager, classFillPopover, get view3dPanel() { return view3dPanel; } };
```

- [ ] **Step 6: 전체 테스트·빌드**

Run: `npm test`
Expected: 전부 PASS (`registry.test.js` 의 형식 검사 포함).

Run: `rm -rf dist && npm run build`
Expected: 성공.

- [ ] **Step 7: 커밋**

```bash
git add src/labs/classFillBinding.js src/labs/classFillBinding.test.js src/labs/registry.js src/main.js
git -c user.name=yhk1m -c user.email=83273992+yhk1m@users.noreply.github.com commit -m "feat(labs): class-fill 실험 등록 — 가드 바인딩·main.js 배선·디버그 노출"
```

---

### Task 9: 사용 설명서

**Files:**
- Modify: `docs/사용설명서.md` — 1-14 실험실 절(0단계가 만든 「글래스 UI」 소절 뒤)

- [ ] **Step 1: 문단 추가**

`### 글래스 UI` 소절의 문단 끝(다음 `---` 앞)에:

```md
### 구간 채움 편집

단계구분도(격자 포함) 범례의 **색 칸을 누르면** 그 구간의 채움을 고르는 창이 뜹니다. 단색은 색만 바꾸고, 패턴은 사선·점·격자의 색·간격·굵기·각도와 배경(구간 색·없음·직접)을, 이미지는 PNG·JPG·SVG 파일을 타일처럼 반복하며, 질감은 종이·광택·모래·숲·물 다섯 가지를 강도와 함께 고릅니다. 바꾸는 즉시 지도와 범례에 반영되고, 프로젝트 저장·복원과 지도 내보내기(PNG·PDF 범례)에도 그대로 실립니다.

- 창 아래 **모든 구간에 프리셋**은 흑백 인쇄용 사선(높은 구간일수록 촘촘)·점 밀도 단계·질감 통일을 한 번에 겁니다. **팔레트로 되돌리기**는 모든 구간을 단색으로 되돌립니다.
- 패턴과 질감은 화면에 고정된 무늬입니다. 지도를 끄는 동안 무늬가 지형과 함께 움직이다가 손을 놓으면 다시 정렬됩니다(QGIS 의 화면 단위 패턴과 같습니다).
- 이미지 채움은 긴 변 256픽셀로 줄여 저장하며, 구간당 약 200KB 까지 프로젝트 파일이 커질 수 있습니다. 창에 저장 크기가 표시됩니다.
- 카토그램·히트맵 범례에는 아직 적용되지 않습니다.
```

- [ ] **Step 2: 빌드로 반영 확인**

Run: `rm -rf dist && npm run build && grep -c "구간 채움 편집" dist/guide.html`
Expected: `1` 이상.

- [ ] **Step 3: 커밋**

```bash
git add docs/사용설명서.md
git -c user.name=yhk1m -c user.email=83273992+yhk1m@users.noreply.github.com commit -m "docs(guide): 실험실 — 구간 채움 편집 문단"
```

---

### Task 10: Electron 하네스로 화면 검증

**Files:**
- Create: `scripts/verify/labs-class-fill.cjs`

- [ ] **Step 1: 빌드·프리뷰**

```bash
cd "C:/Users/김용현/Desktop/vibecoding/eGIS"
rm -rf dist && npm run build
npx vite preview --port 4173 &
curl -s -o /dev/null -w "%{http_code}" http://localhost:4173/
```
Expected: `200`.

- [ ] **Step 2: 하네스 작성**

`scripts/verify/labs-class-fill.cjs`:

```js
// © 2026 김용현
/**
 * 실험실 1단계(구간 채움) 화면 검증.
 * 실행: cd eStoryMap && npx electron ../scripts/verify/labs-class-fill.cjs
 * 결과: scripts/verify/out/class-fill-*.png 와 콘솔 판정
 *
 * 내장 「서울 자치구」(25개 폴리곤)에는 숫자 필드가 없어 하네스가 val 을 심고
 * __egisDebug.choroplethTool.apply 로 5구간 단계구분도를 만든다. 그 뒤는 사용자처럼
 * 범례 칸·팝오버·내보내기 창을 클릭한다.
 */
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');

const OUT = path.join(__dirname, 'out');
fs.mkdirSync(OUT, { recursive: true });
setTimeout(() => { console.error('WATCHDOG'); process.exit(2); }, 180000);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function capture(win, name) {
  let png = Buffer.alloc(0);
  for (let i = 0; i < 5 && png.length === 0; i++) {
    win.focus();
    await sleep(1500);
    png = (await win.capturePage()).toPNG();
  }
  fs.writeFileSync(path.join(OUT, `${name}.png`), png);
  console.log('captured', name, png.length);
}

function check(name, ok) {
  console.log(ok ? 'PASS' : 'FAIL', name);
  if (!ok) process.exitCode = 1;
}

app.whenReady().then(async () => {
  const win = new BrowserWindow({ width: 1600, height: 1000, show: true });
  const js = (c) => win.webContents.executeJavaScript(c);

  await win.loadURL('http://localhost:4173/');
  await sleep(3000);
  await js(`localStorage.setItem('egis_last_visit', new Date(Date.now() + 9*3600e3).toISOString().slice(0,10))`);

  // 0. 단계구분도 준비 — 서울 자치구 + 심은 값
  const layerId = await js(`(async () => {
    const { layerId } = await __egisDebug.builtinDataManager.loadPracticeDataset('area-data', 'seoul-gu');
    const info = __egisDebug.layerManager.getLayer(layerId);
    info.source.getFeatures().forEach((f, i) => f.set('val', (i * 37) % 100));
    const r = __egisDebug.choroplethTool.apply(layerId, 'val', 'blues', 'quantile', 5);
    return r.layerId;
  })()`);
  await sleep(1500);
  check('choropleth legend with 5 swatches', await js(`document.querySelectorAll('#choropleth-legend-${layerId} .choropleth-legend-color[data-class]').length === 5`));
  await capture(win, 'class-fill-00-before');

  // 1. 실험이 꺼져 있으면 칸을 눌러도 팝오버가 없다
  await js(`document.querySelector('#choropleth-legend-${layerId} .choropleth-legend-color[data-class="2"]').click()`);
  await sleep(300);
  check('no popover while lab off', await js(`!document.querySelector('.class-fill-popover') && !document.getElementById('map').classList.contains('labs-class-fill')`));

  // 2. 켜기 → 칸 클릭 → 팝오버
  await js(`__egisDebug.labs.set('class-fill', true)`);
  await sleep(200);
  check('map has labs-class-fill class', await js(`document.getElementById('map').classList.contains('labs-class-fill')`));
  await js(`document.querySelector('#choropleth-legend-${layerId} .choropleth-legend-color[data-class="2"]').click()`);
  await sleep(400);
  check('popover opened for class 2', await js(`document.querySelector('.class-fill-popover .class-fill-title')?.textContent === '3구간 채움'`));
  await capture(win, 'class-fill-01-popover');

  // 3. 패턴 탭 → 사선 간격 6 → 지도 채움이 CanvasPattern, 범례 칸이 타일
  await js(`document.querySelector('.class-fill-kind[data-kind="pattern"]').click()`);
  await sleep(200);
  await js(`(() => { const el = document.querySelector('.cf-spacing'); el.value = 6; el.dispatchEvent(new Event('input', { bubbles: true })); })()`);
  await sleep(600);
  check('cfg.fills[2] is hatch spacing 6', await js(`(() => { const f = __egisDebug.layerManager.getLayer('${layerId}')._choroplethConfig.fills; return f && f[2].kind === 'hatch' && f[2].spacing === 6; })()`));
  check('OL fill is CanvasPattern for class 2', await js(`(() => {
    const info = __egisDebug.layerManager.getLayer('${layerId}');
    const cfg = info._choroplethConfig;
    const feat = info.source.getFeatures().find((f) => __egisDebug.choroplethTool.getColorIndex(parseFloat(f.get('val')), cfg.breaks) === 2);
    const color = info.olLayer.getStyle()(feat).getFill().getColor();
    return typeof color === 'object' && color !== null;
  })()`));
  check('legend swatch has tile image', await js(`document.querySelector('#choropleth-legend-${layerId} .choropleth-legend-color[data-class="2"]').style.backgroundImage.startsWith('url("data:image/png')`));
  await capture(win, 'class-fill-02-hatch');

  // 4. 질감 탭 → 숲
  await js(`document.querySelector('.class-fill-kind[data-kind="texture"]').click()`);
  await sleep(200);
  await js(`document.querySelector('.cf-texture[data-name="forest"]').click()`);
  await sleep(600);
  check('cfg.fills[2] is forest texture', await js(`__egisDebug.layerManager.getLayer('${layerId}')._choroplethConfig.fills[2].name === 'forest'`));
  await capture(win, 'class-fill-03-texture');

  // 5. 프리셋 bw-hatch → 다섯 구간 모두 사선
  await js(`(() => { const s = document.querySelector('.class-fill-preset'); s.value = 'bw-hatch'; s.dispatchEvent(new Event('change', { bubbles: true })); document.querySelector('.class-fill-preset-apply').click(); })()`);
  await sleep(800);
  check('all five classes hatch', await js(`__egisDebug.layerManager.getLayer('${layerId}')._choroplethConfig.fills.every((f) => f.kind === 'hatch')`));
  await js(`document.querySelector('.class-fill-close').click()`);
  await sleep(300);
  await capture(win, 'class-fill-04-preset');

  // 6. 저장 왕복·복제 — fills 가 따라오고 공유되지 않는다
  check('serialize carries fills', await js(`(() => {
    const data = __egisDebug.projectManager.serialize();
    const l = data.layers.find((x) => x.choroplethConfig && x.choroplethConfig.fills);
    return !!l && l.choroplethConfig.fills.length === 5 && !('tool' in l.choroplethConfig);
  })()`));
  check('duplicate does not share fills', await js(`(() => {
    const dupId = __egisDebug.layerManager.duplicateLayer('${layerId}');
    const a = __egisDebug.layerManager.getLayer('${layerId}')._choroplethConfig.fills;
    const b = __egisDebug.layerManager.getLayer(dupId)._choroplethConfig.fills;
    const ok = a !== b && a[0] !== b[0] && b[0].kind === 'hatch';
    __egisDebug.layerManager.removeLayer(dupId);
    return ok;
  })()`));

  // 7. 내보내기 범례 — 미리보기에 패턴이 찍힌다 (육안)
  await js(`document.querySelector('[data-action="project-export"]').click()`);
  await sleep(1500);
  await js(`(() => { const cb = document.getElementById('opt-legend'); if (cb && !cb.checked) cb.click(); })()`);
  await sleep(2500);
  check('export preview canvas drawn', await js(`(() => { const c = document.getElementById('preview-canvas'); return !!c && c.width > 0; })()`));
  await js(`document.getElementById('preview-expand').click()`);
  await sleep(1500);
  await capture(win, 'class-fill-05-export-legend');
  await js(`document.getElementById('zoom-modal-close')?.click()`);
  await sleep(300);
  await js(`document.getElementById('export-close')?.click()`);
  await sleep(500);

  // 8. 되돌리기 → 끄기 → 원상
  await js(`document.querySelector('#choropleth-legend-${layerId} .choropleth-legend-color[data-class="0"]').click()`);
  await sleep(400);
  await js(`document.querySelector('.class-fill-reset').click()`);
  await sleep(600);
  check('fills removed after reset', await js(`!('fills' in __egisDebug.layerManager.getLayer('${layerId}')._choroplethConfig)`));
  check('popover still open after reset', await js(`!!document.querySelector('.class-fill-popover')`));
  await js(`__egisDebug.labs.set('class-fill', false)`);
  await sleep(300);
  check('popover closed and class removed when lab off', await js(`!document.querySelector('.class-fill-popover') && !document.getElementById('map').classList.contains('labs-class-fill')`));
  await js(`document.querySelector('#choropleth-legend-${layerId} .choropleth-legend-color[data-class="2"]').click()`);
  await sleep(300);
  check('click does nothing when lab off', await js(`!document.querySelector('.class-fill-popover')`));
  await capture(win, 'class-fill-06-after');

  app.quit();
});
```

- [ ] **Step 3: 실행**

```bash
cd "C:/Users/김용현/Desktop/vibecoding/eGIS/eStoryMap" && npx electron ../scripts/verify/labs-class-fill.cjs 2>&1 | grep -viE "devtools|deprecat|GPU|cache_util|disk_cache|quota_database|Security Warning"
```
Expected: `PASS` 16줄, `FAIL` 0줄, `scripts/verify/out/class-fill-0*.png` 7장. 캡처를 열어 확인할 것:
- `01-popover`: 범례 칸 옆에 팝오버, 탭 넷, 이모지 없음, 지도 안에 들어와 있다.
- `02-hatch`: 3구간 자치구가 사선으로 칠해져 있고 범례 3번째 칸도 같은 사선.
- `03-texture`: 3구간이 숲 질감(기준색 위 나무 기호).
- `04-preset`: 다섯 구간이 구간이 높을수록 촘촘한 검은 사선, 배경지도가 비친다.
- `05-export-legend`: 내보내기 미리보기 범례 기호가 지도와 같은 사선.
- `00-before` 와 `06-after`: 범례·지도가 같다(실험을 끄고 되돌린 뒤).

- [ ] **Step 4: 프리뷰 종료·커밋**

프리뷰 서버를 끝낸다(백그라운드 프로세스 종료). 캡처 폴더는 커밋하지 않는다(0단계가 `scripts/verify/.gitignore` 에 `out/` 을 넣었다).

```bash
git add scripts/verify/labs-class-fill.cjs
git -c user.name=yhk1m -c user.email=83273992+yhk1m@users.noreply.github.com commit -m "test(labs): 구간 채움 Electron 하네스"
```

---

### Task 11: 마무리

- [ ] **Step 1: 전체 확인**

```bash
npm test
rm -rf dist && npm run build
git status --short
```
Expected: 테스트 전부 PASS, 빌드 성공, 작업 트리 깨끗.

- [ ] **Step 2: 실험 끄면 정식 화면과 같은지 눈으로 재확인**

`class-fill-00-before.png` 와 `class-fill-06-after.png` 를 나란히 본다. 범례 칸의 커서·테두리를 포함해 달라진 곳이 없어야 한다. 실험을 끈 상태에서 기존 단계구분도(내장 시도 인구 등)를 하나 만들어 보고 투명도 슬라이더를 움직여 테두리 두께가 그대로인지도 본다(Task 3 의 통합 효과).

- [ ] **Step 3: 병합·배포**

`superpowers:finishing-a-development-branch` → `main` 병합 → `/cpd`. 배포 뒤 `https://www.e-gis.kr/?lab=class-fill` 로 열어(하드 새로고침) 단계구분도 범례 칸을 눌러 본다.

---

## 스펙 대조 (자체 검토)

| 스펙 항목 | 작업 |
|---|---|
| 채움 사양 6종(`solid·hatch·dots·cross·image·texture`), `background: class/none/hex`, 이미지 256px 재인코딩, 질감 5종 절차적 생성(고정 시드)·틴트 | Task 1(계획·정규화), Task 2(재인코딩) |
| `planFill`(캔버스 없이 테스트) / `renderFillCanvas` / `fillFor`(rgba 또는 CanvasPattern, JSON 키 메모) / `presetFills` / `normalizeFill` | Task 1, 2 |
| 범례 색 칸 `data-class`, `#map.labs-class-fill` 커서·호버, 클릭 시점에 `labs.isOn` 판정 | Task 6(칸·훅), Task 7(CSS), Task 8(가드) |
| 팝오버 4분할, 패턴 옵션(종류·색·간격 4~24·굵기·각도·배경), 이미지(파일·배율 0.25~4·불투명도·크기 표시), 질감(프리셋 5 타일·강도), 프리셋 3종, 팔레트로 되돌리기, 바깥 클릭·Esc | Task 7 |
| `setClassFill / setClassColor` → 설정 → `updateLayerStyle` → 범례 → `LAYER_STYLE_CHANGED` | Task 6 (`updateLayerStyle` 이 이벤트를 낸다) |
| 스타일 빌더 한 곳으로(`apply` 는 설정만), `classFillColor` 얇은 메서드, `Fill.color` 에 CanvasPattern | Task 3 |
| 지도 위 범례 칸 타일 `toDataURL`, 내보내기 `makeSymbol.fill` + `drawLegendSymbol` 패턴(`pixelScale: scale`) | Task 6, Task 5 |
| `StateManager.saveLayer`·`ProjectManager` 직렬화에 `fills`, 복제 깊은 복사, 이미지 크기 표시 | Task 4, Task 7 |
| 격자(`gridLayer`)는 같은 설정이라 자동 편집 가능, `GridPanel` 불변 | Task 6 (`configOf` 가 `_choroplethConfig` 만 본다) |
| 3D·PNG 내보내기는 OL 캔버스 캡처라 자동, 지구본은 같은 `fillFor` | 고정 규약 절 |
| 화면 고정 패턴 동작을 설명서에 한 줄 | Task 9 |
| 오류 처리: 이미지가 아니거나 디코딩 실패 → 상태줄, 설정 불변 | Task 7 (`status()`, `catch` 에서 `setClassFill` 을 부르지 않는다) |
| 레지스트리 항목은 구현 단계에서, 설명서 1-14 문단, 하네스(켜기→사용→캡처→끄기→복구) | Task 8, 9, 10 |
| 카토그램·되돌리기(HistoryManager)·히트맵 범위 밖 | 해당 없음 |

## 구현하며 바뀐 점

(구현 중 스펙과 다르게 결정한 것을 여기 적는다.)

- **Task 1 검토 보정** (`classFill.js`): (1) 광택 띠가 주기 2T 라 타일 오른쪽 끝에서 끊기던 것을 `x + y = (pos + j)·T`(j = 0..2, 주기 T) 세 벌로 바꾸고 끝을 띠 굵기만큼 늘려 이음매 없이 이어지게 했다. (2) 광택 바탕을 `#cfcfcf` 고정에서 강도에 비례한 회색(`255 − 48·strength`, 강도 1 = `#cfcfcf`)으로 바꿔 강도 0 이면 흰 바탕 → 틴트 뒤 정확히 기준색이 되게 했다(「강도 0 → 정확히 기준색」 규약). (3) `presetFills(name, NaN|undefined)` 가 `[]` 를 내던 것을 구간 하나로 본다. 테스트 3개 추가(21 → 24).
- **Task 7 검토 보정** (`ClassFillPopover.js`): (1) 바깥 클릭 닫기를 `document` 의 `mousedown` 에서 **캡처 단계 `pointerdown`** 으로 — 범례 끌기(`makeDraggable.onDown`, `DraggableElement.js`)가 버블 단계에서 `preventDefault`·`stopPropagation` 하므로 호환 `mousedown` 은 아예 발생하지 않고 팝오버가 고아로 남았다. 앵커(색 칸) 제외는 그대로. (2) `baseColor()` 가 `cfg.colors[i]` 를 `/^#[0-9a-f]{6}$/i` 로 검증하고 아니면 `#808080` — 저장본(.egis)이 검증 없이 펼쳐져 `value="…"`·`style="background:…"` 속성 밖으로 샐 수 있었다. (3) 이미지 재인코딩이 끝났을 때 팝오버가 닫혔거나 **다른 칸·다른 탭**으로 옮겨 갔으면 결과를 버린다(`this.tab !== 'image'` 추가), 그래서 본문 다시 그리기는 무조건. (4) 탭 전환·이미지 읽기 뒤에 `position()` 을 다시 불러 본문 높이가 달라져도 지도 밖으로 넘치지 않게. 테스트 10 → 14(`reencodeImageFile` 은 `vi.mock` 으로 원본을 감싸 지연시킨다). **Task 8 메모**: 색 칸을 눌렀는지 끌었는지의 구분(끌기 뒤 click 무시)은 바인딩 몫 — 캡처 단계 `pointerdown` 에서 좌표를 적어 두고 3px 넘게 움직였으면 click 을 건너뛴다.
- **Task 5 검토 보정** (`ExportTool.drawLegendSymbol`): (1) 단색 판정을 계획의 `fill.kind && fill.kind !== 'solid'` 대신 `classFill.isSolid(fill)` 로 — 모르는 `kind` 도 단색으로 물러선다. (2) 이미지 채움은 `getCachedImage(fill.dataUrl)` 로 디코딩 여부를 먼저 확인하고, 아직이면 패턴을 만들지 않고 기준색(`hexToRgba(fillColor, fillOpacity)`)을 남긴다. 안 읽힌 이미지는 `planFill` 이 `background: null` 이라 `renderFillCanvas` 가 null 이 아니라 **빈 타일**을 내므로, 그대로 두면 투명 패턴으로 칠해져 지도(`fillFor` → `plan.fallback`)와 달라진다.
