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
  renderParamForm, collectParams, renderPreview, toFeatures, addPointLayer
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
});

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
