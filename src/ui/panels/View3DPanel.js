// © 2026 김용현
/**
 * 3D 보기 컨트롤 — 토글 버튼, 세로 과장 슬라이더, PNG 저장.
 *
 * three와 3D 조립부는 버튼을 누른 순간 처음 내려받는다(동적 import).
 * 3D를 쓰지 않는 사용자는 한 바이트도 받지 않는다.
 */

import { FLAT, ALL } from '../../view3d/terrainSource.js';
import { isStaleModuleError } from '../../view3d/staleModule.js';

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
    this.hidePivotCheck = document.getElementById('view3d-hide-pivot');
    this.compass = document.getElementById('view3d-compass');
    this.compassNeedle = document.getElementById('view3d-compass-needle');
    if (!this.toggleButton) return;

    if (!supportsWebGL()) {
      this.toggleButton.disabled = true;
      this.toggleButton.title = '이 브라우저에서는 3D를 쓸 수 없습니다 (WebGL 미지원)';
      return;
    }

    // 토글 클릭은 main.js의 툴바 [data-tool] 스위치가 부른다 — 여기서 또 듣지 않는다
    this.slider.addEventListener('input', () => {
      this.applyExaggeration(Number(this.slider.value), { from: 'slider' });
    });
    // 슬라이더 범위(1~10)를 넘는 값도 숫자로 직접 넣을 수 있다
    this.sliderValue.addEventListener('change', () => {
      this.applyExaggeration(Number(this.sliderValue.value), { from: 'number' });
    });
    this.saveButton.addEventListener('click', () => this.savePng());
    this.terrainSelect.addEventListener('change', () => {
      this.controller?.setTerrainSource(this.terrainSelect.value || ALL);
    });
    this.basemapSelect.addEventListener('change', () => {
      this.controller?.setBasemap(this.basemapSelect.value);
    });
    this.hidePivotCheck.addEventListener('change', () => {
      this.controller?.setPivotMarkerVisible(!this.hidePivotCheck.checked);
    });
  }

  async toggle() {
    if (this.controller) {
      this.controller.exit();
      this.controller = null;
      this.panel.hidden = true;
      this.compass.hidden = true;
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
      this.controller.exaggeration = Number(this.sliderValue.value) || 2;
      this.controller.pivotMarkerVisible = !this.hidePivotCheck.checked;
      this.controller.onLayersChanged = () => this.fillTerrainOptions();
      this.controller.onCameraMoved = (bearing) => this.setCompass(bearing);
      this.controller.enter();
      this.fillTerrainOptions();
      this.basemapSelect.value = this.mapManager.getBasemap?.() || 'OSM';

      this.panel.hidden = false;
      this.compass.hidden = false;
      this.toggleButton.classList.add('active');
      this.toggleButton.setAttribute('aria-pressed', 'true');
      this.toggleButton.title = '2D로 돌아가기';

      if (!this.controller.findDems().length) {
        this.onMessage('DEM(수치표고모델) 레이어가 없어 평평한 바닥에 지도를 얹었습니다.');
      }
    } catch (error) {
      console.error('3D 보기를 열지 못했습니다', error);
      this.controller = null;

      // 탭을 열어 둔 사이에 새 버전이 배포되면 옛 청크를 부르다 실패한다.
      // 코드 잘못이 아니라 새로고침이 필요한 상황이라 따로 안내한다.
      if (isStaleModuleError(error)) {
        this.onMessage('새 버전이 배포되어 3D 모듈을 불러오지 못했습니다. 새로고침이 필요합니다.');
        if (window.confirm('새 버전이 배포되었습니다. 지금 새로고침할까요?')) {
          window.location.reload();
        }
      } else {
        this.onMessage('3D 보기를 열지 못했습니다.');
      }
    } finally {
      this.toggleButton.disabled = false;
    }
  }

  /**
   * 세로 과장 배율을 적용하고 슬라이더·숫자칸을 맞춘다.
   * 숫자칸은 슬라이더 범위를 넘어설 수 있다 — 슬라이더는 끝에 붙여 둔다.
   */
  applyExaggeration(raw, { from }) {
    const min = Number(this.sliderValue.min) || 0.1;
    const max = Number(this.sliderValue.max) || 100;
    const value = Number.isFinite(raw) ? Math.min(max, Math.max(min, raw)) : 2;

    if (from !== 'number') this.sliderValue.value = String(value);
    if (from !== 'slider') {
      const sliderMin = Number(this.slider.min);
      const sliderMax = Number(this.slider.max);
      this.slider.value = String(Math.min(sliderMax, Math.max(sliderMin, value)));
    }
    if (raw !== value) this.sliderValue.value = String(value);

    this.controller?.setExaggeration(value);
  }

  /**
   * 방위표시를 돌린다. 카메라가 보는 방위의 **반대로** 돌려야
   * 화면에서 북쪽이 어디인지 가리킨다 — 동쪽을 보면 북쪽은 왼쪽이다.
   */
  setCompass(bearing) {
    if (!this.compassNeedle) return;
    const degrees = (-bearing * 180) / Math.PI;
    this.compassNeedle.style.transform = `rotate(${degrees.toFixed(1)}deg)`;
  }

  /** 지형 드롭다운을 지금 있는 DEM 레이어로 채운다 */
  fillTerrainOptions() {
    const sources = this.controller.listTerrainSources();
    const previous = this.terrainSelect.value;
    const options = sources.map(
      (s) => `<option value="${s.id}">${escapeHtml(s.name)}</option>`
    );
    // 기본은 전체 — 시군구처럼 나뉜 DEM을 여러 장 불러오면 하나로 이어 붙는다
    const allOption = sources.length > 1
      ? `<option value="${ALL}">전체 (${sources.length}개 이어 붙이기)</option>`
      : `<option value="${ALL}">전체</option>`;
    this.terrainSelect.innerHTML =
      `${allOption}<option value="${FLAT}">평면 (고도 없음)</option>${options.join('')}`;

    // 고른 값이 아직 살아 있으면 지킨다. 없으면 자동으로 고른 DEM을 보여 준다.
    const stillThere = previous && [...this.terrainSelect.options].some((o) => o.value === previous);
    this.terrainSelect.value = stillThere ? previous : ALL;
    this.terrainSelect.disabled = sources.length === 0;
  }

  /**
   * 3D 화면을 PNG로 저장한다. 화면에 떠 있는 방위·축척·범례도 함께 담는다.
   *
   * 이 요소들은 DOM이라 WebGL 캔버스에는 들어 있지 않다. 각각을 그림으로 떠서
   * 화면에 놓인 자리 그대로 얹는다 — 보이는 대로 저장된다.
   */
  async savePng() {
    const canvas = this.controller?.renderFrame();
    if (!canvas) return;

    this.saveButton.disabled = true;
    try {
      const composed = await this.composeWithOverlays(canvas);
      const link = document.createElement('a');
      link.href = composed.toDataURL('image/png');
      link.download = `egis-3d-${Date.now()}.png`;
      link.click();
    } catch (error) {
      console.error('3D 화면을 저장하지 못했습니다', error);
      this.onMessage('3D 화면을 저장하지 못했습니다.');
    } finally {
      this.saveButton.disabled = false;
    }
  }

  /** 3D 캔버스 위에 화면의 오버레이를 합성한 캔버스를 만든다 */
  async composeWithOverlays(canvas) {
    const output = document.createElement('canvas');
    output.width = canvas.width;
    output.height = canvas.height;
    const ctx = output.getContext('2d');
    ctx.drawImage(canvas, 0, 0);

    const container = document.getElementById('map-container');
    if (!container) return output;
    const bounds = container.getBoundingClientRect();
    if (!(bounds.width > 0)) return output;

    // 캔버스는 기기 픽셀, 요소 위치는 CSS 픽셀이라 배율을 맞춰 얹는다
    const ratio = canvas.width / bounds.width;
    const targets = [...document.querySelectorAll(OVERLAY_SELECTOR)]
      .filter((el) => {
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0;
      });
    if (targets.length === 0) return output;

    const { default: html2canvas } = await import('html2canvas');
    for (const el of targets) {
      const r = el.getBoundingClientRect();
      const shot = await html2canvas(el, {
        backgroundColor: null,
        scale: ratio,
        logging: false,
        useCORS: true
      });
      ctx.drawImage(shot, (r.left - bounds.left) * ratio, (r.top - bounds.top) * ratio);
    }
    return output;
  }
}

/** 저장에 함께 담을 화면 요소들 — 3D 캔버스 위에 떠 있는 것들이다 */
const OVERLAY_SELECTOR = [
  '#view3d-compass',
  '.map-scale-bar',
  '.ol-scale-line',
  '.dem-legend',
  '.raster-analysis-legend',
  '.choropleth-legend',
  '.chart-map-legend',
  '.heatmap-legend',
  '.cartogram-legend'
].join(', ');

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
