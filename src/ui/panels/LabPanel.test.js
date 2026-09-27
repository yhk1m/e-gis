// @vitest-environment jsdom
// © 2026 김용현
/**
 * 실험실 창: 카드마다 스위치, 스위치는 labs 상태를 그대로 비추고 누르면 뒤집는다.
 * 의견 링크는 주소가 있을 때만, 공유 주소는 켜진 실험을 반영한다.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
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

  it('의견 링크는 주소가 있을 때만, 카드마다가 아니라 창에 하나만 보인다', () => {
    const labs = makeLabs();
    let panel = new LabPanel({ labs, experiments: EXPS, feedbackUrl: '' });
    panel.show();
    expect(document.querySelector('.labs-feedback')).toBeNull();
    panel.close();

    panel = new LabPanel({ labs, experiments: EXPS, feedbackUrl: 'https://forms.gle/abc' });
    panel.show();
    expect(document.querySelectorAll('.labs-feedback')).toHaveLength(1);
    expect(document.querySelector('.labs-card .labs-feedback')).toBeNull();
    const link = document.querySelector('.labs-feedback');
    expect(link.getAttribute('href')).toBe('https://forms.gle/abc');
    expect(link.getAttribute('target')).toBe('_blank');
    expect(link.getAttribute('rel')).toContain('noopener');
    panel.close();
  });

  it('저장 웹앱 주소가 있으면 구글 폼 링크 대신 의견 창을 여는 버튼', () => {
    const labs = makeLabs();
    const feedback = { show: vi.fn(), isOpen: () => false };
    const panel = new LabPanel({ labs, experiments: EXPS, feedbackUrl: 'https://forms.gle/abc', feedbackEndpoint: 'https://script.google.com/x/exec', feedback });
    panel.show();
    expect(document.querySelector('a.labs-feedback')).toBeNull();
    document.querySelector('#labs-feedback-open').click();
    expect(feedback.show).toHaveBeenCalled();
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
