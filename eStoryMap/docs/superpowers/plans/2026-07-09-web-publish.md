# 스토리맵 웹 게시 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 데스크톱에서 만든 스토리맵을 `https://e-gis.kr/{handle}/{seq}` 링크로 게시해 누구나 발표 모드로 볼 수 있게 한다.

**Architecture:** Supabase 새 테이블 `published_storymaps`(공개 읽기 RLS)에 스냅샷 게시. 데스크톱은 `Publisher.js`+게시 대화상자. 뷰어는 eStoryMap의 두 번째 Vite 빌드(`viewer.html`, Electron 플러그인 없음) → 산출물을 `eGIS/public/story/`로 복사 → Vercel rewrite `/:handle/:seq(\d+)` → 뷰어 한 페이지.

**Tech Stack:** 기존 그대로 — Vite, OL9, supabase-js, Vitest(가짜 클라이언트 주입). 스펙: `docs/superpowers/specs/2026-07-09-web-publish-design.md`

**이 머신 함정(필독):** 재귀 삭제는 node fs로 하면 exit 127로 죽음 → `cmd rmdir /s /q` 사용(scripts/clean.js 참조). 뷰어 빌드도 `emptyOutDir: false` + 스크립트에서 rmdir로 선청소.

---

### Task 1: Supabase 테이블 + RLS (SQL 파일) — ⚠️ 사용자 실행 필요

**Files:** Create: `C:/Users/김용현/Desktop/vibecoding/eGIS/supabase-published-storymaps.sql` (eGIS 루트, page_views SQL과 나란히)

- [ ] **Step 1: SQL 파일 작성**

```sql
-- 스토리맵 웹 게시 테이블 및 정책 — Supabase SQL Editor에서 1회 실행
CREATE TABLE IF NOT EXISTS published_storymaps (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  handle TEXT NOT NULL,
  seq INT NOT NULL,
  title TEXT NOT NULL DEFAULT '',
  doc JSONB NOT NULL,
  published_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (handle, seq),
  UNIQUE (user_id, seq)
);
ALTER TABLE published_storymaps ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read published storymaps"
  ON published_storymaps FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Owners can insert" ON published_storymaps FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Owners can update" ON published_storymaps FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Owners can delete" ON published_storymaps FOR DELETE
  TO authenticated USING (auth.uid() = user_id);
```

- [ ] **Step 2: 사용자에게 실행 요청** — Supabase 대시보드 SQL Editor에서 실행해 달라고 요청(코드 작업은 병행 가능, Task 10 수동 검증 전까지만 완료되면 됨)
- [ ] **Step 3: Commit** — `git add supabase-published-storymaps.sql && git commit -m "웹 게시: published_storymaps 테이블+RLS SQL"`

### Task 2: StoryDoc — setPublishInfo

**Files:** Modify: `eStoryMap/src/core/StoryDoc.js` (기존 setter들 옆), Test: `eStoryMap/src/core/StoryDoc.test.js`

- [ ] **Step 1: 실패 테스트** (기존 describe 패턴에 추가)

```js
import { setPublishInfo } from './StoryDoc.js'; // 기존 import에 추가

describe('setPublishInfo', () => {
  it('게시 정보를 meta.publish에 기록한다', () => {
    const doc = createStoryDoc('t');
    setPublishInfo(doc, { id: 'row1', handle: 'fkv777gmail', seq: 3 });
    expect(doc.meta.publish).toEqual({ id: 'row1', handle: 'fkv777gmail', seq: 3 });
  });
  it('null이면 meta.publish를 제거한다', () => {
    const doc = createStoryDoc('t');
    setPublishInfo(doc, { id: 'row1', handle: 'h', seq: 1 });
    setPublishInfo(doc, null);
    expect(doc.meta.publish).toBeUndefined();
  });
});
```

- [ ] **Step 2: 실패 확인** — `cd eStoryMap && npx vitest run src/core/StoryDoc.test.js` → FAIL(export 없음)
- [ ] **Step 3: 구현**

```js
/** 웹 게시 정보 기록/제거. info=null이면 제거(게시 취소). */
export function setPublishInfo(doc, info) {
  if (info) doc.meta.publish = { id: info.id, handle: info.handle, seq: info.seq };
  else delete doc.meta.publish;
}
```

- [ ] **Step 4: 통과 확인 + Commit** — `feat: StoryDoc 게시 정보(meta.publish) setter`

### Task 3: Publisher.js (핵심 — TDD)

**Files:** Create: `eStoryMap/src/core/Publisher.js`, Test: `eStoryMap/src/core/Publisher.test.js` (CloudSync.test.js의 가짜 클라이언트 스타일 참조)

- [ ] **Step 1: 실패 테스트 작성** — 케이스: deriveHandle 규칙 4개, publicUrl, 미로그인 throw, 첫 게시(seq=max+1·meta 기록), 재게시(같은 행 update), 재게시 시 행 소실(update 0행→저장 seq로 insert), 첫 게시 seq 경합(23505 1회 재시도), unpublish(delete+meta 제거)

```js
import { describe, it, expect } from 'vitest';
import { createPublisher, deriveHandle, publicUrl } from './Publisher.js';
import { createStoryDoc } from './StoryDoc.js';

describe('deriveHandle', () => {
  it('앞부분+도메인 첫 단어, 소문자, 영숫자만', () => {
    expect(deriveHandle('fkv777@gmail.com')).toBe('fkv777gmail');
    expect(deriveHandle('John.Doe+tag@Naver.com')).toBe('johndoetagnaver');
  });
  it('영숫자가 없으면 u+user_id 앞 8자', () => {
    expect(deriveHandle('한글만@한글.kr', 'abcd1234-xxxx')).toBe('uabcd1234');
  });
});

describe('publicUrl', () => {
  it('e-gis.kr 주소를 만든다', () => {
    expect(publicUrl({ handle: 'fkv777gmail', seq: 3 })).toBe('https://e-gis.kr/fkv777gmail/3');
  });
});

// ---- 가짜 supabase 클라이언트: 호출 로그를 남기고 시나리오별 응답을 돌려준다 ----
function fakeClient(script) {
  const calls = [];
  function chain(op) {
    const call = { op, filters: {} };
    calls.push(call);
    const c = {
      insert(v) { call.insert = v; return c; },
      update(v) { call.update = v; return c; },
      delete() { call.op += ':delete'; return c; },
      select(cols) { call.select = cols; return c; },
      eq(k, v) { call.filters[k] = v; return c; },
      order() { return c; },
      limit() { return c; },
      single() { return script.shift(); },
      maybeSingle() { return script.shift(); },
      then(res, rej) { return Promise.resolve(script.shift()).then(res, rej); },
    };
    return c;
  }
  return { client: { from: (t) => chain(t) }, calls };
}

const user = { id: 'uid-1', email: 'fkv777@gmail.com' };

describe('publish', () => {
  it('미로그인이면 throw', async () => {
    const { client } = fakeClient([]);
    const p = createPublisher({ client, getUser: () => null });
    await expect(p.publish(createStoryDoc('t'))).rejects.toThrow('로그인');
  });

  it('첫 게시: max+1 seq로 insert하고 meta.publish를 기록한다', async () => {
    const { client, calls } = fakeClient([
      { data: [{ seq: 4 }], error: null },                                    // nextSeq 조회
      { data: { id: 'row9', handle: 'fkv777gmail', seq: 5 }, error: null },   // insert().single()
    ]);
    const p = createPublisher({ client, getUser: () => user });
    const doc = createStoryDoc('제주');
    const res = await p.publish(doc);
    expect(doc.meta.publish).toEqual({ id: 'row9', handle: 'fkv777gmail', seq: 5 });
    expect(res.url).toBe('https://e-gis.kr/fkv777gmail/5');
    expect(calls[1].insert.seq).toBe(5);
  });

  it('첫 게시 seq 경합(23505)이면 번호를 다시 받아 1회 재시도', async () => {
    const { client } = fakeClient([
      { data: [], error: null },                                              // nextSeq → 1
      { data: null, error: { code: '23505', message: 'duplicate' } },         // insert 충돌
      { data: [{ seq: 1 }], error: null },                                    // nextSeq → 2
      { data: { id: 'row2', handle: 'fkv777gmail', seq: 2 }, error: null },   // insert 성공
    ]);
    const p = createPublisher({ client, getUser: () => user });
    const doc = createStoryDoc('t');
    await p.publish(doc);
    expect(doc.meta.publish.seq).toBe(2);
  });

  it('재게시: meta.publish.id 행을 update한다', async () => {
    const { client, calls } = fakeClient([
      { data: [{ id: 'row9' }], error: null },                                // update().select()
    ]);
    const p = createPublisher({ client, getUser: () => user });
    const doc = createStoryDoc('제주');
    doc.meta.publish = { id: 'row9', handle: 'fkv777gmail', seq: 5 };
    const res = await p.publish(doc);
    expect(calls[0].update.title).toBe('제주');
    expect(calls[0].filters.id).toBe('row9');
    expect(res.url).toBe('https://e-gis.kr/fkv777gmail/5');
  });

  it('재게시인데 행이 사라졌으면 저장된 seq로 다시 insert(링크 유지)', async () => {
    const { client, calls } = fakeClient([
      { data: [], error: null },                                              // update → 0행
      { data: { id: 'rowN', handle: 'fkv777gmail', seq: 5 }, error: null },   // insert().single()
    ]);
    const p = createPublisher({ client, getUser: () => user });
    const doc = createStoryDoc('t');
    doc.meta.publish = { id: 'gone', handle: 'fkv777gmail', seq: 5 };
    await p.publish(doc);
    expect(calls[1].insert.seq).toBe(5);
    expect(doc.meta.publish.id).toBe('rowN');
  });
});

describe('unpublish', () => {
  it('행을 지우고 meta.publish를 제거한다', async () => {
    const { client, calls } = fakeClient([{ data: null, error: null }]);
    const p = createPublisher({ client, getUser: () => user });
    const doc = createStoryDoc('t');
    doc.meta.publish = { id: 'row9', handle: 'h', seq: 5 };
    await p.unpublish(doc);
    expect(calls[0].filters.id).toBe('row9');
    expect(doc.meta.publish).toBeUndefined();
  });
});
```

- [ ] **Step 2: 실패 확인** — `npx vitest run src/core/Publisher.test.js` → FAIL(모듈 없음)
- [ ] **Step 3: 구현**

```js
// © 2026 김용현
// eStoryMap/src/core/Publisher.js
// 스토리맵 웹 게시(published_storymaps) — 주입식(CloudSync 패턴).
// 스냅샷 게시: 게시 시점 문서를 통째로 올리고, 재게시 전까지 불변. RLS: 읽기 공개·쓰기 본인.
import { authErrorMessage } from './AuthManager.js';
import { serializeStoryDoc } from './LocalStore.js';
import { setPublishInfo } from './StoryDoc.js';

const TABLE = 'published_storymaps';
const BASE_URL = 'https://e-gis.kr';

/** 이메일 → 공개 아이디. 앞부분+도메인 첫 단어, 소문자, 영숫자만. 비면 u+user_id 앞 8자. */
export function deriveHandle(email, userId = '') {
  const [local = '', domain = ''] = String(email || '').toLowerCase().split('@');
  const h = (local + domain.split('.')[0]).replace(/[^a-z0-9]/g, '');
  return h || 'u' + String(userId).toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 8);
}

/** 게시 정보 → 공개 URL. */
export function publicUrl({ handle, seq }) {
  return `${BASE_URL}/${handle}/${seq}`;
}

export function createPublisher({ client, getUser }) {
  function requireUser() {
    const user = getUser();
    if (!user) throw new Error('로그인이 필요합니다.');
    return user;
  }

  /** supabase 두 실패 경로를 한국어 Error로. 재시도 판단용으로 code는 보존한다. */
  async function run(query) {
    let res;
    try { res = await query; } catch (e) { throw new Error(authErrorMessage(e)); }
    if (res && res.error) {
      const err = new Error(authErrorMessage(res.error));
      err.code = res.error.code;
      throw err;
    }
    return res ? res.data : null;
  }

  /** 내 다음 게시 번호(max+1, 결번 재사용 안 함 — 최댓값 기준이라 자연 충족). */
  async function nextSeq(userId) {
    const rows = await run(
      client.from(TABLE).select('seq').eq('user_id', userId).order('seq', { ascending: false }).limit(1),
    );
    return rows && rows.length ? rows[0].seq + 1 : 1;
  }

  async function insertRow(user, handle, seq, doc, snapshot) {
    const data = await run(client.from(TABLE).insert({
      user_id: user.id, handle, seq, title: doc.meta.title, doc: snapshot,
    }).select('id,handle,seq').single());
    setPublishInfo(doc, data);
    return { url: publicUrl(data) };
  }

  return {
    /** 게시/재게시. 성공 시 doc.meta.publish 갱신 + {url} 반환(저장은 호출부 scheduleSave). */
    async publish(doc) {
      const user = requireUser();
      const handle = deriveHandle(user.email, user.id);
      const snapshot = JSON.parse(serializeStoryDoc(doc)); // jsonb 컬럼용(CloudSync와 동일 트레이드오프)
      const prev = doc.meta.publish;
      if (prev && prev.id) {
        const rows = await run(client.from(TABLE).update({
          title: doc.meta.title, doc: snapshot, updated_at: new Date().toISOString(),
        }).eq('id', prev.id).select('id'));
        if (rows && rows.length) return { url: publicUrl(prev) };
        return insertRow(user, handle, prev.seq, doc, snapshot); // 행 소실(타 기기 취소) → 같은 번호로 복원
      }
      for (let attempt = 0; ; attempt++) {
        const seq = await nextSeq(user.id);
        try {
          return await insertRow(user, handle, seq, doc, snapshot);
        } catch (e) {
          if (e.code !== '23505' || attempt >= 1) throw e; // 경합은 1회만 재시도
        }
      }
    },

    /** 게시 취소. 행 삭제 + meta.publish 제거(멱등 — 미게시면 no-op). */
    async unpublish(doc) {
      requireUser();
      const prev = doc.meta.publish;
      if (!prev || !prev.id) return;
      await run(client.from(TABLE).delete().eq('id', prev.id));
      setPublishInfo(doc, null);
    },
  };
}
```

- [ ] **Step 4: 통과 확인** — `npx vitest run src/core/Publisher.test.js` → PASS (전체도: `npx vitest run`)
- [ ] **Step 5: Commit** — `feat: Publisher — 스토리맵 웹 게시/재게시/취소 코어`

### Task 4: 게시 대화상자 + 툴바 연결 (접착 — 수동 스모크)

**Files:** Create: `eStoryMap/src/editor/publishDialog.js` / Modify: `eStoryMap/index.html`(툴바), `eStoryMap/src/main.js`(연결), `eStoryMap/src/style.css`(스타일)

- [ ] **Step 1: index.html 툴바에 버튼 추가** (`btn-slidepdf` 다음 줄)

```html
<button id="btn-publish" type="button" title="이 스토리맵을 웹에 게시 — 누구나 링크로 볼 수 있습니다">🌐 게시</button>
```

- [ ] **Step 2: publishDialog.js 작성** (confirmDialog 스타일 — overlay/box 클래스 재사용)

```js
// © 2026 김용현
// eStoryMap/src/editor/publishDialog.js
// 게시 대화상자(접착) — 미게시: 확인→게시. 게시됨: 링크 표시+[재게시][링크 복사][게시 취소].
import { confirmDialog } from './confirmDialog.js';
import { publicUrl } from '../core/Publisher.js';
import { serializeStoryDoc } from '../core/LocalStore.js';

const SIZE_WARN_BYTES = 10 * 1024 * 1024;

/** @param {{doc:object, publisher:object, openExternal:(url:string)=>void, onChanged:()=>void}} deps */
export function openPublishDialog({ doc, publisher, openExternal, onChanged }) {
  const overlay = document.createElement('div');
  overlay.className = 'confirm-overlay';
  const box = document.createElement('div');
  box.className = 'confirm-box publish-box';
  overlay.appendChild(box);
  document.body.appendChild(overlay);

  function close() { overlay.remove(); document.removeEventListener('keydown', onKey, true); }
  function onKey(e) { if (e.key === 'Escape') { e.preventDefault(); close(); } }
  document.addEventListener('keydown', onKey, true);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });

  function btn(text, cls, onClick) {
    const b = document.createElement('button');
    b.type = 'button'; b.className = cls; b.textContent = text;
    b.addEventListener('click', onClick);
    return b;
  }

  function render() {
    box.innerHTML = '';
    const msg = document.createElement('div');
    msg.className = 'confirm-msg';
    const note = document.createElement('div');
    note.className = 'publish-note';
    const actions = document.createElement('div');
    actions.className = 'confirm-actions';

    if (doc.meta.publish) {
      const url = publicUrl(doc.meta.publish);
      msg.textContent = '이 스토리맵은 웹에 게시되어 있습니다.';
      const urlInput = document.createElement('input');
      urlInput.className = 'publish-url'; urlInput.readOnly = true; urlInput.value = url;
      urlInput.addEventListener('focus', () => urlInput.select());
      actions.append(
        btn('링크 복사', 'confirm-cancel', async () => {
          try { await navigator.clipboard.writeText(url); note.textContent = '복사했습니다.'; }
          catch { urlInput.focus(); note.textContent = 'Ctrl+C로 복사하세요.'; }
        }),
        btn('브라우저에서 열기', 'confirm-cancel', () => openExternal(url)),
        btn('재게시', 'confirm-ok', () => doPublish('재게시했습니다. 링크 내용이 현재 문서로 갱신되었습니다.')),
        btn('게시 취소', 'confirm-ok danger', async () => {
          if (!(await confirmDialog('게시를 취소할까요? 링크가 더 이상 열리지 않습니다.', { confirmText: '게시 취소' }))) return;
          try { await publisher.unpublish(doc); onChanged(); render(); }
          catch (e) { note.textContent = `실패: ${e.message}`; }
        }),
        btn('닫기', 'confirm-cancel', close),
      );
      box.append(msg, urlInput, note, actions);
    } else {
      msg.textContent = '이 스토리맵을 웹에 게시할까요? 링크를 아는 누구나 볼 수 있게 됩니다.';
      if (serializeStoryDoc(doc).length > SIZE_WARN_BYTES) {
        note.textContent = '⚠️ 문서가 10MB를 넘습니다. 게시는 되지만 방문자의 로딩이 느릴 수 있습니다.';
      }
      actions.append(
        btn('취소', 'confirm-cancel', close),
        btn('게시', 'confirm-ok', () => doPublish('게시되었습니다! 아래 링크를 공유하세요.')),
      );
      box.append(msg, note, actions);
    }

    async function doPublish(doneMsg) {
      note.textContent = '게시 중…';
      try {
        await publisher.publish(doc);
        onChanged();
        render();
        box.querySelector('.publish-note').textContent = doneMsg;
      } catch (e) { note.textContent = `게시 실패: ${e.message}`; }
    }
  }

  render();
}
```

- [ ] **Step 3: main.js 연결** (cloudSync 생성부 근처 + 버튼 리스너들 근처)

```js
import { createPublisher } from './core/Publisher.js';
import { openPublishDialog } from './editor/publishDialog.js';
// ...
const publisher = createPublisher({ client: supabase, getUser: () => authManager.getUser() });
document.getElementById('btn-publish').addEventListener('click', () => {
  if (!doc) return;
  if (!authManager.isLoggedIn()) {
    status.textContent = '게시하려면 🗂 프로젝트 화면에서 로그인하세요.';
    return;
  }
  openPublishDialog({
    doc, publisher,
    openExternal: (url) => window.egisFS.openExternal(url),
    onChanged: () => scheduleSave(),
  });
});
```

- [ ] **Step 4: style.css에 소량 추가**

```css
/* 게시 대화상자 */
.publish-box { min-width: 26rem; }
.publish-url { width: 100%; margin: .5rem 0; padding: .4rem .5rem; font: inherit;
  color: var(--fg); background: var(--panel-bg); border: 1px solid var(--border); border-radius: 6px; }
.publish-note { min-height: 1.2em; font-size: .85rem; opacity: .85; margin-bottom: .25rem; }
```

(변수명은 style.css 상단의 실제 테마 변수명에 맞출 것 — 편집 전 확인)

- [ ] **Step 5: 수동 스모크** — `npm run dev`로 실행, 로그인 후 게시→링크 복사→재게시→게시 취소 흐름과 미로그인 안내 확인. Supabase 대시보드에서 행 생성/삭제 확인
- [ ] **Step 6: Commit** — `feat: 게시 대화상자 + 툴바 🌐 게시 버튼`

### Task 5: slideFont 공용화 (편집기·뷰어 공유)

**Files:** Create: `eStoryMap/src/shared/slideFont.js` / Modify: `eStoryMap/src/main.js`(SLIDE_FONT_STACKS·applySlideFont 제거 후 import)

- [ ] **Step 1: main.js의 `SLIDE_FONT_STACKS`와 `applySlideFont`를 그대로 이동**

```js
// © 2026 김용현
// eStoryMap/src/shared/slideFont.js
// 슬라이드 글꼴 스택 — --slide-font 변수로 편집기/발표/보고서/웹뷰어 일괄 적용.
export const SLIDE_FONT_STACKS = {
  default: 'system-ui, "Segoe UI", "Malgun Gothic", sans-serif',
  sans: "'Noto Sans KR', system-ui, sans-serif",
  serif: "'Noto Serif KR', serif",
};

export function applySlideFont(font, custom) {
  const stack = font === 'system' && custom
    ? `"${custom}", system-ui, "Segoe UI", sans-serif` // custom은 setSlideFontCustom에서 이미 살균됨
    : SLIDE_FONT_STACKS[font] || SLIDE_FONT_STACKS.default;
  document.documentElement.style.setProperty('--slide-font', stack);
}
```

main.js: 두 정의 삭제, `import { applySlideFont } from './shared/slideFont.js';` 추가(호출부 3곳 시그니처 동일 — 변경 없음).

- [ ] **Step 2: 확인 + Commit** — `npx vitest run` PASS, `npm run dev`로 글꼴 셀렉트 동작 확인 → `refactor: applySlideFont를 shared로 이동(뷰어 공유 준비)`

### Task 6: PresentationShell — standalone 옵션

**Files:** Modify: `eStoryMap/src/viewer/PresentationShell.js` (접착 컴포넌트 — 기존 방침대로 단위 테스트 없음, 뷰어에서 수동 스모크)

- [ ] **Step 1: 옵션 추가** — 시그니처에 `standalone = false` 추가:

```js
export function createPresentationShell(root, { mapEl, mapHome, mapView, animator, registry, legend, getDoc, onExit, standalone = false }) {
```

네 군데 분기:

```js
const exitBtn = mkBtn('✕', 'pres-exit', '발표 종료 (Esc)', () => exit());
if (standalone) exitBtn.style.display = 'none'; // 웹뷰어: 발표가 곧 페이지 — 종료 없음
```

```js
      case 'Escape': if (!standalone) { e.preventDefault(); exit(); } break;
```

```js
    if (document.fullscreenElement) {
      mapView.updateSize();
      applyCurrentCamera();
    } else if (!standalone) exit();
```

```js
    // 전체화면 시도(웹뷰어는 제스처 없이 불가 + 페이지 자체가 무대라 생략)
    if (!standalone && root.requestFullscreen) root.requestFullscreen().catch(() => {});
```

- [ ] **Step 2: 확인 + Commit** — `npx vitest run` PASS(기존 무영향), 데스크톱 발표 모드 수동 확인 → `feat: PresentationShell standalone 옵션(웹뷰어용)`

### Task 7: 웹뷰어 — 주소 파싱(TDD) + 엔트리

**Files:** Create: `eStoryMap/src/webviewer/parseStoryPath.js`, `eStoryMap/src/webviewer/parseStoryPath.test.js`, `eStoryMap/src/webviewer/main.js`, `eStoryMap/viewer.html` / Modify: `eStoryMap/src/style.css`

- [ ] **Step 1: parseStoryPath 실패 테스트**

```js
import { describe, it, expect } from 'vitest';
import { parseStoryPath } from './parseStoryPath.js';

describe('parseStoryPath', () => {
  it('/{handle}/{seq} 경로를 파싱한다', () => {
    expect(parseStoryPath('/fkv777gmail/3')).toEqual({ handle: 'fkv777gmail', seq: 3 });
    expect(parseStoryPath('/abc1/12/')).toEqual({ handle: 'abc1', seq: 12 });
  });
  it('?s= 폴백을 지원한다(로컬 미리보기용)', () => {
    expect(parseStoryPath('/viewer.html', '?s=fkv777gmail/3')).toEqual({ handle: 'fkv777gmail', seq: 3 });
  });
  it('비정상 경로는 null', () => {
    expect(parseStoryPath('/')).toBeNull();
    expect(parseStoryPath('/onlyhandle')).toBeNull();
    expect(parseStoryPath('/handle/abc')).toBeNull();
    expect(parseStoryPath('/UPPER/1')).toBeNull(); // handle은 소문자 영숫자만
  });
});
```

- [ ] **Step 2: 실패 확인 → 구현**

```js
// © 2026 김용현
// eStoryMap/src/webviewer/parseStoryPath.js
// 게시 주소 파싱(순수). rewrite로 /{handle}/{seq}가 뷰어에 그대로 옴. ?s=handle/seq는 로컬 미리보기 폴백.
export function parseStoryPath(pathname, search = '') {
  const q = new URLSearchParams(search).get('s');
  const target = q ? '/' + q : String(pathname || '');
  const m = /^\/([a-z0-9]+)\/(\d{1,9})\/?$/.exec(target);
  return m ? { handle: m[1], seq: Number(m[2]) } : null;
}
```

- [ ] **Step 3: 통과 확인 + Commit** — `feat: 웹뷰어 주소 파싱`
- [ ] **Step 4: viewer.html 작성** (프로젝트 루트, index.html 옆)

```html
<!-- © 2026 김용현 -->
<!doctype html>
<html lang="ko">
  <head>
    <meta charset="UTF-8" />
    <!-- 데스크톱과 같은 취지의 CSP. 지도 타일·임의 웹 이미지=img https:, YouTube 임베드, Supabase 조회 -->
    <meta
      http-equiv="Content-Security-Policy"
      content="default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; frame-src https://www.youtube-nocookie.com https://www.youtube.com; connect-src 'self' https://lufbotdmhgsuvejlytgh.supabase.co; font-src 'self' data:; worker-src 'self' blob:; object-src 'none'; base-uri 'self'"
    />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>e-GIS 스토리맵</title>
  </head>
  <body class="webviewer">
    <div id="viewer-status">스토리맵을 불러오는 중…</div>
    <div id="map-home" hidden><div id="map"><div id="legend" hidden></div></div></div>
    <div id="presentation"></div>
    <a id="viewer-brand" href="https://e-gis.kr" target="_blank" rel="noopener">e-GIS로 제작</a>
    <script type="module" src="./src/webviewer/main.js"></script>
  </body>
</html>
```

- [ ] **Step 5: src/webviewer/main.js 작성**

```js
// © 2026 김용현
// eStoryMap/src/webviewer/main.js
// 게시된 스토리맵 웹뷰어(접착) — 주소 파싱 → Supabase 공개 조회 → 발표 모드(standalone) 진입.
import 'ol/ol.css';
import '../style.css';
import '@fontsource/noto-sans-kr/korean-400.css';
import '@fontsource/noto-sans-kr/korean-700.css';
import '@fontsource/noto-sans-kr/latin-400.css';
import '@fontsource/noto-sans-kr/latin-700.css';
import '@fontsource/noto-serif-kr/korean-400.css';
import '@fontsource/noto-serif-kr/korean-700.css';
import '@fontsource/noto-serif-kr/latin-400.css';
import '@fontsource/noto-serif-kr/latin-700.css';
import { MapView } from '../core/MapView.js';
import { SourceRegistry } from '../core/SourceRegistry.js';
import { parseEgisDoc } from '../core/egisParse.js';
import { deserializeStoryDoc } from '../core/LocalStore.js';
import { CameraAnimator } from '../shared/CameraAnimator.js';
import { applySlideFont } from '../shared/slideFont.js';
import { createPresentationShell } from '../viewer/PresentationShell.js';
import { createLegend } from '../editor/Legend.js';
import { createSupabaseClient } from '../core/supabaseClient.js';
import { parseStoryPath } from './parseStoryPath.js';

const statusEl = document.getElementById('viewer-status');

function fail(msg, { retry = false } = {}) {
  statusEl.textContent = msg;
  statusEl.classList.add('error');
  if (retry) {
    const b = document.createElement('button');
    b.type = 'button'; b.textContent = '다시 시도';
    b.addEventListener('click', () => location.reload());
    statusEl.appendChild(document.createElement('br'));
    statusEl.appendChild(b);
  }
}

async function boot() {
  const ref = parseStoryPath(location.pathname, location.search);
  if (!ref) return fail('스토리맵을 찾을 수 없습니다. 주소를 확인하세요.');

  let row;
  try {
    const res = await createSupabaseClient()
      .from('published_storymaps').select('doc')
      .eq('handle', ref.handle).eq('seq', ref.seq).maybeSingle();
    if (res.error) throw new Error(res.error.message);
    row = res.data;
  } catch (e) {
    console.error('[viewer] 조회 실패:', e);
    return fail('스토리맵을 불러오지 못했습니다. 네트워크를 확인하세요.', { retry: true });
  }
  if (!row) return fail('스토리맵을 찾을 수 없습니다. 게시가 취소되었거나 주소가 잘못되었습니다.');

  let doc;
  try {
    doc = deserializeStoryDoc(JSON.stringify(row.doc));
  } catch (e) {
    console.error('[viewer] 문서 손상:', e);
    return fail('스토리맵 문서를 열 수 없습니다.');
  }

  document.title = `${doc.meta.title} — e-GIS`;
  const mapView = new MapView('map');
  const registry = new SourceRegistry(mapView);
  for (const source of doc.sources) registry.addSource(source.sourceId, parseEgisDoc(source.egis));
  const animator = new CameraAnimator(mapView.map.getView(), { zoomForView: (z) => mapView.toRawZoom(z) });
  const legend = createLegend(document.getElementById('legend'), { getDoc: () => doc, onChange: () => {} });
  applySlideFont(doc.meta.slideFont || 'default', doc.meta.slideFontCustom);

  const shell = createPresentationShell(document.getElementById('presentation'), {
    mapEl: document.getElementById('map'),
    mapHome: document.getElementById('map-home'),
    mapView, animator, registry, legend,
    getDoc: () => doc,
    onExit: () => {},
    standalone: true,
  });
  statusEl.hidden = true;
  shell.enter(0);
}

boot();
```

주의: `MapView('map')` 생성 시 컨테이너가 `hidden`이라 크기 0 — `shell.enter()`가 재부모 후 `updateSize()`를 호출하므로 정상. 편집기 `main.js`가 이미 쓰는 흐름과 동일.

- [ ] **Step 6: style.css에 뷰어 상태·브랜드 스타일 추가**

```css
/* 웹뷰어 */
body.webviewer { margin: 0; background: #0b0e14; }
body.webviewer #presentation { display: block; }
#viewer-status { position: fixed; inset: 0; display: grid; place-content: center; text-align: center;
  gap: .75rem; color: #dbe2ef; font: 1rem/1.6 system-ui, "Segoe UI", "Malgun Gothic", sans-serif; }
#viewer-status.error { color: #ffb4b4; }
#viewer-status button { padding: .45rem 1.1rem; cursor: pointer; }
#viewer-brand { position: fixed; right: .75rem; bottom: .55rem; z-index: 50; font-size: .75rem;
  color: #9aa7bd; text-decoration: none; opacity: .8; }
#viewer-brand:hover { opacity: 1; text-decoration: underline; }
```

(#presentation 기존 규칙이 `display:none` 기본이면 그대로 두고 shell이 제어 — 위 display:block은 불필요 시 제거)

- [ ] **Step 7: Commit** — `feat: 웹뷰어 엔트리(viewer.html + webviewer/main.js)`

### Task 8: 뷰어 빌드 설정 + eGIS/public/story 배치 스크립트

**Files:** Create: `eStoryMap/vite.viewer.config.js`, `eStoryMap/scripts/build-viewer.js` / Modify: `eStoryMap/package.json`(scripts)

- [ ] **Step 1: vite.viewer.config.js**

```js
// © 2026 김용현
// 웹뷰어 전용 빌드 — Electron 플러그인 없음(순수 웹). 산출물은 /story/ 아래에서 서빙된다.
import { defineConfig } from 'vite';

export default defineConfig({
  base: '/story/',
  build: {
    outDir: 'dist-viewer',
    emptyOutDir: false, // ⚠️ vite의 재귀 삭제가 CFA에 막혀 127로 죽음 — build-viewer.js가 rmdir로 선청소
    rollupOptions: { input: 'viewer.html' },
  },
});
```

- [ ] **Step 2: scripts/build-viewer.js** (clean.js와 같은 cmd-네이티브 방식)

```js
// © 2026 김용현
// 뷰어 빌드 → eGIS/public/story 배치. 재귀 삭제/복사는 CFA 정책 때문에 OS 네이티브 명령 사용(clean.js 참조).
const { execSync } = require('node:child_process');
const { renameSync } = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');                 // eStoryMap
const out = path.join(root, 'dist-viewer');
const dest = path.resolve(root, '..', 'public', 'story');   // eGIS/public/story

for (const dir of [out, dest]) {
  try { execSync(`rmdir /s /q "${dir}"`, { stdio: 'ignore' }); } catch { /* 없으면 무시 */ }
}
execSync('npx vite build --config vite.viewer.config.js', { cwd: root, stdio: 'inherit' });
renameSync(path.join(out, 'viewer.html'), path.join(out, 'index.html')); // rewrite 목적지 = /story/index.html
// robocopy는 0~7이 성공 — execSync는 0 외 throw하므로 감싼다
try { execSync(`robocopy "${out}" "${dest}" /E /NFL /NDL /NJH /NJS`, { stdio: 'ignore' }); }
catch (e) { if (typeof e.status !== 'number' || e.status > 7) throw e; }
console.log('뷰어 배치 완료 → ' + dest);
```

- [ ] **Step 3: package.json scripts에 추가** — `"build:viewer": "node scripts/build-viewer.js"`
- [ ] **Step 4: 빌드 실행·산출물 확인** — `cd eStoryMap && npm run build:viewer` → `eGIS/public/story/index.html`과 `story/assets/*` 생성, index.html 안 자산 경로가 `/story/assets/...`인지 확인
- [ ] **Step 5: 로컬 스모크** — Task 1 SQL 실행 + Task 4에서 1건 게시해 둔 상태에서: `cd eGIS && npx serve public`(또는 `npx http-server public`) → `http://localhost:3000/story/?s={handle}/1` 열어 발표 렌더 확인(지도 타일·미디어·글꼴·범례)
- [ ] **Step 6: Commit** — `feat: 뷰어 빌드(vite.viewer.config) + public/story 배치 스크립트`

### Task 9: Vercel rewrite + 배포

**Files:** Modify: `C:/Users/김용현/Desktop/vibecoding/eGIS/vercel.json`

- [ ] **Step 1: rewrite 추가**

```json
{
  "cleanUrls": true,
  "rewrites": [
    { "source": "/:handle/:seq(\\d+)", "destination": "/story/index.html" }
  ]
}
```

- [ ] **Step 2: Commit** — `git add vercel.json public/story && git commit -m "웹 게시: 뷰어 배치 + /{handle}/{seq} rewrite"` (public/story 산출물 포함 커밋)
- [ ] **Step 3: 배포** — `cd "C:/Users/김용현/Desktop/vibecoding/eGIS" && npx vercel deploy --prod --yes`

### Task 10: 종단 검증 (수동)

- [ ] **Step 1: 전체 테스트** — `cd eStoryMap && npx vitest run` → 전부 PASS
- [ ] **Step 2: 실링크 확인** — 데스크톱에서 게시한 문서의 `https://e-gis.kr/{handle}/{seq}` 접속: 발표 렌더/이전·다음/카메라 애니메이션/범례/미디어/글꼴 확인. 하드 새로고침(Ctrl+Shift+R — 배포 직후 캐시 함정)
- [ ] **Step 3: 오류 경로 확인** — 없는 주소(`/nobody/999`) → "찾을 수 없습니다", 게시 취소 후 기존 링크 → 같은 메시지
- [ ] **Step 4: 기존 기능 무회귀** — 기존 사이트 `https://e-gis.kr/`와 `/privacy` 정상, 데스크톱 발표 모드/Esc 종료 정상

### Task 11: 데스크톱 v0.2.0 릴리스

- [ ] **Step 1: 버전 올리기** — `eStoryMap/package.json` `"version": "0.2.0"` (src/shared/version.js가 버전을 어디서 읽는지 확인해 함께 갱신)
- [ ] **Step 2: 설치본 빌드** — `cd eStoryMap && npm run build` (⚠️ clean 선행 내장. rcedit이 CFA로 1회 실패할 수 있음 → 재시도)
- [ ] **Step 3: GitHub 릴리스(자동 릴리스 규칙)** — `gh release create v0.2.0 "release/e-GIS-Setup-0.2.0.exe" --title "v0.2.0 — 스토리맵 웹 게시" --notes "🌐 게시: 스토리맵을 e-gis.kr 링크로 공유"`
- [ ] **Step 4: 최종 커밋·푸시** — 남은 변경 커밋 후 `git push`
