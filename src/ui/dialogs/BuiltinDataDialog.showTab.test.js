// © 2026 김용현
// @vitest-environment jsdom
/**
 * 데이터 불러오기 창을 특정 탭으로 여는 경로 검증.
 * Geocoding 안내창이 show('sheets')로 스프레드시트 탭을 바로 연다.
 *
 * 실습 카탈로그가 비면 #builtin-data-list 가 안 그려져 이벤트 바인딩이 죽으므로
 * (운영에서는 항상 채워져 있다) 최소 카탈로그를 흉내낸다.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { builtinDataManager } from '../../core/BuiltinDataManager.js';
import { builtinDataDialog } from './BuiltinDataDialog.js';

beforeEach(() => {
  document.body.innerHTML = '';
  vi.spyOn(builtinDataManager, 'loadCatalogs').mockResolvedValue();
  vi.spyOn(builtinDataManager, 'getPracticeCatalog').mockReturnValue([
    { id: 'g1', name: '그룹', datasets: [{ id: 'd1', name: '데이터', description: '', type: 'csv', file: 'x.csv' }] }
  ]);
});

afterEach(() => {
  builtinDataDialog.close();
  vi.restoreAllMocks();
});

const activeTab = () => document.querySelector('.builtin-tab.active').dataset.tab;
const tabContent = (tab) => document.querySelector(`[data-tab-content="${tab}"]`);

describe('BuiltinDataDialog.show(tab)', () => {
  it('인자가 없으면 실습 데이터 탭으로 연다', async () => {
    await builtinDataDialog.show();
    expect(activeTab()).toBe('basic');
  });

  it("show('sheets')는 스프레드시트 탭을 켜고 그 내용을 보인다", async () => {
    await builtinDataDialog.show('sheets');
    expect(activeTab()).toBe('sheets');
    expect(tabContent('sheets').style.display).not.toBe('none');
    expect(tabContent('basic').style.display).toBe('none');
  });

  it('닫았다가 인자 없이 다시 열면 실습 데이터 탭으로 돌아간다', async () => {
    await builtinDataDialog.show('sheets');
    builtinDataDialog.close();
    await builtinDataDialog.show();
    expect(activeTab()).toBe('basic');
  });
});
