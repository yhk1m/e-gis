// © 2026 김용현
// @vitest-environment jsdom
/**
 * 좌표 가져오기 미리보기가 고른 좌표계를 따르는지 검증한다.
 *
 * 미리보기는 한때 좌표계와 무관하게 위경도 범위(-90~90)로만 유효 행을 셌다.
 * TableLoader는 이미 TM 좌표를 다루도록 고쳤는데 미리보기가 여전히 전 행을
 * "잘못된 좌표"로 잡으면 레이어 생성 버튼이 계속 잠긴다 — 그게 이 테스트가
 * 못박는 회귀다.
 */
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { coordinateSystem } from '../../core/CoordinateSystem.js';
import { tableLoader } from '../../loaders/TableLoader.js';
import { coordinateImportPanel } from './CoordinateImportPanel.js';

beforeAll(() => coordinateSystem.init());

/** 모달을 열고 데이터를 채운 뒤 컬럼 옵션을 갱신한다 */
function openModalWith(rows) {
  coordinateImportPanel.show();
  tableLoader.headers = Object.keys(rows[0]);
  tableLoader.data = rows;
  tableLoader.fileName = '테스트';
  coordinateImportPanel.updateColumnOptions();
}

/** select 값을 바꾸고 change 이벤트를 쏜다 (실제 사용자 조작을 흉내낸다) */
function selectValue(id, value) {
  const el = document.getElementById(id);
  el.value = value;
  el.dispatchEvent(new Event('change'));
}

describe('좌표 가져오기 미리보기 — 좌표계 반영', () => {
  beforeEach(() => {
    document.querySelectorAll('.coord-import-modal').forEach((m) => m.remove());
    tableLoader.clear();
  });

  it('EPSG:5186을 고르면 TM 좌표 행이 유효로 세어지고 버튼이 풀린다', () => {
    openModalWith([{ Y: 452650.44, X: 197978.30 }]);

    selectValue('coord-lat-column', 'Y');
    selectValue('coord-lon-column', 'X');
    selectValue('coord-crs', 'EPSG:5186');

    expect(document.getElementById('valid-count').textContent).toBe('1');
    expect(document.getElementById('invalid-count').textContent).toBe('0');
    expect(document.getElementById('coord-import-apply').disabled).toBe(false);
  });

  it('EPSG:4326이면 위경도 범위를 벗어난 행은 여전히 잘못된 좌표로 센다', () => {
    openModalWith([
      { 위도: 37.5667, 경도: 126.9784 },
      { 위도: 452650.44, 경도: 197978.30 }
    ]);

    selectValue('coord-lat-column', '위도');
    selectValue('coord-lon-column', '경도');
    selectValue('coord-crs', 'EPSG:4326');

    expect(document.getElementById('valid-count').textContent).toBe('1');
    expect(document.getElementById('invalid-count').textContent).toBe('1');
    expect(document.getElementById('coord-import-apply').disabled).toBe(false);
  });
});
