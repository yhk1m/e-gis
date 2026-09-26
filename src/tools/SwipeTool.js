// © 2026 김용현
/**
 * SwipeTool — 레이어 하나를 막대 왼쪽(위)에만 그린다.
 *
 * OpenLayers 공식 layer-swipe 예제 방식:
 *   prerender  : ctx.save(); 네 모서리로 path 를 만들고 ctx.clip()
 *   postrender : ctx.restore()
 * 모서리는 CSS 픽셀(swipeClipCorners)로 계산한 뒤 getRenderPixel 로 캔버스 픽셀로 바꾼다.
 * 캔버스는 뷰포트보다 크고(회전·픽셀비) 변형돼 있어 직접 곱하면 어긋난다.
 *
 * 저장하지 않는 세션 도구. 히트 판정·내보내기·3D 는 클립된 캔버스를 그대로 쓴다.
 * 설계: docs/superpowers/specs/2026-09-25-labs-design.md 「3단계」
 */
import { getRenderPixel } from 'ol/render';
import { swipeClipCorners, clampRatio, ORIENTATIONS } from './swipeMath.js';

export { swipeClipCorners, ratioFromPointer } from './swipeMath.js';

export class SwipeTool {
  /**
   * @param {{ map: import('ol/Map').default }} options
   */
  constructor({ map }) {
    this.map = map;
    this.target = null;
    this.ratio = 0.5;
    this.orientation = 'vertical';
    this._onPrerender = (event) => this.clipStart(event);
    this._onPostrender = (event) => this.clipEnd(event);
  }

  isActive() {
    return this.target !== null;
  }

  /**
   * @param {import('ol/layer/Layer').default} olLayer 클립할 레이어
   * @param {{ orientation?: 'vertical'|'horizontal', ratio?: number }} [options]
   */
  attach(olLayer, { orientation, ratio } = {}) {
    if (this.target) this.detach();
    if (ORIENTATIONS.includes(orientation)) this.orientation = orientation;
    if (ratio !== undefined) this.ratio = clampRatio(ratio);
    this.target = olLayer;
    olLayer.on('prerender', this._onPrerender);
    olLayer.on('postrender', this._onPostrender);
    this.map.render();
  }

  setRatio(ratio) {
    this.ratio = clampRatio(ratio);
    if (this.target) this.map.render();
  }

  setOrientation(orientation) {
    if (!ORIENTATIONS.includes(orientation)) return;
    this.orientation = orientation;
    if (this.target) this.map.render();
  }

  detach() {
    if (!this.target) return;
    this.target.un('prerender', this._onPrerender);
    this.target.un('postrender', this._onPostrender);
    this.target = null;
    this.map.render();
  }

  /** @param {import('ol/render/Event').default} event */
  clipStart(event) {
    const ctx = event.context;
    const corners = swipeClipCorners(this.map.getSize(), this.ratio, this.orientation)
      .map((p) => getRenderPixel(event, p));
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(corners[0][0], corners[0][1]);
    ctx.lineTo(corners[1][0], corners[1][1]);
    ctx.lineTo(corners[2][0], corners[2][1]);
    ctx.lineTo(corners[3][0], corners[3][1]);
    ctx.closePath();
    ctx.clip();
  }

  /** @param {import('ol/render/Event').default} event */
  clipEnd(event) {
    event.context.restore();
  }
}
