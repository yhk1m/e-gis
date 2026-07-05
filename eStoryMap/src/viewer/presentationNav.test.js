// © 2026 김용현
import { describe, it, expect } from 'vitest';
import { navReduce, indicatorDots, buildOverlay } from './presentationNav.js';

describe('navReduce', () => {
  it('next는 다음 인덱스로, 마지막에서는 멈춘다(no-wrap)', () => {
    expect(navReduce(0, 3, 'next')).toBe(1);
    expect(navReduce(2, 3, 'next')).toBe(2);
  });
  it('prev는 이전 인덱스로, 처음에서는 멈춘다(no-wrap)', () => {
    expect(navReduce(1, 3, 'prev')).toBe(0);
    expect(navReduce(0, 3, 'prev')).toBe(0);
  });
  it('first/last는 양 끝으로 점프', () => {
    expect(navReduce(2, 4, 'first')).toBe(0);
    expect(navReduce(1, 4, 'last')).toBe(3);
  });
  it('알 수 없는 action은 현재 인덱스 유지, 범위 밖 current는 클램프', () => {
    expect(navReduce(1, 3, 'noop')).toBe(1);
    expect(navReduce(5, 3, 'next')).toBe(2);
    expect(navReduce(-2, 3, 'prev')).toBe(0);
  });
  it('count 0은 0으로 방어', () => {
    expect(navReduce(0, 0, 'next')).toBe(0);
  });
});

describe('indicatorDots', () => {
  it('current 위치만 active', () => {
    expect(indicatorDots(3, 1)).toEqual([
      { active: false }, { active: true }, { active: false },
    ]);
  });
  it('길이는 count와 같다', () => {
    expect(indicatorDots(5, 0)).toHaveLength(5);
  });
});

describe('buildOverlay', () => {
  it('body를 살균 마크다운으로 렌더하고 heading/caption을 그대로 담는다', () => {
    const o = buildOverlay({ heading: '부산', body: '**굵게**', caption: '자료: 통계청' });
    expect(o.heading).toBe('부산');
    expect(o.bodyHtml).toContain('<strong>굵게</strong>');
    expect(o.caption).toBe('자료: 통계청');
    expect(o.empty).toBe(false);
  });
  it('모든 필드가 비면 empty=true, bodyHtml은 빈 문자열', () => {
    const o = buildOverlay({ heading: '', body: '', caption: '' });
    expect(o.empty).toBe(true);
    expect(o.bodyHtml).toBe('');
  });
  it('공백만 있는 필드도 빈 것으로 취급', () => {
    expect(buildOverlay({ heading: '  ', body: '   ', caption: '\n' }).empty).toBe(true);
  });
  it('일부 필드만 있어도 empty=false', () => {
    expect(buildOverlay({ heading: '제목만', body: '', caption: '' }).empty).toBe(false);
  });
  it('content가 없어도 안전(방어)', () => {
    expect(buildOverlay(undefined).empty).toBe(true);
  });
});
