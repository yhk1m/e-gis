// © 2026 김용현
// eStoryMap/src/core/supabaseClient.js
// Supabase 클라이언트 생성만 담당. e-GIS 본체와 같은 프로젝트/키(src/core/SupabaseManager.js).
// anon key는 공개 전제 설계(e-GIS 웹 번들에 이미 노출) — 보안 경계는 RLS.
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://lufbotdmhgsuvejlytgh.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx1ZmJvdGRtaGdzdXZlamx5dGdoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYzMDY1NzUsImV4cCI6MjA4MTg4MjU3NX0.JMzU8SiR8jb39xcRe4ySQSvZJButJP8OeCqOMDkNbRI';

/** 세션은 supabase-js 기본 localStorage에 유지된다(앱 재시작 시 자동 로그인). */
export function createSupabaseClient() {
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}
