// © 2026 김용현
import { describe, it, expect, vi } from 'vitest';
import { createPageList } from './PageList.js';

const DOC2 = { pages: [{ id: 'page_1', title: '페이지 1' }, { id: 'page_2', title: '페이지 2' }] };
const DOC1 = { pages: [{ id: 'page_1', title: '페이지 1' }] };

function make(handlers = {}) {
  const el = document.createElement('div');
  const list = createPageList(el, {
    onSelect: vi.fn(), onAdd: vi.fn(), onRemove: vi.fn(), ...handlers,
  });
  return { el, list };
}

describe('PageList', () => {
  it('페이지 행들과 선택 하이라이트를 렌더한다', () => {
    const { el, list } = make();
    list.render(DOC2, 'page_2');
    const rows = [...el.querySelectorAll('.page-row')];
    expect(rows).toHaveLength(2);
    expect(rows[0].classList.contains('selected')).toBe(false);
    expect(rows[1].classList.contains('selected')).toBe(true);
    expect(rows[0].textContent).toContain('페이지 1');
  });

  it('행 이름 클릭 → onSelect(pageId)', () => {
    const onSelect = vi.fn();
    const { el, list } = make({ onSelect });
    list.render(DOC2, 'page_1');
    el.querySelectorAll('.page-row .page-name')[1].dispatchEvent(new Event('click'));
    expect(onSelect).toHaveBeenCalledWith('page_2');
  });

  it('+ 페이지 클릭 → onAdd', () => {
    const onAdd = vi.fn();
    const { el, list } = make({ onAdd });
    list.render(DOC1, 'page_1');
    el.querySelector('#btn-add-page').dispatchEvent(new Event('click'));
    expect(onAdd).toHaveBeenCalled();
  });

  it('× 클릭 → onRemove(pageId)', () => {
    const onRemove = vi.fn();
    const { el, list } = make({ onRemove });
    list.render(DOC2, 'page_1');
    el.querySelectorAll('.page-del')[1].dispatchEvent(new Event('click'));
    expect(onRemove).toHaveBeenCalledWith('page_2');
  });

  it('1페이지뿐이면 삭제 버튼 disabled', () => {
    const { el, list } = make();
    list.render(DOC1, 'page_1');
    expect(el.querySelector('.page-del').disabled).toBe(true);
  });

  it('재렌더 시 행이 갱신된다', () => {
    const { el, list } = make();
    list.render(DOC1, 'page_1');
    expect(el.querySelectorAll('.page-row')).toHaveLength(1);
    list.render(DOC2, 'page_1');
    expect(el.querySelectorAll('.page-row')).toHaveLength(2);
  });
});
