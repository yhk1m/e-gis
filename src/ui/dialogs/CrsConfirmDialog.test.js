// © 2026 김용현
// @vitest-environment jsdom
/**
 * 좌표계 확인 창 검증.
 *
 * 이 창의 유일한 실패 모드는 미리보기 임시 레이어가 지도에 남는 것이다.
 * 종료 경로(확인·취소·ESC·오버레이)마다 지워지는지 확인한다.
 */
import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest';
import proj4 from 'proj4';
import { coordinateSystem } from '../../core/CoordinateSystem.js';
import { mapManager } from '../../core/MapManager.js';
import { crsConfirmDialog } from './CrsConfirmDialog.js';

const SEOUL = [126.9784, 37.5667];

// 지도를 흉내낸다 — addLayer/removeLayer만 보면 된다
function fakeMap() {
  const layers = [];
  return {
    layers,
    addLayer: (l) => layers.push(l),
    removeLayer: (l) => {
      const i = layers.indexOf(l);
      if (i >= 0) layers.splice(i, 1);
    },
    getView: () => ({ fit: vi.fn() })
  };
}

let map;

beforeAll(() => coordinateSystem.init());

beforeEach(() => {
  map = fakeMap();
  vi.spyOn(mapManager, 'getMap').mockReturnValue(map);
  document.body.innerHTML = '';
});

afterEach(() => vi.restoreAllMocks());

const DETECTION = {
  crs: 'EPSG:5186',
  confidence: 'ambiguous',
  reason: '좌표 역검증 (한국 영역에 맞는 후보 2개)',
  candidates: [
    { crs: 'EPSG:5186', name: 'Korea 2000 / 중부원점', center: SEOUL },
    { crs: 'EPSG:5181', name: 'Korea 2000 / 중부원점 (y_0=500000)', center: [126.98, 38.47] }
  ]
};

function context() {
  return {
    name: '학교',
    previewGeoJSON: {
      type: 'FeatureCollection',
      features: [{
        type: 'Feature',
        geometry: { type: 'Point', coordinates: proj4('EPSG:4326', 'EPSG:5186', SEOUL) },
        properties: {}
      }]
    }
  };
}

describe('CrsConfirmDialog', () => {
  it('후보를 모두 그리고 첫 후보를 미리 보여준다', async () => {
    const promise = crsConfirmDialog.pick(DETECTION, context());
    expect(document.querySelectorAll('input[name="crs-candidate"]')).toHaveLength(2);
    expect(document.querySelector('input[name="crs-candidate"]').checked).toBe(true);
    expect(map.layers).toHaveLength(1);
    document.getElementById('crs-confirm-cancel').click();
    await promise;
  });

  it('확인하면 고른 좌표계를 주고 미리보기를 걷는다', async () => {
    const promise = crsConfirmDialog.pick(DETECTION, context());
    document.querySelector('input[value="EPSG:5181"]').click();
    document.getElementById('crs-confirm-apply').click();
    await expect(promise).resolves.toBe('EPSG:5181');
    expect(map.layers).toHaveLength(0);
    expect(document.querySelector('.crs-confirm-modal')).toBeNull();
  });

  it('취소하면 null을 주고 미리보기를 걷는다', async () => {
    const promise = crsConfirmDialog.pick(DETECTION, context());
    document.getElementById('crs-confirm-cancel').click();
    await expect(promise).resolves.toBeNull();
    expect(map.layers).toHaveLength(0);
  });

  it('ESC로 닫아도 미리보기를 걷는다', async () => {
    const promise = crsConfirmDialog.pick(DETECTION, context());
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await expect(promise).resolves.toBeNull();
    expect(map.layers).toHaveLength(0);
  });

  it('창 바깥을 눌러도 닫히지 않는다 — 지도를 만지는 중이기 때문이다', async () => {
    // 이 창은 뒤의 미리보기를 확대·이동해 가며 고른다. 지도를 누를 때마다
    // 창이 닫히면 고를 수가 없다. 오버레이는 pointer-events: none 이라
    // 실제로는 이 클릭이 지도로 흘러간다.
    const promise = crsConfirmDialog.pick(DETECTION, context());
    document.querySelector('.crs-confirm-modal').click();

    let settled = false;
    promise.then(() => { settled = true; });
    await Promise.resolve();
    expect(settled).toBe(false);
    expect(document.querySelector('.crs-confirm-modal')).not.toBeNull();
    expect(map.layers).toHaveLength(1);

    document.getElementById('crs-confirm-cancel').click();
    await promise;
    expect(map.layers).toHaveLength(0);
  });

  it('후보를 바꿔도 미리보기 레이어는 하나만 남는다', async () => {
    const promise = crsConfirmDialog.pick(DETECTION, context());
    document.querySelector('input[value="EPSG:5181"]').click();
    document.querySelector('input[value="EPSG:5186"]').click();
    expect(map.layers).toHaveLength(1);
    document.getElementById('crs-confirm-cancel').click();
    await promise;
  });

  it('후보에 없는 좌표계도 드롭다운으로 고를 수 있다', async () => {
    const promise = crsConfirmDialog.pick(DETECTION, context());
    const select = document.getElementById('crs-confirm-other');
    select.value = 'EPSG:5179';
    select.dispatchEvent(new Event('change', { bubbles: true }));
    document.getElementById('crs-confirm-apply').click();
    await expect(promise).resolves.toBe('EPSG:5179');
  });

  it('레이어 이름을 그대로 innerHTML에 넣지 않는다', async () => {
    const ctx = context();
    ctx.name = '<img src=x onerror=alert(1)>';
    const promise = crsConfirmDialog.pick(DETECTION, ctx);
    expect(document.querySelector('.crs-confirm-modal img')).toBeNull();
    document.getElementById('crs-confirm-cancel').click();
    await promise;
  });
});
