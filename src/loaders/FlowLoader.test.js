// © 2026 김용현
import { describe, it, expect } from 'vitest';
import * as XLSX from 'xlsx';
import { parseFlowXlsx, parseFlowCsv, locationsFromTable } from './FlowLoader.js';

describe('parseFlowCsv', () => {
  it('BOM 을 벗기고 헤더·데이터를 읽는다', () => {
    const csv = '﻿지역,인구\n서울,100\n경기,200\n';
    const { headers, data } = parseFlowCsv(csv);
    expect(headers).toEqual(['지역', '인구']);
    expect(data).toEqual([{ 지역: '서울', 인구: '100' }, { 지역: '경기', 인구: '200' }]);
  });

  it('쉼표가 든 숫자 문자열은 그대로 문자열로 남는다', () => {
    const csv = '지역,인구\n서울,"1,234"\n';
    const { data } = parseFlowCsv(csv);
    expect(data[0].인구).toBe('1,234');
  });

  it('빈 행은 건너뛴다', () => {
    const csv = '지역,인구\n서울,100\n\n경기,200\n';
    const { data } = parseFlowCsv(csv);
    expect(data).toHaveLength(2);
  });

  it('빈 헤더 열은 버린다', () => {
    const csv = '지역,,인구\n서울,,100\n경기,,200\n';
    const { headers, data } = parseFlowCsv(csv);
    expect(headers).toEqual(['지역', '인구']);
    expect(data[0]).toEqual({ 지역: '서울', 인구: '100' });
  });
});

describe('parseFlowXlsx', () => {
  function buildWorkbook(rows) {
    const ws = XLSX.utils.aoa_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
    return XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
  }

  it('숫자 셀은 숫자로, "1,234" 같은 텍스트 셀은 문자열로 남는다', () => {
    const buf = buildWorkbook([
      ['지역', '인구', '비고'],
      ['서울', 100, '1,234']
    ]);
    const { headers, data } = parseFlowXlsx(buf);
    expect(headers).toEqual(['지역', '인구', '비고']);
    expect(data[0].인구).toBe(100);
    expect(typeof data[0].인구).toBe('number');
    expect(data[0].비고).toBe('1,234');
    expect(typeof data[0].비고).toBe('string');
  });
});

describe('locationsFromTable', () => {
  it('위도/경도 열을 찾고 코드 열이 있으면 id 로 쓴다', () => {
    const table = {
      headers: ['코드', '지역명', '위도', '경도'],
      data: [
        { 코드: '11', 지역명: '서울', 위도: '37.5', 경도: '127.0' },
        { 코드: '41', 지역명: '경기', 위도: '37.4', 경도: '127.5' }
      ]
    };
    const locs = locationsFromTable(table);
    expect(locs).toEqual([
      { id: '11', name: '서울', code: '11', lon: 127.0, lat: 37.5 },
      { id: '41', name: '경기', code: '41', lon: 127.5, lat: 37.4 }
    ]);
  });

  it('lat/lon 영문 열도 찾는다', () => {
    const table = {
      headers: ['name', 'lat', 'lon'],
      data: [
        { name: 'Seoul', lat: '37.5', lon: '127.0' },
        { name: 'Incheon', lat: '37.45', lon: '126.7' }
      ]
    };
    const locs = locationsFromTable(table);
    expect(locs.map((l) => l.name)).toEqual(['Seoul', 'Incheon']);
  });

  it('코드 열이 없으면 loc-i 를 id 로 쓴다', () => {
    const table = {
      headers: ['지역명', '위도', '경도'],
      data: [
        { 지역명: '서울', 위도: '37.5', 경도: '127.0' },
        { 지역명: '경기', 위도: '37.4', 경도: '127.5' }
      ]
    };
    const locs = locationsFromTable(table);
    expect(locs.map((l) => l.id)).toEqual(['loc-0', 'loc-1']);
  });

  it('위도·경도 열이 없으면 예외를 던진다', () => {
    const table = { headers: ['지역명', '인구'], data: [{ 지역명: '서울', 인구: 100 }] };
    expect(() => locationsFromTable(table)).toThrow('위도·경도');
  });

  it('유효한 위치가 2개 미만이면 예외를 던진다', () => {
    const table = {
      headers: ['지역명', '위도', '경도'],
      data: [{ 지역명: '서울', 위도: '37.5', 경도: '127.0' }]
    };
    expect(() => locationsFromTable(table)).toThrow('2개 이상');
  });
});
