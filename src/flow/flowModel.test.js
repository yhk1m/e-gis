// © 2026 김용현
import { describe, it, expect } from 'vitest';
import {
  guessColumns, detectTableShape, parseLongTable, parseMatrixTable,
  normalizeName, buildDataset, aggregateTotals, visibleFlows,
  rampColor, flowStrength, flowWidth, locationRadius, COLOR_RAMPS, lightenHex, darkModeStops
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
  it("'Infinity' 는 문자열이든 숫자든 숫자로 보지 않고 건너뛴다", () => {
    const data = [
      { 출발: '서울', 도착: '경기', 양: 'Infinity' },
      { 출발: '서울', 도착: '인천', 양: Infinity }
    ];
    const r = parseLongTable({ headers: ['출발', '도착', '양'], data }, { origin: '출발', dest: '도착', count: '양' });
    expect(r.pairs).toEqual([]);
    expect(r.skipped).toBe(2);
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
  it("'-' 는 빈 칸과 똑같이 조용히 버려진다(스킵 카운트 없음)", () => {
    const headers = ['전출지', '서울', '경기'];
    const data = [{ 전출지: '서울', 서울: 0, 경기: '-' }];
    const r = parseMatrixTable({ headers, data });
    expect(r.pairs).toEqual([]);
    expect(r.skipped).toBe(0);
  });
  it('음수 셀은 건너뛰고 센다', () => {
    const headers = ['전출지', '서울', '경기'];
    const data = [{ 전출지: '서울', 서울: 0, 경기: -5 }];
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
    expect(ds.meta.matched).toBe(4);
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

describe('buildDataset — id 계약', () => {
  it('id 에 구분자가 섞여 있거나 숫자여도 flows 의 origin/dest 는 locations 의 id 와 그대로(===) 일치한다', () => {
    const trickyCandidates = [
      { id: 'seoul|11', name: '서울', lon: 127, lat: 37.5 },
      { id: 11, name: '경기', lon: 127.2, lat: 37.4 }
    ];
    const ds = buildDataset({
      pairs: [{ origin: '서울', dest: '경기', count: 5 }],
      candidates: trickyCandidates
    });
    expect(ds.flows).toEqual([{ origin: 'seoul|11', dest: 11, count: 5 }]);
    expect(ds.flows[0].origin).toBe(ds.locations[0].id);
    expect(ds.flows[0].dest).toBe(ds.locations[1].id);
    expect(typeof ds.flows[0].dest).toBe('number');
  });
});

describe('buildDataset — 후보 중복·모호 매칭', () => {
  it('같은 id 의 후보가 여러 번 있으면 locations 에는 한 번만(첫 값 우선) 남는다', () => {
    const dupCandidates = [
      { id: '11', name: '서울특별시', lon: 127, lat: 37.5 },
      { id: '11', name: '서울(중복)', lon: 999, lat: 999 },
      { id: '41', name: '경기도', lon: 127.2, lat: 37.4 }
    ];
    const ds = buildDataset({
      pairs: [{ origin: '서울', dest: '경기', count: 10 }],
      candidates: dupCandidates
    });
    expect(ds.locations).toEqual([
      { id: '11', name: '서울특별시', lon: 127, lat: 37.5 },
      { id: '41', name: '경기도', lon: 127.2, lat: 37.4 }
    ]);
  });
  it('정규화한 이름이 서로 다른 id 를 가리키면 모호하다고 보고 unmatched 로 보낸다', () => {
    const ambiguousCandidates = [
      { id: '42', name: '고성군', lon: 128.4, lat: 38.4 }, // 강원 고성
      { id: '48', name: '고성군', lon: 128.3, lat: 34.9 }, // 경남 고성
      { id: '41', name: '경기도', lon: 127.2, lat: 37.4 }
    ];
    const ds = buildDataset({
      pairs: [{ origin: '고성군', dest: '경기', count: 9 }],
      candidates: ambiguousCandidates
    });
    expect(ds.flows).toEqual([]);
    expect(ds.meta.unmatched).toEqual([{ name: '고성군', count: 9 }]);
  });
  it("manualMap 에 없는 이름이 'constructor' 처럼 프로토타입 속성과 겹쳐도 오염되지 않는다", () => {
    const ds = buildDataset({
      pairs: [{ origin: 'constructor', dest: '경기', count: 3 }],
      candidates
    });
    expect(ds.flows).toEqual([]);
    expect(ds.meta.unmatched).toEqual([{ name: 'constructor', count: 3 }]);
  });
  it('출발·도착이 같은 이름이고 둘 다 매칭에 실패하면 양을 두 번 더하지 않는다', () => {
    const ds = buildDataset({
      pairs: [{ origin: '세종', dest: '세종', count: 7 }],
      candidates
    });
    expect(ds.flows).toEqual([]);
    expect(ds.meta.matched).toBe(0);
    expect(ds.meta.unmatched).toEqual([{ name: '세종', count: 7 }]);
  });
  it('manualMap 이 후보에 없는 id 를 가리키면 무시하고 unmatched 로 남긴다', () => {
    const ds = buildDataset({
      pairs: [{ origin: '없는곳', dest: '경기', count: 4 }],
      candidates,
      manualMap: { 없는곳: '99' } // candidates 에 없는 id
    });
    expect(ds.flows).toEqual([]);
    expect(ds.meta.unmatched).toEqual([{ name: '없는곳', count: 4 }]);
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
    expect(rampColor(COLOR_RAMPS.blue, 0)).toBe('rgb(147,197,253)');
    expect(rampColor(COLOR_RAMPS.blue, 1)).toBe('rgb(30,58,138)');
    expect(rampColor(['#000000', '#ffffff'], 0.5)).toBe('rgb(128,128,128)');
  });
  it('t 가 NaN·Infinity 여도 던지지 않고 0 으로 본다', () => {
    expect(rampColor(COLOR_RAMPS.blue, NaN)).toBe('rgb(147,197,253)');
    expect(() => rampColor(COLOR_RAMPS.blue, Infinity)).not.toThrow();
    expect(rampColor(COLOR_RAMPS.blue, Infinity)).toBe('rgb(147,197,253)');
  });
});

describe('어두운 배경 램프', () => {
  it('lightenHex 는 흰색 쪽으로 섞고 darkModeStops 는 중간 진함 → 아주 밝음 순서다', () => {
    expect(lightenHex('#000000', 0.5)).toBe('#808080');
    expect(lightenHex('#ff0000', 0)).toBe('#ff0000');
    const d = darkModeStops(COLOR_RAMPS.teal);
    expect(d[0]).toBe(COLOR_RAMPS.teal[2]);
    expect(d[2]).toBe(COLOR_RAMPS.teal[0]);
    expect(d[3]).toBe(lightenHex(COLOR_RAMPS.teal[0], 0.55));
  });
});
