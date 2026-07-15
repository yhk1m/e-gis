// © 2026 김용현
/**
 * VoronoiPanel - 보로노이 다이어그램(티센 폴리곤) 설정 패널
 *
 * 투명도는 addLayer가 아니라 layerManager.setLayerFillOpacity로 적용된다
 * (LayerPanel의 투명도 편집과 같은 경로 — LayerPanel.js:826).
 * 커스텀 style을 넘기면 layerInfo.fillOpacity와 실제 스타일이 어긋난다.
 */

import { voronoiTool } from '../../tools/VoronoiTool.js';
import { layerManager } from '../../core/LayerManager.js';

class VoronoiPanel {
  constructor() {
    this.modal = null;
  }

  show() {
    const pointLayers = voronoiTool.getPointLayers();
    if (pointLayers.length === 0) {
      alert('보로노이 다이어그램을 만들려면 포인트 레이어가 필요합니다.');
      return;
    }
    this.render(pointLayers, voronoiTool.getPolygonLayers());
  }

  render(pointLayers, polygonLayers) {
    this.close();

    this.modal = document.createElement('div');
    this.modal.className = 'modal-overlay voronoi-modal active';
    this.modal.innerHTML = this.getModalHTML(pointLayers, polygonLayers);
    document.body.appendChild(this.modal);

    // 현재 선택된 레이어가 포인트면 기본값으로 고른다.
    const selectedId = layerManager.getSelectedLayerId();
    if (selectedId && pointLayers.some(l => l.id === selectedId)) {
      document.getElementById('voronoi-layer').value = selectedId;
    }

    this.bindEvents();
  }

  getModalHTML(pointLayers, polygonLayers) {
    const layerOptions = pointLayers.map(l =>
      '<option value="' + l.id + '">' + l.name + ' (' + l.featureCount + ')</option>'
    ).join('');

    const boundaryOptions =
      '<option value="">사각형 (경계 없음)</option>' +
      polygonLayers.map(l =>
        '<option value="' + l.id + '">' + l.name + '</option>'
      ).join('');

    return '<div class="modal-content voronoi-content">' +
      '<div class="modal-header">' +
        '<h3>보로노이 다이어그램 (티센 폴리곤)</h3>' +
        '<button class="modal-close" id="voronoi-close">&times;</button>' +
      '</div>' +
      '<div class="modal-body">' +
        '<div class="form-group">' +
          '<label for="voronoi-layer">포인트 레이어</label>' +
          '<select id="voronoi-layer">' + layerOptions + '</select>' +
        '</div>' +
        '<div class="form-group">' +
          '<label for="voronoi-boundary">경계 (클립) 레이어</label>' +
          '<select id="voronoi-boundary">' + boundaryOptions + '</select>' +
        '</div>' +
        '<div class="form-group">' +
          '<label for="voronoi-color">색상</label>' +
          '<input type="color" id="voronoi-color" value="#3388ff">' +
        '</div>' +
        '<div class="form-group">' +
          '<label for="voronoi-opacity">채우기 투명도: <span id="voronoi-opacity-value">0.3</span></label>' +
          '<input type="range" id="voronoi-opacity" min="0.1" max="1" step="0.1" value="0.3">' +
        '</div>' +
      '</div>' +
      '<div class="modal-footer">' +
        '<button class="btn btn-secondary" id="voronoi-cancel">취소</button>' +
        '<button class="btn btn-primary" id="voronoi-apply">생성</button>' +
      '</div>' +
    '</div>';
  }

  bindEvents() {
    document.getElementById('voronoi-close')
      .addEventListener('click', () => this.close());
    document.getElementById('voronoi-cancel')
      .addEventListener('click', () => this.close());
    document.getElementById('voronoi-apply')
      .addEventListener('click', () => this.apply());

    const opacityInput = document.getElementById('voronoi-opacity');
    opacityInput.addEventListener('input', (e) => {
      document.getElementById('voronoi-opacity-value').textContent = e.target.value;
    });
  }

  apply() {
    const layerId = document.getElementById('voronoi-layer').value;
    const boundaryLayerId = document.getElementById('voronoi-boundary').value || null;
    const color = document.getElementById('voronoi-color').value;
    const opacity = parseFloat(document.getElementById('voronoi-opacity').value);

    try {
      const result = voronoiTool.createVoronoi(layerId, { boundaryLayerId, color, opacity });

      // 걸러낸 건 반드시 알린다. 조용히 사라지면 데이터가 틀렸다고 오해한다.
      const s = result.skipped;
      const notes = [];
      if (s.duplicates > 0) notes.push(`중복 좌표 ${s.duplicates}개 제외`);
      if (s.nonPoint > 0) notes.push(`포인트가 아닌 피처 ${s.nonPoint}개 제외`);
      if (s.outsideBoundary > 0) notes.push(`경계 밖 셀 ${s.outsideBoundary}개 제외`);
      if (s.clipFailed > 0) notes.push(`도형 오류로 자르지 못한 셀 ${s.clipFailed}개 제외`);
      if (s.slivers > 0) notes.push(`면적이 거의 0인 조각 ${s.slivers}개 제외`);

      let message = '보로노이 다이어그램이 생성되었습니다!\n' +
        `레이어: ${result.layerName}\n` +
        `셀 개수: ${result.cellCount}`;
      if (notes.length > 0) {
        message += '\n\n' + notes.join('\n');
      }

      alert(message);
      this.close();
    } catch (error) {
      alert('보로노이 생성 실패: ' + error.message);
    }
  }

  close() {
    if (this.modal) {
      this.modal.remove();
      this.modal = null;
    }
  }
}

export const voronoiPanel = new VoronoiPanel();
