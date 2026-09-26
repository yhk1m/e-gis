// © 2026 김용현
/**
 * TimeSeriesTool - 시계열 단계구분도 (실험실 `time-series`)
 *
 * 시계열은 단계구분도 설정에 timeSeries: { fields, index } 를 더한 것이다.
 * - apply: 모든 필드 값을 합쳐 구간을 한 번만 계산 → choroplethTool.apply(…, { breaks }) → 설정에 timeSeries.
 * - setIndex: cfg.attribute = fields[i] → layerManager.updateLayerStyle (LAYER_STYLE_CHANGED 가 자동 저장을 깨운다)
 *             → 범례 부제 갱신 → 슬라이더 갱신. 재생 중 틱은 silent 로 다시 그리기만 하고
 *             (틱마다 자동 저장·레이어 패널 다시 그리기를 깨우지 않게) 멈출 때 한 번 알린다.
 * - 컨트롤은 #map 안 지도 아래 가운데, 한 번에 하나(가장 최근 시계열 레이어).
 * 저장(애니메이션)은 onSave 훅으로 밖(main.js → AnimationExportDialog)에 맡긴다 — 대화상자가
 * 이 도구를 import 하므로 여기서 대화상자를 import 하면 순환이 된다.
 * 설계: docs/superpowers/specs/2026-09-25-labs-design.md 「4단계」
 */
import { layerManager } from '../core/LayerManager.js';
import { eventBus, Events } from '../utils/EventBus.js';
import { choroplethTool } from './ChoroplethTool.js';
import {
  unionValues, nextIndex, subtitleFor, derivedLayerName, MAX_TIME_SERIES_FIELDS
} from './timeSeriesModel.js';

/** 1× 재생 간격 (스펙: 1.2초, 반복) */
export const BASE_INTERVAL_MS = 1200;
export const SPEEDS = [0.5, 1, 2];

// 아이콘은 선 SVG (UI 에 이모지·채운 도형 대신)
const ICON_PLAY = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" aria-hidden="true"><polygon points="7 4 19 12 7 20"/></svg>`;
const ICON_PAUSE = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><line x1="9" y1="5" x2="9" y2="19"/><line x1="15" y1="5" x2="15" y2="19"/></svg>`;
const ICON_CLOSE = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;

class TimeSeriesTool {
  constructor() {
    this.layerId = null;
    this.controls = null;
    this.timer = null;
    this.speed = 1;
    /** @type {((layerId: string) => void)|null} 저장 버튼 훅 — main.js 가 넣는다 */
    this.onSave = null;

    eventBus.on(Events.LAYER_REMOVED, (data) => {
      if (data && data.layerId === this.layerId) this.detach();
    });
  }

  /**
   * @param {{layerId: string, fields: string[], method?: string, numClasses?: number,
   *          colorRamp?: string, reverse?: boolean, customColors?: string[]|null}} options
   * @returns {string|null} 파생 레이어 id
   */
  apply({ layerId, fields, method = 'equalInterval', numClasses = 5, colorRamp = 'blues', reverse = false, customColors = null }) {
    const source = layerManager.getLayer(layerId);
    if (!source || !source.source) return null;
    const list = (fields || []).slice(0, MAX_TIME_SERIES_FIELDS);
    if (list.length < 2) return null;

    // 구간은 모든 연도의 값을 합쳐 한 번만 — 연도 사이 비교가 되려면 구간이 같아야 한다
    const values = unionValues(source.source.getFeatures(), list);
    if (values.length < 2) return null;
    // choroplethTool.apply 는 길이가 정확히 계급 수 + 1 인 구간만 받는다(아니면 첫 필드 값으로 다시
    // 계산해 버려 연도 사이 구간이 어긋난다). 자연 구분점은 값이 계급 수보다 적으면 짧은 배열을
    // 돌려주므로 계급 수를 값 개수로 줄인다. 색 보간이 2 이상을 기대하므로 최소 2.
    let classes = Math.max(2, Math.floor(Number(numClasses)) || 5);
    if (method === 'naturalBreaks') classes = Math.min(classes, values.length);
    const breaks = choroplethTool.calculateBreaks(values, classes, method);
    if (breaks.length !== classes + 1 || !breaks.every(Number.isFinite)) return null;

    const result = choroplethTool.apply(layerId, list[0], colorRamp, method, classes, {
      reverse,
      customColors,
      breaks,
      name: derivedLayerName(source.name, list),
      title: `${source.name} (${list[0]}~${list[list.length - 1]})`
    });
    if (!result) return null;

    const info = layerManager.getLayer(result.layerId);
    info._choroplethConfig.timeSeries = { fields: list, index: 0 };
    this.attachControls(result.layerId);
    this.setIndex(0);
    return result.layerId;
  }

  /** 시계열 설정(없으면 null) */
  config(layerId = this.layerId) {
    const info = layerId ? layerManager.getLayer(layerId) : null;
    const cfg = info && info._choroplethConfig;
    return cfg && cfg.timeSeries ? cfg : null;
  }

  setIndex(index) {
    const cfg = this.config();
    if (!cfg) return;
    const n = cfg.timeSeries.fields.length;
    const idx = Math.max(0, Math.min(n - 1, Number.isInteger(index) ? index : 0));
    cfg.timeSeries.index = idx;
    cfg.attribute = cfg.timeSeries.fields[idx];
    // LAYER_STYLE_CHANGED → 자동 저장. 재생 중이면 조용히 — pause/detach 가 한 번 낸다
    layerManager.updateLayerStyle(this.layerId, { silent: this.isPlaying() });
    this.updateLegendSubtitle(cfg);
    this.renderControls(cfg);
  }

  step() {
    const cfg = this.config();
    if (!cfg) return;
    this.setIndex(nextIndex(cfg.timeSeries.index, cfg.timeSeries.fields.length));
  }

  isPlaying() {
    return this.timer !== null;
  }

  play() {
    if (!this.config()) return;
    // 속도 바꾸기로 다시 시작할 때는 pause() 를 거치지 않는다 — 멈춘 게 아니니 알릴 것도 없다
    if (this.timer !== null) clearInterval(this.timer);
    this.timer = setInterval(() => this.step(), BASE_INTERVAL_MS / this.speed);
    this.renderControls(this.config());
  }

  pause() {
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
      this.notifyStyleChanged();   // 재생 틱은 조용했다 — 멈춘 자리를 한 번 저장하게
    }
    const cfg = this.config();
    if (cfg) this.renderControls(cfg);
  }

  /** 재생이 끝났을 때 한 번 — 자동 저장·레이어 패널이 마지막 연도를 잡는다 (레이어가 남아 있을 때만) */
  notifyStyleChanged() {
    if (this.layerId && layerManager.getLayer(this.layerId)) {
      eventBus.emit(Events.LAYER_STYLE_CHANGED, { layerId: this.layerId });
    }
  }

  setSpeed(speed) {
    this.speed = SPEEDS.includes(speed) ? speed : 1;
    if (this.isPlaying()) this.play();   // 새 간격으로 다시
  }

  /** 범례 제목 아래 부제 — 없으면 만든다 (ChoroplethTool.createLegend 는 부제를 안 만든다) */
  updateLegendSubtitle(cfg) {
    const legend = document.getElementById(`choropleth-legend-${this.layerId}`);
    if (!legend) return;
    let sub = legend.querySelector('.choropleth-legend-subtitle');
    if (!sub) {
      sub = document.createElement('div');
      sub.className = 'choropleth-legend-subtitle';
      const title = legend.querySelector('.choropleth-legend-title');
      if (title) title.insertAdjacentElement('afterend', sub);
      else legend.prepend(sub);
    }
    sub.textContent = subtitleFor(cfg.attribute, cfg.timeSeries.index, cfg.timeSeries.fields.length);
  }

  /** 컨트롤 박스를 #map 에 만든다 (이미 있으면 갈아 끼운다) */
  attachControls(layerId) {
    this.detach();
    const map = document.getElementById('map');
    if (!map) { this.layerId = layerId; return; }
    this.layerId = layerId;

    const box = document.createElement('div');
    box.className = 'time-series-controls';
    box.id = 'time-series-controls';
    box.innerHTML = `
      <button type="button" class="btn-icon ts-play" id="ts-play" title="재생" aria-pressed="false">${ICON_PLAY}</button>
      <input type="range" id="ts-range" min="0" max="0" step="1" value="0" aria-label="연도">
      <span class="time-series-field" id="ts-field"></span>
      <select id="ts-speed" aria-label="재생 속도">
        ${SPEEDS.map((s) => `<option value="${s}"${s === this.speed ? ' selected' : ''}>${s}×</option>`).join('')}
      </select>
      <button type="button" class="btn btn-sm btn-outline" id="ts-save">저장</button>
      <button type="button" class="btn-icon" id="ts-close" title="닫기">${ICON_CLOSE}</button>
    `;
    map.appendChild(box);
    this.controls = box;

    box.querySelector('#ts-play').addEventListener('click', () => (this.isPlaying() ? this.pause() : this.play()));
    box.querySelector('#ts-range').addEventListener('input', (e) => {
      // 값을 먼저 읽는다 — pause() 가 컨트롤을 다시 그리며 슬라이더를 현재 인덱스로 되돌린다
      const index = parseInt(e.target.value, 10);
      this.pause();
      this.setIndex(index);
    });
    box.querySelector('#ts-speed').addEventListener('change', (e) => this.setSpeed(parseFloat(e.target.value)));
    box.querySelector('#ts-save').addEventListener('click', () => {
      this.pause();
      if (this.onSave) this.onSave(this.layerId);
    });
    box.querySelector('#ts-close').addEventListener('click', () => this.detach());

    const cfg = this.config();
    if (cfg) this.renderControls(cfg);
  }

  renderControls(cfg) {
    if (!this.controls || !cfg) return;
    const { fields, index } = cfg.timeSeries;
    const range = this.controls.querySelector('#ts-range');
    range.max = String(fields.length - 1);
    range.value = String(index);
    this.controls.querySelector('#ts-field').textContent = fields[index];
    const play = this.controls.querySelector('#ts-play');
    const playing = this.isPlaying();
    play.innerHTML = playing ? ICON_PAUSE : ICON_PLAY;
    play.title = playing ? '일시정지' : '재생';
    play.setAttribute('aria-pressed', playing ? 'true' : 'false');
  }

  /** 컨트롤을 없애고 재생을 멈춘다. 레이어(정적 단계구분도)는 그대로 둔다. */
  detach() {
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
      this.notifyStyleChanged();
    }
    if (this.controls) {
      this.controls.remove();
      this.controls = null;
    }
    this.layerId = null;
  }

  /**
   * 복원 뒤(PROJECT_LOADED·STATE_RESTORED) 또는 실험을 켤 때: timeSeries 가 있는
   * 레이어(위에서부터 첫 번째)를 찾아 컨트롤을 되살린다.
   * @returns {string|null} 되살린 레이어 id
   */
  restoreControls() {
    const layers = layerManager.getAllLayers().slice().reverse();
    const target = layers.find((l) => l._choroplethConfig && l._choroplethConfig.timeSeries);
    if (!target) return null;
    this.attachControls(target.id);
    this.setIndex(target._choroplethConfig.timeSeries.index);
    return target.id;
  }
}

export const timeSeriesTool = new TimeSeriesTool();
