// © 2026 김용현
/**
 * 공공데이터포털 응답을 e-GIS가 아는 한 가지 모양으로 바꾸는 규칙.
 *
 * 포털은 API마다 응답 구조가 다르다. 배열이 `body.items`에 바로 있기도 하고
 * `body.items.item`에 있기도 하며, 결과가 1건이면 배열이 아니라 객체로 온다.
 * 좌표도 문자열이고 이름도 제각각이다. 그 차이를 여기서 전부 흡수한다.
 */
import { describe, it, expect } from 'vitest';
import { normalize } from './_normalize.js';

import airArray from './__fixtures__/air-items-array.json' with { type: 'json' };
import singleItem from './__fixtures__/single-item-object.json' with { type: 'json' };
import emptyBody from './__fixtures__/empty-body.json' with { type: 'json' };

/** 대기오염 측정소 — 위도가 dmX, 경도가 dmY라는 함정이 실제로 있다 */
const AIR_ENTRY = {
  path: 'response.body.items',
  lat: 'dmX',
  lon: 'dmY',
  epsg: 4326
};

const CHARGER_ENTRY = {
  path: 'response.body.items.item',
  lat: 'lat',
  lon: 'lng',
  epsg: 4326
};

describe('normalize — 응답을 한 가지 모양으로', () => {
  it('배열에서 좌표가 있는 것만 items로 만든다', () => {
    const result = normalize(airArray, AIR_ENTRY);

    expect(result.count).toBe(2);
    expect(result.skipped).toBe(1);   // 좌표가 빈 측정소 1건
    expect(result.items[0]).toMatchObject({ lon: 127.047282, lat: 37.517562 });
  });

  it('좌표를 숫자로 바꾼다 (포털은 문자열로 준다)', () => {
    const result = normalize(airArray, AIR_ENTRY);

    expect(typeof result.items[0].lon).toBe('number');
    expect(typeof result.items[0].lat).toBe('number');
  });

  it('props에는 좌표 필드를 빼고 나머지를 그대로 담는다', () => {
    const result = normalize(airArray, AIR_ENTRY);

    expect(result.items[0].props).toEqual({
      stationName: '강남구',
      pm10Value: '42',
      pm25Value: '21'
    });
    expect(result.items[0].props.dmX).toBeUndefined();
  });

  it('결과가 1건이라 배열이 아니라 객체로 와도 처리한다', () => {
    const result = normalize(singleItem, CHARGER_ENTRY);

    expect(result.count).toBe(1);
    expect(result.items[0]).toMatchObject({ lon: 127.509742, lat: 37.831097 });
    expect(result.items[0].props.chargerName).toBe('가평군청 충전소');
  });

  it('경로에 배열이 없으면 빈 결과를 준다 (예외를 던지지 않는다)', () => {
    const result = normalize(emptyBody, AIR_ENTRY);

    expect(result).toMatchObject({ items: [], count: 0, skipped: 0 });
  });

  it('응답이 통째로 비어도 죽지 않는다', () => {
    expect(normalize(null, AIR_ENTRY)).toMatchObject({ items: [], count: 0 });
    expect(normalize({}, AIR_ENTRY)).toMatchObject({ items: [], count: 0 });
  });

  it('좌표계를 그대로 실어 보낸다 — 변환은 브라우저 몫이다', () => {
    expect(normalize(airArray, AIR_ENTRY).epsg).toBe(4326);
    expect(normalize(airArray, { ...AIR_ENTRY, epsg: 5186 }).epsg).toBe(5186);
  });

  it('epsg를 안 적은 카탈로그 항목은 위경도(4326)로 본다', () => {
    const { epsg, ...withoutEpsg } = AIR_ENTRY;

    expect(normalize(airArray, withoutEpsg).epsg).toBe(4326);
  });

  it('위경도 범위를 벗어난 좌표는 버린다 (4326일 때)', () => {
    const raw = { response: { body: { items: [
      { name: '정상', lon: '127.0', lat: '37.5' },
      { name: '뒤바뀜', lon: '37.5', lat: '127.0' }   // 위도 127은 있을 수 없다
    ] } } };
    const entry = { path: 'response.body.items', lon: 'lon', lat: 'lat', epsg: 4326 };

    const result = normalize(raw, entry);

    expect(result.count).toBe(1);
    expect(result.skipped).toBe(1);
    expect(result.items[0].props.name).toBe('정상');
  });

  it('좌표가 0, 0이면 좌표 없음으로 본다 (기니만 앞바다에 찍히면 안 된다)', () => {
    // 서울시 주차장 자료는 1,000건 중 142건이 LAT=0, LOT=0으로 온다
    const raw = { response: { body: { items: [
      { name: '정상', lon: '127.0', lat: '37.5' },
      { name: '좌표없음', lon: '0', lat: '0' }
    ] } } };
    const entry = { path: 'response.body.items', lon: 'lon', lat: 'lat', epsg: 4326 };

    const result = normalize(raw, entry);

    expect(result.count).toBe(1);
    expect(result.skipped).toBe(1);
  });

  it('투영좌표계에서는 0을 버리지 않는다 (원점 근처가 실제로 있을 수 있다)', () => {
    const raw = { response: { body: { items: [{ x: '0', y: '0' }] } } };
    const entry = { path: 'response.body.items', lon: 'x', lat: 'y', epsg: 5181 };

    expect(normalize(raw, entry).count).toBe(1);
  });

  it('투영좌표계(TM)는 위경도 범위 검사를 하지 않는다', () => {
    const raw = { response: { body: { items: [
      { name: '중부원점TM', x: '200000', y: '600000' }
    ] } } };
    const entry = { path: 'response.body.items', lon: 'x', lat: 'y', epsg: 5186 };

    const result = normalize(raw, entry);

    expect(result.count).toBe(1);
    expect(result.items[0]).toMatchObject({ lon: 200000, lat: 600000 });
  });
});
