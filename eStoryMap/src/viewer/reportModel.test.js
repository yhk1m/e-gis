// © 2026 김용현
import { describe, it, expect } from 'vitest';
import { buildReportSections } from './reportModel.js';
import { createStoryDoc, addSource, setPageContent, addPage, setPageKind } from '../core/StoryDoc.js';

function docWithContent() {
  const doc = createStoryDoc();
  const egis = {
    version: '1.0',
    layers: [{ id: 'L_pop', name: '인구밀도', type: 'vector', color: '#e11d48' }],
  };
  addSource(doc, { sourceId: 'src_1', filename: 'a.egis', egis }, ['L_pop'], 'page_1');
  setPageContent(doc, 'page_1', { heading: '부산', body: '**굵게**', caption: '자료: 통계청' });
  return doc;
}

describe('buildReportSections', () => {
  it('페이지별 heading/bodyHtml(마크다운)/caption/image를 담는다', () => {
    const doc = docWithContent();
    const sections = buildReportSections(doc, { page_1: 'data:img1' });
    expect(sections).toHaveLength(1);
    const s = sections[0];
    expect(s.id).toBe('page_1');
    expect(s.heading).toBe('부산');
    expect(s.bodyHtml).toContain('<strong>굵게</strong>');
    expect(s.caption).toBe('자료: 통계청');
    expect(s.image).toBe('data:img1');
  });

  it('이미지가 없으면 image=null', () => {
    const doc = docWithContent();
    expect(buildReportSections(doc, {})[0].image).toBeNull();
  });

  it('범례 visible(기본)이면 보이는 레이어 항목을 담는다', () => {
    const doc = docWithContent();
    expect(buildReportSections(doc, {})[0].legend).toEqual([
      { key: 'src_1:L_pop', label: '인구밀도', kind: 'swatch', color: '#e11d48', hidden: false },
    ]);
  });

  it('범례 visible=false이면 빈 배열', () => {
    const doc = docWithContent();
    doc.meta.legend = { visible: false, pos: { x: 0, y: 0 }, overrides: {} };
    expect(buildReportSections(doc, {})[0].legend).toEqual([]);
  });

  it('hidden override 항목은 범례에서 제외한다', () => {
    const doc = docWithContent();
    doc.meta.legend = { visible: true, pos: { x: 0, y: 0 }, overrides: { 'src_1:L_pop': { hidden: true } } };
    expect(buildReportSections(doc, {})[0].legend).toEqual([]);
  });

  it('여러 페이지를 문서 순서대로 담는다', () => {
    const doc = docWithContent();
    const p2 = addPage(doc, 'page_1');
    const sections = buildReportSections(doc, {});
    expect(sections.map((s) => s.id)).toEqual(['page_1', p2.id]);
  });

  it('기본 kind는 map이고 캡처 이미지·범례를 담는다', () => {
    const doc = docWithContent();
    const s = buildReportSections(doc, { page_1: 'data:img1' })[0];
    expect(s.kind).toBe('map');
    expect(s.image).toBe('data:img1');
    expect(s.legend.length).toBe(1);
  });

  it('title/media 슬라이드는 이미지·범례 없이 담는다(kind 유지)', () => {
    const doc = docWithContent();
    setPageKind(doc, 'page_1', 'title');
    let s = buildReportSections(doc, { page_1: 'data:img1' })[0];
    expect(s.kind).toBe('title');
    expect(s.image).toBeNull(); // 지도 캡처 안 씀
    expect(s.legend).toEqual([]);
    expect(s.heading).toBe('부산'); // 표지 제목은 유지

    setPageKind(doc, 'page_1', 'media');
    s = buildReportSections(doc, { page_1: 'data:img1' })[0];
    expect(s.kind).toBe('media');
    expect(s.image).toBeNull();
    expect(s.legend).toEqual([]);
  });
});
