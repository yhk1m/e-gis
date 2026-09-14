-- 회원 본인 탈퇴(계정 완전 삭제) 함수 — Supabase SQL Editor에서 1회 실행하세요.
--
-- 왜 필요한가
-- -----------
-- 클라이언트(anon 키)로는 auth.users 행을 지울 수 없어, 지금까지 "회원 탈퇴"는
-- 프로필·프로젝트만 지우고 로그아웃했다. 계정(이메일)과 게시한 스토리맵은 남았다.
-- 개인정보 처리방침은 "회원탈퇴 기능을 통해 즉시 삭제"라고 안내하므로,
-- 탈퇴 한 번으로 계정까지 지워지도록 SECURITY DEFINER 함수를 둔다.
--
-- 자식 데이터 → auth 계정 순으로 지운다. published_storymaps 는 FK 연쇄(ON DELETE
-- CASCADE)로도 지워지지만, 어떤 자료가 함께 사라지는지 읽히도록 명시한다.
-- 함수는 한 트랜잭션이라 중간에 실패하면 전체 롤백된다(부분 삭제 없음).

CREATE OR REPLACE FUNCTION delete_own_account()
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
  IF caller_id IS NULL THEN
    RAISE EXCEPTION '로그인이 필요합니다.' USING ERRCODE = '42501';
  END IF;

  SELECT u.email INTO caller_email FROM auth.users u WHERE u.id = caller_id;

  -- 관리자 계정은 이 경로로 지울 수 없다 (락아웃 방지, admin_delete_member 와 같은 기준)
  IF caller_email = 'fkv777@gmail.com' THEN
    RAISE EXCEPTION '관리자 계정은 탈퇴할 수 없습니다.';
  END IF;

  DELETE FROM public.published_storymaps WHERE user_id = caller_id;
  DELETE FROM public.projects            WHERE user_id = caller_id;
  DELETE FROM public.user_profiles       WHERE user_id = caller_id;

  -- auth 계정 삭제 (identities/sessions 등은 FK 연쇄로 함께 정리됨)
  DELETE FROM auth.users WHERE id = caller_id;
END;
$$;

REVOKE ALL ON FUNCTION delete_own_account() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION delete_own_account() TO authenticated;
