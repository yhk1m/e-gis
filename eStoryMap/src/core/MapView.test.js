// © 2026 김용현
import { describe, it, expect } from 'vitest';
import { MapView } from './MapView.js';
import { buildVectorLayer } from './egisLayers.js';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';

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
