// © 2026 김용현
/**
 * 등시선·최단경로 패널이 공유하는 "도로망" 선택 드롭다운
 *
 * 값 형식: 'local:<청크이름>' 또는 'ors'
 * 내장 도로망 목록은 catalog.json에서 읽어 채운다 — 도로망을 새로 구우면
 * 패널 코드를 고치지 않아도 목록에 나타난다.
 */

import { listNetworks } from '../core/localRouting.js';

const ORS_OPTION = '<option value="ors">OpenRouteService (API 키 필요)</option>';

/** 목록을 받기 전에 보여 줄 기본 상태 */
export function initialNetworkOptions() {
  return '<option value="local:korea-major">내장 도로망 (불러오는 중…)</option>' + ORS_OPTION;
}

/** 'local:korea-full' → { engine: 'local', chunk: 'korea-full' } */
export function parseNetworkValue(value) {
  if (!value || value === 'ors') return { engine: 'ors', chunk: null };
  const idx = value.indexOf(':');
  return { engine: 'local', chunk: idx >= 0 ? value.slice(idx + 1) : null };
}

const mb = (bytes) => (bytes / 1024 / 1024).toFixed(0);

/**
 * catalog.json을 읽어 드롭다운을 채운다.
 * 실패해도 기본 도로망 항목은 남겨 둔다 (파일이 없으면 그때 오류가 뜬다).
 * @param {string} selectId
 */
export async function populateNetworkSelect(selectId) {
  const el = document.getElementById(selectId);
  if (!el) return;

  const previous = el.value;
  try {
    const networks = await listNetworks();
    if (!networks.length) return;

    el.innerHTML = networks.map(n => {
      const size = mb((n.graphBytes || 0) + (n.geomBytes || 0));
      return `<option value="local:${n.name}">내장 · ${n.label} · ${size}MB</option>`;
    }).join('') + ORS_OPTION;

    // 이전 선택을 유지하고, 없으면 가장 가벼운 도로망을 고른다
    const keep = [...el.options].some(o => o.value === previous);
    el.value = keep ? previous : `local:${networks[0].name}`;
  } catch (err) {
    console.warn('도로망 목록을 불러오지 못했습니다:', err);
    el.innerHTML = '<option value="local:korea-major">내장 도로망</option>' + ORS_OPTION;
    el.value = previous && [...el.options].some(o => o.value === previous) ? previous : 'local:korea-major';
  }
}
