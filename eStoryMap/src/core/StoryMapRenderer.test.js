// © 2026 김용현
import { describe, it, expect } from 'vitest';
import { applyPageVisibility } from './StoryMapRenderer.js';
import { SourceRegistry } from './SourceRegistry.js';
import { parseEgisDoc } from './egisParse.js';
import { createStoryDoc, addSource, addPage, getPage, setLayerVisible } from './StoryDoc.js';

const VECTOR = (id) => ({
  id, name: id, type: 'vector', geometryType: 'Polygon',
  visible: true, color: '#ef4444', opacity: 1,
  features: { type: 'FeatureCollection', features: [] },
});

function setup() {
  const mv = { addLayer() {} };
  const reg = new SourceRegistry(mv);
  const doc = createStoryDoc();
  const parsed = parseEgisDoc({ version: '1.0', layers: [VECTOR('L_a'), VECTOR('L_b')] });
  const { builtLayerIds } = reg.addSource('src_1', parsed);
  addSource(doc, { sourceId: 'src_1', filename: 'a.egis', egis: {} }, builtLayerIds, 'page_1');
  return { reg, doc };
}

describe('applyPageVisibility', () => {
  it('등재된 visible:true 레이어를 켠다', () => {
    const { reg, doc } = setup();
    applyPageVisibility(getPage(doc, 'page_1'), reg);
    expect(reg.getLayer('src_1', 'L_a').getVisible()).toBe(true);
    expect(reg.getLayer('src_1', 'L_b').getVisible()).toBe(true);
  });

  it('visible:false 엔트리는 끈다', () => {
    const { reg, doc } = setup();
    setLayerVisible(doc, 'page_1', 'src_1', 'L_b', false);
    applyPageVisibility(getPage(doc, 'page_1'), reg);
    expect(reg.getLayer('src_1', 'L_a').getVisible()).toBe(true);
    expect(reg.getLayer('src_1', 'L_b').getVisible()).toBe(false);
  });

  it('미등재 레이어는 숨긴다', () => {
    const { reg, doc } = setup();
    const p2 = addPage(doc, 'page_1');
    p2.layerVisibility = []; // 빈 페이지
    applyPageVisibility(p2, reg);
    expect(reg.getLayer('src_1', 'L_a').getVisible()).toBe(false);
    expect(reg.getLayer('src_1', 'L_b').getVisible()).toBe(false);
  });

  it('페이지 전환 시나리오: page_1(모두 켬) ↔ page_2(L_a만) 왕복', () => {
    const { reg, doc } = setup();
    const p2 = addPage(doc, 'page_1');
    setLayerVisible(doc, p2.id, 'src_1', 'L_b', false);
    applyPageVisibility(getPage(doc, p2.id), reg);
    expect(reg.getLayer('src_1', 'L_b').getVisible()).toBe(false);
    applyPageVisibility(getPage(doc, 'page_1'), reg);
    expect(reg.getLayer('src_1', 'L_b').getVisible()).toBe(true);
  });
});
