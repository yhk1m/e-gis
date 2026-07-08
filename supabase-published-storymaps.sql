-- 스토리맵 웹 게시 테이블 및 정책 — Supabase SQL Editor에서 1회 실행하세요.
-- 뷰어(e-gis.kr/{handle}/{seq})가 (handle, seq)로 공개 조회합니다.

CREATE TABLE IF NOT EXISTS published_storymaps (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  handle TEXT NOT NULL,
  seq INT NOT NULL,
  title TEXT NOT NULL DEFAULT '',
  doc JSONB NOT NULL,
  published_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (handle, seq),
  UNIQUE (user_id, seq)
);

ALTER TABLE published_storymaps ENABLE ROW LEVEL SECURITY;

-- 읽기는 누구나(게시 = 공개), 쓰기/수정/삭제는 본인만
CREATE POLICY "Anyone can read published storymaps"
  ON published_storymaps FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Owners can insert" ON published_storymaps FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Owners can update" ON published_storymaps FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Owners can delete" ON published_storymaps FOR DELETE
  TO authenticated USING (auth.uid() = user_id);
