// © 2026 김용현
// eStoryMap/src/editor/PageList.js
// 좌하단 PAGES: 페이지 선택/추가(직전 복제)/삭제. 정렬·이름변경은 M5+.

/**
 * @param {HTMLElement} container
 * @param {{onSelect(pageId):void, onAdd():void, onRemove(pageId):void}} handlers
 */
export function createPageList(container, { onSelect, onAdd, onRemove }) {
  function render(doc, selectedPageId) {
    container.innerHTML = '';

    for (const page of doc.pages) {
      const row = document.createElement('div');
      row.className = 'page-row' + (page.id === selectedPageId ? ' selected' : '');

      const name = document.createElement('span');
      name.className = 'page-name';
      name.textContent = page.title;
      name.addEventListener('click', () => onSelect(page.id));

      const del = document.createElement('button');
      del.type = 'button';
      del.className = 'page-del';
      del.textContent = '×';
      del.disabled = doc.pages.length <= 1; // 최소 1페이지 유지
      del.addEventListener('click', () => onRemove(page.id));

      row.appendChild(name);
      row.appendChild(del);
      container.appendChild(row);
    }

    const add = document.createElement('button');
    add.type = 'button';
    add.id = 'btn-add-page';
    add.textContent = '+ 페이지';
    add.addEventListener('click', () => onAdd());
    container.appendChild(add);
  }

  return { render };
}
