// © 2026 김용현
// eStoryMap/src/webviewer/parseStoryPath.js
// 게시 주소 파싱(순수). Vercel rewrite로 /{handle}/{seq}가 뷰어에 그대로 온다.
// ?s=handle/seq는 로컬 미리보기 폴백(rewrite 없는 정적 서버에서 확인용).
export function parseStoryPath(pathname, search = '') {
  const q = new URLSearchParams(search).get('s');
  const target = q ? '/' + q : String(pathname || '');
  const m = /^\/([a-z0-9]+)\/(\d{1,9})\/?$/.exec(target);
  return m ? { handle: m[1], seq: Number(m[2]) } : null;
}
