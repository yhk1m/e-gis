// © 2026 김용현
import { describe, it, expect } from 'vitest';
import { categoryOf, CATEGORIES } from './_categories.js';
import { CATALOG } from './_catalog.js';

describe('categoryOf — 제목으로 갈래를 정한다', () => {
  const cases = [
    ['서울 버스정류소', '교통'],
    ['공영주차장 안내 정보', '교통'],
    ['서울 공공도서관', '교육'],
    ['어린이집 정보', '교육'],
    ['병원 인허가 정보', '복지·의료'],
    ['서울 문화공간', '문화·관광'],
    ['관광숙박업 인허가 정보', '문화·관광'],
    ['서울 공원', '생활·편의'],
    ['공공와이파이 위치정보', '생활·편의'],
    ['지진대피소 현황', '안전'],
    ['잔여시간 표시 신호등 현황', '안전'],
    ['일반음식점 인허가 정보', '상업'],
    ['대기오염 측정정보', '환경']
  ];

  cases.forEach(([name, expected]) => {
    it(`"${name}" → ${expected}`, () => {
      expect(categoryOf({ name })).toBe(expected);
    });
  });

  it('갈래를 못 정하면 기타로 보낸다', () => {
    expect(categoryOf({ name: '알 수 없는 무엇' })).toBe('기타');
  });

  it('설명도 함께 본다', () => {
    expect(categoryOf({ name: '무엇', description: '지하철 승하차 인원' })).toBe('교통');
  });
});

describe('CATEGORIES', () => {
  it('기타가 마지막이다 (목록에서 아래로 간다)', () => {
    expect(CATEGORIES[CATEGORIES.length - 1]).toBe('기타');
  });

  it('categoryOf가 내놓는 값은 모두 CATEGORIES 안에 있다', () => {
    const used = new Set(CATALOG.map(entry => categoryOf(entry)));
    used.forEach(name => expect(CATEGORIES).toContain(name));
  });

  it('실제 카탈로그에서 기타가 절반을 넘지 않는다 (분류가 제 구실을 해야 한다)', () => {
    const etc = CATALOG.filter(entry => categoryOf(entry) === '기타').length;
    expect(etc / CATALOG.length).toBeLessThan(0.5);
  });
});

import { regionOf } from './_categories.js';

describe('regionOf — 어느 지역 자료인가', () => {
  it('제공처로 지역을 정한다', () => {
    expect(regionOf({ provider: 'seoul' })).toBe('서울');
    expect(regionOf({ provider: 'gg' })).toBe('경기');
    expect(regionOf({ provider: 'data.go.kr' })).toBe('전국');
  });

  it('모르는 제공처는 전국으로 본다', () => {
    expect(regionOf({ provider: '어디' })).toBe('전국');
    expect(regionOf({})).toBe('전국');
  });
});
