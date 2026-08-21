// © 2026 김용현
import { describe, it, expect } from 'vitest';
import { buildFeatureInfoSections } from './featureInfoModel.js';

// OL Feature 대역 — getProperties() 와 ol_uid 만 있으면 모델이 돈다
function fakeFeature(props, uid) {
  return { ol_uid: uid, getProperties: () => props };
}

const noDeps = { findLayer: () => null, getLabelField: () => null };

describe('buildFeatureInfoSections', () => {
  it('선택이 없으면 빈 배열', () => {
    expect(buildFeatureInfoSections([], noDeps)).toEqual([]);
    expect(buildFeatureInfoSections(null, noDeps)).toEqual([]);
  });

  it('geometry 는 속성 목록에서 빠진다', () => {
    const f = fakeFeature({ geometry: { getType: () => 'Point' }, 이름: '서울' }, '1');
    const [section] = buildFeatureInfoSections([f], noDeps);
    expect(section.attributes.map(a => a.name)).toEqual(['이름']);
  });

  it('geometry 가 아닌 이름으로 들어온 도형 값도 빠진다', () => {
    const f = fakeFeature({ geom: { getType: () => 'Polygon' }, 인구: 100 }, '1');
    const [section] = buildFeatureInfoSections([f], noDeps);
    expect(section.attributes.map(a => a.name)).toEqual(['인구']);
  });

  it('빈 값은 - 로 나온다', () => {
    const f = fakeFeature({ a: null, b: undefined, c: '', d: '  ', e: 0 }, '1');
    const [section] = buildFeatureInfoSections([f], noDeps);
    expect(section.attributes).toEqual([
      { name: 'a', value: '-' },
      { name: 'b', value: '-' },
      { name: 'c', value: '-' },
      { name: 'd', value: '-' },
      { name: 'e', value: '0' }
    ]);
  });

  it('제목: 레이어에 설정된 라벨 필드를 가장 먼저 쓴다', () => {
    const f = fakeFeature({ 이름: '무시됨', 별칭: '한강' }, '1');
    const deps = {
      findLayer: () => ({ id: 'L1', name: '하천' }),
      getLabelField: () => '별칭'
    };
    expect(buildFeatureInfoSections([f], deps)[0].title).toBe('한강');
  });

  it('제목: 라벨 필드가 없으면 이름 후보 필드를 쓴다', () => {
    const f = fakeFeature({ code: 11, 이름: '서울특별시' }, '1');
    expect(buildFeatureInfoSections([f], noDeps)[0].title).toBe('서울특별시');
  });

  it('제목: 이름 후보도 없으면 첫 문자열 속성을 쓴다', () => {
    const f = fakeFeature({ 인구: 9411440, 구분: '광역시' }, '1');
    expect(buildFeatureInfoSections([f], noDeps)[0].title).toBe('광역시');
  });

  it('제목: 쓸 문자열이 하나도 없으면 피처 N', () => {
    const f1 = fakeFeature({ 인구: 100 }, '1');
    const f2 = fakeFeature({ 인구: 200 }, '2');
    const sections = buildFeatureInfoSections([f1, f2], noDeps);
    expect(sections.map(s => s.title)).toEqual(['피처 1', '피처 2']);
  });

  it('라벨 필드 값이 비어 있으면 다음 후보로 넘어간다', () => {
    const f = fakeFeature({ 별칭: '', 이름: '서울' }, '1');
    const deps = { findLayer: () => ({ id: 'L1', name: '행정구역' }), getLabelField: () => '별칭' };
    expect(buildFeatureInfoSections([f], deps)[0].title).toBe('서울');
  });

  it('서로 다른 레이어를 섞어 골라도 각 섹션에 제 레이어명이 붙는다', () => {
    const a = fakeFeature({ 이름: '서울' }, '1');
    const b = fakeFeature({ 이름: '한강' }, '2');
    const deps = {
      findLayer: (f) => (f === a ? { id: 'L1', name: '행정구역' } : { id: 'L2', name: '하천' }),
      getLabelField: () => null
    };
    const sections = buildFeatureInfoSections([a, b], deps);
    expect(sections.map(s => s.layerName)).toEqual(['행정구역', '하천']);
  });

  it('key 는 ol_uid 를 쓴다 (접힘 상태를 기억하는 기준)', () => {
    const f = fakeFeature({ 이름: '서울' }, '42');
    expect(buildFeatureInfoSections([f], noDeps)[0].key).toBe('42');
  });
});
