// © 2026 김용현
import { describe, it, expect } from 'vitest';
import {
  guessColumns, detectTableShape, parseLongTable, parseMatrixTable,
  normalizeName, buildDataset, aggregateTotals, visibleFlows,
  rampColor, flowStrength, flowWidth, locationRadius, COLOR_RAMPS
} from './flowModel.js';

describe('guessColumns', () => {
  it('한글·영문 헤더에서 출발/도착/양 열을 찾는다', () => {
    expect(guessColumns(['전출지', '전입지', '이동자수'])).toEqual({ origin: '전출지', dest: '전입지', count: '이동자수' });
    expect(guessColumns(['from', 'to', 'count'])).toEqual({ origin: 'from', dest: 'to', count: 'count' });
  });
  it('못 찾으면 앞에서부터 세 열을 쓴다', () => {
    expect(guessColumns(['a', 'b', 'c'])).toEqual({ origin: 'a', dest: 'b', count: 'c' });
  });
});

describe('detectTableShape', () => {
  it('세 열이면 긴 형식', () => {
    expect(detectTableShape({ headers: ['출발', '도착', '양'], data: [{ 출발: '서울', 도착: '경기', 양: 3 }] })).toBe('long');
  });
  it('첫 열 뒤가 전부 숫자면 행렬형', () => {
    const headers = ['전출지', '서울', '경기', '인천'];
    const data = [{ 전출지: '서울', 서울: 0, 경기: 10, 인천: 5 }];
    expect(detectTableShape({ headers, data })).toBe('matrix');
  });
  it('열이 넷 이상이어도 문자열이 섞이면 긴 형식', () => {
    const headers = ['출발', '도착', '양', '비고'];
    const data = [{ 출발: '서울', 도착: '경기', 양: 3, 비고: '메모' }];
    expect(detectTableShape({ headers, data })).toBe('long');
  });
});

describe('parseLongTable', () => {
  it('양이 없거나 0 이하이거나 합계 행이면 건너뛰고 센다', () => {
    const data = [
      { 출발: '서울', 도착: '경기', 양: 10 },
      { 출발: '서울', 도착: '인천', 양: '1,200' },
      { 출발: '서울', 도착: '부산', 양: 0 },
      { 출발: '서울', 도착: '대구', 양: '없음' },
      { 출발: '전국', 도착: '경기', 양: 99 }
    ];
    const r = parseLongTable({ headers: ['출발', '도착', '양'], data }, { origin: '출발', dest: '도착', count: '양' });
    expect(r.pairs).toEqual([{ origin: '서울', dest: '경기', count: 10 }, { origin: '서울', dest: '인천', count: 1200 }]);
    expect(r.skipped).toBe(3);
  });
});

describe('parseMatrixTable', () => {
  it('행=전출지, 열=전입지로 풀고 빈 칸·0은 조용히 버린다', () => {
    const headers = ['전출지', '서울', '경기', '계'];
    const data = [
      { 전출지: '서울', 서울: 0, 경기: 10, 계: 10 },
      { 전출지: '경기', 서울: 7, 경기: '', 계: 7 },
      { 전출지: '합계', 서울: 7, 경기: 10, 계: 17 }
    ];
    const r = parseMatrixTable({ headers, data });
    expect(r.pairs).toEqual([{ origin: '서울', dest: '경기', count: 10 }, { origin: '경기', dest: '서울', count: 7 }]);
    expect(r.skipped).toBe(0);
  });
  it('숫자가 아닌 셀은 건너뛰고 센다', () => {
    const headers = ['전출지', '서울', '경기'];
    const data = [{ 전출지: '서울', 서울: 0, 경기: 'x' }];
    expect(parseMatrixTable({ headers, data }).skipped).toBe(1);
  });
});

describe('normalizeName', () => {
  it('공백·괄호·행정 접미사를 벗기고 별칭을 맞춘다', () => {
    expect(normalizeName('서울특별시')).toBe('서울');
    expect(normalizeName('서울 시')).toBe('서울');
    expect(normalizeName('경기도')).toBe('경기');
    expect(normalizeName('강원특별자치도')).toBe('강원');
    expect(normalizeName('전라북도')).toBe('전북');
    expect(normalizeName('전북특별자치도')).toBe('전북');
    expect(normalizeName('전남광주통합특별시')).toBe('전남광주통합');
    expect(normalizeName('세종특별자치시')).toBe('세종');
    expect(normalizeName('수원시')).toBe('수원');
    expect(normalizeName('청주시 상당구')).toBe('청주시상당구');
    expect(normalizeName('부산 (釜山)')).toBe('부산');
  });
});

const candidates = [
  { id: '11', name: '서울특별시', code: '11', lon: 127, lat: 37.5 },
  { id: '41', name: '경기도', code: '41', lon: 127.2, lat: 37.4 },
  { id: '28', name: '인천광역시', code: '28', lon: 126.7, lat: 37.45 }
];

describe('buildDataset', () => {
  it('이름·코드로 위치를 찾고 같은 쌍은 합치며 못 찾은 이름은 모아 준다', () => {
    const pairs = [
      { origin: '서울', dest: '경기', count: 10 },
      { origin: '서울특별시', dest: '경기도', count: 5 },
      { origin: '11', dest: '28', count: 3 },
      { origin: '세종', dest: '경기', count: 7 },
      { origin: '서울', dest: '서울', count: 2 }
    ];
    const ds = buildDataset({ pairs, candidates, meta: { title: 't', unit: '명' } });
    expect(ds.flows).toEqual([
      { origin: '11', dest: '41', count: 15 },
      { origin: '11', dest: '28', count: 3 },
      { origin: '11', dest: '11', count: 2 }
    ]);
    expect(ds.locations.map((l) => l.id)).toEqual(['11', '41', '28']);
    expect(ds.locations[0]).toEqual({ id: '11', name: '서울특별시', lon: 127, lat: 37.5 });
    expect(ds.meta.unmatched).toEqual([{ name: '세종', count: 7 }]);
    expect(ds.meta.matched).toBe(3);
    expect(ds.meta.title).toBe('t');
  });
  it('손으로 짝지은 이름은 그대로 쓴다', () => {
    const ds = buildDataset({
      pairs: [{ origin: '세종', dest: '경기', count: 7 }],
      candidates, manualMap: { 세종: '28' }
    });
    expect(ds.flows).toEqual([{ origin: '28', dest: '41', count: 7 }]);
    expect(ds.meta.unmatched).toEqual([]);
  });
});

describe('aggregateTotals / visibleFlows', () => {
  const ds = {
    locations: candidates.map(({ id, name, lon, lat }) => ({ id, name, lon, lat })),
    flows: [
      { origin: '11', dest: '41', count: 15 },
      { origin: '41', dest: '11', count: 4 },
      { origin: '11', dest: '28', count: 3 },
      { origin: '11', dest: '11', count: 2 }
    ],
    meta: {}
  };
  it('유입·유출·순이동을 세고 자기 흐름은 기본 제외', () => {
    const t = aggregateTotals(ds);
    expect(t.get('11')).toEqual({ inflow: 4, outflow: 18, net: -14 });
    expect(t.get('41')).toEqual({ inflow: 15, outflow: 4, net: 11 });
    expect(t.get('28')).toEqual({ inflow: 3, outflow: 0, net: 3 });
    expect(aggregateTotals(ds, { includeSelf: true }).get('11')).toEqual({ inflow: 6, outflow: 20, net: -14 });
  });
  it('표시용 흐름은 자기 흐름을 빼고 작은 것부터, 상위 N개 옵션', () => {
    expect(visibleFlows(ds).map((f) => f.count)).toEqual([3, 4, 15]);
    expect(visibleFlows(ds, { topN: 2 }).map((f) => f.count)).toEqual([4, 15]);
  });
});

describe('스케일', () => {
  it('굵기·반지름은 제곱근 비례, 색은 램프 보간', () => {
    expect(flowStrength(25, 100)).toBeCloseTo(0.5);
    expect(flowStrength(5, 0)).toBe(0);
    expect(flowWidth(100, 100, 12)).toBe(12);
    expect(flowWidth(0.0001, 100, 12)).toBe(1);
    expect(locationRadius(0, 100, 14)).toBe(3);
    expect(locationRadius(100, 100, 14)).toBe(14);
    expect(rampColor(COLOR_RAMPS.blue, 0)).toBe('rgb(191,219,254)');
    expect(rampColor(COLOR_RAMPS.blue, 1)).toBe('rgb(30,58,138)');
    expect(rampColor(['#000000', '#ffffff'], 0.5)).toBe('rgb(128,128,128)');
  });
});
