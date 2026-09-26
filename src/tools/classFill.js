// © 2026 김용현
/**
 * 구간 채움(class fill) — 순수 모듈.
 *
 * 단계구분도 구간 하나를 무엇으로 칠할지(_choroplethConfig.fills[i])를 정규화하고,
 * 캔버스 없이 "그리기 명령 목록"(plan)을 만든다. 실제로 그리는 것은
 * classFillCanvas.renderFillCanvas 다 — view3d/mapTexture.planComposition 과 같은 분리라
 * 노드에서 그대로 테스트된다.
 *
 * 질감은 이미지 파일 없이 고정 시드 난수로 만든다. 같은 사양이면 지도·범례·내보내기가
 * 같은 무늬를 낸다. 틴트는 흰 바탕의 회색 표식 위에 기준색을 multiply 로 얹는다 —
 * 강도 0 이면 정확히 기준색이라 범례와 어긋나지 않는다.
 * 설계: docs/superpowers/specs/2026-09-25-labs-design.md 「1단계」
 */
import { hexToRgba } from '../utils/colorRamp.js';

export const FILL_KINDS = ['solid', 'hatch', 'dots', 'cross', 'image', 'texture'];
export const TEXTURE_NAMES = ['paper', 'gloss', 'sand', 'forest', 'water'];
export const HATCH_ANGLES = [0, 45, 90, 135];
export const PRESET_NAMES = ['bw-hatch', 'dots-density', 'texture-uniform'];
/** 질감 타일 한 변(픽셀, pixelScale 1 기준) */
export const TEXTURE_TILE = 64;
/** 이미지 채움 재인코딩 긴 변 */
export const IMAGE_MAX_SIDE = 256;

const DEFAULT_INK = '#333333';

function clamp(value, lo, hi, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(hi, Math.max(lo, n));
}

function isHex(s) {
  return typeof s === 'string' && /^#[0-9a-fA-F]{6}$/.test(s);
}

function normalizeBackground(bg) {
  if (bg === 'none') return 'none';
  if (isHex(bg)) return bg;
  return 'class';
}

export function isSolid(spec) {
  return !spec || spec.kind === 'solid' || !FILL_KINDS.includes(spec.kind);
}

/**
 * 빠진 값을 채우고 범위를 제한한다. 모르는 종류·깨진 이미지는 단색.
 */
export function normalizeFill(spec) {
  if (isSolid(spec)) return { kind: 'solid' };
  const color = isHex(spec.color) ? spec.color : DEFAULT_INK;
  switch (spec.kind) {
    case 'hatch':
      return {
        kind: 'hatch',
        angle: HATCH_ANGLES.includes(Number(spec.angle)) ? Number(spec.angle) : 45,
        spacing: clamp(spec.spacing, 4, 24, 8),
        width: clamp(spec.width, 0.5, 6, 2),
        color,
        background: normalizeBackground(spec.background)
      };
    case 'dots':
      return {
        kind: 'dots',
        spacing: clamp(spec.spacing, 4, 24, 8),
        radius: clamp(spec.radius, 0.5, 6, 1.6),
        color,
        background: normalizeBackground(spec.background)
      };
    case 'cross':
      return {
        kind: 'cross',
        spacing: clamp(spec.spacing, 4, 24, 8),
        width: clamp(spec.width, 0.5, 6, 1.5),
        color,
        background: normalizeBackground(spec.background)
      };
    case 'image':
      if (typeof spec.dataUrl !== 'string' || !spec.dataUrl.startsWith('data:image/')) return { kind: 'solid' };
      return {
        kind: 'image',
        dataUrl: spec.dataUrl,
        width: Math.round(clamp(spec.width, 1, IMAGE_MAX_SIDE, IMAGE_MAX_SIDE)),
        height: Math.round(clamp(spec.height, 1, IMAGE_MAX_SIDE, IMAGE_MAX_SIDE)),
        scale: clamp(spec.scale, 0.25, 4, 1),
        opacity: clamp(spec.opacity, 0, 1, 1)
      };
    case 'texture':
      return {
        kind: 'texture',
        name: TEXTURE_NAMES.includes(spec.name) ? spec.name : 'paper',
        strength: clamp(spec.strength, 0, 1, 0.5)
      };
    default:
      return { kind: 'solid' };
  }
}

/** 고정 시드 난수 (mulberry32). 같은 시드 → 같은 수열. */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 사선 한 묶음 — 타일 T 를 가로지르는 선 셋(양옆 이웃 타일과 이어진다). */
function diagonalLines(T, width, color, angle) {
  const e = width;   // 끝을 굵기만큼 늘려 이음매의 빈 틈을 막는다
  const lines = [];
  for (let k = 0; k <= 2; k++) {
    if (angle === 45) {
      // x + y = kT : (kT - T, T) → (kT, 0)
      lines.push({ op: 'line', x1: k * T - T - e, y1: T + e, x2: k * T + e, y2: -e, color, width });
    } else {
      // x - y = (k-1)T : ((k-1)T, 0) → (kT, T)
      lines.push({ op: 'line', x1: (k - 1) * T - e, y1: -e, x2: k * T + e, y2: T + e, color, width });
    }
  }
  return lines;
}

/**
 * 표식 하나를 타일 가장자리 너머로도 복제해 이음매를 없앤다.
 * @returns {Array<[number, number]>} 그릴 위치들
 */
function wrapped(x, y, r, T) {
  const xs = [x];
  const ys = [y];
  if (x - r < 0) xs.push(x + T);
  if (x + r > T) xs.push(x - T);
  if (y - r < 0) ys.push(y + T);
  if (y + r > T) ys.push(y - T);
  const out = [];
  xs.forEach((px) => ys.forEach((py) => out.push([px, py])));
  return out;
}

/**
 * 질감 표식 목록. 흰 바탕 위의 회색·검정·흰색 표식이며, 뒤에서 기준색으로 틴트된다.
 * strength 는 표식의 진하기(알파). 0 이면 전부 알파 0.
 */
function textureOps(name, strength, T, k, seed) {
  const rnd = mulberry32(seed);
  const ink = (v) => `rgba(0, 0, 0, ${(Math.min(1, v * strength * 2)).toFixed(3)})`;
  const light = (v) => `rgba(255, 255, 255, ${(Math.min(1, v * strength * 2)).toFixed(3)})`;
  const ops = [];

  if (name === 'paper') {
    for (let i = 0; i < 350; i++) {
      ops.push({ op: 'rect', x: Math.floor(rnd() * T), y: Math.floor(rnd() * T), w: k, h: k, color: ink(0.06 + rnd() * 0.1) });
    }
    return ops;
  }

  if (name === 'gloss') {
    // 회색 바탕(planFill 이 정한다) 위에 흰 사선 띠 — 틴트 뒤 기준색이 밝게 스치는 느낌
    const bands = [[0.15, 6], [0.4, 3], [0.7, 8]];
    bands.forEach(([pos, w]) => {
      const c = pos * T * 2;
      for (let j = -1; j <= 1; j++) {
        const off = j * T * 2;
        ops.push({ op: 'line', x1: c + off - T, y1: T, x2: c + off, y2: 0, color: light(0.45), width: w * k });
      }
    });
    return ops;
  }

  if (name === 'sand') {
    for (let i = 0; i < 90; i++) {
      const r = 0.7 * k;
      wrapped(rnd() * T, rnd() * T, r, T).forEach(([x, y]) => ops.push({ op: 'circle', x, y, r, color: ink(0.18) }));
    }
    for (let i = 0; i < 30; i++) {
      const r = 1.4 * k;
      wrapped(rnd() * T, rnd() * T, r, T).forEach(([x, y]) => ops.push({ op: 'circle', x, y, r, color: ink(0.12) }));
    }
    return ops;
  }

  if (name === 'forest') {
    for (let i = 0; i < 14; i++) {
      const r = 3 * k;
      wrapped(rnd() * T, rnd() * T, r * 2, T).forEach(([x, y]) => {
        ops.push({ op: 'circle', x, y, r, color: ink(0.22) });
        ops.push({ op: 'line', x1: x, y1: y + r, x2: x, y2: y + r * 2, color: ink(0.3), width: k });
      });
    }
    return ops;
  }

  // water — 가로 물결 다섯 줄. 주기 = T 라 옆 타일과 이어진다.
  const rows = 5;
  for (let j = 0; j < rows; j++) {
    const y0 = (j + 0.5) * (T / rows);
    const phase = rnd() * Math.PI * 2;
    const points = [];
    for (let s = 0; s <= 16; s++) {
      const x = (s / 16) * T;
      points.push([x, y0 + Math.sin((x / T) * Math.PI * 2 + phase) * 1.5 * k]);
    }
    ops.push({ op: 'path', points, color: ink(0.18), width: k });
  }
  return ops;
}

/**
 * 채움 사양 → 그리기 계획. 캔버스를 쓰지 않는다.
 *
 * @param {Object|undefined} spec   fills[i]
 * @param {string} baseColor        구간 기준색 '#rrggbb' (colors[i])
 * @param {number} fillOpacity      레이어 채움 투명도 0~1
 * @param {{pixelScale?: number, seed?: number}} options  pixelScale 은 내보내기 배율
 * @returns {{size: number[]|0, background: string|null, fallback: string, ops: Object[]}}
 */
export function planFill(spec, baseColor, fillOpacity = 1, { pixelScale = 1, seed = 7 } = {}) {
  const f = normalizeFill(spec);
  const base = isHex(baseColor) ? baseColor : '#808080';
  const alpha = clamp(fillOpacity, 0, 1, 1);
  const k = clamp(pixelScale, 0.25, 8, 1);
  const baseRgba = hexToRgba(base, alpha);
  const alphaOp = { op: 'alpha', value: alpha };

  if (f.kind === 'solid') return { size: 0, background: baseRgba, fallback: baseRgba, ops: [] };

  if (f.kind === 'image') {
    const w = Math.max(1, Math.round(f.width * f.scale * k));
    const h = Math.max(1, Math.round(f.height * f.scale * k));
    return {
      size: [w, h],
      background: null,
      fallback: baseRgba,
      ops: [{ op: 'image', dataUrl: f.dataUrl, x: 0, y: 0, w, h, opacity: f.opacity }, alphaOp]
    };
  }

  if (f.kind === 'texture') {
    const T = Math.round(TEXTURE_TILE * k);
    const background = f.name === 'gloss' ? '#cfcfcf' : '#ffffff';
    return {
      size: [T, T],
      background,
      fallback: baseRgba,
      ops: [...textureOps(f.name, f.strength, T, k, seed), { op: 'tint', color: base, alpha: 1 }, alphaOp]
    };
  }

  // hatch · dots · cross
  const background = f.background === 'none' ? null : (f.background === 'class' ? base : f.background);
  const fallback = background === null ? 'rgba(0, 0, 0, 0)' : hexToRgba(background, alpha);
  const s = f.spacing * k;

  if (f.kind === 'dots') {
    const T = Math.round(s);
    return { size: [T, T], background, fallback, ops: [{ op: 'circle', x: T / 2, y: T / 2, r: f.radius * k, color: f.color }, alphaOp] };
  }

  const width = f.width * k;
  if (f.kind === 'cross') {
    const T = Math.round(s);
    return {
      size: [T, T], background, fallback,
      ops: [
        { op: 'line', x1: 0, y1: T / 2, x2: T, y2: T / 2, color: f.color, width },
        { op: 'line', x1: T / 2, y1: 0, x2: T / 2, y2: T, color: f.color, width },
        alphaOp
      ]
    };
  }

  // hatch
  if (f.angle === 0 || f.angle === 90) {
    const T = Math.round(s);
    const line = f.angle === 0
      ? { op: 'line', x1: 0, y1: T / 2, x2: T, y2: T / 2, color: f.color, width }
      : { op: 'line', x1: T / 2, y1: 0, x2: T / 2, y2: T, color: f.color, width };
    return { size: [T, T], background, fallback, ops: [line, alphaOp] };
  }
  const T = Math.round(s * Math.SQRT2);
  return { size: [T, T], background, fallback, ops: [...diagonalLines(T, width, f.color, f.angle), alphaOp] };
}

/**
 * 모든 구간에 한꺼번에 거는 프리셋. 구간이 높을수록 촘촘하다.
 * @returns {Object[]|null} fills 또는 모르는 이름이면 null
 */
export function presetFills(name, n) {
  const count = Math.max(1, Math.floor(n));
  const t = (i) => (count > 1 ? i / (count - 1) : 1);
  const spacingAt = (i, from, to) => Math.round(from + (to - from) * t(i));
  if (name === 'bw-hatch') {
    return Array.from({ length: count }, (_, i) => ({
      kind: 'hatch', angle: 45, spacing: spacingAt(i, 20, 6), width: 1.5, color: '#222222', background: 'none'
    }));
  }
  if (name === 'dots-density') {
    return Array.from({ length: count }, (_, i) => ({
      kind: 'dots', spacing: spacingAt(i, 18, 6), radius: 1.4, color: '#222222', background: 'class'
    }));
  }
  if (name === 'texture-uniform') {
    return Array.from({ length: count }, () => ({ kind: 'texture', name: 'paper', strength: 0.5 }));
  }
  return null;
}

/** 저장 크기 안내용 — 이미지 dataUrl 의 대략적인 바이트 수(base64 → 3/4). 나머지는 0. */
export function fillSpecBytes(spec) {
  if (!spec || spec.kind !== 'image' || typeof spec.dataUrl !== 'string') return 0;
  const comma = spec.dataUrl.indexOf(',');
  const payload = comma >= 0 ? spec.dataUrl.length - comma - 1 : spec.dataUrl.length;
  return Math.floor(payload * 3 / 4);
}
