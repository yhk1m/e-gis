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

describe('GeocodingPanel 버튼', () => {
  it('사본 만들기는 새 탭(noopener)으로 사본 주소를 연다', () => {
    geocodingPanel.show();
    document.querySelector('#geocoding-copy').click();
    expect(window.open).toHaveBeenCalledWith(geocodingCopyUrl(), '_blank', 'noopener');
    // 창은 그대로 — 학생이 2·3단계를 이어서 읽는다
    expect(document.querySelector('.geocoding-modal')).not.toBeNull();
  });

  it('구글 시트 불러오기는 창을 닫고 데이터 불러오기 창을 스프레드시트 탭으로 연다', () => {
    geocodingPanel.show();
    document.querySelector('#geocoding-import').click();
    expect(document.querySelector('.geocoding-modal')).toBeNull();
    expect(builtinDataDialog.show).toHaveBeenCalledWith('sheets');
  });
});

describe('GeocodingPanel 닫기', () => {
  it('X 버튼', () => {
    geocodingPanel.show();
    document.querySelector('#geocoding-close').click();
    expect(document.querySelector('.geocoding-modal')).toBeNull();
  });

  it('바깥 클릭은 닫히고, 안쪽 클릭은 안 닫힌다', () => {
    geocodingPanel.show();
    document.querySelector('.geocoding-content').click();
    expect(document.querySelector('.geocoding-modal')).not.toBeNull();
    document.querySelector('.geocoding-modal').click();
    expect(document.querySelector('.geocoding-modal')).toBeNull();
  });

  it('Esc 로 닫히고, 닫힌 뒤에는 Esc 리스너가 남지 않는다', () => {
    geocodingPanel.show();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(document.querySelector('.geocoding-modal')).toBeNull();
    expect(geocodingPanel._escHandler).toBeNull();
  });
});
