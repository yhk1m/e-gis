// © 2026 김용현
import { describe, it, expect } from 'vitest';
import { DEFAULT_LEGEND, clampLegendPos, buildLegendItems } from './legend.js';
import { createStoryDoc, addSource, getPage, setLayerVisible } from './StoryDoc.js';

/** 벡터 1 + 래스터(DEM) 1 소스를 붙인 문서. */
function docWithLayers() {
  const doc = createStoryDoc();
  const egis = {
    version: '1.0',
    layers: [
      { id: 'L_pop', name: '인구밀도', type: 'vector', color: '#e11d48' },
      { id: 'L_dem', name: '고도', type: 'raster', rasterKind: 'dem' },
    ],
  };
  addSource(doc, { sourceId: 'src_1', filename: 'a.egis', egis }, ['L_pop', 'L_dem'], 'page_1');
  return doc;
}

describe('clampLegendPos', () => {
  it('x,y를 [0,1]로 클램프한다', () => {
    expect(clampLegendPos(-0.5, 2)).toEqual({ x: 0, y: 1 });
    expect(clampLegendPos(0.3, 0.7)).toEqual({ x: 0.3, y: 0.7 });
  });
});

describe('buildLegendItems', () => {
  it('보이는 레이어를 이름+종류로 만든다(벡터=swatch, 래스터=ramp), 순서 유지', () => {
    const doc = docWithLayers();
    const items = buildLegendItems(doc, getPage(doc, 'page_1'));
    expect(items).toEqual([
      { key: 'src_1:L_pop', label: '인구밀도', kind: 'swatch', color: '#e11d48', hidden: false },
      { key: 'src_1:L_dem', label: '고도', kind: 'ramp', color: '#3b82f6', hidden: false },
    ]);
  });

  it('숨김(visible=false) 레이어는 제외한다', () => {
    const doc = docWithLayers();
    setLayerVisible(doc, 'page_1', 'src_1', 'L_dem', false);
    const items = buildLegendItems(doc, getPage(doc, 'page_1'));
    expect(items.map((i) => i.key)).toEqual(['src_1:L_pop']);
  });

  it('override 라벨을 적용하고, hidden은 플래그로 실어 보낸다(제외 안 함)', () => {
    const doc = docWithLayers();
    doc.meta.legend = {
      ...DEFAULT_LEGEND,
      overrides: {
        'src_1:L_pop': { label: '인구 (명/km²)' },
        'src_1:L_dem': { hidden: true },
      },
    };
    const items = buildLegendItems(doc, getPage(doc, 'page_1'));
    expect(items).toHaveLength(2);
    const pop = items.find((i) => i.key === 'src_1:L_pop');
    const dem = items.find((i) => i.key === 'src_1:L_dem');
    expect(pop.label).toBe('인구 (명/km²)');
    expect(pop.hidden).toBe(false);
    expect(dem.hidden).toBe(true);
  });

  it('조회 불가한 가시성 엔트리는 스킵한다(방어)', () => {
    const doc = docWithLayers();
    setLayerVisible(doc, 'page_1', 'src_1', 'L_ghost', true); // egis에 없는 레이어
    const items = buildLegendItems(doc, getPage(doc, 'page_1'));
    expect(items.map((i) => i.key)).toEqual(['src_1:L_pop', 'src_1:L_dem']);
  });

  it('page가 없으면 빈 배열', () => {
    const doc = docWithLayers();
    expect(buildLegendItems(doc, null)).toEqual([]);
  });
});
