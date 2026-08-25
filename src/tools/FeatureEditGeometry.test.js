// © 2026 김용현
import { describe, it, expect } from 'vitest';
import { mergeAttributes } from './FeatureEditGeometry.js';

describe('mergeAttributes', () => {
  it('숫자 필드는 합계로 모은다', () => {
    const merged = mergeAttributes([{ 인구: 530000 }, { 인구: 410000 }]);
    expect(merged.인구).toBe(940000);
  });

  it('한쪽 피처에만 있는 필드도 남긴다', () => {
    const merged = mergeAttributes([
      { 시군구: '강남구', 면적: 39.5 },
      { 시군구: '서초구', 비고: '관측소' }
    ]);
    expect(merged).toEqual({ 시군구: '강남구', 면적: 39.5, 비고: '관측소' });
  });

  it('한쪽에만 있는 숫자 필드는 없는 쪽을 0으로 친다', () => {
    const merged = mergeAttributes([{ 인구: 100 }, { 면적: 20 }]);
    expect(merged).toEqual({ 인구: 100, 면적: 20 });
  });

  it('어떤 필드가 숫자인지는 그 필드가 처음 등장한 피처로 판단한다', () => {
    // 두 번째 피처에서 처음 나온 '관측소수'가 숫자이므로 합계 대상이 된다
    const merged = mergeAttributes([{ 이름: '가' }, { 이름: '나', 관측소수: 3 }, { 관측소수: 4 }]);
    expect(merged.관측소수).toBe(7);
  });

  it('숫자가 아닌 필드는 값이 있는 첫 피처의 값을 쓴다', () => {
    const merged = mergeAttributes([{ 시군구: '' }, { 시군구: '서초구' }]);
    expect(merged.시군구).toBe('서초구');
  });

  it('아무 피처에도 값이 없으면 필드를 빈 값으로 남긴다', () => {
    const merged = mergeAttributes([{ 시군구: '' }, { 시군구: null }]);
    expect('시군구' in merged).toBe(true);
    expect(merged.시군구).toBe('');
  });

  it('스키마가 같고 빈 값이 없으면 기존 규칙과 결과가 같다', () => {
    const merged = mergeAttributes([
      { 시군구: '강남구', 인구: 530000 },
      { 시군구: '서초구', 인구: 410000 }
    ]);
    expect(merged).toEqual({ 시군구: '강남구', 인구: 940000 });
  });

  it('false 는 값이 있는 것으로 본다', () => {
    const merged = mergeAttributes([{ 사용중: false }, { 사용중: true }]);
    expect(merged.사용중).toBe(false);
  });
});
