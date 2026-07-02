// © 2026 김용현
import { describe, it, expect, vi } from 'vitest';
import { createSourcePanel } from './SourcePanel.js';

// SourceRegistry 대역: entriesList만 흉내(레이어는 get('egisLayerName')만 필요)
function fakeRegistry(entries) {
  return {
    entriesList: () => entries.map(({ sourceId, layerId, name }) => ({
      sourceId, layerId, layer: { get: (k) => (k === 'egisLayerName' ? name : null) },
    })),
  };
}

const DOC = {
  sources: [
    { sourceId: 'src_1', filename: '부산.egis' },
    { sourceId: 'src_2', filename: '뒷산.tif' },
  ],
};

const REG = fakeRegistry([
  { sourceId: 'src_1', layerId: 'L_a', name: '인구' },
  { sourceId: 'src_1', layerId: 'L_b', name: '경계' },
  { sourceId: 'src_2', layerId: 'L_dem', name: '고도' },
]);

function pageWith(entries) {
  return { layerVisibility: entries };
}

describe('SourcePanel', () => {
  it('소스별 그룹과 레이어 이름을 렌더한다', () => {
    const el = document.createElement('div');
    const panel = createSourcePanel(el, { onToggleLayer: vi.fn() });
    panel.render(DOC, pageWith([]), REG);
    const names = [...el.querySelectorAll('.source-name')].map((n) => n.textContent);
    expect(names).toEqual(['부산.egis', '뒷산.tif']);
    const rows = [...el.querySelectorAll('.layer-row')].map((n) => n.textContent);
    expect(rows).toEqual(['인구', '경계', '고도']);
  });

  it('체크 상태가 페이지 엔트리를 반영한다(미등재는 unchecked)', () => {
    const el = document.createElement('div');
    const panel = createSourcePanel(el, { onToggleLayer: vi.fn() });
    panel.render(DOC, pageWith([
      { sourceId: 'src_1', layerId: 'L_a', visible: true },
      { sourceId: 'src_1', layerId: 'L_b', visible: false },
    ]), REG);
    const boxes = [...el.querySelectorAll('input[type=checkbox]')];
    expect(boxes.map((b) => b.checked)).toEqual([true, false, false]); // L_dem 미등재 → false
  });

  it('체크 변경 시 onToggleLayer(sourceId, layerId, checked) 호출', () => {
    const el = document.createElement('div');
    const onToggleLayer = vi.fn();
    const panel = createSourcePanel(el, { onToggleLayer });
    panel.render(DOC, pageWith([]), REG);
    const box = el.querySelector('input[type=checkbox]');
    box.checked = true;
    box.dispatchEvent(new Event('change'));
    expect(onToggleLayer).toHaveBeenCalledWith('src_1', 'L_a', true);
  });

  it('소스가 없으면 안내 문구를 보여준다', () => {
    const el = document.createElement('div');
    const panel = createSourcePanel(el, { onToggleLayer: vi.fn() });
    panel.render({ sources: [] }, pageWith([]), fakeRegistry([]));
    expect(el.querySelector('.panel-empty')).not.toBeNull();
  });

  it('다른 페이지로 다시 render하면 체크 상태가 갱신된다', () => {
    const el = document.createElement('div');
    const panel = createSourcePanel(el, { onToggleLayer: vi.fn() });
    panel.render(DOC, pageWith([{ sourceId: 'src_1', layerId: 'L_a', visible: true }]), REG);
    expect(el.querySelector('input[type=checkbox]').checked).toBe(true);
    panel.render(DOC, pageWith([]), REG);
    expect(el.querySelector('input[type=checkbox]').checked).toBe(false);
  });
});
