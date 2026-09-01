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
import { layerManager } from '../../core/LayerManager.js';
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

describe('좌표 가져오기 미리보기 — 사용자 선택 보존', () => {
  beforeEach(() => {
    document.querySelectorAll('.coord-import-modal').forEach((m) => m.remove());
    tableLoader.clear();
  });

  it('사용자가 좌표계를 손으로 고르면 컬럼을 다시 선택해도 되돌리지 않는다', () => {
    // 5186과 5181은 원점이 같고 y_0(60만/50만)만 달라 좌표만으로는 갈리지
    // 않는다 — detectCrs가 ambiguous로 내놓는 전형적인 짝이다. 이럴 때
    // 사용자가 드롭다운을 직접 고쳐 주는 것이 정상 경로이므로, 그 뒤 컬럼을
    // 다시 만져도(오타 수정 등) suggestCrs가 그 선택을 지우면 안 된다.
    openModalWith([{ Y: 452650.44, X: 197978.30 }]);

    selectValue('coord-lat-column', 'Y');
    selectValue('coord-lon-column', 'X'); // suggestCrs가 여기서 한 번 자동으로 돈다

    selectValue('coord-crs', 'EPSG:5181'); // 사용자가 직접 고른다

    // 컬럼을 다시 만진다 — suggestCrs가 다시 돌아도 사용자 선택을 지우면 안 된다
    selectValue('coord-lon-column', 'X');

    expect(document.getElementById('coord-crs').value).toBe('EPSG:5181');
  });

  it('모달을 새로 열면 이전 선택 기억이 남지 않는다', () => {
    // crsTouchedByUser 플래그는 싱글턴 인스턴스에 남는다. render()가 매번
    // 되돌리지 않으면 이전에 연 모달에서 사용자가 좌표계를 만졌다는 사실이
    // 다음 파일에도 새어 들어가 자동 추측이 죽어버린다.
    openModalWith([{ Y: 452650.44, X: 197978.30 }]);
    selectValue('coord-crs', 'EPSG:5181');
    expect(coordinateImportPanel.crsTouchedByUser).toBe(true);

    openModalWith([{ Y: 452650.44, X: 197978.30 }]);
    expect(coordinateImportPanel.crsTouchedByUser).toBe(false);
  });
});

describe('좌표 가져오기 미리보기 — 판정 기준 일치', () => {
  beforeEach(() => {
    document.querySelectorAll('.coord-import-modal').forEach((m) => m.remove());
    tableLoader.clear();
  });

  it('미리보기가 세는 유효 행 수는 createPointLayer가 실제로 만드는 피처 수와 같다', () => {
    // 1e9는 숫자로는 멀쩡히 파싱되지만 EPSG:5186(TM) 투영으로는 발산해
    // proj4가 [Infinity, NaN]을 낸다 — "숫자니까 유효"만 보면 놓치는 값이다.
    // TableLoader.createPointLayer는 변환 결과의 유한성까지 확인해 이런 행을
    // 버리므로, 미리보기도 같은 기준(canProject)을 써야 버튼이 열리고 나서
    // 조용히 버려지는 행이 생기지 않는다.
    const rows = [
      { Y: 452650.44, X: 197978.30 }, // 정상 범위
      { Y: 1e9, X: 1e9 }              // 투영이 발산하는 값
    ];
    openModalWith(rows);

    selectValue('coord-lat-column', 'Y');
    selectValue('coord-lon-column', 'X');
    selectValue('coord-crs', 'EPSG:5186');

    const previewValid = Number(document.getElementById('valid-count').textContent);
    const previewInvalid = Number(document.getElementById('invalid-count').textContent);

    const { layerId, featureCount, skippedCount } =
      tableLoader.createPointLayer('Y', 'X', '판정 일치 검증', 'EPSG:5186');

    expect(previewValid).toBe(featureCount);
    expect(previewInvalid).toBe(skippedCount);
    expect(featureCount).toBe(1);
    expect(skippedCount).toBe(1);

    layerManager.removeLayer(layerId);
  });
});
