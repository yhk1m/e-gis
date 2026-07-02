// © 2026 김용현
import { describe, it, expect } from 'vitest';
import {
  createStoryDoc, getPage, nextSourceId, addSource, setLayerVisible,
} from './StoryDoc.js';

describe('createStoryDoc', () => {
  it('기본 페이지 1개를 가진 문서를 만든다', () => {
    const doc = createStoryDoc();
    expect(doc.meta.title).toBe('새 스토리맵');
    expect(doc.meta.mode).toBe('presentation');
    expect(doc.sources).toEqual([]);
    expect(doc.pages).toHaveLength(1);
    const page = doc.pages[0];
    expect(page.id).toBe('page_1');
    expect(page.title).toBe('페이지 1');
    expect(page.camera).toBeNull();
    expect(page.layerVisibility).toEqual([]);
    expect(page.overrides).toEqual({});
    expect(page.content).toEqual({ heading: '', body: '', caption: '' });
  });

  it('meta.id는 UUID, created=updated ISO', () => {
    const doc = createStoryDoc('부산 이야기');
    expect(doc.meta.title).toBe('부산 이야기');
    expect(doc.meta.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    expect(doc.meta.created).toBe(doc.meta.updated);
    expect(new Date(doc.meta.created).toString()).not.toBe('Invalid Date');
  });
});

describe('getPage', () => {
  it('id로 페이지를 찾고, 없으면 null', () => {
    const doc = createStoryDoc();
    expect(getPage(doc, 'page_1')).toBe(doc.pages[0]);
    expect(getPage(doc, 'page_999')).toBeNull();
  });
});

describe('nextSourceId', () => {
  it('빈 문서는 src_1', () => {
    expect(nextSourceId(createStoryDoc())).toBe('src_1');
  });

  it('기존 최대 번호 + 1', () => {
    const doc = createStoryDoc();
    doc.sources.push({ sourceId: 'src_1' }, { sourceId: 'src_3' });
    expect(nextSourceId(doc)).toBe('src_4');
  });
});

describe('addSource', () => {
  it('sources에 추가하고 소스를 반환한다', () => {
    const doc = createStoryDoc();
    const src = addSource(doc, { sourceId: 'src_1', filename: 'a.egis', egis: { version: '1.0' } },
      ['L_a', 'L_b'], 'page_1');
    expect(doc.sources).toHaveLength(1);
    expect(src.sourceId).toBe('src_1');
    expect(src.egis).toEqual({ version: '1.0' });
  });

  it('지정 페이지에 visible:true 엔트리를 레이어마다 추가한다', () => {
    const doc = createStoryDoc();
    addSource(doc, { sourceId: 'src_1', filename: 'a.egis', egis: {} }, ['L_a', 'L_b'], 'page_1');
    expect(getPage(doc, 'page_1').layerVisibility).toEqual([
      { sourceId: 'src_1', layerId: 'L_a', visible: true },
      { sourceId: 'src_1', layerId: 'L_b', visible: true },
    ]);
  });

  it('다른 페이지에는 엔트리를 추가하지 않는다(미등재=숨김 계약)', () => {
    const doc = createStoryDoc();
    doc.pages.push({ ...doc.pages[0], id: 'page_2', layerVisibility: [] });
    addSource(doc, { sourceId: 'src_1', filename: 'a.egis', egis: {} }, ['L_a'], 'page_1');
    expect(getPage(doc, 'page_2').layerVisibility).toEqual([]);
  });
});

describe('setLayerVisible', () => {
  it('기존 엔트리를 갱신한다', () => {
    const doc = createStoryDoc();
    addSource(doc, { sourceId: 'src_1', filename: 'a.egis', egis: {} }, ['L_a'], 'page_1');
    setLayerVisible(doc, 'page_1', 'src_1', 'L_a', false);
    expect(getPage(doc, 'page_1').layerVisibility[0].visible).toBe(false);
  });

  it('엔트리가 없으면 새로 만든다(upsert)', () => {
    const doc = createStoryDoc();
    setLayerVisible(doc, 'page_1', 'src_9', 'L_x', true);
    expect(getPage(doc, 'page_1').layerVisibility).toEqual([
      { sourceId: 'src_9', layerId: 'L_x', visible: true },
    ]);
  });

  it('변이는 meta.updated를 갱신한다', async () => {
    const doc = createStoryDoc();
    const before = doc.meta.updated;
    await new Promise((r) => setTimeout(r, 5)); // 타임스탬프 해상도 확보
    setLayerVisible(doc, 'page_1', 'src_1', 'L_a', true);
    expect(doc.meta.updated >= before).toBe(true);
    expect(doc.meta.updated).not.toBe(doc.meta.created);
  });
});
