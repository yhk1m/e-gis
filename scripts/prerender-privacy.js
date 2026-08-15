// © 2026 김용현
/**
 * dist/privacy.html 에 개인정보 처리방침 본문을 미리 심는다.
 *
 * 왜 필요한가
 * -----------
 * privacy.html 은 <div id="privacy-app"></div> 하나뿐이고 본문은 JS 가 그린다.
 * 그래서 페이지를 바깥에서 받아 글자만 읽는 쪽에는 방침이 빈 화면으로 보인다.
 *   - 도름스 마크 재검증(앱 주소를 열어 방침 필수 항목을 찾는다)
 *   - 검색엔진, 링크 미리보기
 *   - JS 를 끈 브라우저
 * 방침은 「개인정보 보호법」 제30조에 따라 공개해야 하는 문서라 이런 경우에도
 * 읽혀야 한다. 그래서 빌드 끝에 같은 마크업을 정적 HTML 로 넣어 둔다.
 * 브라우저에서는 privacy-page.js 가 같은 내용으로 다시 그리므로 화면은 그대로다.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { privacyPageHTML } from '../src/ui/privacyPageMarkup.js';

const target = path.join(process.cwd(), 'dist', 'privacy.html');

if (!existsSync(target)) {
  console.error('[prerender-privacy] dist/privacy.html 이 없습니다. 먼저 빌드하세요.');
  process.exit(1);
}

const html = readFileSync(target, 'utf8');
const mount = '<div id="privacy-app"></div>';

if (!html.includes(mount)) {
  // 이미 심었거나 마크업이 바뀐 경우. 조용히 넘기면 방침이 안 읽히는 걸 놓치므로 실패시킨다.
  console.error(`[prerender-privacy] '${mount}' 를 찾지 못했습니다. privacy.html 구조가 바뀌었는지 확인하세요.`);
  process.exit(1);
}

const filled = html.replace(mount, `<div id="privacy-app">${privacyPageHTML('/')}</div>`);
writeFileSync(target, filled, 'utf8');

// 심은 뒤 실제로 본문이 들어갔는지 확인한다. 조항 제목이 없으면 헛심은 것이다.
const check = ['제7조', '개인정보 보호책임자', '제10조'];
const missing = check.filter((w) => !filled.includes(w));
if (missing.length) {
  console.error(`[prerender-privacy] 본문이 제대로 안 들어갔습니다. 누락: ${missing.join(', ')}`);
  process.exit(1);
}

console.log(`[prerender-privacy] dist/privacy.html 에 방침 본문을 심었습니다 (+${filled.length - html.length}바이트).`);
