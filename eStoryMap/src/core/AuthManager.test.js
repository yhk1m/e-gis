// © 2026 김용현
import { describe, it, expect, vi } from 'vitest';
import { authErrorMessage, createAuthManager } from './AuthManager.js';

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

  it('signOut은 scope local로 호출한다(다른 기기·e-GIS 웹 세션 보호)', async () => {
    const client = makeFakeClient();
    const auth = createAuthManager({ client });
    await auth.init();
    await auth.signOut();
    expect(client.auth.signOut).toHaveBeenCalledWith({ scope: 'local' });
  });

  it('signOut이 {error}로 resolve(오프라인)해도 경고만 남기고 로컬은 해제', async () => {
    const user = { id: 'u1', email: 'a@b.c' };
    const client = makeFakeClient({ session: { user } });
    client.auth.signOut = vi.fn(async () => ({ error: new Error('AuthRetryableFetchError') }));
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const auth = createAuthManager({ client });
    await auth.init();
    await auth.signOut();
    expect(auth.isLoggedIn()).toBe(false);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('리스너가 throw해도 다른 리스너는 호출되고 발화 흐름이 끊기지 않는다', async () => {
    const client = makeFakeClient();
    const auth = createAuthManager({ client });
    await auth.init();
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    const bad = vi.fn(() => { throw new Error('DOM 렌더 실패'); });
    const good = vi.fn();
    auth.onChange(bad);
    auth.onChange(good);
    await auth.signIn('a@b.c', 'pw'); // reject되면 안 됨
    expect(good).toHaveBeenCalledWith({ user: expect.objectContaining({ id: 'u1' }) });
    expect(err).toHaveBeenCalled();
    err.mockRestore();
  });
});
