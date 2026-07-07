// © 2026 김용현
// eStoryMap/src/shared/version.js
// 버전 문자열 비교(업데이트 확인용). "v0.1.1" / "0.1.1" 모두 허용, prerelease 접미사는 무시.

export function parseVersion(v) {
  return String(v == null ? '' : v)
    .trim()
    .replace(/^v/i, '')
    .split('.')
    .map((n) => parseInt(n, 10) || 0);
}

/** latest가 current보다 높은 버전이면 true(자리별 숫자 비교). */
export function isNewerVersion(latest, current) {
  const a = parseVersion(latest);
  const b = parseVersion(current);
  const len = Math.max(a.length, b.length);
  for (let i = 0; i < len; i++) {
    const x = a[i] || 0;
    const y = b[i] || 0;
    if (x !== y) return x > y;
  }
  return false;
}
