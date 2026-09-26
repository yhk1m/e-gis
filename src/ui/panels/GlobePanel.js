// © 2026 김용현
/**
 * GlobePanel — 툴바 지구본 토글과 지도 위 컨트롤 박스.
 *
 * src/globe/* 는 버튼을 누른 순간 처음 내려받는다(동적 import, 3D 와 같은 방식).
 * 실험실 스위치(labs 'globe')가 꺼져 있으면 툴바 버튼이 hidden 이다 — 승격할 때
 * 지울 것은 init() 의 labs 가드와 AppLayout 의 hidden 속성뿐이다.
 *
 * 3D 보기와는 배타다.
 *   지구본을 켤 때: exitView3D()(main.js 가 "3D 가 켜져 있으면 view3dPanel.toggle()" 을 넘긴다)를 기다린다.
 *   3D 를 켤 때:   View3DPanel 의 beforeEnter 로 main.js 가 globePanel.exitIfActive() 를 넘긴다.
 * 설계: docs/superpowers/specs/2026-09-25-labs-design.md 「2단계」
 */
import { labs as defaultLabs } from '../../labs/labs.js';
import { escapeHtml } from '../../utils/escapeHtml.js';
import { isStaleModuleError } from '../../view3d/staleModule.js';

export const GLOBE_LAB_ID = 'globe';

/** PNG 저장 파일 이름 */
export const GLOBE_PNG_NAME = '지구본.png';

export class GlobePanel {
  /**
   * @param {{
   *   mapManager: object, layerManager: object, labs?: object,
   *   onMessage?: (text: string) => void,
   *   loadModule?: () => Promise<object>,        기본은 import('../../globe/GlobeController.js')
   *   exitView3D?: () => (void|Promise<void>),   지구본을 켜기 전에 3D 를 끈다 (둘은 배타)
   *   beforeEnter?: () => (void|Promise<void>)   그 밖에 켜기 전에 할 일
   * }} deps
   */
  constructor({ mapManager, layerManager, labs = defaultLabs, onMessage, loadModule, exitView3D, beforeEnter }) {
    this.mapManager = mapManager;
    this.layerManager = layerManager;
    this.labs = labs;
    this.onMessage = onMessage || (() => {});
    this.loadModule = loadModule || (() => import('../../globe/GlobeController.js'));
    this.exitView3D = exitView3D || (() => {});
    this.beforeEnter = beforeEnter || (() => {});
    this.controller = null;
    this.module = null;
    this.entering = false;
  }

  init() {
    this.toggleButton = document.getElementById('globe-toggle');
    this.box = document.getElementById('globe-controls');
    this.projectionSelect = document.getElementById('globe-projection');
    this.graticuleCheck = document.getElementById('globe-graticule');
    this.landCheck = document.getElementById('globe-land');
    this.skippedText = document.getElementById('globe-skipped');
    this.landError = document.getElementById('globe-land-error');
    this.saveButton = document.getElementById('globe-save');
    this.closeButton = document.getElementById('globe-close');
    if (!this.toggleButton || !this.box) return;

    // 실험실 가드 — 승격 때 이 묶음과 AppLayout 의 hidden 을 지운다
    this.toggleButton.hidden = !this.labs.isOn(GLOBE_LAB_ID);
    this.labs.onChange((id, on) => {
      if (id !== GLOBE_LAB_ID) return;
      this.toggleButton.hidden = !on;
      if (!on) this.exit();
    });

    // 토글 클릭은 main.js 의 툴바 [data-tool] 스위치가 부른다 — 여기서 또 듣지 않는다
    this.projectionSelect?.addEventListener('change', () => {
      this.controller?.setProjection(this.projectionSelect.value);
    });
    this.graticuleCheck?.addEventListener('change', () => {
      this.controller?.setGraticule(this.graticuleCheck.checked);
    });
    this.landCheck?.addEventListener('change', () => {
      this.controller?.setLand(this.landCheck.checked);
    });
    this.saveButton?.addEventListener('click', () => this.savePng());
    this.closeButton?.addEventListener('click', () => this.exit());
  }

  isActive() {
    return Boolean(this.controller);
  }

  async toggle() {
    if (this.controller) {
      this.exit();
      return;
    }
    await this.enter();
  }

  /** 3D 를 켜기 전에 main.js 가 부른다 — 켜져 있을 때만 닫는다 */
  exitIfActive() {
    if (this.controller) this.exit();
  }

  async enter() {
    if (this.controller || this.entering || !this.toggleButton) return;
    this.entering = true;
    this.toggleButton.disabled = true;
    try {
      await this.exitView3D();
      await this.beforeEnter();
      if (!this.module) {
        this.module = await this.loadModule();
      }
      this.fillProjectionOptions();
      // 받는 사이에 실험이 꺼졌으면 열지 않는다
      if (!this.labs.isOn(GLOBE_LAB_ID)) return;

      const controller = new this.module.GlobeController({
        mapManager: this.mapManager,
        layerManager: this.layerManager,
        container: document.getElementById('map-container')
      });
      controller.onSkippedChanged = (summary) => this.showSkipped(summary);
      controller.onLandFailed = () => this.showLandError(true);
      this.showLandError(false);
      this.showSkipped('');

      controller.setProjection(this.projectionSelect?.value || this.module.DEFAULT_PROJECTION);
      controller.setGraticule(this.graticuleCheck ? this.graticuleCheck.checked : true);
      controller.setLand(this.landCheck ? this.landCheck.checked : true);
      controller.enter();
      this.controller = controller;

      this.box.hidden = false;
      this.toggleButton.classList.add('active');
      this.toggleButton.setAttribute('aria-pressed', 'true');
      this.toggleButton.title = '2D로 돌아가기';
    } catch (error) {
      console.error('지구본을 열지 못했습니다', error);
      this.controller = null;
      if (isStaleModuleError(error)) {
        this.onMessage('새 버전이 배포되어 지구본 모듈을 불러오지 못했습니다. 새로고침이 필요합니다.');
      } else {
        this.onMessage('지구본을 열지 못했습니다.');
      }
    } finally {
      this.entering = false;
      this.toggleButton.disabled = false;
    }
  }

  exit() {
    if (!this.controller) return;
    const controller = this.controller;
    this.controller = null;
    try {
      controller.exit();
    } finally {
      this.box.hidden = true;
      this.toggleButton.classList.remove('active');
      this.toggleButton.setAttribute('aria-pressed', 'false');
      this.toggleButton.title = '지구본으로 보기';
    }
  }

  fillProjectionOptions() {
    const select = this.projectionSelect;
    if (!select || select.options.length > 0) return;
    select.innerHTML = this.module.PROJECTIONS
      .map((p) => `<option value="${escapeHtml(p.key)}">${escapeHtml(p.name)}</option>`)
      .join('');
    select.value = this.module.DEFAULT_PROJECTION;
  }

  showSkipped(summary) {
    if (!this.skippedText) return;
    this.skippedText.textContent = summary || '';
    this.skippedText.hidden = !summary;
  }

  showLandError(on) {
    if (this.landError) this.landError.hidden = !on;
  }

  savePng() {
    if (!this.controller) return;
    try {
      const url = this.controller.toDataURL();
      if (!url) return;
      const link = document.createElement('a');
      link.href = url;
      link.download = GLOBE_PNG_NAME;
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      console.error('지구본을 저장하지 못했습니다', error);
      this.onMessage('지구본을 저장하지 못했습니다.');
    }
  }
}
