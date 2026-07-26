// © 2026 김용현
/**
 * RoadNetwork - 도로망 그래프 로더 (표준노드링크 기반)
 *
 * scripts/build-roadgraph.mjs 가 구운 이진 파일을 그대로 뷰로 얹어 쓴다.
 * JSON 파싱이 없어 수십 MB도 즉시 사용 가능하다.
 *
 * 좌표는 이미 EPSG:3857 정수 미터라 변환이 필요 없다.
 * 통행시간(cost, 초)은 원본 LENGTH(EPSG:5186 미터)와 제한속도로 빌드 때 계산해 넣었다.
 */

const ROADNET_BASE = './data/roadnet/';

/** graph.bin 헤더 크기 (매직 + 버전 + 카운트 + bbox + 형상정점수 + 예비) */
const HEADER_BYTES = 48;

/** 4바이트 경계로 올림 (타입드 배열 뷰는 정렬이 맞아야 만들어진다) */
const align4 = (n) => (n + 3) & ~3;

class RoadNetwork {
  constructor() {
    this.catalog = null;
    this.chunk = null;      // 현재 로드된 청크 (이름·배열들)
    this.geometry = null;   // 필요할 때만 받는 형상 (Int32Array)
    this._loading = null;   // 같은 청크 중복 요청 합치기
  }

  /** 사용 가능한 도로망 목록 */
  async getCatalog() {
    if (this.catalog) return this.catalog;
    const resp = await fetch(ROADNET_BASE + 'catalog.json');
    if (!resp.ok) throw new Error('도로망 목록을 불러올 수 없습니다.');
    this.catalog = await resp.json();
    return this.catalog;
  }

  /** 현재 로드된 도로망 이름 (없으면 null) */
  get loadedName() {
    return this.chunk ? this.chunk.name : null;
  }

  /**
   * 도로망 로드 (이미 같은 것이 올라와 있으면 그대로 사용)
   * @param {string} name - catalog의 청크 이름
   * @param {(loaded:number, total:number) => void} [onProgress]
   */
  async load(name, onProgress) {
    if (this.chunk && this.chunk.name === name) return this.chunk;
    if (this._loading && this._loading.name === name) return this._loading.promise;

    const promise = this._loadChunk(name, onProgress);
    this._loading = { name, promise };
    try {
      const chunk = await promise;
      this.chunk = chunk;
      this.geometry = null; // 청크가 바뀌면 형상도 다시 받아야 한다
      return chunk;
    } finally {
      this._loading = null;
    }
  }

  async _loadChunk(name, onProgress) {
    const catalog = await this.getCatalog();
    const meta = (catalog.chunks || []).find(c => c.name === name);
    if (!meta) throw new Error(`도로망 '${name}'을 찾을 수 없습니다.`);

    const buf = await this._fetchBuffer(ROADNET_BASE + meta.graph, onProgress);
    const chunk = this._parseGraph(buf);
    chunk.name = name;
    chunk.meta = meta;
    chunk.index = this._buildGridIndex(chunk);
    return chunk;
  }

  /** 진행률을 알 수 있게 스트림으로 받는다 (Content-Length가 없으면 총량 0으로 통지) */
  async _fetchBuffer(url, onProgress) {
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`${url} 를 불러올 수 없습니다 (${resp.status})`);

    const total = Number(resp.headers.get('Content-Length')) || 0;
    if (!onProgress || !resp.body) return resp.arrayBuffer();

    const reader = resp.body.getReader();
    const parts = [];
    let loaded = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      parts.push(value);
      loaded += value.length;
      onProgress(loaded, total);
    }
    const out = new Uint8Array(loaded);
    let at = 0;
    parts.forEach(p => { out.set(p, at); at += p.length; });
    return out.buffer;
  }

  /** graph.bin → 타입드 배열 뷰 모음 */
  _parseGraph(buf) {
    const head = new DataView(buf);
    const magic = String.fromCharCode(head.getUint8(0), head.getUint8(1), head.getUint8(2), head.getUint8(3));
    if (magic !== 'EGRN') throw new Error('도로망 파일 형식이 아닙니다.');

    const version = head.getUint32(4, true);
    if (version !== 3) throw new Error(`지원하지 않는 도로망 버전입니다: ${version}`);

    const nodeCount = head.getUint32(8, true);
    const edgeCount = head.getUint32(12, true);
    const bbox = [
      head.getInt32(16, true), head.getInt32(20, true),
      head.getInt32(24, true), head.getInt32(28, true)
    ];
    const geomVertexCount = head.getUint32(32, true);

    let off = HEADER_BYTES;
    const view = (Type, len) => {
      const a = new Type(buf, off, len);
      off += a.byteLength;
      return a;
    };

    const nodeX = view(Int32Array, nodeCount);
    const nodeY = view(Int32Array, nodeCount);
    const mainScc = view(Uint8Array, nodeCount);
    off += align4(nodeCount) - nodeCount;
    const offsets = view(Uint32Array, nodeCount + 1);
    const targets = view(Uint32Array, edgeCount);
    const cost = view(Float32Array, edgeCount);
    const rank = view(Uint8Array, edgeCount);
    off += align4(edgeCount) - edgeCount;
    const speed = view(Uint8Array, edgeCount);   // km/h — 도보·거리 환산용
    off += align4(edgeCount) - edgeCount;
    const geomOffsets = view(Uint32Array, edgeCount + 1);

    return {
      nodeCount, edgeCount, bbox, geomVertexCount,
      nodeX, nodeY, mainScc, offsets, targets, cost, rank, speed, geomOffsets
    };
  }

  /**
   * 최근접 노드 검색용 격자 인덱스.
   * 셀 하나에 담긴 노드를 연속 배열(CSR)로 두어 메모리를 아낀다.
   */
  _buildGridIndex(chunk, cellSize = 1000) {
    const [minX, minY, maxX, maxY] = chunk.bbox;
    const cols = Math.floor((maxX - minX) / cellSize) + 1;
    const rows = Math.floor((maxY - minY) / cellSize) + 1;
    const cellCount = cols * rows;

    const cellOf = (x, y) => {
      const cx = Math.min(cols - 1, Math.max(0, Math.floor((x - minX) / cellSize)));
      const cy = Math.min(rows - 1, Math.max(0, Math.floor((y - minY) / cellSize)));
      return cy * cols + cx;
    };

    const starts = new Uint32Array(cellCount + 1);
    for (let i = 0; i < chunk.nodeCount; i++) starts[cellOf(chunk.nodeX[i], chunk.nodeY[i]) + 1]++;
    for (let i = 0; i < cellCount; i++) starts[i + 1] += starts[i];

    const cursor = starts.slice(0, cellCount);
    const items = new Uint32Array(chunk.nodeCount);
    for (let i = 0; i < chunk.nodeCount; i++) items[cursor[cellOf(chunk.nodeX[i], chunk.nodeY[i])]++] = i;

    return { minX, minY, cols, rows, cellSize, starts, items };
  }

  /**
   * 지도 좌표(EPSG:3857)에서 가장 가까운 노드를 찾는다.
   * 서로 오갈 수 있는 가장 큰 덩어리(mainScc)를 우선한다 — 말단에 붙으면
   * 한쪽 방향 경로가 아예 실패하기 때문이다.
   * @returns {{node:number, distance:number}|null}
   */
  snap(x, y, maxDistance = 3000) {
    if (!this.chunk) return null;
    const { index, nodeX, nodeY, mainScc } = this.chunk;
    const { minX, minY, cols, rows, cellSize, starts, items } = index;

    const cx = Math.floor((x - minX) / cellSize);
    const cy = Math.floor((y - minY) / cellSize);
    const maxRing = Math.ceil(maxDistance / cellSize);

    let best = -1, bestD2 = Infinity;
    let fallback = -1, fallbackD2 = Infinity;

    for (let ring = 0; ring <= maxRing; ring++) {
      // 이미 찾은 것이 이번 링의 최소 거리보다 가까우면 더 볼 필요가 없다
      if (best >= 0 && bestD2 <= ((ring - 1) * cellSize) ** 2) break;

      for (let gy = cy - ring; gy <= cy + ring; gy++) {
        if (gy < 0 || gy >= rows) continue;
        const edgeRow = (gy === cy - ring || gy === cy + ring);
        for (let gx = cx - ring; gx <= cx + ring; gx++) {
          if (gx < 0 || gx >= cols) continue;
          // 링의 테두리만 검사 (안쪽은 이전 링에서 이미 봤다)
          if (!edgeRow && gx !== cx - ring && gx !== cx + ring) continue;

          const cell = gy * cols + gx;
          for (let k = starts[cell]; k < starts[cell + 1]; k++) {
            const n = items[k];
            const dx = nodeX[n] - x, dy = nodeY[n] - y;
            const d2 = dx * dx + dy * dy;
            if (mainScc[n]) {
              if (d2 < bestD2) { bestD2 = d2; best = n; }
            } else if (d2 < fallbackD2) {
              fallbackD2 = d2; fallback = n;
            }
          }
        }
      }
    }

    const node = best >= 0 ? best : fallback;
    const d2 = best >= 0 ? bestD2 : fallbackD2;
    if (node < 0 || d2 > maxDistance * maxDistance) return null;
    return { node, distance: Math.sqrt(d2) };
  }

  /** 형상(geom.bin) 지연 로드 — 경로를 그릴 때만 필요하다 */
  async ensureGeometry(onProgress) {
    if (this.geometry) return this.geometry;
    if (!this.chunk) throw new Error('도로망이 로드되지 않았습니다.');

    const buf = await this._fetchBuffer(ROADNET_BASE + this.chunk.meta.geom, onProgress);
    const head = new DataView(buf);
    const magic = String.fromCharCode(head.getUint8(0), head.getUint8(1), head.getUint8(2), head.getUint8(3));
    if (magic !== 'EGRG') throw new Error('도로 형상 파일 형식이 아닙니다.');
    const count = head.getUint32(8, true);
    if (count !== this.chunk.geomVertexCount) {
      throw new Error('도로망과 형상 파일이 짝이 맞지 않습니다.');
    }
    this.geometry = new Int32Array(buf, 16, count * 2);
    return this.geometry;
  }

  /**
   * 엣지 하나의 도로 선형 좌표
   * @returns {number[][]} [[x,y], ...] (EPSG:3857). 형상이 없으면 노드 두 점.
   */
  edgeGeometry(edgeIndex, fromNode) {
    const c = this.chunk;
    if (!c) return [];

    // 곧은 링크는 형상을 저장하지 않는다 — 노드 두 점을 이어 그린다
    const s = this.geometry ? c.geomOffsets[edgeIndex] : 0;
    const e = this.geometry ? c.geomOffsets[edgeIndex + 1] : 0;
    if (e - s < 2) {
      if (fromNode === undefined) return [];
      const t = c.targets[edgeIndex];
      return [[c.nodeX[fromNode], c.nodeY[fromNode]], [c.nodeX[t], c.nodeY[t]]];
    }

    const out = [];
    for (let i = s; i < e; i++) out.push([this.geometry[i * 2], this.geometry[i * 2 + 1]]);
    return out;
  }

  /** 노드에서 나가는 엣지 범위 [시작, 끝) */
  edgeRange(node) {
    const c = this.chunk;
    return [c.offsets[node], c.offsets[node + 1]];
  }

  /** 메모리 해제 */
  unload() {
    this.chunk = null;
    this.geometry = null;
  }
}

export const roadNetwork = new RoadNetwork();
export { RoadNetwork };
