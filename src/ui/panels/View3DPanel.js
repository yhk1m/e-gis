// © 2026 김용현
/**
 * 3D 보기 컨트롤 — 토글 버튼, 세로 과장 슬라이더, PNG 저장.
 *
 * three와 3D 조립부는 버튼을 누른 순간 처음 내려받는다(동적 import).
 * 3D를 쓰지 않는 사용자는 한 바이트도 받지 않는다.
 */

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
    if (!this.toggleButton) return;

    if (!supportsWebGL()) {
      this.toggleButton.disabled = true;
      this.toggleButton.title = '이 브라우저에서는 3D를 쓸 수 없습니다 (WebGL 미지원)';
      return;
    }

    this.toggleButton.addEventListener('click', () => this.toggle());
    this.slider.addEventListener('input', () => {
      const value = Number(this.slider.value);
      this.sliderValue.textContent = `${value}배`;
      this.controller?.setExaggeration(value);
    });
    this.saveButton.addEventListener('click', () => this.savePng());
  }

  async toggle() {
    if (this.controller) {
      this.controller.exit();
      this.controller = null;
      this.panel.hidden = true;
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

      this.panel.hidden = false;
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

  savePng() {
    const dataUrl = this.controller?.toDataURL();
    if (!dataUrl) return;
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = `egis-3d-${Date.now()}.png`;
    link.click();
  }
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
