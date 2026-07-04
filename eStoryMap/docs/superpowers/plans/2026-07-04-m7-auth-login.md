# M7 로그인 (AuthManager + StartScreen auth) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** e-GIS와 같은 Supabase 계정으로 이메일/비밀번호 로그인 — 시작 화면에서 로그인/로그아웃, 세션 자동 복원, 오프라인 무해.

**Architecture:** supabase-js를 npm 번들(CDN 금지)로 renderer에 넣고, 주입식 `createAuthManager({client})`가 인증 상태의 단일 소유자. StartScreen은 `updateAuth({user})`로 밀어넣는 단방향 렌더(기존 `render(projectNames)` 패턴). 가입은 앱에서 안 함 — preload `openExternal`로 e-GIS 웹 안내. 확정 스펙: `eStoryMap/docs/superpowers/specs/2026-07-04-m7-auth-design.md`.

**Tech Stack:** Electron 30 + Vite 5 + Vanilla JS + @supabase/supabase-js@2 + Vitest(jsdom)

**작업 디렉터리:** 모든 명령은 `C:/Users/김용현/Desktop/vibecoding/eGIS/eStoryMap`에서 실행. git 저장소 루트는 상위 `eGIS`지만 하위 디렉터리에서 커밋해도 된다.

**⚠️ 프로젝트 고유 함정 (반드시 숙지):**
- `vite.config.js`에 vite-plugin-electron의 `renderer` 플러그인·`optimizeDeps`를 **절대 추가하지 말 것** — M2에서 렌더러 전체가 죽은 사고의 원인(메모리·마스터 스펙에 기록됨). supabase-js는 브라우저 ESM이라 플러그인 없이 번들된다.
- `package.json`에 `"type": "module"` 추가 금지(main은 CJS 번들).
- Supabase URL/anon key는 e-GIS 웹 번들에 이미 공개된 값(anon key는 공개 전제 설계, 보안 경계는 RLS). 하드코딩이 맞다.

---

### Task 1: @supabase/supabase-js 설치 + supabaseClient.js

**Files:**
- Modify: `package.json` (npm install이 수정)
- Create: `src/core/supabaseClient.js`

- [ ] **Step 1: 의존성 설치**

Run: `npm install @supabase/supabase-js@2`
Expected: `dependencies`에 `"@supabase/supabase-js": "^2.x"` 추가됨

- [ ] **Step 2: supabaseClient.js 작성** (접착 코드 — 단위 테스트 없음, Task 6 빌드와 수동 스모크로 검증)

```js
// © 2026 김용현
// eStoryMap/src/core/supabaseClient.js
// Supabase 클라이언트 생성만 담당. e-GIS 본체와 같은 프로젝트/키(src/core/SupabaseManager.js).
// anon key는 공개 전제 설계(e-GIS 웹 번들에 이미 노출) — 보안 경계는 RLS.
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://lufbotdmhgsuvejlytgh.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx1ZmJvdGRtaGdzdXZlamx5dGdoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYzMDY1NzUsImV4cCI6MjA4MTg4MjU3NX0.JMzU8SiR8jb39xcRe4ySQSvZJButJP8OeCqOMDkNbRI';

/** 세션은 supabase-js 기본 localStorage에 유지된다(앱 재시작 시 자동 로그인). */
export function createSupabaseClient() {
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}
```

- [ ] **Step 3: 번들 확인** (renderer가 supabase-js를 물고도 빌드되는지 — 아직 import하는 곳이 없으므로 임시 확인)

Run: `npx vite build`
Expected: 에러 없이 `dist/` 생성. (`Some chunks are larger…` 경고는 정상)

- [ ] **Step 4: 기존 테스트 전체 통과 확인**

Run: `npm test`
Expected: `Tests 159 passed`

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json src/core/supabaseClient.js
git commit -m "feat(eStoryMap): M7 supabase-js npm 의존성 + 클라이언트 팩토리"
```

---

### Task 2: authErrorMessage (순수 에러 한국어화)

**Files:**
- Create: `src/core/AuthManager.js`
- Test: `src/core/AuthManager.test.js`

- [ ] **Step 1: 실패하는 테스트 작성** — `src/core/AuthManager.test.js` 생성:

```js
// © 2026 김용현
import { describe, it, expect, vi } from 'vitest';
import { authErrorMessage } from './AuthManager.js';

describe('authErrorMessage', () => {
  it('잘못된 자격증명 → 한국어 안내', () => {
    expect(authErrorMessage(new Error('Invalid login credentials')))
      .toBe('이메일 또는 비밀번호가 올바르지 않습니다.');
  });

  it('네트워크 실패(fetch) → 오프라인 안내', () => {
    expect(authErrorMessage(new TypeError('fetch failed')))
      .toContain('네트워크에 연결할 수 없습니다');
  });

  it('이메일 미인증 → 한국어 안내', () => {
    expect(authErrorMessage(new Error('Email not confirmed')))
      .toBe('이메일 인증이 완료되지 않은 계정입니다.');
  });

  it('알 수 없는 에러 → 원문 유지, 메시지 없으면 기본 문구', () => {
    expect(authErrorMessage(new Error('teapot'))).toBe('teapot');
    expect(authErrorMessage(null)).toBe('로그인에 실패했습니다.');
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run src/core/AuthManager.test.js`
Expected: FAIL — `Failed to load ./AuthManager.js` (파일 없음)

- [ ] **Step 3: 최소 구현** — `src/core/AuthManager.js` 생성:

```js
// © 2026 김용현
// eStoryMap/src/core/AuthManager.js
// Supabase 인증 얇은 래퍼(접착) — 클라이언트 주입식(테스트는 가짜 클라이언트).
// 이식 원본: e-GIS src/core/SupabaseManager.js의 인증 계약(init/signIn/signOut/onAuthStateChange).
// 프로필·projects 메서드는 이식하지 않음 — e-GIS 클라우드 저장 제거됨(스펙 §0).

/** Supabase 에러를 사용자용 한국어 메시지로 변환한다(순수). */
export function authErrorMessage(error) {
  const msg = (error && error.message) || '';
  if (/invalid\s+login\s+credentials/i.test(msg)) return '이메일 또는 비밀번호가 올바르지 않습니다.';
  if (/email\s+not\s+confirmed/i.test(msg)) return '이메일 인증이 완료되지 않은 계정입니다.';
  if (/fetch|network/i.test(msg)) return '네트워크에 연결할 수 없습니다. 오프라인에서는 로컬 기능만 사용할 수 있습니다.';
  return msg || '로그인에 실패했습니다.';
}
```

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run src/core/AuthManager.test.js`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add src/core/AuthManager.js src/core/AuthManager.test.js
git commit -m "feat(eStoryMap): M7 authErrorMessage — Supabase 에러 한국어화(순수)"
```

---

### Task 3: createAuthManager (세션 복원·로그인·로그아웃·구독)

**Files:**
- Modify: `src/core/AuthManager.js` (Task 2에서 생성한 파일에 추가)
- Test: `src/core/AuthManager.test.js` (describe 블록 추가)

- [ ] **Step 1: 실패하는 테스트 작성** — `AuthManager.test.js`에 추가:

```js
import { createAuthManager } from './AuthManager.js'; // 파일 상단 import에 병합

/** 가짜 supabase 클라이언트. fire()로 onAuthStateChange 이벤트를 흉내 낸다. */
function makeFakeClient({ session = null } = {}) {
  let authCb = null;
  return {
    fire(event, s) { if (authCb) authCb(event, s); },
    auth: {
      getSession: vi.fn(async () => ({ data: { session } })),
      onAuthStateChange: vi.fn((cb) => {
        authCb = cb;
        return { data: { subscription: { unsubscribe: vi.fn() } } };
      }),
      signInWithPassword: vi.fn(async () => ({
        data: { user: { id: 'u1', email: 'a@b.c' } }, error: null,
      })),
      signOut: vi.fn(async () => ({ error: null })),
    },
  };
}

describe('createAuthManager', () => {
  it('init: 저장된 세션 없음 → 미로그인, onChange 발화 없음', async () => {
    const client = makeFakeClient();
    const auth = createAuthManager({ client });
    const cb = vi.fn();
    auth.onChange(cb);
    await auth.init();
    expect(auth.isLoggedIn()).toBe(false);
    expect(auth.getUser()).toBeNull();
    expect(cb).not.toHaveBeenCalled(); // 시작 화면 기본 상태가 이미 로그아웃 폼
  });

  it('init: 저장된 세션 복원 → user 설정 + onChange 1회', async () => {
    const user = { id: 'u1', email: 'a@b.c' };
    const client = makeFakeClient({ session: { user } });
    const auth = createAuthManager({ client });
    const cb = vi.fn();
    auth.onChange(cb);
    await auth.init();
    expect(auth.getUser()).toEqual(user);
    expect(cb).toHaveBeenCalledTimes(1);
    expect(cb).toHaveBeenCalledWith({ user });
  });

  it('init: getSession이 throw해도 무해(로컬 모드) — throw 안 함', async () => {
    const client = makeFakeClient();
    client.auth.getSession = vi.fn(async () => { throw new TypeError('fetch failed'); });
    const auth = createAuthManager({ client });
    await expect(auth.init()).resolves.toBeUndefined();
    expect(auth.isLoggedIn()).toBe(false);
  });

  it('signIn 성공 → user 반환·설정 + onChange 발화', async () => {
    const client = makeFakeClient();
    const auth = createAuthManager({ client });
    await auth.init();
    const cb = vi.fn();
    auth.onChange(cb);
    const user = await auth.signIn('a@b.c', 'pw');
    expect(client.auth.signInWithPassword).toHaveBeenCalledWith({ email: 'a@b.c', password: 'pw' });
    expect(user.email).toBe('a@b.c');
    expect(auth.isLoggedIn()).toBe(true);
    expect(cb).toHaveBeenCalledWith({ user });
  });

  it('signIn 실패(error 응답) → 한국어 메시지 throw, 미로그인 유지', async () => {
    const client = makeFakeClient();
    client.auth.signInWithPassword = vi.fn(async () => ({
      data: { user: null }, error: new Error('Invalid login credentials'),
    }));
    const auth = createAuthManager({ client });
    await expect(auth.signIn('a@b.c', 'nope'))
      .rejects.toThrow('이메일 또는 비밀번호가 올바르지 않습니다.');
    expect(auth.isLoggedIn()).toBe(false);
  });

  it('signIn 실패(promise reject — 오프라인) → 오프라인 안내 throw', async () => {
    const client = makeFakeClient();
    client.auth.signInWithPassword = vi.fn(async () => { throw new TypeError('fetch failed'); });
    const auth = createAuthManager({ client });
    await expect(auth.signIn('a@b.c', 'pw')).rejects.toThrow('네트워크에 연결할 수 없습니다');
  });

  it('signOut → user null + onChange 발화. 서버 실패(오프라인)여도 로컬은 해제', async () => {
    const user = { id: 'u1', email: 'a@b.c' };
    const client = makeFakeClient({ session: { user } });
    client.auth.signOut = vi.fn(async () => { throw new TypeError('fetch failed'); });
    const auth = createAuthManager({ client });
    await auth.init();
    const cb = vi.fn();
    auth.onChange(cb);
    await auth.signOut(); // throw하지 않아야 함
    expect(auth.isLoggedIn()).toBe(false);
    expect(cb).toHaveBeenCalledWith({ user: null });
  });

  it('onAuthStateChange 이벤트로도 상태 갱신(SIGNED_OUT)', async () => {
    const user = { id: 'u1', email: 'a@b.c' };
    const client = makeFakeClient({ session: { user } });
    const auth = createAuthManager({ client });
    await auth.init();
    const cb = vi.fn();
    auth.onChange(cb);
    client.fire('SIGNED_OUT', null);
    expect(auth.isLoggedIn()).toBe(false);
    expect(cb).toHaveBeenCalledWith({ user: null });
  });

  it('같은 사용자 재통지(TOKEN_REFRESHED 등)는 발화하지 않는다(폼 입력 보호)', async () => {
    const user = { id: 'u1', email: 'a@b.c' };
    const client = makeFakeClient({ session: { user } });
    const auth = createAuthManager({ client });
    await auth.init();
    const cb = vi.fn();
    auth.onChange(cb);
    client.fire('TOKEN_REFRESHED', { user: { id: 'u1', email: 'a@b.c' } });
    expect(cb).not.toHaveBeenCalled();
  });

  it('onChange 해제 함수 → 이후 발화 없음', async () => {
    const client = makeFakeClient();
    const auth = createAuthManager({ client });
    await auth.init();
    const cb = vi.fn();
    const off = auth.onChange(cb);
    off();
    client.fire('SIGNED_IN', { user: { id: 'u2', email: 'x@y.z' } });
    expect(cb).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run src/core/AuthManager.test.js`
Expected: FAIL — `createAuthManager is not a function` (authErrorMessage 4개는 PASS 유지)

- [ ] **Step 3: 구현** — `AuthManager.js`의 `authErrorMessage` 아래에 추가:

```js
/**
 * 인증 상태의 단일 소유자. client는 supabase-js 클라이언트(또는 테스트용 가짜).
 * @param {{ client: object }} deps
 */
export function createAuthManager({ client }) {
  let user = null;
  const listeners = new Set();

  // 같은 사용자 재통지(INITIAL_SESSION·TOKEN_REFRESHED 등)로 시작 화면 로그인 폼이
  // 다시 그려져 입력 중인 값이 날아가지 않게, 신원이 바뀔 때만 발화한다.
  function setUser(next) {
    const changed = ((next && next.id) || null) !== ((user && user.id) || null);
    user = next || null;
    if (changed) for (const cb of [...listeners]) cb({ user });
  }

  return {
    /** 세션 복원 + 상태 변화 구독. 실패해도 throw하지 않음(오프라인 → 로컬 모드). */
    async init() {
      try {
        const { data } = await client.auth.getSession();
        client.auth.onAuthStateChange((_event, session) => {
          setUser(session ? session.user : null);
        });
        setUser(data && data.session ? data.session.user : null);
      } catch (e) {
        console.warn('[auth] 세션 복원 실패(로컬 모드로 계속):', e && e.message);
      }
    },

    /** 성공 시 user 반환, 실패 시 한국어 메시지의 Error를 throw. */
    async signIn(email, password) {
      let res;
      try {
        res = await client.auth.signInWithPassword({ email, password });
      } catch (e) {
        throw new Error(authErrorMessage(e)); // 오프라인 등 — reject 경로도 한국어화
      }
      if (res.error) throw new Error(authErrorMessage(res.error));
      setUser(res.data.user);
      return res.data.user;
    },

    /** 로컬 상태는 항상 비운다 — 서버 세션 무효화 실패(오프라인)는 치명적이지 않음. */
    async signOut() {
      try {
        await client.auth.signOut();
      } catch (e) {
        console.warn('[auth] 서버 로그아웃 실패(로컬 세션은 해제됨):', e && e.message);
      }
      setUser(null);
    },

    getUser() { return user; },
    isLoggedIn() { return !!user; },

    /** cb({user}) 구독. 해제 함수를 반환한다. */
    onChange(cb) {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
  };
}
```

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run src/core/AuthManager.test.js`
Expected: PASS (14 tests)

- [ ] **Step 5: Commit**

```bash
git add src/core/AuthManager.js src/core/AuthManager.test.js
git commit -m "feat(eStoryMap): M7 createAuthManager — 주입식 인증 래퍼(세션복원·dedupe 발화)"
```

---

### Task 4: StartScreen 로그인 영역 (3상태)

**Files:**
- Modify: `src/editor/StartScreen.js` (전체 교체 — 아래 완성본)
- Modify: `src/style.css` (말미에 추가)
- Test: `src/editor/StartScreen.test.js` (describe 블록 추가)

- [ ] **Step 1: 실패하는 테스트 작성** — `StartScreen.test.js` 말미에 추가:

```js
function makeWithAuth(authOverrides = {}) {
  const auth = {
    signIn: vi.fn(async () => ({})),
    signOut: vi.fn(async () => {}),
    openSignup: vi.fn(),
    ...authOverrides,
  };
  const el = document.createElement('div');
  const screen = createStartScreen(el, { onCreate: vi.fn(), onOpen: vi.fn(), auth });
  return { el, screen, auth };
}

/** submit의 async 처리(await auth.signIn 이후 DOM 반영)를 기다린다. */
const flush = () => new Promise((r) => setTimeout(r, 0));

describe('StartScreen 로그인 영역(M7)', () => {
  it('auth 미주입이면 로그인 영역이 없다(기존 계약 유지)', () => {
    const { el, screen } = make();
    screen.render([]);
    expect(el.querySelector('.start-auth')).toBeNull();
  });

  it('로그아웃 상태: 이메일·비밀번호·로그인 버튼·가입 링크 렌더', () => {
    const { el, screen } = makeWithAuth();
    screen.render([]);
    expect(el.querySelector('#auth-email')).not.toBeNull();
    expect(el.querySelector('#auth-password')).not.toBeNull();
    expect(el.querySelector('#btn-auth-login')).not.toBeNull();
    expect(el.querySelector('#auth-signup-link')).not.toBeNull();
  });

  it('로그인 버튼 → auth.signIn(트림된 이메일, 비밀번호 원문)', () => {
    const { el, screen, auth } = makeWithAuth();
    screen.render([]);
    el.querySelector('#auth-email').value = ' a@b.c ';
    el.querySelector('#auth-password').value = 'pw 1';
    el.querySelector('#btn-auth-login').dispatchEvent(new Event('click'));
    expect(auth.signIn).toHaveBeenCalledWith('a@b.c', 'pw 1');
  });

  it('빈 입력 제출 → 안내 메시지, signIn 미호출', () => {
    const { el, screen, auth } = makeWithAuth();
    screen.render([]);
    el.querySelector('#btn-auth-login').dispatchEvent(new Event('click'));
    expect(auth.signIn).not.toHaveBeenCalled();
    expect(el.querySelector('.auth-error').textContent).toContain('입력하세요');
  });

  it('signIn 실패 → .auth-error에 메시지 표시', async () => {
    const { el, screen } = makeWithAuth({
      signIn: vi.fn(async () => { throw new Error('이메일 또는 비밀번호가 올바르지 않습니다.'); }),
    });
    screen.render([]);
    el.querySelector('#auth-email').value = 'a@b.c';
    el.querySelector('#auth-password').value = 'nope';
    el.querySelector('#btn-auth-login').dispatchEvent(new Event('click'));
    await flush();
    expect(el.querySelector('.auth-error').textContent).toContain('올바르지 않습니다');
  });

  it('updateAuth(user) → 이메일 표시 + 로그아웃 버튼(폼 없음)', () => {
    const { el, screen } = makeWithAuth();
    screen.render([]);
    screen.updateAuth({ user: { id: 'u1', email: 'a@b.c' } });
    expect(el.querySelector('.auth-user').textContent).toContain('a@b.c');
    expect(el.querySelector('#btn-auth-logout')).not.toBeNull();
    expect(el.querySelector('#auth-email')).toBeNull();
  });

  it('render 전에 updateAuth가 와도 안전하고, 이후 render에 반영된다', () => {
    const { el, screen } = makeWithAuth();
    screen.updateAuth({ user: { id: 'u1', email: 'a@b.c' } }); // authBox 없음 — no-op이어야
    screen.render([]);
    expect(el.querySelector('.auth-user').textContent).toContain('a@b.c');
  });

  it('로그아웃 버튼 → auth.signOut', () => {
    const { el, screen, auth } = makeWithAuth();
    screen.render([]);
    screen.updateAuth({ user: { id: 'u1', email: 'a@b.c' } });
    el.querySelector('#btn-auth-logout').dispatchEvent(new Event('click'));
    expect(auth.signOut).toHaveBeenCalled();
  });

  it('가입 링크 → auth.openSignup', () => {
    const { el, screen, auth } = makeWithAuth();
    screen.render([]);
    el.querySelector('#auth-signup-link').dispatchEvent(new Event('click'));
    expect(auth.openSignup).toHaveBeenCalled();
  });

  it('비밀번호 입력에서 Enter → 제출, 한글 조합 중(isComposing)은 무시', () => {
    const { el, screen, auth } = makeWithAuth();
    screen.render([]);
    el.querySelector('#auth-email').value = 'a@b.c';
    el.querySelector('#auth-password').value = 'pw';
    el.querySelector('#auth-password').dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', isComposing: true }));
    expect(auth.signIn).not.toHaveBeenCalled();
    el.querySelector('#auth-password').dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter' }));
    expect(auth.signIn).toHaveBeenCalledWith('a@b.c', 'pw');
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run src/editor/StartScreen.test.js`
Expected: FAIL — 새 테스트 10개 실패(`.start-auth` 없음, `updateAuth is not a function`). 기존 8개는 PASS 유지.

- [ ] **Step 3: 구현** — `src/editor/StartScreen.js` 전체를 아래로 교체:

```js
// © 2026 김용현
// eStoryMap/src/editor/StartScreen.js
// 시작 화면: 새 스토리맵 만들기 / 저장된 .esm 목록에서 열기(상위 스펙 §3b)
// + 하단 로그인 영역(M7): 로그아웃 폼 / 로그인 표시 / 에러 라인. 로그인 없이 로컬 기능 전부 동작.
// 오버레이 표시/숨김은 main.js가 담당하고, 이 컴포넌트는 내용만 렌더한다.
// 인증 상태는 updateAuth({user})로 외부(main.js)에서 밀어넣는다 — render(projectNames)와 같은 단방향.

/**
 * @param {HTMLElement} container
 * @param {{onCreate(title:string):void, onOpen(name:string):void,
 *          auth?: {signIn(email:string,pw:string):Promise<object>, signOut():Promise<void>, openSignup():void}}} handlers
 *        auth 미주입 시 로그인 영역을 렌더하지 않는다(테스트·이전 계약 유지).
 */
export function createStartScreen(container, { onCreate, onOpen, auth }) {
  let errorEl = null;
  let authBox = null;
  let authUser = null;  // updateAuth로 갱신되는 유일한 인증 상태
  let authBusy = false; // 로그인 요청 중 중복 제출 방지

  function render(projectNames) {
    container.innerHTML = '';
    authBox = null;
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
    title.addEventListener('keydown', (e) => {
      if (e.isComposing || e.keyCode === 229) return; // 한글 IME 조합 중 Enter 무시
      if (e.key === 'Enter') create.click();
    });
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

    if (auth) {
      authBox = document.createElement('div');
      authBox.className = 'start-auth';
      box.appendChild(authBox);
      renderAuth();
    }

    container.appendChild(box);
  }

  function renderAuth() {
    if (!authBox) return;
    authBox.innerHTML = '';
    if (authUser) {
      const row = document.createElement('div');
      row.className = 'auth-row';
      const who = document.createElement('span');
      who.className = 'auth-user';
      who.textContent = `${authUser.email} 님`;
      const logout = document.createElement('button');
      logout.type = 'button';
      logout.id = 'btn-auth-logout';
      logout.textContent = '로그아웃';
      logout.addEventListener('click', async () => {
        try {
          await auth.signOut();
        } catch (e) {
          showAuthError(e.message); // signOut은 원래 throw하지 않는 계약이지만 방어
        }
      });
      row.appendChild(who);
      row.appendChild(logout);
      authBox.appendChild(row);
    } else {
      const row = document.createElement('div');
      row.className = 'auth-row';
      const email = document.createElement('input');
      email.type = 'email';
      email.id = 'auth-email';
      email.placeholder = '이메일 (e-GIS 계정)';
      const pw = document.createElement('input');
      pw.type = 'password';
      pw.id = 'auth-password';
      pw.placeholder = '비밀번호';
      const login = document.createElement('button');
      login.type = 'button';
      login.id = 'btn-auth-login';
      login.textContent = '로그인';
      login.addEventListener('click', submit);
      for (const input of [email, pw]) {
        input.addEventListener('keydown', (e) => {
          if (e.isComposing || e.keyCode === 229) return; // 한글 IME 조합 중 Enter 무시
          if (e.key === 'Enter') submit();
        });
      }
      row.appendChild(email);
      row.appendChild(pw);
      row.appendChild(login);
      authBox.appendChild(row);

      const signup = document.createElement('button');
      signup.type = 'button';
      signup.id = 'auth-signup-link';
      signup.className = 'auth-signup';
      signup.textContent = '계정이 없나요? e-GIS에서 가입';
      signup.addEventListener('click', () => auth.openSignup());
      authBox.appendChild(signup);
    }
    const err = document.createElement('div');
    err.className = 'auth-error';
    authBox.appendChild(err);
  }

  async function submit() {
    if (authBusy || !authBox) return;
    const email = authBox.querySelector('#auth-email').value.trim();
    const pw = authBox.querySelector('#auth-password').value; // 비밀번호는 트림하지 않는다
    if (!email || !pw) {
      showAuthError('이메일과 비밀번호를 입력하세요.');
      return;
    }
    authBusy = true;
    const btn = authBox.querySelector('#btn-auth-login');
    if (btn) btn.disabled = true;
    try {
      showAuthError('');
      await auth.signIn(email, pw);
      // 성공 시 UI 전환은 main.js의 authManager.onChange → updateAuth가 담당(단방향)
    } catch (e) {
      showAuthError(e.message);
    } finally {
      authBusy = false;
      const b = authBox.querySelector('#btn-auth-login'); // 성공 시 renderAuth로 교체됐을 수 있음
      if (b) b.disabled = false;
    }
  }

  function showAuthError(message) {
    const el = authBox && authBox.querySelector('.auth-error');
    if (el) el.textContent = message;
  }

  /** 인증 상태 반영. render 전에 불려도 안전(상태만 저장, 다음 render에 반영). */
  function updateAuth({ user }) {
    authUser = user || null;
    renderAuth();
  }

  function showError(message) {
    if (errorEl) errorEl.textContent = message;
  }

  return { render, showError, updateAuth };
}
```

- [ ] **Step 4: 스타일 추가** — `src/style.css` 말미에 추가:

```css
/* M7 시작 화면 로그인 영역 */
.start-auth { margin-top: 20px; padding-top: 14px; border-top: 1px solid #1e293b; }
.auth-row { display: flex; gap: 6px; align-items: center; }
.auth-row input {
  flex: 1; min-width: 0; padding: 7px 9px; border: 1px solid #334155; border-radius: 6px;
  background: #1e293b; color: #e5e7eb; font-size: 13px;
}
.auth-row button {
  padding: 7px 12px; border: 1px solid #334155; background: #1e293b;
  color: #e5e7eb; border-radius: 6px; cursor: pointer; font-size: 13px; white-space: nowrap;
}
.auth-row button:hover { border-color: #3b82f6; }
.auth-row button:disabled { opacity: 0.5; cursor: default; }
.auth-user { flex: 1; font-size: 13px; color: #94a3b8; overflow: hidden; text-overflow: ellipsis; }
.auth-signup {
  margin-top: 6px; padding: 0; border: none; background: none; cursor: pointer;
  font-size: 12px; color: #60a5fa; text-decoration: underline;
}
.auth-error { min-height: 16px; font-size: 12px; color: #f87171; margin-top: 6px; }
```

- [ ] **Step 5: 통과 확인**

Run: `npx vitest run src/editor/StartScreen.test.js`
Expected: PASS (18 tests — 기존 8 + 신규 10)

- [ ] **Step 6: Commit**

```bash
git add src/editor/StartScreen.js src/editor/StartScreen.test.js src/style.css
git commit -m "feat(eStoryMap): M7 StartScreen 로그인 영역 — 3상태(폼/로그인/에러)·IME 가드"
```

---

### Task 5: preload openExternal + main IPC (https 화이트리스트)

**Files:**
- Modify: `electron/preload.js`
- Modify: `electron/main.js`

Electron 접착 코드 — 단위 테스트 없음(Task 7 수동 스모크에서 가입 링크 클릭으로 검증).

- [ ] **Step 1: preload에 API 추가** — `electron/preload.js`의 `openFolder` 줄 아래에 추가:

```js
  openExternal: (url) => ipcRenderer.invoke('app:openExternal', url), // 외부 브라우저(https만, M7 가입 안내)
```

- [ ] **Step 2: main에 핸들러 추가** — `electron/main.js` 말미(`project:backup` 핸들러 아래)에 추가:

```js
// 외부 링크(M7 가입 안내 등)는 기본 브라우저로 — http(s)만 화이트리스트
ipcMain.handle('app:openExternal', (_e, url) => {
  if (typeof url === 'string' && /^https?:\/\//i.test(url)) return shell.openExternal(url);
  return null;
});
```

(`shell`은 이미 import되어 있음 — `electron/main.js:3` 확인.)

- [ ] **Step 3: 전체 테스트 회귀 확인**

Run: `npm test`
Expected: PASS (모든 파일 — electron/은 vitest 대상 아님, 회귀만 확인)

- [ ] **Step 4: Commit**

```bash
git add electron/preload.js electron/main.js
git commit -m "feat(eStoryMap): M7 openExternal IPC — 가입 안내용 외부 브라우저(https 화이트리스트)"
```

---

### Task 6: main.js 배선

**Files:**
- Modify: `src/main.js`

- [ ] **Step 1: import 추가** — `src/main.js` 상단 import 블록(`createStartScreen` import 아래)에 추가:

```js
import { createAuthManager } from './core/AuthManager.js';
import { createSupabaseClient } from './core/supabaseClient.js';
```

- [ ] **Step 2: authManager 생성** — `const startScreen = createStartScreen(...)` 선언 **위에** 추가:

```js
const authManager = createAuthManager({ client: createSupabaseClient() });
```

- [ ] **Step 3: startScreen에 auth 핸들러 주입** — `createStartScreen` 호출의 두 번째 인자에 `auth` 추가. `onOpen(name) {...}` 메서드 뒤에:

```js
  auth: {
    signIn: (email, pw) => authManager.signIn(email, pw),
    signOut: () => authManager.signOut(),
    openSignup: () => window.egisFS.openExternal('https://e-gis.kr'),
  },
```

- [ ] **Step 4: 상태 구독 + init** — `startScreen` 선언 직후(`function enterEditor()` 위)에 추가:

```js
authManager.onChange(({ user }) => startScreen.updateAuth({ user }));
// 비차단 init — 세션 복원 실패(오프라인)는 내부에서 흡수, 로컬 기능은 항상 동작(스펙 §4)
authManager.init();
```

`boot()`는 수정하지 않는다(.esm 목록 로드와 인증은 서로 독립·병렬).

- [ ] **Step 5: 전체 테스트 + 번들 확인**

Run: `npm test`
Expected: PASS (**173 tests**: 기존 159 + AuthManager 14... 정확한 수는 실행 결과 기준. 실패 0이면 통과)

Run: `npx vite build`
Expected: 에러 없이 완료 (supabase-js가 renderer 번들에 포함됨)

- [ ] **Step 6: Commit**

```bash
git add src/main.js
git commit -m "feat(eStoryMap): M7 배선 — authManager 생성·구독·비차단 init + 가입 링크"
```

---

### Task 7: 수동 스모크 (사용자 확인 필요) + 푸시

- [ ] **Step 1: dev 앱 실행**

Run: `npm run dev`
**최우선 확인**: 시작 화면이 정상 렌더되고 버튼이 반응하는지 — supabase-js가 dev 사전번들에서 Node 모듈을 물면 M2 geotiff 사고처럼 렌더러 전체가 조용히 죽는다(버튼 무반응). 죽었다면 DevTools 콘솔의 모듈 로드 에러를 확인하고, **vite renderer 플러그인 추가로 해결하려 하지 말 것**(금지 — 대신 해당 의존성 alias/브라우저 빌드 경로를 조사).

- [ ] **Step 2: 스모크 체크리스트** (사용자 확인)

1. 시작 화면 하단에 로그인 영역(이메일/비밀번호/로그인/가입 링크) 표시
2. 잘못된 비밀번호 → "이메일 또는 비밀번호가 올바르지 않습니다." 표시
3. e-GIS 계정으로 로그인 → "○○@○○ 님" + 로그아웃 버튼으로 전환
4. 앱 재시작 → 자동 로그인 유지(세션 복원)
5. 로그아웃 → 폼으로 복귀
6. "e-GIS에서 가입" 클릭 → 기본 브라우저로 e-gis.kr 열림
7. 네트워크 끊고(와이파이 오프) 재시작 → 앱·로컬 기능 정상, 로그인 시도 시 오프라인 안내
8. 회귀: 새로 만들기/열기/자동저장(2초) 정상

- [ ] **Step 3: 스모크 통과 후 푸시**

```bash
git push
```

---

## Self-Review 기록

- 스펙 커버리지: §1 목표 4항(로그인/시작화면 분기/오프라인 퍼스트/세션 유지) ← Task 3·4·6·7. §3 파일 구조 4개 전부 태스크에 매핑. §4 데이터 흐름 4경로 ← 테스트+스모크 7번. §5 테스트 전략 ← Task 2·3·4. 비목표(가입·OAuth·비번 재설정·클라우드) 침범 없음.
- 타입 일관성: `auth = {signIn, signOut, openSignup}` (Task 4 구현 = Task 6 주입), `updateAuth({user})` (Task 4 = Task 6), `onChange(cb)→해제함수` (Task 3 = Task 6), IPC `app:openExternal` (Task 5 preload = main).
- 플레이스홀더: 없음 — 모든 코드 스텝에 완성 코드 포함.
