// © 2026 김용현
import { describe, it, expect } from 'vitest';
import {
  guessColumns, detectTableShape, parseLongTable, parseMatrixTable
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
