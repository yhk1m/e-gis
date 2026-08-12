// © 2026 김용현
// @vitest-environment jsdom
/**
 * 공공데이터 불러오기 — 파라미터 폼 · 미리보기 · 포인트 레이어 생성.
 *
 * 좌표계 변환이 여기 있다. 포털은 위경도로도 주고 TM 좌표로도 주는데,
 * 지도는 EPSG:3857이므로 어느 쪽이든 맞게 바꿔야 한다.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { fromLonLat } from 'ol/proj.js';
import { layerManager } from '../../core/LayerManager.js';
import { coordinateSystem } from '../../core/CoordinateSystem.js';
import {
  renderParamForm, collectParams, renderPreview, toFeatures, addPointLayer,
  addGridLayer, addHeatmapLayer, GRID_CELL_LIMIT
} from './publicDataLoad.js';

coordinateSystem.init();   // proj4에 한국 좌표계를 등록해 둔다

const ENTRY = {
  id: 'ev-charger',
  name: '전기차 충전소',
  params: [
    { key: 'sido', label: '시도', type: 'select', required: true,
      options: [{ value: '11', label: '서울' }, { value: '41', label: '경기' }] },
    { key: 'keyword', label: '검색어', type: 'text', required: false }
  ]
};

const RESULT = {
  items: [
    { lon: 127.0, lat: 37.5, props: { statNm: '가', chgerType: '급속' } },
    { lon: 127.1, lat: 37.6, props: { statNm: '나', chgerType: '완속' } }
  ],
  count: 2, skipped: 1, epsg: 4326
};

beforeEach(() => {
  layerManager.getAllLayers().slice().forEach(l => layerManager.removeLayer(l.id));
  // 범례가 지도 컨테이너를 찾는다
  if (!document.getElementById('map')) {
    const map = document.createElement('div');
    map.id = 'map';
    document.body.appendChild(map);
  }
});

/** 서울 부근에 격자 여러 칸에 걸치도록 흩어 놓은 점들 */
function spreadResult(count = 30) {
  const items = Array.from({ length: count }, (_, i) => ({
    lon: 126.9 + (i % 6) * 0.05,
    lat: 37.45 + Math.floor(i / 6) * 0.04,
    props: { statNm: `충전소${i}`, output: 50 + i }
  }));
  return { items, count: items.length, skipped: 0, epsg: 4326 };
}

describe('renderParamForm', () => {
  it('선택 항목을 드롭다운으로 만든다', () => {
    const html = renderParamForm(ENTRY);

    expect(html).toContain('시도');
    expect(html).toContain('value="11"');
    expect(html).toContain('서울');
    expect(html).toContain('경기');
  });

  it('선택 항목이 아니면 입력칸으로 만든다', () => {
    expect(renderParamForm(ENTRY)).toContain('type="text"');
  });

  it('파라미터가 없는 항목은 빈 문자열', () => {
    expect(renderParamForm({ id: 'x', params: [] })).toBe('');
  });
});

describe('collectParams', () => {
  it('화면에서 고른 값을 모은다', () => {
    const root = document.createElement('div');
    root.innerHTML = renderParamForm(ENTRY);
    root.querySelector('[data-param="sido"]').value = '41';
    root.querySelector('[data-param="keyword"]').value = '   급속  ';

    expect(collectParams(root, ENTRY)).toEqual({ sido: '41', keyword: '급속' });
  });

  it('비어 있는 값은 넣지 않는다', () => {
    const root = document.createElement('div');
    root.innerHTML = renderParamForm(ENTRY);
    root.querySelector('[data-param="sido"]').value = '11';

    expect(collectParams(root, ENTRY)).toEqual({ sido: '11' });
  });
});

describe('renderPreview', () => {
  it('건수와 제외 건수를 보여준다', () => {
    const html = renderPreview(RESULT, ENTRY);

    expect(html).toContain('2');
    expect(html).toContain('1');   // 좌표 없어 제외된 건수
  });

  it('제외된 게 없으면 그 문구는 넣지 않는다', () => {
    const html = renderPreview({ ...RESULT, skipped: 0 }, ENTRY);

    expect(html).not.toContain('제외');
  });

  it('상위 5행까지만 표로 보여준다', () => {
    const many = { ...RESULT, count: 9, items: Array.from({ length: 9 }, (_, i) => ({
      lon: 127, lat: 37, props: { statNm: `충전소${i}` }
    })) };

    const html = renderPreview(many, ENTRY);

    expect(html).toContain('충전소4');
    expect(html).not.toContain('충전소5');
  });

  it('결과가 없으면 안내만 준다', () => {
    const html = renderPreview({ items: [], count: 0, skipped: 0, epsg: 4326 }, ENTRY);

    expect(html).toContain('없습니다');
  });
});

describe('toFeatures — 좌표 변환', () => {
  it('위경도(4326)는 웹메르카토르로 바꾼다', () => {
    const features = toFeatures(RESULT.items, 4326);

    expect(features).toHaveLength(2);
    expect(features[0].getGeometry().getCoordinates()).toEqual(fromLonLat([127.0, 37.5]));
  });

  it('TM 좌표(5186)도 웹메르카토르로 바꾼다', () => {
    // 중부원점 TM의 원점 부근 — 변환 결과가 한국 경도대(126~128도)에 들어와야 한다
    const features = toFeatures([{ lon: 200000, lat: 500000, props: {} }], 5186);
    const [x] = features[0].getGeometry().getCoordinates();
    const lon = (x / 20037508.34) * 180;

    expect(lon).toBeGreaterThan(124);
    expect(lon).toBeLessThan(130);
  });

  it('속성을 피처에 그대로 싣는다', () => {
    const features = toFeatures(RESULT.items, 4326);

    expect(features[0].get('statNm')).toBe('가');
    expect(features[0].get('chgerType')).toBe('급속');
  });

  it('변환할 수 없는 좌표계면 그 점을 건너뛴다', () => {
    const features = toFeatures([{ lon: 1, lat: 1, props: {} }], 99999);

    expect(features).toHaveLength(0);
  });
});

describe('addPointLayer', () => {
  it('포인트 레이어를 만들고 이름을 붙인다', () => {
    const layerId = addPointLayer('전기차 충전소 (서울)', RESULT);
    const info = layerManager.getLayer(layerId);

    expect(info.name).toBe('전기차 충전소 (서울)');
    expect(info.geometryType).toBe('Point');
    expect(info.source.getFeatures()).toHaveLength(2);
  });

  it('속성 테이블에서 쓸 수 있게 속성이 들어간다', () => {
    const layerId = addPointLayer('충전소', RESULT);
    const feature = layerManager.getLayer(layerId).source.getFeatures()[0];

    expect(feature.get('statNm')).toBe('가');
  });

  it('만들 피처가 없으면 예외를 던진다 (빈 레이어를 만들지 않는다)', () => {
    expect(() => addPointLayer('빈것', { items: [], count: 0, skipped: 0, epsg: 4326 }))
      .toThrow();
  });
});

describe('addGridLayer — 격자 집계 레이어', () => {
  it('격자 폴리곤 레이어를 만든다', () => {
    const layerId = addGridLayer('충전소 격자', spreadResult(), { cellSize: 5000, method: 'count' });
    const info = layerManager.getLayer(layerId);

    expect(info.geometryType).toBe('Polygon');
    expect(info.source.getFeatures().length).toBeGreaterThan(0);
  });

  it('칸마다 개수와 집계값을 속성으로 넣는다', () => {
    const layerId = addGridLayer('격자', spreadResult(), { cellSize: 20000, method: 'count' });
    const feature = layerManager.getLayer(layerId).source.getFeatures()[0];

    expect(feature.get('개수')).toBeGreaterThan(0);
    expect(feature.get('값')).toBe(feature.get('개수'));
  });

  it('셀을 크게 잡으면 칸 수가 줄어든다', () => {
    const fine = addGridLayer('촘촘', spreadResult(), { cellSize: 2000, method: 'count' });
    const coarse = addGridLayer('성김', spreadResult(), { cellSize: 30000, method: 'count' });

    const fineCount = layerManager.getLayer(fine).source.getFeatures().length;
    const coarseCount = layerManager.getLayer(coarse).source.getFeatures().length;
    expect(coarseCount).toBeLessThan(fineCount);
  });

  it('합계·평균은 지정한 필드로 낸다', () => {
    const layerId = addGridLayer('합계', spreadResult(6), {
      cellSize: 50000, method: 'sum', field: 'output'
    });
    const features = layerManager.getLayer(layerId).source.getFeatures();

    // 칸이 어떻게 나뉘든 전체 합은 보존된다 (output 50..55)
    const total = features.reduce((sum, f) => sum + f.get('값'), 0);
    expect(total).toBe(50 + 51 + 52 + 53 + 54 + 55);
  });

  it('단계구분도 설정이 붙어 저장·복원에서 색이 유지된다', () => {
    const layerId = addGridLayer('격자', spreadResult(), { cellSize: 5000, method: 'count' });

    expect(layerManager.getLayer(layerId)._choroplethConfig).toBeTruthy();
  });

  it('칸이 너무 많으면 만들지 않고 알려준다', () => {
    const wide = { items: [
      { lon: 124, lat: 33, props: {} },
      { lon: 132, lat: 39, props: {} }
    ], count: 2, skipped: 0, epsg: 4326 };

    expect(() => addGridLayer('너무촘촘', wide, { cellSize: 100, method: 'count' }))
      .toThrow(new RegExp(String(GRID_CELL_LIMIT).slice(0, 2)));
  });

  it('만들 점이 없으면 예외를 던진다', () => {
    expect(() => addGridLayer('빈것', { items: [], count: 0, skipped: 0, epsg: 4326 },
      { cellSize: 1000, method: 'count' })).toThrow();
  });
});

// 히트맵은 OpenLayers가 캔버스 그라디언트를 만들어야 해서 jsdom에서는 생성되지 않는다.
// 실제 동작은 브라우저에서 확인한다. 여기서는 인자 규약만 지킨다.
describe('addHeatmapLayer', () => {
  it('원본 포인트 레이어를 먼저 만든다', () => {
    try { addHeatmapLayer('충전소 히트맵', spreadResult()); } catch (e) { /* 캔버스 없음 */ }

    const source = layerManager.getAllLayers().find(l => l.geometryType === 'Point');
    expect(source).toBeTruthy();
    expect(source.name).toContain('충전소 히트맵');
  });
});
