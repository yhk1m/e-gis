// © 2026 김용현
// eStoryMap/src/editor/StartScreen.js
// 시작 화면: 새 스토리맵 만들기 / 저장된 .esm 목록에서 열기(상위 스펙 §3b).
// 오버레이 표시/숨김은 main.js가 담당하고, 이 컴포넌트는 내용만 렌더한다.

/**
 * @param {HTMLElement} container
 * @param {{onCreate(title:string):void, onOpen(name:string):void}} handlers
 */
export function createStartScreen(container, { onCreate, onOpen }) {
  let errorEl = null;

  function render(projectNames) {
    container.innerHTML = '';
    const box = document.createElement('div');
    box.className = 'start-box';

    const brand = document.createElement('h1');
    brand.className = 'start-brand';
    brand.textContent = 'e-GIStory';
    box.appendChild(brand);

    const row = document.createElement('div');
    row.className = 'start-new';
    const title = document.createElement('input');
    title.type = 'text';
    title.id = 'start-title';
    title.placeholder = '새 스토리맵 제목';
    const create = document.createElement('button');
    create.type = 'button';
    create.id = 'btn-start-create';
    create.textContent = '새로 만들기';
    create.addEventListener('click', () => onCreate(title.value.trim() || '새 스토리맵'));
    title.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') create.click();
    });
    row.appendChild(title);
    row.appendChild(create);
    box.appendChild(row);

    errorEl = document.createElement('div');
    errorEl.className = 'start-error';
    box.appendChild(errorEl);

    const listTitle = document.createElement('div');
    listTitle.className = 'start-list-title';
    listTitle.textContent = '저장된 스토리맵';
    box.appendChild(listTitle);

    if (!projectNames.length) {
      const empty = document.createElement('div');
      empty.className = 'start-empty';
      empty.textContent = '저장된 스토리맵이 없습니다';
      box.appendChild(empty);
    } else {
      for (const name of projectNames) {
        const item = document.createElement('button');
        item.type = 'button';
        item.className = 'start-item';
        item.textContent = name;
        item.addEventListener('click', () => onOpen(name));
        box.appendChild(item);
      }
    }

    container.appendChild(box);
  }

  function showError(message) {
    if (errorEl) errorEl.textContent = message;
  }

  return { render, showError };
}
