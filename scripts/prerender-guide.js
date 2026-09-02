// © 2026 김용현
/**
 * dist/guide.html 에 사용 설명서 본문을 심는다.
 *
 * 왜 이렇게 하는가
 * ----------------
 * 설명서 원본은 `docs/사용설명서.md` 하나뿐이다. 깃허브에서도 읽히고 /guide 에서도
 * 같은 내용이 나와야 하므로, 사본을 만드는 대신 빌드 때 그 파일을 읽어 HTML 로 바꿔 심는다.
 * 문서를 고치면 다음 배포에 그대로 반영된다.
 *
 * 클라이언트 자바스크립트는 쓰지 않는다. 마크다운 변환기를 브라우저로 보내면
 * 번들이 커지고 CSP 도 건드려야 하는데, 내용이 빌드 시점에 정해져 있으니 그럴 이유가 없다.
 * 덕분에 검색엔진·링크 미리보기·JS 를 끈 브라우저에서도 그대로 읽힌다.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { marked } from 'marked';

const source = path.join(process.cwd(), 'docs', '사용설명서.md');
const target = path.join(process.cwd(), 'dist', 'guide.html');

if (!existsSync(source)) {
  console.error(`[prerender-guide] ${source} 를 찾지 못했습니다.`);
  process.exit(1);
}
if (!existsSync(target)) {
  console.error('[prerender-guide] dist/guide.html 이 없습니다. 먼저 빌드하세요.');
  process.exit(1);
}

/**
 * 깃허브와 같은 방식으로 제목에서 앵커 id 를 만든다.
 *
 * 설명서의 목차는 `#1-3-지도-조작--배경지도--좌표계` 같은 깃허브식 링크로 적혀 있다.
 * 규칙이 어긋나면 목차를 눌러도 아무 데도 가지 않으므로 같은 규칙을 따른다:
 * 소문자로 바꾸고, 글자·숫자·하이픈·밑줄·공백이 아닌 것을 지우고, 공백을 하이픈으로.
 * `·` 나 `—` 가 지워지면서 공백이 둘 남아 하이픈도 둘이 되는 것까지 같다.
 */
const seen = new Map();
function slugify(text) {
  const base = text
    .replace(/<[^>]+>/g, '')
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s_-]/gu, '')
    .replace(/\s/g, '-');
  const count = seen.get(base) || 0;
  seen.set(base, count + 1);
  return count === 0 ? base : `${base}-${count}`;
}

marked.use({
  renderer: {
    heading({ tokens, depth }) {
      const text = this.parser.parseInline(tokens);
      return `<h${depth} id="${slugify(text)}">${text}</h${depth}>\n`;
    }
  }
});

const markdown = readFileSync(source, 'utf8');
const body = marked.parse(markdown);

const html = readFileSync(target, 'utf8');
const mount = '<main id="guide-app"></main>';

if (!html.includes(mount)) {
  // 이미 심었거나 마크업이 바뀐 경우. 조용히 넘기면 빈 페이지가 배포되므로 실패시킨다.
  console.error(`[prerender-guide] '${mount}' 를 찾지 못했습니다. guide.html 구조가 바뀌었는지 확인하세요.`);
  process.exit(1);
}

writeFileSync(target, html.replace(mount, `<main id="guide-app">\n${body}\n</main>`), 'utf8');

// 심은 뒤 실제로 본문이 들어갔는지 확인한다. 헛심으면 빈 페이지가 배포된다.
const filled = readFileSync(target, 'utf8');
const checks = ['1부. e-GIS', '사용 설명서', 'id="1-2-데이터-불러오기"'];
const missing = checks.filter((c) => !filled.includes(c));
if (missing.length > 0) {
  console.error('[prerender-guide] 본문이 제대로 들어가지 않았습니다:', missing.join(', '));
  process.exit(1);
}

const added = filled.length - html.length;
console.log(`[prerender-guide] dist/guide.html 에 사용 설명서를 심었습니다 (+${added}바이트).`);
