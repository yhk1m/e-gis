// © 2026 김용현
import { describe, it, expect } from 'vitest';
import { createStoryDoc, getPage, nextSourceId } from './StoryDoc.js';

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
