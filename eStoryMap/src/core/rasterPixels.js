// © 2026 김용현
// eStoryMap/src/core/rasterPixels.js
// 래스터 그리드 → 화면 픽셀(RGBA) 매핑 — 순수 함수. 캔버스/OL 의존 없음.
// 이식 원본: e-GIS DEMLoader.renderDEM + RasterAnalysisTool.renderAnalysisResult의
// 공통 루프를 하나로 통합하고, 색 결정만 colorAt 콜백으로 분리.
import { demColor, getColorForScheme } from './rasterColor.js';

/**
 * @param {{data:ArrayLike<number>, width:number, height:number, extent:number[]}} grid
 * @param {number[]} viewExtent - 렌더 대상 화면 범위(EPSG:3857)
 * @param {number[]} size - [w, h] 정수 픽셀 크기
 * @param {(value:number, dataIndex:number) => (number[]|null)} colorAt - null이면 투명
 * @returns {Uint8ClampedArray} RGBA (w*h*4)
 */
export function computeRasterPixels(grid, viewExtent, size, colorAt) {
  const [w, h] = size;
  const { data, width, height, extent } = grid;
  const pixels = new Uint8ClampedArray(w * h * 4); // 기본 0 = 투명

  const gridW = extent[2] - extent[0];
  const gridH = extent[3] - extent[1];
  const viewW = viewExtent[2] - viewExtent[0];
  const viewH = viewExtent[3] - viewExtent[1];

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const mapX = viewExtent[0] + (x / w) * viewW;
      const mapY = viewExtent[3] - (y / h) * viewH;
      const gx = Math.floor(((mapX - extent[0]) / gridW) * width);
      const gy = Math.floor(((extent[3] - mapY) / gridH) * height);
      if (gx < 0 || gx >= width || gy < 0 || gy >= height) continue;

      const dataIndex = gy * width + gx;
      const color = colorAt(data[dataIndex], dataIndex);
      if (!color) continue;

      const p = (y * w + x) * 4;
      pixels[p] = color[0];
      pixels[p + 1] = color[1];
      pixels[p + 2] = color[2];
      pixels[p + 3] = 255;
    }
  }
  return pixels;
}

/** DEM용 colorAt: min~max 정규화 후 고도 램프. (원본 renderDEM의 색 결정부) */
export function demColorAt(demData) {
  const { minVal, maxVal, noDataValue } = demData;
  const range = (maxVal - minVal) || 1;
  return (value) => {
    if (value === noDataValue || Number.isNaN(value) || !Number.isFinite(value)) return null;
    return demColor((value - minVal) / range);
  };
}

/** analysis용 colorAt: colorScheme별 분기. (원본 renderAnalysisResult의 색 결정부) */
export function analysisColorAt(analysisData) {
  const { noDataValue, colorScheme, minVal, maxVal } = analysisData;
  return (value, dataIndex) => {
    // value === -1은 analysis 결과의 마스크 값 (원본과 동일)
    if (value === noDataValue || Number.isNaN(value) || !Number.isFinite(value) || value === -1) {
      return null;
    }
    if (colorScheme === 'filter') {
      return analysisData.fillColorRgb || [227, 23, 10];
    }
    if (colorScheme === 'relief') {
      // 고도색 × 음영. shadeData는 JSON 왕복 후 TypedArray가 아닌
      // 숫자 키 객체일 수 있으나 인덱싱은 동일하게 동작(원본도 동일 상황).
      const base = getColorForScheme(value, 'elevation', minVal, maxVal);
      let s = analysisData.shadeData ? analysisData.shadeData[dataIndex] : 1;
      if (!Number.isFinite(s)) s = 1;
      const shade = 0.35 + 0.65 * Math.max(0, Math.min(1, s));
      return [
        Math.round(base[0] * shade),
        Math.round(base[1] * shade),
        Math.round(base[2] * shade),
      ];
    }
    return getColorForScheme(value, colorScheme, minVal, maxVal);
  };
}
