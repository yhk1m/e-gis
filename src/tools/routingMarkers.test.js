// © 2026 김용현
// @vitest-environment jsdom
/**
 * 최단경로의 출발·도착 표시는 경로 레이어의 일부여야 한다.
 *
 * 예전에는 지도에 직접 얹은 별도 레이어(zIndex 1001)라서
 *  - 레이어 순서를 아무리 바꿔도 항상 맨 위에 떠 있었고
 *  - 새로고침하면 사라졌다 (LayerManager 밖이라 저장되지 않는다)
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { routingTool } from './RoutingTool.js';
import { layerManager } from '../core/LayerManager.js';
import { mapManager } from '../core/MapManager.js';

/** displayRoute가 지도(fit/addLayer)를 만지므로 최소한의 가짜 지도를 세운다 */
function stubMap() {
  const added = [];
  mapManager.map = {
    addLayer: (l) => added.push(l),
    removeLayer: (l) => {
      const i = added.indexOf(l);
      if (i >= 0) added.splice(i, 1);
    },
    getView: () => ({ fit() {} }),
    getLayers: () => ({ getArray: () => added.slice() }),
    getTargetElement: () => ({ style: {} }),
    on() {}, un() {}
  };
  return added;
}

const lonLat = (lon, lat) => ({ lonLat: [lon, lat], coordinate: [lon * 111319, lat * 111319] });

const ROUTE_GEOJSON = {
  type: 'FeatureCollection',
  features: [{
    type: 'Feature',
    properties: { summary: { distance: 8200, duration: 1200 } },
    geometry: { type: 'LineString', coordinates: [[126.98, 37.56], [127.02, 37.54], [127.06, 37.51]] }
  }]
};

describe('최단경로 마커', () => {
  let mapLayers;

  beforeEach(() => {
    mapLayers = stubMap();
    layerManager.getAllLayers().slice().forEach(l => layerManager.removeLayer(l.id));
    routingTool.clear();
    routingTool.startPoint = lonLat(126.98, 37.56);
    routingTool.endPoint = lonLat(127.06, 37.51);
    routingTool.waypoints = [];
  });

  it('출발·경유·도착 마커를 속성과 함께 만든다', () => {
    routingTool.waypoints = [lonLat(127.02, 37.54)];

    const markers = routingTool.buildMarkerFeatures();

    expect(markers.map(f => f.get('routeMarker'))).toEqual(['start', 'waypoint', 'end']);
    expect(markers.map(f => f.get('markerLabel'))).toEqual(['S', '1', 'E']);
    expect(markers.every(f => !!f.getStyle())).toBe(true);
  });

  it('경로 레이어에 마커가 함께 들어간다', () => {
    routingTool.displayRoute(ROUTE_GEOJSON, '도보');

    const layer = layerManager.getLayer(routingTool.routeLayerId);
    const kinds = layer.source.getFeatures().map(f => f.get('routeMarker') || 'route');
    expect(kinds).toContain('start');
    expect(kinds).toContain('end');
    expect(kinds).toContain('route');
  });

  it('지도에 마커 전용 레이어를 따로 남기지 않는다 (항상 맨 위에 뜨던 원인)', () => {
    routingTool.updateMarkers();          // 지점 선택 중에는 임시 마커가 있다
    expect(routingTool.markersLayer).not.toBeNull();

    routingTool.displayRoute(ROUTE_GEOJSON, '도보');

    expect(routingTool.markersLayer).toBeNull();
    // 지도에 남은 건 LayerManager가 관리하는 경로 레이어뿐이어야 한다
    const managed = layerManager.getAllLayers().map(l => l.olLayer);
    expect(mapLayers.every(l => managed.includes(l))).toBe(true);
  });

  it('레이어 순서를 바꾸면 마커도 같이 따라간다 (같은 레이어라서)', () => {
    const other = layerManager.addLayer({ name: '다른 레이어', geometryType: 'Polygon' });
    routingTool.displayRoute(ROUTE_GEOJSON, '도보');
    const routeId = routingTool.routeLayerId;

    layerManager.reorderLayers([routeId, other]);   // 경로를 아래로

    expect(layerManager.getLayer(routeId).olLayer.getZIndex())
      .toBeLessThan(layerManager.getLayer(other).olLayer.getZIndex());
  });

  it('복원된 피처(스타일 없음)에 마커 스타일을 다시 입힌다 — 새로고침해도 표시가 남는다', () => {
    routingTool.displayRoute(ROUTE_GEOJSON, '도보');
    const layer = layerManager.getLayer(routingTool.routeLayerId);
    const markers = layer.source.getFeatures().filter(f => f.get('routeMarker'));
    markers.forEach(f => f.setStyle(null));         // 저장→복원 상태를 흉내

    routingTool.applyMarkerStyles(layer);

    expect(markers.every(f => !!f.getStyle())).toBe(true);
  });

  it('마커가 아닌 피처(경로 선)는 건드리지 않는다', () => {
    routingTool.displayRoute(ROUTE_GEOJSON, '도보');
    const layer = layerManager.getLayer(routingTool.routeLayerId);

    routingTool.applyMarkerStyles(layer);

    const line = layer.source.getFeatures().find(f => !f.get('routeMarker'));
    expect(line.getStyle()).toBeFalsy();   // 레이어 스타일(선 색·두께)이 그대로 적용되어야 한다
  });
});
