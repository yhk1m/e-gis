// © 2026 김용현
// eStoryMap/src/editor/PageList.js
// 좌하단 PAGES: 페이지 선택/추가(직전 복제)/삭제/순서 변경(드래그 앤 드롭).

import { iconSvg, setIconLabel } from '../shared/icons.js';

const KIND_ICON = { map: 'map', title: 'title', media: 'image', text: 'text' };
const KIND_TITLE = { map: '지도 슬라이드', title: '제목(표지) 슬라이드', media: '사진/영상 슬라이드', text: '글 슬라이드' };

/**
 * @param {HTMLElement} container
 * @param {{onSelect(pageId):void, onAdd():void, onRemove(pageId):void,
 *          onReorder(orderedIds:string[]):void}} handlers
 */
export function createPageList(container, { onSelect, onAdd, onRemove, onReorder, onRename, onDuplicate }) {
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
      handle.innerHTML = iconSvg('grip');
      handle.title = '드래그해서 순서 변경';
      // 핸들을 누르는 동안만 행을 draggable로 — 이름 클릭(선택)과 충돌 방지
      handle.addEventListener('mousedown', () => { row.draggable = true; });
      handle.addEventListener('mouseup', () => { row.draggable = false; });

      const kind = page.kind || 'map';
      const icon = document.createElement('span');
      icon.className = 'page-kind';
      icon.innerHTML = iconSvg(KIND_ICON[kind] || KIND_ICON.map);
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

      // 지도 슬라이드에 위치를 저장했는지 표시(저장 안 한 슬라이드는 발표 때 지도 위치가 바뀌지 않는다)
      const cam = document.createElement('span');
      cam.className = 'page-cam';
      if (kind === 'map' && page.camera) {
        cam.innerHTML = iconSvg('pin', 14);
        cam.title = '위치를 저장했어요';
      } else if (kind === 'map') {
        cam.classList.add('none');
        cam.title = '아직 위치를 저장하지 않았어요';
      }

      const edit = document.createElement('button');
      edit.type = 'button';
      edit.className = 'page-edit';
      setIconLabel(edit, 'edit', '', '이름 바꾸기');
      edit.title = '이름 변경';
      edit.addEventListener('click', (e) => { e.stopPropagation(); startRename(); });

      const dup = document.createElement('button');
      dup.type = 'button';
      dup.className = 'page-dup';
      setIconLabel(dup, 'copy', '', '슬라이드 복제');
      dup.title = '복제 (글과 배경까지 똑같이)';
      dup.addEventListener('click', (e) => { e.stopPropagation(); if (onDuplicate) onDuplicate(page.id); });

      const del = document.createElement('button');
      del.type = 'button';
      del.className = 'page-del';
      setIconLabel(del, 'close', '', '슬라이드 지우기');
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

      row.append(handle, icon, name, cam, edit, ...(onDuplicate ? [dup] : []), del);
      container.appendChild(row);
    });

    const add = document.createElement('button');
    add.type = 'button';
    add.id = 'btn-add-page';
    add.textContent = '+ 페이지';
    add.title = '지금 슬라이드 바로 뒤에 새 슬라이드를 넣어요. 지도 위치와 레이어는 이어받아요';
    add.addEventListener('click', () => onAdd());
    container.appendChild(add);
  }

  return { render };
}
