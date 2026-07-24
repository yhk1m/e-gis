-- e-GIS 관리자용 "가입 회원 목록" 조회 함수
-- Supabase SQL Editor에서 1회 실행하세요.
--
-- 이메일은 auth.users 에만 있어 anon/authenticated 클라이언트로 직접 조인할 수 없습니다.
-- 이 함수는 SECURITY DEFINER 로 실행되어 auth.users 에 접근하되,
-- 내부에서 호출자가 관리자(fkv777@gmail.com)인지 검증한 뒤에만 결과를 반환합니다.
-- (가입은 했지만 프로필 미작성인 회원도 LEFT JOIN 으로 함께 표시됩니다.)

CREATE OR REPLACE FUNCTION admin_list_members()
RETURNS TABLE (
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
  -- 호출자 이메일 확인 (SECURITY DEFINER 라 auth.users 접근 가능)
  SELECT u.email INTO caller_email
  FROM auth.users u
  WHERE u.id = auth.uid();

  IF caller_email IS DISTINCT FROM 'fkv777@gmail.com' THEN
    RAISE EXCEPTION '권한이 없습니다. 관리자만 조회할 수 있습니다.'
      USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
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

-- 인증된 사용자가 호출할 수 있게 허용 (실제 접근 제어는 함수 내부에서 수행)
REVOKE ALL ON FUNCTION admin_list_members() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION admin_list_members() TO authenticated;
