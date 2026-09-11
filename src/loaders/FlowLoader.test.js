// © 2026 김용현
import { describe, it, expect } from 'vitest';
import * as XLSX from 'xlsx';
import { parseFlowXlsx, parseFlowCsv, decodeCsvBytes, locationsFromTable } from './FlowLoader.js';

describe('parseFlowCsv', () => {
  it('BOM 을 벗기고 헤더·데이터를 읽는다', () => {
    const csv = '\uFEFF지역,인구\n서울,100\n경기,200\n';
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

  it('첫 열 헤더가 비어 있으면(행렬표의 A1 공백) "구분"으로 채운다', () => {
    const csv = ',서울,경기\n서울,0,10\n경기,5,0\n';
    const { headers, data } = parseFlowCsv(csv);
    expect(headers).toEqual(['구분', '서울', '경기']);
    expect(data[0].구분).toBe('서울');
  });

  it('헤더뿐이고 데이터 행이 전부 빈 칸이면 예외를 던진다', () => {
    const csv = '지역,인구\n,\n,\n';
    expect(() => parseFlowCsv(csv)).toThrow('데이터가 없습니다');
  });
});

describe('decodeCsvBytes', () => {
  it('UTF-8 바이트(BOM 포함)를 문자열로 디코딩한다', () => {
    const bytes = new Uint8Array([0xef, 0xbb, 0xbf, ...Buffer.from('지역,인구', 'utf-8')]);
    expect(decodeCsvBytes(bytes.buffer)).toBe('지역,인구');
  });

  it('CP949(EUC-KR) 바이트도 깨지지 않고 디코딩한다', () => {
    // "서울"의 CP949 바이트열 — 엑셀 한국어판이 "CSV" 로 내보내면 이 인코딩이 된다
    const bytes = new Uint8Array([0xbc, 0xad, 0xbf, 0xef]);
    expect(decodeCsvBytes(bytes.buffer)).toBe('서울');
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

  it('첫 열 헤더가 비어 있으면(행렬표 A1 공백, 희소 배열 구멍) "구분"으로 채운다', () => {
    const buf = buildWorkbook([
      [null, '서울', '부산'],
      ['서울', 0, 5],
      ['부산', 7, 0]
    ]);
    const { headers, data } = parseFlowXlsx(buf);
    expect(headers).toEqual(['구분', '서울', '부산']);
    expect(data[0].구분).toBe('서울');
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

  it('빈 좌표 셀은 (0,0)이 아니라 건너뛴다', () => {
    const table = {
      headers: ['지역명', '위도', '경도'],
      data: [
        { 지역명: '서울', 위도: '37.5', 경도: '127.0' },
        { 지역명: '빈값', 위도: '', 경도: '' },
        { 지역명: '인천', 위도: '37.45', 경도: '126.7' }
      ]
    };
    const locs = locationsFromTable(table);
    expect(locs.map((l) => l.name)).toEqual(['서울', '인천']);
  });

  it('위경도 범위를 벗어난 값(TM 좌표 등)은 건너뛴다', () => {
    const table = {
      headers: ['지역명', 'y', 'x'],
      data: [
        { 지역명: '서울', y: '37.5', x: '127.0' },
        { 지역명: 'TM좌표', y: '197000', x: '953000' },
        { 지역명: '경기', y: '37.4', x: '127.5' }
      ]
    };
    const locs = locationsFromTable(table);
    expect(locs.map((l) => l.name)).toEqual(['서울', '경기']);
  });

  it('넓어진 이름·코드 열 패턴(시도명/코드)을 인식한다', () => {
    const table = {
      headers: ['코드', '시도명', '위도', '경도'],
      data: [
        { 코드: '11', 시도명: '서울', 위도: '37.5', 경도: '127.0' },
        { 코드: '41', 시도명: '경기', 위도: '37.4', 경도: '127.5' }
      ]
    };
    const locs = locationsFromTable(table);
    expect(locs.map((l) => l.name)).toEqual(['서울', '경기']);
    expect(locs.map((l) => l.id)).toEqual(['11', '41']);
  });

  it('이름 열이 따로 없으면 id 열 값을 이름으로도 쓴다', () => {
    const table = {
      headers: ['id', 'lat', 'lon'],
      data: [
        { id: 'A', lat: '37.5', lon: '127.0' },
        { id: 'B', lat: '37.4', lon: '127.5' }
      ]
    };
    const locs = locationsFromTable(table);
    expect(locs.map((l) => l.name)).toEqual(['A', 'B']);
    expect(locs.map((l) => l.id)).toEqual(['A', 'B']);
  });
});
