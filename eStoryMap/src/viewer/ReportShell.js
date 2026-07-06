// © 2026 김용현
// eStoryMap/src/viewer/ReportShell.js
// 보고서 셸(M10) — 페이지별 지도 이미지 캡처 → A4 섹션 조립 → 표시. PDF는 Electron printToPDF.
// 순수 도출은 reportModel.js(buildReportSections), 캡처는 mapCapture.js. 접착 컴포넌트라 스모크.
import { applyPageVisibility } from '../core/StoryMapRenderer.js';
import { buildReportSections } from './reportModel.js';
import { captureMapImage } from './mapCapture.js';
import { DEM_COLOR_RAMP } from '../core/rasterColor.js';

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

  async function open() {
    const doc = getDoc();
    if (active || !doc || !doc.pages.length) return;
    active = true;
    root.hidden = false;
    root.innerHTML = '';

    const loading = document.createElement('div');
    loading.className = 'report-loading';
    root.appendChild(loading);

    // 페이지별로 카메라·레이어 세팅 후 지도 이미지 캡처(순차).
    const images = {};
    const n = doc.pages.length;
    for (let i = 0; i < n; i++) {
      const page = doc.pages[i];
      loading.textContent = `보고서 생성 중… ${i + 1}/${n}`;
      applyPageVisibility(page, registry);
      if (page.camera) mapView.setView(page.camera.center, page.camera.zoom);
      // eslint-disable-next-line no-await-in-loop
      images[page.id] = await captureMapImage(mapView.map);
    }

    if (!active) return; // 캡처 중 닫혔으면 중단
    renderReport(buildReportSections(doc, images), doc);
  }

  function renderReport(sections, doc) {
    root.innerHTML = '';

    const toolbar = document.createElement('div');
    toolbar.className = 'report-toolbar';
    const title = document.createElement('span');
    title.className = 'report-title';
    title.textContent = doc.meta.title;
    const pdfBtn = document.createElement('button');
    pdfBtn.type = 'button';
    pdfBtn.textContent = '📄 PDF 저장';
    pdfBtn.addEventListener('click', async () => {
      pdfBtn.disabled = true;
      pdfBtn.textContent = '저장 중…';
      const result = onSavePDF ? await onSavePDF(doc.meta.title) : null;
      pdfBtn.textContent = result ? '저장됨 ✓' : '📄 PDF 저장';
      pdfBtn.disabled = false;
    });
    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.textContent = '닫기';
    closeBtn.addEventListener('click', close);
    toolbar.append(title, pdfBtn, closeBtn);
    root.appendChild(toolbar);

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
    pg.className = 'report-section';

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
