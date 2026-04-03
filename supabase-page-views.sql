-- e-GIS 방문자 카운터 테이블 및 정책
-- Supabase SQL Editor에서 실행하세요.

-- 1. 테이블 생성
CREATE TABLE IF NOT EXISTS page_views (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  visitor_id TEXT NOT NULL,
  visited_at TIMESTAMPTZ DEFAULT now(),
  visit_date DATE DEFAULT CURRENT_DATE
);

-- 2. 인덱스 생성 (조회 성능 향상)
CREATE INDEX IF NOT EXISTS idx_page_views_visit_date ON page_views (visit_date);
CREATE INDEX IF NOT EXISTS idx_page_views_visitor_id ON page_views (visitor_id, visit_date);

-- 3. RLS 활성화
ALTER TABLE page_views ENABLE ROW LEVEL SECURITY;

-- 4. 익명 사용자도 INSERT 가능하도록 정책 추가
CREATE POLICY "Anyone can insert page views"
  ON page_views FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- 5. 익명 사용자도 SELECT(카운트 조회) 가능하도록 정책 추가
CREATE POLICY "Anyone can read page views"
  ON page_views FOR SELECT
  TO anon, authenticated
  USING (true);

-- 6. 오늘 방문자 수 조회 함수 (중복 제거)
CREATE OR REPLACE FUNCTION get_visitor_counts()
RETURNS JSON AS $$
DECLARE
  today_count INTEGER;
  total_count INTEGER;
BEGIN
  SELECT COUNT(DISTINCT visitor_id) INTO today_count
  FROM page_views
  WHERE visit_date = CURRENT_DATE;

  SELECT COUNT(DISTINCT visitor_id) INTO total_count
  FROM page_views;

  RETURN json_build_object('today', today_count, 'total', total_count);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
