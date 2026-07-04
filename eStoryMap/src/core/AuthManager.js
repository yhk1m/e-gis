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

/**
 * 인증 상태의 단일 소유자. client는 supabase-js 클라이언트(또는 테스트용 가짜).
 * @param {{ client: object }} deps
 */
export function createAuthManager({ client }) {
  let user = null;
  const listeners = new Set();

  // 같은 사용자 재통지(INITIAL_SESSION·TOKEN_REFRESHED 등)로 시작 화면 로그인 폼이
  // 다시 그려져 입력 중인 값이 날아가지 않게, 신원이 바뀔 때만 발화한다.
  function setUser(next) {
    const changed = ((next && next.id) || null) !== ((user && user.id) || null);
    user = next || null;
    if (changed) for (const cb of [...listeners]) cb({ user });
  }

  return {
    /** 세션 복원 + 상태 변화 구독. 실패해도 throw하지 않음(오프라인 → 로컬 모드). */
    async init() {
      try {
        const { data } = await client.auth.getSession();
        client.auth.onAuthStateChange((_event, session) => {
          setUser(session ? session.user : null);
        });
        setUser(data && data.session ? data.session.user : null);
      } catch (e) {
        console.warn('[auth] 세션 복원 실패(로컬 모드로 계속):', e && e.message);
      }
    },

    /** 성공 시 user 반환, 실패 시 한국어 메시지의 Error를 throw. */
    async signIn(email, password) {
      let res;
      try {
        res = await client.auth.signInWithPassword({ email, password });
      } catch (e) {
        throw new Error(authErrorMessage(e)); // 오프라인 등 — reject 경로도 한국어화
      }
      if (res.error) throw new Error(authErrorMessage(res.error));
      setUser(res.data.user);
      return res.data.user;
    },

    /** 로컬 상태는 항상 비운다 — 서버 세션 무효화 실패(오프라인)는 치명적이지 않음. */
    async signOut() {
      try {
        await client.auth.signOut();
      } catch (e) {
        console.warn('[auth] 서버 로그아웃 실패(로컬 세션은 해제됨):', e && e.message);
      }
      setUser(null);
    },

    getUser() { return user; },
    isLoggedIn() { return !!user; },

    /** cb({user}) 구독. 해제 함수를 반환한다. */
    onChange(cb) {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
  };
}
