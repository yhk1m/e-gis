# 실험실 0단계 — 껍데기 + 글래스 UI 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 툴바에 반짝이는 **실험실** 버튼과 실험 목록 창을 만들고, 첫 실험으로 글래스 UI 토글을 붙인다. 이후 단계(구간 채움·지구본·스와이프·시계열)가 `labs.isOn(id)` 한 줄로 자기 기능을 가릴 수 있는 스위치를 제공한다.

**Architecture:** 상태(`src/labs/labs.js`)는 DOM 을 모르는 순수 모듈로 두고 localStorage 와 `?lab=` 을 주입받는다. 목록(`registry.js`)은 구현된 실험만 갖는다. 창(`LabPanel`)은 스위치만 쥐고, 글래스는 `documentElement` 의 `data-surface="glass"` 속성과 `glass.css` 로만 동작한다. 실험 기능은 실험실 창 안이 아니라 자기 자리에서 `labs.isOn()` 으로 가려진다 — 승격 = 가드 삭제.

**Tech Stack:** Vanilla JS(ES modules), OpenLayers 9(건드리지 않음), vitest(노드 환경, DOM 테스트만 `@vitest-environment jsdom`), Vite, Electron 하네스(`.claude/skills/verify`).

**Spec:** `docs/superpowers/specs/2026-09-25-labs-design.md` — 「0단계」 두 절과 「공통」. 이 계획서와 스펙이 어긋나면 스펙이 맞다.

---

## 실행 방법 (서브에이전트)

- 저장소: `C:/Users/김용현/Desktop/vibecoding/eGIS`. 브랜치 `labs-shell` 을 `main` 에서 딴다 (`git checkout -b labs-shell main`).
- **작업(Task)마다 새 서브에이전트**를 띄운다(`superpowers:subagent-driven-development`). 구현자·스펙 검토자·코드 검토자 모두 **Fable 5.1**(세션 모델 그대로, `model` 지정 없이 fork/general-purpose). 한 작업이 끝나면 스펙 준수 검토 → 코드 품질 검토 → 다음 작업.
- 서브에이전트에게 넘길 것: 이 파일의 해당 Task 전체 본문 + 스펙 경로 + "코드는 그대로 쓰되 실제 파일과 줄이 어긋나면 파일을 읽고 맞춘다".
- 커밋은 반드시 파일을 지정해서(`git add <파일들>`), `git add -A` 금지. 작성자는 매번 `git -c user.name=yhk1m -c user.email=83273992+yhk1m@users.noreply.github.com commit …` (Vercel 이 다른 이메일의 커밋을 막는다).
- Write 훅이 새 파일 머리에 `// © 2026 김용현` 을 넣는다. 지우지 않는다. 아래 코드 블록에도 그 줄을 적어 두었으니 중복되면 하나만 남긴다.
- 테스트: `npm test` (vitest run). 빌드: `rm -rf dist && npm run build`. 화면: Task 9 의 Electron 하네스.
- 이모지는 UI 에 넣지 않는다. 아이콘은 선 SVG.
- 끝나면 `superpowers:finishing-a-development-branch` 로 `main` 병합 → `/cpd` 배포.

## 파일 구조

| 파일 | 역할 |
|---|---|
| `src/labs/labs.js` (새) | 실험 상태. `Labs` 클래스 + 싱글톤 `labs`. 저장·URL 덮어쓰기·구독 |
| `src/labs/labs.test.js` (새) | 상태 규칙 테스트 |
| `src/labs/registry.js` (새) | `EXPERIMENTS`, `EXPERIMENT_IDS`, `FEEDBACK_URL` |
| `src/labs/registry.test.js` (새) | 목록 형식 검사 |
| `src/labs/glass.js` (새) | `applyGlass`, `bindGlass` — `data-surface` 속성 |
| `src/labs/glass.test.js` (새) | 속성 켜고 끄기 |
| `src/labs/labsButton.js` (새) | 툴바 버튼 배지(켜진 실험 수) 갱신 |
| `src/labs/labsButton.test.js` (새) | 배지 규칙 |
| `src/ui/panels/LabPanel.js` (새) | 실험실 창(모달) |
| `src/ui/panels/LabPanel.test.js` (새) | jsdom 으로 카드·스위치·링크 검사 |
| `src/styles/glass.css` (새) | `[data-surface="glass"]` 규칙 전부 |
| `src/styles/main.css` (수정) | `@import './glass.css'`, `.btn-labs` 반짝임·배지, 실험실 창 스타일 |
| `src/ui/layout/AppLayout.js` (수정) | 툴바 `data-group="labs"` 묶음 |
| `src/main.js` (수정) | import, `labs.init`, `bindGlass`, `bindLabsButton`, 툴바 `case 'labs'`, `__egisDebug.labs` |
| `docs/사용설명서.md` (수정) | 1-14 실험실 절, 기존 1-14 → 1-15, 목차 |
| `scripts/verify/labs-shell.cjs` (새) | Electron 하네스 시나리오 |

---

### Task 1: 실험 상태 모듈 `labs.js`

**Files:**
- Create: `src/labs/labs.js`
- Test: `src/labs/labs.test.js`

- [ ] **Step 1: 실패하는 테스트 작성**

`src/labs/labs.test.js`:

```js
// © 2026 김용현
/**
 * 실험실 상태 규칙.
 * - 기본은 전부 꺼짐. 저장값은 localStorage 'eGIS_labs' 한 키.
 * - ?lab=a,b / all / none 은 그 세션만 덮어쓴다. 저장값은 건드리지 않는다.
 * - 레지스트리에 없는 id 는 언제나 꺼짐(저장돼 있어도).
 * - 저장소가 죽어 있어도(사생활 모드) 예외 없이 전부 꺼진 채로 간다.
 */
import { describe, it, expect, vi } from 'vitest';
import { Labs, parseLabQuery, LABS_STORAGE_KEY } from './labs.js';

const KNOWN = ['glass', 'globe'];

function fakeStorage(initial = {}) {
  const data = { ...initial };
  return {
    getItem: (k) => (k in data ? data[k] : null),
    setItem: (k, v) => { data[k] = String(v); },
    removeItem: (k) => { delete data[k]; },
    dump: () => data
  };
}

function brokenStorage() {
  const boom = () => { throw new Error('SecurityError'); };
  return { getItem: boom, setItem: boom, removeItem: boom };
}

function make({ search = '', storage = fakeStorage(), knownIds = KNOWN, baseUrl = 'https://e-gis.kr/' } = {}) {
  const labs = new Labs();
  labs.init({ search, storage, knownIds, baseUrl });
  return { labs, storage };
}

describe('parseLabQuery', () => {
  it('매개변수가 없으면 null', () => {
    expect(parseLabQuery('', KNOWN)).toBeNull();
    expect(parseLabQuery('?x=1', KNOWN)).toBeNull();
  });

  it('쉼표 목록은 그 id 만 켜고 모르는 id 는 버린다', () => {
    expect(parseLabQuery('?lab=glass,zzz', KNOWN)).toEqual({ glass: true });
    expect(parseLabQuery('?lab=%20globe%20,glass', KNOWN)).toEqual({ glass: true, globe: true });
  });

  it('all 은 전부 켜고 none 은 전부 끈다', () => {
    expect(parseLabQuery('?lab=all', KNOWN)).toEqual({ glass: true, globe: true });
    expect(parseLabQuery('?lab=none', KNOWN)).toEqual({ glass: false, globe: false });
  });
});

describe('Labs', () => {
  it('기본은 전부 꺼짐', () => {
    const { labs } = make();
    expect(labs.isOn('glass')).toBe(false);
    expect(labs.enabledIds()).toEqual([]);
  });

  it('set 은 저장하고 isOn 에 바로 반영된다', () => {
    const { labs, storage } = make();
    labs.set('glass', true);
    expect(labs.isOn('glass')).toBe(true);
    expect(JSON.parse(storage.dump()[LABS_STORAGE_KEY])).toEqual({ glass: true });
  });

  it('저장값을 init 때 읽는다', () => {
    const storage = fakeStorage({ [LABS_STORAGE_KEY]: JSON.stringify({ globe: true }) });
    const { labs } = make({ storage });
    expect(labs.isOn('globe')).toBe(true);
    expect(labs.isOn('glass')).toBe(false);
  });

  it('모르는 id 는 저장돼 있어도 꺼짐이고 set 해도 저장되지 않는다', () => {
    const storage = fakeStorage({ [LABS_STORAGE_KEY]: JSON.stringify({ retired: true }) });
    const { labs } = make({ storage });
    expect(labs.isOn('retired')).toBe(false);
    labs.set('retired', true);
    expect(labs.isOn('retired')).toBe(false);
    expect(JSON.parse(storage.dump()[LABS_STORAGE_KEY])).toEqual({ retired: true });
  });

  it('URL 덮어쓰기는 저장값보다 우선하고 저장값을 바꾸지 않는다', () => {
    const storage = fakeStorage({ [LABS_STORAGE_KEY]: JSON.stringify({ glass: true }) });
    const { labs } = make({ storage, search: '?lab=none' });
    expect(labs.isOn('glass')).toBe(false);
    expect(JSON.parse(storage.dump()[LABS_STORAGE_KEY])).toEqual({ glass: true });
  });

  it('패널에서 set 하면 그 id 의 덮어쓰기가 풀리고 저장된다', () => {
    const { labs, storage } = make({ search: '?lab=glass' });
    expect(labs.isOn('glass')).toBe(true);
    labs.set('glass', false);
    expect(labs.isOn('glass')).toBe(false);
    expect(JSON.parse(storage.dump()[LABS_STORAGE_KEY])).toEqual({ glass: false });
  });

  it('toggle 은 현재 값을 뒤집는다', () => {
    const { labs } = make();
    labs.toggle('glass');
    expect(labs.isOn('glass')).toBe(true);
    labs.toggle('glass');
    expect(labs.isOn('glass')).toBe(false);
  });

  it('enabledIds 는 레지스트리 순서를 따른다', () => {
    const { labs } = make();
    labs.set('globe', true);
    labs.set('glass', true);
    expect(labs.enabledIds()).toEqual(['glass', 'globe']);
  });

  it('shareUrl 은 켜진 id 로 ?lab= 을 붙이고, 없으면 기본 주소', () => {
    const { labs } = make();
    expect(labs.shareUrl()).toBe('https://e-gis.kr/');
    labs.set('glass', true);
    labs.set('globe', true);
    expect(labs.shareUrl()).toBe('https://e-gis.kr/?lab=glass,globe');
  });

  it('onChange 는 (id, on) 을 받고 해제할 수 있다', () => {
    const { labs } = make();
    const cb = vi.fn();
    const off = labs.onChange(cb);
    labs.set('glass', true);
    expect(cb).toHaveBeenCalledWith('glass', true);
    off();
    labs.set('glass', false);
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it('저장소가 죽어 있어도 예외 없이 전부 꺼짐, set 도 예외 없음', () => {
    const { labs } = make({ storage: brokenStorage() });
    expect(labs.isOn('glass')).toBe(false);
    expect(() => labs.set('glass', true)).not.toThrow();
    expect(labs.isOn('glass')).toBe(true);   // 세션 안에서는 유지된다
  });

  it('저장값이 JSON 이 아니면 무시한다', () => {
    const storage = fakeStorage({ [LABS_STORAGE_KEY]: '{oops' });
    const { labs } = make({ storage });
    expect(labs.enabledIds()).toEqual([]);
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run src/labs/labs.test.js`
Expected: FAIL — `Failed to resolve import "./labs.js"`.

- [ ] **Step 3: 구현**

`src/labs/labs.js`:

```js
// © 2026 김용현
/**
 * 실험실 상태 — 어떤 실험이 켜져 있는지만 안다.
 *
 * DOM·OpenLayers 를 모른다. storage(localStorage 모양)와 search(location.search)를
 * 주입받아 노드에서 그대로 테스트한다.
 *
 * 우선순위: URL 덮어쓰기(?lab=) > 저장값(eGIS_labs) > 꺼짐.
 * 레지스트리(knownIds)에 없는 id 는 언제나 꺼짐 — 아직 구현 안 된 실험을
 * 저장값이나 URL 로 켤 수 없고, 승격 뒤 남은 저장값도 그냥 무시된다.
 * 설계: docs/superpowers/specs/2026-09-25-labs-design.md
 */

export const LABS_STORAGE_KEY = 'eGIS_labs';
export const LAB_QUERY_PARAM = 'lab';

/**
 * ?lab=… 을 읽는다.
 * @param {string} search location.search
 * @param {string[]} knownIds 레지스트리의 id 들
 * @returns {Object<string, boolean>|null} 덮어쓸 id → 켜짐. 매개변수가 없으면 null.
 */
export function parseLabQuery(search, knownIds) {
  const params = new URLSearchParams(search || '');
  const raw = params.get(LAB_QUERY_PARAM);
  if (raw === null) return null;
  const value = raw.trim();
  if (value === 'all') return Object.fromEntries(knownIds.map((id) => [id, true]));
  if (value === 'none') return Object.fromEntries(knownIds.map((id) => [id, false]));
  const wanted = new Set(value.split(',').map((s) => s.trim()).filter(Boolean));
  const override = {};
  knownIds.forEach((id) => { if (wanted.has(id)) override[id] = true; });
  return override;
}

function readStored(storage) {
  try {
    const raw = storage ? storage.getItem(LABS_STORAGE_KEY) : null;
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function writeStored(storage, state) {
  try {
    if (storage) storage.setItem(LABS_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // 사생활 모드·용량 초과 — 세션 안에서만 유지된다
  }
}

export class Labs {
  constructor() {
    this.knownIds = [];
    this.stored = {};
    this.override = {};
    this.storage = null;
    this.baseUrl = '';
    this.listeners = new Set();
  }

  /**
   * @param {{search?: string, storage?: Storage|null, knownIds?: string[], baseUrl?: string}} options
   */
  init({ search = '', storage = null, knownIds = [], baseUrl = '' } = {}) {
    this.knownIds = knownIds.slice();
    this.storage = storage;
    this.baseUrl = baseUrl;
    this.stored = readStored(storage);
    this.override = parseLabQuery(search, this.knownIds) || {};
  }

  isKnown(id) {
    return this.knownIds.includes(id);
  }

  isOn(id) {
    if (!this.isKnown(id)) return false;
    if (Object.prototype.hasOwnProperty.call(this.override, id)) return this.override[id];
    return this.stored[id] === true;
  }

  set(id, on) {
    if (!this.isKnown(id)) return;
    const next = Boolean(on);
    delete this.override[id];
    this.stored[id] = next;
    writeStored(this.storage, this.stored);
    this.listeners.forEach((cb) => cb(id, next));
  }

  toggle(id) {
    this.set(id, !this.isOn(id));
  }

  /** 켜진 실험 id — 레지스트리 순서 */
  enabledIds() {
    return this.knownIds.filter((id) => this.isOn(id));
  }

  /** 켜진 상태 그대로 여는 주소 (시연·테스터 링크) */
  shareUrl() {
    const ids = this.enabledIds();
    return ids.length ? `${this.baseUrl}?${LAB_QUERY_PARAM}=${ids.join(',')}` : this.baseUrl;
  }

  /**
   * @param {(id: string, on: boolean) => void} cb
   * @returns {() => void} 해제 함수
   */
  onChange(cb) {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }
}

export const labs = new Labs();
```

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run src/labs/labs.test.js`
Expected: PASS (15 tests).

- [ ] **Step 5: 커밋**

```bash
git add src/labs/labs.js src/labs/labs.test.js
git -c user.name=yhk1m -c user.email=83273992+yhk1m@users.noreply.github.com commit -m "feat(labs): 실험 상태 모듈 — 저장값·?lab= 덮어쓰기·구독"
```

---

### Task 2: 레지스트리 `registry.js`

**Files:**
- Create: `src/labs/registry.js`
- Test: `src/labs/registry.test.js`

- [ ] **Step 1: 실패하는 테스트 작성**

`src/labs/registry.test.js`:

```js
// © 2026 김용현
/**
 * 실험 목록 형식. 목록은 "구현된 실험"만 가진다 — 사용자가 켰는데 아무 일도
 * 안 일어나는 카드가 있으면 안 된다. id 는 URL(?lab=a,b)과 저장 키에 쓰이므로
 * 쉼표·공백 없는 소문자 kebab-case 여야 한다.
 */
import { describe, it, expect } from 'vitest';
import { EXPERIMENTS, EXPERIMENT_IDS, FEEDBACK_URL } from './registry.js';

describe('EXPERIMENTS', () => {
  it('항목마다 id·name·summary·since 가 있다', () => {
    expect(EXPERIMENTS.length).toBeGreaterThan(0);
    for (const e of EXPERIMENTS) {
      expect(e.id).toMatch(/^[a-z][a-z0-9-]*$/);
      expect(typeof e.name).toBe('string');
      expect(e.name.length).toBeGreaterThan(0);
      expect(typeof e.summary).toBe('string');
      expect(e.summary.length).toBeGreaterThan(0);
      expect(e.since).toMatch(/^\d{4}-\d{2}$/);
    }
  });

  it('id 는 겹치지 않고 EXPERIMENT_IDS 와 순서가 같다', () => {
    const ids = EXPERIMENTS.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(EXPERIMENT_IDS).toEqual(ids);
  });

  it('0단계에는 glass 가 들어 있다', () => {
    expect(EXPERIMENT_IDS).toContain('glass');
  });

  it('FEEDBACK_URL 은 비어 있거나 https 주소다', () => {
    expect(FEEDBACK_URL === '' || /^https:\/\//.test(FEEDBACK_URL)).toBe(true);
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run src/labs/registry.test.js`
Expected: FAIL — `Failed to resolve import "./registry.js"`.

- [ ] **Step 3: 구현**

`src/labs/registry.js`:

```js
// © 2026 김용현
/**
 * 실험 목록 — 실험실 창에 보이는 카드.
 *
 * 구현된 실험만 적는다. 단계가 끝날 때 한 줄씩 늘고, 정식 승격 때 한 줄씩 준다.
 * id 는 URL(?lab=a,b)·저장 키·labs.isOn(id) 에 그대로 쓰인다.
 * 설계: docs/superpowers/specs/2026-09-25-labs-design.md
 */

export const EXPERIMENTS = [
  {
    id: 'glass',
    name: '글래스 UI',
    summary: '패널·메뉴·범례를 반투명 유리로 보여줍니다.',
    since: '2026-09'
  }
];

export const EXPERIMENT_IDS = EXPERIMENTS.map((e) => e.id);

/** 의견 보내기(구글 폼) 주소. 비어 있으면 카드에 링크가 안 보인다. */
export const FEEDBACK_URL = '';
```

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run src/labs/registry.test.js`
Expected: PASS (4 tests).

- [ ] **Step 5: 커밋**

```bash
git add src/labs/registry.js src/labs/registry.test.js
git -c user.name=yhk1m -c user.email=83273992+yhk1m@users.noreply.github.com commit -m "feat(labs): 실험 목록 — glass 한 항목, 의견 링크 상수"
```

---

### Task 3: 글래스 속성 `glass.js` + `glass.css`

**Files:**
- Create: `src/labs/glass.js`, `src/labs/glass.test.js`, `src/styles/glass.css`
- Modify: `src/styles/main.css:5-7` (`@import` 줄)

- [ ] **Step 1: 실패하는 테스트 작성**

`src/labs/glass.test.js`:

```js
// © 2026 김용현
/**
 * 글래스 UI 는 documentElement 의 data-surface="glass" 속성 하나로 켜진다.
 * CSS(glass.css)가 그 속성만 보므로 JS 는 속성을 붙이고 떼는 것이 전부다.
 */
import { describe, it, expect } from 'vitest';
import { applyGlass, bindGlass, GLASS_ATTR } from './glass.js';
import { Labs } from './labs.js';

function fakeRoot() {
  const attrs = {};
  return {
    setAttribute: (k, v) => { attrs[k] = v; },
    removeAttribute: (k) => { delete attrs[k]; },
    getAttribute: (k) => (k in attrs ? attrs[k] : null)
  };
}

describe('applyGlass', () => {
  it('켜면 data-surface="glass", 끄면 속성 제거', () => {
    const root = fakeRoot();
    applyGlass(true, root);
    expect(root.getAttribute(GLASS_ATTR)).toBe('glass');
    applyGlass(false, root);
    expect(root.getAttribute(GLASS_ATTR)).toBeNull();
  });
});

describe('bindGlass', () => {
  it('초기 상태를 바로 적용하고, 이후 glass 변경만 따른다', () => {
    const labs = new Labs();
    labs.init({ knownIds: ['glass', 'globe'], search: '?lab=glass' });
    const root = fakeRoot();
    const off = bindGlass(labs, root);
    expect(root.getAttribute(GLASS_ATTR)).toBe('glass');

    labs.set('globe', true);                 // 다른 실험은 영향 없음
    expect(root.getAttribute(GLASS_ATTR)).toBe('glass');

    labs.set('glass', false);
    expect(root.getAttribute(GLASS_ATTR)).toBeNull();

    off();
    labs.set('glass', true);
    expect(root.getAttribute(GLASS_ATTR)).toBeNull();   // 해제 뒤엔 안 따른다
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run src/labs/glass.test.js`
Expected: FAIL — `Failed to resolve import "./glass.js"`.

- [ ] **Step 3: 구현**

`src/labs/glass.js`:

```js
// © 2026 김용현
/**
 * 글래스 UI — documentElement 의 data-surface="glass" 속성 하나.
 *
 * 색·블러는 전부 src/styles/glass.css 가 그 속성을 보고 정한다.
 * 라이트·다크(data-theme)와 직교라 넷 다 조합된다.
 */

export const GLASS_ATTR = 'data-surface';
export const GLASS_ID = 'glass';

export function applyGlass(on, root = document.documentElement) {
  if (on) root.setAttribute(GLASS_ATTR, 'glass');
  else root.removeAttribute(GLASS_ATTR);
}

/**
 * 지금 상태를 적용하고 이후 변경을 따른다.
 * @returns {() => void} 해제 함수
 */
export function bindGlass(labs, root = document.documentElement) {
  applyGlass(labs.isOn(GLASS_ID), root);
  return labs.onChange((id, on) => {
    if (id === GLASS_ID) applyGlass(on, root);
  });
}
```

`src/styles/glass.css`:

```css
/**
 * 글래스 UI (실험실 `glass`)
 *
 * documentElement 에 data-surface="glass" 가 붙었을 때만 산다.
 * 색 토큰을 반투명으로 바꾸고, 지도 위에 얹히는 면에만 backdrop-filter 를 건다.
 * 글자 색 토큰은 손대지 않는다 — 대비는 배경 불투명도로 지킨다.
 *
 * 성능: 지도 위 부유 요소는 지도가 다시 그려질 때마다 블러를 재계산하므로
 * 블러 반경을 절반으로 두고, 태블릿·휴대폰과 "투명도 줄이기" 설정에서는 블러를 뺀다.
 * 내보내기(html2canvas)는 backdrop-filter 를 못 그리므로 body.exporting 동안 불투명으로 돌린다.
 */

[data-surface="glass"] {
  --glass-blur: 14px;
  --glass-blur-float: 7px;
  --glass-border: rgba(255, 255, 255, 0.45);
  --glass-highlight: rgba(255, 255, 255, 0.6);
  --bg-solid-fallback: #ffffff;

  --bg-panel: rgba(255, 255, 255, 0.62);
  --bg-menubar: rgba(255, 255, 255, 0.62);
  --bg-toolbar: rgba(255, 255, 255, 0.62);
  --bg-statusbar: rgba(241, 245, 249, 0.62);
  --map-overlay-bg: rgba(255, 255, 255, 0.62);
}

[data-theme="dark"][data-surface="glass"] {
  --glass-border: rgba(255, 255, 255, 0.12);
  --glass-highlight: rgba(255, 255, 255, 0.18);
  --bg-solid-fallback: #1e293b;

  --bg-panel: rgba(30, 41, 59, 0.55);
  --bg-menubar: rgba(30, 41, 59, 0.55);
  --bg-toolbar: rgba(30, 41, 59, 0.55);
  --bg-statusbar: rgba(30, 41, 59, 0.55);
  --map-overlay-bg: rgba(30, 41, 59, 0.55);
}

/* 큰 면 — 지도 옆·위에 고정된 틀 */
[data-surface="glass"] #menubar,
[data-surface="glass"] #toolbar,
[data-surface="glass"] #left-panel,
[data-surface="glass"] #statusbar,
[data-surface="glass"] .modal,
[data-surface="glass"] .modal-content {
  -webkit-backdrop-filter: blur(var(--glass-blur)) saturate(140%);
  backdrop-filter: blur(var(--glass-blur)) saturate(140%);
  border-color: var(--glass-border);
  box-shadow: inset 0 1px 0 var(--glass-highlight), var(--shadow-md);
}

/* 지도 위 부유 요소 — 블러 반경 절반 */
[data-surface="glass"] .choropleth-legend,
[data-surface="glass"] .cartogram-legend,
[data-surface="glass"] .heatmap-legend,
[data-surface="glass"] .feature-info-card,
[data-surface="glass"] .egis-basemap-panel,
[data-surface="glass"] .view3d-panel {
  -webkit-backdrop-filter: blur(var(--glass-blur-float)) saturate(140%);
  backdrop-filter: blur(var(--glass-blur-float)) saturate(140%);
  border: 1px solid var(--glass-border);
  box-shadow: inset 0 1px 0 var(--glass-highlight), var(--shadow-md);
}

/* 태블릿·휴대폰: 블러 없이 반투명만 (GPU 를 아낀다) */
@media (pointer: coarse) and (max-width: 1366px) {
  [data-surface="glass"] #menubar,
  [data-surface="glass"] #toolbar,
  [data-surface="glass"] #left-panel,
  [data-surface="glass"] #statusbar,
  [data-surface="glass"] .modal,
  [data-surface="glass"] .modal-content,
  [data-surface="glass"] .choropleth-legend,
  [data-surface="glass"] .cartogram-legend,
  [data-surface="glass"] .heatmap-legend,
  [data-surface="glass"] .feature-info-card,
  [data-surface="glass"] .egis-basemap-panel,
  [data-surface="glass"] .view3d-panel {
    -webkit-backdrop-filter: none;
    backdrop-filter: none;
  }
}

/* 시스템 "투명도 줄이기": 블러 없이, 배경은 거의 불투명 */
@media (prefers-reduced-transparency: reduce) {
  [data-surface="glass"] {
    --bg-panel: rgba(255, 255, 255, 0.94);
    --bg-menubar: rgba(255, 255, 255, 0.94);
    --bg-toolbar: rgba(255, 255, 255, 0.94);
    --bg-statusbar: rgba(241, 245, 249, 0.94);
    --map-overlay-bg: rgba(255, 255, 255, 0.94);
  }
  [data-theme="dark"][data-surface="glass"] {
    --bg-panel: rgba(30, 41, 59, 0.94);
    --bg-menubar: rgba(30, 41, 59, 0.94);
    --bg-toolbar: rgba(30, 41, 59, 0.94);
    --bg-statusbar: rgba(30, 41, 59, 0.94);
    --map-overlay-bg: rgba(30, 41, 59, 0.94);
  }
  [data-surface="glass"] #menubar,
  [data-surface="glass"] #toolbar,
  [data-surface="glass"] #left-panel,
  [data-surface="glass"] #statusbar,
  [data-surface="glass"] .modal,
  [data-surface="glass"] .modal-content,
  [data-surface="glass"] .choropleth-legend,
  [data-surface="glass"] .cartogram-legend,
  [data-surface="glass"] .heatmap-legend,
  [data-surface="glass"] .feature-info-card,
  [data-surface="glass"] .egis-basemap-panel,
  [data-surface="glass"] .view3d-panel {
    -webkit-backdrop-filter: none;
    backdrop-filter: none;
  }
}

/* 내보내기 중: 범례는 불투명·블러 없음 (html2canvas 가 backdrop-filter 를 못 그린다) */
body.exporting [data-surface="glass"] .choropleth-legend,
body.exporting [data-surface="glass"] .cartogram-legend,
body.exporting [data-surface="glass"] .heatmap-legend,
[data-surface="glass"] body.exporting .choropleth-legend,
[data-surface="glass"] body.exporting .cartogram-legend,
[data-surface="glass"] body.exporting .heatmap-legend {
  -webkit-backdrop-filter: none;
  backdrop-filter: none;
  background: var(--bg-solid-fallback);
}
```

> `data-surface` 는 `<html>` 에, `exporting` 은 `<body>` 에 붙으므로 실제로 맞는 선택자는 `[data-surface="glass"] body.exporting .choropleth-legend` 쪽이다. 앞쪽 셋은 방어용이며 해가 없다.

`src/styles/main.css` 5~7행의 import 묶음 끝에 한 줄:

```css
@import './variables.css';
@import './layout.css';
@import './panels.css';
@import './glass.css';
```

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run src/labs/glass.test.js`
Expected: PASS (2 tests).

- [ ] **Step 5: 커밋**

```bash
git add src/labs/glass.js src/labs/glass.test.js src/styles/glass.css src/styles/main.css
git -c user.name=yhk1m -c user.email=83273992+yhk1m@users.noreply.github.com commit -m "feat(labs): 글래스 UI — data-surface 속성과 glass.css"
```

---

### Task 4: 툴바 버튼 배지 `labsButton.js`

**Files:**
- Create: `src/labs/labsButton.js`
- Test: `src/labs/labsButton.test.js`

- [ ] **Step 1: 실패하는 테스트 작성**

`src/labs/labsButton.test.js`:

```js
// © 2026 김용현
/**
 * 툴바 실험실 버튼의 배지 = 켜진 실험 수. 0이면 숨긴다.
 * 버튼 title 에도 수를 적어 마우스를 올리면 알 수 있게 한다.
 */
import { describe, it, expect } from 'vitest';
import { bindLabsButton, renderLabsBadge } from './labsButton.js';
import { Labs } from './labs.js';

function fakeButton() {
  const badge = { textContent: '', hidden: true };
  return {
    badge,
    title: '',
    querySelector: (sel) => (sel === '.labs-badge' ? badge : null)
  };
}

describe('renderLabsBadge', () => {
  it('0이면 숨기고 아니면 수를 보인다', () => {
    const btn = fakeButton();
    renderLabsBadge(btn, 0);
    expect(btn.badge.hidden).toBe(true);
    expect(btn.title).toBe('실험실 — 검증 중인 기능');
    renderLabsBadge(btn, 2);
    expect(btn.badge.hidden).toBe(false);
    expect(btn.badge.textContent).toBe('2');
    expect(btn.title).toBe('실험실 — 검증 중인 기능 (2개 켜짐)');
  });
});

describe('bindLabsButton', () => {
  it('초기 수를 그리고 변경을 따른다', () => {
    const labs = new Labs();
    labs.init({ knownIds: ['glass', 'globe'], search: '?lab=glass' });
    const btn = fakeButton();
    const off = bindLabsButton(labs, btn);
    expect(btn.badge.textContent).toBe('1');
    labs.set('globe', true);
    expect(btn.badge.textContent).toBe('2');
    off();
    labs.set('globe', false);
    expect(btn.badge.textContent).toBe('2');
  });

  it('버튼이 없으면 아무 일도 하지 않는다', () => {
    const labs = new Labs();
    labs.init({ knownIds: ['glass'] });
    expect(() => bindLabsButton(labs, null)()).not.toThrow();
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run src/labs/labsButton.test.js`
Expected: FAIL — `Failed to resolve import "./labsButton.js"`.

- [ ] **Step 3: 구현**

`src/labs/labsButton.js`:

```js
// © 2026 김용현
/**
 * 툴바 실험실 버튼 — 켜진 실험 수 배지.
 * 반짝임은 CSS(.btn-labs)가 맡고, 여기서는 숫자만 갱신한다.
 */

const BASE_TITLE = '실험실 — 검증 중인 기능';

export function renderLabsBadge(button, count) {
  if (!button) return;
  const badge = button.querySelector('.labs-badge');
  if (badge) {
    badge.textContent = count > 0 ? String(count) : '';
    badge.hidden = count === 0;
  }
  button.title = count > 0 ? `${BASE_TITLE} (${count}개 켜짐)` : BASE_TITLE;
}

/**
 * @returns {() => void} 해제 함수
 */
export function bindLabsButton(labs, button) {
  if (!button) return () => {};
  renderLabsBadge(button, labs.enabledIds().length);
  return labs.onChange(() => renderLabsBadge(button, labs.enabledIds().length));
}
```

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run src/labs/labsButton.test.js`
Expected: PASS (3 tests).

- [ ] **Step 5: 커밋**

```bash
git add src/labs/labsButton.js src/labs/labsButton.test.js
git -c user.name=yhk1m -c user.email=83273992+yhk1m@users.noreply.github.com commit -m "feat(labs): 툴바 버튼 배지 — 켜진 실험 수"
```

---

### Task 5: 실험실 창 `LabPanel.js`

**Files:**
- Create: `src/ui/panels/LabPanel.js`
- Test: `src/ui/panels/LabPanel.test.js` (jsdom)

- [ ] **Step 1: 실패하는 테스트 작성**

`src/ui/panels/LabPanel.test.js`:

```js
// @vitest-environment jsdom
// © 2026 김용현
/**
 * 실험실 창: 카드마다 스위치, 스위치는 labs 상태를 그대로 비추고 누르면 뒤집는다.
 * 의견 링크는 주소가 있을 때만, 공유 주소는 켜진 실험을 반영한다.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { LabPanel } from './LabPanel.js';
import { Labs } from '../../labs/labs.js';

const EXPS = [
  { id: 'glass', name: '글래스 UI', summary: '유리처럼', since: '2026-09' },
  { id: 'globe', name: '지구본', summary: '둥글게', since: '2026-09' }
];

function makeLabs(search = '') {
  const labs = new Labs();
  labs.init({ knownIds: EXPS.map((e) => e.id), search, baseUrl: 'https://e-gis.kr/' });
  return labs;
}

beforeEach(() => { document.body.innerHTML = ''; });

describe('LabPanel', () => {
  it('실험마다 카드와 스위치를 만들고 상태를 비춘다', () => {
    const labs = makeLabs('?lab=globe');
    const panel = new LabPanel({ labs, experiments: EXPS, feedbackUrl: '' });
    panel.show();
    const switches = document.querySelectorAll('.labs-switch');
    expect(switches).toHaveLength(2);
    expect(switches[0].getAttribute('aria-checked')).toBe('false');
    expect(switches[1].getAttribute('aria-checked')).toBe('true');
    expect(document.querySelector('.labs-card-name').textContent).toBe('글래스 UI');
    panel.close();
  });

  it('스위치를 누르면 labs 가 바뀌고 aria-checked 와 공유 주소가 따라온다', () => {
    const labs = makeLabs();
    const panel = new LabPanel({ labs, experiments: EXPS, feedbackUrl: '' });
    panel.show();
    const sw = document.querySelector('.labs-switch[data-id="glass"]');
    sw.click();
    expect(labs.isOn('glass')).toBe(true);
    expect(sw.getAttribute('aria-checked')).toBe('true');
    expect(document.querySelector('#labs-share-url').value).toBe('https://e-gis.kr/?lab=glass');
    panel.close();
  });

  it('의견 링크는 주소가 있을 때만 보인다', () => {
    const labs = makeLabs();
    let panel = new LabPanel({ labs, experiments: EXPS, feedbackUrl: '' });
    panel.show();
    expect(document.querySelector('.labs-feedback')).toBeNull();
    panel.close();

    panel = new LabPanel({ labs, experiments: EXPS, feedbackUrl: 'https://forms.gle/abc' });
    panel.show();
    const link = document.querySelector('.labs-feedback');
    expect(link.getAttribute('href')).toBe('https://forms.gle/abc');
    expect(link.getAttribute('target')).toBe('_blank');
    expect(link.getAttribute('rel')).toContain('noopener');
    panel.close();
  });

  it('닫기 버튼·Esc·바깥 클릭으로 닫힌다', () => {
    const labs = makeLabs();
    const panel = new LabPanel({ labs, experiments: EXPS, feedbackUrl: '' });
    panel.show();
    document.querySelector('#labs-close').click();
    expect(document.querySelector('.labs-modal')).toBeNull();

    panel.show();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(document.querySelector('.labs-modal')).toBeNull();

    panel.show();
    document.querySelector('.labs-modal').click();
    expect(document.querySelector('.labs-modal')).toBeNull();
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run src/ui/panels/LabPanel.test.js`
Expected: FAIL — `Failed to resolve import "./LabPanel.js"`.

- [ ] **Step 3: 구현**

`src/ui/panels/LabPanel.js`:

```js
// © 2026 김용현
/**
 * LabPanel - 실험실 창
 *
 * 실험을 켜고 끄는 스위치만 쥔다. 실험 기능 자체는 각자 자기 자리(범례·툴바·메뉴)에
 * 있고 labs.isOn() 으로만 가려진다 — 그래서 승격할 때 이 창에서 지울 것은 목록 한 줄뿐이다.
 * 모달 규약은 GeocodingPanel 과 같다 (.modal-overlay / .modal-content / Esc·바깥 클릭).
 * 설계: docs/superpowers/specs/2026-09-25-labs-design.md
 */
import { labs as defaultLabs } from '../../labs/labs.js';
import { EXPERIMENTS, FEEDBACK_URL } from '../../labs/registry.js';
import { escapeHtml } from '../../utils/escapeHtml.js';

const EXTERNAL_ICON = `
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
    <polyline points="15 3 21 3 21 9"/>
    <line x1="10" y1="14" x2="21" y2="3"/>
  </svg>`;

export class LabPanel {
  constructor({ labs = defaultLabs, experiments = EXPERIMENTS, feedbackUrl = FEEDBACK_URL } = {}) {
    this.labs = labs;
    this.experiments = experiments;
    this.feedbackUrl = feedbackUrl;
    this.modal = null;
    this._escHandler = null;
    this._offChange = null;
  }

  show() {
    this.close();

    this.modal = document.createElement('div');
    this.modal.className = 'modal-overlay labs-modal active';
    this.modal.innerHTML = `
      <div class="modal-content labs-content" role="dialog" aria-labelledby="labs-title">
        <div class="modal-header">
          <h3 id="labs-title">실험실</h3>
          <button class="modal-close" id="labs-close" aria-label="닫기">&times;</button>
        </div>
        <div class="modal-body">
          <p class="labs-intro">검증 중인 기능입니다. 켠 상태는 이 브라우저에 저장됩니다.</p>
          <div class="labs-cards">
            ${this.experiments.map((e) => this.cardHtml(e)).join('')}
          </div>
          <div class="labs-share">
            <label for="labs-share-url">켜진 상태로 여는 링크</label>
            <div class="labs-share-row">
              <input type="text" id="labs-share-url" readonly value="${escapeHtml(this.labs.shareUrl())}">
              <button type="button" class="btn btn-sm btn-outline" id="labs-share-copy">복사</button>
            </div>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(this.modal);
    this.bindEvents();
  }

  cardHtml(exp) {
    const on = this.labs.isOn(exp.id);
    const feedback = this.feedbackUrl
      ? `<a class="labs-feedback" href="${escapeHtml(this.feedbackUrl)}" target="_blank" rel="noopener noreferrer">의견 보내기 ${EXTERNAL_ICON}</a>`
      : '';
    return `
      <div class="labs-card" data-id="${escapeHtml(exp.id)}">
        <div class="labs-card-text">
          <div class="labs-card-name">${escapeHtml(exp.name)}</div>
          <div class="labs-card-summary">${escapeHtml(exp.summary)}</div>
          <div class="labs-card-meta"><span class="labs-since">${escapeHtml(exp.since)} 실험 시작</span>${feedback}</div>
        </div>
        <button type="button" class="labs-switch" role="switch" data-id="${escapeHtml(exp.id)}"
                aria-checked="${on ? 'true' : 'false'}" aria-label="${escapeHtml(exp.name)} 켜기/끄기">
          <span class="labs-switch-knob"></span>
        </button>
      </div>`;
  }

  bindEvents() {
    this.modal.querySelector('#labs-close').addEventListener('click', () => this.close());
    this.modal.addEventListener('click', (e) => {
      if (e.target === this.modal) this.close();
    });

    this.modal.querySelectorAll('.labs-switch').forEach((sw) => {
      sw.addEventListener('click', () => this.labs.toggle(sw.dataset.id));
    });

    // 상태가 어디서 바뀌든(스위치·하네스·다른 창) 스위치와 공유 주소를 맞춘다
    this._offChange = this.labs.onChange(() => this.refresh());

    this.modal.querySelector('#labs-share-copy').addEventListener('click', () => this.copyShareUrl());

    this._escHandler = (e) => { if (e.key === 'Escape') this.close(); };
    document.addEventListener('keydown', this._escHandler);
  }

  refresh() {
    if (!this.modal) return;
    this.modal.querySelectorAll('.labs-switch').forEach((sw) => {
      sw.setAttribute('aria-checked', this.labs.isOn(sw.dataset.id) ? 'true' : 'false');
    });
    const input = this.modal.querySelector('#labs-share-url');
    if (input) input.value = this.labs.shareUrl();
  }

  async copyShareUrl() {
    const input = this.modal.querySelector('#labs-share-url');
    const button = this.modal.querySelector('#labs-share-copy');
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(input.value);
      } else {
        input.select();
        document.execCommand('copy');
      }
      button.textContent = '복사됨';
      setTimeout(() => { if (button.isConnected) button.textContent = '복사'; }, 1500);
    } catch {
      input.select();   // 못 복사하면 선택만 해 준다 — 사용자가 Ctrl+C
    }
  }

  close() {
    if (this._escHandler) {
      document.removeEventListener('keydown', this._escHandler);
      this._escHandler = null;
    }
    if (this._offChange) {
      this._offChange();
      this._offChange = null;
    }
    if (this.modal) {
      this.modal.remove();
      this.modal = null;
    }
  }
}

export const labPanel = new LabPanel();
```

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run src/ui/panels/LabPanel.test.js`
Expected: PASS (4 tests).

- [ ] **Step 5: 커밋**

```bash
git add src/ui/panels/LabPanel.js src/ui/panels/LabPanel.test.js
git -c user.name=yhk1m -c user.email=83273992+yhk1m@users.noreply.github.com commit -m "feat(labs): 실험실 창 — 카드·스위치·의견 링크·공유 주소"
```

---

### Task 6: 툴바 버튼 마크업과 CSS(반짝임·배지·창)

**Files:**
- Modify: `src/ui/layout/AppLayout.js:357-366` (3D 묶음 뒤)
- Modify: `src/styles/main.css:114-117` 뒤(`.btn-tool-labeled.active` 다음), 그리고 `4324` 부근(geocoding 창 스타일) 뒤

- [ ] **Step 1: 툴바 마크업**

`src/ui/layout/AppLayout.js` 에서 `data-group="view3d"` 묶음의 닫는 `</div>` 바로 뒤, `<div class="toolbar-spacer"></div>` 앞에 넣는다:

```html
        <div class="toolbar-group" data-group="labs">
          <button class="btn btn-tool-labeled btn-labs" id="labs-toggle" data-tool="labs"
                  title="실험실 — 검증 중인 기능">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M9 3h6"/>
              <path d="M10 3v6.5L4.6 18.2A2 2 0 0 0 6.3 21h11.4a2 2 0 0 0 1.7-2.8L14 9.5V3"/>
              <path d="M7.5 15h9"/>
            </svg>
            <span class="btn-tool-label">실험실</span>
            <span class="labs-badge" hidden></span>
          </button>
          <!-- 실험 도구 토글(지구본·스와이프)은 뒤 단계에서 이 묶음에 hidden 으로 추가된다 -->
        </div>
```

- [ ] **Step 2: 버튼 CSS**

`src/styles/main.css` 의 `.btn-tool-labeled.active { … }` 블록 바로 뒤에:

```css
/* 실험실 버튼 — 4초마다 빛이 한 번 쓸고 지나간다. 켜진 실험 수는 배지로. */
.btn-labs {
  position: relative;
  overflow: hidden;
  color: var(--color-primary);
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--color-primary) 35%, transparent);
}

.btn-labs::after {
  content: '';
  position: absolute;
  inset: 0;
  pointer-events: none;
  background: linear-gradient(115deg, transparent 35%, rgba(255, 255, 255, 0.75) 50%, transparent 65%);
  transform: translateX(-130%);
  animation: labs-shimmer 4s ease-in-out infinite;
}

@keyframes labs-shimmer {
  0%, 72% { transform: translateX(-130%); }
  100% { transform: translateX(130%); }
}

[data-theme="dark"] .btn-labs::after {
  background: linear-gradient(115deg, transparent 35%, rgba(255, 255, 255, 0.35) 50%, transparent 65%);
}

.btn-labs.active {
  background: var(--bg-selected);
}

.labs-badge {
  min-width: 16px;
  height: 16px;
  padding: 0 4px;
  border-radius: 8px;
  background: var(--color-primary);
  color: var(--text-inverse);
  font-size: 10px;
  font-weight: 700;
  line-height: 16px;
  text-align: center;
}

.labs-badge[hidden] {
  display: none;
}

@media (prefers-reduced-motion: reduce) {
  .btn-labs::after {
    animation: none;
    transform: none;
    background: linear-gradient(115deg, transparent 60%, rgba(255, 255, 255, 0.25) 100%);
  }
}
```

- [ ] **Step 3: 창 CSS**

`src/styles/main.css` 의 geocoding 창 스타일 묶음(`.geocoding-steps .btn-outline { … }` 블록) 뒤에:

```css
/* ===== 실험실 창 ===== */
.labs-modal .labs-content {
  width: 520px;
  max-width: 92vw;
  background: var(--bg-panel);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-lg);
}

.labs-intro {
  font-size: var(--font-size-sm);
  color: var(--text-secondary);
  margin-bottom: var(--spacing-md);
}

.labs-cards {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

.labs-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--spacing-md);
  padding: var(--spacing-md);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  background: var(--bg-app);
}

.labs-card-name {
  font-size: var(--font-size-md);
  font-weight: 600;
  color: var(--text-primary);
}

.labs-card-summary {
  font-size: var(--font-size-sm);
  color: var(--text-secondary);
  margin-top: 2px;
  line-height: 1.5;
}

.labs-card-meta {
  display: flex;
  gap: var(--spacing-md);
  align-items: center;
  margin-top: 6px;
  font-size: var(--font-size-xs);
  color: var(--text-muted);
}

.labs-feedback {
  color: var(--color-primary);
  text-decoration: none;
}

.labs-feedback:hover {
  text-decoration: underline;
}

.labs-feedback svg {
  vertical-align: -2px;
  margin-left: 2px;
}

/* 스위치 */
.labs-switch {
  flex-shrink: 0;
  width: 40px;
  height: 22px;
  border-radius: 11px;
  border: none;
  background: var(--border-color-strong);
  position: relative;
  cursor: pointer;
  transition: background var(--transition-fast);
}

.labs-switch-knob {
  position: absolute;
  top: 3px;
  left: 3px;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: #ffffff;
  box-shadow: var(--shadow-sm);
  transition: transform var(--transition-fast);
}

.labs-switch[aria-checked="true"] {
  background: var(--color-primary);
}

.labs-switch[aria-checked="true"] .labs-switch-knob {
  transform: translateX(18px);
}

.labs-switch:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}

.labs-share {
  margin-top: var(--spacing-lg);
  padding-top: var(--spacing-md);
  border-top: 1px solid var(--border-color);
}

.labs-share label {
  display: block;
  font-size: var(--font-size-xs);
  color: var(--text-muted);
  margin-bottom: 4px;
}

.labs-share-row {
  display: flex;
  gap: var(--spacing-sm);
}

.labs-share-row input {
  flex: 1;
  min-width: 0;
  font-size: var(--font-size-sm);
  padding: 6px 8px;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  background: var(--bg-input);
  color: var(--text-primary);
}

.labs-share-row .btn-outline {
  background: transparent;
  border: 1px solid var(--color-primary);
  color: var(--color-primary);
}
```

- [ ] **Step 4: 빌드로 문법 확인**

Run: `rm -rf dist && npm run build`
Expected: 빌드 성공(경고만). CSS 문법 오류가 있으면 여기서 죽는다.

- [ ] **Step 5: 커밋**

```bash
git add src/ui/layout/AppLayout.js src/styles/main.css
git -c user.name=yhk1m -c user.email=83273992+yhk1m@users.noreply.github.com commit -m "feat(labs): 툴바 실험실 버튼(반짝임·배지)과 실험실 창 스타일"
```

---

### Task 7: `main.js` 배선

**Files:**
- Modify: `src/main.js` — import 묶음(48행 부근), 초기화(91행 `layout.render()` 뒤), 툴바 스위치(461행 `case 'view3d'` 앞), `__egisDebug`(1347행)

- [ ] **Step 1: import 추가**

`import { geocodingPanel } from './ui/panels/GeocodingPanel.js';` 아래에:

```js
import { labPanel } from './ui/panels/LabPanel.js';
import { labs } from './labs/labs.js';
import { EXPERIMENT_IDS } from './labs/registry.js';
import { bindGlass } from './labs/glass.js';
import { bindLabsButton } from './labs/labsButton.js';
```

- [ ] **Step 2: 초기화**

`layout.render();` 바로 뒤(지도 초기화 전 — 버튼은 render 뒤에야 있고, 글래스는 첫 그림 전에 붙는 게 좋다):

```js
  // 3.5 실험실 — 저장값과 ?lab= 을 읽고, 켜자마자 반영되는 것(글래스·배지)을 묶는다
  labs.init({
    search: window.location.search,
    storage: window.localStorage,
    knownIds: EXPERIMENT_IDS,
    baseUrl: window.location.origin + window.location.pathname
  });
  bindGlass(labs);
  bindLabsButton(labs, document.getElementById('labs-toggle'));
```

- [ ] **Step 3: 툴바 스위치**

`initToolbar` 의 `switch (tool)` 에서 `case 'view3d':` 앞에:

```js
      case 'labs':
        labPanel.show();
        return;
```

- [ ] **Step 4: 디버그 노출**

`window.__egisDebug = { … }` 객체에 `labs` 를 더한다:

```js
window.__egisDebug = { projectManager, layerManager, exportPanel, isochroneTool, roadNetwork, measureTool, selectTool, historyManager, mapManager, labs, get view3dPanel() { return view3dPanel; } };
```

- [ ] **Step 5: 전체 테스트·빌드**

Run: `npm test`
Expected: 모두 PASS.

Run: `rm -rf dist && npm run build`
Expected: 성공.

- [ ] **Step 6: 커밋**

```bash
git add src/main.js
git -c user.name=yhk1m -c user.email=83273992+yhk1m@users.noreply.github.com commit -m "feat(labs): main.js 배선 — 초기화·글래스·배지·툴바 버튼·디버그 노출"
```

---

### Task 8: 사용 설명서

**Files:**
- Modify: `docs/사용설명서.md` — 목차 27행, 본문 445행(`## 1-14. 팁과 단축키`) 앞

- [ ] **Step 1: 목차**

`  - [1-14. 팁과 단축키](#1-14-팁과-단축키)` 를 다음 두 줄로 바꾼다:

```md
  - [1-14. 실험실](#1-14-실험실)
  - [1-15. 팁과 단축키](#1-15-팁과-단축키)
```

- [ ] **Step 2: 본문**

`## 1-14. 팁과 단축키` 를 `## 1-15. 팁과 단축키` 로 바꾸고, 그 앞(1-13 절의 `---` 뒤)에 넣는다:

```md
## 1-14. 실험실

툴바 오른쪽 끝의 **실험실** 버튼(반짝이는 플라스크)을 누르면 아직 검증 중인 기능 목록이 나옵니다. 스위치를 켜면 그 기능이 원래 있어야 할 자리(범례·툴바·메뉴)에 나타나고, 끄면 사라집니다. 켠 상태는 이 브라우저에만 저장됩니다.

- 주소 뒤에 `?lab=glass` 처럼 붙여 열면 그 실험이 켜진 채로 열립니다(`?lab=all` 은 전부, `?lab=none` 은 전부 끄기). 창 아래의 **켜진 상태로 여는 링크**를 복사해 학생에게 나눠 주세요.
- 실험 기능은 예고 없이 바뀌거나 사라질 수 있습니다. 각 카드의 **의견 보내기**로 써 본 소감을 알려 주세요.

### 글래스 UI

패널·메뉴·범례가 반투명 유리처럼 바뀌어 아래 지도가 비칩니다. 태블릿·휴대폰과 시스템 "투명도 줄이기" 설정에서는 흐림 없이 반투명만 적용되고, 지도 이미지 내보내기에서는 범례가 불투명하게 찍힙니다.

---
```

- [ ] **Step 3: 빌드로 설명서 반영 확인**

Run: `rm -rf dist && npm run build && grep -c "1-14. 실험실" dist/guide.html`
Expected: `1` 이상.

- [ ] **Step 4: 커밋**

```bash
git add docs/사용설명서.md
git -c user.name=yhk1m -c user.email=83273992+yhk1m@users.noreply.github.com commit -m "docs(guide): 1-14 실험실 절 추가, 팁은 1-15 로"
```

---

### Task 9: Electron 하네스로 화면 검증

**Files:**
- Create: `scripts/verify/labs-shell.cjs`

- [ ] **Step 1: 빌드·프리뷰**

```bash
cd "C:/Users/김용현/Desktop/vibecoding/eGIS"
rm -rf dist && npm run build
npx vite preview --port 4173 &
curl -s -o /dev/null -w "%{http_code}" http://localhost:4173/
```
Expected: `200`.

- [ ] **Step 2: 하네스 작성**

`scripts/verify/labs-shell.cjs`:

```js
// © 2026 김용현
/**
 * 실험실 0단계 화면 검증 — 사용자처럼 버튼을 눌러 본다.
 * 실행: cd eStoryMap && npx electron ../scripts/verify/labs-shell.cjs
 * 결과: scripts/verify/out/labs-*.png 와 콘솔 판정
 */
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');

const OUT = path.join(__dirname, 'out');
fs.mkdirSync(OUT, { recursive: true });
setTimeout(() => { console.error('WATCHDOG'); process.exit(2); }, 120000);

async function capture(win, name) {
  let png = Buffer.alloc(0);
  for (let i = 0; i < 5 && png.length === 0; i++) {
    win.focus();
    await new Promise((r) => setTimeout(r, 1500));
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

  // 조회수 카운터를 건드리지 않게 오늘 방문한 것으로 표시
  await win.loadURL('http://localhost:4173/');
  await new Promise((r) => setTimeout(r, 3000));
  await js(`localStorage.setItem('egis_last_visit', new Date(Date.now() + 9*3600e3).toISOString().slice(0,10))`);

  // 1. 버튼이 3D 묶음 바로 뒤에 있고 배지는 숨겨져 있다
  check('labs button after view3d group', await js(`(() => {
    const g = document.querySelector('.toolbar-group[data-group="labs"]');
    return !!g && g.previousElementSibling?.dataset.group === 'view3d'
      && !!g.querySelector('#labs-toggle') && g.querySelector('.labs-badge').hidden === true;
  })()`));
  await capture(win, 'labs-01-toolbar');

  // 2. 버튼 클릭 → 창이 뜨고 glass 카드가 있다
  await js(`document.getElementById('labs-toggle').click()`);
  await new Promise((r) => setTimeout(r, 400));
  check('panel opened with glass card', await js(`!!document.querySelector('.labs-modal .labs-card[data-id="glass"]')`));
  await capture(win, 'labs-02-panel');

  // 3. 스위치 → 글래스 켜짐, 배지 1
  await js(`document.querySelector('.labs-switch[data-id="glass"]').click()`);
  await new Promise((r) => setTimeout(r, 300));
  check('glass attr on', await js(`document.documentElement.getAttribute('data-surface') === 'glass'`));
  check('badge shows 1', await js(`document.querySelector('.labs-badge').textContent === '1' && !document.querySelector('.labs-badge').hidden`));
  check('stored', await js(`JSON.parse(localStorage.getItem('eGIS_labs')).glass === true`));
  await js(`document.getElementById('labs-close').click()`);
  await new Promise((r) => setTimeout(r, 300));
  await capture(win, 'labs-03-glass-light');

  // 4. 다크 모드에서도
  await js(`document.getElementById('theme-toggle').click()`);
  await new Promise((r) => setTimeout(r, 400));
  await capture(win, 'labs-04-glass-dark');
  await js(`document.getElementById('theme-toggle').click()`);

  // 5. 새로고침해도 유지, ?lab=none 은 세션만 끈다
  await win.loadURL('http://localhost:4173/');
  await new Promise((r) => setTimeout(r, 3000));
  check('persisted after reload', await js(`document.documentElement.getAttribute('data-surface') === 'glass'`));
  await win.loadURL('http://localhost:4173/?lab=none');
  await new Promise((r) => setTimeout(r, 3000));
  check('?lab=none overrides', await js(`document.documentElement.getAttribute('data-surface') === null`));
  check('stored untouched', await js(`JSON.parse(localStorage.getItem('eGIS_labs')).glass === true`));

  // 6. 끄면 원상 복구
  await win.loadURL('http://localhost:4173/');
  await new Promise((r) => setTimeout(r, 3000));
  await js(`__egisDebug.labs.set('glass', false)`);
  check('glass attr off', await js(`document.documentElement.getAttribute('data-surface') === null`));
  await capture(win, 'labs-05-off');

  app.quit();
});
```

- [ ] **Step 3: 실행**

```bash
cd "C:/Users/김용현/Desktop/vibecoding/eGIS/eStoryMap" && npx electron ../scripts/verify/labs-shell.cjs 2>&1 | grep -viE "devtools|deprecat|GPU|cache_util|disk_cache|quota_database|Security Warning"
```
Expected: `PASS` 8줄, `FAIL` 0줄, `scripts/verify/out/labs-0*.png` 5장. 캡처를 열어 확인할 것: 실험실 버튼이 3D 구분선 오른쪽에 있고 파란 테두리 빛이 있다, 창의 카드·스위치가 이모지 없이 보인다, 글래스가 켜졌을 때 왼쪽 패널·메뉴바·툴바 너머로 지도가 비치고 글자는 읽힌다(라이트·다크 둘 다), 껐을 때 원래 화면과 같다.

- [ ] **Step 4: 프리뷰 종료·커밋**

프리뷰 서버를 끝낸다(백그라운드 프로세스 종료). 캡처 폴더는 커밋하지 않는다.

```bash
printf 'out/\n' > scripts/verify/.gitignore
git add scripts/verify/labs-shell.cjs scripts/verify/.gitignore
git -c user.name=yhk1m -c user.email=83273992+yhk1m@users.noreply.github.com commit -m "test(labs): 실험실 0단계 Electron 하네스"
```

---

### Task 10: 마무리

- [ ] **Step 1: 전체 확인**

```bash
npm test
rm -rf dist && npm run build
git status --short
```
Expected: 테스트 전부 PASS, 빌드 성공, 작업 트리 깨끗.

- [ ] **Step 2: 실험 끄면 정식 화면과 같은지 눈으로 재확인**

Task 9 의 `labs-01-toolbar.png`(처음)와 `labs-05-off.png`(끈 뒤)를 나란히 본다. 실험실 버튼 외에 달라진 곳이 없어야 한다.

- [ ] **Step 3: 병합·배포**

`superpowers:finishing-a-development-branch` → `main` 병합 → `/cpd`. 배포 뒤 `https://www.e-gis.kr/?lab=glass` 로 열어 글래스가 켜지는지 본다(하드 새로고침).

---

## 스펙 대조 (자체 검토)

| 스펙 항목 | 작업 |
|---|---|
| `labs.js` API(init·isOn·set·toggle·onChange·enabledIds·shareUrl), 우선순위, 모르는 id 무시, 저장소 예외 | Task 1 |
| 레지스트리(구현된 것만, FEEDBACK_URL) | Task 2 |
| 글래스: 속성·토큰·블러 대상·태블릿·reduced-transparency·내보내기 예외 | Task 3 |
| 툴바 3D 구분선 오른쪽, 반짝임, reduced-motion, 배지 | Task 4, 6 |
| 창: 카드·스위치·의견 링크·공유 링크·복사·닫기 3종 | Task 5 |
| `main.js` 초기화·툴바 스위치·`__egisDebug.labs` | Task 7 |
| 설명서 1-14 | Task 8 |
| 하네스 시나리오(켜기→사용→캡처→끄기→복구) | Task 9 |
| 개인정보 방침 변경 없음 | 해당 없음(확인만) |

## 구현하며 바뀐 점

- Task 3 `glass.css`: 스펙의 "정확한 선택자는 grep 으로 확정" 에 따라 부유 범례 `.chart-map-legend`·`.isochrone-legend`·`.raster-analysis-legend` 를 블러·태블릿·투명도 줄이기·내보내기 네 묶음에 추가했다(모두 `position:absolute` + `var(--bg-panel)`, 내보내기에 찍힌다). `.ol-scale-line`·`.ol-attribution`·`.view3d-compass` 는 작은 컨트롤이라 그대로 둔다.
