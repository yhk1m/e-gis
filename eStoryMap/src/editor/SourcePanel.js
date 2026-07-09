// © 2026 김용현
// eStoryMap/src/editor/SourcePanel.js
// 좌측 SOURCE 트리: 소스(파일)별 레이어 체크박스.
// 체크박스 = "현재 선택된 페이지"의 layerVisibility 편집(상위 스펙 §4).

/**
 * @param {HTMLElement} container
 * @param {{
 *   onToggleLayer(sourceId:string, layerId:string, visible:boolean):void,
 *   onSetAll(visible:boolean):void,
 *   onRemoveSource(sourceId:string, filename:string):void,
 * }} handlers
 */
export function createSourcePanel(container, { onToggleLayer, onSetAll, onRemoveSource }) {
  function render(doc, page, registry) {
    container.innerHTML = '';

    if (!doc.sources.length) {
      const empty = document.createElement('div');
      empty.className = 'panel-empty';
      empty.textContent = '.egis 열기 / .tif 열기로 소스를 추가하세요';
      container.appendChild(empty);
      return;
    }

    // 전체 선택/해제: 현재 페이지의 모든 레이어 가시성을 한 번에 토글
    const bulk = document.createElement('div');
    bulk.className = 'source-bulk';
    const allBtn = document.createElement('button');
    allBtn.type = 'button';
    allBtn.className = 'source-bulk-btn';
    allBtn.textContent = '전체 선택';
    allBtn.addEventListener('click', () => onSetAll(true));
    const noneBtn = document.createElement('button');
    noneBtn.type = 'button';
    noneBtn.className = 'source-bulk-btn';
    noneBtn.textContent = '전체 해제';
    noneBtn.addEventListener('click', () => onSetAll(false));
    bulk.appendChild(allBtn);
    bulk.appendChild(noneBtn);
    container.appendChild(bulk);

    const entries = registry.entriesList();
    for (const source of doc.sources) {
      const box = document.createElement('div');
      box.className = 'source-item';

      const title = document.createElement('div');
      title.className = 'source-name';
      const nameSpan = document.createElement('span');
      nameSpan.className = 'source-name-text';
      nameSpan.textContent = source.filename;
      const removeBtn = document.createElement('button');
      removeBtn.type = 'button';
      removeBtn.className = 'source-remove';
      removeBtn.textContent = '🗑';
      removeBtn.title = '이 소스를 프로젝트에서 제거 (모든 슬라이드에서 레이어 삭제)';
      removeBtn.addEventListener('click', () => onRemoveSource(source.sourceId, source.filename));
      title.append(nameSpan, removeBtn);
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
