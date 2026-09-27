// @vitest-environment jsdom
// © 2026 김용현
import { describe, it, expect, beforeEach } from 'vitest';
import { LabGuidePanel } from './LabGuidePanel.js';
import { LabPanel } from './LabPanel.js';
import { Labs } from '../../labs/labs.js';
import { EXPERIMENTS } from '../../labs/registry.js';

const EXPS = [
  { id: 'glass', name: '글래스 UI', summary: '유리처럼', since: '2026-09',
    details: { intro: ['소개 <b>문단</b>'], steps: ['켠다', '본다'], notes: ['한계'] } },
  { id: 'globe', name: '지구본', summary: '둥글게', since: '2026-09',
    details: { intro: ['둥근 지도'], steps: ['누른다'], notes: [] } }
];

beforeEach(() => { document.body.innerHTML = ''; });

describe('LabGuidePanel', () => {
  it('목록은 「실험실이란?」 + 실험들이고, 처음엔 실험실이란? 을 보여 준다', () => {
    const g = new LabGuidePanel({ experiments: EXPS });
    g.show();
    const tabs = [...document.querySelectorAll('.labs-guide-tab')].map((t) => t.textContent.trim());
    expect(tabs).toEqual(['실험실이란?', '글래스 UI', '지구본']);
    expect(document.querySelector('.labs-guide-tab.active').textContent.trim()).toBe('실험실이란?');
    expect(document.querySelector('.labs-guide-title').textContent).toBe('실험실이란?');
    g.close();
  });

  it('목록을 누르면 그 기능 안내 한 편만 보인다', () => {
    const g = new LabGuidePanel({ experiments: EXPS });
    g.show();
    document.querySelector('.labs-guide-tab[data-id="glass"]').click();
    const body = document.querySelector('.labs-guide-body');
    expect(body.querySelector('.labs-guide-title').textContent).toBe('글래스 UI');
    expect([...body.querySelectorAll('h4')].map((h) => h.textContent)).toEqual(['소개', '사용 방법', '알아 두기']);
    expect(body.querySelectorAll('ol li')).toHaveLength(2);
    // 글자 그대로 — HTML 로 해석하지 않는다
    expect(body.querySelector('b')).toBeNull();
    expect(body.textContent).toContain('소개 <b>문단</b>');
    document.querySelector('.labs-guide-tab[data-id="globe"]').click();
    expect(body.querySelector('.labs-guide-title').textContent).toBe('지구본');
    expect([...body.querySelectorAll('h4')].map((h) => h.textContent)).toEqual(['소개', '사용 방법']);
    g.close();
  });

  it('Esc·닫기·바깥 클릭으로 닫힌다', () => {
    const g = new LabGuidePanel({ experiments: EXPS });
    g.show();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(g.isOpen()).toBe(false);
    g.show();
    document.getElementById('labs-guide-close').click();
    expect(document.querySelector('.labs-guide-modal')).toBeNull();
    g.show();
    document.querySelector('.labs-guide-modal').click();
    expect(g.isOpen()).toBe(false);
  });

  it('실제 목록의 실험은 모두 안내 창에 나온다', () => {
    const g = new LabGuidePanel();
    g.show();
    const ids = [...document.querySelectorAll('.labs-guide-tab')].map((t) => t.dataset.id).slice(1);
    expect(ids).toEqual(EXPERIMENTS.map((e) => e.id));
    g.close();
  });
});

describe('실험실 창의 i 버튼', () => {
  const open = () => {
    const labs = new Labs();
    labs.init({ knownIds: EXPS.map((e) => e.id), search: '', baseUrl: 'https://e-gis.kr/' });
    const guide = new LabGuidePanel({ experiments: EXPS });
    const panel = new LabPanel({ labs, experiments: EXPS, feedbackUrl: '', guide });
    panel.show();
    return { panel, guide };
  };

  it('카드에는 i 가 없고 제목 옆에 하나만 있다', () => {
    const { panel } = open();
    expect(document.querySelectorAll('.labs-card .labs-guide-btn, .labs-card .labs-info')).toHaveLength(0);
    expect(document.querySelectorAll('#labs-guide-open')).toHaveLength(1);
    panel.close();
  });

  it('i 를 누르면 안내 창이 뜨고, Esc 는 안내 창만 닫는다', () => {
    const { panel, guide } = open();
    document.getElementById('labs-guide-open').click();
    expect(guide.isOpen()).toBe(true);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(guide.isOpen()).toBe(false);
    expect(document.querySelector('.labs-modal')).not.toBeNull();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(document.querySelector('.labs-modal')).toBeNull();
    panel.close();
  });
});
