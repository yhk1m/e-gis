// © 2026 김용현
/**
 * 3D 보기 컨트롤 — 토글 버튼, 세로 과장 슬라이더, PNG 저장.
 *
 * three와 3D 조립부는 버튼을 누른 순간 처음 내려받는다(동적 import).
 * 3D를 쓰지 않는 사용자는 한 바이트도 받지 않는다.
 */

import { FLAT } from '../../view3d/terrainSource.js';

export class View3DPanel {
  constructor({ mapManager, layerManager, onMessage }) {
    this.mapManager = mapManager;
    this.layerManager = layerManager;
    this.onMessage = onMessage || (() => {});
    this.controller = null;
  }

  init() {
    this.toggleButton = document.getElementById('view3d-toggle');
    this.panel = document.getElementById('view3d-panel');
    this.slider = document.getElementById('view3d-exaggeration');
    this.sliderValue = document.getElementById('view3d-exaggeration-value');
    this.saveButton = document.getElementById('view3d-save');
    this.terrainSelect = document.getElementById('view3d-terrain');
    this.basemapSelect = document.getElementById('view3d-basemap');
    if (!this.toggleButton) return;

    if (!supportsWebGL()) {
      this.toggleButton.disabled = true;
      this.toggleButton.title = '이 브라우저에서는 3D를 쓸 수 없습니다 (WebGL 미지원)';
      return;
    }

    // 토글 클릭은 main.js의 툴바 [data-tool] 스위치가 부른다 — 여기서 또 듣지 않는다
    this.slider.addEventListener('input', () => {
      const value = Number(this.slider.value);
      this.sliderValue.textContent = `${value}배`;
      this.controller?.setExaggeration(value);
    });
    this.saveButton.addEventListener('click', () => this.savePng());
    this.terrainSelect.addEventListener('change', () => {
      this.controller?.setTerrainSource(this.terrainSelect.value || null);
    });
    this.basemapSelect.addEventListener('change', () => {
      this.controller?.setBasemap(this.basemapSelect.value);
    });
  }

  async toggle() {
    if (this.controller) {
      this.controller.exit();
      this.controller = null;
      this.panel.hidden = true;
      this.toggleButton.classList.remove('active');
      this.toggleButton.setAttribute('aria-pressed', 'false');
      this.toggleButton.title = '3D로 보기';
      return;
    }

    this.toggleButton.disabled = true;
    try {
      const { View3DController } = await import('../../view3d/View3DController.js');
      this.controller = new View3DController({
        mapManager: this.mapManager,
        layerManager: this.layerManager,
        container: document.getElementById('map-container')
      });
      this.controller.exaggeration = Number(this.slider.value);
      this.controller.enter();
      this.fillTerrainOptions();
      this.basemapSelect.value = this.mapManager.getBasemap?.() || 'OSM';

      this.panel.hidden = false;
      this.toggleButton.classList.add('active');
      this.toggleButton.setAttribute('aria-pressed', 'true');
      this.toggleButton.title = '2D로 돌아가기';

      if (!this.controller.findDemData()) {
        this.onMessage('DEM(수치표고모델) 레이어가 없어 평평한 바닥에 지도를 얹었습니다.');
      }
    } catch (error) {
      console.error('3D 보기를 열지 못했습니다', error);
      this.onMessage('3D 보기를 열지 못했습니다.');
      this.controller = null;
    } finally {
      this.toggleButton.disabled = false;
    }
  }

  /** 지형 드롭다운을 지금 있는 DEM 레이어로 채운다 */
  fillTerrainOptions() {
    const sources = this.controller.listTerrainSources();
    const options = sources.map(
      (s) => `<option value="${s.id}">${escapeHtml(s.name)}</option>`
    );
    this.terrainSelect.innerHTML = `<option value="${FLAT}">평면 (고도 없음)</option>${options.join('')}`;
    // 자동 선택된 DEM을 골라 둔다 — 무엇이 지형이 됐는지 보이게
    const picked = sources[sources.length - 1];
    this.terrainSelect.value = picked ? picked.id : FLAT;
    this.terrainSelect.disabled = sources.length === 0;
  }

  savePng() {
    const dataUrl = this.controller?.toDataURL();
    if (!dataUrl) return;
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = `egis-3d-${Date.now()}.png`;
    link.click();
  }
}

/** 레이어 이름은 사용자가 지은 것이라 그대로 심지 않는다 */
function escapeHtml(text) {
  return String(text).replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[ch]));
}

/** WebGL을 쓸 수 있는가 */
export function supportsWebGL() {
  try {
    const canvas = document.createElement('canvas');
    return Boolean(canvas.getContext('webgl2') || canvas.getContext('webgl'));
  } catch {
    return false;
  }
}
