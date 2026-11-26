// © 2026 김용현
// eStoryMap/src/editor/ContentEditor.js
// 우측 CONTENT 패널: 현재 페이지의 종류(지도/제목/미디어) + heading/body/caption 편집.
// 필드는 팩토리에서 1회 생성 — 입력 중 재렌더가 없어야 포커스가 유지된다.
// 타이핑은 onChange로 문서에만 반영(전체 refresh 금지). 종류 변경은 refresh 필요(발표/목록 반영)라 상위에서 처리.
import { renderMarkdown } from '../shared/markdown.js';
import { setIconLabel } from '../shared/icons.js';

const KIND_OPTIONS = [
  ['map', '지도'],
  ['title', '제목(표지)'],
  ['media', '사진/영상'],
  ['text', '글'],
];
// 종류별 heading/body 라벨·힌트
const KIND_HINTS = {
  map: { heading: '제목', body: '본문', bodyPh: '본문 (마크다운: # 제목, **굵게**, - 목록)' },
  title: { heading: '큰 제목', body: '부제', bodyPh: '부제, 설명 (선택)' },
  media: { heading: '제목 (선택)', body: '사진/영상', bodyPh: '이미지, YouTube, 구글 드라이브 링크를 한 줄에 하나씩 붙여 넣기' },
  text: { heading: '제목 (선택)', body: '본문', bodyPh: '본문 (마크다운: # 제목, **굵게**, - 목록). 지도 없이 글만' },
};

/**
 * @param {HTMLElement} container
 * @param {{onChange(field:'kind'|'heading'|'body'|'caption', value:string):void}} handlers
 */
export function createContentEditor(container, { onChange, onApplyBgAll, onAddImage }) {
  container.innerHTML = '';

  const kind = document.createElement('select');
  kind.id = 'content-kind';
  for (const [val, label] of KIND_OPTIONS) {
    const opt = document.createElement('option');
    opt.value = val;
    opt.textContent = label;
    kind.appendChild(opt);
  }

  const heading = document.createElement('input');
  heading.type = 'text';
  heading.id = 'content-heading';
  heading.placeholder = '페이지 제목';

  const body = document.createElement('textarea');
  body.id = 'content-body';
  body.rows = 10;

  const preview = document.createElement('div');
  preview.id = 'content-preview';
  preview.className = 'md-preview';

  const caption = document.createElement('input');
  caption.type = 'text';
  caption.id = 'content-caption';
  caption.placeholder = '지도 하단 캡션';

  const headingLabel = document.createElement('div'); // 종류별로 텍스트 갱신
  const bodyLabel = document.createElement('div');
  const alignLabel = document.createElement('div'); // '사진 정렬'/'사진 위치'(2단) 동적 라벨
  let alignFieldWrap = null;    // '사진 정렬' 래퍼 — media에서만
  let splitFieldWrap = null;    // '2단 레이아웃' 토글 래퍼 — media에서만
  let sideTextFieldWrap = null; // '옆 글' 래퍼 — media + 2단에서만(render에서 토글)
  let ratioFieldWrap = null;    // '칸 너비' 비율 래퍼 — media + 2단에서만
  let basemapFieldWrap = null;  // '배경 지도' 래퍼 — map에서만

  function applyKind(k) {
    const hint = KIND_HINTS[k] || KIND_HINTS.map;
    headingLabel.textContent = hint.heading;
    bodyLabel.textContent = hint.body;
    body.placeholder = hint.bodyPh;
    const isMedia = k === 'media';
    if (alignFieldWrap) alignFieldWrap.style.display = isMedia ? '' : 'none';
    if (splitFieldWrap) splitFieldWrap.style.display = isMedia ? '' : 'none';
    if (basemapFieldWrap) basemapFieldWrap.style.display = k === 'map' ? '' : 'none';
    imgBtn.style.display = isMedia ? '' : 'none';
  }

  kind.addEventListener('change', () => {
    applyKind(kind.value);
    onChange('kind', kind.value); // 상위가 setPageKind + refresh
  });
  heading.addEventListener('input', () => onChange('heading', heading.value));
  body.addEventListener('input', () => {
    preview.innerHTML = renderMarkdown(body.value); // 살균된 HTML만 삽입
    onChange('body', body.value);
  });

  // 내 컴퓨터 사진: 파일 고르기, 붙여 넣기, 끌어 놓기. 큰 사진은 줄여서 문서 안에 넣는다.
  async function insertImageFiles(files) {
    const list = [...files].filter((f) => /^image\/(png|jpeg|gif|webp)$/.test(f.type));
    if (!list.length || !onAddImage) return false;
    const lines = [];
    for (const f of list) {
      try {
        // eslint-disable-next-line no-await-in-loop
        const id = onAddImage(await imageFileToDataUrl(f));
        lines.push(`![${f.name.replace(/\.[^.]+$/, '').replace(/[\[\]]/g, '')}](img:${id})`);
      } catch (e) {
        console.error('[image] 사진을 넣지 못했어요:', e);
      }
    }
    if (!lines.length) return false;
    const at = body.selectionStart ?? body.value.length;
    const before = body.value.slice(0, at);
    const after = body.value.slice(at);
    const pre = before && !before.endsWith('\n') ? '\n' : '';
    const post = after && !after.startsWith('\n') ? '\n' : '';
    body.value = before + pre + lines.join('\n') + post + after;
    body.dispatchEvent(new Event('input'));
    return true;
  }
  const imgPick = document.createElement('input');
  imgPick.type = 'file';
  imgPick.accept = 'image/png,image/jpeg,image/gif,image/webp';
  imgPick.multiple = true;
  imgPick.hidden = true;
  imgPick.addEventListener('change', async () => {
    await insertImageFiles(imgPick.files);
    imgPick.value = '';
  });
  const imgBtn = document.createElement('button');
  imgBtn.type = 'button';
  imgBtn.id = 'content-add-image';
  setIconLabel(imgBtn, 'image', '내 컴퓨터 사진 넣기');
  imgBtn.title = '사진 파일을 골라 이 슬라이드에 넣어요. 사진은 프로젝트 파일 안에 함께 저장돼요';
  imgBtn.addEventListener('click', () => imgPick.click());
  body.addEventListener('paste', (e) => {
    const files = e.clipboardData && e.clipboardData.files;
    if (files && files.length && [...files].some((f) => f.type.startsWith('image/'))) {
      e.preventDefault();
      insertImageFiles(files);
    }
  });
  body.addEventListener('dragover', (e) => {
    if (e.dataTransfer && [...e.dataTransfer.items].some((i) => i.kind === 'file')) e.preventDefault();
  });
  body.addEventListener('drop', (e) => {
    const files = e.dataTransfer && e.dataTransfer.files;
    if (files && files.length) {
      e.preventDefault();
      insertImageFiles(files);
    }
  });
  caption.addEventListener('input', () => onChange('caption', caption.value));

  // 페이지별 배경색(색상 선택 = override / '프로젝트 기본' = override 제거)
  const bg = document.createElement('input');
  bg.type = 'color';
  bg.id = 'content-bg';
  const bgReset = document.createElement('button');
  bgReset.type = 'button';
  bgReset.id = 'content-bg-reset';
  bgReset.textContent = '프로젝트 기본';
  bg.addEventListener('input', () => onChange('bg', bg.value));
  bgReset.addEventListener('click', () => onChange('bg', ''));
  const bgAll = document.createElement('button');
  bgAll.type = 'button';
  bgAll.id = 'content-bg-all';
  bgAll.textContent = '모두 적용';
  bgAll.title = '이 배경색을 모든 슬라이드에 적용';
  bgAll.addEventListener('click', () => onApplyBgAll(bg.value));
  const bgRow = document.createElement('div');
  bgRow.className = 'content-bg-row';
  bgRow.append(bg, bgReset, bgAll);

  // 사진(미디어) 슬라이드 정렬: 좌/중앙/우 — media 종류에서만 노출(applyKind)
  const alignRow = document.createElement('div');
  alignRow.className = 'content-align';
  const alignBtns = {};
  for (const [val, label] of [['left', '왼쪽'], ['center', '가운데'], ['right', '오른쪽']]) {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = label;
    b.addEventListener('click', () => { setAlign(val); onChange('align', val); });
    alignRow.appendChild(b);
    alignBtns[val] = b;
  }
  function setAlign(val) {
    const cur = val || 'center';
    for (const [k, b] of Object.entries(alignBtns)) b.classList.toggle('active', k === cur);
  }

  // 지도 슬라이드 배경지도(일반/위성/위성+라벨) — map 종류에서만 노출(applyKind)
  const basemapSelect = document.createElement('select');
  basemapSelect.id = 'content-basemap';
  for (const [val, label] of [['standard', '일반도'], ['satellite', '위성'], ['satellite-labels', '위성 + 라벨']]) {
    const opt = document.createElement('option');
    opt.value = val; opt.textContent = label;
    basemapSelect.appendChild(opt);
  }
  basemapSelect.addEventListener('change', () => onChange('basemap', basemapSelect.value));

  // 2단(사진 + 옆 글) 레이아웃 토글 — media 종류에서만 노출
  const splitCheckbox = document.createElement('input');
  splitCheckbox.type = 'checkbox';
  splitCheckbox.id = 'content-split';
  const splitControl = document.createElement('label');
  splitControl.className = 'content-split';
  splitControl.append(splitCheckbox, document.createTextNode(' 2단 (사진 옆에 글)'));
  splitCheckbox.addEventListener('change', () => onChange('split', splitCheckbox.checked));

  // 2단의 '옆 글'(마크다운) — media + 2단에서만 노출(render에서 토글)
  const sideText = document.createElement('textarea');
  sideText.id = 'content-sidetext';
  sideText.rows = 6;
  sideText.placeholder = '사진 옆에 들어갈 글 (마크다운: # 제목, **굵게**, - 목록)';
  sideText.addEventListener('input', () => onChange('sideText', sideText.value));

  // 2단 좌우 너비 비율(사진 %) 슬라이더 — media + 2단에서만
  const ratio = document.createElement('input');
  ratio.type = 'range';
  ratio.id = 'content-splitratio';
  ratio.min = '20'; ratio.max = '80'; ratio.step = '5';
  const ratioText = document.createElement('span');
  ratioText.className = 'content-ratio-text';
  function updateRatioText() {
    const p = Number(ratio.value);
    ratioText.textContent = `사진 ${p}% : 글 ${100 - p}%`;
  }
  ratio.addEventListener('input', () => { updateRatioText(); onChange('splitRatio', Number(ratio.value)); });
  const ratioRow = document.createElement('div');
  ratioRow.className = 'content-ratio-row';
  ratioRow.append(ratio, ratioText);

  // 본문 마크다운 서식 툴바 + 도움말('?') — 문법을 몰라도 버튼 클릭으로 적용.
  // 선택 텍스트를 마크다운으로 감싸거나 줄 앞에 붙이고, 기존 input 처리(미리보기+저장)를 재사용한다.
  function surround(before, after, placeholder) {
    const s = body.selectionStart, e = body.selectionEnd;
    const sel = body.value.slice(s, e) || placeholder;
    body.value = body.value.slice(0, s) + before + sel + after + body.value.slice(e);
    body.focus();
    body.selectionStart = s + before.length;
    body.selectionEnd = s + before.length + sel.length;
    body.dispatchEvent(new Event('input'));
  }
  function prefixLines(prefix) {
    const s = body.selectionStart, e = body.selectionEnd, val = body.value;
    const from = val.lastIndexOf('\n', s - 1) + 1; // 선택 시작이 걸친 줄의 머리
    const prefixed = val.slice(from, e).split('\n').map((ln) => prefix + ln).join('\n');
    body.value = val.slice(0, from) + prefixed + val.slice(e);
    body.focus();
    body.selectionStart = from;
    body.selectionEnd = from + prefixed.length;
    body.dispatchEvent(new Event('input'));
  }
  function insertLink() {
    const s = body.selectionStart, e = body.selectionEnd;
    const sel = body.value.slice(s, e) || '링크 텍스트';
    body.value = body.value.slice(0, s) + `[${sel}](주소)` + body.value.slice(e);
    body.focus();
    const at = s + sel.length + 3; // "[sel](" 뒤 = '주소' 시작 위치
    body.selectionStart = at;
    body.selectionEnd = at + 2;
    body.dispatchEvent(new Event('input'));
  }

  const mdHelp = document.createElement('div');
  mdHelp.className = 'md-help';
  mdHelp.hidden = true;
  mdHelp.innerHTML =
    '<div><code># 제목</code>, <code>## 소제목</code></div>' +
    '<div><code>**굵게**</code>, <code>*기울임*</code></div>' +
    '<div><code>- 항목</code>, <code>1. 항목</code> (목록)</div>' +
    '<div><code>[링크](주소)</code></div>' +
    '<div><code>![설명](이미지주소)</code>: 사진 (이미지 주소만 한 줄에 붙여도 보여요)</div>' +
    '<div><code>&gt; 인용</code></div>';

  const mdToolbar = document.createElement('div');
  mdToolbar.className = 'md-toolbar';
  for (const [label, fn, style] of [
    ['# 제목', () => prefixLines('# ')],
    ['B', () => surround('**', '**', '굵은 글씨'), 'bold'],
    ['I', () => surround('*', '*', '기울임'), 'italic'],
    ['목록', () => prefixLines('- ')],
    ['링크', insertLink],
  ]) {
    const b = document.createElement('button');
    b.type = 'button';
    b.tabIndex = -1;
    b.textContent = label;
    if (style === 'bold') b.style.fontWeight = '700';
    if (style === 'italic') b.style.fontStyle = 'italic';
    b.addEventListener('mousedown', (ev) => ev.preventDefault()); // 클릭해도 본문 포커스·선택 유지
    b.addEventListener('click', fn);
    mdToolbar.appendChild(b);
  }
  const helpBtn = document.createElement('button');
  helpBtn.type = 'button';
  helpBtn.className = 'md-help-btn';
  helpBtn.tabIndex = -1;
  helpBtn.textContent = '사용법';
  helpBtn.addEventListener('click', () => { mdHelp.hidden = !mdHelp.hidden; });
  mdToolbar.appendChild(helpBtn);

  const bodyWrap = document.createElement('div');
  bodyWrap.className = 'content-body-wrap';
  bodyWrap.append(mdToolbar, body, imgBtn, imgPick, mdHelp);

  function field(label, el) {
    const wrap = document.createElement('div');
    wrap.className = 'content-field';
    const lab = typeof label === 'string' ? document.createElement('div') : label;
    lab.className = 'content-label';
    if (typeof label === 'string') lab.textContent = label;
    wrap.appendChild(lab);
    wrap.appendChild(el);
    container.appendChild(wrap);
    return wrap;
  }

  field('슬라이드 종류', kind);
  field('슬라이드 배경', bgRow);
  basemapFieldWrap = field('배경 지도', basemapSelect);
  alignFieldWrap = field(alignLabel, alignRow);
  splitFieldWrap = field('레이아웃', splitControl);
  field(headingLabel, heading);
  field(bodyLabel, bodyWrap);
  sideTextFieldWrap = field('옆 글', sideText);
  ratioFieldWrap = field('칸 너비 (사진 : 글)', ratioRow);
  field('미리보기', preview);
  field('캡션', caption);

  /** 페이지 전환 시 현재 페이지 값으로 필드를 채운다. */
  function render(page, effectiveBg) {
    const k = page.kind || 'map';
    kind.value = k;
    applyKind(k);
    basemapSelect.value = page.basemap || 'standard'; // 배경 지도 현재값
    setAlign(page.align); // 정렬 버튼 활성 표시(미설정=중앙)
    const split = !!page.split;
    splitCheckbox.checked = split;
    alignLabel.textContent = k === 'media' && split ? '사진 위치' : '사진 정렬'; // 2단이면 좌/우 = 사진 위치
    sideText.value = page.content.sideText || '';
    ratio.value = String(page.splitRatio || 50);
    updateRatioText();
    const showSplit = k === 'media' && split;
    if (sideTextFieldWrap) sideTextFieldWrap.style.display = showSplit ? '' : 'none';
    if (ratioFieldWrap) ratioFieldWrap.style.display = showSplit ? '' : 'none';
    bg.value = effectiveBg || '#0b0f14'; // 페이지 override 있으면 그 색, 없으면 프로젝트 기본
    heading.value = page.content.heading;
    body.value = page.content.body;
    caption.value = page.content.caption;
    preview.innerHTML = renderMarkdown(page.content.body);
  }

  return { render };
}

/**
 * 사진 파일 → data URL. 긴 변이 1920px보다 크거나 파일이 600KB보다 크면 줄여서 JPEG로 바꾼다
 * (프로젝트 파일과 웹 게시가 너무 무거워지지 않게). 움직이는 GIF는 그대로 둔다.
 */
async function imageFileToDataUrl(file) {
  const raw = await new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
  if (file.type === 'image/gif') return raw;
  const img = await new Promise((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = () => reject(new Error('사진을 읽지 못했어요'));
    i.src = raw;
  });
  const MAX = 1920;
  const scale = Math.min(1, MAX / Math.max(img.naturalWidth, img.naturalHeight));
  if (scale === 1 && file.size <= 600 * 1024) return raw;
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(img.naturalWidth * scale);
  canvas.height = Math.round(img.naturalHeight * scale);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#fff'; // 투명한 PNG를 JPEG로 바꿀 때 검게 되지 않게
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', 0.85);
}
