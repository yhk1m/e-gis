// © 2026 김용현
/**
 * RouterEngine - 도로망 그래프 위의 경로탐색
 *
 * - shortestPath: A* (휴리스틱 = 직선거리 ÷ 최고속도)
 * - reachable   : 비용 제한 다익스트라 (등시선용 확산)
 *
 * OpenLayers를 import하지 않는다 — Node에서도 그대로 돌려 검증할 수 있게.
 * 좌표는 EPSG:3857 정수 미터. 3857은 우리 위도에서 실제 거리보다 약 1.25배
 * 부풀기 때문에, 휴리스틱을 만들 때 그만큼 나눠 준다(과대평가하면 A*가
 * 최단경로를 놓친다).
 */

const MERCATOR_STRETCH = 1.25;      // 위도 37도 부근 왜곡 보정
const HEURISTIC_SPEED = 120 / 3.6;  // m/s — 실제 최고속도보다 넉넉히 잡아야 안전하다

/** 최소 힙 (키 Float32, 값 Int32) */
class MinHeap {
  constructor(capacity = 1024) {
    this.keys = new Float32Array(capacity);
    this.vals = new Int32Array(capacity);
    this.size = 0;
  }

  clear() { this.size = 0; }

  _grow() {
    const k = new Float32Array(this.keys.length * 2);
    const v = new Int32Array(this.vals.length * 2);
    k.set(this.keys); v.set(this.vals);
    this.keys = k; this.vals = v;
  }

  push(key, val) {
    if (this.size === this.keys.length) this._grow();
    let i = this.size++;
    this.keys[i] = key; this.vals[i] = val;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (this.keys[parent] <= this.keys[i]) break;
      this._swap(i, parent);
      i = parent;
    }
  }

  pop() {
    const topKey = this.keys[0], topVal = this.vals[0];
    this.size--;
    if (this.size > 0) {
      this.keys[0] = this.keys[this.size];
      this.vals[0] = this.vals[this.size];
      let i = 0;
      for (;;) {
        const l = i * 2 + 1, r = l + 1;
        let small = i;
        if (l < this.size && this.keys[l] < this.keys[small]) small = l;
        if (r < this.size && this.keys[r] < this.keys[small]) small = r;
        if (small === i) break;
        this._swap(i, small);
        i = small;
      }
    }
    return { key: topKey, val: topVal };
  }

  _swap(a, b) {
    const k = this.keys[a]; this.keys[a] = this.keys[b]; this.keys[b] = k;
    const v = this.vals[a]; this.vals[a] = this.vals[b]; this.vals[b] = v;
  }
}

/**
 * 이동 수단별 규칙
 * - car : 링크에 저장된 통행시간(제한속도 기준) 그대로
 * - foot: 링크 길이를 도보 속도로 다시 환산. 고속국도·도시고속국도는 걸을 수 없어 제외
 */
export const PROFILES = {
  car: { label: '승용차', speedMps: null, excludeRanks: [] },
  foot: { label: '도보', speedMps: 4 / 3.6, excludeRanks: [1, 2] }
};

/** 고속국도·도시고속국도 등급 (자전거·도보 등은 지날 수 없다) */
export const HIGHWAY_RANKS = [1, 2];

/**
 * 사용자가 시속을 직접 정하는 프로파일
 * @param {number} speedKmh 이동 속도(km/h)
 * @param {boolean} excludeHighway 고속도로 제외 여부
 */
export function speedProfile(speedKmh, excludeHighway = false) {
  return {
    label: `${speedKmh}km/h`,
    speedMps: Math.max(0.1, speedKmh) / 3.6,
    excludeRanks: excludeHighway ? HIGHWAY_RANKS : []
  };
}

class RouterEngine {
  /** @param {object} chunk RoadNetwork.chunk (배열 뷰 모음) */
  constructor(chunk, profile = 'car') {
    this.chunk = chunk;
    this.setProfile(profile);
    const n = chunk.nodeCount;
    // 매 탐색마다 배열을 지우지 않고 "세대 번호"로 유효성을 판단한다
    this.dist = new Float32Array(n);
    this.prevNode = new Int32Array(n);
    this.prevEdge = new Int32Array(n);
    this.stamp = new Uint32Array(n);
    this.generation = 0;
    this.heap = new MinHeap(1 << 16);
  }

  /**
   * 이동 수단 변경
   * @param {string|object} profile 'car' | 'foot' | speedProfile(...)이 만든 객체
   */
  setProfile(profile) {
    if (profile && typeof profile === 'object' && typeof profile.speedMps === 'number') {
      this.profileName = profile.label || 'custom';
      this.profile = { excludeRanks: [], ...profile };
      return;
    }
    this.profileName = PROFILES[profile] ? profile : 'car';
    this.profile = PROFILES[this.profileName];
  }

  /**
   * 엣지 통행시간(초). 지날 수 없으면 Infinity.
   * 도보는 저장된 자동차 통행시간을 길이로 되돌린 뒤 도보 속도로 다시 계산한다
   * (길이 = 통행시간 × 제한속도).
   */
  costOf(edge) {
    const c = this.chunk;
    const p = this.profile;
    if (p.excludeRanks.length && p.excludeRanks.includes(c.rank[edge])) return Infinity;
    if (!p.speedMps) return c.cost[edge];
    const meters = c.cost[edge] * (c.speed[edge] / 3.6);
    return meters / p.speedMps;
  }

  /** 엣지 길이(m) */
  lengthOf(edge) {
    const c = this.chunk;
    return c.cost[edge] * (c.speed[edge] / 3.6);
  }

  _begin() {
    this.generation++;
    this.heap.clear();
    return this.generation;
  }

  _distOf(node, gen) {
    return this.stamp[node] === gen ? this.dist[node] : Infinity;
  }

  /** 두 노드 사이 직선거리(실제 미터 근사) */
  _straight(a, b) {
    const c = this.chunk;
    const dx = c.nodeX[a] - c.nodeX[b];
    const dy = c.nodeY[a] - c.nodeY[b];
    return Math.sqrt(dx * dx + dy * dy) / MERCATOR_STRETCH;
  }

  /**
   * 최단시간 경로 (A*)
   * @returns {{seconds:number, nodes:number[], edges:number[]}|null}
   */
  shortestPath(from, to) {
    const c = this.chunk;
    if (from === to) return { seconds: 0, nodes: [from], edges: [] };

    const gen = this._begin();
    // 휴리스틱 속도는 실제 최고속도보다 빨라야 안전하다. 도보는 도보 속도로.
    const hSpeed = this.profile.speedMps || HEURISTIC_SPEED;

    this.dist[from] = 0;
    this.stamp[from] = gen;
    this.prevNode[from] = -1;
    this.prevEdge[from] = -1;
    this.heap.push(this._straight(from, to) / hSpeed, from);

    const done = new Set();
    while (this.heap.size > 0) {
      const { val: node } = this.heap.pop();
      if (done.has(node)) continue;
      done.add(node);
      if (node === to) return this._buildPath(from, to, gen);

      const base = this._distOf(node, gen);
      for (let e = c.offsets[node]; e < c.offsets[node + 1]; e++) {
        const step = this.costOf(e);
        if (!isFinite(step)) continue;
        const next = c.targets[e];
        const nd = base + step;
        if (nd < this._distOf(next, gen)) {
          this.dist[next] = nd;
          this.stamp[next] = gen;
          this.prevNode[next] = node;
          this.prevEdge[next] = e;
          this.heap.push(nd + this._straight(next, to) / hSpeed, next);
        }
      }
    }
    return null; // 도달 불가
  }

  _buildPath(from, to, gen) {
    const nodes = [], edges = [];
    let cur = to;
    while (cur !== -1 && cur !== from) {
      nodes.push(cur);
      edges.push(this.prevEdge[cur]);
      cur = this.prevNode[cur];
    }
    nodes.push(from);
    nodes.reverse();
    edges.reverse();

    let meters = 0;
    edges.forEach(e => { meters += this.lengthOf(e); });
    return { seconds: this.dist[to], meters, nodes, edges };
  }

  /**
   * 제한 시간 안에 닿는 범위 (등시선용)
   * @param {number} from 출발 노드
   * @param {number} maxSeconds 제한 시간(초)
   * @returns {{nodes:number[], times:Float32Array, edgeTips:Array<[number,number,number,number]>}}
   *   edgeTips: 시간이 모자라 중간까지만 간 지점 [x, y, 도달시간, 출발노드]
   *             — 출발노드까지 함께 넘겨야 그 구간을 이어서 그릴 수 있다
   */
  reachable(from, maxSeconds) {
    const c = this.chunk;
    const gen = this._begin();
    this.dist[from] = 0;
    this.stamp[from] = gen;
    this.heap.push(0, from);

    const settled = [];
    const times = [];
    const edgeTips = [];
    const done = new Uint8Array(0); // 사용하지 않음 — stamp로 판단
    const finalized = new Set();

    while (this.heap.size > 0) {
      const { key, val: node } = this.heap.pop();
      if (finalized.has(node)) continue;
      if (key > maxSeconds) break;
      finalized.add(node);
      settled.push(node);
      times.push(key);

      for (let e = c.offsets[node]; e < c.offsets[node + 1]; e++) {
        const step = this.costOf(e);
        if (!isFinite(step)) continue;
        const next = c.targets[e];
        const nd = key + step;
        if (nd > maxSeconds) {
          // 이 엣지 중간에서 시간이 끝난다 — 그 지점을 경계 후보로 남긴다
          const ratio = (maxSeconds - key) / step;
          if (ratio > 0 && ratio < 1) {
            const x = c.nodeX[node] + (c.nodeX[next] - c.nodeX[node]) * ratio;
            const y = c.nodeY[node] + (c.nodeY[next] - c.nodeY[node]) * ratio;
            edgeTips.push([x, y, maxSeconds, node]);
          }
          continue;
        }
        if (nd < this._distOf(next, gen)) {
          this.dist[next] = nd;
          this.stamp[next] = gen;
          this.heap.push(nd, next);
        }
      }
    }

    return { nodes: settled, times: Float32Array.from(times), edgeTips };
  }
}

export { RouterEngine, MinHeap };
