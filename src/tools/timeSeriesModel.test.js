// © 2026 김용현
/**
 * 시계열 단계구분도의 순수 규칙.
 * - 연도 필드는 이름이 19xx/20xx 로 시작하는 것 (스펙: /^(19|20)\d{2}/).
 * - 구간은 선택한 모든 필드의 값을 합쳐 한 번만 계산한다 → unionValues 는 숫자만 모아 정렬.
 * - 슬라이더는 끝에서 처음으로 돌아간다(nextIndex).
 * - 직렬화 레코드는 원본과 참조를 공유하지 않는다.
 */
import { describe, it, expect } from 'vitest';
import {
  detectYearFields, unionValues, nextIndex, subtitleFor, derivedLayerName,
  timeSeriesRecord, normalizeTimeSeries, MAX_TIME_SERIES_FIELDS
} from './timeSeriesModel.js';

function feat(props) {
  return { get: (k) => props[k] };
}

describe('detectYearFields', () => {
  it('19xx·20xx 로 시작하는 이름만 고르고 순서를 지킨다', () => {
    expect(detectYearFields(['name', '2015', '2020_pop', '1995년', 'pop2010', '3000'])).toEqual(['2015', '2020_pop', '1995년']);
  });
  it('없으면 빈 배열', () => {
    expect(detectYearFields(['a', 'b'])).toEqual([]);
    expect(detectYearFields([])).toEqual([]);
  });
});

describe('unionValues', () => {
  it('모든 필드의 숫자 값을 합쳐 오름차순으로 돌려준다', () => {
    const features = [feat({ '2015': 10, '2020': '30' }), feat({ '2015': 20, '2020': null }), feat({ '2015': 'x', '2020': 5 })];
    expect(unionValues(features, ['2015', '2020'])).toEqual([5, 10, 20, 30]);
  });
  it('필드나 피처가 없으면 빈 배열', () => {
    expect(unionValues([], ['2015'])).toEqual([]);
    expect(unionValues([feat({ a: 1 })], [])).toEqual([]);
  });
});

describe('nextIndex', () => {
  it('끝에서 처음으로 돌아간다', () => {
    expect(nextIndex(0, 3)).toBe(1);
    expect(nextIndex(2, 3)).toBe(0);
    expect(nextIndex(5, 0)).toBe(0);
  });
});

describe('subtitleFor', () => {
  it('필드 이름과 위치를 적는다', () => {
    expect(subtitleFor('2015', 0, 6)).toBe('2015 (1/6)');
  });
});

describe('derivedLayerName', () => {
  it('원본_시계열_첫필드~끝필드', () => {
    expect(derivedLayerName('서울 자치구', ['2015', '2020', '2025'])).toBe('서울 자치구_시계열_2015~2025');
  });
});

describe('timeSeriesRecord / normalizeTimeSeries', () => {
  it('레코드는 깊은 복사이고 없으면 undefined', () => {
    const ts = { fields: ['2015', '2020'], index: 1 };
    const rec = timeSeriesRecord(ts);
    expect(rec).toEqual(ts);
    expect(rec.fields).not.toBe(ts.fields);
    expect(timeSeriesRecord(undefined)).toBeUndefined();
    expect(timeSeriesRecord({ fields: ['x'] })).toBeUndefined();   // 필드 2개 미만은 시계열이 아니다
  });

  it('복원값을 정돈한다: 문자열 필드만, 인덱스는 범위 안, 30개 제한', () => {
    expect(normalizeTimeSeries({ fields: ['2015', 7, '2020'], index: 9 })).toEqual({ fields: ['2015', '2020'], index: 1 });
    expect(normalizeTimeSeries({ fields: ['2015', '2020'], index: -3 })).toEqual({ fields: ['2015', '2020'], index: 0 });
    expect(normalizeTimeSeries({ fields: ['2015'] })).toBeNull();
    expect(normalizeTimeSeries(null)).toBeNull();
    const many = Array.from({ length: 40 }, (_, i) => String(1990 + i));
    expect(normalizeTimeSeries({ fields: many, index: 0 }).fields).toHaveLength(MAX_TIME_SERIES_FIELDS);
  });
});
