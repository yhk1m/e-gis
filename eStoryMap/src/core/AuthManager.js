// © 2026 김용현
// eStoryMap/src/core/AuthManager.js
// Supabase 인증 얇은 래퍼(접착) — 클라이언트 주입식(테스트는 가짜 클라이언트).
// 이식 원본: e-GIS src/core/SupabaseManager.js의 인증 계약(init/signIn/signOut/onAuthStateChange).
// 프로필·projects 메서드는 이식하지 않음 — e-GIS 클라우드 저장 제거됨(스펙 §0).

/** Supabase 에러를 사용자용 한국어 메시지로 변환한다(순수). */
export function authErrorMessage(error) {
  const msg = (error && error.message) || '';
  if (/invalid\s+login\s+credentials/i.test(msg)) return '이메일 또는 비밀번호가 올바르지 않습니다.';
  if (/email\s+not\s+confirmed/i.test(msg)) return '이메일 인증이 완료되지 않은 계정입니다.';
  if (/fetch|network/i.test(msg)) return '네트워크에 연결할 수 없습니다. 오프라인에서는 로컬 기능만 사용할 수 있습니다.';
  return msg || '로그인에 실패했습니다.';
}
