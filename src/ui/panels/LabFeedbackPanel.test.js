// @vitest-environment jsdom
// © 2026 김용현
import { describe, it, expect, vi, afterEach } from 'vitest';
import { LabFeedbackPanel } from './LabFeedbackPanel.js';

const EXPS = [{ id: 'glass', name: '글래스 UI' }, { id: 'swipe', name: '스와이프 비교' }];
const flush = () => new Promise((r) => setTimeout(r, 0));

function make(fetchImpl) {
  const fetchFn = vi.fn(fetchImpl || (() => Promise.resolve({ ok: true, json: () => Promise.resolve({ ok: true }) })));
  const panel = new LabFeedbackPanel({
    endpoint: 'https://script.google.com/macros/s/X/exec',
    experiments: EXPS,
    labsOn: () => ['glass'],
    fetchFn,
  });
  return { panel, fetchFn };
}
const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const pick = (name) => {
  const box = $(`.lab-fb-exp input[value="${name}"]`);
  box.checked = !box.checked;
  box.dispatchEvent(new Event('change', { bubbles: true }));
};
const card = (name) => $$('.lab-fb-item').find((c) => c.dataset.name === name);
const submit = () => $('#lab-fb-form').dispatchEvent(new Event('submit', { cancelable: true }));

describe('LabFeedbackPanel', () => {
  afterEach(() => { document.body.innerHTML = ''; });

  it('기능 목록이 칩으로 나오고(+ 실험실 전체·기타), 처음엔 항목 카드가 없다', () => {
    const { panel } = make();
    panel.show();
    expect($$('.lab-fb-exp input[type=checkbox]')).toHaveLength(EXPS.length + 1);
    expect($$('.lab-fb-item')).toHaveLength(0);
    panel.close();
  });

  it('기능을 고르면 그 기능의 의견 카드가 생기고, 다시 누르면 사라진다 — 순서는 칩 순서', () => {
    const { panel } = make();
    panel.show();
    pick('스와이프 비교');
    pick('글래스 UI');
    expect($$('.lab-fb-item').map((c) => c.dataset.name)).toEqual(['글래스 UI', '스와이프 비교']);
    expect(card('글래스 UI').querySelector('textarea')).not.toBeNull();
    pick('글래스 UI');
    expect($$('.lab-fb-item').map((c) => c.dataset.name)).toEqual(['스와이프 비교']);
    panel.close();
  });

  it('카드를 껐다 켜도 적어 둔 글은 남는다', () => {
    const { panel } = make();
    panel.show();
    pick('글래스 UI');
    card('글래스 UI').querySelector('textarea').value = '적어 둔 글';
    pick('글래스 UI');
    pick('글래스 UI');
    expect(card('글래스 UI').querySelector('textarea').value).toBe('적어 둔 글');
    panel.close();
  });

  it('아무것도 고르지 않고 보내면 오류, 보내지 않는다', async () => {
    const { panel, fetchFn } = make();
    panel.show();
    submit();
    await flush();
    expect(fetchFn).not.toHaveBeenCalled();
    expect($('#lab-fb-items-error').textContent).toContain('골라');
    panel.close();
  });

  it('고른 카드의 의견이 비어 있으면 그 카드에 오류', async () => {
    const { panel, fetchFn } = make();
    panel.show();
    pick('글래스 UI');
    pick('스와이프 비교');
    card('글래스 UI').querySelector('textarea').value = '좋아요';
    submit();
    await flush();
    expect(fetchFn).not.toHaveBeenCalled();
    expect(card('스와이프 비교').querySelector('.lab-fb-error').textContent).toContain('의견');
    expect(card('글래스 UI').querySelector('.lab-fb-error').textContent).toBe('');
    panel.close();
  });

  it('보내면 항목별로 text/plain JSON POST, 성공하면 고맙다는 화면', async () => {
    const { panel, fetchFn } = make();
    panel.show();
    pick('글래스 UI');
    pick('스와이프 비교');
    card('글래스 UI').querySelector('textarea').value = '글자가 잘 보여요';
    card('스와이프 비교').querySelector('textarea').value = '막대가 잘 안 잡혀요';
    $('input[name="lab-fb-role"][value="teacher"]').checked = true;
    submit();
    await flush(); await flush();
    expect(fetchFn).toHaveBeenCalledTimes(1);
    const [url, opts] = fetchFn.mock.calls[0];
    expect(url).toBe('https://script.google.com/macros/s/X/exec');
    expect(opts.method).toBe('POST');
    expect(opts.headers['Content-Type']).toContain('text/plain');
    const body = JSON.parse(opts.body);
    expect(body.items).toEqual([
      { experiment: '글래스 UI', message: '글자가 잘 보여요' },
      { experiment: '스와이프 비교', message: '막대가 잘 안 잡혀요' },
    ]);
    expect(body.role).toBe('교사');
    expect(body.labsOn).toEqual(['glass']);
    expect($('.lab-fb-done')).not.toBeNull();
    panel.close();
  });

  it('이미지는 그 항목에만 붙는다', async () => {
    const { panel, fetchFn } = make();
    panel.show();
    pick('글래스 UI');
    pick('스와이프 비교');
    panel.setImage('스와이프 비교', { name: 'a.jpg', type: 'image/jpeg', data: 'QUJD', dataUrl: 'data:image/jpeg;base64,QUJD' });
    expect(card('스와이프 비교').querySelector('.lab-fb-preview').hidden).toBe(false);
    expect(card('글래스 UI').querySelector('.lab-fb-preview').hidden).toBe(true);
    card('글래스 UI').querySelector('textarea').value = '1';
    card('스와이프 비교').querySelector('textarea').value = '2';
    submit();
    await flush(); await flush();
    const body = JSON.parse(fetchFn.mock.calls[0][1].body);
    expect(body.items[0].image).toBeUndefined();
    expect(body.items[1].image).toEqual({ name: 'a.jpg', type: 'image/jpeg', data: 'QUJD' });
    panel.close();
  });

  it('서버가 실패를 알리면 메시지를 보이고 입력은 남긴다', async () => {
    const { panel } = make(() => Promise.resolve({ ok: true, json: () => Promise.resolve({ ok: false, error: '잠시 뒤에 다시 보내 주세요' }) }));
    panel.show();
    pick('글래스 UI');
    card('글래스 UI').querySelector('textarea').value = '좋아요';
    submit();
    await flush(); await flush();
    expect($('#lab-fb-status').textContent).toContain('잠시 뒤');
    expect(card('글래스 UI').querySelector('textarea').value).toBe('좋아요');
    panel.close();
  });

  it('숨은 칸이 채워져 있으면(봇) 보내지 않는다', async () => {
    const { panel, fetchFn } = make();
    panel.show();
    pick('글래스 UI');
    card('글래스 UI').querySelector('textarea').value = '스팸';
    $('#lab-fb-website').value = 'http://spam';
    submit();
    await flush();
    expect(fetchFn).not.toHaveBeenCalled();
    panel.close();
  });

  it('Esc·닫기로 닫힌다', () => {
    const { panel } = make();
    panel.show();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(panel.isOpen()).toBe(false);
    panel.show();
    $('#lab-fb-close').click();
    expect(panel.isOpen()).toBe(false);
  });
});
