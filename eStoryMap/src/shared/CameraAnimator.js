// © 2026 김용현
// eStoryMap/src/shared/CameraAnimator.js
// 페이지 카메라 비행 — OL view.animate 얇은 래퍼(상위 스펙 §3 shared/CameraAnimator).
// e-GIS MapManager.setCenter/setZoom은 300ms 개별 애니메이션이지만, 페이지 전환은
// center+zoom을 한 번의 800ms inAndOut 비행으로 묶는다(슬라이드 전환감).
import { fromLonLat } from 'ol/proj';
import { inAndOut } from 'ol/easing';

export class CameraAnimator {
  /** @param {import('ol/View').default} view - OL View (mapView.map.getView()) */
  constructor(view) {
    this.view = view;
  }

  /**
   * 카메라로 비행. 연속 전환(연타) 시 이전 비행은 취소된다.
   * @param {{center:number[], zoom:number}|null} camera - center는 EPSG:4326 [경도, 위도]
   * @param {{duration?:number}} [options]
   */
  flyTo(camera, { duration = 800 } = {}) {
    if (!camera || !Array.isArray(camera.center)) return;
    this.view.cancelAnimations();
    this.view.animate({
      center: fromLonLat(camera.center),
      zoom: camera.zoom,
      duration,
      easing: inAndOut,
    });
  }
}
