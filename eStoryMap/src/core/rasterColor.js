// © 2026 김용현
// eStoryMap/src/core/rasterColor.js
// 래스터 색상 — 순수 함수. 이식 원본: e-GIS src/loaders/DEMLoader.js
// (DEFAULT_COLOR_RAMP, getColorForValue) + src/tools/RasterAnalysisTool.js
// (getColorForScheme, hypsometricColor, hslToRgb).

/** DEM 고도 램프 (저지대 진녹 → 고산 흰색). e-GIS DEFAULT_COLOR_RAMP. */
export const DEM_COLOR_RAMP = [
  { value: 0, color: [0, 97, 71] },
  { value: 0.15, color: [34, 139, 34] },
  { value: 0.3, color: [154, 205, 50] },
  { value: 0.45, color: [255, 255, 0] },
  { value: 0.6, color: [255, 165, 0] },
  { value: 0.75, color: [255, 69, 0] },
  { value: 0.9, color: [139, 69, 19] },
  { value: 1.0, color: [255, 255, 255] },
];

/** 정규화값(0~1) → 램프 선형 보간 색. e-GIS DEMLoader.getColorForValue 이식. */
export function rampColor(ramp, normalized) {
  for (let i = 0; i < ramp.length - 1; i++) {
    if (normalized >= ramp[i].value && normalized <= ramp[i + 1].value) {
      const ratio = (normalized - ramp[i].value) / (ramp[i + 1].value - ramp[i].value);
      const c1 = ramp[i].color;
      const c2 = ramp[i + 1].color;
      return [
        Math.round(c1[0] + (c2[0] - c1[0]) * ratio),
        Math.round(c1[1] + (c2[1] - c1[1]) * ratio),
        Math.round(c1[2] + (c2[2] - c1[2]) * ratio),
      ];
    }
  }
  if (normalized <= 0) return ramp[0].color;
  return ramp[ramp.length - 1].color;
}

export function demColor(normalized) {
  return rampColor(DEM_COLOR_RAMP, normalized);
}

/** 해발고도(hypsometric) 색 — t(0~1). e-GIS RasterAnalysisTool 이식. */
export function hypsometricColor(t) {
  const stops = [
    [0.0, [38, 115, 0]],
    [0.25, [128, 180, 60]],
    [0.5, [240, 220, 130]],
    [0.75, [160, 110, 60]],
    [1.0, [245, 245, 245]],
  ];
  for (let i = 0; i < stops.length - 1; i++) {
    const [t0, c0] = stops[i];
    const [t1, c1] = stops[i + 1];
    if (t <= t1) {
      const f = (t1 - t0) === 0 ? 0 : (t - t0) / (t1 - t0);
      return [
        Math.round(c0[0] + (c1[0] - c0[0]) * f),
        Math.round(c0[1] + (c1[1] - c0[1]) * f),
        Math.round(c0[2] + (c1[2] - c0[2]) * f),
      ];
    }
  }
  return stops[stops.length - 1][1];
}

/** HSL → RGB. e-GIS RasterAnalysisTool 이식. */
export function hslToRgb(h, s, l) {
  s /= 100;
  l /= 100;
  const k = (n) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [Math.round(255 * f(0)), Math.round(255 * f(8)), Math.round(255 * f(4))];
}

/** analysis colorScheme별 색. e-GIS RasterAnalysisTool.getColorForScheme 이식. */
export function getColorForScheme(value, scheme, minVal = 0, maxVal = 255) {
  switch (scheme) {
    case 'grayscale': {
      const gray = Math.round(value);
      return [gray, gray, gray];
    }
    case 'elevation': {
      const range = (maxVal - minVal) || 1;
      let t = (value - minVal) / range;
      t = Math.max(0, Math.min(1, t));
      return hypsometricColor(t);
    }
    case 'slope': {
      // 녹색(완만) → 노랑 → 빨강(급경사)
      const normalized = (value - minVal) / (maxVal - minVal);
      if (normalized < 0.33) {
        const t = normalized / 0.33;
        return [Math.round(t * 255), Math.round(128 + t * 127), 0];
      }
      if (normalized < 0.66) {
        const t = (normalized - 0.33) / 0.33;
        return [255, Math.round(255 - t * 128), 0];
      }
      const t = (normalized - 0.66) / 0.34;
      return [Math.round(255 - t * 128), Math.round(127 - t * 127), 0];
    }
    case 'aspect': {
      const hue = (value / 360) * 360;
      return hslToRgb(hue, 70, 50);
    }
    default:
      return [128, 128, 128];
  }
}
