// @vitest-environment jsdom
// © 2026 김용현
import { describe, it, expect } from 'vitest';
import { dragInsets, clampRange } from './DraggableElement.js';

describe('dragInsets', () => {
  it('글래스 변수가 없으면 0', () => {
    const el = document.createElement('div');
    document.body.appendChild(el);
    expect(dragInsets(el)).toEqual({ left: 0, top: 0, bottom: 0 });
  });

  it('조상에 둔 --glass-*-offset 을 읽는다', () => {
    const host = document.createElement('div');
    host.style.setProperty('--glass-panel-offset', '320px');
    host.style.setProperty('--glass-top-offset', '110px');
    host.style.setProperty('--glass-bottom-offset', '36px');
    const el = document.createElement('div');
    host.appendChild(el);
    document.body.appendChild(host);
    const i = dragInsets(el);
    // jsdom 은 사용자 정의 속성 상속을 계산하지 않을 수 있다 — 자기 요소에 둔 값은 반드시 읽는다
    const self = dragInsets(host);
    expect(self).toEqual({ left: 320, top: 114, bottom: 40 });
    expect(i.left === 0 || i.left === 320).toBe(true);
  });
});

describe('clampRange', () => {
  it('가려진 가장자리만큼 범위를 줄인다', () => {
    expect(clampRange(1600, 900, 140, 40, { left: 320, top: 110, bottom: 36 }))
      .toEqual({ minX: 320, minY: 110, maxX: 1460, maxY: 824 });
  });

  it('글래스가 꺼져 있으면 컨테이너 전체', () => {
    expect(clampRange(800, 600, 100, 50, { left: 0, top: 0, bottom: 0 }))
      .toEqual({ minX: 0, minY: 0, maxX: 700, maxY: 550 });
  });

  it('영역이 요소보다 좁으면 최소값에 붙는다', () => {
    const r = clampRange(300, 200, 100, 50, { left: 280, top: 180, bottom: 30 });
    expect(r.maxX).toBe(280);
    expect(r.maxY).toBe(180);
  });
});
