// © 2026 김용현
import { describe, it, expect } from 'vitest';
import { mergeProperties, uniqueKey, isSameValue } from './spatialAttributes.js';

describe('mergeProperties — 공간 연산 결과의 속성 승계', () => {
  it('겹치지 않는 필드는 양쪽 다 가져온다', () => {
    const merged = mergeProperties({ 시군구: '강남구' }, { 용도: '주거' });
    expect(merged).toEqual({ 시군구: '강남구', 용도: '주거' });
  });

  it('이름과 값이 모두 같으면 하나만 남긴다', () => {
    const merged = mergeProperties({ 시군구: '강남구' }, { 시군구: '강남구' });
    expect(merged).toEqual({ 시군구: '강남구' });
  });

  it('이름은 같고 값이 다르면 _2를 붙여 둘 다 보존한다', () => {
    const merged = mergeProperties({ 면적: 39.5 }, { 면적: 12.1 });
    expect(merged).toEqual({ 면적: 39.5, 면적_2: 12.1 });
  });

  it('_2가 이미 쓰이고 있으면 _3으로 넘어간다', () => {
    const merged = mergeProperties({ 면적: 1, 면적_2: 2 }, { 면적: 3 });
    expect(merged).toEqual({ 면적: 1, 면적_2: 2, 면적_3: 3 });
  });

  it('레이어1 값이 우선이고, 레이어2 필드는 원래 순서대로 뒤에 붙는다', () => {
    const merged = mergeProperties({ a: 1, b: 2 }, { b: 99, c: 3 });
    expect(Object.keys(merged)).toEqual(['a', 'b', 'b_2', 'c']);
    expect(merged.b).toBe(2);
    expect(merged.b_2).toBe(99);
  });

  it('geometry 키는 승계하지 않는다', () => {
    const merged = mergeProperties({ geometry: 'x', a: 1 }, { geometry: 'y', b: 2 });
    expect(merged).toEqual({ a: 1, b: 2 });
  });

  it('null/undefined 속성도 안전하게 처리한다', () => {
    expect(mergeProperties(null, { a: 1 })).toEqual({ a: 1 });
    expect(mergeProperties({ a: 1 }, undefined)).toEqual({ a: 1 });
    expect(mergeProperties(null, null)).toEqual({});
  });

  it('타입이 다르면 다른 값으로 본다 (5와 "5")', () => {
    const merged = mergeProperties({ n: 5 }, { n: '5' });
    expect(merged).toEqual({ n: 5, n_2: '5' });
  });

  it('값이 null로 같으면 하나만 남긴다', () => {
    expect(mergeProperties({ a: null }, { a: null })).toEqual({ a: null });
  });
});

describe('isSameValue', () => {
  it('원시값은 엄격 비교', () => {
    expect(isSameValue(1, 1)).toBe(true);
    expect(isSameValue(1, '1')).toBe(false);
    expect(isSameValue(null, null)).toBe(true);
    expect(isSameValue(null, undefined)).toBe(false);
  });

  it('객체·배열은 내용으로 비교', () => {
    expect(isSameValue({ a: 1 }, { a: 1 })).toBe(true);
    expect(isSameValue([1, 2], [1, 2])).toBe(true);
    expect(isSameValue({ a: 1 }, { a: 2 })).toBe(false);
  });
});

describe('uniqueKey', () => {
  it('비어 있으면 _2부터', () => {
    expect(uniqueKey({}, '면적')).toBe('면적_2');
  });

  it('이미 있는 접미사는 건너뛴다', () => {
    expect(uniqueKey({ 면적_2: 1, 면적_3: 1 }, '면적')).toBe('면적_4');
  });
});
