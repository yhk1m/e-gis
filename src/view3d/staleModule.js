// © 2026 김용현
/**
 * 배포가 바뀌어 모듈을 못 불러온 상황인지 가려낸다.
 *
 * 3D는 버튼을 누른 순간 내려받는다(동적 import). 그래서 탭을 열어 둔 채로
 * 새 버전이 배포되면, 옛 페이지가 이미 사라진 옛 청크를 부르다 실패한다.
 * 코드 잘못이 아니라 새로고침이 필요한 상황이므로 메시지를 달리해야 한다.
 */

/** 브라우저마다 문구가 달라 여러 형태를 함께 본다 */
const PATTERNS = [
  /failed to fetch dynamically imported module/i,  // Chrome·Edge
  /error loading dynamically imported module/i,    // Firefox
  /importing a module script failed/i,             // Safari
  /dynamically imported module/i
];

/**
 * @param {unknown} error
 * @returns {boolean} 새 배포 때문에 청크를 못 받은 것으로 보이면 true
 */
export function isStaleModuleError(error) {
  if (!error) return false;
  const message = typeof error === 'string' ? error : String(error.message || error);
  return PATTERNS.some((pattern) => pattern.test(message));
}
