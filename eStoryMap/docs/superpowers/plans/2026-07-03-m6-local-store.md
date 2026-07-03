# e-GIStory M6: 로컬 저장 (.esm 자동저장 + 시작 화면) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 문서를 `~/Desktop/e-GIStory/{제목}.esm`에 2초 디바운스로 자동 저장하고, 앱 시작 시 시작 화면(새로 만들기 / 기존 목록 열기)에서 문서를 선택해 이어서 작업한다 — 껐다 켜도 작업이 남는다.

**Architecture:** 직렬화는 순수 모듈 `LocalStore`(serialize/deserialize + 디바운스 유틸)가 담당한다. **`.tif` 소스의 raster.data(TypedArray)는 JSON.stringify에서 손상되므로 저장 시 `encodeRasterMeta`(e-GIS 이식, base64)로 인코딩**하고, 로드 시에는 기존 파이프라인(parseEgisDoc → buildRasterLayer → decodeRasterMeta)이 그대로 복원한다 — 로드 쪽 신규 코드 없음. 파일 I/O는 M0부터 있는 `window.egisFS.{listProjects,loadProject,saveProject}` IPC를 그대로 쓰고, `backupProject`(열기 시 세션당 1회 스냅샷)만 추가한다. 자동 저장은 6개 변이 지점(체크/페이지 추가·삭제/소스 추가/타이핑/캡처)에서 `scheduleSave()`.

**Tech Stack:** 기존 그대로. 신규 의존성 없음.

---

## 이 계획의 범위 (중요)

상위 스펙 `eStoryMap-PLAN.md` §7 **M6만**: "로컬 자동 저장: LocalStore + 디바운스 + 시작 화면(목록/열기) + 백업 + '폴더 열기' 버튼(이미 있음)." 다음은 **의도적으로 연기/변경(YAGNI)**:

- **문서 제목 변경(파일명 변경)** — v2. 제목은 시작 화면에서 생성 시 1회 결정(스펙 §3b "경로 고정"과 동궤).
- **"최근 프로젝트 자동 열기" 옵션** — 스펙에 "옵션"으로 표기 — 연기.
- **백업 정책 변경(의도적)**: 스펙 §3b는 "저장 시 직전 버전 백업"이지만 2초 디바운스 자동저장에선 세션당 수백 개가 쌓인다. → **기존 문서를 "열 때" 세션당 1회** `.backups/{name}-{timestamp}.esm` 스냅샷(편집 세션 시작 전 상태 보존이라는 목적은 동일). 백업 폴더 정리(개수 제한)는 백로그.
- 새 문서 생성 시 같은 이름 존재 → 시작 화면에 오류 표시(덮어쓰기 방지). 강제 덮어쓰기/이름 제안은 백로그.
- 클라우드 동기화 — M8.

M6 완료 기준: "**소스·페이지·콘텐츠·카메라를 편집하고 앱을 완전히 껐다 켜면, 시작 화면 목록에서 그 문서를 열어 모든 상태(래스터 포함)가 복원된다. `~/Desktop/e-GIStory/`에 .esm 파일이 보인다.**"

## 현재 코드 기준 확정 사실 (2026-07-03, 139 tests green, HEAD bec56dc)

1. **파일 IPC는 M0부터 완비**: `electron/fileService.js` — `baseDir()`=`~/Desktop/e-GIStory`, `ensureBaseDir()`(기동 시 호출됨), `sanitize(name)`(파일명 위험문자 → `_`), `listProjects()`(.esm 목록, 확장자 제거된 이름 배열), `readProject(name)`, `writeProject(name, json)`. preload `window.egisFS`: `listProjects/loadProject/saveProject/openFolder` 노출됨. **backup만 없음.**
2. **직렬화 함정(예약된 해결)**: `.tif` 소스는 `demDataToEgisDoc`이 raster.data를 **TypedArray 그대로** 문서에 넣는다(geotiffParse.js JSDoc의 M6 주의 주석). `JSON.stringify(Float32Array)`는 `{"0":…}` 객체로 손상. e-GIS `ProjectManager.js:27-46`의 `encodeRasterMeta`(base64 인코딩)를 이식해 저장 시에만 적용. `.egis`에서 온 소스의 raster.data는 이미 `{__encoding:'base64'|'array'}` 꼴이라 그대로 통과시켜야 함.
3. **로드 경로는 신규 코드 불필요**: 저장된(인코딩된) source.egis는 기존 `parseEgisDoc → SourceRegistry.addSource → buildRasterLayer → decodeRasterMeta` 경로로 그대로 빌드된다(M2/M3 테스트 커버). `decodeRasterMeta`는 `src/core/rasterDecode.js`에 있음 — `encodeRasterMeta`를 같은 파일에 추가(자연스러운 짝).
4. `src/main.js` 현황: `const doc = createStoryDoc(); let currentPageId = …;` 모듈 톱레벨 + 말미 `refresh();` — **T6에서 `let doc = null` + 시작 화면 게이트로 재구성**. 변이 지점 6곳: sourcePanel.onToggleLayer, pageList.onAdd/onRemove, contentEditor.onChange, addSourceFromEgis, btn-capture 핸들러. (onSelect는 비변이 — 저장 불필요.)
5. StoryDoc 문서는 meta/sources/pages만 가지며 camera(`{center,zoom}`)·content(문자열)는 JSON-safe. `registry.addSource(sourceId, parsedDoc)`은 저장된 sourceId 재사용 가능(로드 시 재구성).
6. DOM 컴포넌트 관례: factory + `{render}`, jsdom 테스트. 디바운스 테스트는 `vi.useFakeTimers()`.
7. index.html: `#app`(툴바+3패널) 구조. 시작 화면은 `#app` 뒤 형제 `<div id="start-screen">` 오버레이(`:empty`면 숨김 → boot 렌더 전 검은 플래시 없음).
8. ⚠️ vite `renderer` 플러그인 금지, `npm run dev`는 사람 스모크 전용, `vite build`는 `rm -rf dist` 선행.

## File Structure

앱 루트: `C:/Users/김용현/Desktop/vibecoding/eGIS/eStoryMap/` (이하 상대경로).

| 파일 | 책임 |
|---|---|
| Modify: `src/core/rasterDecode.js` | `encodeRasterMeta` 추가(e-GIS 이식 + 이미 인코딩 passthrough 가드). |
| Create: `src/core/LocalStore.js` | **순수**: `serializeStoryDoc`(래스터 인코딩 포함)/`deserializeStoryDoc`(구조 검증)/`createAutosaver`(디바운스). IPC 호출 없음. |
| Modify: `electron/fileService.js`, `electron/main.js`, `electron/preload.js` | `backupProject(name)` — `.backups/{name}-{timestamp}.esm` 스냅샷 + IPC `project:backup` + `egisFS.backupProject`. |
| Create: `src/editor/StartScreen.js` | 시작 화면 DOM 컴포넌트(제목 입력+새로 만들기 / 목록 열기 / 오류 표시). |
| Modify: `src/main.js`, `index.html`, `src/style.css` | 시작 화면 게이트 + 자동저장 배선 + 저장 상태 표시. |
| Test: `src/core/rasterDecode.test.js`(추가), `src/core/LocalStore.test.js`(신규), `src/editor/StartScreen.test.js`(신규) | 단위 테스트. |

현재 테스트 기준선: **139개**. 완료 시 **157개**(신규 18).

---

## Task 1: encodeRasterMeta — 저장용 래스터 인코딩 (순수, TDD)

**Files:**
- Test: `src/core/rasterDecode.test.js` (추가)
- Modify: `src/core/rasterDecode.js`

- [ ] **Step 1: 실패하는 테스트 추가** — `src/core/rasterDecode.test.js`의 import를 `import { decodeRasterMeta, encodeRasterMeta } from './rasterDecode.js';`로 바꾸고 파일 끝에:

```js
describe('encodeRasterMeta', () => {
  it('TypedArray를 base64로 인코딩하고 decode로 라운드트립된다', () => {
    const raster = {
      data: new Float32Array([0, 100, 200, 700]),
      width: 2, height: 2, extent: [0, 0, 10, 10], minVal: 0, maxVal: 700, noDataValue: -9999,
    };
    const encoded = encodeRasterMeta(raster);
    expect(encoded.data.__encoding).toBe('base64');
    expect(encoded.data.dtype).toBe('Float32Array');
    const back = decodeRasterMeta(encoded);
    expect(back.data).toBeInstanceOf(Float32Array);
    expect(Array.from(back.data)).toEqual([0, 100, 200, 700]);
    expect(back.extent).toEqual([0, 0, 10, 10]);
  });

  it('이미 인코딩된 raster는 그대로 반환한다(같은 참조)', () => {
    const raster = { data: { __encoding: 'base64', dtype: 'Float32Array', base64: 'AAAA' }, width: 1 };
    expect(encodeRasterMeta(raster)).toBe(raster);
  });

  it('일반 배열은 array형으로 인코딩한다', () => {
    const encoded = encodeRasterMeta({ data: [1, 2, 3] });
    expect(encoded.data).toEqual({ __encoding: 'array', dtype: 'Array', values: [1, 2, 3] });
  });

  it('원본 객체를 변경하지 않는다', () => {
    const raster = { data: new Float32Array([1]), width: 1 };
    encodeRasterMeta(raster);
    expect(raster.data).toBeInstanceOf(Float32Array);
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `cd "C:/Users/김용현/Desktop/vibecoding/eGIS/eStoryMap" && npx vitest run src/core/rasterDecode.test.js`
Expected: 새 4개 FAIL(export 없음), 기존 5개 PASS.

- [ ] **Step 3: 구현** — `src/core/rasterDecode.js` 파일 끝에 추가:

```js
/**
 * 래스터 객체를 JSON 안전한 형태로 인코딩(.esm 저장용).
 * 이식 원본: e-GIS src/core/ProjectManager.js encodeRasterMeta.
 * data가 이미 인코딩(__encoding)돼 있으면 그대로 반환한다(.egis 유래 소스).
 */
export function encodeRasterMeta(rasterObj) {
  const arr = rasterObj.data;
  if (arr && arr.__encoding) return rasterObj; // 이미 JSON-safe

  let encodedData;
  if (ArrayBuffer.isView(arr)) {
    const bytes = new Uint8Array(arr.buffer, arr.byteOffset, arr.byteLength);
    let binary = '';
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
      binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
    }
    encodedData = { __encoding: 'base64', dtype: arr.constructor.name, base64: btoa(binary) };
  } else if (Array.isArray(arr)) {
    encodedData = { __encoding: 'array', dtype: 'Array', values: arr };
  } else {
    encodedData = { __encoding: 'array', dtype: 'Array', values: arr ? Array.from(arr) : [] };
  }

  return { ...rasterObj, data: encodedData };
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run src/core/rasterDecode.test.js` — Expected: PASS (9 tests). 전체 143.

- [ ] **Step 5: 커밋**

```bash
cd "C:/Users/김용현/Desktop/vibecoding/eGIS" && git add eStoryMap/src/core/rasterDecode.js eStoryMap/src/core/rasterDecode.test.js && git commit -m "feat(eStoryMap): M6 encodeRasterMeta — 저장용 래스터 base64 인코딩(e-GIS 이식)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## Task 2: LocalStore — serialize/deserialize (순수, TDD)

**Files:**
- Test: `src/core/LocalStore.test.js`
- Create: `src/core/LocalStore.js`

- [ ] **Step 1: 실패하는 테스트 작성** — `src/core/LocalStore.test.js`

```js
// © 2026 김용현
import { describe, it, expect } from 'vitest';
import { serializeStoryDoc, deserializeStoryDoc } from './LocalStore.js';
import { createStoryDoc, addSource, setPageContent, setPageCamera } from './StoryDoc.js';
import { demDataToEgisDoc } from './geotiffParse.js';
import { parseEgisDoc } from './egisParse.js';
import { SourceRegistry } from './SourceRegistry.js';

function tifDoc() {
  // .tif 소스: raster.data가 TypedArray인 문서 (직렬화 함정 재현)
  const doc = createStoryDoc('뒷산 이야기');
  const dem = {
    data: new Float32Array([0, 100, 200, 700]),
    width: 2, height: 2, extent: [0, 0, 10, 10], minVal: 0, maxVal: 700, noDataValue: -9999,
  };
  addSource(doc, { sourceId: 'src_1', filename: '뒷산.tif', egis: demDataToEgisDoc(dem, '뒷산') },
    ['L_dem'], 'page_1');
  setPageContent(doc, 'page_1', { heading: '뒷산', body: '# 개요' });
  setPageCamera(doc, 'page_1', { center: [129.05, 35.15], zoom: 11 });
  return doc;
}

describe('serializeStoryDoc', () => {
  it('TypedArray 래스터를 base64로 인코딩해 JSON 문자열로 만든다', () => {
    const text = serializeStoryDoc(tifDoc());
    const raw = JSON.parse(text);
    const rasterData = raw.sources[0].egis.layers[0].raster.data;
    expect(rasterData.__encoding).toBe('base64');
    expect(rasterData.dtype).toBe('Float32Array');
  });

  it('라이브 문서를 변경하지 않는다(TypedArray 유지)', () => {
    const doc = tifDoc();
    serializeStoryDoc(doc);
    expect(doc.sources[0].egis.layers[0].raster.data).toBeInstanceOf(Float32Array);
  });

  it('이미 인코딩된(.egis 유래) 소스는 그대로 보존한다', () => {
    const doc = createStoryDoc();
    const egis = {
      version: '1.0',
      layers: [{ id: 'L_d', type: 'raster', rasterKind: 'dem',
        raster: { data: { __encoding: 'base64', dtype: 'Float32Array', base64: 'AAAA' }, width: 1, height: 1, extent: [0, 0, 1, 1] } }],
    };
    const raw = JSON.parse(serializeStoryDoc(addSourceHelper(doc, egis)));
    expect(raw.sources[0].egis.layers[0].raster.data.base64).toBe('AAAA');

    function addSourceHelper(d, e) {
      addSource(d, { sourceId: 'src_1', filename: 'a.egis', egis: e }, ['L_d'], 'page_1');
      return d;
    }
  });
});

describe('deserializeStoryDoc + 라운드트립', () => {
  it('저장→로드→레지스트리 빌드까지 복원된다(핵심 라운드트립)', () => {
    const text = serializeStoryDoc(tifDoc());
    const loaded = deserializeStoryDoc(text);
    expect(loaded.meta.title).toBe('뒷산 이야기');
    expect(loaded.pages[0].content.heading).toBe('뒷산');
    expect(loaded.pages[0].camera).toEqual({ center: [129.05, 35.15], zoom: 11 });
    const reg = new SourceRegistry({ addLayer() {} });
    const result = reg.addSource(loaded.sources[0].sourceId, parseEgisDoc(loaded.sources[0].egis));
    expect(result.builtLayerIds).toEqual(['L_dem']);
    expect(result.skipped).toBe(0);
  });

  it('손상 입력은 명확한 에러를 던진다', () => {
    expect(() => deserializeStoryDoc('not json')).toThrow(/유효하지 않은 \.esm/);
    expect(() => deserializeStoryDoc('{"meta":{}}')).toThrow(/유효하지 않은 \.esm/);
    expect(() => deserializeStoryDoc('{"meta":{},"pages":[],"sources":[]}')).toThrow(/유효하지 않은 \.esm/);
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run src/core/LocalStore.test.js` — Expected: FAIL — `LocalStore.js` 없음.

- [ ] **Step 3: 최소 구현** — `src/core/LocalStore.js`

```js
// © 2026 김용현
// eStoryMap/src/core/LocalStore.js
// .esm(StoryMapDoc JSON) 직렬화/역직렬화 + 자동저장 디바운스 — 순수 모듈.
// 파일 I/O는 하지 않는다(window.egisFS IPC는 main.js 접착부 담당 — 상위 스펙 §3b).
import { encodeRasterMeta } from './rasterDecode.js';

/** source.egis 안의 래스터 밴드(TypedArray)를 JSON-safe로 인코딩한 복사본. */
function encodeEgisRasters(egis) {
  if (!egis || !Array.isArray(egis.layers)) return egis;
  return {
    ...egis,
    layers: egis.layers.map((layer) =>
      layer && layer.raster && ArrayBuffer.isView(layer.raster.data)
        ? { ...layer, raster: encodeRasterMeta(layer.raster) }
        : layer),
  };
}

/**
 * StoryMapDoc → .esm JSON 문자열. .tif 유래 소스의 TypedArray를 base64로
 * 인코딩한다(라이브 문서는 변경하지 않음). 로드 시 디코딩은 기존
 * parseEgisDoc→buildRasterLayer→decodeRasterMeta 경로가 처리하므로 별도 없음.
 */
export function serializeStoryDoc(doc) {
  const out = {
    ...doc,
    sources: doc.sources.map((source) => ({
      ...source,
      egis: encodeEgisRasters(source.egis),
    })),
  };
  return JSON.stringify(out);
}

/** .esm 텍스트 → StoryMapDoc. 구조가 어긋나면 명확히 실패한다. */
export function deserializeStoryDoc(text) {
  let raw;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error('유효하지 않은 .esm 파일입니다: JSON 아님');
  }
  if (!raw || !raw.meta || !Array.isArray(raw.pages) || raw.pages.length < 1
    || !Array.isArray(raw.sources)) {
    throw new Error('유효하지 않은 .esm 파일입니다: 필수 구조 누락');
  }
  return raw;
}

/**
 * 디바운스 자동저장. 변이 때마다 schedule()을 부르면 마지막 호출 기준
 * delay 후 save()가 1회 실행된다.
 */
export function createAutosaver(save, { delay = 2000 } = {}) {
  let timer = null;
  return {
    schedule() {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        timer = null;
        save();
      }, delay);
    },
  };
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run src/core/LocalStore.test.js` — Expected: PASS (5 tests). 전체 148.

- [ ] **Step 5: 커밋**

```bash
cd "C:/Users/김용현/Desktop/vibecoding/eGIS" && git add eStoryMap/src/core/LocalStore.js eStoryMap/src/core/LocalStore.test.js && git commit -m "feat(eStoryMap): M6 LocalStore — .esm 직렬화(래스터 인코딩)/역직렬화(순수)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## Task 3: LocalStore.createAutosaver 디바운스 (TDD)

**Files:**
- Test: `src/core/LocalStore.test.js` (추가)
- Modify: 없음(Task 2에서 구현 완료 — 테스트만 추가해 계약 고정)

> `createAutosaver`는 Task 2 구현에 포함됐지만 테스트가 없다. fake timers로 계약을 고정한다(테스트 후행이 아니라, Task 2 시점에 미사용 코드였던 것을 사용 직전에 고정하는 것).

- [ ] **Step 1: 테스트 추가** — `src/core/LocalStore.test.js`의 import에 `createAutosaver` 추가, vitest import에 `vi, beforeEach, afterEach` 추가 후 파일 끝에:

```js
describe('createAutosaver', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('연속 schedule은 마지막 기준 delay 후 1회만 저장한다', () => {
    const save = vi.fn();
    const saver = createAutosaver(save, { delay: 2000 });
    saver.schedule();
    vi.advanceTimersByTime(1500);
    saver.schedule(); // 타이머 리셋
    vi.advanceTimersByTime(1999);
    expect(save).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(save).toHaveBeenCalledTimes(1);
  });

  it('저장 후 다시 schedule하면 또 저장된다', () => {
    const save = vi.fn();
    const saver = createAutosaver(save, { delay: 100 });
    saver.schedule();
    vi.advanceTimersByTime(100);
    saver.schedule();
    vi.advanceTimersByTime(100);
    expect(save).toHaveBeenCalledTimes(2);
  });

  it('기본 delay는 2000ms', () => {
    const save = vi.fn();
    createAutosaver(save).schedule();
    vi.advanceTimersByTime(1999);
    expect(save).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(save).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: 테스트 통과 확인** (구현이 이미 있으므로 바로 GREEN이어야 함 — 아니면 BLOCKED 보고)

Run: `npx vitest run src/core/LocalStore.test.js` — Expected: PASS (8 tests). 전체 151.

- [ ] **Step 3: 커밋**

```bash
cd "C:/Users/김용현/Desktop/vibecoding/eGIS" && git add eStoryMap/src/core/LocalStore.test.js && git commit -m "test(eStoryMap): M6 createAutosaver 디바운스 계약 고정(fake timers)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## Task 4: backupProject — 열기 시 세션 스냅샷 (Electron glue)

**Files:**
- Modify: `electron/fileService.js`, `electron/main.js`, `electron/preload.js`

> fileService는 `electron`의 `app`을 import하므로 vitest(jsdom) 단위 테스트 불가 — M0부터의 관례대로 접착부는 스모크 검증(Task 6).

- [ ] **Step 1: `electron/fileService.js` 파일 끝에 추가**

```js
/**
 * 문서를 열기 전 세션 스냅샷: {name}.esm → .backups/{name}-{timestamp}.esm 복사.
 * 파일이 없으면(새 문서) null. 디바운스 자동저장마다가 아니라 "열기 시 1회"만
 * 호출된다(저장마다 백업하면 세션당 수백 개 — 상위 스펙 §3b의 목적만 유지).
 */
export async function backupProject(name) {
  const dir = ensureBaseDir();
  const file = path.join(dir, sanitize(name) + '.esm');
  if (!fs.existsSync(file)) return null;
  const backupDir = path.join(dir, '.backups');
  if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const dest = path.join(backupDir, `${sanitize(name)}-${stamp}.esm`);
  await fsp.copyFile(file, dest);
  return path.basename(dest);
}
```

- [ ] **Step 2: `electron/main.js`** — import에 `backupProject` 추가:

```js
import {
  ensureBaseDir, baseDir, listProjects, readProject, writeProject, backupProject,
} from './fileService.js';
```

`project:openFolder` 핸들러 줄 아래에 추가:

```js
ipcMain.handle('project:backup', (_e, name) => backupProject(name));
```

- [ ] **Step 3: `electron/preload.js`** — `egisFS` 객체의 `saveProject` 줄 다음에 추가:

```js
  backupProject: (name) => ipcRenderer.invoke('project:backup', name), // → 백업 파일명 | null
```

- [ ] **Step 4: 전체 테스트 확인(회귀 없음)**

Run: `cd "C:/Users/김용현/Desktop/vibecoding/eGIS/eStoryMap" && npm test` — Expected: PASS (151 tests).

- [ ] **Step 5: 커밋**

```bash
cd "C:/Users/김용현/Desktop/vibecoding/eGIS" && git add eStoryMap/electron/fileService.js eStoryMap/electron/main.js eStoryMap/electron/preload.js && git commit -m "feat(eStoryMap): M6 backupProject — 열기 시 세션 스냅샷 IPC

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## Task 5: StartScreen — 시작 화면 (DOM, TDD)

**Files:**
- Test: `src/editor/StartScreen.test.js`
- Create: `src/editor/StartScreen.js`

- [ ] **Step 1: 실패하는 테스트 작성** — `src/editor/StartScreen.test.js`

```js
// © 2026 김용현
import { describe, it, expect, vi } from 'vitest';
import { createStartScreen } from './StartScreen.js';

function make(handlers = {}) {
  const el = document.createElement('div');
  const screen = createStartScreen(el, { onCreate: vi.fn(), onOpen: vi.fn(), ...handlers });
  return { el, screen };
}

describe('StartScreen', () => {
  it('기존 프로젝트 목록을 렌더한다', () => {
    const { el, screen } = make();
    screen.render(['부산 이야기', '뒷산 답사']);
    const items = [...el.querySelectorAll('.start-item')].map((n) => n.textContent);
    expect(items).toEqual(['부산 이야기', '뒷산 답사']);
  });

  it('목록이 비어 있으면 안내 문구', () => {
    const { el, screen } = make();
    screen.render([]);
    expect(el.querySelector('.start-empty')).not.toBeNull();
  });

  it('항목 클릭 → onOpen(이름)', () => {
    const onOpen = vi.fn();
    const { el, screen } = make({ onOpen });
    screen.render(['부산 이야기']);
    el.querySelector('.start-item').dispatchEvent(new Event('click'));
    expect(onOpen).toHaveBeenCalledWith('부산 이야기');
  });

  it('새로 만들기 → onCreate(입력 제목)', () => {
    const onCreate = vi.fn();
    const { el, screen } = make({ onCreate });
    screen.render([]);
    el.querySelector('#start-title').value = '  기후 이야기  ';
    el.querySelector('#btn-start-create').dispatchEvent(new Event('click'));
    expect(onCreate).toHaveBeenCalledWith('기후 이야기'); // trim
  });

  it('제목이 비어 있으면 기본 제목', () => {
    const onCreate = vi.fn();
    const { el, screen } = make({ onCreate });
    screen.render([]);
    el.querySelector('#btn-start-create').dispatchEvent(new Event('click'));
    expect(onCreate).toHaveBeenCalledWith('새 스토리맵');
  });

  it('showError가 오류를 표시하고 재렌더 시 사라진다', () => {
    const { el, screen } = make();
    screen.render([]);
    screen.showError('같은 이름의 스토리맵이 이미 있습니다');
    expect(el.querySelector('.start-error').textContent).toContain('이미 있습니다');
    screen.render([]);
    expect(el.querySelector('.start-error').textContent).toBe('');
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run src/editor/StartScreen.test.js` — Expected: FAIL — 모듈 없음.

- [ ] **Step 3: 최소 구현** — `src/editor/StartScreen.js`

```js
// © 2026 김용현
// eStoryMap/src/editor/StartScreen.js
// 시작 화면: 새 스토리맵 만들기 / 저장된 .esm 목록에서 열기(상위 스펙 §3b).
// 오버레이 표시/숨김은 main.js가 담당하고, 이 컴포넌트는 내용만 렌더한다.

/**
 * @param {HTMLElement} container
 * @param {{onCreate(title:string):void, onOpen(name:string):void}} handlers
 */
export function createStartScreen(container, { onCreate, onOpen }) {
  let errorEl = null;

  function render(projectNames) {
    container.innerHTML = '';
    const box = document.createElement('div');
    box.className = 'start-box';

    const brand = document.createElement('h1');
    brand.className = 'start-brand';
    brand.textContent = 'e-GIStory';
    box.appendChild(brand);

    const row = document.createElement('div');
    row.className = 'start-new';
    const title = document.createElement('input');
    title.type = 'text';
    title.id = 'start-title';
    title.placeholder = '새 스토리맵 제목';
    const create = document.createElement('button');
    create.type = 'button';
    create.id = 'btn-start-create';
    create.textContent = '새로 만들기';
    create.addEventListener('click', () => onCreate(title.value.trim() || '새 스토리맵'));
    row.appendChild(title);
    row.appendChild(create);
    box.appendChild(row);

    errorEl = document.createElement('div');
    errorEl.className = 'start-error';
    box.appendChild(errorEl);

    const listTitle = document.createElement('div');
    listTitle.className = 'start-list-title';
    listTitle.textContent = '저장된 스토리맵';
    box.appendChild(listTitle);

    if (!projectNames.length) {
      const empty = document.createElement('div');
      empty.className = 'start-empty';
      empty.textContent = '저장된 스토리맵이 없습니다';
      box.appendChild(empty);
    } else {
      for (const name of projectNames) {
        const item = document.createElement('button');
        item.type = 'button';
        item.className = 'start-item';
        item.textContent = name;
        item.addEventListener('click', () => onOpen(name));
        box.appendChild(item);
      }
    }

    container.appendChild(box);
  }

  function showError(message) {
    if (errorEl) errorEl.textContent = message;
  }

  return { render, showError };
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run src/editor/StartScreen.test.js` — Expected: PASS (6 tests). 전체 157.

- [ ] **Step 5: 커밋**

```bash
cd "C:/Users/김용현/Desktop/vibecoding/eGIS" && git add eStoryMap/src/editor/StartScreen.js eStoryMap/src/editor/StartScreen.test.js && git commit -m "feat(eStoryMap): M6 StartScreen — 새로 만들기/목록 열기(DOM)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## Task 6: 배선 — 시작 화면 게이트 + 자동저장 (M6 완료)

**Files:**
- Modify: `index.html`, `src/style.css`, `src/main.js`

- [ ] **Step 1: `index.html`** — 툴바의 `<span id="status"></span>` 앞에 저장 상태 표시 추가:

```html
        <span id="save-status"></span>
        <span id="status"></span>
```

그리고 `</body>` 직전, `#app` 닫는 `</div>` **다음**에:

```html
    <div id="start-screen"></div>
```

- [ ] **Step 2: `src/style.css` 끝에 추가**

```css
/* --- M6 시작 화면 + 저장 상태 --- */
#save-status { margin-left: auto; font-size: 12px; color: #64748b; }
#status { margin-left: 12px; } /* 기존 margin-left:auto는 save-status로 이동 */
#start-screen {
  position: fixed; inset: 0; z-index: 100; background: #0b0f14;
  display: flex; align-items: center; justify-content: center;
}
#start-screen:empty { display: none; }
.start-box { width: 420px; color: #e5e7eb; }
.start-brand { font-size: 28px; margin: 0 0 20px; text-align: center; }
.start-new { display: flex; gap: 8px; margin-bottom: 8px; }
.start-new input {
  flex: 1; padding: 8px 10px; border: 1px solid #334155; border-radius: 6px;
  background: #1e293b; color: #e5e7eb; font-size: 14px;
}
.start-new button {
  padding: 8px 14px; border: 1px solid #334155; background: #1d4ed8;
  color: #e5e7eb; border-radius: 6px; cursor: pointer;
}
.start-error { min-height: 18px; font-size: 12px; color: #f87171; margin-bottom: 8px; }
.start-list-title { font-size: 12px; color: #94a3b8; margin: 12px 0 6px; letter-spacing: 0.05em; }
.start-empty { font-size: 13px; color: #64748b; }
.start-item {
  display: block; width: 100%; text-align: left; padding: 8px 10px; margin-bottom: 4px;
  border: 1px solid #1e293b; background: #0f172a; color: #e5e7eb;
  border-radius: 6px; cursor: pointer; font-size: 14px;
}
.start-item:hover { border-color: #3b82f6; }
```

기존 `#status { margin-left: auto; … }` 규칙에서 `margin-left: auto;`를 **제거**한다(레이아웃 순서: save-status가 auto 마진을 가져감).

- [ ] **Step 3: `src/main.js` 재구성** — 다섯 군데:

① import에 추가:

```js
import { serializeStoryDoc, deserializeStoryDoc, createAutosaver } from './core/LocalStore.js';
import { createStartScreen } from './editor/StartScreen.js';
```

② 상태 선언부를 교체 — `const doc = createStoryDoc();`와 `let currentPageId = doc.pages[0].id;`를:

```js
const saveStatus = document.getElementById('save-status');
let doc = null; // 시작 화면에서 생성/로드 후 배정
let currentPageId = null;
let projectName = null; // .esm 파일명(제목) — M6에선 생성 시 고정
```

③ 자동저장 + 시작 플로우 — `contentEditor` 팩토리 아래에 추가:

```js
async function saveNow() {
  if (!doc || !projectName) return;
  try {
    saveStatus.textContent = '저장 중…';
    await window.egisFS.saveProject(projectName, serializeStoryDoc(doc));
    const t = new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
    saveStatus.textContent = `저장됨 ${t}`;
  } catch (e) {
    saveStatus.textContent = `저장 실패: ${e.message}`;
    console.error(e);
  }
}

const autosaver = createAutosaver(saveNow, { delay: 2000 });

/** 문서 변이 후 호출 — 2초 디바운스 자동저장. */
function scheduleSave() {
  autosaver.schedule();
}

let knownNames = [];
const startScreen = createStartScreen(document.getElementById('start-screen'), {
  onCreate(title) {
    if (knownNames.includes(title)) {
      startScreen.showError('같은 이름의 스토리맵이 이미 있습니다. 다른 제목을 입력하세요.');
      return;
    }
    doc = createStoryDoc(title);
    projectName = title;
    enterEditor();
    saveNow(); // 빈 문서라도 즉시 파일 생성(목록에 나타나게)
  },
  async onOpen(name) {
    try {
      await window.egisFS.backupProject(name); // 편집 세션 시작 전 스냅샷
      const text = await window.egisFS.loadProject(name);
      doc = deserializeStoryDoc(text);
      projectName = name;
      for (const source of doc.sources) {
        registry.addSource(source.sourceId, parseEgisDoc(source.egis)); // visible=false로 빌드
      }
      enterEditor();
    } catch (e) {
      startScreen.showError(`열기 실패: ${e.message}`);
      console.error(e);
    }
  },
});

function enterEditor() {
  currentPageId = doc.pages[0].id;
  document.getElementById('start-screen').style.display = 'none';
  document.title = `${doc.meta.title} — e-GIStory`;
  refresh();
  const page = getPage(doc, currentPageId);
  if (page && page.camera) mapView.setView(page.camera.center, page.camera.zoom); // 즉시 복원
}

async function boot() {
  knownNames = await window.egisFS.listProjects();
  startScreen.render(knownNames);
}
```

④ 변이 지점 6곳에 `scheduleSave()` 추가 — 각 핸들러의 기존 코드 뒤에 한 줄씩:

- `sourcePanel`의 `onToggleLayer`: `refresh();` 다음에 `scheduleSave();`
- `pageList`의 `onAdd`: `refresh();` 다음에 `scheduleSave();`
- `pageList`의 `onRemove`: `refresh();` 다음에 `scheduleSave();`
- `contentEditor`의 `onChange`: `setPageContent(...)` 다음에 `scheduleSave();`
- `addSourceFromEgis`: `refresh();` 다음 줄(상태 문구 앞)에 `scheduleSave();`
- `btn-capture` 핸들러: `setPageCamera(...)` 다음에 `scheduleSave();`

(`onSelect`는 문서를 바꾸지 않으므로 저장하지 않는다.)

⑤ 파일 맨 끝의 `refresh();`를 `boot();`로 교체(문서가 없는 상태로 refresh하면 안 됨).

- [ ] **Step 4: 전체 테스트 + 빌드 확인**

Run: `cd "C:/Users/김용현/Desktop/vibecoding/eGIS/eStoryMap" && npm test` — Expected: PASS (**157 tests**).
Run: `rm -rf dist && npx vite build 2>&1 | tail -3` — Expected: 에러 없이 완료.

- [ ] **Step 5: 수동 스모크 (M6 완료 판정 — 사용자 육안 확인)**

Run: `npm run dev`
Expected:
1. 시작 화면(제목 입력 + "저장된 스토리맵이 없습니다").
2. 제목 "부산 답사" 입력 → 새로 만들기 → 에디터 진입, 창 제목 "부산 답사 — e-GIStory", 우상단 "저장됨 HH:MM".
3. 소스 추가(.egis + 실제 .tif), 페이지 2개, 콘텐츠·카메라 캡처 → 각 편집 2초 후 "저장됨" 갱신.
4. "저장 폴더 열기" → `~/Desktop/e-GIStory/부산 답사.esm` 존재.
5. **앱 완전 종료 후 재실행** → 시작 화면 목록에 "부산 답사" → 클릭 → 소스(래스터 포함)·페이지·콘텐츠·카메라·체크 상태 전부 복원, 페이지 1 카메라로 시작.
6. 같은 제목으로 새로 만들기 시도 → 오류 문구.
7. `.backups/`에 열기 시점 스냅샷 1개 생성 확인.

- [ ] **Step 6: 커밋**

```bash
cd "C:/Users/김용현/Desktop/vibecoding/eGIS" && git add eStoryMap/index.html eStoryMap/src/style.css eStoryMap/src/main.js && git commit -m "feat(eStoryMap): M6 배선 — 시작 화면 게이트 + 2초 디바운스 자동저장

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## Self-Review

**1. 스펙 커버리지 (M6 범위, §3b·§7):**
- "LocalStore + 디바운스" → Task 2·3(serialize/deserialize/createAutosaver) + Task 6 ③④(2초 디바운스, 저장 중/저장됨 표시 — §3b "저장 중/완료 상태 표시"). ✓
- "시작 화면(목록/열기)" → Task 5 + Task 6(listProjects → render, 열기/새로 만들기). ✓
- "백업" → Task 4(.backups/{name}-{timestamp}.esm — 열기 시 1회로 의도적 변경, 범위 절에 근거 명시). ✓
- "폴더 열기 버튼" → M0부터 존재(변경 없음). ✓
- "`.esm` = StoryMapDoc JSON(sources의 .egis 임베드 포함)" → Task 1·2(TypedArray 인코딩 포함 임베드). §6 저장 포맷과 일치. ✓
- geotiffParse.js의 M6 주의 주석(TypedArray→encodeRasterMeta) → Task 1·2에서 이행. ✓

**2. 플레이스홀더 스캔:** 없음. ✓

**3. 타입/이름 일관성:** `encodeRasterMeta(rasterObj)`(rasterDecode) ↔ `decodeRasterMeta` 라운드트립 · `serializeStoryDoc(doc)→string`/`deserializeStoryDoc(text)→doc`/`createAutosaver(save,{delay})→{schedule}`(LocalStore) · `backupProject(name)`(fileService) ↔ IPC `project:backup` ↔ preload `egisFS.backupProject(name)` · `createStartScreen(container,{onCreate,onOpen})→{render(projectNames), showError(msg)}` — Task 6 main.js가 전부 동일 시그니처로 호출. `#start-screen`/`#save-status` id ↔ getElementById. ✓

**미해결(구현 중 실측):**
- 대형 래스터(수백만 셀) 직렬화 성능 — base64 chunk 루프는 e-GIS에서 실사용 검증된 코드. 2초 디바운스라 타이핑 프레임에는 영향 없음(저장 시 일시 정지 가능성만). 문제 체감 시 백로그(웹워커/증분 저장).
- `.esm` 저장 중 앱 종료(마지막 2초 편집 유실) — window close 시 flush는 백로그(will-quit에서 동기 저장 검토).
- `#status`의 `margin-left:auto` 제거 후 툴바 정렬 — 스모크에서 확인.
