// © 2026 김용현
/**
 * 등시선·최단경로 패널이 공유하는 "도로망" 선택 드롭다운
 *
 * 값 형식: 'local:<청크이름>'
 * 내장 도로망 목록은 catalog.json에서 읽어 채운다 — 도로망을 새로 구우면
 * 패널 코드를 고치지 않아도 목록에 나타난다.
 *
 * OpenRouteService(API 방식)는 목록에서 뺐다. 도구 쪽 코드는 남아 있으니
 * 다시 쓰려면 여기에 'ors' 항목만 되살리면 된다.
 */

import { listNetworks } from '../core/localRouting.js';

/**
 * catalog.json을 못 읽어도 목록이 비지 않도록 두는 기본 도로망.
 * catalog.json을 읽으면 그 내용으로 갈아 끼운다.
 */
const FALLBACK_NETWORKS = [
  { name: 'korea-major', label: '전국 주요도로 (고속·국도·지방도·시도)' },
  { name: 'korea-full', label: '전국 전체 도로 (시군도·골목 포함)' }
];

const toOptions = (networks) => networks
  .map(n => `<option value="local:${n.name}">${n.label}</option>`)
  .join('');

/** 목록을 받기 전에 보여 줄 기본 상태 */
export function initialNetworkOptions() {
  return toOptions(FALLBACK_NETWORKS);
}

/** 'local:korea-full' → { engine: 'local', chunk: 'korea-full' } */
export function parseNetworkValue(value) {
  if (value === 'ors') return { engine: 'ors', chunk: null };
  if (!value) return { engine: 'local', chunk: null };
  const idx = value.indexOf(':');
  return { engine: 'local', chunk: idx >= 0 ? value.slice(idx + 1) : null };
}

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

    el.innerHTML = toOptions(networks);

    // 이전 선택을 유지하고, 없으면 가장 가벼운 도로망을 고른다
    const keep = [...el.options].some(o => o.value === previous);
    el.value = keep ? previous : `local:${networks[0].name}`;
  } catch (err) {
    // 목록을 못 읽어도 기본 도로망은 그대로 고를 수 있게 둔다
    console.warn('도로망 목록을 불러오지 못했습니다:', err);
    el.innerHTML = toOptions(FALLBACK_NETWORKS);
    el.value = previous && [...el.options].some(o => o.value === previous) ? previous : 'local:korea-major';
  }
}
