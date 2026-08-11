// © 2026 김용현
/**
 * 공공데이터포털 응답 → e-GIS가 아는 한 가지 모양.
 *
 * 포털은 API마다 응답이 다르다.
 *  - 배열이 `body.items`에 바로 있기도, `body.items.item`에 있기도 하다
 *  - 결과가 1건이면 배열이 아니라 객체로 온다
 *  - 좌표는 문자열이고 필드 이름도 API마다 다르다 (심지어 위도가 dmX인 API도 있다)
 *
 * 이 차이를 전부 여기서 흡수해서, 브라우저 쪽 코드는 한 가지 모양만 알면 되게 한다.
 * 좌표계 변환은 하지 않는다 — epsg를 그대로 실어 보내고 브라우저가 proj4로 바꾼다.
 */

/** 점(.)으로 이어진 경로를 따라간다. 중간이 없으면 undefined */
function pick(source, path) {
  if (!source || !path) return undefined;
  return path.split('.').reduce((acc, key) => (acc == null ? undefined : acc[key]), source);
}

/** 숫자로 쓸 수 있으면 숫자, 아니면 null (포털은 결측을 '-'나 빈 문자열로 준다) */
function toNumber(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed === '') return null;
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

/**
 * @param {Object} raw 포털 응답(JSON 파싱 결과)
 * @param {Object} entry 카탈로그 항목 { path, lon, lat, epsg }
 * @returns {{ items: Array<{lon:number, lat:number, props:Object}>, count:number, skipped:number, epsg:number }}
 */
export function normalize(raw, entry) {
  const epsg = entry && entry.epsg ? Number(entry.epsg) : 4326;
  const found = pick(raw, entry && entry.path);

  // 1건이면 배열이 아니라 객체로 온다
  const rows = Array.isArray(found) ? found : (found && typeof found === 'object' ? [found] : []);

  const items = [];
  let skipped = 0;

  for (const row of rows) {
    if (!row || typeof row !== 'object') { skipped++; continue; }

    const lon = toNumber(row[entry.lon]);
    const lat = toNumber(row[entry.lat]);

    if (lon === null || lat === null) { skipped++; continue; }

    // 위경도일 때만 범위를 본다. 투영좌표(TM 등)는 값이 크므로 검사하면 안 된다.
    if (epsg === 4326 && (lon < -180 || lon > 180 || lat < -90 || lat > 90)) {
      skipped++;
      continue;
    }

    const props = {};
    for (const key of Object.keys(row)) {
      if (key === entry.lon || key === entry.lat) continue;
      props[key] = row[key];
    }

    items.push({ lon, lat, props });
  }

  return { items, count: items.length, skipped, epsg };
}
