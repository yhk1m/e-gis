// @vitest-environment jsdom
// © 2026 김용현
/**
 * 구간 채움 팝오버. 도구(choroplethTool)를 주입받아 "어떤 호출을 하는지"만 본다.
 * 캔버스가 없는 jsdom 에서는 질감 미리보기 타일이 단색으로 물러선다.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
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

function setup(fills) {
  document.body.innerHTML = `
    <div id="map" style="position:relative;width:800px;height:600px">
      <div class="choropleth-legend"><div class="choropleth-legend-items">
        <span class="choropleth-legend-color" data-class="0"></span>
        <span class="choropleth-legend-color" data-class="1"></span>
      </div></div>
    </div>`;
  const cfg = { attribute: 'pop', breaks: [0, 50, 100], colors: ['#ffffcc', '#800026'] };
  if (fills) cfg.fills = fills;
  const tool = fakeTool(cfg);
  const popover = new ClassFillPopover({ tool });
  const anchor = document.querySelectorAll('.choropleth-legend-color')[1];
  return { tool, popover, anchor };
}

const change = (el, value) => { el.value = value; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); };

beforeEach(() => { document.body.innerHTML = ''; });

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
    await new Promise((r) => setTimeout(r, 0));
    expect(onMessage).toHaveBeenCalledWith('이미지 파일이 아닙니다.');
    expect(tool.setClassFill).not.toHaveBeenCalled();
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
    const { popover, anchor } = setup();
    popover.open({ layerId: 'L', classIndex: 0, anchor });
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(document.querySelector('.class-fill-popover')).toBeNull();

    popover.open({ layerId: 'L', classIndex: 0, anchor });
    anchor.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    expect(document.querySelector('.class-fill-popover')).not.toBeNull();
    document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    expect(document.querySelector('.class-fill-popover')).toBeNull();

    popover.open({ layerId: 'L', classIndex: 0, anchor });
    document.querySelector('.class-fill-close').click();
    expect(document.querySelector('.class-fill-popover')).toBeNull();
  });
});
