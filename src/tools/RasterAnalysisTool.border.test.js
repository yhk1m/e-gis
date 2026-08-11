// © 2026 김용현
import { describe, it, expect, beforeAll } from 'vitest';

// 범례 생성이 document를 만지므로 최소 스텁만 둔다 (지도 컨테이너가 없으면 범례는 붙지 않는다)
beforeAll(() => {
  if (typeof globalThis.document === 'undefined') {
    globalThis.document = {
      createElement: () => ({ classList: { add() {} }, style: {}, querySelector: () => null }),
      getElementById: () => null
    };
  }
});

const { layerManager } = await import('../core/LayerManager.js');
const { rasterAnalysisTool } = await import('./RasterAnalysisTool.js');

const NO_DATA = -9999;

/**
 * 남쪽으로 기울어진 평면 DEM. 모든 셀이 유효값이라
 * 가장자리 링이 nodata로 채워지는지만 순수하게 드러난다.
 */
function tiltedDem(width = 8, height = 6) {
  const data = new Float32Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      data[y * width + x] = 100 + y * 30 + x * 5;
    }
  }
  return {
    data, width, height,
    extent: [14000000, 4500000, 14000000 + width * 90, 4500000 + height * 90],
    minVal: 100, maxVal: 100 + (height - 1) * 30 + (width - 1) * 5,
    noDataValue: NO_DATA
  };
}

/** demData를 담은 DEM 레이어를 등록하고 id를 돌려준다 */
function addDemLayer(demData, name = 'TEST_DEM') {
  const olLayer = { setZIndex() {}, getOpacity: () => 0.8, setOpacity() {} };
  const id = layerManager.addLayer({ name, type: 'raster', olLayer, geometryType: 'Raster' });
  layerManager.getLayer(id).demData = demData;
  return id;
}

/** 결과 래스터의 가장자리 1셀 링 값들 */
function borderValues(arr, width, height) {
  const out = [];
  for (let x = 0; x < width; x++) {
    out.push(arr[x]);                       // 위 행
    out.push(arr[(height - 1) * width + x]); // 아래 행
  }
  for (let y = 0; y < height; y++) {
    out.push(arr[y * width]);               // 왼쪽 열
    out.push(arr[y * width + width - 1]);   // 오른쪽 열
  }
  return out;
}

describe('래스터 분석 결과의 가장자리 링 — DEM 범위에 사각형이 그려지면 안 된다', () => {
  it('경사도: 계산에서 빠진 가장자리 셀은 nodata여야 한다 (0이면 경사 0° 초록 테두리로 칠해짐)', () => {
    const dem = tiltedDem();
    const layerId = addDemLayer(dem, 'SLOPE_DEM');
    const resultId = rasterAnalysisTool.createSlope(layerId, { unit: 'degree', zFactor: 1 });
    const { data } = layerManager.getLayer(resultId).analysisData;

    expect(borderValues(data, dem.width, dem.height).every(v => v === NO_DATA)).toBe(true);
    // 내부는 실제 경사값이 남아 있어야 한다
    expect(data[dem.width + 1]).toBeGreaterThan(0);
  });

  it('경사방향: 가장자리 셀은 nodata여야 한다 (0이면 북향 0° 빨강 테두리로 칠해짐)', () => {
    const dem = tiltedDem();
    const layerId = addDemLayer(dem, 'ASPECT_DEM');
    const resultId = rasterAnalysisTool.createAspect(layerId);
    const { data } = layerManager.getLayer(resultId).analysisData;

    expect(borderValues(data, dem.width, dem.height).every(v => v === NO_DATA)).toBe(true);
    expect(data[dem.width + 1]).toBeGreaterThanOrEqual(0);
  });

  it('음영기복: 가장자리 셀은 nodata여야 한다 (0이면 검은 테두리로 칠해짐)', () => {
    const dem = tiltedDem();
    const layerId = addDemLayer(dem, 'HILLSHADE_DEM');
    const resultId = rasterAnalysisTool.createHillshade(layerId, {});
    const { data } = layerManager.getLayer(resultId).analysisData;

    expect(borderValues(data, dem.width, dem.height).every(v => v === NO_DATA)).toBe(true);
  });
});
