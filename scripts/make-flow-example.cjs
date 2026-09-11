// © 2026 김용현
// scripts/make-flow-example.cjs
/**
 * 시도 간 인구이동 **예시(가상 수치)** 를 만든다.
 *
 * KOSIS 국내인구이동통계를 자동으로 받을 수 없어, 인구 규모와 거리로 만든 중력 모형 값을
 * "예시 자료"로 둔다. 실제 자료를 받으면 같은 형식(행렬형 XLSX)으로 바꿔 넣으면 된다.
 *
 * 출력
 *  - practice/Flow Data/시도간_인구이동_예시.xlsx  행렬형 (행=전출지, 열=전입지)  → 실습 데이터 탭
 *  - practice/Flow Data/시도간_인구이동_예시.json  FlowDataset (위치 좌표 포함)     → 시연 페이지
 *
 * 사용법: node scripts/make-flow-example.cjs
 */
const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');
const turf = require('@turf/turf');

const BUILTIN = path.join(__dirname, '..', 'public', 'data', 'builtin');
const SIDO_GEOJSON = path.join(BUILTIN, 'practice', 'Area Data', '행정경계', '대한민국 시도(2026.07.01.~).geojson');
const OUT_DIR = path.join(BUILTIN, 'practice', 'Flow Data');

// 대략의 인구(만 명) — 규모감만 맞춘 가상 가중치
const POP = {
  서울특별시: 940, 부산광역시: 330, 대구광역시: 240, 인천광역시: 300, 대전광역시: 145, 울산광역시: 110,
  세종특별자치시: 39, 경기도: 1370, 강원특별자치도: 153, 충청북도: 160, 충청남도: 213,
  경상북도: 255, 경상남도: 325, 제주특별자치도: 67, 전북특별자치도: 175, 전남광주통합특별시: 320
};

const geo = JSON.parse(fs.readFileSync(SIDO_GEOJSON, 'utf8'));
const locations = geo.features.map((f) => {
  const [lon, lat] = turf.pointOnFeature(f).geometry.coordinates;
  return { id: String(f.properties.code), name: f.properties.name, lon, lat };
});

// 중력 모형: 전출 규모^0.9 × 전입 규모 / 거리^1.2. 서울↔경기는 교외화로 부풀린다
const flows = [];
for (const o of locations) {
  for (const d of locations) {
    if (o.id === d.id) continue;
    const km = turf.distance([o.lon, o.lat], [d.lon, d.lat]);
    let v = 4.2 * Math.pow(POP[o.name], 0.9) * POP[d.name] / Math.pow(Math.max(km, 30), 1.2);
    if (o.name === '서울특별시' && d.name === '경기도') v *= 1.6;
    if (o.name === '경기도' && d.name === '서울특별시') v *= 1.1;
    flows.push({ origin: o.id, dest: d.id, count: Math.round(v) });
  }
}

fs.mkdirSync(OUT_DIR, { recursive: true });

// 행렬형 XLSX
const names = locations.map((l) => l.name);
const byKey = new Map(flows.map((f) => [f.origin + '|' + f.dest, f.count]));
const rows = [['전출지', ...names]];
for (const o of locations) rows.push([o.name, ...locations.map((d) => (o.id === d.id ? 0 : byKey.get(o.id + '|' + d.id)))]);
const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), '시도간 이동(예시)');
XLSX.writeFile(wb, path.join(OUT_DIR, '시도간_인구이동_예시.xlsx'));

// 시연용 JSON (FlowDataset)
const dataset = {
  locations,
  flows,
  meta: { title: '시도 간 인구이동 (예시 자료 · 가상 수치)', unit: '명', source: '예시 자료', matched: flows.length, unmatched: [], skipped: 0 }
};
fs.writeFileSync(path.join(OUT_DIR, '시도간_인구이동_예시.json'), JSON.stringify(dataset), 'utf8');

console.log(`위치 ${locations.length}개, 흐름 ${flows.length}개 → ${OUT_DIR}`);
