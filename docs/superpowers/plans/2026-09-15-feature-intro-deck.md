# e-GIS 기능 소개 HTML 덱 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `바탕화면\e-GIS 기능 소개\e-GIS_기능소개.html` — 45장짜리 16:9 HTML 슬라이드 덱 + `images\`에 실제 e-GIS 캡처 40장.

**Architecture:** 단일 HTML(CSS·JS 인라인)에 `<section class="slide">` 45개. 캡처는 로컬 개발 서버(`npm run dev`, `localhost:5173`)를 Chrome 확장(claude-in-chrome)으로 조작하며 `computer screenshot save_to_disk` 로 찍어 `images\`로 복사한다. 파일 선택이 필요한 기능은 `javascript_tool`로 실습 데이터 URL을 `File`로 만들어 숨은 `<input type=file>`에 넣는다.

**Tech Stack:** 순수 HTML/CSS/JS, Pretendard(CDN), Chrome 확장 브라우저 도구, Vite dev server.

설계 문서: `docs/superpowers/specs/2026-09-15-feature-intro-deck-design.md`

---

## 파일 구조

```
C:\Users\김용현\Desktop\e-GIS 기능 소개\
  e-GIS_기능소개.html    덱 본체 — 토큰·레이아웃 CSS, 슬라이드 45개, 넘김 JS
  images\NN-name.png     캡처 (스펙의 표와 1:1)
  check.js               검증 스크립트 — img src ↔ 파일 대응, 이모지 검사 (Task 10)
```

캡처 작업 중 공통 규칙:
- 캡처 뒤 반드시 `Read`로 이미지를 열어 확인한다. 잘린 패널·로딩 중·빈 지도면 다시 찍는다.
- `computer` 도구의 `screenshot` + `save_to_disk: true` 결과에 나온 경로를 `cp`로 `images\NN-name.png`에 복사한다.
- `alert/confirm/prompt`를 띄우는 동작(레이어 삭제, 피처 삭제, 프로젝트 저장, 피처 합치기 실패)은 피한다. 확장이 멈춘다.
- 어떤 파일도 내려받지 않는다(레이어 내보내기·지도 내보내기·3D PNG 저장·.egis 저장 버튼은 누르지 않는다).

---

### Task 1: 덱 뼈대 (레이아웃·넘김·인쇄)

**Files:**
- Create: `C:\Users\김용현\Desktop\e-GIS 기능 소개\e-GIS_기능소개.html`
- Create: `C:\Users\김용현\Desktop\e-GIS 기능 소개\images\` (빈 폴더)

- [ ] **Step 1: 폴더 만들기**

```bash
mkdir -p "C:/Users/김용현/Desktop/e-GIS 기능 소개/images"
```

- [ ] **Step 2: 뼈대 HTML 작성** — 슬라이드는 표지·목차·기능 1장·와이드 1장·표 1장·마무리 6장만 넣어 레이아웃을 확인한다. (전체 45장은 Task 9)

```html
<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>e-GIS 기능 소개</title>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard/dist/web/static/pretendard.css">
<style>
  :root {
    --blue: #024AD8;
    --blue-bright: #296EF9;
    --blue-soft: #C9E0FC;
    --blue-tint: #EEF4FF;
    --ink: #1A1A1A;
    --ink-2: #3D3D3D;
    --gray: #636363;
    --line: #C2C2C2;
    --line-soft: #E3E3E3;
    --bg-1: #F7F7F7;
    --white: #FFFFFF;
  }
  * { box-sizing: border-box; }
  html, body { margin: 0; height: 100%; background: #222; font-family: 'Pretendard', -apple-system, BlinkMacSystemFont, 'Malgun Gothic', sans-serif; color: var(--ink); }
  #stage { position: fixed; inset: 0; display: flex; align-items: center; justify-content: center; }
  .deck { width: 1600px; height: 900px; position: relative; transform-origin: center center; }
  .slide { position: absolute; inset: 0; background: var(--white); display: none; flex-direction: column; padding: 44px 72px 56px; }
  .slide.active { display: flex; }

  /* 상단 메타 바 */
  .meta { display: flex; justify-content: space-between; align-items: center; height: 36px; border-bottom: 1.5px solid var(--line); padding-bottom: 10px; margin-bottom: 30px; font-size: 17px; color: var(--gray); }
  .meta .tag { color: var(--blue); font-weight: 700; cursor: pointer; }
  .meta .tag:hover { text-decoration: underline; }
  .meta .num { font-variant-numeric: tabular-nums; }

  /* 기능 슬라이드 */
  .body { flex: 1; min-height: 0; display: grid; grid-template-columns: 38fr 62fr; gap: 44px; align-items: start; }
  .text h2 { font-size: 44px; font-weight: 800; line-height: 1.2; margin: 0 0 12px; letter-spacing: -0.01em; }
  .text .lead { font-size: 21px; color: var(--ink-2); line-height: 1.5; margin: 0 0 18px; font-weight: 500; }
  .path { display: inline-flex; align-items: center; gap: 8px; font-size: 15px; color: var(--blue); background: var(--blue-tint); border: 1px solid var(--blue-soft); border-radius: 8px; padding: 6px 12px; margin-bottom: 20px; font-weight: 600; }
  .path svg { width: 16px; height: 16px; stroke: var(--blue); fill: none; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
  ul.points { list-style: none; padding: 0; margin: 0 0 22px; font-size: 18px; line-height: 1.55; color: var(--ink-2); }
  ul.points li { position: relative; padding-left: 20px; margin-bottom: 9px; }
  ul.points li::before { content: ''; position: absolute; left: 0; top: 11px; width: 8px; height: 8px; border-radius: 2px; background: var(--blue-bright); }
  ul.points b { color: var(--ink); font-weight: 700; }
  .tip { background: var(--bg-1); border-left: 4px solid var(--blue); border-radius: 0 8px 8px 0; padding: 12px 16px; font-size: 16px; line-height: 1.5; color: var(--ink-2); }
  .tip b { color: var(--blue); font-weight: 700; margin-right: 6px; }

  .shot { align-self: stretch; display: flex; align-items: center; justify-content: center; min-height: 0; }
  .shot img { max-width: 100%; max-height: 100%; border: 1px solid var(--line-soft); border-radius: 10px; box-shadow: 0 14px 40px rgba(0,0,0,0.16); display: block; }

  /* 와이드(캡처 강조) 슬라이드 */
  .body.wide { grid-template-columns: 1fr 330px; gap: 36px; }
  .body.wide .text h2 { font-size: 34px; margin-bottom: 8px; }
  .body.wide .text .lead { font-size: 18px; margin-bottom: 14px; }
  .body.wide ul.points { font-size: 16px; }
  .body.wide .path { font-size: 14px; margin-bottom: 14px; }
  .body.wide .tip { font-size: 14px; }
  .body.wide .shot { grid-column: 1; grid-row: 1; }
  .body.wide .text { grid-column: 2; grid-row: 1; }

  /* 표지 */
  .cover { justify-content: center; background: linear-gradient(135deg, #FFFFFF 0%, #EEF4FF 100%); }
  .cover .kicker { font-size: 22px; color: var(--blue); font-weight: 700; letter-spacing: 0.02em; margin-bottom: 18px; }
  .cover h1 { font-size: 88px; font-weight: 800; line-height: 1.1; margin: 0 0 22px; letter-spacing: -0.02em; }
  .cover .sub { font-size: 30px; color: var(--gray); font-weight: 500; margin-bottom: 60px; }
  .cover .foot { font-size: 18px; color: var(--gray); display: flex; gap: 28px; }
  .cover .foot b { color: var(--ink); font-weight: 600; }

  /* 목차 */
  .toc { display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; flex: 1; align-content: start; }
  .toc a { display: block; border: 1.5px solid var(--line-soft); border-radius: 12px; padding: 18px 20px; text-decoration: none; color: var(--ink); background: var(--white); cursor: pointer; transition: border-color .15s, background .15s; }
  .toc a:hover { border-color: var(--blue); background: var(--blue-tint); }
  .toc .n { font-size: 15px; color: var(--blue); font-weight: 700; margin-bottom: 6px; }
  .toc .t { font-size: 22px; font-weight: 700; margin-bottom: 8px; }
  .toc .d { font-size: 15px; color: var(--gray); line-height: 1.45; }

  /* 표 슬라이드 */
  table.grid { width: 100%; border-collapse: collapse; font-size: 18px; }
  table.grid th { text-align: left; font-weight: 700; color: var(--blue); border-bottom: 2px solid var(--blue); padding: 10px 14px; font-size: 16px; }
  table.grid td { border-bottom: 1px solid var(--line-soft); padding: 11px 14px; vertical-align: top; line-height: 1.45; color: var(--ink-2); }
  table.grid td:first-child { font-weight: 700; color: var(--ink); white-space: nowrap; }
  code, kbd { font-family: 'Pretendard', monospace; background: var(--bg-1); border: 1px solid var(--line-soft); border-radius: 5px; padding: 1px 7px; font-size: 0.92em; color: var(--ink); }
  .cols2 { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; align-items: start; }

  /* 하단 네비 */
  .counter { position: absolute; right: 72px; bottom: 22px; font-size: 15px; color: var(--gray); font-variant-numeric: tabular-nums; }
  .brand { position: absolute; left: 72px; bottom: 22px; font-size: 15px; color: var(--gray); }
  .brand b { color: var(--blue); font-weight: 700; }

  @media print {
    @page { size: 1600px 900px; margin: 0; }
    html, body { background: #fff; height: auto; }
    #stage { position: static; display: block; }
    .deck { transform: none !important; width: 1600px; height: auto; }
    .slide { display: flex !important; position: relative; width: 1600px; height: 900px; page-break-after: always; break-after: page; }
    .slide:last-child { page-break-after: auto; }
  }
</style>
</head>
<body>
<div id="stage">
<div class="deck" id="deck">

<section class="slide cover">
  <div class="kicker">교육용 웹 GIS</div>
  <h1>e-GIS 기능 소개</h1>
  <div class="sub">설치 없이 브라우저에서 — 데이터 불러오기부터 주제도·공간 분석·내보내기까지</div>
  <div class="foot"><span><b>e-gis.kr</b></span><span>2026. 9.</span><span>김용현 (양정고등학교)</span></div>
</section>

<section class="slide">
  <div class="meta"><span class="tag">목차</span><span class="num"></span></div>
  <div class="toc">
    <a data-goto="3"><div class="n">01</div><div class="t">시작하기</div><div class="d">e-GIS란 · 화면 구성 · 테마</div></a>
    <a data-goto="6"><div class="n">02</div><div class="t">데이터 불러오기</div><div class="d">내장 · 파일 · 좌표 · 공공데이터 · Geocoding</div></a>
    <a data-goto="11"><div class="n">03</div><div class="t">지도 · 배경지도 · 좌표계</div><div class="d">조작 · 배경지도 10종 · 좌표계 자동 판정</div></a>
    <a data-goto="14"><div class="n">04</div><div class="t">레이어 · 그리기 · 편집</div><div class="d">레이어 패널 · 스타일 · 합치기/나누기 · 그리기 · 선택 · 편집</div></a>
    <a data-goto="20"><div class="n">05</div><div class="t">속성 · 테이블 · 측정</div><div class="d">속성 테이블 · 테이블 결합 · 필드 계산기 · 라벨 · 측정</div></a>
    <a data-goto="25"><div class="n">06</div><div class="t">벡터 · 래스터 분석</div><div class="d">격자 · 버퍼 · 보로노이 · 공간 연산 · 등시선 · 최단경로 · 지형 · 3D · 지리참조</div></a>
    <a data-goto="35"><div class="n">07</div><div class="t">주제도</div><div class="d">단계구분도 · 도형표현도 · 히트맵 · 카토그램 · 흐름도</div></a>
    <a data-goto="40"><div class="n">08</div><div class="t">저장 · 내보내기 · 계정</div><div class="d">.egis · 내보내기 · 로그인 · 단축키 · e-GIStory</div></a>
  </div>
</section>

<section class="slide">
  <div class="meta"><span class="tag" data-goto="25">벡터 분석 · 2/6</span><span class="num"></span></div>
  <div class="body">
    <div class="text">
      <h2>버퍼 분석</h2>
      <p class="lead">피처 주변에 일정 거리의 영역을 만듭니다.</p>
      <div class="path"><svg viewBox="0 0 24 24"><path d="M4 6h16M4 12h16M4 18h10"/></svg>메뉴 → 벡터 분석 → 버퍼 분석</div>
      <ul class="points">
        <li>레이어 선택 → <b>거리와 단위</b> 입력</li>
        <li><b>버퍼 병합(Dissolve)</b>을 켜면 겹치는 버퍼를 하나로</li>
        <li>점·선·면 어느 레이어든 가능</li>
      </ul>
      <div class="tip"><b>수업</b>학교 반경 1km 안에 편의점이 몇 곳인지 세어 보기</div>
    </div>
    <div class="shot"><img src="images/26-buffer.png" alt="버퍼 분석 결과"></div>
  </div>
</section>

<section class="slide">
  <div class="meta"><span class="tag" data-goto="35">주제도 · 1/5</span><span class="num"></span></div>
  <div class="body wide">
    <div class="shot"><img src="images/35-choropleth.png" alt="단계구분도"></div>
    <div class="text">
      <h2>단계구분도</h2>
      <p class="lead">수치 속성값을 색의 진하기로 표현합니다.</p>
      <div class="path"><svg viewBox="0 0 24 24"><path d="M4 6h16M4 12h16M4 18h10"/></svg>메뉴 → 주제도 → 단계구분도</div>
      <ul class="points">
        <li>속성 · 분류 방식 · 색상표 선택</li>
        <li>범례 제목 클릭으로 바로 수정</li>
        <li>단위·숫자 표기·반올림 지정</li>
      </ul>
    </div>
  </div>
</section>

<section class="slide">
  <div class="meta"><span class="tag" data-goto="40">저장 · 내보내기 · 계정 · 4/6</span><span class="num"></span></div>
  <div class="text"><h2>팁과 단축키</h2></div>
  <table class="grid">
    <tr><th>단축키</th><th>기능</th></tr>
    <tr><td><kbd>Ctrl</kbd>+<kbd>A</kbd></td><td>피처 전체 선택</td></tr>
    <tr><td><kbd>Delete</kbd></td><td>선택 피처 삭제</td></tr>
  </table>
</section>

<section class="slide cover">
  <div class="kicker">함께 만들어 가기</div>
  <h1>e-gis.kr</h1>
  <div class="sub">오른쪽 위 GUIDE 버튼 → 사용 설명서 · 문의 bgnlkim@gmail.com</div>
</section>

</div>
</div>
<div class="brand" id="brand"><b>e-GIS</b> 기능 소개</div>
<div class="counter" id="counter"></div>
<script>
(function () {
  const slides = Array.from(document.querySelectorAll('.slide'));
  const deck = document.getElementById('deck');
  const counter = document.getElementById('counter');
  let cur = 0;

  function go(n) {
    cur = Math.max(0, Math.min(slides.length - 1, n));
    slides.forEach((s, i) => s.classList.toggle('active', i === cur));
    counter.textContent = (cur + 1) + ' / ' + slides.length;
    slides[cur].querySelectorAll('.meta .num').forEach(el => { el.textContent = (cur + 1) + ' / ' + slides.length; });
    history.replaceState(null, '', '#' + (cur + 1));
  }
  function fit() {
    const s = Math.min(window.innerWidth / 1600, window.innerHeight / 900);
    deck.style.transform = 'scale(' + s + ')';
  }
  document.addEventListener('keydown', (e) => {
    if (['ArrowRight', 'PageDown', ' '].includes(e.key)) { e.preventDefault(); go(cur + 1); }
    else if (['ArrowLeft', 'PageUp'].includes(e.key)) { e.preventDefault(); go(cur - 1); }
    else if (e.key === 'Home') go(0);
    else if (e.key === 'End') go(slides.length - 1);
  });
  document.addEventListener('click', (e) => {
    const t = e.target.closest('[data-goto]');
    if (t) { e.preventDefault(); go(parseInt(t.dataset.goto, 10) - 1); }
  });
  window.addEventListener('resize', fit);
  window.addEventListener('hashchange', () => { const n = parseInt(location.hash.slice(1), 10); if (n) go(n - 1); });
  // 인쇄 전 페이지 번호를 모든 슬라이드에 채운다
  window.addEventListener('beforeprint', () => { slides.forEach((s, i) => s.querySelectorAll('.meta .num').forEach(el => { el.textContent = (i + 1) + ' / ' + slides.length; })); });
  fit();
  go((parseInt(location.hash.slice(1), 10) || 1) - 1);
})();
</script>
</body>
</html>
```

- [ ] **Step 3: 브라우저에서 확인** — `tabs_context_mcp{createIfEmpty:true}` → `navigate` `file:///C:/Users/김용현/Desktop/e-GIS%20기능%20소개/e-GIS_기능소개.html` → `screenshot`. 표지가 뜨고, `→` 키로 목차·버퍼(이미지 없어 깨진 아이콘이지만 왼쪽 텍스트 열은 정상)·와이드·표·마무리로 넘어가는지, 오른쪽 아래 `n / 6`이 바뀌는지 확인. 목차 카드 클릭으로 이동하는지 확인.

Expected: 6장 모두 넘어가고 카운터가 `1 / 6` → `6 / 6`.

---

### Task 2: 캡처 환경 준비

**Files:** 없음 (환경 설정)

- [ ] **Step 1: 개발 서버 실행** (백그라운드)

```bash
cd "C:/Users/김용현/Desktop/vibecoding/eGIS" && npm run dev
```

Expected: `Local: http://localhost:5173/` 출력. 포트가 다르면 이후 URL을 그 포트로 바꾼다.

- [ ] **Step 2: 탭 열기 전에 조회수 방지** — 새 탭에서 먼저 `about:blank`가 아니라 `http://localhost:5173/guide`(가벼운 정적 페이지)로 이동한 뒤 `javascript_tool`로 오늘 날짜(KST)를 넣는다.

```js
const d = new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
localStorage.setItem('egis_last_visit', d); localStorage.getItem('egis_last_visit');
```

Expected: `"2026-09-15"` 반환.

- [ ] **Step 3: 앱 열고 창 크기 맞추기** — `navigate` `http://localhost:5173/` → `resize_window` width 1600, height 1000 → `javascript_tool`:

```js
[window.innerWidth, window.innerHeight, window.devicePixelRatio]
```

Expected: `[1600, 9xx, …]`. innerHeight가 900이 되도록 height를 조정한다(창 크롬 높이만큼 더한다). DPR이 1이 아니면 캡처가 그 배수로 커지는데, 그대로 써도 된다.

- [ ] **Step 4: 첫 캡처로 저장 경로 확인** — `computer` `screenshot` `save_to_disk: true`. 결과의 경로를 `Read`로 열어 지도가 보이는지, 상태 표시줄 조회수가 `-`가 아닌 숫자인지(카운트되지 않고 read만 된 것) 확인.

```bash
cp "<결과 경로>" "C:/Users/김용현/Desktop/e-GIS 기능 소개/images/03-home.png"
```

Expected: `images/03-home.png` 생성. 이 캡처가 슬라이드 3(e-GIS란)용이다.

---

### Task 3: 캡처 A — 시작하기·데이터 창·지도 조작 (데이터 없이)

파일: `04-layout.png`, `05-dark.png`, `06-builtin.png`, `07-browser.png`, `09-public.png`, `10-geocoding.png`, `11-toolbar.png`, `12-basemap.png`

- [ ] **Step 1: 04-layout** — 왼쪽 패널 `레이어` 탭이 보이는 초기 화면. 03과 같아도 되지만, 지도를 한국 전체가 꽉 차게 둔 뒤 찍는다. 4영역 표시는 슬라이드 HTML에서 CSS 오버레이로 그리므로 캡처는 깨끗해야 한다.
- [ ] **Step 2: 05-dark** — 오른쪽 위 테마 버튼(해/달)을 `find` "테마 전환 버튼"으로 찾아 클릭 → 어두운 테마 확인 → 캡처 → 다시 클릭해 밝은 테마로 복귀.
- [ ] **Step 3: 06-builtin** — 메뉴 바 `데이터 불러오기` 클릭 → `실습 데이터` 탭에서 Point/Area/Attribute/Raster 카드가 보이는 상태 캡처. 스크롤이 필요하면 Area·Attribute가 함께 보이는 위치로.
- [ ] **Step 4: 09-public** — 같은 창의 `공공데이터` 탭 → 지역 `서울` → 검색창에 `도서관` 입력 → 목록에서 첫 항목 클릭 → 선택지(자치구 등)를 골라 `불러오기` → 미리보기 표와 아래 `포인트로 추가 / 격자 집계 / 히트맵` 버튼이 보이는 상태 캡처. (불러오기가 오래 걸리면 `wait` 5초 후 재확인.)
- [ ] **Step 5: 창 닫기** — 창의 ✕ 또는 `Escape`.
- [ ] **Step 6: 10-geocoding** — 메뉴 바 `Geocoding` 버튼 클릭 → 3단계 안내창 캡처 → 닫기.
- [ ] **Step 7: 07-browser** — 왼쪽 패널 `브라우저` 탭 클릭 → 드롭 영역과 `Shapefile 폴더 열기` 버튼이 보이는 상태 캡처. 슬라이드에서는 이 캡처를 왼쪽 패널 부분만 보여 주면 되므로 `zoom` `region: [0, 0, 560, 900]`로 찍어 저장해도 좋다. 찍은 뒤 `레이어` 탭으로 복귀.
- [ ] **Step 8: 11-toolbar** — 툴바 검색창에 `양정고등학교` 입력 → Enter → 이동한 뒤 `zoom` `region: [0, 0, 1600, 130]`(메뉴 바+툴바 띠) 저장. 슬라이드에서는 이 띠 이미지를 위에, 설명을 아래에 둔다.
- [ ] **Step 9: 12-basemap** — 지도 오른쪽 위 배경지도 버튼 클릭 → 팝오버(한국 묶음·세계 묶음)가 열린 상태에서 `위성 + 라벨`(VWorld) 선택 → 팝오버가 아직 열려 있으면 그대로, 닫혔으면 다시 열어 팝오버+위성 배경이 함께 보이게 캡처 → 배경을 `일반지도`로 복귀.

각 캡처 뒤 `Read`로 열어 확인하고 `cp`로 `images/`에 복사한다.

---

### Task 4: 캡처 B — 시도 데이터 흐름 (결합 → 계산 → 라벨 → 주제도)

파일: `21-join.png`, `20-table.png`, `22-calc.png`, `23-label.png`, `14-layers.png`, `15-style.png`, `16-split.png`, `35-choropleth.png`, `36-chartmap.png`, `38-cartogram.png`, `39-flow.png`

- [ ] **Step 1: 시도 레이어 올리기** — `데이터 불러오기` → 실습 데이터 → Area Data → `대한민국 시도(2026.07.01.~)` 클릭 → "레이어 추가 완료" 후 창이 닫힘. 레이어 패널에 레이어가 보이는지 확인.
- [ ] **Step 2: 21-join** — `데이터 불러오기` → Attribute Data → `시도별 인구(2026.07.01.~)` 클릭 → 속성 미리보기와 결합 대상 레이어·키 열 선택 UI가 보이는 상태 캡처 → 시도명 열끼리 짝지어 결합 실행. 창이 닫히고 상태 메시지로 결합 완료가 뜨는지 확인. (결합 UI가 별도 패널로 열리면 그 패널을 캡처한다.)
- [ ] **Step 3: 20-table** — 레이어 패널에서 시도 레이어 클릭(선택) → 메뉴 `레이어` → `속성 테이블` → 결합된 인구 열이 보이는 표 캡처 → 닫기.
- [ ] **Step 4: 22-calc** — 메뉴 `레이어` → `필드 계산기` → 새 필드 이름 `인구밀도`, 계산식은 인구 열 ÷ 면적 열(면적 열이 없으면 `인구 / 100`처럼 인구 열만 쓰는 식) 입력한 상태에서 캡처 → 실행.
- [ ] **Step 5: 23-label** — 메뉴 `레이어` → `라벨 설정` → 표시 필드를 시도명 열로, 글자 크기 14 → 적용 → 패널 닫고 지도에 라벨이 찍힌 상태 캡처.
- [ ] **Step 6: 14-layers** — 레이어 패널의 시도 레이어 행 ⋮ 버튼 클릭 → 메뉴(레이어로 이동·이름 변경·레이어 복사·내보내기·속성 테이블·색상 변경·삭제)가 열린 상태에서 `zoom` `region: [0, 90, 620, 560]`으로 저장 → `Escape`.
- [ ] **Step 7: 15-style** — ⋮ → `색상 변경` → 채우기/테두리/불투명도/선 두께/파선 컨트롤이 보이는 패널 캡처 → 채우기 색을 연한 파랑으로 바꾸고 닫기.
- [ ] **Step 8: 16-split** — 메뉴 `레이어` → `레이어 나누기` → 레이어=시도, 기준=`속성값 기준`, 필드=시도명 → "만들어질 레이어 수 16" 안내가 보이는 상태 캡처 → **취소**(실행하면 레이어가 16개 생겨 이후 캡처가 지저분해진다).
- [ ] **Step 9: 35-choropleth** — 시도 레이어 선택 → 메뉴 `주제도` → `단계구분도` → 속성=인구, 분류=자연 분류(또는 기본), 색상표=파랑 계열 → 적용 → 패널을 닫거나 옆으로 두고 지도+범례가 크게 보이는 상태 캡처. 범례 제목이 보여야 한다.
- [ ] **Step 10: 36-chartmap** — 레이어 ⋮ → `레이어 복사`로 사본을 만들고 사본을 선택 → 원본 눈 아이콘으로 숨김 → 메뉴 `주제도` → `도형표현도` → 차트=파이, 필드 2개 이상 체크(인구 열들이 남/여 등으로 나뉘어 있으면 그것, 아니면 인구+GRDP는 결합돼 있지 않으므로 인구와 인구밀도) → 수치 라벨 켬 → 적용 → 캡처. 끝나면 사본 숨기고 원본 다시 표시.
- [ ] **Step 11: 38-cartogram** — 원본(단계구분도) 선택 → 메뉴 `주제도` → `카토그램` → 속성=인구, 라벨 표시 켬 → 적용 → 캡처 → 카토그램 레이어가 별도로 생겼으면 숨긴다.
- [ ] **Step 12: 39-flow** — `데이터 불러오기` → Flow Data → `시도간 인구이동 예시` 클릭 → 흐름도 패널이 열리면 기준 레이어=시도, 이름 열=시도명 → 적용 → 지도에 흐름 곡선과 지역 원이 보이는 상태 캡처. 패널이 지도를 가리면 닫고 찍는다.

---

### Task 5: 캡처 C — 포인트 데이터 흐름 (좌표 → 격자·버퍼·보로노이·히트맵·공간 연산)

파일: `08-coords.png`, `25-grid.png`, `26-buffer.png`, `27-voronoi.png`, `37-heatmap.png`, `28-spatial.png`

- [ ] **Step 1: 기존 레이어 정리** — 시도·흐름 레이어는 눈 아이콘으로 숨긴다(삭제하지 않는다 — confirm이 뜬다).
- [ ] **Step 2: 08-coords + 서울 스타벅스 레이어** — `데이터 불러오기` → Point Data → `서울 스타벅스 매장 목록` 클릭 → 좌표 가져오기 화면(위도/경도 열·좌표계 드롭다운)이 보이는 상태 캡처 → 가져오기. 지도를 서울로 이동(툴바 지구본 `전체 범위` 또는 레이어 ⋮ `레이어로 이동`).
- [ ] **Step 3: 서울 자치구 레이어** — `데이터 불러오기` → Area Data → `서울 자치구` 클릭. 스타벅스 레이어가 위에 오도록 순서 확인(드래그).
- [ ] **Step 4: 25-grid** — 스타벅스 레이어 선택 → 메뉴 `벡터 분석` → `격자 만들기` → 크기 1km, 집계=개수 → 실행 → 격자 결과가 보이는 지도 캡처 → 격자 레이어 숨김.
- [ ] **Step 5: 26-buffer** — 스타벅스 레이어 선택 → `버퍼 분석` → 거리 500 m, 병합 켬 → 실행 → 캡처 → 버퍼 레이어 숨김.
- [ ] **Step 6: 27-voronoi** — `보로노이 다이어그램` → 포인트=스타벅스, 클립=서울 자치구 → 생성 → 캡처 → 보로노이 레이어 숨김.
- [ ] **Step 7: 37-heatmap** — 스타벅스 레이어 선택 → 메뉴 `주제도` → `히트맵` → 적용 → 캡처 → 히트맵 끄기(레이어 숨김 또는 패널에서 해제).
- [ ] **Step 8: 28-spatial** — 메뉴 `벡터 분석` → `공간 연산` → 연산 목록(교차·합집합·차집합·클리핑·포인트 추출)이 보이는 패널, 레이어 A=서울 자치구, B=스타벅스, `포인트 추출`·`폴리곤 안` 고른 상태 캡처 → 실행하지 않고 닫기.

---

### Task 6: 캡처 D — 그리기·선택·편집·측정·좌표계

파일: `17-draw.png`, `18-select.png`, `19-edit.png`, `24-measure.png`, `13-crs.png`

- [ ] **Step 1: 17-draw** — 툴바 `면` 그리기 도구 → 지도(서울 확대)에 4~5점 클릭 후 더블클릭 → 옆에 `선` 도구로 3점 → 더블클릭 → 그리기 도구 그룹이 활성인 상태로 캡처. 그린 도형이 들어간 레이어 이름을 기억한다.
- [ ] **Step 2: 18-select** — 툴바 `선택` 도구 → 서울 자치구 레이어의 구 하나 클릭 → 툴바에 나타난 `정보 보기` 버튼 클릭 → 속성 카드가 뜬 상태 캡처 → 카드 닫기.
- [ ] **Step 3: 19-edit** — 선택 도구로 서울 자치구에서 인접한 구 2개를 `Shift+클릭`(`modifiers: "shift"`) → `zoom` `region: [0, 0, 1600, 900]` 대신 그냥 캡처해 "선택 상태"를 `19-edit-before` 로 임시 저장 → 툴바 `합치기` 버튼(또는 메뉴 `편집` → `피처 합치기`) → 합쳐진 상태 캡처 → `19-edit.png`. `Ctrl+Z`로 되돌린다. (피처가 2개 미만이면 alert가 뜨므로 반드시 2개가 선택됐는지 캡처로 먼저 확인한다.)
- [ ] **Step 4: 24-measure** — 메뉴 `측정` → `거리 측정` → 지도에 3점 클릭, 더블클릭 → 거리 값이 지도에 표시된 상태 캡처 → 메뉴 `측정` → `측정 결과 지우기`.
- [ ] **Step 5: 13-crs 재료 만들기** — `javascript_tool`로 서울 자치구 GeoJSON을 받아 좌표를 EPSG:5179 근사값으로 바꾼 파일을 만들고 레이어 패널 `+`의 파일 입력에 넣는다. 정확한 변환은 필요 없다 — 자동 판정이 "근거 없음"으로 확인 창을 띄우기만 하면 된다.

```js
const src = await fetch('/data/builtin/practice/Area%20Data/%ED%96%89%EC%A0%95%EA%B2%BD%EA%B3%84/%EC%84%9C%EC%9A%B8%20%EC%9E%90%EC%B9%98%EA%B5%AC.geojson').then(r => r.json());
// 경위도 → 대략의 UTM-K(5179) 미터 값. 판정을 헷갈리게 만드는 게 목적이므로 간이 선형 근사면 충분하다.
const conv = ([lon, lat]) => [Math.round(1000000 + (lon - 127.5) * 88000), Math.round(2000000 + (lat - 38) * 111000)];
const walk = (c) => (typeof c[0] === 'number') ? conv(c) : c.map(walk);
src.features.forEach(f => { f.geometry.coordinates = walk(f.geometry.coordinates); });
delete src.crs;
const file = new File([JSON.stringify(src)], 'seoul_gu_utmk.geojson', { type: 'application/geo+json' });
const input = document.querySelector('input[type=file][accept*="geojson"], #layer-file-input, input[type=file]');
const dt = new DataTransfer(); dt.items.add(file); input.files = dt.files;
input.dispatchEvent(new Event('change', { bubbles: true }));
input.id || input.outerHTML.slice(0, 120);
```

Expected: 좌표계 확인 창이 뜬다(후보 목록 + 지도 미리보기). 안 뜨고 바로 올라가면 파일 입력 셀렉터가 다른 것이니 `document.querySelectorAll('input[type=file]')`의 목록을 보고 레이어 패널 것으로 바꾼다.

- [ ] **Step 6: 13-crs** — 후보 좌표계를 하나 클릭해 미리보기가 그려진 상태 캡처 → `EPSG:5179` 로 확정하거나 취소.

---

### Task 7: 캡처 E — 도로망·래스터·3D·지리참조

파일: `29-isochrone.png`, `30-routing.png`, `31-terrain.png`, `32-contour.png`, `33-view3d.png`, `34-georef.png`

- [ ] **Step 1: 29-isochrone** — 메뉴 `벡터 분석` → `등시선 분석` → 도로망=`전국 주요도로`, 수단=자동차, 시간 10·20·30분 → 지도에서 출발점 클릭(서울 시청 부근) → 실행 → 결과 폴리곤이 보이는 상태 캡처 → 결과 레이어 숨김.
- [ ] **Step 2: 30-routing** — `최단경로 분석` → 도로망=주요도로 → 출발·도착을 지도 클릭(서울 시청 → 잠실) → 경유지 하나 추가 → 실행 → 경로가 보이는 상태 캡처 → 숨김.
- [ ] **Step 3: DEM 올리기** — `데이터 불러오기` → Raster → 시군구별 DEM에서 `강원 정선군`(산지가 뚜렷한 곳) 클릭 → 로드될 때까지 `wait` → 레이어로 이동.
- [ ] **Step 4: 31-terrain** — DEM 레이어 선택 → 메뉴 `래스터 분석` → `해발고도 (지형음영)` → 적용 → 캡처. 이어서 `경사도`를 한 번 실행해 결과가 어떻게 보이는지 확인만 하고(캡처는 지형음영 하나) 원래대로 되돌린다.
- [ ] **Step 5: 32-contour** — `등고선 생성` → 간격 100 m → 실행 → 등고선 벡터가 지형음영 위에 보이는 상태 캡처 → 등고선 레이어 숨김.
- [ ] **Step 6: 33-view3d** — 툴바 `3D` 버튼 → 3D 화면이 그려지면 세로 과장 슬라이더를 2~3배로 → 캡처 → `3D` 버튼으로 복귀. (PNG 저장 버튼은 누르지 않는다.)
- [ ] **Step 7: 34-georef** — 메뉴 `래스터 분석` → `지리참조` → 이미지 입력에 앞서 찍은 `images/03-home.png`를 넣는다:

```js
const blob = await fetch('http://localhost:5173/favicon.svg').then(r => r.blob()); // 대용 이미지. 실제 지도 그림이 있으면 그 URL로 바꾼다
const file = new File([blob], 'old-map.svg', { type: 'image/svg+xml' });
const input = document.getElementById('georef-file');
const dt = new DataTransfer(); dt.items.add(file); input.files = dt.files;
input.dispatchEvent(new Event('change', { bubbles: true })); input.files.length;
```

왼쪽 이미지 창에서 2점, 지도에서 대응 2점을 찍어 GCP 목록에 2개가 보이는 상태 캡처 → 닫기(적용하지 않음). 더 나은 재료: `C:\Users\김용현\Desktop\e-GIS 실습 (빛길지리)\images\` 의 지도 PNG를 `public/`에 복사하지 말고, 대신 `fetch('/data/...')` 대신 앞서 찍은 캡처를 base64로 넣어도 된다 — 어느 쪽이든 GCP 찍는 화면만 보이면 된다.

---

### Task 8: 캡처 F — 저장·내보내기·로그인

파일: `40-save.png`, `41-export.png`, `42-login.png`

- [ ] **Step 1: 40-save** — 메뉴 바 `프로젝트` 클릭 → 드롭다운(새 프로젝트·열기·저장·지도 내보내기)이 열린 상태에서 `zoom` `region: [0, 0, 700, 400]` 저장 → `Escape`. `저장`은 누르지 않는다(prompt).
- [ ] **Step 2: 41-export** — 메뉴 `프로젝트` → `지도 내보내기` → 제목·나침반·텍스트 상자 옵션이 보이는 패널 캡처 → 닫기(내보내기 버튼은 누르지 않는다).
- [ ] **Step 3: 42-login** — 오른쪽 위 `로그인` 버튼 → 로그인 창 캡처 → 닫기. 계정 정보는 입력하지 않는다.
- [ ] **Step 4: 정리** — 개발 서버 탭은 그대로 두고(Task 10 재확인용), `images/` 에 40개 파일이 있는지 센다.

```bash
ls "C:/Users/김용현/Desktop/e-GIS 기능 소개/images" | wc -l
```

Expected: `40`

---

### Task 9: 슬라이드 45장 본문 작성

**Files:**
- Modify: `C:\Users\김용현\Desktop\e-GIS 기능 소개\e-GIS_기능소개.html` — Task 1의 샘플 슬라이드 6개를 아래 45개로 교체. CSS·JS는 그대로.

- [ ] **Step 1: 기능 슬라이드 마크업 규칙** — 기본형은 Task 1의 "버퍼 분석" 슬라이드와 같은 구조(`.body` > `.text` + `.shot`). 와이드형은 `.body.wide` 에 `.shot`을 먼저. 각 슬라이드의 `.meta .tag`는 섹션명과 `n/m`, `data-goto`는 섹션 첫 슬라이드 번호. 섹션과 범위:

| 섹션 | 슬라이드 | data-goto |
|---|---|---|
| 시작하기 | 3–5 | 3 |
| 데이터 불러오기 | 6–10 | 6 |
| 지도 · 배경지도 · 좌표계 | 11–13 | 11 |
| 레이어 · 그리기 · 편집 | 14–19 | 14 |
| 속성 · 테이블 · 측정 | 20–24 | 20 |
| 벡터 · 래스터 분석 | 25–34 | 25 |
| 주제도 | 35–39 | 35 |
| 저장 · 내보내기 · 계정 | 40–45 | 40 |

와이드형으로 만드는 슬라이드: 3, 29, 31, 33, 35, 36, 37, 38, 39. 슬라이드 4는 기본형 캡처 위에 4영역 번호 원을 CSS로 얹는다(아래 Step 3). 슬라이드 11은 캡처 띠를 위, 설명을 아래(`.cols2`)에 둔다.

- [ ] **Step 2: 슬라이드별 내용** — 각 줄: 제목 / 한 줄 요약 / 경로 / 불릿 / 수업 활용(tip). 출처는 `docs/사용설명서.md` 1부이며 코드와 다른 곳(등시선·최단경로)은 코드 기준.

3. **e-GIS란** / 설치 없이 웹 브라우저에서 바로 실행되는 교육용 GIS / `https://e-gis.kr` / 태블릿(디벗)에서도 동작 · OpenStreetMap 기반 · GIS 편집·분석·주제도를 한 화면에서 · QGIS로 가기 전 입문 도구 / tip: 접속 즉시 대한민국 지도가 뜨므로 첫 시간에 바로 시작
4. **화면 구성** / 네 영역으로 이루어집니다 / – / ①메뉴 바 — 모든 기능의 진입점 · ②툴바 — 확대·선택·그리기·측정·위치 검색 · ③사이드 패널 — 레이어 탭·브라우저 탭 · ④상태 표시줄 — 좌표·축척·좌표계·조회수 / tip: 좁은 창에서는 메뉴 글자가 사라지고 아이콘만 남습니다
5. **테마 · GUIDE · 패널** / 오른쪽 위 버튼 세 개 / – / 해·달 버튼으로 밝은/어두운 테마 · GUIDE 버튼 → 사용 설명서 · 패널 옆 화살표로 접기/펴기 / tip: 프로젝터에서는 밝은 테마가 잘 보입니다
6. **내장 데이터 불러오기** / 미리 준비된 한국·세계 데이터를 바로 올립니다 / 메뉴 바 → 데이터 불러오기 / 공간 데이터 — 시군구·시도(개편 전/후)·세계 국가·서울 자치구 · 속성 데이터 — 시도별 인구·GRDP · 점 데이터 — 스타벅스·맥도날드·의료복지시설 · 래스터 — 한반도 270m + 시군구별 90m DEM 235종 · 같은 창의 **스프레드시트** 탭: 구글 시트 공유 링크로도 가져오기 / tip: 학생은 파일을 준비하지 않아도 됩니다
7. **파일 가져오기** / 내 컴퓨터의 GIS 파일을 올립니다 / 왼쪽 패널 → 브라우저 탭 / 방법 1 — 레이어 패널 + 버튼 · 방법 2 — 브라우저 탭에 드래그 앤 드롭(Shapefile은 폴더째) · 방법 3 — Shapefile 폴더 열기 · 형식: GeoJSON `.geojson/.json` · Shapefile `.zip`/폴더 · GeoPackage `.gpkg` · DEM `.tif/.img` / tip: 좌표계는 자동 판정되므로 대부분 그냥 올리면 됩니다
8. **좌표 데이터 가져오기** / 위도·경도가 든 표에서 점 레이어를 만듭니다 / 메뉴 → 레이어 → 좌표 데이터 가져오기 / `.csv/.txt/.xlsx/.xls` · 위도·경도 열 지정 · 좌표계는 값으로 자동 추측, 필요하면 변경 / tip: 학생이 조사한 장소 목록(엑셀)을 그대로 지도로
9. **공공데이터 불러오기** / 서울·경기·인천 1,070종을 앱 안에서 바로 / 데이터 불러오기 → 공공데이터 탭 / 지역 단추 + 검색(도서관·주차장·버스정류소…) · 항목 클릭 → 선택지 → 불러오기 → 표 미리보기 · 포인트로 추가 / 격자 집계 / 히트맵 · 회원가입·별도 프로그램 불필요 / tip: 우리 동네 시설 분포 탐구에 바로 활용
10. **Geocoding — 주소를 좌표로** / 주소만 있는 표를 점 데이터로 바꾸는 길 안내 / 메뉴 바 → Geocoding / 3단계 안내창 · 구글 시트 도구를 학생이 사본으로 떠서 사용 · 계정당 한도가 학생별로 나뉨 · 결과를 좌표 데이터 가져오기로 / tip: 주소 목록 → 지오코딩 → e-GIS, 한 차시 흐름
11. **지도 조작** / 이동·확대·전체 범위·위치 검색 / 툴바 / 드래그·방향키로 이동, 휠·＋/－로 확대 · 지구본 버튼 = 전체 범위 · 검색창에 주소·장소명 · 나침반(회전)·현재 위치 · 메뉴 → 보기 → 북마크 관리로 자주 가는 위치 저장 / tip 없음
12. **배경지도** / 한국 5종 + 세계 5종 / 지도 오른쪽 위 배경지도 버튼 / 한국(VWorld) — 일반·흰색·야간·위성·위성+라벨 · 세계 — OSM·OpenTopoMap·Esri 위성·위성+라벨·어두운 지도 · 테마에 맞춰 밝은/어두운 지도 자동 / tip: 위성+라벨은 토지이용 관찰에
13. **좌표계** / 가져올 때 자동으로 알아냅니다 / 상태 표시줄 오른쪽 좌표계 표시 클릭 / `.prj`·GeoPackage·GeoJSON crs 근거가 있으면 바로 변환 · 근거가 없거나 갈리면 **좌표계 확인 창** — 후보를 누르면 지도에 미리 그려 줌 · 표시 좌표계 전환: WGS84 · 웹 메르카토르 · UTM-K(5179) · 중부(5186)·동부·서부·동해원점 · Bessel·UTM 51/52N / tip: 코드를 몰라도 위치를 보고 고르면 됩니다
14. **레이어 패널** / 지도에 올라간 레이어를 관리합니다 / 왼쪽 패널 → 레이어 탭 / 눈 아이콘 표시/숨기기, 헤더 체크박스로 전체 · 클릭 선택, Shift+클릭 다중 · 드래그로 순서(위가 위에 그려짐) · ⋮ 메뉴 — 레이어로 이동·이름 변경·복사·내보내기·속성 테이블·색상 변경·삭제 / tip: 버퍼·주제도 등은 먼저 레이어를 선택해야 실행됩니다
15. **레이어 스타일** / 채우기·테두리를 따로 꾸밉니다 / ⋮ → 색상 변경 / 채우기 색·테두리 색 · 채우기/테두리 불투명도 · 선 두께·파선(실선·대시·점선·일점쇄선) · 점 레이어는 점 크기 · `.egis` 저장 시 스타일도 함께 / tip 없음
16. **레이어 합치기 / 나누기** / 레이어 목록 자체를 재구성 / 메뉴 → 레이어 → 레이어 합치기 · 나누기 / 합치기 — 벡터 레이어 2개 이상 → 하나로(원본레이어 속성 남김, 원본 삭제 선택) · 나누기 — 속성값 기준(값 = 레이어 이름) 또는 객체별 · 만들어질 수 미리 표시, 100개 초과 차단 · 피처 합치기(도형 병합)와는 다름 / tip: 시도 레이어를 시도별로 나눠 모둠에 하나씩
17. **도형 그리기** / 지도에 직접 도형을 그립니다 / 툴바 그리기 도구 / 점 — 클릭 · 선·면 — 클릭으로 꼭짓점, 더블클릭 완료 · 멀티포인트·멀티라인·멀티폴리곤 · 이미지 업로드(PNG/JPG/SVG) / tip: 답사 경로·조사 구역을 손으로 표시
18. **피처 선택과 속성 카드** / 선택한 피처의 속성을 지도 위에서 확인 / 툴바 → 선택 도구 → 정보 보기 / 클릭·드래그 범위·Shift+클릭·Ctrl+A · 정보 보기 버튼 → 레이어별로 묶인 카드 · 카드는 드래그 이동·크기 조절·접기 / tip 없음
19. **편집** / 도형을 직접 고칩니다 / 툴바 · 메뉴 → 편집 / 꼭짓점 드래그 · 피처 합치기 — 여러 피처를 하나로(다른 레이어에 걸치면 새 레이어) · 피처 자르기 — 선을 그어 둘로 · Delete, Ctrl+C/V, Ctrl+Z / tip 없음
20. **속성 테이블** / 레이어의 데이터를 표로 봅니다 / 메뉴 → 레이어 → 속성 테이블 / 행 선택(Shift·Ctrl), 헤더 체크박스 · 셀 더블클릭으로 편집 · 지도에서 보기 · 열 추가·삭제, 피처 삭제 / tip 없음
21. **테이블 결합** / 통계 표를 공간 레이어에 붙입니다 / 메뉴 → 레이어 → 테이블 결합 / CSV·엑셀 → 레이어 열과 표 열 중 키 열 지정 · 내장 속성 데이터는 불러오기 창에서 바로 결합 · 결합 후 단계구분도·도형표현도에 사용 / tip: 시도 경계 + 시도별 인구 → 인구 단계구분도
22. **필드 계산기** / 기존 속성으로 새 열을 계산 / 메뉴 → 레이어 → 필드 계산기 / 새 필드 이름 + 계산식 · 예: 인구밀도 = 인구 / 면적 / tip: 비율·1인당 값을 학생이 직접 만들어 보게
23. **라벨** / 피처 위에 속성값을 글자로 / 메뉴 → 레이어 → 라벨 설정 / 표시 필드 선택 · 글꼴·크기 지정 / tip 없음
24. **측정** / 거리와 면적을 잽니다 / 메뉴 → 측정 / 거리 측정 — 클릭으로 경로 · 면적 측정 — 폴리곤 · 측정 결과 지우기 / tip: 통학 거리·학교 부지 면적 재기
25. **격자 만들기** / 점을 격자 칸으로 묶어 집계 / 메뉴 → 벡터 분석 → 격자 만들기 / 500m·1km·5km·10km 또는 직접 입력 · 개수·합계·평균 · 빈 칸 표시 옵션 · 공공데이터 미리보기에서도 바로 / tip: 점 수천 개를 밀도 지도로
26. **버퍼 분석** — Task 1 샘플 그대로
27. **보로노이 다이어그램** / 점마다 "가장 가까운 곳" 세력권 / 메뉴 → 벡터 분석 → 보로노이 다이어그램 (티센 폴리곤) / 포인트 레이어 · 클립 레이어(없으면 사각 범위) · 색상 / tip: 편의점·병원 영향권 나누기
28. **공간 연산** / 두 레이어 사이의 연산 / 메뉴 → 벡터 분석 → 공간 연산 / 교차·합집합·차집합·클리핑 · 포인트 추출 — 폴리곤 안/밖의 점만(안이면 `poly_` 속성 부착) · 결과 형태 — 겹치는 부분만 / 피처 통째로 / tip 없음
29. **등시선 분석** / 한 지점에서 일정 시간 안에 갈 수 있는 범위 / 메뉴 → 벡터 분석 → 등시선 분석 / 내장 도로망 — 전국 주요도로 / 전체 도로 · API 키 불필요 · 자동차·자전거·도보 · 시간 여러 개 / tip: 학교에서 10·20·30분 생활권
30. **최단경로 분석** / 두 지점 사이의 최단 경로 / 메뉴 → 벡터 분석 → 최단경로 분석 / 내장 도로망 · 이동 수단 · + 경유지 추가 / tip 없음
31. **지형 분석** / DEM으로 지형을 읽습니다 / 메뉴 → 래스터 분석 / 해발고도(지형음영) · 경사도(Slope) · 경사방향(Aspect) · 재료는 데이터 불러오기 → 래스터(시군구별 90m) / tip: 우리 지역 산지·평야 읽기
32. **등고선 · 래스터 계산기** / 고도 데이터를 벡터와 조건으로 / 메뉴 → 래스터 분석 / 등고선 생성 — 간격 지정, 주곡선/계곡선 굵기 구분 · 래스터 계산기(값 필터) — 특정 고도 범위만 / tip: 해발 100m 이하만 남겨 침수 가능 지역 생각해 보기
33. **3D 보기** / 지형을 입체로 / 툴바 → 3D / 세로 과장 슬라이더 · 배경지도 선택 · PNG 저장 · 3D는 버튼을 누를 때만 내려받음 / tip 없음
34. **지리참조** / 좌표 없는 이미지를 지도에 맞춥니다 / 메뉴 → 래스터 분석 → 지리참조 / PNG/JPG/SVG · 이미지 점 ↔ 지도 점 = 기준점(GCP) · 3점 이상 아핀, 4점 이상 원근 · `.egis`에 함께 저장 / tip: 옛 지도·항공사진을 오늘 지도 위에
35. **단계구분도** — Task 1 샘플 그대로 + tip: 인구·GRDP 분포 한눈에
36. **도형표현도** / 지역 위에 파이·막대 차트 / 메뉴 → 주제도 → 도형표현도 / 파이·막대·100% 막대 · 필드별 색 · 수치 라벨 · 크기 기준 필드 + 최소/최대 / tip 없음
37. **히트맵** / 점 데이터의 밀도를 열지도로 / 메뉴 → 주제도 → 히트맵 / 점이 몰린 곳일수록 붉게 · 공공데이터 미리보기에서도 바로 / tip 없음
38. **카토그램** / 수치에 비례해 면적을 왜곡 / 메뉴 → 주제도 → 카토그램 / 인구가 많은 지역이 크게 · 라벨 표시 / tip: 면적 지도와 나란히 비교
39. **흐름도** / 지역 간 이동량을 곡선으로 / 메뉴 → 주제도 → 흐름도 / 출발·도착·양 세 열 또는 KOSIS 행렬 · 기준 레이어·이름 열로 자동 매칭 · 굵기·색 = 이동량, 원 = 유입+유출 · 원 클릭으로 그 지역 흐름만 / tip: 시도 간 인구 이동 수업
40. **프로젝트 저장 (.egis)** / 모든 것을 파일 하나에 / 메뉴 → 프로젝트 → 저장 / 벡터 도형·속성 · 스타일 · 단계구분도·도형표현도·카토그램 설정 · 래스터(고도·지리참조) · 지도 뷰 · 열기: 메뉴 → 프로젝트 → 열기 / tip: 수업 중간에 저장, 다음 시간에 이어서
41. **내보내기** / 레이어와 지도 이미지 / 메뉴 → 레이어 → 레이어 내보내기 · 프로젝트 → 지도 내보내기 / 레이어 — GeoJSON 또는 Shapefile · 지도 이미지 — 제목·나침반·텍스트 상자 얹어서 / tip: 보고서·발표 자료에 붙이기
42. **로그인 · 마이페이지** / 계정은 e-GIStory 연동용 / 오른쪽 위 로그인 / 프로필(이름·학교) · e-GIStory 클라우드 동기화·스토리맵 게시와 연동 · 로그인 없이도 모든 GIS 기능 사용 가능 / tip 없음
43. **팁과 단축키** — 표: Ctrl+A 전체 선택 · Shift+클릭 다중 선택 · Delete 삭제 · Ctrl+C/V 복사·붙여넣기 · Ctrl+Z / Ctrl+Shift+Z 실행 취소·다시 실행 · 휠 확대/축소 · 방향키 이동. 오른쪽 열에 팁 4개: 상태 표시줄 좌표·축척, 축척 입력 후 Enter, 좌표계는 상태 표시줄 오른쪽, 레이어 기반 기능은 레이어 먼저 선택.
44. **e-GIStory로 이어가기** / 만든 지도를 슬라이드로 엮어 발표 / – / e-GIS에서 `.egis` 저장 → e-GIStory에서 소스로 불러오기 · 페이지마다 지도 위치·레이어·글·사진 · 발표 모드·PDF·웹 게시 · 분할 모드로 e-GIS와 나란히 / tip: 탐구 결과를 스토리맵으로 발표
45. **마무리** — Task 1 샘플 그대로.

- [ ] **Step 3: 슬라이드 4의 영역 번호 오버레이** — `.shot`을 `position:relative`로 두고 번호 원을 절대 위치로 얹는다. 좌표는 04-layout.png를 보고 맞춘다(퍼센트).

```html
<div class="shot annot">
  <img src="images/04-layout.png" alt="화면 구성">
  <span class="pin" style="left:50%;top:3%">1</span>
  <span class="pin" style="left:50%;top:10%">2</span>
  <span class="pin" style="left:8%;top:45%">3</span>
  <span class="pin" style="left:50%;top:95%">4</span>
</div>
```

```css
.shot.annot { position: relative; }
.pin { position: absolute; transform: translate(-50%, -50%); width: 34px; height: 34px; border-radius: 50%; background: var(--blue); color: #fff; font-weight: 800; font-size: 18px; display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 8px rgba(0,0,0,.3); }
```

- [ ] **Step 4: 브라우저에서 전체 넘겨 보기** — `navigate` 덱 파일 → `Home` → `→` 를 44번 누르며 5장마다 `screenshot`(scale 0.5). 텍스트가 넘치거나 캡처가 잘리는 슬라이드는 불릿을 줄이거나 `.body.wide`로 바꾼다.

---

### Task 10: 검증

**Files:**
- Create: `C:\Users\김용현\Desktop\e-GIS 기능 소개\check.js`

- [ ] **Step 1: 검증 스크립트**

```js
// 덱의 <img src>가 images/ 파일과 1:1인지, 이모지가 없는지 확인한다.
const fs = require('fs');
const path = require('path');
const dir = __dirname;
const html = fs.readFileSync(path.join(dir, 'e-GIS_기능소개.html'), 'utf8');
const refs = [...html.matchAll(/src="images\/([^"]+)"/g)].map(m => m[1]);
const files = fs.readdirSync(path.join(dir, 'images')).filter(f => f.endsWith('.png'));
const missing = refs.filter(r => !files.includes(r));
const unused = files.filter(f => !refs.includes(f));
const slides = (html.match(/<section class="slide/g) || []).length;
const emoji = html.match(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu) || [];
console.log('slides:', slides, '| img refs:', refs.length, '| files:', files.length);
console.log('missing:', missing, '| unused:', unused, '| emoji:', emoji);
process.exit(missing.length || emoji.length || slides !== 45 ? 1 : 0);
```

- [ ] **Step 2: 실행**

```bash
cd "C:/Users/김용현/Desktop/e-GIS 기능 소개" && node check.js
```

Expected: `slides: 45 | img refs: 40 | files: 40` / `missing: [] | unused: [] | emoji: []`, exit 0.

- [ ] **Step 3: 인쇄 확인** — 덱 탭에서 `javascript_tool`로 `window.matchMedia('print')`는 못 쓰므로, 대신 `#stage`에 print 규칙과 같은 스타일을 잠시 적용해 슬라이드가 세로로 45장 쌓이는지 `read_page`로 확인한다:

```js
const st = document.createElement('style'); st.id = 'printsim';
st.textContent = '#stage{position:static;display:block}.deck{transform:none!important;height:auto}.slide{display:flex!important;position:relative;height:900px}';
document.head.appendChild(st); document.querySelectorAll('.slide').length + ' / ' + document.body.scrollHeight;
```

Expected: `45 / 40500` (45 × 900). 확인 후 `document.getElementById('printsim').remove()`.

- [ ] **Step 4: 마무리** — 개발 서버 종료, 캡처용 탭·덱 탭 닫기(`tabs_close_mcp`). 사용자에게 파일 경로와 열어 보는 법(더블클릭, ←→, Ctrl+P → PDF)을 안내한다.
