// © 2026 김용현
// @vitest-environment jsdom
/**
 * 자동 저장 복원이 레이어 모양을 바꾸지 않는지 검증.
 *
 * 버그: 새로고침 후 복원하면 손대지 않은 포인트 레이어가
 *   "불투명 원색 + 흰 테두리" → "30% 투명 + 같은 색 테두리" 로 바뀐다.
 *
 * 뿌리는 스타일 생성 경로가 둘이고 서로 다른 모양을 낸다는 것:
 *   - createStyle (LayerManager.js:66-73)      포인트: 불투명 fill, 흰 stroke
 *   - updateLayerStyle (LayerManager.js:653-661) 포인트: rgba(색, fillOpacity), 색 stroke
 * addLayer가 심는 메타데이터(fillOpacity: 0.3, strokeColor: 색)가 포인트의 실제
 * 렌더링을 설명하지 못하기 때문이다.
 *
 * ProjectManager(.egis)는 이 함정을 알고 손대지 않은 레이어에는 updateLayerStyle을
 * 부르지 않도록 가드한다(ProjectManager.js:287-293). AutoSaveManager에는 그 가드가 없다.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import Feature from 'ol/Feature.js';
import Point from 'ol/geom/Point.js';
import GeoJSON from 'ol/format/GeoJSON.js';

// StateManager는 생성자에서 indexedDB.open을 부른다(StateManager.js:26). jsdom에는 없으므로
// import 전에 스텁을 심는다. 이 테스트는 restoreLayer의 스타일 처리만 보므로 DB는 쓰지 않는다.
globalThis.indexedDB = {
  open: () => ({ onerror: null, onsuccess: null, onupgradeneeded: null })
};

// OL Heatmap 생성자는 그라디언트를 굽느라 canvas 2D 컨텍스트를 쓴다(ol/layer/Heatmap.js:252).
// jsdom은 getContext를 구현하지 않으므로 최소 스텁을 심는다. 픽셀 값 자체는 검사하지 않고
// Heatmap 레이어가 만들어졌는지(getBlur/getRadius)만 보므로 이걸로 충분하다.
HTMLCanvasElement.prototype.getContext = function () {
  return {
    canvas: this,
    createLinearGradient: () => ({ addColorStop: () => {} }),
    fillRect: () => {},
    getImageData: (x, y, w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }),
    set fillStyle(_v) {},
    get fillStyle() { return '#000'; }
  };
};

const { layerManager, STYLE_FIELDS, pickStyleFields } = await import('./LayerManager.js');
const { autoSaveManager } = await import('./AutoSaveManager.js');

const COLOR = '#ff0000';

/** 렌더링에 실제로 영향을 주는 값만 뽑는다 (색 표기 차이는 정규화) */
function pointLook(style) {
  const img = style.getImage();
  const norm = (c) => {
    if (typeof c !== 'string') return c;
    // #rrggbb → rgba(r, g, b, 1) 로 통일해 표기 차이를 무시한다
    const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(c);
    if (!m) return c;
    const [r, g, b] = m.slice(1).map(h => parseInt(h, 16));
    return `rgba(${r}, ${g}, ${b}, 1)`;
  };
  return {
    fill: norm(img.getFill().getColor()),
    stroke: norm(img.getStroke().getColor()),
    strokeWidth: img.getStroke().getWidth(),
    radius: img.getRadius()
  };
}

/** StateManager.saveLayer(LayerManager.js:200-218) 가 만드는 레코드 형태를 흉내낸다 */
function serializeLike(layerInfo) {
  const geoJSON = new GeoJSON();
  return {
    id: layerInfo.id + '-restored',
    name: layerInfo.name,
    type: layerInfo.type,
    geometryType: layerInfo.geometryType,
    color: layerInfo.color,
    ...pickStyleFields(layerInfo),
    visible: layerInfo.visible,
    features: geoJSON.writeFeaturesObject(layerInfo.source.getFeatures())
  };
}

describe('AutoSaveManager.restoreLayer — 스타일 보존', () => {
  beforeEach(() => {
    layerManager.getAllLayers().slice().forEach(l => layerManager.removeLayer(l.id));
  });

  it('손대지 않은 포인트 레이어는 복원해도 모양이 같아야 한다', async () => {
    const originalId = layerManager.addLayer({
      name: '관측소',
      features: [new Feature({ geometry: new Point([0, 0]) })],
      color: COLOR
    });
    const original = layerManager.getLayer(originalId);
    const expected = pointLook(original.olLayer.getStyle());

    const restoredId = await autoSaveManager.restoreLayer(serializeLike(original));
    const restored = layerManager.getLayer(restoredId);

    expect(pointLook(restored.olLayer.getStyle())).toEqual(expected);
  });

  it('히트맵은 히트맵으로 복원되어야 한다 (포인트로 떨어지지 않게)', async () => {
    const geoJSON = new GeoJSON();
    const layerData = {
      id: 'heatmap-restore-test',
      name: '강수량 히트맵',
      type: 'heatmap',
      geometryType: 'Point',
      visible: true,
      features: geoJSON.writeFeaturesObject([
        new Feature({ geometry: new Point([0, 0]) }),
        new Feature({ geometry: new Point([100, 100]) })
      ]),
      heatmapConfig: {
        sourceLayerId: null,
        blur: 22,
        radius: 14,
        weight: null,
        gradient: ['#0000ff', '#ff0000'],
        hideSource: false
      }
    };

    const id = await autoSaveManager.restoreLayer(layerData);
    const info = layerManager.getLayer(id);

    expect(info.type).toBe('heatmap');
    // OL Heatmap 레이어여야 한다. 평범한 VectorLayer로 오면 점만 찍힌다.
    expect(typeof info.olLayer.getBlur).toBe('function');
    expect(info.olLayer.getBlur()).toBe(22);
    expect(info.olLayer.getRadius()).toBe(14);
  });

  it('사용자가 바꾼 스타일은 복원 시 반영되어야 한다', async () => {
    const originalId = layerManager.addLayer({
      name: '관측소',
      features: [new Feature({ geometry: new Point([0, 0]) })],
      color: COLOR
    });
    const original = layerManager.getLayer(originalId);

    // 사용자가 레이어 패널에서 반경과 채우기 투명도를 바꾼 상황
    original.pointRadius = 12;
    original.fillOpacity = 0.5;
    layerManager.updateLayerStyle(originalId);
    const expected = pointLook(original.olLayer.getStyle());

    const restoredId = await autoSaveManager.restoreLayer(serializeLike(original));
    const restored = layerManager.getLayer(restoredId);

    const actual = pointLook(restored.olLayer.getStyle());
    expect(actual).toEqual(expected);
    expect(actual.radius).toBe(12);
  });

  it('strokeSyncToFill이 복원 후에도 유지된다', async () => {
    const originalId = layerManager.addLayer({
      name: '동기화 해제 레이어',
      features: [new Feature({ geometry: new Point([0, 0]) })],
      color: COLOR
    });
    const original = layerManager.getLayer(originalId);

    // 기본값은 true여야 한다
    expect(original.strokeSyncToFill).toBe(true);

    // 사용자가 동기화를 끈다
    original.strokeSyncToFill = false;

    const restoredId = await autoSaveManager.restoreLayer(serializeLike(original));
    expect(layerManager.getLayer(restoredId).strokeSyncToFill).toBe(false);
  });
});

describe('pickStyleFields', () => {
  it('STYLE_FIELDS의 모든 필드를 빠짐없이 담는다', () => {
    const id = layerManager.addLayer({
      name: '필드 확인용',
      features: [new Feature({ geometry: new Point([0, 0]) })],
      color: COLOR
    });
    const picked = pickStyleFields(layerManager.getLayer(id));
    expect(Object.keys(picked).sort()).toEqual([...STYLE_FIELDS].sort());
  });
});
