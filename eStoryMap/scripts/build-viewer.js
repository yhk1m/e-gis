// © 2026 김용현
// 뷰어 빌드 → eGIS/public/story 배치.
// ⚠️ 재귀 삭제·복사는 CFA(Controlled Folder Access) 정책 때문에 OS 네이티브 명령 사용(clean.js 참조).
const { execSync } = require('node:child_process');
const { renameSync } = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');               // eStoryMap
const out = path.join(root, 'dist-viewer');
const dest = path.resolve(root, '..', 'public', 'story'); // eGIS/public/story

for (const dir of [out, dest]) {
  try { execSync(`rmdir /s /q "${dir}"`, { stdio: 'ignore' }); } catch { /* 없으면 무시 */ }
}
execSync('npx vite build --config vite.viewer.config.js', { cwd: root, stdio: 'inherit' });
renameSync(path.join(out, 'viewer.html'), path.join(out, 'index.html')); // rewrite 목적지 = /story/index.html
// robocopy는 종료코드 0~7이 성공 — execSync는 0 외 throw하므로 감싼다
try {
  execSync(`robocopy "${out}" "${dest}" /E /NFL /NDL /NJH /NJS`, { stdio: 'ignore' });
} catch (e) {
  if (typeof e.status !== 'number' || e.status > 7) throw e;
}
console.log('뷰어 배치 완료 → ' + dest);
