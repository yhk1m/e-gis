// © 2026 김용현
/**
 * 지형 격자 생성 — DEM 고도 배열에서 3D 정점을 만든다.
 *
 * three도 DOM도 모른다. 숫자 배열만 돌려주므로 단독으로 테스트된다.
 * 씬 좌표: sceneX = mapX - cx, sceneZ = -(mapY - cy), sceneY = 고도 보정값.
 */

/** 격자 한 변의 최대 정점 수 — 넘으면 솎아낸다 */
export const MAX_GRID = 512;

/**
 * 지도 좌표(EPSG:3857)의 고도를 읽는다.
 * DEM 범위 밖이거나 결측이면 null.
 */
export function sampleElevation(demData, x, y) {
  const { data, width, height, extent, noDataValue } = demData;
  const [minX, minY, maxX, maxY] = extent;

  if (x < minX || x > maxX || y < minY || y > maxY) return null;

  // 행 0이 북쪽(maxY)이다
  const col = Math.min(width - 1, Math.floor(((x - minX) / (maxX - minX)) * width));
  const row = Math.min(height - 1, Math.floor(((maxY - y) / (maxY - minY)) * height));

  const value = data[row * width + col];
  if (!Number.isFinite(value)) return null;
  if (noDataValue !== null && noDataValue !== undefined && value === noDataValue) return null;
  return value;
}

/**
 * 화면 범위에 맞는 지형 격자를 만든다.
 *
 * @param {Object} demData DEMLoader가 만든 { data, width, height, extent, noDataValue }
 * @param {number[]} extent 화면 범위 [minX, minY, maxX, maxY] (EPSG:3857)
 * @param {number} maxGrid 한 변 최대 정점 수
 * @param {number} exaggeration 세로 과장 배수
 * @param {number} latitude 화면 중심 위도(도) — 웹 메르카토르 보정에 쓴다
 * @returns {{positions: Float32Array, uvs: Float32Array, indices: Uint32Array,
 *            gridWidth: number, gridHeight: number, holes: number}}
 */
export function buildTerrainGeometry({
  demData, extent, maxGrid = MAX_GRID, exaggeration = 2, latitude = 0
}) {
  const [minX, minY, maxX, maxY] = extent;
  const spanX = maxX - minX;
  const spanY = maxY - minY;
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;

  // 가로세로 비율을 지키며 상한에 맞춘다
  let gridWidth = maxGrid;
  let gridHeight = maxGrid;
  if (spanX >= spanY) {
    gridHeight = Math.max(2, Math.round(maxGrid * (spanY / spanX)));
  } else {
    gridWidth = Math.max(2, Math.round(maxGrid * (spanX / spanY)));
  }

  // 웹 메르카토르 세로 보정 — 극지에서 발산하므로 위도를 묶는다
  const clampedLat = Math.max(-85, Math.min(85, latitude));
  const zScale = (1 / Math.cos((clampedLat * Math.PI) / 180)) * exaggeration;

  const count = gridWidth * gridHeight;
  const positions = new Float32Array(count * 3);
  const uvs = new Float32Array(count * 2);
  const valid = new Uint8Array(count);
  let holes = 0;

  for (let j = 0; j < gridHeight; j++) {
    const ty = j / (gridHeight - 1);
    const mapY = maxY - ty * spanY;        // j=0 이 북쪽
    for (let i = 0; i < gridWidth; i++) {
      const tx = i / (gridWidth - 1);
      const mapX = minX + tx * spanX;
      const idx = j * gridWidth + i;

      const elevation = sampleElevation(demData, mapX, mapY);
      if (elevation === null) holes++;
      else valid[idx] = 1;

      positions[idx * 3] = mapX - cx;
      positions[idx * 3 + 1] = (elevation ?? 0) * zScale;
      positions[idx * 3 + 2] = -(mapY - cy);

      uvs[idx * 2] = tx;
      uvs[idx * 2 + 1] = 1 - ty;           // 텍스처 위쪽이 북쪽
    }
  }

  // 네 꼭짓점이 모두 유효한 칸만 삼각형으로 만든다
  const indices = [];
  for (let j = 0; j < gridHeight - 1; j++) {
    for (let i = 0; i < gridWidth - 1; i++) {
      const a = j * gridWidth + i;
      const b = a + 1;
      const c = a + gridWidth;
      const d = c + 1;
      if (valid[a] && valid[c] && valid[b]) indices.push(a, c, b);
      if (valid[b] && valid[c] && valid[d]) indices.push(b, c, d);
    }
  }

  return {
    positions,
    uvs,
    indices: Uint32Array.from(indices),
    gridWidth,
    gridHeight,
    holes
  };
}
