// © 2026 김용현
/**
 * escapeHtml - HTML 문자열에 값을 끼워 넣기 전 이스케이프
 *
 * 레이어 이름·파일 이름처럼 이용자가 정하는 문자열이 innerHTML 로 들어가면
 * `<img onerror=...>` 같은 값이 그대로 실행된다. 업로드 파일이나 구글시트에서
 * 흘러들어온 이름도 마찬가지라 삽입 지점마다 이 함수를 거친다.
 */
export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
