// © 2026 김용현
import { describe, it, expect } from 'vitest';
import { REGIONS, normalizeRegion } from './regions.js';

describe('REGIONS', () => {
  it("'전남'과 '광주'는 목록에서 빠지고 '전남광주'만 남는다", () => {
    expect(REGIONS).toContain('전남광주');
    expect(REGIONS).not.toContain('전남');
    expect(REGIONS).not.toContain('광주');
  });

  it('시도 개수는 16개다 (17개에서 전남·광주가 하나로 합쳐짐)', () => {
    expect(REGIONS).toHaveLength(16);
    expect(new Set(REGIONS).size).toBe(16); // 중복 없음
  });

  it('다른 시도는 그대로 남아 있다', () => {
    for (const region of ['서울', '부산', '대구', '인천', '대전', '울산', '세종',
      '경기', '강원', '충북', '충남', '전북', '경북', '경남', '제주']) {
      expect(REGIONS).toContain(region);
    }
  });
});

describe('normalizeRegion', () => {
  it("옛 값 '전남'·'광주'를 '전남광주'로 바꾼다", () => {
    expect(normalizeRegion('전남')).toBe('전남광주');
    expect(normalizeRegion('광주')).toBe('전남광주');
  });

  it('이미 통합된 값은 그대로 둔다', () => {
    expect(normalizeRegion('전남광주')).toBe('전남광주');
  });

  it('다른 시도는 손대지 않는다', () => {
    expect(normalizeRegion('서울')).toBe('서울');
    expect(normalizeRegion('경기')).toBe('경기');
  });

  it('빈 값은 빈 문자열로 돌려준다', () => {
    expect(normalizeRegion('')).toBe('');
    expect(normalizeRegion(null)).toBe('');
    expect(normalizeRegion(undefined)).toBe('');
  });

  it('보정 결과는 언제나 목록에 있는 값이다', () => {
    for (const region of ['전남', '광주', ...REGIONS]) {
      expect(REGIONS).toContain(normalizeRegion(region));
    }
  });
});
