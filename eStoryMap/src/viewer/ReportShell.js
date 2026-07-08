// © 2026 김용현
// eStoryMap/src/viewer/ReportShell.js
// 보고서 셸(M10) — 페이지별 지도 이미지 캡처 → A4 섹션 조립 → 표시. PDF는 Electron printToPDF.
// 순수 도출은 reportModel.js(buildReportSections), 캡처는 mapCapture.js. 접착 컴포넌트라 스모크.
import { applyPageVisibility } from '../core/StoryMapRenderer.js';
import { buildReportSections } from './reportModel.js';
import { captureMapImage } from './mapCapture.js';
import { DEM_COLOR_RAMP } from '../core/rasterColor.js';
import { buildOverlay } from './presentationNav.js';
import { applySlideColors } from '../shared/color.js';
import { slideBgOf } from '../core/StoryDoc.js';

function rampGradientCss() {
  const stops = DEM_COLOR_RAMP.map(
    (s) => `rgb(${s.color[0]},${s.color[1]},${s.color[2]}) ${Math.round(s.value * 100)}%`,
  );
  return `linear-gradient(to right, ${stops.join(', ')})`;
}

/**
 * @param {HTMLElement} root - #report (fixed 오버레이, 평소 hidden)
 * @param {object} deps
 * @param {import('../core/MapView.js').MapView} deps.mapView
 * @param {import('../core/SourceRegistry.js').SourceRegistry} deps.registry
 * @param {() => object} deps.getDoc
 * @param {() => void} deps.onExit - 닫기 시 편집기 원복(main refresh + 카메라)
 * @param {(title:string) => Promise<string|null>} deps.onSavePDF - PDF 저장(경로|null)
 */
export function createReportShell(root, { mapView, registry, getDoc, onExit, onSavePDF }) {
  root.innerHTML = '';
  root.hidden = true;
  let active = false;

  async function open(mode = 'report') {
    const doc = getDoc();
    if (active || !doc || !doc.pages.length) return;
    active = true;
    root.hidden = false;
    root.innerHTML = '';

    const loading = document.createElement('div');
    loading.className = 'report-loading';
    root.appendChild(loading);

    // 페이지별로 카메라·레이어 세팅 후 지도 이미지 캡처(순차).
    const label = mode === 'slides' ? '발표 PDF' : '보고서';
    const images = {};
    const n = doc.pages.length;
    // 캡처 동안 지도를 1920×1080(발표 정규화 폭)으로 키워 고해상도로 캡처. 편집기는 inert·#report로 가려짐.
    const mapEl = mapView.map.getTargetElement();
    mapEl.classList.add('map-hires-capture');
    mapView.updateSize();
    try {
      for (let i = 0; i < n; i++) {
        const page = doc.pages[i];
        if ((page.kind || 'map') !== 'map') continue; // 제목/미디어/글 슬라이드는 지도 캡처 없음
        loading.textContent = `${label} 생성 중… ${i + 1}/${n}`;
        applyPageVisibility(page, registry);
        if (page.camera) mapView.setView(page.camera.center, page.camera.zoom);
        // eslint-disable-next-line no-await-in-loop
        images[page.id] = await captureMapImage(mapView.map);
      }
    } finally {
      mapEl.classList.remove('map-hires-capture'); // 지도 원래 크기로 복원(닫기/실패에도)
      mapView.updateSize();
    }

    if (!active) return; // 캡처 중 닫혔으면 중단
    if (mode === 'slides') renderSlides(doc, images);
    else renderReport(buildReportSections(doc, images), doc);
  }

  // @page 크기는 저장 직전 JS가 주입(보고서=A4 / 발표=16:9). printToPDF는 preferCSSPageSize:true 사용.
  function setPdfPageRule(mode) {
    const el = document.getElementById('pdf-page-rule');
    if (el) {
      el.textContent = mode === 'slides'
        ? '@page { size: 338.66mm 190.5mm; margin: 0; }' // 13.333in×7.5in = 16:9 가로
        : '@page { size: A4; margin: 15mm; }';
    }
  }

  // 툴바(제목·PDF 저장·닫기) — 보고서/발표 공용. PDF 버튼은 모드별 @page를 세팅한다.
  function makeToolbar(doc, mode) {
    const toolbar = document.createElement('div');
    toolbar.className = 'report-toolbar';
    const title = document.createElement('span');
    title.className = 'report-title';
    title.textContent = mode === 'slides' ? `${doc.meta.title} — 발표 PDF` : doc.meta.title;
    const pdfBtn = document.createElement('button');
    pdfBtn.type = 'button';
    pdfBtn.textContent = '📄 PDF 저장';
    pdfBtn.addEventListener('click', async () => {
      pdfBtn.disabled = true;
      pdfBtn.textContent = '저장 중…';
      setPdfPageRule(mode); // 인쇄 직전 @page 크기 결정
      const pdfTitle = mode === 'slides' ? `${doc.meta.title} 발표` : doc.meta.title;
      const result = onSavePDF ? await onSavePDF(pdfTitle) : null;
      pdfBtn.textContent = result ? '저장됨 ✓' : '📄 PDF 저장';
      pdfBtn.disabled = false;
    });
    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.textContent = '닫기';
    closeBtn.addEventListener('click', close);
    toolbar.append(title, pdfBtn, closeBtn);
    return toolbar;
  }

  // 발표 PDF: 각 페이지를 발표 화면과 동일한 16:9 슬라이드로(지도=캡처 이미지 배경 + 오버레이/커버)
  function renderSlides(doc, images) {
    root.innerHTML = '';
    root.appendChild(makeToolbar(doc, 'slides'));
    const pagesEl = document.createElement('div');
    pagesEl.className = 'slide-pdf-pages';
    const layout = doc.meta.presentationLayout || 'band';
    const pos = doc.meta.presentationPos || 'right';
    for (const page of doc.pages) pagesEl.appendChild(makeSlidePage(doc, page, images, layout, pos));
    root.appendChild(pagesEl);
  }

  function makeSlidePage(doc, page, images, layout, pos) {
    const kind = page.kind || 'map';
    const align = page.align || 'center';
    const split = kind === 'media' && !!page.split;
    const slide = document.createElement('div');
    slide.className = 'slide-pdf-page';
    const stage = document.createElement('div');
    stage.className = `pres-stage pres-layout-${layout} pres-kind-${kind} pres-pos-${pos} pres-align-${align}${split ? ' pres-split' : ''}`;
    const ratio = Math.min(80, Math.max(20, page.splitRatio || 50)); // 2단 좌우 너비 비율(사진 %)
    stage.style.setProperty('--split-photo', ratio);
    stage.style.setProperty('--split-side', 100 - ratio);
    applySlideColors(stage, slideBgOf(doc, page));
    const vm = buildOverlay(page.content); // {heading, bodyHtml(살균), caption, empty}

    const fill = (el, cls, html, text) => {
      const d = document.createElement('div');
      d.className = cls;
      if (html != null) d.innerHTML = html; else d.textContent = text;
      if (!(html || text)) d.style.display = 'none';
      el.appendChild(d);
    };

    if (kind === 'map') {
      if (images[page.id]) {
        const img = document.createElement('img');
        img.className = 'slide-pdf-map';
        img.src = images[page.id];
        stage.appendChild(img);
      }
      if (!vm.empty) {
        const overlay = document.createElement('div');
        overlay.className = 'pres-overlay';
        fill(overlay, 'pres-heading', null, vm.heading);
        fill(overlay, 'pres-body md-preview', vm.bodyHtml, null);
        fill(overlay, 'pres-caption', null, vm.caption);
        stage.appendChild(overlay);
      }
    } else {
      const cover = document.createElement('div');
      cover.className = 'pres-cover';
      const inner = document.createElement('div');
      inner.className = 'pres-cover-inner';
      if (split) {
        fill(inner, 'pres-cover-body md-preview', vm.bodyHtml, null); // 사진 열
        const side = document.createElement('div');
        side.className = 'pres-cover-side'; // 글 열(제목+옆글+캡션)
        fill(side, 'pres-cover-heading', null, vm.heading);
        fill(side, 'pres-cover-sidetext md-preview', vm.sideHtml, null);
        fill(side, 'pres-cover-caption', null, vm.caption);
        inner.appendChild(side);
      } else {
        fill(inner, 'pres-cover-heading', null, vm.heading);
        fill(inner, 'pres-cover-body md-preview', vm.bodyHtml, null);
        fill(inner, 'pres-cover-caption', null, vm.caption);
      }
      cover.appendChild(inner);
      stage.appendChild(cover);
    }
    slide.appendChild(stage);
    return slide;
  }

  function renderReport(sections, doc) {
    root.innerHTML = '';
    root.appendChild(makeToolbar(doc, 'report'));

    const pages = document.createElement('div');
    pages.className = 'report-pages';
    const docEl = document.createElement('div');
    docEl.className = 'report-doc'; // A4 폭 연속 시트 — 섹션이 세로로 흐르고 인쇄 시 자연 페이지네이션
    for (const s of sections) docEl.appendChild(makeReportSection(s));
    pages.appendChild(docEl);
    root.appendChild(pages);
  }

  function makeReportSection(s) {
    const pg = document.createElement('section');
    pg.className = 'report-section report-kind-' + (s.kind || 'map');

    // 제목(표지) 슬라이드 = 보고서 표지: 큰 제목 + 부제. 지도·범례·캡션 없음.
    if (s.kind === 'title') {
      if (s.heading) {
        const t = document.createElement('h1');
        t.className = 'report-cover-title';
        t.textContent = s.heading;
        pg.appendChild(t);
      }
      if (s.bodyHtml) {
        const sub = document.createElement('div');
        sub.className = 'report-cover-subtitle md-preview';
        sub.innerHTML = s.bodyHtml; // 살균된 HTML
        pg.appendChild(sub);
      }
      return pg;
    }

    // map / media — media는 image=null·legend=[]이라 자연히 미디어 본문·캡션만 렌더된다.
    if (s.heading) {
      const h = document.createElement('h1');
      h.className = 'report-heading';
      h.textContent = s.heading;
      pg.appendChild(h);
    }
    if (s.image) {
      const fig = document.createElement('figure');
      fig.className = 'report-figure';
      const img = document.createElement('img');
      img.src = s.image;
      img.alt = s.heading || '지도';
      fig.appendChild(img);
      pg.appendChild(fig);
    }
    if (s.legend.length) pg.appendChild(makeLegend(s.legend));
    if (s.bodyHtml) {
      const body = document.createElement('div');
      body.className = 'report-body md-preview';
      body.innerHTML = s.bodyHtml; // renderMarkdown이 DOMPurify로 살균한 HTML
      pg.appendChild(body);
    }
    if (s.caption) {
      const cap = document.createElement('div');
      cap.className = 'report-caption';
      cap.textContent = s.caption;
      pg.appendChild(cap);
    }
    return pg;
  }

  function makeLegend(items) {
    const box = document.createElement('div');
    box.className = 'report-legend';
    for (const item of items) {
      const row = document.createElement('div');
      row.className = 'legend-row';
      const mark = document.createElement('span');
      mark.className = item.kind === 'ramp' ? 'legend-mark legend-ramp' : 'legend-mark';
      mark.style.background = item.kind === 'ramp' ? rampGradientCss() : item.color;
      const label = document.createElement('span');
      label.className = 'legend-label';
      label.textContent = item.label;
      row.append(mark, label);
      box.appendChild(row);
    }
    return box;
  }

  function close() {
    if (!active) return;
    active = false;
    root.hidden = true;
    root.innerHTML = '';
    onExit();
  }

  return { open, close };
}
