// © 2026 김용현
import { describe, it, expect } from 'vitest';
import { renderMarkdown } from './markdown.js';

describe('renderMarkdown', () => {
  it('헤딩을 렌더한다', () => {
    const html = renderMarkdown('# 부산의 인구');
    expect(html).toContain('<h1');
    expect(html).toContain('부산의 인구');
  });

  it('굵게/목록 등 기본 문법을 렌더한다', () => {
    expect(renderMarkdown('**굵게**')).toContain('<strong>굵게</strong>');
    const list = renderMarkdown('- 하나\n- 둘');
    expect(list).toContain('<ul>');
    expect(list.match(/<li>/g)).toHaveLength(2);
  });

  it('script 태그를 살균한다', () => {
    const html = renderMarkdown('주의 <script>alert(1)</script> 문구');
    expect(html).not.toContain('<script');
    expect(html).toContain('주의');
    expect(html).toContain('문구');
  });

  it('이벤트 핸들러 속성을 살균한다', () => {
    const html = renderMarkdown('<img src="x" onerror="alert(1)">');
    expect(html).not.toContain('onerror');
  });

  it('빈 입력은 빈 문자열', () => {
    expect(renderMarkdown('')).toBe('');
    expect(renderMarkdown(null)).toBe('');
    expect(renderMarkdown(undefined)).toBe('');
  });
});
