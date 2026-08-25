// © 2026 김용현
// @vitest-environment jsdom
/**
 * 피처 합치기 되돌리기 / 다시 실행.
 *
 * 합치기는 사용자에게 한 동작이므로 되돌리기도 한 번이어야 한다.
 * FEATURE_CREATED + N×FEATURE_DELETED 로 쪼개면 되돌리는 도중에
 * 합친 도형과 되살아난 원본이 같은 자리에 겹쳐 보인다.
 *
 * 지도(MapManager) 없이 돌린다 — layerManager·featureEditTool 모두 map 이 없으면
 * 지도에 붙이는 단계만 건너뛰고 나머지는 그대로 동작한다.
 * 선택은 실제 OL Collection 을 selectTool 에 심어 흉내 낸다. 그래야 mergeSelected 의
 * 레이어 분기(같은 레이어 / 여러 레이어)까지 진짜 코드로 통과한다.
 */
import { describe, it, expect, beforeEach, beforeAll } from 'vitest';
import Feature from 'ol/Feature.js';
import Polygon from 'ol/geom/Polygon.js';
import Collection from 'ol/Collection.js';
import { eventBus, Events } from '../utils/EventBus.js';
import { layerManager } from './LayerManager.js';
import { historyManager } from './HistoryManager.js';
import { featureEditTool } from '../tools/FeatureEditTool.js';
import { selectTool } from '../tools/SelectTool.js';

/** EPSG:3857 좌표계의 맞닿은 정사각형 (합치면 하나의 폴리곤이 된다) */
function square(x0, props) {
  const f = new Feature({
    geometry: new Polygon([[
      [x0, 0], [x0 + 1000, 0], [x0 + 1000, 1000], [x0, 1000], [x0, 0]
    ]])
  });
  f.setProperties(props);
  return f;
}

const extentOf = (f) => f.getGeometry().getExtent();

function expectExtentClose(actual, expected) {
  actual.forEach((v, i) => expect(v).toBeCloseTo(expected[i], 3));
}

/** 선택 도구는 지도 없이 초기화되지 않으므로 컬렉션만 직접 심는다 */
function select(features) {
  selectTool.selectedFeatures = new Collection(features);
}

describe('합치기 되돌리기', () => {
  // init() 은 리스너를 등록만 하므로 여러 번 부르면 액션이 중복으로 쌓인다.
  // 테스트 파일마다 모듈이 새로 로드되므로(vitest 기본 isolate) 파일당 한 번이면 된다.
  beforeAll(() => {
    historyManager.init();
  });

  beforeEach(() => {
    layerManager.getAllLayers().slice().forEach((l) => layerManager.removeLayer(l.id));
    historyManager.clear();
    select([]);
  });

  describe('같은 레이어 안에서 합쳤을 때', () => {
    let layerId;
    let before;

    beforeEach(() => {
      const a = square(0, { 시군구: '강남구', 인구: 530000 });
      const b = square(1000, { 시군구: '서초구', 인구: 410000 });
      layerId = layerManager.addLayer({ name: '시군구', features: [a, b] });
      before = {
        extents: [extentOf(a), extentOf(b)],
        uids: [a.ol_uid, b.ol_uid]
      };

      select([a, b]);
      featureEditTool.mergeSelected();
    });

    const featuresNow = () => layerManager.getLayer(layerId).source.getFeatures();

    it('합친 직후에는 피처가 1개다 (전제 확인)', () => {
      expect(featuresNow()).toHaveLength(1);
      expect(featuresNow()[0].get('인구')).toBe(940000);
    });

    it('되돌리면 원본 2개가 도형·속성 그대로 살아난다', () => {
      historyManager.undo();

      const features = featuresNow();
      expect(features).toHaveLength(2);

      const byName = Object.fromEntries(features.map((f) => [f.get('시군구'), f]));
      expect(Object.keys(byName).sort()).toEqual(['강남구', '서초구']);
      expect(byName['강남구'].get('인구')).toBe(530000);
      expect(byName['서초구'].get('인구')).toBe(410000);

      expectExtentClose(extentOf(byName['강남구']), before.extents[0]);
      expectExtentClose(extentOf(byName['서초구']), before.extents[1]);

      // ol_uid 도 원래 값으로 되살린다 (delete 되돌리기와 같은 방식)
      expect(features.map((f) => f.ol_uid).sort()).toEqual(before.uids.slice().sort());
    });

    it('되돌리면 합친 피처는 사라진다', () => {
      historyManager.undo();

      const merged = featuresNow().filter((f) => f.get('인구') === 940000);
      expect(merged).toEqual([]);
    });

    it('되돌리기 한 번이면 된다 (액션이 1개만 쌓인다)', () => {
      expect(historyManager.undoStack).toHaveLength(1);
      expect(historyManager.undoStack[0].type).toBe('merge');

      historyManager.undo();
      expect(historyManager.canUndo()).toBe(false);
    });

    it('되돌리면 합친 피처가 선택에서도 빠진다 (겹친 유령 방지)', () => {
      // 선택에 남아 있으면 Select 인터랙션이 제 오버레이에 그려 버린다 —
      // 되살아난 원본 위에 합친 도형이 겹쳐 보이는 것이 이 기능이 막으려는 바로 그 화면이다
      expect(selectTool.getSelectedFeatures()).toHaveLength(1); // 합친 결과가 선택돼 있다

      historyManager.undo();

      const stillInLayer = (f) => featuresNow().some((x) => x.ol_uid === f.ol_uid);
      expect(selectTool.getSelectedFeatures().filter((f) => !stillInLayer(f))).toEqual([]);
    });

    it('되돌린 뒤에도 레이어는 사라지지 않는다', () => {
      // 합친 피처를 빼는 순간 피처가 0개가 되지만, create 되돌리기와 달리 레이어를 지우면 안 된다
      historyManager.undo();

      const layer = layerManager.getLayer(layerId);
      expect(layer).toBeTruthy();
      expect(layer.featureCount).toBe(2);
    });

    it('다시 실행하면 합친 상태로 정확히 돌아간다', () => {
      historyManager.undo();
      expect(featuresNow()).toHaveLength(2); // 되돌리기가 실제로 먹었는지 먼저 확인

      historyManager.redo();

      const features = featuresNow();
      expect(features).toHaveLength(1);
      expect(features[0].get('시군구')).toBe('강남구');
      expect(features[0].get('인구')).toBe(940000);
      expectExtentClose(extentOf(features[0]), [0, 0, 2000, 1000]);
      expect(layerManager.getLayer(layerId).featureCount).toBe(1);
    });

    it('되돌리기·다시 실행을 반복해도 피처가 늘거나 줄지 않는다', () => {
      historyManager.undo();
      historyManager.redo();
      historyManager.undo();
      expect(featuresNow()).toHaveLength(2);

      historyManager.redo();
      expect(featuresNow()).toHaveLength(1);
    });
  });

  describe('다른 레이어끼리 합쳤을 때', () => {
    let leftId;
    let rightId;
    let mergedLayer;

    beforeEach(() => {
      const a = square(0, { 시군구: '강남구', 인구: 530000 });
      const b = square(1000, { 시군구: '서초구', 인구: 410000 });
      leftId = layerManager.addLayer({ name: '왼쪽', features: [a] });
      rightId = layerManager.addLayer({ name: '오른쪽', features: [b] });

      select([a, b]);
      featureEditTool.mergeSelected();

      mergedLayer = layerManager.getAllLayers().find((l) => l.id !== leftId && l.id !== rightId);
    });

    it('합친 직후에는 원본 2개 레이어가 그대로이고 새 레이어가 하나 는다 (전제 확인)', () => {
      expect(layerManager.getAllLayers()).toHaveLength(3);
      expect(mergedLayer.name).toBe('왼쪽 + 오른쪽 병합');
      expect(mergedLayer.source.getFeatures()).toHaveLength(1);
      // 원본이 지도에 남아 있으므로 색이 겹치면 안 된다 (흰색도 안 된다)
      expect(mergedLayer.color).not.toBe('#ffffff');
      expect(mergedLayer.color).not.toBe(layerManager.getLayer(leftId).color);
      expect(mergedLayer.color).not.toBe(layerManager.getLayer(rightId).color);
    });

    it('되돌리면 새 레이어만 사라지고 원본 레이어는 그대로다', () => {
      historyManager.undo();

      expect(layerManager.getLayer(mergedLayer.id)).toBeUndefined();
      expect(layerManager.getAllLayers()).toHaveLength(2);

      const left = layerManager.getLayer(leftId);
      const right = layerManager.getLayer(rightId);
      expect(left.source.getFeatures()).toHaveLength(1);
      expect(right.source.getFeatures()).toHaveLength(1);
      expect(left.source.getFeatures()[0].get('시군구')).toBe('강남구');
      expect(right.source.getFeatures()[0].get('시군구')).toBe('서초구');
    });

    it('되돌리기 한 번이면 된다 (액션이 1개만 쌓인다)', () => {
      expect(historyManager.undoStack).toHaveLength(1);

      historyManager.undo();
      expect(historyManager.canUndo()).toBe(false);
    });

    it('다시 실행하면 같은 이름·색으로 레이어가 되살아난다', () => {
      const name = mergedLayer.name;
      const color = mergedLayer.color;

      historyManager.undo();
      expect(layerManager.getAllLayers()).toHaveLength(2); // 되돌리기가 실제로 먹었는지 먼저 확인

      historyManager.redo();

      expect(layerManager.getAllLayers()).toHaveLength(3);
      const revived = layerManager.getAllLayers().find((l) => l.id !== leftId && l.id !== rightId);
      expect(revived.name).toBe(name);
      expect(revived.color).toBe(color);
      expect(revived.source.getFeatures()).toHaveLength(1);
      expect(revived.source.getFeatures()[0].get('인구')).toBe(940000);
    });

    it('다시 실행한 레이어도 한 번 더 되돌릴 수 있다 (새 레이어 id 를 따라간다)', () => {
      historyManager.undo();
      historyManager.redo();
      historyManager.undo();

      expect(layerManager.getAllLayers()).toHaveLength(2);
    });
  });

  it('합치기를 두 번 하면 되돌리기도 두 번, 각각 제 상태로 돌아간다', () => {
    const a = square(0, { 이름: 'A' });
    const b = square(1000, { 이름: 'B' });
    const c = square(2000, { 이름: 'C' });
    const layerId = layerManager.addLayer({ name: '셋', features: [a, b, c] });
    const source = layerManager.getLayer(layerId).source;

    select([a, b]);
    featureEditTool.mergeSelected();
    expect(source.getFeatures()).toHaveLength(2);

    const merged1 = source.getFeatures().find((f) => f !== c);
    select([merged1, c]);
    featureEditTool.mergeSelected();
    expect(source.getFeatures()).toHaveLength(1);

    expect(historyManager.undoStack).toHaveLength(2);

    historyManager.undo();
    expect(source.getFeatures()).toHaveLength(2);

    historyManager.undo();
    expect(source.getFeatures()).toHaveLength(3);
    expect(source.getFeatures().map((f) => f.get('이름')).sort()).toEqual(['A', 'B', 'C']);
  });

  it('새 액션을 쌓으면 다시 실행 스택이 비워진다', () => {
    const a = square(0, { 이름: 'A' });
    const b = square(1000, { 이름: 'B' });
    const layerId = layerManager.addLayer({ name: '둘', features: [a, b] });

    select([a, b]);
    featureEditTool.mergeSelected();
    historyManager.undo();
    expect(historyManager.canRedo()).toBe(true);

    // 되돌린 뒤 다시 합치면 옛 다시 실행 기록은 의미가 없다
    const features = layerManager.getLayer(layerId).source.getFeatures();
    select(features);
    featureEditTool.mergeSelected();

    expect(historyManager.canRedo()).toBe(false);
    expect(historyManager.undoStack).toHaveLength(1);
  });

  it('되돌리기·다시 실행도 합치기 이벤트를 다시 쏜다 (열린 속성 테이블 갱신용)', () => {
    // 되돌리기는 LAYER_ADDED 만 쏘는데 그건 레이어 목록만 갱신한다.
    // 속성 테이블은 FEATURES_MERGED 를 듣고 있으므로 되돌린 뒤에도 한 번 더 알려 줘야 한다.
    const seen = [];
    const spy = (payload) => seen.push(payload);
    eventBus.on(Events.FEATURES_MERGED, spy);

    try {
      const a = square(0, { 이름: 'A' });
      const b = square(1000, { 이름: 'B' });
      layerManager.addLayer({ name: '둘', features: [a, b] });

      select([a, b]);
      featureEditTool.mergeSelected();
      historyManager.undo();
      historyManager.redo();

      expect(seen).toHaveLength(3); // 합치기 1 + 되돌리기 1 + 다시 실행 1
      expect(seen[0].fromHistory).toBeUndefined();
      expect(seen[1].fromHistory).toBe(true);
      expect(seen[2].fromHistory).toBe(true);

      // 갱신 알림이 다시 기록되면 스택이 불어난다
      expect(historyManager.undoStack).toHaveLength(1);
      expect(historyManager.redoStack).toHaveLength(0);
    } finally {
      eventBus.off(Events.FEATURES_MERGED, spy);
    }
  });

  it('숨긴 레이어에서 합쳐도 되돌리기는 똑같이 된다', () => {
    const a = square(0, { 이름: 'A' });
    const b = square(1000, { 이름: 'B' });
    const layerId = layerManager.addLayer({ name: '숨김', features: [a, b], visible: false });

    select([a, b]);
    featureEditTool.mergeSelected();
    historyManager.undo();

    const layer = layerManager.getLayer(layerId);
    expect(layer.source.getFeatures()).toHaveLength(2);
    expect(layer.visible).toBe(false);
  });
});
