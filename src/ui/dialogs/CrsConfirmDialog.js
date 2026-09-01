// © 2026 김용현
/**
 * CrsConfirmDialog - 좌표계가 애매할 때 후보를 지도에 그려 보여주고 고르게 한다.
 *
 * 좌표계 코드를 몰라도 "어디에 찍히는지"로 판단할 수 있게 하는 것이 목적이다.
 * 후보를 고르면 본 지도에 임시 레이어로 즉시 그린다. LayerManager를 거치지 않고
 * map.addLayer로 직접 올리므로 레이어 패널·히스토리·자동저장에 흔적이 남지 않는다.
 *
 * 이 창의 유일한 실패 모드는 임시 레이어가 지도에 남는 것이다.
 * 확인·취소·ESC·오버레이 클릭이 모두 finish() 하나를 거치게 해서 막는다.
 */
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import GeoJSON from 'ol/format/GeoJSON';
import { Style, Fill, Stroke, Circle as CircleStyle } from 'ol/style';
import { mapManager } from '../../core/MapManager.js';
import { coordinateSystem } from '../../core/CoordinateSystem.js';
import { escapeHtml } from '../../utils/escapeHtml.js';

// 대용량에서도 즉시 반응하도록 표본만 그린다
const PREVIEW_LIMIT = 500;

const PREVIEW_STYLE = new Style({
  image: new CircleStyle({
    radius: 5,
    fill: new Fill({ color: 'rgba(255, 102, 0, 0.85)' }),
    stroke: new Stroke({ color: '#ffffff', width: 1.5 })
  }),
  fill: new Fill({ color: 'rgba(255, 102, 0, 0.25)' }),
  stroke: new Stroke({ color: '#ff6600', width: 2 })
});

// 위치 표시 아이콘 (선 SVG — 이 프로젝트는 UI에 이모지를 쓰지 않는다)
const PIN_ICON = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" ' +
  'stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">' +
  '<path d="M12 21s-7-6.2-7-11a7 7 0 1 1 14 0c0 4.8-7 11-7 11z"/><circle cx="12" cy="10" r="2.5"/></svg>';

class CrsConfirmDialog {
  constructor() {
    this.modal = null;
    this.previewLayer = null;
    this.resolve = null;
    this.onKeyDown = null;
    this.format = new GeoJSON();
  }

  /**
   * 후보를 보여주고 하나를 고르게 한다.
   *
   * @param {Object} detection - CrsDetector.detectCrs 결과
   * @param {Object} context - { name, previewGeoJSON }
   * @returns {Promise<string|null>} 고른 좌표계 코드, 취소하면 null
   */
  pick(detection, context = {}) {
    // 앞선 창이 남아 있으면 취소로 닫는다 (겹쳐 뜨지 않게)
    if (this.modal) this.finish(null);

    return new Promise((resolve) => {
      this.resolve = resolve;
      this.previewGeoJSON = this.samplePreview(context.previewGeoJSON);
      this.render(detection, context.name || '새 레이어');
      this.bindEvents();
      this.showPreview(detection.crs);
    });
  }

  /** 미리보기는 표본만 그린다 — 수만 개를 그리면 창이 뜨는 데 시간이 걸린다 */
  samplePreview(geojson) {
    const features = geojson && Array.isArray(geojson.features) ? geojson.features : [];
    return { type: 'FeatureCollection', features: features.slice(0, PREVIEW_LIMIT) };
  }

  render(detection, name) {
    const rows = detection.candidates.map((candidate, index) => {
      const place = candidate.center
        ? '경도 ' + candidate.center[0].toFixed(4) + ', 위도 ' + candidate.center[1].toFixed(4)
        : '위치 미상';
      return '<label class="crs-candidate">' +
        '<input type="radio" name="crs-candidate" value="' + escapeHtml(candidate.crs) + '"' +
        (index === 0 ? ' checked' : '') + '>' +
        '<span class="crs-candidate-body">' +
          '<span class="crs-candidate-name">' + escapeHtml(candidate.name) + '</span>' +
          '<span class="crs-candidate-code">' + escapeHtml(candidate.crs) + '</span>' +
          '<span class="crs-candidate-place">' + PIN_ICON + escapeHtml(place) + '</span>' +
        '</span>' +
      '</label>';
    }).join('');

    const options = coordinateSystem.getAvailableCRS().map((crs) =>
      '<option value="' + escapeHtml(crs.code) + '">' +
      escapeHtml(crs.name + ' (' + crs.code + ')') + '</option>'
    ).join('');

    this.modal = document.createElement('div');
    this.modal.className = 'modal-overlay crs-confirm-modal active';
    this.modal.innerHTML =
      '<div class="modal-content crs-confirm-content">' +
        '<div class="modal-header">' +
          '<h3>좌표계 확인 — ' + escapeHtml(name) + '</h3>' +
          '<button class="modal-close" id="crs-confirm-close">&times;</button>' +
        '</div>' +
        '<div class="modal-body">' +
          '<p class="crs-confirm-reason">' + escapeHtml(detection.reason) +
            '. 고르면 지도에 그려 보여줍니다.</p>' +
          '<div class="crs-candidate-list">' + rows + '</div>' +
          '<div class="form-group">' +
            '<label for="crs-confirm-other">목록에 없다면 직접 고르기</label>' +
            '<select id="crs-confirm-other"><option value="">선택 안 함</option>' + options + '</select>' +
          '</div>' +
        '</div>' +
        '<div class="modal-footer">' +
          '<button class="btn btn-secondary" id="crs-confirm-cancel">취소</button>' +
          '<button class="btn btn-primary" id="crs-confirm-apply">이 좌표계로 가져오기</button>' +
        '</div>' +
      '</div>';

    document.body.appendChild(this.modal);
  }

  bindEvents() {
    const select = this.modal.querySelector('#crs-confirm-other');

    this.modal.querySelectorAll('input[name="crs-candidate"]').forEach((radio) => {
      radio.addEventListener('change', () => {
        select.value = '';
        this.showPreview(radio.value);
      });
    });

    select.addEventListener('change', () => {
      if (!select.value) return;
      this.modal.querySelectorAll('input[name="crs-candidate"]').forEach((r) => { r.checked = false; });
      this.showPreview(select.value);
    });

    this.modal.querySelector('#crs-confirm-apply')
      .addEventListener('click', () => this.finish(this.selectedCrs()));
    this.modal.querySelector('#crs-confirm-cancel')
      .addEventListener('click', () => this.finish(null));
    this.modal.querySelector('#crs-confirm-close')
      .addEventListener('click', () => this.finish(null));

    // 오버레이(창 바깥) 클릭
    this.modal.addEventListener('click', (e) => {
      if (e.target === this.modal) this.finish(null);
    });

    this.onKeyDown = (e) => {
      if (e.key === 'Escape') this.finish(null);
    };
    document.addEventListener('keydown', this.onKeyDown);
  }

  selectedCrs() {
    const select = this.modal.querySelector('#crs-confirm-other');
    if (select && select.value) return select.value;
    const radio = this.modal.querySelector('input[name="crs-candidate"]:checked');
    return radio ? radio.value : null;
  }

  /** 고른 좌표계로 본 지도에 임시로 그리고 그 범위로 이동한다 */
  showPreview(crs) {
    this.clearPreview();

    const map = mapManager.getMap();
    if (!map || !crs) return;

    let features;
    try {
      features = this.format.readFeatures(this.previewGeoJSON, {
        dataProjection: crs,
        featureProjection: 'EPSG:3857'
      });
    } catch (error) {
      console.warn('미리보기 변환 실패:', crs, error);
      return;
    }
    if (features.length === 0) return;

    const source = new VectorSource({ features });
    this.previewLayer = new VectorLayer({
      source,
      style: PREVIEW_STYLE,
      // 레이어 패널에 뜨지 않도록 LayerManager를 거치지 않는다
      zIndex: 9999
    });
    map.addLayer(this.previewLayer);

    const extent = source.getExtent();
    if (extent && Number.isFinite(extent[0])) {
      map.getView().fit(extent, { padding: [80, 80, 80, 80], maxZoom: 16, duration: 300 });
    }
  }

  clearPreview() {
    if (!this.previewLayer) return;
    const map = mapManager.getMap();
    if (map) map.removeLayer(this.previewLayer);
    this.previewLayer = null;
  }

  /**
   * 모든 종료 경로가 여기를 지난다. 미리보기를 걷고, 창을 닫고, 약속을 지킨다.
   * 경로를 하나로 모으는 것이 이 창의 안전장치다.
   */
  finish(result) {
    this.clearPreview();

    if (this.onKeyDown) {
      document.removeEventListener('keydown', this.onKeyDown);
      this.onKeyDown = null;
    }
    if (this.modal) {
      this.modal.remove();
      this.modal = null;
    }
    const resolve = this.resolve;
    this.resolve = null;
    if (resolve) resolve(result || null);
  }
}

export const crsConfirmDialog = new CrsConfirmDialog();
