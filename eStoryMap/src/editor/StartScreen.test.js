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
});
