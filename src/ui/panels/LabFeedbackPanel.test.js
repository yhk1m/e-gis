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

describe('LabFeedbackPanel', () => {
  afterEach(() => { document.body.innerHTML = ''; });

  it('실험 목록이 체크 칸으로 나오고, 켜 둔 실험은 미리 체크된다', () => {
    const { panel } = make();
    panel.show();
    const boxes = document.querySelectorAll('.lab-fb-exp input[type=checkbox]');
    expect(boxes).toHaveLength(EXPS.length + 1); // + 실험실 전체·기타
    expect($('input[value="글래스 UI"]').checked).toBe(true);
    expect($('input[value="스와이프 비교"]').checked).toBe(false);
    panel.close();
  });

  it('의견을 비우고 보내면 오류를 보이고 보내지 않는다', async () => {
    const { panel, fetchFn } = make();
    panel.show();
    $('#lab-fb-form').dispatchEvent(new Event('submit', { cancelable: true }));
    await flush();
    expect(fetchFn).not.toHaveBeenCalled();
    expect($('#lab-fb-message-error').textContent).toContain('의견');
    panel.close();
  });

  it('보내면 text/plain JSON 으로 POST 하고, 성공하면 고맙다는 화면', async () => {
    const { panel, fetchFn } = make();
    panel.show();
    $('#lab-fb-message').value = '좋아요';
    $('input[value="스와이프 비교"]').checked = true;
    $('input[name="lab-fb-role"][value="teacher"]').checked = true;
    $('#lab-fb-form').dispatchEvent(new Event('submit', { cancelable: true }));
    await flush(); await flush();
    expect(fetchFn).toHaveBeenCalledTimes(1);
    const [url, opts] = fetchFn.mock.calls[0];
    expect(url).toBe('https://script.google.com/macros/s/X/exec');
    expect(opts.method).toBe('POST');
    expect(opts.headers['Content-Type']).toContain('text/plain');
    const body = JSON.parse(opts.body);
    expect(body.message).toBe('좋아요');
    expect(body.experiments).toEqual(['글래스 UI', '스와이프 비교']);
    expect(body.role).toBe('교사');
    expect(body.labsOn).toEqual(['glass']);
    expect($('.lab-fb-done')).not.toBeNull();
    panel.close();
  });

  it('서버가 실패를 알리면 메시지를 보이고 입력은 남긴다', async () => {
    const { panel } = make(() => Promise.resolve({ ok: true, json: () => Promise.resolve({ ok: false, error: '잠시 뒤에 다시 보내 주세요' }) }));
    panel.show();
    $('#lab-fb-message').value = '좋아요';
    $('#lab-fb-form').dispatchEvent(new Event('submit', { cancelable: true }));
    await flush(); await flush();
    expect($('#lab-fb-status').textContent).toContain('잠시 뒤');
    expect($('#lab-fb-message').value).toBe('좋아요');
    panel.close();
  });

  it('숨은 칸이 채워져 있으면(봇) 보내지 않는다', async () => {
    const { panel, fetchFn } = make();
    panel.show();
    $('#lab-fb-message').value = '스팸';
    $('#lab-fb-website').value = 'http://spam';
    $('#lab-fb-form').dispatchEvent(new Event('submit', { cancelable: true }));
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
