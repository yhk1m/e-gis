// © 2026 김용현
// e-GIS 스토리맵 공유 링크(/{handle}/{seq}) 서버 함수.
// 카카오톡 등 링크 미리보기 스크래퍼는 JS를 실행하지 않으므로, 정적 뷰어 셸(/story/)에
// 스토리맵 제목을 담은 <title>·Open Graph 태그를 심어서 돌려준다. 뷰어 동작은 그대로
// (브라우저 주소는 /{handle}/{seq} 유지 — 뷰어 JS가 pathname을 파싱).
const SUPABASE_URL = 'https://lufbotdmhgsuvejlytgh.supabase.co';
// anon key는 공개 전제 설계(웹 번들에 이미 노출) — 보안 경계는 RLS
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx1ZmJvdGRtaGdzdXZlamx5dGdoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYzMDY1NzUsImV4cCI6MjA4MTg4MjU3NX0.JMzU8SiR8jb39xcRe4ySQSvZJButJP8OeCqOMDkNbRI';

function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export default async function handler(req, res) {
  const handle = String((req.query && req.query.handle) || '');
  const seq = String((req.query && req.query.seq) || '');

  // 제목 조회 — 실패해도 미리보기만 일반 문구가 될 뿐, 페이지는 정상 서빙
  let title = null;
  if (/^[a-z0-9]+$/.test(handle) && /^\d{1,9}$/.test(seq)) {
    try {
      const r = await fetch(
        `${SUPABASE_URL}/rest/v1/published_storymaps?select=title&handle=eq.${handle}&seq=eq.${seq}`,
        { headers: { apikey: SUPABASE_ANON_KEY } },
      );
      const rows = await r.json();
      if (Array.isArray(rows) && rows.length && rows[0].title) title = rows[0].title;
    } catch { /* 무시 — 일반 제목으로 서빙 */ }
  }

  // 뷰어 셸은 배포된 것을 그대로 가져온다(자산 해시가 빌드마다 바뀌므로 파일 동봉 대신 self-fetch)
  const host = req.headers.host || 'e-gis.kr';
  let html;
  try {
    const shell = await fetch(`https://${host}/story/`);
    if (!shell.ok) throw new Error(`shell ${shell.status}`);
    html = await shell.text();
  } catch (e) {
    res.statusCode = 502;
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.end('스토리맵 뷰어를 불러오지 못했습니다.');
    return;
  }

  const pageTitle = title ? `${title} — e-GIS 스토리맵` : 'e-GIS 스토리맵';
  const description = 'e-GIS로 만든 스토리맵 — 지도를 움직이며 발표를 감상하세요.';
  const og = [
    `<meta property="og:title" content="${esc(pageTitle)}" />`,
    `<meta property="og:description" content="${esc(description)}" />`,
    '<meta property="og:type" content="website" />',
    `<meta property="og:url" content="https://e-gis.kr/${esc(handle)}/${esc(seq)}" />`,
    '<meta property="og:site_name" content="e-GIS" />',
    '<meta name="twitter:card" content="summary" />',
    `<meta name="description" content="${esc(description)}" />`,
  ].join('\n    ');
  html = html.replace(/<title>[^<]*<\/title>/, `<title>${esc(pageTitle)}</title>\n    ${og}`);

  res.statusCode = 200;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  // 엣지 캐시 60초 — 재게시로 제목이 바뀌어도 1분 내 반영, Supabase 부하 최소화
  res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=600');
  res.end(html);
}
