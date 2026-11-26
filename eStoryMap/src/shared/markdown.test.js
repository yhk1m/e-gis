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

  it('단일 줄바꿈을 <br>로 렌더한다(슬라이드 본문 친화)', () => {
    expect(renderMarkdown('첫 줄\n둘째 줄')).toContain('<br');
  });

  it('빈 입력은 빈 문자열', () => {
    expect(renderMarkdown('')).toBe('');
    expect(renderMarkdown(null)).toBe('');
    expect(renderMarkdown(undefined)).toBe('');
  });
});

describe('내 컴퓨터 사진(img:ID)', () => {
  const PNG = 'data:image/png;base64,iVBORw0KGgo=';
  it('사진 보관함의 data URL로 바꿔 그린다', async () => {
    const { renderMarkdown, setImageStore } = await import('./markdown.js');
    setImageStore({ img_1: PNG });
    const html = renderMarkdown('![바다](img:img_1)');
    expect(html).toContain(`src="${PNG}"`);
    expect(html).toContain('alt="바다"');
    setImageStore(null);
  });
  it('없는 사진이나 이상한 값이면 안내 글', async () => {
    const { renderMarkdown, setImageStore } = await import('./markdown.js');
    setImageStore({ img_2: 'javascript:alert(1)' });
    expect(renderMarkdown('![](img:img_1)')).toContain('사진을 찾지 못했어요');
    expect(renderMarkdown('![](img:img_2)')).not.toContain('javascript');
    setImageStore(null);
  });
});
