// © 2026 김용현
// eStoryMap/src/editor/PageList.js
// 좌하단 PAGES: 페이지 선택/추가(직전 복제)/삭제/순서 변경(드래그 앤 드롭).

const KIND_ICON = { map: '🗺️', title: '📑', media: '🖼️' };
const KIND_TITLE = { map: '지도 슬라이드', title: '제목(표지) 슬라이드', media: '사진/영상 슬라이드' };

/**
 * @param {HTMLElement} container
 * @param {{onSelect(pageId):void, onAdd():void, onRemove(pageId):void,
 *          onReorder(orderedIds:string[]):void}} handlers
 */
export function createPageList(container, { onSelect, onAdd, onRemove, onReorder, onRename }) {
  let draggedId = null; // 드래그 세션 동안 유지(렌더 재생성과 무관하게 클로저에 보존)

  function clearDropMarks() {
    for (const el of container.querySelectorAll('.drop-before, .drop-after')) {
      el.classList.remove('drop-before', 'drop-after');
    }
  }

  function render(doc, selectedPageId) {
    container.innerHTML = '';
    const ids = doc.pages.map((p) => p.id);

    doc.pages.forEach((page) => {
      const row = document.createElement('div');
      row.className = 'page-row' + (page.id === selectedPageId ? ' selected' : '');
      row.draggable = false; // 드래그는 좌측 핸들에서만 시작(핸들 mousedown이 일시 활성화)
      row.dataset.pageId = page.id;

      const handle = document.createElement('span');
      handle.className = 'page-drag-handle';
      handle.textContent = '⠿';
      handle.title = '드래그해서 순서 변경';
      // 핸들을 누르는 동안만 행을 draggable로 — 이름 클릭(선택)과 충돌 방지
      handle.addEventListener('mousedown', () => { row.draggable = true; });
      handle.addEventListener('mouseup', () => { row.draggable = false; });

      const kind = page.kind || 'map';
      const icon = document.createElement('span');
      icon.className = 'page-kind';
      icon.textContent = KIND_ICON[kind] || KIND_ICON.map;
      icon.title = KIND_TITLE[kind] || KIND_TITLE.map;

      const name = document.createElement('span');
      name.className = 'page-name';
      name.textContent = page.title;
      name.addEventListener('click', () => { if (!name.isContentEditable) onSelect(page.id); });
      // 인라인 이름 편집(✏️로 시작 / Enter 저장 / Esc 취소 / 빈값·무변경은 원복)
      function startRename() {
        name.contentEditable = 'true';
        name.spellcheck = false;
        name.focus();
        const sel = document.getSelection();
        if (sel) sel.selectAllChildren(name);
      }
      name.addEventListener('keydown', (e) => {
        if (!name.isContentEditable) return;
        e.stopPropagation(); // 편집 키가 목록/전역 핸들러로 새지 않게
        if (e.key === 'Enter') { e.preventDefault(); name.blur(); }
        else if (e.key === 'Escape') { e.preventDefault(); name.textContent = page.title; name.blur(); }
      });
      name.addEventListener('blur', () => {
        if (!name.isContentEditable) return;
        name.contentEditable = 'false';
        const v = name.textContent.trim();
        if (v && v !== page.title) onRename(page.id, v);
        else name.textContent = page.title; // 빈값·무변경 → 원복
      });

      const edit = document.createElement('button');
      edit.type = 'button';
      edit.className = 'page-edit';
      edit.textContent = '✏️';
      edit.title = '이름 변경';
      edit.addEventListener('click', (e) => { e.stopPropagation(); startRename(); });

      const del = document.createElement('button');
      del.type = 'button';
      del.className = 'page-del';
      del.textContent = '×';
      del.title = '삭제';
      del.disabled = doc.pages.length <= 1; // 최소 1페이지 유지
      del.addEventListener('click', () => onRemove(page.id));

      // 드래그 앤 드롭 순서 변경
      row.addEventListener('dragstart', (e) => {
        draggedId = page.id;
        row.classList.add('dragging');
        if (e.dataTransfer) {
          e.dataTransfer.effectAllowed = 'move';
          e.dataTransfer.setData('text/plain', page.id); // Firefox는 데이터가 있어야 드래그 시작
        }
      });
      row.addEventListener('dragend', () => {
        draggedId = null;
        row.draggable = false; // 다시 핸들로만 드래그 가능하게 되돌림
        row.classList.remove('dragging');
        clearDropMarks();
      });
      row.addEventListener('dragover', (e) => {
        if (draggedId === null || draggedId === page.id) return;
        e.preventDefault(); // drop 허용
        if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
        const rect = row.getBoundingClientRect();
        const after = e.clientY > rect.top + rect.height / 2; // 아래 절반이면 뒤에 삽입
        clearDropMarks();
        row.classList.add(after ? 'drop-after' : 'drop-before');
      });
      row.addEventListener('dragleave', () => {
        row.classList.remove('drop-before', 'drop-after');
      });
      row.addEventListener('drop', (e) => {
        e.preventDefault();
        if (draggedId === null || draggedId === page.id) { clearDropMarks(); return; }
        const after = row.classList.contains('drop-after');
        clearDropMarks();
        const order = ids.filter((id) => id !== draggedId);
        let at = order.indexOf(page.id);
        if (after) at += 1;
        order.splice(at, 0, draggedId);
        onReorder(order); // 상위가 setPageOrder + refresh
      });

      row.append(handle, icon, name, edit, del);
      container.appendChild(row);
    });

    const add = document.createElement('button');
    add.type = 'button';
    add.id = 'btn-add-page';
    add.textContent = '+ 페이지';
    add.addEventListener('click', () => onAdd());
    container.appendChild(add);
  }

  return { render };
}
