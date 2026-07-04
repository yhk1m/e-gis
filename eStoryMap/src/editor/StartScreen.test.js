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

  it('제목 입력에서 Enter → onCreate', () => {
    const onCreate = vi.fn();
    const { el, screen } = make({ onCreate });
    screen.render([]);
    el.querySelector('#start-title').value = '기후';
    el.querySelector('#start-title').dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    expect(onCreate).toHaveBeenCalledWith('기후');
  });

  it('한글 조합 중 Enter(isComposing)는 무시한다', () => {
    const onCreate = vi.fn();
    const { el, screen } = make({ onCreate });
    screen.render([]);
    el.querySelector('#start-title').dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', isComposing: true }));
    expect(onCreate).not.toHaveBeenCalled();
  });
});

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

describe('StartScreen 클라우드 목록(M8)', () => {
  function makeCloud() {
    const onOpenCloud = vi.fn();
    const el = document.createElement('div');
    const screen = createStartScreen(el, {
      onCreate: vi.fn(), onOpen: vi.fn(), onOpenCloud,
      auth: { signIn: vi.fn(async () => ({})), signOut: vi.fn(async () => {}), openSignup: vi.fn() },
    });
    return { el, screen, onOpenCloud };
  }

  it('기본(renderCloud 미호출·null) → 클라우드 섹션 내용 없음', () => {
    const { el, screen } = makeCloud();
    screen.render([]);
    expect(el.querySelector('.cloud-item')).toBeNull();
    screen.renderCloud(null);
    expect(el.querySelector('.cloud-item')).toBeNull();
  });

  it('renderCloud(items) → 제목·항목 렌더, 클릭 → onOpenCloud(id)', () => {
    const { el, screen, onOpenCloud } = makeCloud();
    screen.render([]);
    screen.renderCloud([
      { id: 'c1', title: '부산 이야기', updated_at: '2026-07-04T00:00:00Z' },
      { id: 'c2', title: '기후', updated_at: '2026-07-03T00:00:00Z' },
    ]);
    const items = [...el.querySelectorAll('.cloud-item')];
    expect(items.map((n) => n.textContent)).toEqual(['☁ 부산 이야기', '☁ 기후']);
    items[1].dispatchEvent(new Event('click'));
    expect(onOpenCloud).toHaveBeenCalledWith('c2');
  });

  it('빈 배열 → 안내 문구', () => {
    const { el, screen } = makeCloud();
    screen.render([]);
    screen.renderCloud([]);
    expect(el.querySelector('.start-cloud .start-empty')).not.toBeNull();
  });

  it('render 전에 renderCloud가 와도 안전하고, 이후 render에 반영된다', () => {
    const { el, screen } = makeCloud();
    screen.renderCloud([{ id: 'c1', title: 't', updated_at: '' }]);
    screen.render([]);
    expect(el.querySelector('.cloud-item')).not.toBeNull();
  });
});

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
