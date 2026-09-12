// © 2026 김용현
import { describe, it, expect } from 'vitest';
import { builtinDataManager } from './BuiltinDataManager.js';

const item = (name) => ({ id: name, name, file: `raster/${name}.tif` });

describe('getRasterCatalogGrouped', () => {
  it('한반도 전체 DEM은 자기 폴더를 갖고 맨 앞에 온다', () => {
    builtinDataManager.rasterCatalog = [
      item('경상북도 경주시'),
      item('서울특별시 종로구'),
      item('한반도'),
      item('대구광역시 군위군')
    ];
    const groups = builtinDataManager.getRasterCatalogGrouped();
    expect(groups.map((g) => g.name)).toEqual(['한반도', '서울특별시', '대구광역시', '경상북도']);
    expect(groups[0].items.map((i) => i.name)).toEqual(['한반도']);
  });

  it('군위군은 대구광역시 폴더에 들어간다', () => {
    builtinDataManager.rasterCatalog = [item('대구광역시 군위군'), item('대구광역시 동구')];
    const [daegu] = builtinDataManager.getRasterCatalogGrouped();
    expect(daegu.name).toBe('대구광역시');
    expect(daegu.items.map((i) => builtinDataManager.stripProvincePrefix(i.name))).toEqual(['군위군', '동구']);
  });

  it('폴더 안 표시 이름은 광역자치단체 접두어를 뗀다 — 한반도는 그대로', () => {
    expect(builtinDataManager.stripProvincePrefix('대구광역시 군위군')).toBe('군위군');
    expect(builtinDataManager.stripProvincePrefix('한반도')).toBe('한반도');
  });
});
