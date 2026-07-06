// © 2026 김용현
import { describe, it, expect } from 'vitest';
import { MapView, unionExtent } from './MapView.js';
import { buildVectorLayer } from './egisLayers.js';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import ImageLayer from 'ol/layer/Image';
import Feature from 'ol/Feature';
import Point from 'ol/geom/Point';
import { isEmpty } from 'ol/extent';

const EGIS_LAYER_DATA = {
  id: 'L_a', name: '인구', type: 'vector', geometryType: 'Polygon',
  visible: true, color: '#ef4444', opacity: 1,
  features: { type: 'FeatureCollection', features: [] },
};

describe('MapView.clearEgisLayers', () => {
  it('egisLayerId가 있는 레이어만 제거한다(베이스맵·기타 레이어는 유지)', () => {
    const mv = new MapView('nonexistent-target');
    const egisLayer = buildVectorLayer(EGIS_LAYER_DATA);
    const plainLayer = new VectorLayer({ source: new VectorSource() });
    mv.addLayer(egisLayer);
    mv.addLayer(plainLayer);

    mv.clearEgisLayers();

    const remaining = mv.map.getLayers().getArray();
    expect(remaining).toContain(mv.baseLayer);
    expect(remaining).toContain(plainLayer);
    expect(remaining).not.toContain(egisLayer);
  });

  it('egis 레이어가 여러 개여도 전부 제거한다', () => {
    const mv = new MapView('nonexistent-target');
    mv.addLayer(buildVectorLayer(EGIS_LAYER_DATA));
    mv.addLayer(buildVectorLayer({ ...EGIS_LAYER_DATA, id: 'L_b' }));

    mv.clearEgisLayers();

    const ids = mv.map.getLayers().getArray().filter((l) => l.get('egisLayerId'));
    expect(ids).toHaveLength(0);
  });
});

describe('unionExtent', () => {
  it('벡터 소스 extent와 ImageLayer 명시 extent를 합친다', () => {
    const vec = new VectorLayer({
      source: new VectorSource({ features: [new Feature(new Point([10, 20]))] }),
    });
    const img = new ImageLayer({ extent: [0, 0, 5, 5] });
    expect(unionExtent([vec, img])).toEqual([0, 0, 10, 20]);
  });

  it('빈 배열이면 empty extent', () => {
    expect(isEmpty(unionExtent([]))).toBe(true);
  });
});

describe('MapView.getCamera', () => {
  it('setView한 카메라를 4326 경위도로 돌려준다(라운드트립)', () => {
    const mv = new MapView('nonexistent-target');
    mv.setView([129.05, 35.15], 11);
    const cam = mv.getCamera();
    expect(cam.zoom).toBe(11);
    expect(cam.center[0]).toBeCloseTo(129.05, 6);
    expect(cam.center[1]).toBeCloseTo(35.15, 6);
  });

  it('호출마다 새 배열을 반환한다(외부 변이 안전)', () => {
    const mv = new MapView('nonexistent-target');
    mv.setView([127, 37], 8);
    expect(mv.getCamera().center).not.toBe(mv.getCamera().center);
  });
});

describe('MapView 줌 정규화(캔버스 폭 무관 같은 extent)', () => {
  it('정규화↔역정규화는 같은 폭에서 라운드트립한다', () => {
    const mv = new MapView('nonexistent-target');
    mv.mapWidth = () => 1200;
    expect(mv.toRawZoom(mv.toNormZoom(10))).toBeCloseTo(10, 10);
  });
  it('참조 폭 절반(960)에선 저장 줌이 +1 (같은 범위 유지 위해)', () => {
    const mv = new MapView('nonexistent-target');
    mv.mapWidth = () => 960; // REF_WIDTH 1920의 절반 → log2(1920/960)=1
    expect(mv.toNormZoom(10)).toBeCloseTo(11, 6); // 실제 줌 10 → 저장 11
    expect(mv.toRawZoom(11)).toBeCloseTo(10, 6); // 저장 11 → 이 캔버스선 실제 10
  });
});
