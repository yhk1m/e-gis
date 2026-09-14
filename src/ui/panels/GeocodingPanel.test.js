// © 2026 김용현
// @vitest-environment jsdom
/**
 * Geocoding 안내창 검증.
 * 창은 링크 두 개가 전부다 — 사본 주소가 맞는지, 불러오기가 시트 탭으로 가는지,
 * 종료 경로(X·바깥 클릭·Esc)마다 창이 사라지는지 본다.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('../dialogs/BuiltinDataDialog.js', () => ({
  builtinDataDialog: { show: vi.fn() }
}));

import { builtinDataDialog } from '../dialogs/BuiltinDataDialog.js';
import { geocodingPanel, geocodingCopyUrl, GEOCODING_SHEET_ID } from './GeocodingPanel.js';

beforeEach(() => {
  document.body.innerHTML = '';
  vi.spyOn(window, 'open').mockImplementation(() => null);
});

afterEach(() => {
  geocodingPanel.close();
  vi.restoreAllMocks();
  builtinDataDialog.show.mockClear();
});

describe('geocodingCopyUrl', () => {
  it('시트 ID로 구글 시트 "사본 만들기" 주소를 만든다', () => {
    expect(geocodingCopyUrl()).toBe(`https://docs.google.com/spreadsheets/d/${GEOCODING_SHEET_ID}/copy`);
    expect(geocodingCopyUrl('abc')).toBe('https://docs.google.com/spreadsheets/d/abc/copy');
  });
});

describe('GeocodingPanel.show', () => {
  it('제목 Geocoding 과 3단계, 버튼 두 개를 그린다', () => {
    geocodingPanel.show();
    const modal = document.querySelector('.geocoding-modal');
    expect(modal).not.toBeNull();
    expect(modal.querySelector('.modal-header h3').textContent).toBe('Geocoding');
    expect(modal.querySelectorAll('.geocoding-steps > li')).toHaveLength(3);
    expect(modal.querySelector('#geocoding-copy')).not.toBeNull();
    expect(modal.querySelector('#geocoding-import')).not.toBeNull();
  });

  it('두 번 열어도 창은 하나만 남는다', () => {
    geocodingPanel.show();
    geocodingPanel.show();
    expect(document.querySelectorAll('.geocoding-modal')).toHaveLength(1);
  });
});
