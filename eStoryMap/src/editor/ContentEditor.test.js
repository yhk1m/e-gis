// © 2026 김용현
import { describe, it, expect, vi } from 'vitest';
import { createContentEditor } from './ContentEditor.js';

function pageWith(content) {
  return { content: { heading: '', body: '', caption: '', ...content } };
}

function make(onChange = vi.fn()) {
  const el = document.createElement('div');
  const editor = createContentEditor(el, { onChange });
  return { el, editor, onChange };
}

describe('ContentEditor', () => {
  it('render가 페이지 콘텐츠로 필드와 미리보기를 채운다', () => {
    const { el, editor } = make();
    editor.render(pageWith({ heading: '제목A', body: '# 본문A', caption: '캡션A' }));
    expect(el.querySelector('#content-heading').value).toBe('제목A');
    expect(el.querySelector('#content-body').value).toBe('# 본문A');
    expect(el.querySelector('#content-caption').value).toBe('캡션A');
    expect(el.querySelector('#content-preview').innerHTML).toContain('<h1');
  });

  it('heading 입력 → onChange("heading", 값)', () => {
    const { el, onChange } = make();
    const input = el.querySelector('#content-heading');
    input.value = '새 제목';
    input.dispatchEvent(new Event('input'));
    expect(onChange).toHaveBeenCalledWith('heading', '새 제목');
  });

  it('body 입력 → onChange("body", 값) + 미리보기 즉시 갱신', () => {
    const { el, onChange } = make();
    const body = el.querySelector('#content-body');
    body.value = '# 실시간';
    body.dispatchEvent(new Event('input'));
    expect(onChange).toHaveBeenCalledWith('body', '# 실시간');
    expect(el.querySelector('#content-preview').innerHTML).toContain('<h1');
    expect(el.querySelector('#content-preview').textContent).toContain('실시간');
  });

  it('caption 입력 → onChange("caption", 값)', () => {
    const { el, onChange } = make();
    const input = el.querySelector('#content-caption');
    input.value = '출처: 통계청';
    input.dispatchEvent(new Event('input'));
    expect(onChange).toHaveBeenCalledWith('caption', '출처: 통계청');
  });

  it('미리보기는 살균된다(script/onerror 제거)', () => {
    const { el } = make();
    const body = el.querySelector('#content-body');
    body.value = '<script>alert(1)</script><img src="x" onerror="alert(1)">안전';
    body.dispatchEvent(new Event('input'));
    const html = el.querySelector('#content-preview').innerHTML;
    expect(html).not.toContain('<script');
    expect(html).not.toContain('onerror');
    expect(el.querySelector('#content-preview').textContent).toContain('안전');
  });

  it('다른 페이지로 render하면 필드가 그 페이지 값으로 바뀐다', () => {
    const { el, editor } = make();
    editor.render(pageWith({ heading: 'A' }));
    expect(el.querySelector('#content-heading').value).toBe('A');
    editor.render(pageWith({ heading: 'B', body: '내용B' }));
    expect(el.querySelector('#content-heading').value).toBe('B');
    expect(el.querySelector('#content-body').value).toBe('내용B');
  });
});
