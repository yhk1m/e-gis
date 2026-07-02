// © 2026 김용현
// eStoryMap/src/editor/SourcePanel.js
// 좌측 SOURCE 트리: 소스(파일)별 레이어 체크박스.
// 체크박스 = "현재 선택된 페이지"의 layerVisibility 편집(상위 스펙 §4).

/**
 * @param {HTMLElement} container
 * @param {{onToggleLayer(sourceId:string, layerId:string, visible:boolean):void}} handlers
 */
export function createSourcePanel(container, { onToggleLayer }) {
  function render(doc, page, registry) {
    container.innerHTML = '';

    if (!doc.sources.length) {
      const empty = document.createElement('div');
      empty.className = 'panel-empty';
      empty.textContent = '.egis 열기 / .tif 열기로 소스를 추가하세요';
      container.appendChild(empty);
      return;
    }

    const entries = registry.entriesList();
    for (const source of doc.sources) {
      const box = document.createElement('div');
      box.className = 'source-item';

      const title = document.createElement('div');
      title.className = 'source-name';
      title.textContent = source.filename;
      box.appendChild(title);

      for (const { sourceId, layerId, layer } of entries) {
        if (sourceId !== source.sourceId) continue;
        const label = document.createElement('label');
        label.className = 'layer-row';

        const cb = document.createElement('input');
        cb.type = 'checkbox';
        const entry = page.layerVisibility.find(
          (v) => v.sourceId === sourceId && v.layerId === layerId,
        );
        cb.checked = entry ? entry.visible : false; // 미등재 = 숨김
        cb.addEventListener('change', () => onToggleLayer(sourceId, layerId, cb.checked));

        label.appendChild(cb);
        label.appendChild(document.createTextNode(layer.get('egisLayerName') || layerId));
        box.appendChild(label);
      }
      container.appendChild(box);
    }
  }

  return { render };
}
