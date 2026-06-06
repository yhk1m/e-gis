/**
 * FeatureEditGeometry 단위 테스트 (러너 없이 node 로 실행)
 *   node scripts/test-feature-edit.mjs
 */
import * as turf from '@turf/turf';
import {
  mergeAttributes,
  mergeGeoJSON,
  splitLineByLine,
  splitPolygonByLine
} from '../src/tools/FeatureEditGeometry.js';

let pass = 0;
let fail = 0;
function check(name, cond) {
  if (cond) {
    pass++;
    console.log(`  ✓ ${name}`);
  } else {
    fail++;
    console.error(`  ✗ ${name}`);
  }
}

// --- mergeAttributes ---
console.log('mergeAttributes');
{
  const r = mergeAttributes([
    { pop: 100, name: '가', code: 1 },
    { pop: 50, name: '나', code: 2 }
  ]);
  check('수치 필드 합계', r.pop === 150 && r.code === 3);
  check('문자 필드 첫값', r.name === '가');
}

// --- mergeGeoJSON: 인접한 두 정사각형 ---
console.log('mergeGeoJSON (폴리곤)');
{
  const sqA = turf.polygon(
    [[[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]],
    { area_id: 10 }
  );
  const sqB = turf.polygon(
    [[[1, 0], [2, 0], [2, 1], [1, 1], [1, 0]]],
    { area_id: 5 }
  );
  const merged = mergeGeoJSON([sqA, sqB]);
  const area = turf.area(merged);
  const a1 = turf.area(sqA);
  const a2 = turf.area(sqB);
  check('합쳐진 면적 ≈ 원본 합', Math.abs(area - (a1 + a2)) / (a1 + a2) < 1e-6);
  check('속성 합계 area_id=15', merged.properties.area_id === 15);
}

// --- mergeGeoJSON: 라인 ---
console.log('mergeGeoJSON (라인)');
{
  const l1 = turf.lineString([[0, 0], [1, 1]], { len: 1 });
  const l2 = turf.lineString([[1, 1], [2, 0]], { len: 1 });
  const merged = mergeGeoJSON([l1, l2]);
  check('MultiLineString 생성', merged.geometry.type === 'MultiLineString');
  check('라인 2개 결합', merged.geometry.coordinates.length === 2);
  check('속성 합계 len=2', merged.properties.len === 2);
}

// --- splitPolygonByLine: 정사각형을 수직선으로 분할 ---
console.log('splitPolygonByLine');
{
  const sq = turf.polygon(
    [[[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]]],
    { gid: 7 }
  );
  const cut = turf.lineString([[5, -1], [5, 11]]);
  const parts = splitPolygonByLine(sq, cut);
  check('2개로 분할', parts && parts.length === 2);
  if (parts) {
    const total = parts.reduce((s, p) => s + turf.area(p), 0);
    check('분할 면적 합 ≈ 원본', Math.abs(total - turf.area(sq)) / turf.area(sq) < 0.01);
    check('각 조각이 원본 속성 복제', parts.every((p) => p.properties.gid === 7));
  }
}

// --- splitPolygonByLine: 교차 안 하는 선 → null ---
console.log('splitPolygonByLine (비교차)');
{
  const sq = turf.polygon([[[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]]]);
  const cut = turf.lineString([[20, 20], [30, 30]]);
  const parts = splitPolygonByLine(sq, cut);
  check('분할 안 됨 → null', parts === null);
}

// --- splitLineByLine ---
console.log('splitLineByLine');
{
  const line = turf.lineString([[0, 0], [10, 0]], { road: 'A' });
  const cut = turf.lineString([[5, -1], [5, 1]]);
  const parts = splitLineByLine(line, cut);
  check('2개 이상으로 분할', parts && parts.length >= 2);
  check('속성 복제', parts && parts.every((p) => p.properties.road === 'A'));

  const noCut = turf.lineString([[20, 0], [21, 1]]);
  check('비교차 → null', splitLineByLine(line, noCut) === null);
}

console.log(`\n결과: ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
