// © 2026 김용현
// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { showAlert, showConfirm, showPrompt } from './dialogs.js';

const top = () => [...document.querySelectorAll('.egis-dialog-overlay')].pop();
const key = (k) => document.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true }));

beforeEach(() => { document.body.innerHTML = ''; });

describe('dialogs', () => {
  it('showConfirm: 확인 → true, 창이 사라진다', async () => {
    const p = showConfirm('지울까요?');
    expect(top().querySelector('.egis-dialog-message').textContent).toBe('지울까요?');
    top().querySelector('.egis-dialog-ok').click();
    await expect(p).resolves.toBe(true);
    expect(document.querySelector('.egis-dialog-overlay')).toBeNull();
  });

  it('showConfirm: 취소·Esc·바깥 클릭 → false', async () => {
    let p = showConfirm('a');
    top().querySelector('.egis-dialog-cancel').click();
    await expect(p).resolves.toBe(false);
    p = showConfirm('b');
    key('Escape');
    await expect(p).resolves.toBe(false);
    p = showConfirm('c');
    top().click();
    await expect(p).resolves.toBe(false);
  });

  it('showConfirm: Enter → true, danger 면 빨간 버튼', async () => {
    const p = showConfirm('a', { danger: true, okText: '삭제' });
    const ok = top().querySelector('.egis-dialog-ok');
    expect(ok.classList.contains('btn-danger')).toBe(true);
    expect(ok.textContent).toBe('삭제');
    key('Enter');
    await expect(p).resolves.toBe(true);
  });

  it('showAlert: 확인으로 닫히고, 글은 HTML 로 해석하지 않는다', async () => {
    const p = showAlert('<b>x</b>\n둘째 줄');
    expect(top().querySelector('b')).toBeNull();
    expect(top().querySelector('.egis-dialog-cancel')).toBeNull();
    top().querySelector('.egis-dialog-ok').click();
    await expect(p).resolves.toBeUndefined();
  });

  it('showPrompt: 입력값을 돌려주고 취소면 null', async () => {
    let p = showPrompt('이름', '기본');
    const input = top().querySelector('.egis-dialog-input');
    expect(input.value).toBe('기본');
    input.value = '새 이름';
    top().querySelector('.egis-dialog-ok').click();
    await expect(p).resolves.toBe('새 이름');
    p = showPrompt('이름');
    key('Escape');
    await expect(p).resolves.toBeNull();
  });

  it('겹친 창은 맨 위 것만 키를 받고, Esc 가 뒤 단축키로 새지 않는다', async () => {
    const behind = vi.fn();
    document.addEventListener('keydown', behind);
    const first = showConfirm('1');
    const second = showConfirm('2');
    key('Escape');
    await expect(second).resolves.toBe(false);
    expect(document.querySelectorAll('.egis-dialog-overlay').length).toBe(1);
    expect(behind).not.toHaveBeenCalled();
    key('Enter');
    await expect(first).resolves.toBe(true);
    document.removeEventListener('keydown', behind);
  });
});
