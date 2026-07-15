#!/usr/bin/env node
/**
 * vite build 래퍼.
 *
 * 왜 필요한가
 * -----------
 * rollup의 Windows 네이티브 애드온(@rollup/rollup-win32-x64-msvc, Rust)이
 * 경로에 한글 같은 비 ASCII 문자가 있으면 번들링 도중 죽는다.
 *   종료 코드 -1073740791 (0xC0000409, STATUS_STACK_BUFFER_OVERRUN)
 *   "✓ 2336 modules transformed." 직후, JS 에러도 스택도 없이 프로세스가 사라진다.
 *
 * 확인한 사실 (2026-07-15)
 *   - 같은 폴더를 subst로 ASCII 드라이브(X:)에 매핑하면 정상 빌드된다.
 *     즉 코드가 아니라 경로 문자열이 원인이다.
 *   - rollup 4.54.0과 최신 4.62.2 모두 재현. 상위 버전에서 안 고쳐졌다.
 *   - 네이티브 바이너리 자체는 require()로 정상 로드된다. 로드가 아니라 실행 중 크래시다.
 *
 * 그래서 Windows에서 cwd에 비 ASCII가 있으면 임시 드라이브를 매핑해 거기서 빌드한다.
 * Linux/macOS(Vercel 포함)와 ASCII 경로에서는 vite를 그대로 부른다.
 */

const { spawnSync, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const cwd = process.cwd();
const hasNonAscii = /[^\x00-\x7F]/.test(cwd);
const isWindows = process.platform === 'win32';

/** vite build를 주어진 작업 디렉터리에서 실행 */
function runVite(workDir) {
  const result = spawnSync('npx', ['vite', 'build'], {
    cwd: workDir,
    stdio: 'inherit',
    shell: true
  });
  return result.status === null ? 1 : result.status;
}

/** 비어 있는 드라이브 문자를 찾는다 */
function findFreeDrive() {
  for (const letter of ['X', 'Y', 'W', 'V', 'U', 'T']) {
    if (!fs.existsSync(`${letter}:\\`)) return letter;
  }
  return null;
}

if (!isWindows || !hasNonAscii) {
  process.exit(runVite(cwd));
}

const drive = findFreeDrive();
if (!drive) {
  console.error('[build] 빈 드라이브 문자를 찾지 못해 현재 경로에서 빌드합니다.');
  console.error('[build] 경로에 비 ASCII 문자가 있어 rollup이 크래시할 수 있습니다.');
  process.exit(runVite(cwd));
}

console.log(`[build] 경로에 비 ASCII 문자가 있어 ${drive}: 로 매핑해 빌드합니다.`);
console.log(`[build]   ${cwd}`);

let mapped = false;
try {
  execSync(`subst ${drive}: "${cwd}"`, { stdio: 'pipe' });
  mapped = true;
} catch (e) {
  console.error(`[build] subst 실패, 현재 경로에서 빌드합니다: ${e.message}`);
  process.exit(runVite(cwd));
}

let status;
try {
  status = runVite(`${drive}:\\`);
} finally {
  if (mapped) {
    try {
      execSync(`subst ${drive}: /d`, { stdio: 'pipe' });
    } catch (e) {
      console.error(`[build] ${drive}: 매핑 해제 실패. 수동으로 "subst ${drive}: /d" 를 실행하세요.`);
    }
  }
}

// dist는 매핑된 드라이브를 통해 쓰였지만 실제로는 같은 폴더다. 확인만 하고 끝낸다.
if (status === 0) {
  const distIndex = path.join(cwd, 'dist', 'index.html');
  if (!fs.existsSync(distIndex)) {
    console.error('[build] 빌드는 성공했다는데 dist/index.html이 없습니다.');
    process.exit(1);
  }
}

process.exit(status);
