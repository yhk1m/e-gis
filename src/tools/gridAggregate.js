// © 2026 김용현
/**
 * gridAggregate - 점을 정사각 격자로 묶어 칸마다 집계한다.
 *
 * 격자의 기준점은 좌표 원점(0,0)이다. 데이터의 최소 좌표를 기준으로 잡으면
 * 데이터셋마다 격자가 어긋나 두 결과를 겹쳐 볼 수 없다. 원점 기준이면
 * 어떤 데이터를 넣어도 같은 자리에 같은 칸이 생긴다.
 *
 * 좌표계·레이어를 모르는 순수 모듈이다. 입력은 EPSG:3857 미터 좌표를 가정한다.
 */

/** 숫자로 쓸 수 있으면 숫자로, 아니면 null ('-', '', 'N/A' 같은 결측 표기를 걸러낸다) */
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
 * @param {Array<{x: number, y: number, props?: Object}>} points EPSG:3857 좌표의 점들
 * @param {Object} options
 * @param {number} options.cellSize 한 칸의 한 변 길이(미터)
 * @param {'count'|'sum'|'avg'} [options.method='count'] 집계 방식
 * @param {string} [options.field] sum·avg에서 쓸 속성 이름
 * @param {boolean} [options.includeEmpty=false] 점이 없는 칸도 포함할지
 * @returns {Array<{minX: number, minY: number, maxX: number, maxY: number, count: number, value: number|null}>}
 *   기본값은 점이 있는 칸만이다 — 빈 칸까지 넣으면 폴리곤 수가 크게 는다.
 *   includeEmpty 를 켜면 점들이 차지하는 사각 범위를 빈 칸까지 채워 돌려준다.
 *   '없음'과 '0'을 구분해 보여주고 싶을 때 쓴다.
 */
export function aggregateToGrid(points, options = {}) {
  const { cellSize, method = 'count', field, includeEmpty = false } = options;

  if (!(cellSize > 0)) {
    throw new Error('격자 크기는 0보다 커야 합니다.');
  }

  const cells = new Map(); // "col,row" -> { col, row, count, sum, valueCount }

  for (const point of points || []) {
    const x = toNumber(point && point.x);
    const y = toNumber(point && point.y);
    if (x === null || y === null) continue;

    const col = Math.floor(x / cellSize);
    const row = Math.floor(y / cellSize);
    const key = `${col},${row}`;

    let cell = cells.get(key);
    if (!cell) {
      cell = { col, row, count: 0, sum: 0, valueCount: 0 };
      cells.set(key, cell);
    }

    cell.count++;

    if (method !== 'count' && field) {
      const value = toNumber(point.props ? point.props[field] : undefined);
      if (value !== null) {
        cell.sum += value;
        cell.valueCount++;
      }
    }
  }

  if (includeEmpty && cells.size > 0) {
    fillEmptyCells(cells);
  }

  const result = [];
  for (const cell of cells.values()) {
    let value;
    if (method === 'count') {
      value = cell.count;
    } else if (cell.valueCount === 0) {
      value = null; // 읽을 수 있는 값이 하나도 없었다
    } else {
      value = method === 'avg' ? cell.sum / cell.valueCount : cell.sum;
    }

    result.push({
      minX: cell.col * cellSize,
      minY: cell.row * cellSize,
      maxX: (cell.col + 1) * cellSize,
      maxY: (cell.row + 1) * cellSize,
      count: cell.count,
      value
    });
  }

  // 결과 순서를 고정한다 — 아래에서 위로, 같은 줄에서는 왼쪽에서 오른쪽으로
  result.sort((a, b) => (a.minY - b.minY) || (a.minX - b.minX));
  return result;
}

/**
 * 점이 있는 칸들이 이루는 사각 범위를 빈 칸으로 채운다.
 * 범위는 실제 데이터가 있는 칸 기준이라, estimateCellCount 가 어림한 상한과 같다.
 */
function fillEmptyCells(cells) {
  let minCol = Infinity, minRow = Infinity, maxCol = -Infinity, maxRow = -Infinity;
  for (const cell of cells.values()) {
    if (cell.col < minCol) minCol = cell.col;
    if (cell.col > maxCol) maxCol = cell.col;
    if (cell.row < minRow) minRow = cell.row;
    if (cell.row > maxRow) maxRow = cell.row;
  }

  for (let col = minCol; col <= maxCol; col++) {
    for (let row = minRow; row <= maxRow; row++) {
      const key = `${col},${row}`;
      if (!cells.has(key)) {
        cells.set(key, { col, row, count: 0, sum: 0, valueCount: 0 });
      }
    }
  }
}

/**
 * 격자 칸 수를 미리 어림한다. 칸이 너무 많으면 그리기 전에 막기 위한 값이다.
 * @returns {number} 데이터 범위를 덮는 데 필요한 칸 수 (실제 생성될 칸 수의 상한)
 */
export function estimateCellCount(points, cellSize) {
  if (!(cellSize > 0) || !points || points.length === 0) return 0;

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const point of points) {
    const x = toNumber(point && point.x);
    const y = toNumber(point && point.y);
    if (x === null || y === null) continue;
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  if (!Number.isFinite(minX)) return 0;

  const cols = Math.floor(maxX / cellSize) - Math.floor(minX / cellSize) + 1;
  const rows = Math.floor(maxY / cellSize) - Math.floor(minY / cellSize) + 1;
  return cols * rows;
}
