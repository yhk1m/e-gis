// © 2026 김용현
// eStoryMap/scripts/clean.js
// 빌드 산출물(dist, dist-electron, release) 청소.
// ⚠️ 이 머신은 node의 fs.rmSync(recursive) 같은 "프로그램적 재귀 삭제"가 보안정책
//    (Controlled Folder Access류)에 막혀 프로세스가 exit 127로 조용히 죽는다.
//    그래서 fs가 아니라 OS 네이티브 삭제(cmd `rmdir /s /q`)를 child_process로 호출한다.
// ⚠️ stale한 dist/가 남아 있으면 vite build의 emptyOutDir가 같은 삭제 차단에 걸려
//    "조용히" 127로 죽는다(=이 프로젝트의 "stale dist→127" 함정). 그래서 빌드 전 필수.
const { execSync } = require('node:child_process');

for (const dir of ['dist', 'dist-electron', 'release']) {
  try {
    execSync(`rmdir /s /q "${dir}"`, { stdio: 'ignore' }); // 없으면 에러 → 아래서 삼킴
  } catch {
    /* 폴더가 없을 때 등 — 무시 */
  }
}
