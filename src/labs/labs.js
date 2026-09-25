// © 2026 김용현
/**
 * 실험실 상태 — 어떤 실험이 켜져 있는지만 안다.
 *
 * DOM·OpenLayers 를 모른다. storage(localStorage 모양)와 search(location.search)를
 * 주입받아 노드에서 그대로 테스트한다.
 *
 * 우선순위: URL 덮어쓰기(?lab=) > 저장값(eGIS_labs) > 꺼짐.
 * 레지스트리(knownIds)에 없는 id 는 언제나 꺼짐 — 아직 구현 안 된 실험을
 * 저장값이나 URL 로 켤 수 없고, 승격 뒤 남은 저장값도 그냥 무시된다.
 * 설계: docs/superpowers/specs/2026-09-25-labs-design.md
 */

export const LABS_STORAGE_KEY = 'eGIS_labs';
export const LAB_QUERY_PARAM = 'lab';

/**
 * ?lab=… 을 읽는다.
 * @param {string} search location.search
 * @param {string[]} knownIds 레지스트리의 id 들
 * @returns {Object<string, boolean>|null} 덮어쓸 id → 켜짐. 매개변수가 없으면 null.
 */
export function parseLabQuery(search, knownIds) {
  const params = new URLSearchParams(search || '');
  const raw = params.get(LAB_QUERY_PARAM);
  if (raw === null) return null;
  const value = raw.trim();
  if (value === 'all') return Object.fromEntries(knownIds.map((id) => [id, true]));
  if (value === 'none') return Object.fromEntries(knownIds.map((id) => [id, false]));
  const wanted = new Set(value.split(',').map((s) => s.trim()).filter(Boolean));
  const override = {};
  knownIds.forEach((id) => { if (wanted.has(id)) override[id] = true; });
  return override;
}

function readStored(storage) {
  try {
    const raw = storage ? storage.getItem(LABS_STORAGE_KEY) : null;
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function writeStored(storage, state) {
  try {
    if (storage) storage.setItem(LABS_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // 사생활 모드·용량 초과 — 세션 안에서만 유지된다
  }
}

export class Labs {
  constructor() {
    this.knownIds = [];
    this.stored = {};
    this.override = {};
    this.storage = null;
    this.baseUrl = '';
    this.listeners = new Set();
  }

  /**
   * @param {{search?: string, storage?: Storage|null, knownIds?: string[], baseUrl?: string}} options
   */
  init({ search = '', storage = null, knownIds = [], baseUrl = '' } = {}) {
    this.knownIds = knownIds.slice();
    this.storage = storage;
    this.baseUrl = baseUrl;
    this.stored = readStored(storage);
    this.override = parseLabQuery(search, this.knownIds) || {};
  }

  isKnown(id) {
    return this.knownIds.includes(id);
  }

  isOn(id) {
    if (!this.isKnown(id)) return false;
    if (Object.prototype.hasOwnProperty.call(this.override, id)) return this.override[id];
    return this.stored[id] === true;
  }

  set(id, on) {
    if (!this.isKnown(id)) return;
    const next = Boolean(on);
    delete this.override[id];
    this.stored[id] = next;
    writeStored(this.storage, this.stored);
    this.listeners.forEach((cb) => cb(id, next));
  }

  toggle(id) {
    this.set(id, !this.isOn(id));
  }

  /** 켜진 실험 id — 레지스트리 순서 */
  enabledIds() {
    return this.knownIds.filter((id) => this.isOn(id));
  }

  /** 켜진 상태 그대로 여는 주소 (시연·테스터 링크) */
  shareUrl() {
    const ids = this.enabledIds();
    return ids.length ? `${this.baseUrl}?${LAB_QUERY_PARAM}=${ids.join(',')}` : this.baseUrl;
  }

  /**
   * @param {(id: string, on: boolean) => void} cb
   * @returns {() => void} 해제 함수
   */
  onChange(cb) {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }
}

export const labs = new Labs();
