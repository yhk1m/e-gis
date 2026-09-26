// @vitest-environment jsdom
// © 2026 김용현
/**
 * 구간 채움 팝오버. 도구(choroplethTool)를 주입받아 "어떤 호출을 하는지"만 본다.
 * 캔버스가 없는 jsdom 에서는 질감 미리보기 타일이 단색으로 물러선다.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../../tools/classFillCanvas.js', async (importOriginal) => {
  const mod = await importOriginal();
  return { ...mod, reencodeImageFile: vi.fn(mod.reencodeImageFile) };
});

import { reencodeImageFile } from '../../tools/classFillCanvas.js';
import { ClassFillPopover } from './ClassFillPopover.js';

HTMLCanvasElement.prototype.getContext = () => null;

function fakeTool(cfg) {
  return {
    cfg,
    configOf: () => cfg,
    setClassFill: vi.fn(() => true),
    setClassColor: vi.fn(() => true),
    setAllFills: vi.fn(() => true)
  };
}

function setup(fills, colors = ['#ffffcc', '#800026']) {
  document.body.innerHTML = `
    <div id="map" style="position:relative;width:800px;height:600px">
      <div class="choropleth-legend" id="choropleth-legend-L"><div class="choropleth-legend-items">
        <span class="choropleth-legend-color" data-class="0"></span>
        <span class="choropleth-legend-color" data-class="1"></span>
      </div></div>
    </div>`;
  const cfg = { attribute: 'pop', breaks: [0, 50, 100], colors };
  if (fills) cfg.fills = fills;
  const tool = fakeTool(cfg);
  const popover = new ClassFillPopover({ tool });
  const anchor = document.querySelectorAll('.choropleth-legend-color')[1];
  return { tool, popover, anchor };
}

const change = (el, value) => { el.value = value; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); };
const pointerDown = (el) => el.dispatchEvent(new Event('pointerdown', { bubbles: true, cancelable: true }));
const tick = () => new Promise((r) => setTimeout(r, 0));

beforeEach(() => { document.body.innerHTML = ''; reencodeImageFile.mockClear(); });

describe('ClassFillPopover', () => {
  it('열면 #map 안에 뜨고 종류 탭 넷, 채움이 없으면 단색 탭', () => {
    const { popover, anchor } = setup();
    popover.open({ layerId: 'L', classIndex: 1, anchor });
    const el = document.querySelector('#map .class-fill-popover');
    expect(el).not.toBeNull();
    expect(el.querySelectorAll('.class-fill-kind')).toHaveLength(4);
    expect(el.querySelector('.class-fill-kind[aria-selected="true"]').dataset.kind).toBe('solid');
    expect(el.querySelector('.class-fill-title').textContent).toBe('2구간 채움');
    expect(el.querySelector('.cf-color').value).toBe('#800026');
    popover.close();
    expect(document.querySelector('.class-fill-popover')).toBeNull();
  });

  it('저장본의 colors 가 hex 가 아니면 회색으로 물러서고 속성 밖으로 새지 않는다', () => {
    const { popover, anchor } = setup(null, ['#ffffcc', '"><img src=x onerror=1>']);
    popover.open({ layerId: 'L', classIndex: 1, anchor });
    const el = document.querySelector('.class-fill-popover');
    expect(el.querySelector('.cf-color').value).toBe('#808080');
    expect(el.querySelector('img')).toBeNull();
    document.querySelector('.class-fill-kind[data-kind="texture"]').click();
    expect(el.querySelector('img')).toBeNull();
    expect(el.querySelector('.cf-texture-tile').getAttribute('style')).toContain('#808080');
    popover.close();
  });

  it('기존 채움이 있으면 그 탭과 값으로 연다', () => {
    const { popover, anchor } = setup([{ kind: 'solid' }, { kind: 'dots', spacing: 12, radius: 2, color: '#111111', background: 'none' }]);
    popover.open({ layerId: 'L', classIndex: 1, anchor });
    const el = document.querySelector('.class-fill-popover');
    expect(el.querySelector('.class-fill-kind[aria-selected="true"]').dataset.kind).toBe('pattern');
    expect(el.querySelector('.cf-ptype').value).toBe('dots');
    expect(el.querySelector('.cf-spacing').value).toBe('12');
    expect(el.querySelector('.cf-bg').value).toBe('none');
    popover.close();
  });

  it('단색 입력 → setClassColor', () => {
    const { tool, popover, anchor } = setup();
    popover.open({ layerId: 'L', classIndex: 1, anchor });
    change(document.querySelector('.cf-color'), '#123456');
    expect(tool.setClassColor).toHaveBeenCalledWith('L', 1, '#123456');
    popover.close();
  });

  it('패턴 탭에서 값을 바꾸면 setClassFill(hatch …)', () => {
    const { tool, popover, anchor } = setup();
    popover.open({ layerId: 'L', classIndex: 0, anchor });
    document.querySelector('.class-fill-kind[data-kind="pattern"]').click();
    expect(tool.setClassFill).toHaveBeenLastCalledWith('L', 0, expect.objectContaining({ kind: 'hatch' }));
    change(document.querySelector('.cf-spacing'), '6');
    change(document.querySelector('.cf-angle'), '135');
    expect(tool.setClassFill).toHaveBeenLastCalledWith('L', 0, expect.objectContaining({ kind: 'hatch', spacing: 6, angle: 135 }));
    change(document.querySelector('.cf-ptype'), 'dots');
    expect(tool.setClassFill).toHaveBeenLastCalledWith('L', 0, expect.objectContaining({ kind: 'dots' }));
    expect(document.querySelector('.cf-row-angle').hidden).toBe(true);
    expect(document.querySelector('.cf-row-radius').hidden).toBe(false);
    popover.close();
  });

  it('배경 "직접" 을 고르면 색 입력이 보이고 그 색이 실린다', () => {
    const { tool, popover, anchor } = setup();
    popover.open({ layerId: 'L', classIndex: 0, anchor });
    document.querySelector('.class-fill-kind[data-kind="pattern"]').click();
    change(document.querySelector('.cf-bg'), 'custom');
    expect(document.querySelector('.cf-bgcolor').hidden).toBe(false);
    change(document.querySelector('.cf-bgcolor'), '#00ff00');
    expect(tool.setClassFill).toHaveBeenLastCalledWith('L', 0, expect.objectContaining({ background: '#00ff00' }));
    popover.close();
  });

  it('질감 탭: 타일 다섯, 누르면 setClassFill(texture), 강도 반영', () => {
    const { tool, popover, anchor } = setup();
    popover.open({ layerId: 'L', classIndex: 0, anchor });
    document.querySelector('.class-fill-kind[data-kind="texture"]').click();
    const tiles = document.querySelectorAll('.cf-texture');
    expect(tiles).toHaveLength(5);
    tiles[3].click();
    expect(tool.setClassFill).toHaveBeenLastCalledWith('L', 0, { kind: 'texture', name: 'forest', strength: 0.5 });
    change(document.querySelector('.cf-strength'), '0.8');
    expect(tool.setClassFill).toHaveBeenLastCalledWith('L', 0, { kind: 'texture', name: 'forest', strength: 0.8 });
    popover.close();
  });

  it('이미지 탭: 파일 없으면 배율·불투명도 입력이 잠기고 크기 표시는 비어 있다', () => {
    const { popover, anchor } = setup();
    popover.open({ layerId: 'L', classIndex: 0, anchor });
    document.querySelector('.class-fill-kind[data-kind="image"]').click();
    expect(document.querySelector('.cf-file')).not.toBeNull();
    expect(document.querySelector('.cf-iscale').disabled).toBe(true);
    expect(document.querySelector('.cf-isize').textContent).toBe('');
    popover.close();
  });

  it('이미지 읽기 실패는 onMessage 로 알리고 설정은 건드리지 않는다', async () => {
    const onMessage = vi.fn();
    const { tool, popover, anchor } = setup();
    popover.onMessage = onMessage;
    popover.open({ layerId: 'L', classIndex: 0, anchor });
    document.querySelector('.class-fill-kind[data-kind="image"]').click();
    tool.setClassFill.mockClear();
    const input = document.querySelector('.cf-file');
    const bad = new File(['hello'], 'a.txt', { type: 'text/plain' });
    Object.defineProperty(input, 'files', { value: [bad] });
    input.dispatchEvent(new Event('change', { bubbles: true }));
    await tick();
    expect(onMessage).toHaveBeenCalledWith('이미지 파일이 아닙니다.');
    expect(tool.setClassFill).not.toHaveBeenCalled();
    popover.close();
  });

  it('이미지를 읽는 사이 다른 탭으로 옮겼으면 결과를 버린다', async () => {
    let resolve;
    reencodeImageFile.mockImplementationOnce(() => new Promise((r) => { resolve = r; }));
    const { tool, popover, anchor } = setup();
    popover.open({ layerId: 'L', classIndex: 0, anchor });
    document.querySelector('.class-fill-kind[data-kind="image"]').click();
    const input = document.querySelector('.cf-file');
    Object.defineProperty(input, 'files', { value: [new File(['x'], 'a.png', { type: 'image/png' })] });
    input.dispatchEvent(new Event('change', { bubbles: true }));
    document.querySelector('.class-fill-kind[data-kind="pattern"]').click();
    tool.setClassFill.mockClear();
    resolve({ dataUrl: 'data:image/png;base64,AAAA', width: 4, height: 4 });
    await tick();
    expect(tool.setClassFill).not.toHaveBeenCalled();
    expect(document.querySelector('.cf-ptype')).not.toBeNull();
    popover.close();
  });

  it('이미지를 읽고 나면 setClassFill(image) 와 크기 표시, 배율 입력이 풀린다', async () => {
    let resolve;
    reencodeImageFile.mockImplementationOnce(() => new Promise((r) => { resolve = r; }));
    const { tool, popover, anchor } = setup();
    popover.open({ layerId: 'L', classIndex: 0, anchor });
    document.querySelector('.class-fill-kind[data-kind="image"]').click();
    const input = document.querySelector('.cf-file');
    Object.defineProperty(input, 'files', { value: [new File(['x'], 'a.png', { type: 'image/png' })] });
    input.dispatchEvent(new Event('change', { bubbles: true }));
    resolve({ dataUrl: 'data:image/png;base64,AAAA', width: 4, height: 4 });
    await tick();
    expect(tool.setClassFill).toHaveBeenLastCalledWith('L', 0, expect.objectContaining({ kind: 'image', width: 4, height: 4 }));
    expect(document.querySelector('.cf-iscale').disabled).toBe(false);
    expect(document.querySelector('.cf-isize').textContent).toContain('KB');
    popover.close();
  });

  it('프리셋 적용 → setAllFills(구간 수만큼), 되돌리기 → setAllFills(null)', () => {
    const { tool, popover, anchor } = setup();
    popover.open({ layerId: 'L', classIndex: 0, anchor });
    change(document.querySelector('.class-fill-preset'), 'bw-hatch');
    document.querySelector('.class-fill-preset-apply').click();
    expect(tool.setAllFills).toHaveBeenCalledWith('L', expect.arrayContaining([expect.objectContaining({ kind: 'hatch' })]));
    expect(tool.setAllFills.mock.calls[0][1]).toHaveLength(2);
    document.querySelector('.class-fill-reset').click();
    expect(tool.setAllFills).toHaveBeenLastCalledWith('L', null);
    popover.close();
  });

  it('Esc·바깥 클릭·닫기 버튼으로 닫힌다, 앵커 클릭은 닫지 않는다', () => {
    const { popover, anchor } = setup();   // anchor 는 2번째 칸(data-class="1")
    popover.open({ layerId: 'L', classIndex: 1, anchor });
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(document.querySelector('.class-fill-popover')).toBeNull();

    popover.open({ layerId: 'L', classIndex: 1, anchor });
    pointerDown(anchor);
    expect(document.querySelector('.class-fill-popover')).not.toBeNull();
    pointerDown(document.querySelector('.class-fill-body'));
    expect(document.querySelector('.class-fill-popover')).not.toBeNull();
    // 다른 구간의 칸은 바깥이다
    pointerDown(document.querySelector('.choropleth-legend-color[data-class="0"]'));
    expect(document.querySelector('.class-fill-popover')).toBeNull();

    popover.open({ layerId: 'L', classIndex: 1, anchor });
    pointerDown(document.body);
    expect(document.querySelector('.class-fill-popover')).toBeNull();

    popover.open({ layerId: 'L', classIndex: 1, anchor });
    document.querySelector('.class-fill-close').click();
    expect(document.querySelector('.class-fill-popover')).toBeNull();
  });

  it('범례가 다시 그려져 앵커가 떨어져 나가도 새 색 칸을 찾아 자리 잡고, 그 칸 클릭은 닫지 않는다', () => {
    const { popover, anchor } = setup();
    const map = document.getElementById('map');
    const rect = (left, top, width, height) => ({ left, top, width, height, right: left + width, bottom: top + height, x: left, y: top });
    map.getBoundingClientRect = () => rect(0, 0, 800, 600);
    popover.open({ layerId: 'L', classIndex: 1, anchor });

    // setClassFill → refreshLegendItems 가 innerHTML 을 통째로 갈아 끼우는 것과 같다
    const items = document.querySelector('.choropleth-legend-items');
    items.innerHTML = '<span class="choropleth-legend-color" data-class="0"></span><span class="choropleth-legend-color" data-class="1"></span>';
    const fresh = items.querySelectorAll('.choropleth-legend-color')[1];
    fresh.getBoundingClientRect = () => rect(20, 500, 24, 16);
    expect(anchor.isConnected).toBe(false);

    popover.switchTab('pattern');
    const el = document.querySelector('.class-fill-popover');
    // 새 칸 오른쪽(44 + 8), 아래로 넘치니 위로 당김(600 − 320 − 8)
    expect(el.style.left).toBe('52px');
    expect(el.style.top).toBe('272px');
    expect(popover.anchor).toBe(fresh);

    pointerDown(fresh);
    expect(document.querySelector('.class-fill-popover')).not.toBeNull();
    popover.close();
  });

  it('범례 몸통을 잡아 끌어도(전파가 막힌 pointerdown) 닫힌다', () => {
    const { popover, anchor } = setup();
    const legend = document.querySelector('.choropleth-legend');
    // makeDraggable 처럼 버블 단계에서 전파를 끊는다
    legend.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); });
    popover.open({ layerId: 'L', classIndex: 0, anchor });
    pointerDown(legend);
    expect(document.querySelector('.class-fill-popover')).toBeNull();
  });
});
