// © 2026 김용현
// @vitest-environment jsdom
/**
 * 자동 저장 예약(디바운스) 규약.
 *
 * 예전에는 타이머 하나에 레이어 ID 하나만 물려 있었다. 파일을 여러 개 올리거나
 * 분석 결과가 잇달아 생기면 앞의 예약이 clearTimeout으로 취소되고 마지막 레이어
 * 하나만 저장됐다 — 새로고침해서 복원하면 나머지가 사라졌다.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import Feature from 'ol/Feature.js';
import Polygon from 'ol/geom/Polygon.js';

// IndexedDB가 없는 환경이므로 열기 요청은 응답하지 않는 가짜로 둔다 (초기화 대기 상태)
globalThis.indexedDB = globalThis.indexedDB || { open: () => ({}) };

const { autoSaveManager } = await import('./AutoSaveManager.js');
const { stateManager } = await import('./StateManager.js');
const { layerManager } = await import('./LayerManager.js');

const square = () => new Feature({
  geometry: new Polygon([[[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]])
});

let saved;
let originalSaveLayer;
let originalEnabled;

beforeEach(() => {
  vi.useFakeTimers();
  saved = [];
  originalSaveLayer = stateManager.saveLayer;
  originalEnabled = stateManager.isAutoSaveEnabled;
  stateManager.saveLayer = async (layerInfo) => { saved.push(layerInfo.name); };
  stateManager.isAutoSaveEnabled = () => true;
  layerManager.getAllLayers().slice().forEach(l => layerManager.removeLayer(l.id));
});

afterEach(() => {
  vi.useRealTimers();
  stateManager.saveLayer = originalSaveLayer;
  stateManager.isAutoSaveEnabled = originalEnabled;
});

const addLayer = (name) => layerManager.addLayer({ name, features: [square()] });

describe('AutoSaveManager.scheduleSave', () => {
  it('잇달아 올린 레이어를 모두 저장한다 (마지막 하나만 남던 문제)', async () => {
    autoSaveManager.scheduleSave(addLayer('A'));
    autoSaveManager.scheduleSave(addLayer('B'));

    await vi.advanceTimersByTimeAsync(1500);

    expect(saved.sort()).toEqual(['A', 'B']);
  });

  it('여러 개를 한꺼번에 올려도 전부 저장한다', async () => {
    ['A', 'B', 'C', 'D', 'E'].forEach(n => autoSaveManager.scheduleSave(addLayer(n)));

    await vi.advanceTimersByTimeAsync(1500);

    expect(saved.sort()).toEqual(['A', 'B', 'C', 'D', 'E']);
  });

  it('같은 레이어를 여러 번 예약하면 한 번만 저장한다 (디바운스는 유지)', async () => {
    const id = addLayer('A');
    autoSaveManager.scheduleSave(id);
    autoSaveManager.scheduleSave(id);
    autoSaveManager.scheduleSave(id);

    await vi.advanceTimersByTimeAsync(1500);

    expect(saved).toEqual(['A']);
  });

  it('저장 전에 지운 레이어는 건너뛴다', async () => {
    const id = addLayer('A');
    autoSaveManager.scheduleSave(id);
    autoSaveManager.scheduleSave(addLayer('B'));
    layerManager.removeLayer(id);

    await vi.advanceTimersByTimeAsync(1500);

    expect(saved).toEqual(['B']);
  });

  it('한 레이어 저장이 실패해도 나머지는 저장한다', async () => {
    stateManager.saveLayer = async (layerInfo) => {
      if (layerInfo.name === 'A') throw new Error('저장 실패');
      saved.push(layerInfo.name);
    };
    autoSaveManager.scheduleSave(addLayer('A'));
    autoSaveManager.scheduleSave(addLayer('B'));

    await vi.advanceTimersByTimeAsync(1500);

    expect(saved).toEqual(['B']);
  });

  it('자동 저장이 꺼져 있으면 저장하지 않는다', async () => {
    stateManager.isAutoSaveEnabled = () => false;
    autoSaveManager.scheduleSave(addLayer('A'));

    await vi.advanceTimersByTimeAsync(1500);

    expect(saved).toEqual([]);
  });
});

/** 저장 레코드 흉내 */
const record = (id, name, type = 'vector', featureCount = 2) => ({
  id, name, type, timestamp: Number(id.replace(/\D/g, '')) || 1,
  features: { type: 'FeatureCollection', features: new Array(featureCount).fill({}) }
});

describe('레이어 순서 저장', () => {
  it('순서가 바뀌면 모든 레이어를 다시 저장 예약한다', async () => {
    const a = addLayer('A'), b = addLayer('B'), c = addLayer('C');
    layerManager.reorderLayers([c, a, b]);
    saved.length = 0;

    autoSaveManager.scheduleOrderSave();
    await vi.advanceTimersByTimeAsync(1500);

    expect(saved.sort()).toEqual(['A', 'B', 'C']);
  });
});

describe('AutoSaveManager.restoreState', () => {
  let restored;
  let deleted;
  let originals;

  beforeEach(() => {
    restored = [];
    deleted = [];
    originals = {
      getAllLayers: stateManager.getAllLayers,
      deleteLayer: stateManager.deleteLayer,
      getMapState: stateManager.getMapState,
      restoreLayer: autoSaveManager.restoreLayer
    };
    stateManager.deleteLayer = async (id) => { deleted.push(id); };
    stateManager.getMapState = () => null;
    autoSaveManager.restoreLayer = async (rec) => { restored.push(rec.id); };
  });

  afterEach(() => {
    stateManager.getAllLayers = originals.getAllLayers;
    stateManager.deleteLayer = originals.deleteLayer;
    stateManager.getMapState = originals.getMapState;
    autoSaveManager.restoreLayer = originals.restoreLayer;
  });

  it('이름·유형·피처수가 같아도 저장된 레이어를 모두 복원한다', async () => {
    // 같은 파일을 두 번 올린 경우. 예전에는 "중복"으로 보고 하나를 지워 버렸다
    // (저장 레코드까지 삭제해서 되돌릴 수도 없었다).
    stateManager.getAllLayers = async () => [record('1', '같은이름'), record('2', '같은이름')];

    await autoSaveManager.restoreState();

    expect(restored).toEqual(['1', '2']);
    expect(deleted).toEqual([]);
  });

  it('도형표현도는 원본보다 나중에 복원한다', async () => {
    stateManager.getAllLayers = async () => [
      record('1', '차트', 'chartmap'), record('2', '원본'), record('3', '또다른')
    ];

    await autoSaveManager.restoreState();

    expect(restored[restored.length - 1]).toBe('1');
  });

  it('저장된 레이어 순서(zIndex)대로 복원한다', async () => {
    // IndexedDB는 ID 키 순서로 돌려주므로, 순서는 레코드의 zIndex로 되살려야 한다
    const recs = [
      { ...record('1', '맨위'), zIndex: 3 },
      { ...record('2', '맨아래'), zIndex: 1 },
      { ...record('3', '가운데'), zIndex: 2 }
    ];
    stateManager.getAllLayers = async () => recs;

    await autoSaveManager.restoreState();

    expect(restored).toEqual(['2', '3', '1']);
  });

  it('zIndex가 없는 옛 저장본은 원래 순서를 유지한다', async () => {
    stateManager.getAllLayers = async () => [record('1', 'A'), record('2', 'B'), record('3', 'C')];

    await autoSaveManager.restoreState();

    expect(restored).toEqual(['1', '2', '3']);
  });

  it('한 레이어 복원이 실패해도 나머지를 복원한다', async () => {
    stateManager.getAllLayers = async () => [record('1', 'A'), record('2', 'B'), record('3', 'C')];
    autoSaveManager.restoreLayer = async (rec) => {
      if (rec.id === '2') throw new Error('복원 실패');
      restored.push(rec.id);
    };

    await autoSaveManager.restoreState();

    expect(restored).toEqual(['1', '3']);
  });
});
