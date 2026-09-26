// © 2026 김용현
/**
 * 지구본이 쓰는 투영법 목록.
 *
 * d3 를 아는 유일한 순수 모듈. 키는 컨트롤 박스의 <select> value 이자
 * 하네스가 고르는 값이라 바꾸지 않는다.
 * 논문 향후 과제 ①(투영법 학습용 SVG 보조 모듈)의 씨앗이다 — 여기에 항목을 더하면
 * 드롭다운·그리기가 그대로 따라온다.
 * 설계: docs/superpowers/specs/2026-09-25-labs-design.md 「2단계」
 */
import {
  geoOrthographic, geoMercator, geoEqualEarth, geoNaturalEarth1,
  geoAzimuthalEqualArea, geoEquirectangular
} from 'd3';

/** 구 전체를 맞출 때 캔버스 가장자리에 남기는 여백(px) */
export const FIT_PAD = 20;

const SPHERE = { type: 'Sphere' };

/**
 * kind: 'azimuthal' 은 λ·φ 두 축으로 돌리고, 'cylindrical'(원통·의사원통)은 λ 만 돌린다.
 * 원통 투영에서 φ 를 돌리면 적도가 기울어져 학생이 읽기 어렵다.
 */
export const PROJECTIONS = [
  { key: 'orthographic',       name: '지구본 (정사영)',        kind: 'azimuthal',   factory: geoOrthographic },
  { key: 'mercator',           name: '메르카토르',             kind: 'cylindrical', factory: geoMercator },
  { key: 'equalEarth',         name: '등면적 (Equal Earth)',   kind: 'cylindrical', factory: geoEqualEarth },
  { key: 'naturalEarth',       name: '내추럴 어스',            kind: 'cylindrical', factory: geoNaturalEarth1 },
  { key: 'azimuthalEqualArea', name: '방위 등면적',            kind: 'azimuthal',   factory: geoAzimuthalEqualArea },
  { key: 'equirectangular',    name: '등장방형',               kind: 'cylindrical', factory: geoEquirectangular }
];

export const DEFAULT_PROJECTION = 'orthographic';

/** 키로 항목을 찾는다. 모르는 키는 기본 항목. */
export function findProjection(key) {
  return PROJECTIONS.find((p) => p.key === key) || PROJECTIONS.find((p) => p.key === DEFAULT_PROJECTION);
}

/**
 * 캔버스 크기에 맞춘 d3 투영을 만든다.
 * @param {string} key
 * @param {number} width  CSS px
 * @param {number} height CSS px
 * @param {{rotate?: number[], scale?: number|null}} options
 *   rotate 는 d3 규약([λ, φ, γ]) — 경위도 (lon, lat) 를 가운데 두려면 [-lon, -lat, 0].
 *   scale 을 주면 fitExtent 가 정한 배율 대신 쓴다(확대·축소). translate 는 가운데 그대로.
 */
export function make(key, width, height, { rotate = [0, 0, 0], scale = null } = {}) {
  const entry = findProjection(key);
  // 여백보다 작은 캔버스(접힌 창·숨은 컨테이너)에서도 맞춤 상자가 뒤집히지 않게 — 배율이 0 이하가 되면 안 된다
  const right = Math.max(FIT_PAD + 1, width - FIT_PAD);
  const bottom = Math.max(FIT_PAD + 1, height - FIT_PAD);
  const projection = entry.factory()
    .rotate(rotate)
    .fitExtent([[FIT_PAD, FIT_PAD], [right, bottom]], SPHERE);
  if (scale) projection.scale(scale);
  return projection;
}

/** 이 크기에서 구 전체가 딱 들어오는 배율 — 확대 범위의 기준 */
export function fitScale(key, width, height) {
  return make(key, width, height).scale();
}
