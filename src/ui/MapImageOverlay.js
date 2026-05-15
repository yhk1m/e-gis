// © 2026 김용현
/**
 * 지도 위 이미지 오버레이
 * - 드래그(makeDraggable)로 이동
 * - 우하단 핸들로 가로세로 비율 유지하며 크기 조절
 * - 호버 시 우상단 X 버튼으로 삭제
 */

import { makeDraggable } from '../utils/DraggableElement.js';

let counter = 0;

export class MapImageOverlay {
  constructor(mapEl, src, options = {}) {
    counter += 1;
    this.id = `map-image-${Date.now()}-${counter}`;
    this.mapEl = mapEl;

    const wrapper = document.createElement('div');
    wrapper.className = 'map-image-overlay';
    wrapper.id = this.id;
    wrapper.style.position = 'absolute';
    wrapper.style.left = (options.left || 60) + 'px';
    wrapper.style.top = (options.top || 60) + 'px';
    wrapper.style.width = (options.width || 200) + 'px';

    const img = document.createElement('img');
    img.src = src;
    img.draggable = false;
    img.alt = '';

    const resize = document.createElement('div');
    resize.className = 'map-image-resize';
    resize.title = '크기 조절';

    const del = document.createElement('button');
    del.type = 'button';
    del.className = 'map-image-delete';
    del.innerHTML = '×';
    del.title = '삭제';

    wrapper.appendChild(img);
    wrapper.appendChild(resize);
    wrapper.appendChild(del);
    mapEl.appendChild(wrapper);

    this.el = wrapper;
    makeDraggable(wrapper, () => mapEl);

    resize.addEventListener('pointerdown', (e) => this._startResize(e));
    del.addEventListener('pointerdown', (e) => e.stopPropagation());
    del.addEventListener('click', (e) => {
      e.stopPropagation();
      this.remove();
    });
  }

  _startResize(e) {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startY = e.clientY;
    const startW = this.el.offsetWidth;
    const startH = this.el.offsetHeight;
    const ratio = startH / startW;

    const onMove = (ev) => {
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;
      // 비율 유지: 가로/세로 변화량 중 큰 쪽 기준
      const newW = Math.max(40, Math.round(Math.max(startW + dx, (startH + dy) / ratio)));
      this.el.style.width = newW + 'px';
    };
    const onUp = () => {
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
    };
    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
  }

  remove() {
    this.el.remove();
  }
}

/**
 * 파일 선택 다이얼로그 → 이미지 오버레이 추가
 */
export function triggerImageUpload(mapEl) {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.png,.jpg,.jpeg,.svg,image/png,image/jpeg,image/svg+xml';
  input.addEventListener('change', (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      new MapImageOverlay(mapEl, reader.result);
    };
    reader.readAsDataURL(file);
  });
  input.click();
}
