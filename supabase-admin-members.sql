-- e-GIS 관리자용 회원 관리 함수 모음
-- Supabase SQL Editor에서 (재)실행하세요. 여러 번 실행해도 안전합니다.
--
-- 이메일/가입일은 auth.users 에만 있어 anon/authenticated 클라이언트로 직접 접근할 수 없습니다.
-- 아래 함수들은 SECURITY DEFINER 로 실행되되, 내부에서 호출자가 관리자(fkv777@gmail.com)인지
-- 검증한 뒤에만 동작합니다.

-- ============================================================
-- 1) 가입 회원 목록 조회 (user_id 포함 — 수정/삭제 대상 지정용)
--    반환 컬럼이 바뀌므로 기존 함수를 DROP 후 재생성합니다.
-- ============================================================
DROP FUNCTION IF EXISTS admin_list_members();

CREATE FUNCTION admin_list_members()
RETURNS TABLE (
  user_id    UUID,
  name       TEXT,
  email      TEXT,
  nickname   TEXT,
  region     TEXT,
  school     TEXT,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_email TEXT;
BEGIN
  SELECT u.email INTO caller_email FROM auth.users u WHERE u.id = auth.uid();

  IF caller_email IS DISTINCT FROM 'fkv777@gmail.com' THEN
    RAISE EXCEPTION '권한이 없습니다. 관리자만 조회할 수 있습니다.'
      USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    u.id,
    p.name,
    u.email::TEXT,
    p.nickname,
    p.region,
    p.school,
    u.created_at
  FROM auth.users u
  LEFT JOIN public.user_profiles p ON p.user_id = u.id
  ORDER BY u.created_at ASC;
END;
$$;

REVOKE ALL ON FUNCTION admin_list_members() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION admin_list_members() TO authenticated;

-- ============================================================
-- 2) 회원 프로필 수정 (이름/닉네임/지역/학교)
-- ============================================================
CREATE OR REPLACE FUNCTION admin_update_member_profile(
  target_user_id UUID,
  p_name     TEXT,
  p_nickname TEXT,
  p_region   TEXT,
  p_school   TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_email TEXT;
BEGIN
  SELECT u.email INTO caller_email FROM auth.users u WHERE u.id = auth.uid();

  IF caller_email IS DISTINCT FROM 'fkv777@gmail.com' THEN
    RAISE EXCEPTION '권한이 없습니다. 관리자만 수정할 수 있습니다.'
      USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = target_user_id) THEN
    RAISE EXCEPTION '대상 회원을 찾을 수 없습니다.';
  END IF;

  -- 프로필이 없으면 생성, 있으면 갱신 (user_id 유니크 제약 기준)
  INSERT INTO public.user_profiles (user_id, name, nickname, region, school, updated_at)
  VALUES (target_user_id, p_name, p_nickname, p_region, p_school, now())
  ON CONFLICT (user_id) DO UPDATE
    SET name      = EXCLUDED.name,
        nickname  = EXCLUDED.nickname,
        region    = EXCLUDED.region,
        school    = EXCLUDED.school,
        updated_at = now();
END;
$$;

REVOKE ALL ON FUNCTION admin_update_member_profile(UUID, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION admin_update_member_profile(UUID, TEXT, TEXT, TEXT, TEXT) TO authenticated;

-- ============================================================
-- 3) 회원 강제 탈퇴 (계정 완전 삭제 — 되돌릴 수 없음)
--    자식 데이터 → auth 계정 순으로 삭제. 함수는 한 트랜잭션이라
--    중간에 실패하면 전체 롤백됩니다(부분 삭제 없음).
-- ============================================================
CREATE OR REPLACE FUNCTION admin_delete_member(target_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_id    UUID;
  caller_email TEXT;
BEGIN
  caller_id := auth.uid();
  SELECT u.email INTO caller_email FROM auth.users u WHERE u.id = caller_id;

  IF caller_email IS DISTINCT FROM 'fkv777@gmail.com' THEN
    RAISE EXCEPTION '권한이 없습니다. 관리자만 삭제할 수 있습니다.'
      USING ERRCODE = '42501';
  END IF;

  -- 관리자 본인 계정은 삭제 불가 (락아웃 방지)
  IF target_user_id = caller_id THEN
    RAISE EXCEPTION '관리자 본인 계정은 삭제할 수 없습니다.';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = target_user_id) THEN
    RAISE EXCEPTION '대상 회원을 찾을 수 없습니다.';
  END IF;

  -- 자식 데이터 먼저 삭제
  DELETE FROM public.projects      WHERE user_id = target_user_id;
  DELETE FROM public.user_profiles WHERE user_id = target_user_id;

  -- auth 계정 삭제 (identities/sessions 등은 FK 연쇄로 함께 정리됨)
  DELETE FROM auth.users WHERE id = target_user_id;
END;
$$;

REVOKE ALL ON FUNCTION admin_delete_member(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION admin_delete_member(UUID) TO authenticated;
