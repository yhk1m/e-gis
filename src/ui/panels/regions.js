// © 2026 김용현
/**
 * regions - 마이페이지 지역(시도) 목록과 옛 값 보정
 *
 * 전남·광주는 '전남광주' 하나로 합쳐 쓴다(전남광주통합특별시).
 * 이미 '전남'/'광주'로 저장된 회원 값은 supabase-region-merge.sql 로 옮기지만,
 * 그 전에 마이페이지를 열어도 목록에서 '전남광주'가 선택돼 보이도록 여기서 한 번 더 보정한다.
 */

// 시도 목록 (짧은 이름)
export const REGIONS = [
  '서울', '부산', '대구', '인천', '대전', '울산', '세종',
  '경기', '강원', '충북', '충남', '전북', '전남광주', '경북', '경남', '제주'
];

// 합쳐진 옛 값 → 새 값
const MERGED = {
  '전남': '전남광주',
  '광주': '전남광주'
};

/**
 * 저장된 지역값을 현재 목록에 맞는 값으로 바꾼다.
 * 목록에 없는 값은 건드리지 않고 그대로 돌려준다.
 * @param {string} region
 * @returns {string}
 */
export function normalizeRegion(region) {
  if (!region) return '';
  return MERGED[region] || region;
}
