// © 2026 김용현
/**
 * 배경지도 카탈로그 규칙.
 *
 * - VWorld 키가 없으면 한국 묶음이 통째로 빠져야 한다 (키 문제로 지도가 깨지지 않게)
 * - 라벨 오버레이 항목은 위성+라벨 둘뿐이다
 * - 배경 타일을 crossOrigin 없이 받으면 지도 캔버스가 오염돼(tainted canvas)
 *   지도 내보내기의 canvas.toDataURL() 이 SecurityError 로 막힌다.
 *   위성 · 위성+라벨에서 실제로 내보내기가 통째로 실패했던 회귀를 잠근다.
 */
import { describe, it, expect } from 'vitest';
import {
  getBasemapCatalog, findBasemap, vworldTileUrl, BASEMAP_GROUPS, DEFAULT_BASEMAP
} from './basemaps.js';

const KEY = 'TESTKEY123';

describe('vworldTileUrl', () => {
  it('VWorld WMTS 타일 주소를 조립한다 (z/y/x 순서)', () => {
    expect(vworldTileUrl('Base', 'png', KEY))
      .toBe(`https://api.vworld.kr/req/wmts/1.0.0/${KEY}/Base/{z}/{y}/{x}.png`);
    expect(vworldTileUrl('Satellite', 'jpeg', KEY))
      .toBe(`https://api.vworld.kr/req/wmts/1.0.0/${KEY}/Satellite/{z}/{y}/{x}.jpeg`);
  });
});

describe('getBasemapCatalog', () => {
  it('키가 없으면 한국 묶음이 빠지고 세계 묶음만 남는다', () => {
    const keys = getBasemapCatalog({ vworldKey: '' }).map((b) => b.key);
    expect(keys.filter((k) => k.startsWith('VW_'))).toHaveLength(0);
    expect(keys).toEqual(['OSM', 'OPENTOPO', 'SATELLITE', 'SATELLITE_LABELS', 'ESRI_DARK', 'NONE']);
  });

  it('키가 있으면 한국 5종이 앞에 온다', () => {
    const keys = getBasemapCatalog({ vworldKey: KEY }).map((b) => b.key);
    expect(keys.slice(0, 5)).toEqual(['VW_BASE', 'VW_WHITE', 'VW_MIDNIGHT', 'VW_SATELLITE', 'VW_HYBRID']);
    expect(keys).toHaveLength(11);
  });

  it('묶음은 korea·world 두 개이고 NONE 은 hidden 이라 목록에 안 나온다', () => {
    expect(BASEMAP_GROUPS.map((g) => g.id)).toEqual(['korea', 'world']);
    const none = findBasemap('NONE', { vworldKey: KEY });
    expect(none.group).toBe('hidden');
    for (const b of getBasemapCatalog({ vworldKey: KEY })) {
      if (b.key !== 'NONE') expect(['korea', 'world']).toContain(b.group);
    }
  });

  it('라벨 오버레이가 있는 항목은 VW_HYBRID 와 SATELLITE_LABELS 뿐이다', () => {
    const withLabels = getBasemapCatalog({ vworldKey: KEY }).filter((b) => b.labels).map((b) => b.key);
    expect(withLabels.sort()).toEqual(['SATELLITE_LABELS', 'VW_HYBRID']);
  });

  it('VWorld 소스는 키가 든 주소를 쓰고 줌 6~19 로 제한한다', () => {
    const base = findBasemap('VW_BASE', { vworldKey: KEY }).source();
    expect(base.getUrls()[0]).toContain(`/${KEY}/Base/`);
    expect(base.getTileGrid().getMinZoom()).toBe(6);
    expect(base.getTileGrid().getMaxZoom()).toBe(19);
  });

  it('기본값은 키 없이도 있는 OSM 이다', () => {
    expect(DEFAULT_BASEMAP).toBe('OSM');
    expect(findBasemap(DEFAULT_BASEMAP, { vworldKey: '' })).not.toBeNull();
  });

  it('모르는 키는 null', () => {
    expect(findBasemap('NOPE', { vworldKey: KEY })).toBeNull();
  });
});

describe('배경 타일 crossOrigin', () => {
  const entries = getBasemapCatalog({ vworldKey: KEY });

  it.each(entries.map((b) => [b.key, b]))('%s 소스는 익명 CORS 로 타일을 받는다', (key, def) => {
    expect(def.source().crossOrigin).toBe('anonymous');
    if (def.labels) expect(def.labels().crossOrigin).toBe('anonymous');
  });
});
